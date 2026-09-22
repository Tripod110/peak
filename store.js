/* Peak — data layer (localStorage; keys keep the legacy "forge:" prefix so existing data survives the rename) */

/* Read-through cache. A single Train render used to JSON.parse the workouts blob
   ~70 times; every write funnels through Store.set, so mirroring reads in memory
   is safe and turns that into one parse. Callers that mutate a returned object
   always follow with Store.set, which refreshes the entry. */
const _cache = new Map();

/* Cloudflare Worker (worker/) base URL — empty until it's deployed. Same
   worker also handles /subscribe and /unsubscribe for push reminders (see
   api.js). Fill in after `wrangler deploy`; also add this origin to the
   connect-src line of the CSP <meta> tag in index.html, or every fetch to it
   is blocked before it leaves the browser. */
const WORKER_URL = 'https://peak-scan.smasher8976.workers.dev';
/* The public half of the Worker's VAPID keypair (worker/wrangler.toml's
   VAPID_PUBLIC_KEY var) — needed client-side for pushManager.subscribe().
   Fill in with the same value after running
   node worker/scripts/generate-vapid-keys.mjs and deploying. */
const VAPID_PUBLIC_KEY = 'BJ0-xGHMKxPhybg9kRn3AHo2dEYFxwkosBI-zdyob2qYQn5m2aSYsamYr3DoGG-UwEn9-FBAnTZPkyyTlFLMERo';

/* Opaque per-browser id, generated once. Not identity (clearing storage makes
   a new one) — used only as a KV key, for /scan rate-limiting and now for
   addressing a push subscription. */
function getDeviceId() {
  let id = Store.get('deviceId', null);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    Store.set('deviceId', id);
  }
  return id;
}

/* Scan models. Pinned, never the *-latest aliases — see the migration in getSettings. */
const DEFAULT_MODEL = 'gemini-3.5-flash';
const MODEL_ALIASES = {
  'gemini-flash-latest': 'gemini-3.5-flash',
  'gemini-flash-lite-latest': 'gemini-3.5-flash-lite'
};

/* The picker's contents before the app has ever asked Google what this key can
   actually use, and the fallback chain when the configured model 404s. Ordered
   best-first. Anything hard-coded here is a guess with a shelf life — Google
   retires models on its own schedule, which is exactly how the 2.5 default
   broke — so `refreshModelList()` in api.js replaces this with the real list the
   moment a key is available, and `scanModelOptions()` prefers that. */
const SCAN_MODELS = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — best quality' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite — more scans/day' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash — newest' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — retiring Oct 2026' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite — retiring Oct 2026' }
];
/* Google's announced shutdown for the 2.5 generation is 2026-10-16, and it has
   already 404'd once before that date. Worth warning about, not worth forcing:
   silently moving someone off a model that still works for them is its own bug. */
const RETIRING_MODEL = /^gemini-2\.5-/;

/* models the key really offers, cached from ListModels — [{id, label}] */
function cachedModelList() { return Store.get('modelList', null); }
function setCachedModelList(list) { Store.set('modelList', list); }
/* the real list when we have one, the guess when we don't, always including
   whatever is currently selected so the picker can never blank itself out */
function scanModelOptions(current) {
  const list = (cachedModelList() || SCAN_MODELS).slice();
  if (current && !list.some(m => m.id === current)) list.unshift({ id: current, label: current });
  return list;
}

