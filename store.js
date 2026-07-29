/* Peak — data layer (localStorage; keys keep the legacy "forge:" prefix so existing data survives the rename) */

/* Read-through cache. A single Train render used to JSON.parse the workouts blob
   ~70 times; every write funnels through Store.set, so mirroring reads in memory
   is safe and turns that into one parse. Callers that mutate a returned object
   always follow with Store.set, which refreshes the entry. */
const _cache = new Map();

/* Scan models. Pinned, never the *-latest aliases — see the migration in getSettings. */
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODEL_ALIASES = {
  'gemini-flash-latest': 'gemini-2.5-flash',
  'gemini-flash-lite-latest': 'gemini-2.5-flash-lite'
};

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

  exportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('forge:')) out[k] = localStorage.getItem(k);
    }
    return JSON.stringify({ app: 'peak', version: 2, exported: new Date().toISOString(), data: out }, null, 2);
  },
  /* A restore is a replacement, not a merge — otherwise keys absent from an older
     backup survive and you end up with a hybrid of two states. */
  importAll(json) {
    const parsed = JSON.parse(json);
    if (!parsed || (parsed.app !== 'peak' && parsed.app !== 'forge') || !parsed.data) throw new Error('Not a Peak backup file');
    Store.wipeAll();
    Object.entries(parsed.data).forEach(([k, v]) => localStorage.setItem(k, v));
    _cache.clear();
  }
};

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
/* display a stored "HH:MM" (24h) per the user's time-format setting */
function fmtTime(hhmm) {
  if (!hhmm) return '';
  if (getSettings().timeFmt === '24') return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function nowTime() { return new Date().toTimeString().slice(0, 5); }

/* ---------- profile & targets ---------- */
function getProfile() { return Store.get('profile', null); }
function setProfile(p) { Store.set('profile', p); }
function getSettings() {
  const s = Store.get('settings', {});
  const merged = {
    apiKey: '', model: DEFAULT_MODEL, timeFmt: '12',
    units: 'imperial', restSec: 120, ...s
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
  rememberRecentFood(arr[i]);
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
function rememberRecentFood(entry) {
  const rec = Store.get('recentFoods', []);
  const key = foodKey(entry.name);
  const prev = rec.find(r => foodKey(r.name) === key);
  const rest = rec.filter(r => foodKey(r.name) !== key);
  rest.unshift({
    name: entry.name, kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs,
    fat: entry.fat, fiber: entry.fiber || 0,
    quality: typeof entry.quality === 'number' ? entry.quality : null,
    count: (prev?.count || 0) + 1, lastAt: todayKey()
  });
  rest.sort((a, b) => (b.count || 1) - (a.count || 1) || ((a.lastAt || '') < (b.lastAt || '') ? 1 : -1));
  Store.set('recentFoods', rest.slice(0, 40));
}

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