const Store = {
  get(key, fallback) {
    if (_cache.has(key)) return _cache.get(key);
    try {
      const raw = localStorage.getItem('forge:' + key);
      if (raw === null) return fallback;
      const val = JSON.parse(raw);
      _cache.set(key, val);
      return val;
    } catch { return fallback; }
  },
  set(key, val) {
    _cache.set(key, val);
    localStorage.setItem('forge:' + key, JSON.stringify(val));
  },
  remove(key) { _cache.delete(key); localStorage.removeItem('forge:' + key); },
  clearCache() { _cache.clear(); },
  wipeAll() {
    Object.keys(localStorage).filter(k => k.startsWith('forge:')).forEach(k => localStorage.removeItem(k));
    _cache.clear();
  },

  /* The Gemini key is a live credential, and a backup is the one piece of Peak
     data that deliberately leaves the device — emailed to yourself, dropped in
     cloud storage, attached to a bug report. None of those are places a working
     API key should end up, so it is stripped on the way out. Everything else in
     settings is preferences and travels normally.

     deviceId is stripped for the same reason. It reads like a harmless opaque
     id, but it is the ONLY thing the Worker checks on /subscribe and
     /unsubscribe — whoever holds it can delete your reminders or repoint your
     push subscription. A value that authorises something must not ride along in
     a file whose whole purpose is to be shared. It is device identity, not
     history, so losing it on restore is correct: getDeviceId() mints a new one. */
  exportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith('forge:')) continue;
      if (k === 'forge:deviceId') continue;
      let v = localStorage.getItem(k);
      if (k === 'forge:settings') {
        try {
          const s = JSON.parse(v);
          if (s && s.apiKey) { s.apiKey = ''; v = JSON.stringify(s); }
        } catch { /* unparseable settings: ship it as-is rather than lose it */ }
      }
      out[k] = v;
    }
    return JSON.stringify({
      app: 'peak', version: 2, exported: new Date().toISOString(),
      note: 'Your Gemini API key and this device\'s id are deliberately not included in this file.',
      data: out
    }, null, 2);
  },
  /* A restore is a replacement, not a merge — otherwise keys absent from an older
     backup survive and you end up with a hybrid of two states. Two exceptions,
     both things that belong to the device rather than to the history:
       - the API key, because backups no longer carry it and replacing settings
         wholesale would silently switch scanning off on a device that was working
       - deviceId, which addresses this device's push subscription on the Worker;
         inheriting one from a file would point two installs at the same record.
         Older backups do carry it, so it is dropped silently rather than counted
         in {skipped} — Peak did write it, the file isn't lying about itself.

     This is also the ONLY place untrusted data enters Peak. A backup is a file
     someone can be handed — the app nags them to make one, so receiving one
     looks routine — and everything in it ends up in the render path. So it is
     the right and only place to validate:

       · keys outside the `forge:` namespace are dropped. GitHub Pages puts every
         project on one origin, so an unnamespaced key lands in storage shared
         with the user's other sites, and `wipeAll` (prefix-scoped) would leave
         it behind even after "Reset everything" claimed the device was clean.
       · every value is re-shaped by `sanitizeStored` before anything renders it.

     Returns {skipped} so the UI can say when a file was not what it claimed. */
  importAll(json) {
    const parsed = JSON.parse(json);
    if (!parsed || (parsed.app !== 'peak' && parsed.app !== 'forge') || !parsed.data) throw new Error('Not a Peak backup file');
    if (typeof parsed.data !== 'object' || Array.isArray(parsed.data)) throw new Error('Not a Peak backup file');
    const keepKey = getSettings().apiKey;
    const keepDeviceId = Store.get('deviceId', null);

    const all = Object.entries(parsed.data).filter(([, v]) => typeof v === 'string');
    const mine = all.filter(([k]) => k.startsWith('forge:'));
    const skipped = Object.keys(parsed.data).length - mine.length;

    Store.wipeAll();
    mine.forEach(([k, v]) => { if (k !== 'forge:deviceId') localStorage.setItem(k, v); });
    _cache.clear();
    if (keepDeviceId) Store.set('deviceId', keepDeviceId);
    sanitizeStored();

    if (keepKey) {
      const s = Store.get('settings', {});
      if (!s.apiKey) { s.apiKey = keepKey; Store.set('settings', s); }
    }
    return { skipped };
  }
};

/* ---------- restored-data normalisation ----------
   Run once, immediately after an import, before anything renders. Two jobs, and
   the second is the one that matters more than it looks:

   1. Security. Escaping at the render sink is the primary defence, but there are
      ~40 interpolation sites and one missed `esc()` is an injection. Coercing at
      the boundary means a hostile field never reaches a template as a string in
      the first place.
   2. Not bricking. `restoreSession` only ever checked `Array.isArray(exercises)`,
      so a backup whose `sets` was a string threw inside `renderExerciseBlock` on
      every render of the Train tab — permanently, since the bad session is
      reloaded from storage on each boot. Unrecoverable without devtools.

   Anything unrecognised is dropped rather than repaired. A restore that quietly
   invents data is worse than one that comes back short. */

/* Prefixed because there are no modules here: nine scripts share one global
   scope, and a bare `const str` would be a SyntaxError the day anyone else
   wants that name — which would break the entire app, not just this file. */
const SET_KINDS = ['normal', 'warmup', 'failure', 'drop'];

const szNum = (v, min, max, fallback = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};
const szInt = (v, min, max, fallback = 0) => Math.round(szNum(v, min, max, fallback));
const szStr = (v, max = 120) => String(v ?? '').slice(0, max);
const szDate = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
const szObj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
const szArr = v => Array.isArray(v) ? v : [];

function cleanSets(sets) {
  return szArr(sets).map(st => {
    const s = szObj(st);
    return {
      weight: szNum(s.weight, 0, 2000, 0),
      reps: szInt(s.reps, 0, 1000, 0),
      type: SET_KINDS.includes(s.type) ? s.type : 'normal',
      ...(s.done ? { done: true } : {}),
      ...(s.touched ? { touched: true } : {}),
      ...(s.planned ? { planned: true } : {})
    };
  });
}
/* uid is the handle v37's one-exercise-at-a-time view focuses by, and it is
   written into ~20 attributes as `data-uid="..."`. Keep one only if it looks
   exactly like something newExerciseUid() produced; ensureSessionIds() mints a
   fresh one for anything else, so a crafted uid never reaches an attribute. */
const szUid = v => /^x[a-z0-9]{6,32}$/.test(String(v ?? '')) ? String(v) : null;

function cleanExercises(list) {
  return szArr(list)
    .map(ex => ({
      name: szStr(szObj(ex).name, 80), target: szStr(szObj(ex).target, 12),
      ...(szUid(szObj(ex).uid) ? { uid: szObj(ex).uid } : {}),
      sets: cleanSets(szObj(ex).sets)
    }))
    .filter(ex => ex.name);
}
function cleanSession(s) {
  const o = szObj(s);
  if (!szDate(o.date)) return null;
  return {
    id: szStr(o.id, 40) || 'w' + Date.now(),
    date: o.date,
    dayName: szStr(o.dayName, 60),
    template: szStr(o.template, 20),
    freestyle: !!o.freestyle,
    cardio: !!o.cardio,
    ...(o.startedAt ? { startedAt: szInt(o.startedAt, 0, 1e15) } : {}),
    ...(o.score != null ? { score: szInt(o.score, 0, 100) } : {}),
    ...(o.durationMin != null ? { durationMin: szInt(o.durationMin, 0, 1440) } : {}),
    ...(o.kcalEst != null ? { kcalEst: szInt(o.kcalEst, 0, 20000) } : {}),
    ...(o.intensity ? { intensity: szStr(o.intensity, 20) } : {}),
    ...(o.type ? { type: szStr(o.type, 40) } : {}),
    ...(o.deloadWeek === true ? { deloadWeek: true } : {}),
    ...(szUid(o.focusUid) ? { focusUid: o.focusUid } : {}),
    exercises: cleanExercises(o.exercises)
  };
}

function sanitizeStored() {
  // settings — enumerations must be enumerations; timeFmt in particular gated a bug
  const s = szObj(Store.get('settings', {}));
  Store.set('settings', {
    apiKey: szStr(s.apiKey, 200),
    model: /^[\w.\-]{1,60}$/.test(s.model || '') ? s.model : DEFAULT_MODEL,
    timeFmt: s.timeFmt === '24' ? '24' : '12',
    units: s.units === 'metric' ? 'metric' : 'imperial',
    restSec: szInt(s.restSec, 15, 600, 120),
    barKg: szNum(s.barKg, 1, 50, lbToKg(45)),
    /* Added after v33. A whitelist that doesn't know a field drops it, so every
       new setting has to be listed here or a restore quietly resets it — that is
       the maintenance cost of coercing at the boundary, and it is the right
       trade against a hostile value reaching the render path. */
    theme: THEME_IDS.includes(s.theme) ? s.theme : 'dark',
    grocGroup: ['auto', 'aisle', 'flat'].includes(s.grocGroup) ? s.grocGroup : 'auto',
    // same ids as COACH_VOICE_IDS in coach.js, which loads after this file
    coachVoice: ['encouraging', 'straight', 'drill'].includes(s.coachVoice) ? s.coachVoice : 'straight',
    coachAi: s.coachAi === true,
    dietary: { restrictions: szArr(szObj(s.dietary).restrictions)
      .filter(id => DIETARY_RESTRICTIONS.some(d => d.id === id)) },
    /* reminder times land in a value="" attribute in Settings — normTime is
       what stops that being an attribute injection */
    reminders: (() => {
      const r = szObj(s.reminders);
      return { enabled: !!r.enabled, sleep: normTime(r.sleep) || null, food: normTime(r.food) || null };
    })()
  });

  // profile
  const p = Store.get('profile', null);
  if (p) {
    const o = szObj(p);
    Store.set('profile', {
      sex: o.sex === 'female' ? 'female' : 'male',
      age: szInt(o.age, 13, 100, 30),
      weightKg: szNum(o.weightKg, 27, 318, 80),
      heightCm: szInt(o.heightCm, 120, 230, 175),
      activity: ACTIVITY_MULT[o.activity] ? o.activity : 'moderate',
      goal: GOAL_ADJ[o.goal] != null ? o.goal : 'recomp',
      gymDays: szInt(o.gymDays, 1, 7, 4),
      template: szStr(o.template, 20) || 'ppl6',
      goalWeightKg: o.goalWeightKg ? szNum(o.goalWeightKg, 27, 318, 0) || null : null
    });
  }

  // sleep — the field that carried the injection
  const sleep = szObj(Store.get('sleep', {}));
  const cleanSleep = {};
  Object.entries(sleep).forEach(([k, v]) => {
    if (!szDate(k)) return;
    const e = szObj(v);
    const bed = normTime(e.bed), wake = normTime(e.wake);
    if (!bed || !wake) return;
    cleanSleep[k] = { bed, wake, quality: szInt(e.quality, 1, 5, 3), durationMin: szInt(e.durationMin, 1, 1440, 480) };
  });
  Store.set('sleep', cleanSleep);

  // workouts + any in-flight session
  Store.set('workouts', szArr(Store.get('workouts', [])).map(cleanSession).filter(Boolean));
  const active = Store.get('activeSession', null);
  if (active) {
    const c = cleanSession(active);
    if (c) Store.set('activeSession', c); else Store.remove('activeSession');
  }
  Store.remove('restState');   // a timer from another device is meaningless here

  // food log
  const food = szObj(Store.get('food', {}));
  const cleanFood = {};
  Object.entries(food).forEach(([k, v]) => {
    if (!szDate(k)) return;
    cleanFood[k] = szArr(v).map(e => {
      const o = szObj(e);
      return {
        id: szStr(o.id, 40) || 'f' + Math.random().toString(36).slice(2, 9),
        name: szStr(o.name, 120), portion: szStr(o.portion, 60),
        time: normTime(o.time) || '12:00',
        kcal: szInt(o.kcal, 0, 20000), protein: szInt(o.protein, 0, 2000),
        carbs: szInt(o.carbs, 0, 2000), fat: szInt(o.fat, 0, 2000), fiber: szInt(o.fiber, 0, 500),
        ...(typeof o.quality === 'number' ? { quality: szInt(o.quality, 0, 10) } : {}),
        ...(o.source ? { source: szStr(o.source, 12) } : {})
      };
    }).filter(e => e.name);
  });
  Store.set('food', cleanFood);

  Store.set('recentFoods', szArr(Store.get('recentFoods', [])).slice(0, 60).map(f => {
    const o = szObj(f);
    return {
      name: szStr(o.name, 120), kcal: szInt(o.kcal, 0, 20000), protein: szInt(o.protein, 0, 2000),
      carbs: szInt(o.carbs, 0, 2000), fat: szInt(o.fat, 0, 2000), fiber: szInt(o.fiber, 0, 500),
      quality: typeof o.quality === 'number' ? szInt(o.quality, 0, 10) : null,
      count: szInt(o.count, 1, 1e6, 1), lastAt: szDate(o.lastAt) ? o.lastAt : null
    };
  }).filter(f => f.name));

  Store.set('weights', szArr(Store.get('weights', []))
    .map(w => ({ date: szObj(w).date, kg: szNum(szObj(w).kg, 20, 400, 0) }))
    .filter(w => szDate(w.date) && w.kg > 0));

  Store.set('grocery', szArr(Store.get('grocery', [])).slice(0, 500).map(i => {
    const o = szObj(i);
    return {
      id: szStr(o.id, 40) || 'g' + Math.random().toString(36).slice(2, 9),
      name: szStr(o.name, 120), qty: szInt(o.qty, 1, 99, 1), done: !!o.done,
      ...(AISLE_IDS.includes(o.aisle) ? { aisle: o.aisle } : {})
    };
  }).filter(i => i.name));

  /* groceryFoodCache — names Grocery hands to Food. Unlisted until v40, which
     made it the one key that could brick the app permanently: a string here
     survives the import, a string has .slice but not .map, so food.js throws
     inside renderFood, App.render aborts before it assigns view.innerHTML, and
     the app is blank on every boot. Same shape as the sets-is-a-string bug in
     D-17 — a type nobody checked because nobody wrote that type. */
  Store.set('groceryFoodCache', szArr(Store.get('groceryFoodCache', []))
    .slice(0, 20).map(n => szStr(n, 120)).filter(Boolean));

  /* scanStats — Settings interpolates st.scans directly. Numbers were exactly
     what D-17 said not to trust. */
  const sc = szObj(Store.get('scanStats', null));
  if (Object.keys(sc).length) Store.set('scanStats', {
    scans: szInt(sc.scans, 0, 1e6), in: szInt(sc.in, 0, 1e9), out: szInt(sc.out, 0, 1e9),
    thoughts: szInt(sc.thoughts, 0, 1e9),
    model: /^[\w.\-]{1,60}$/.test(sc.model || '') ? sc.model : ''
  });

  // routine — days of [name, "NxM"] pairs, nothing else
  const r = Store.get('routine', null);
  if (r) {
    const o = szObj(r);
    const days = szArr(o.days).map(d => ({
      name: szStr(szObj(d).name, 60) || 'Day',
      ex: szArr(szObj(d).ex).map(e => szArr(e)).filter(e => e.length >= 2)
        .map(([n, t]) => [szStr(n, 80), /^\d{1,2}[×x]\d{1,3}$/.test(String(t)) ? String(t) : '3×10'])
        .filter(([n]) => n)
    })).filter(d => d.name);
    if (days.length) Store.set('routine', { name: szStr(o.name, 60) || 'My routine', base: szStr(o.base, 20), days });
    else Store.remove('routine');
  }

  /* progression preferences (v37) — keyed by lift name, holding a custom
     increment and a "keep my weight" pause. progressionPref() re-checks the
     numbers on every read, but the keys themselves reach nothing until they do,
     so bound them here too. */
  const prog = szObj(Store.get('progressionPrefs', {}));
  const cleanProg = Object.create(null);
  Object.keys(prog).forEach(k => {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
    const o = szObj(prog[k]);
    const out = {};
    if (Number.isFinite(Number(o.incKg)) && Number(o.incKg) > 0) out.incKg = szNum(o.incKg, 0.1, 100, 1);
    const hold = szObj(o.hold);
    if (Number.isFinite(Number(hold.kg)) && Number(hold.kg) > 0) {
      out.hold = { kg: szNum(hold.kg, 0.1, 2000, 0), since: szDate(hold.since) ? hold.since : null };
    }
    if (Object.keys(out).length) cleanProg[szStr(k, 80)] = out;
  });
  Store.set('progressionPrefs', JSON.parse(JSON.stringify(cleanProg)));

  /* lift goals — a weight × reps per lift name, an optional target date */
  const goals = szObj(Store.get('liftGoals', {}));
  const cleanGoals = Object.create(null);
  Object.keys(goals).forEach(k => {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
    const o = szObj(goals[k]);
    if (!(Number(o.kg) > 0) || !(Number(o.reps) >= 1)) return;
    cleanGoals[szStr(k, 80)] = {
      kg: szNum(o.kg, 0.1, 2000, 0), reps: szInt(o.reps, 1, 100, 1),
      by: szDate(o.by) ? o.by : null, set: szDate(o.set) ? o.set : null
    };
  });
  Store.set('liftGoals', JSON.parse(JSON.stringify(cleanGoals)));

  /* the AI-worded check-in cache: two short strings for one week, or nothing */
  const cw = szObj(Store.get('coachWeekly', {}));
  if (szDate(cw.week) && typeof cw.headline === 'string' && typeof cw.body === 'string') {
    Store.set('coachWeekly', { week: cw.week, hash: szStr(cw.hash, 20), headline: szStr(cw.headline, 90), body: szStr(cw.body, 520) });
  } else Store.remove('coachWeekly');

  /* coach memory — only the user's own answers ("not now" until a date) */
  const mem = szObj(Store.get('coachMemory', {}));
  const snooze = {};
  Object.entries(szObj(mem.snooze)).forEach(([k, v]) => {
    if (/^[a-z]{1,20}$/.test(k) && szDate(v)) snooze[k] = v;
  });
  const sw = szObj(mem.lastSwitch);
  Store.set('coachMemory', {
    snooze,
    ...(szDate(mem.deloadUntil) ? { deloadUntil: mem.deloadUntil } : {}),
    ...(szDate(mem.checkinSeen) ? { checkinSeen: mem.checkinSeen } : {}),
    ...(szDate(sw.date) && ['swap', 'reps'].includes(sw.kind) ? { lastSwitch: { date: sw.date, kind: sw.kind } } : {})
  });

  /* Reviewed and deliberately not re-shaped, so the next reader doesn't redo
     the audit: quips, weakLink, coachDismissed, modelList, deviceId,
     installDismissed, lastBackupAt, lastBackupPrompt, backupSnoozeUntil. None
     of them reaches a sink unescaped, and each is either regenerated on the
     next render or read through a typed accessor. Add one here the moment that
     stops being true of it. */

  // taught mappings: plain string→value maps only
  ['muscleMap', 'loadMap'].forEach(key => {
    const src = szObj(Store.get(key, {}));
    const out = Object.create(null);
    Object.keys(src).forEach(k => {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      out[szStr(k, 80)] = key === 'loadMap'
        ? (['bar', 'sled', 'post', 'none'].includes(src[k]) ? src[k] : undefined)
        : { p: szArr(szObj(src[k]).p).map(x => szStr(x, 20)), s: szArr(szObj(src[k]).s).map(x => szStr(x, 20)) };
    });
    Store.set(key, JSON.parse(JSON.stringify(out)));
  });
}

/* ---------- dates ---------- */
function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateKey(d);
}
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function daysBetween(k1, k2) {
  return Math.round((new Date(k2) - new Date(k1)) / 86400000);
}
function shiftKey(key, dir) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dir);
  return dateKey(dt);
}
/* The single gate every time-shaped value passes through → "HH:MM" or ''.
   Times live on disk, and a restored backup can put arbitrary text on disk, so
   nothing may assume a stored time is a time. `fmtTime` used to return its
   argument verbatim in 24-hour mode, which put attacker-supplied markup
   straight into the Sleep tab — see the render-path escaping below. */
function normTime(v) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(v ?? ''));
  if (!m) return '';
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

/* display a stored "HH:MM" (24h) per the user's time-format setting */
function fmtTime(hhmm) {
  const t = normTime(hhmm);
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (getSettings().timeFmt === '24') return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function nowTime() { return new Date().toTimeString().slice(0, 5); }

/* ---------- profile & targets ---------- */
function getProfile() { return Store.get('profile', null); }
function setProfile(p) { Store.set('profile', p); }
/* ---------- dietary restrictions ----------
   Client-only, name-text matching (there's no structured ingredients field on a
   food or grocery entry — see food.js/grocery.js). Tier controls badge color via
   the existing .pill good/warn/crit classes: 1 = medical allergy (crit, red),
   2 = intolerance (warn, yellow), 3 = lifestyle/religious preference (good, green). */
const DIETARY_RESTRICTIONS = [
  { id: 'gluten', label: 'Gluten-free (Celiac)', tier: 1, re: /\b(wheat|gluten|barley|rye|malt|bread|pasta|noodles?|flour|bun|buns|cracker|pretzel|beer|couscous|semolina|breaded|breading)\b/i },
  { id: 'peanut', label: 'Peanut allergy', tier: 1, re: /\b(peanut|groundnut)s?\b/i },
  { id: 'treenut', label: 'Tree nut allergy', tier: 1, re: /\b(almond|cashew|walnut|pecan|pistachio|hazelnut|macadamia)s?\b/i },
  { id: 'shellfish', label: 'Shellfish allergy', tier: 1, re: /\b(shrimp|prawns?|crab|lobster|shellfish|clams?|oysters?|scallops?|mussels?)\b/i },
  { id: 'dairy', label: 'Dairy-free', tier: 2, re: /\b(milk|cheese|yogurt|yoghurt|butter|cream|whey|casein|dairy|paneer|ghee)\b/i },
  { id: 'soy', label: 'Soy-free', tier: 2, re: /\b(soy|soya|edamame|tofu|tempeh)\b/i },
  { id: 'egg', label: 'Egg-free', tier: 2, re: /\b(eggs?|mayonnaise|mayo|meringue)\b/i },
  { id: 'vegan', label: 'Vegan', tier: 3, re: /\b(meat|beef|chicken|pork|fish|bacon|turkey|lamb|eggs?|milk|cheese|butter|honey|gelatin|yogurt|cream|whey)\b/i },
  { id: 'vegetarian', label: 'Vegetarian', tier: 3, re: /\b(meat|beef|chicken|pork|fish|bacon|turkey|lamb|gelatin|shrimp|anchov(?:y|ies))\b/i },
  { id: 'keto', label: 'Keto / low-carb', tier: 3, re: /\b(bread|pasta|rice|sugar|potato|noodles?|tortilla|cereal|oats|bun)\b/i },
  { id: 'halal', label: 'Halal', tier: 3, re: /\b(pork|bacon|ham|lard|gelatin|alcohol|wine|beer)\b/i }
];
const TIER_PILL = { 1: 'crit', 2: 'warn', 3: 'good' };

/* The allowed theme ids live here, not with the picker in app.js, because the
   import validator (sanitizeStored) needs them and store.js loads first — it
   cannot reach a constant defined in the last script on the page. app.js's
   THEMES adds the label and swatch for each of these. */
const THEME_IDS = ['dark', 'pink', 'ocean', 'forest', 'light'];

/* Shop-order aisle ids. Here rather than with the labels and regexes in
   grocery.js for the same reason as THEME_IDS: sanitizeStored has to check a
   restored item's aisle, and store.js loads first. An item whose aisle is not
   one of these used to be counted in "N to get" and then rendered in no group
   at all — visible in the count, invisible on the list. */
const AISLE_IDS = ['frozen', 'produce', 'meat', 'dairy', 'pantry', 'supps', 'other'];
function activeDietaryIds() { return getSettings().dietary?.restrictions || []; }
/* returns the matching restriction defs (with .tier/.label) for a bit of free text */
function dietaryWarnings(text) {
  if (!text) return [];
  const active = activeDietaryIds();
  if (!active.length) return [];
  return DIETARY_RESTRICTIONS.filter(d => active.includes(d.id) && d.re.test(text));
}
function dietaryBadgesHtml(text) {
  return dietaryWarnings(text)
    .map(w => `<span class="pill ${TIER_PILL[w.tier]}" title="${esc(w.label)}">⚠ ${esc(w.label)}</span>`)
    .join('');
}

function getSettings() {
  const s = Store.get('settings', {});
  const merged = {
    apiKey: '', model: DEFAULT_MODEL, timeFmt: '12',
    units: 'imperial', restSec: 120, theme: 'dark', grocGroup: 'auto',
    dietary: { restrictions: [] },
    reminders: { enabled: false, sleep: null, food: null }, ...s
  };
  // migrate from the old Claude-based scanner: ignore leftover Anthropic keys/models
  if ((merged.apiKey || '').startsWith('sk-ant-')) merged.apiKey = '';
  if ((merged.model || '').startsWith('claude')) merged.model = DEFAULT_MODEL;
  /* v27: the *-latest aliases are hot-swapped by Google on every release, which
     silently changes both quality and price (3.5 Flash is 5x the input cost of
     2.5). Pin to stable IDs and migrate anyone still holding an alias. */
  if (MODEL_ALIASES[merged.model]) merged.model = MODEL_ALIASES[merged.model];
  /* Bar weight is stored in kg. Default to the real bar for the chosen units —
     20 kg for a metric gym, 45 lb (20.41 kg) for an imperial one — so the
     settings field never opens on an odd number like "20.4 kg". */
  if (merged.barKg == null) {
    merged.barKg = s.barLb != null ? lbToKg(s.barLb)
      : merged.units === 'metric' ? 20 : lbToKg(45);
  }
  return merged;
}
function setSettings(s) { Store.set('settings', s); }

/* ---------- units ----------
   Everything is stored metric (kg / cm). These are the only conversions the UI
   should use, so switching units can never change what's on disk. */
function kgToLb(kg) { return kg * 2.20462; }
function lbToKg(lb) { return lb / 2.20462; }
function cmToFtIn(cm) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  return { ft, inch: Math.round(totalIn - ft * 12) };
}
function isMetric() { return getSettings().units === 'metric'; }
function wUnit() { return isMetric() ? 'kg' : 'lb'; }
/* kg -> number in the user's unit */
function toW(kg) { return isMetric() ? kg : kgToLb(kg); }
/* number in the user's unit -> kg */
function fromW(v) { return isMetric() ? Number(v) : lbToKg(Number(v)); }
/* kg -> rounded display string in the user's unit */
function dispW(kg, dec = 0) {
  const v = toW(kg || 0);
  const f = Math.pow(10, dec);
  return String(Math.round(v * f) / f);
}
/* smallest weight step the user can actually load */
function wStep() { return isMetric() ? 2.5 : 5; }
function roundStep(v, step) { const s = step || wStep(); return Math.max(s, Math.round(v / s) * s); }

const ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
const ACTIVITY_LABEL = {
  sedentary: 'Mostly sitting (desk / home)', light: 'Lightly active',
  moderate: 'On my feet a lot', high: 'Physical job'
};
const GOAL_ADJ = { cut: 0.80, slowcut: 0.90, recomp: 1.0, bulk: 1.10 };
const GOAL_LABEL = { cut: 'Fat loss', slowcut: 'Slow cut', recomp: 'Recomp', bulk: 'Lean bulk' };

function computeTargets(p) {
  // Mifflin-St Jeor
  const w = p.weightKg, h = p.heightCm, a = p.age;
  const bmr = p.sex === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;
  const tdee = bmr * (ACTIVITY_MULT[p.activity] || 1.55);
  let kcal = Math.round(tdee * (GOAL_ADJ[p.goal] ?? 0.85) / 10) * 10;
  const floor = p.sex === 'male' ? 1500 : 1200;
  kcal = Math.max(kcal, floor);
  // protein: higher on a cut to protect muscle
  const proteinPerKg = (p.goal === 'cut' || p.goal === 'slowcut') ? 2.2 : 1.8;
  const protein = Math.round(w * proteinPerKg);
  const fat = Math.round(Math.max(w * 0.8, kcal * 0.20 / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  // 14 g per 1000 kcal (Dietary Guidelines), which is where most people fall short
  const fiber = Math.round(kcal / 1000 * 14);
  return { kcal, protein, fat, carbs, fiber, tdee: Math.round(tdee), bmr: Math.round(bmr) };
}

/* ---------- food log ---------- */
function getFoodLog() { return Store.get('food', {}); }
/* sorted by clock time so a meal logged late still reads in the right place */
function foodForDay(key) {
  return (getFoodLog()[key] || []).slice().sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
}
function addFoodEntry(key, entry) {
  const log = getFoodLog();
  if (!log[key]) log[key] = [];
  entry.id = 'f' + Math.random().toString(36).slice(2, 9);
  // honour a caller-supplied time (repeat-a-day, manual backfill); else stamp now
  entry.time = entry.time || nowTime();
  log[key].push(entry);
  Store.set('food', log);
  rememberRecentFood(entry);
  return entry;
}
function updateFoodEntry(key, id, patch) {
  const log = getFoodLog();
  const arr = log[key] || [];
  const i = arr.findIndex(e => e.id === id);
  if (i < 0) return null;
  arr[i] = { ...arr[i], ...patch, id };
  Store.set('food', log);
  /* An edit refreshes the macros Peak remembers for this food, but it is not a
     second helping: counting it would make correcting a typo in a meal name
     rank the corrected spelling as if you had eaten it twice. */
  rememberRecentFood(arr[i], { count: false });
  return arr[i];
}
function findFoodEntry(key, id) { return (getFoodLog()[key] || []).find(e => e.id === id) || null; }
function removeFoodEntry(key, id) {
  const log = getFoodLog();
  log[key] = (log[key] || []).filter(e => e.id !== id);
  Store.set('food', log);
}
/* re-insert a deleted entry with its original id and time (undo) */
function restoreFoodEntry(key, entry) {
  const log = getFoodLog();
  if (!log[key]) log[key] = [];
  log[key].push(entry);
  Store.set('food', log);
}
function dayTotals(key) {
  return foodForDay(key).reduce((t, e) => ({
    kcal: t.kcal + (e.kcal || 0), protein: t.protein + (e.protein || 0),
    carbs: t.carbs + (e.carbs || 0), fat: t.fat + (e.fat || 0),
    fiber: t.fiber + (e.fiber || 0)
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}
function foodKey(name) { return String(name || '').trim().toLowerCase(); }

/* Frequent foods, ranked by how often you actually log them — a pure recency
   list decays exactly when it should be improving (one weekend of one-offs
   evicts the breakfast you eat every day). */
function rememberRecentFood(entry, { count = true } = {}) {
  const rec = Store.get('recentFoods', []);
  const key = foodKey(entry.name);
  const prev = rec.find(r => foodKey(r.name) === key);
  const rest = rec.filter(r => foodKey(r.name) !== key);
  rest.unshift({
    name: entry.name, kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs,
    fat: entry.fat, fiber: entry.fiber || 0,
    quality: typeof entry.quality === 'number' ? entry.quality : null,
    count: (prev?.count || 0) + (count ? 1 : 0) || 1,
    lastAt: count ? todayKey() : (prev?.lastAt || todayKey())
  });
  rest.sort((a, b) => (b.count || 1) - (a.count || 1) || ((a.lastAt || '') < (b.lastAt || '') ? 1 : -1));
  Store.set('recentFoods', rest.slice(0, 40));
}

/* Checking something off the grocery list means it's in the kitchen, so it's
   worth a name-only shortcut into Food — but it carries no macros, so it must
   never re-log itself the way a recent food chip does. Name text only. */
function rememberGroceryFood(name) {
  const key = foodKey(name);
  if (!key) return;
  const list = Store.get('groceryFoodCache', []).filter(n => foodKey(n) !== key);
  list.unshift(name);
  Store.set('groceryFoodCache', list.slice(0, 20));
}
function getGroceryFoodCache() { return Store.get('groceryFoodCache', []); }

/* Nutrition quality for a day, 0-100:
     protein adherence 45 · calorie accuracy 25 · food quality 30.
   Quality only counts items that carry a real rating, and the remaining 70 is
   rescaled when none do — otherwise a hand-logged day (no AI quality score)
   could never beat 65 no matter how well the person ate. */
function nutritionScore(key) {
  const items = foodForDay(key);
  if (!items.length) return null;
  const totals = dayTotals(key);
  const t = computeTargets(getProfile());

  const proteinPts = Math.min(totals.protein / t.protein, 1) * 45;
  const off = Math.abs(totals.kcal - t.kcal) / t.kcal;
  const kcalPts = Math.max(0, Math.min(1, (0.25 - off) / 0.20)) * 25;

  const rated = items.filter(i => typeof i.quality === 'number');
  if (!rated.length) return Math.round(Math.min(100, (proteinPts + kcalPts) * (100 / 70)));

  let wsum = 0, qsum = 0;
  rated.forEach(i => { const w = Math.max(i.kcal || 0, 1); wsum += w; qsum += w * i.quality; });
  const qualityPts = (qsum / wsum) / 10 * 30;
  return Math.round(Math.min(100, proteinPts + kcalPts + qualityPts));
}

/* ---------- body weight ---------- */
function getWeights() { return Store.get('weights', []); }
/* date is optional so a missed morning can be backfilled */
function logWeight(kg, date) {
  const d = date || todayKey();
  const ws = getWeights().filter(w => w.date !== d);
  ws.push({ date: d, kg });
  ws.sort((a, b) => a.date < b.date ? -1 : 1);
  Store.set('weights', ws);
  // only the newest weigh-in should drive the calorie targets
  const p = getProfile();
  if (p && ws[ws.length - 1].date === d) { p.weightKg = kg; setProfile(p); }
}
function removeWeight(date) { Store.set('weights', getWeights().filter(w => w.date !== date)); }
function weightForDay(key) { return getWeights().find(w => w.date === key) || null; }

/* ---------- workouts ---------- */
function getWorkouts() { return Store.get('workouts', []); }
function saveWorkout(session) {
  const all = getWorkouts();
  const idx = all.findIndex(s => s.id === session.id);
  if (idx >= 0) all[idx] = session; else all.push(session);
  Store.set('workouts', all);
}
function deleteWorkout(id) {
  Store.set('workouts', getWorkouts().filter(s => s.id !== id));
}

/* ---------- sleep ---------- */
function getSleep() { return Store.get('sleep', {}); }
function setSleepEntry(key, entry) {
  const s = getSleep();
  s[key] = entry;
  Store.set('sleep', s);
}
function removeSleepEntry(key) {
  const s = getSleep();
  delete s[key];
  Store.set('sleep', s);
}

/* ---------- grocery ---------- */
function getGrocery() { return Store.get('grocery', []); }
function setGrocery(list) { Store.set('grocery', list); }
