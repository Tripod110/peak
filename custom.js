/* Peak — log anything.

   Peak shipped with a library, a set of splits and a fixed list of cardio
   types, and everything else had to be squeezed into them: a lift the library
   didn't know was guessed from its name, an activity that wasn't a run or a
   bike was "Sports / other", and a routine always started life as one of ours.
   This file is the other half — whatever you train, defined the way you train
   it (DECISIONS.md D-23, D-24).

   Four parts:
     1. custom exercises — your definition beats every name-based guess
     2. renaming a lift everywhere its name is a key
     3. several routines, including ones built from nothing
     4. saving a logged session as a routine day
   (Custom activities live with cardio in train.js.) */

/* ---------- 1. custom exercises ----------
   Stored: { n, kind: weighted|bodyweight|timed, perHand, t } keyed by trimmed
   lower-case name. Muscles and plate loading are NOT duplicated here — they go
   into the existing muscleMap / loadMap overrides, which every reader already
   consults first. One source of truth per question. */
const EXERCISE_KINDS = [
  { id: 'weighted', label: 'Weights' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'timed', label: 'Timed hold' }
];
const LOAD_CHOICES = [
  { id: 'none', label: 'Dumbbells, cable or machine stack' },
  { id: 'bar', label: 'Barbell' },
  { id: 'sled', label: 'Plate-loaded machine' },
  { id: 'post', label: 'Landmine / T-bar' }
];

function getCustomExercises() {
  const c = Store.get('customExercises', {});
  return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
}
function customExercise(name) {
  const c = getCustomExercises()[progKey(name)];
  if (!c || !['weighted', 'bodyweight', 'timed'].includes(c.kind)) return null;
  return c;
}
function customExerciseList() {
  return Object.values(getCustomExercises()).filter(c => c && c.n);
}

function saveCustomExercise(def) {
  const all = { ...getCustomExercises() };
  all[progKey(def.n)] = {
    n: def.n, kind: def.kind, perHand: def.kind === 'weighted' && !!def.perHand,
    t: /^\d{1,2}×\d{1,3}$/.test(def.t) ? def.t : '3×10'
  };
  Store.set('customExercises', all);
  if (def.p && def.p.length) setMuscleOverride(def.n, def.p, def.s || []);
  if (def.kind === 'weighted' && def.load) setLoadOverride(def.n, def.load);
}

/* The editor. `ctx.pick` adds the new lift wherever you were adding one — the
   live session or a routine day — so creating it is one step, not two. */
function openExerciseEditor(name, ctx = {}) {
  const existing = name ? customExercise(name) : null;
  const n = name || ctx.q || '';
  const kind = existing?.kind
    || (n && isTimedLift(n) ? 'timed' : n && !exerciseHasLoad(n) ? 'bodyweight' : 'weighted');
  const m = n ? musclesFor(n) : { p: [], s: [] };
  const tg = parseTarget(existing?.t || (n ? defaultTargetFor(n) : '3×10')) || { sets: 3, reps: 10 };
  const load = n ? (getLoadMap()[n.toLowerCase()] || (loadKind(n) || 'none')) : 'none';
  App.exEditor = { orig: name || null, ctx };   // editing any existing lift can rename it; a search term is not a name
  openModal(`
    <h3>${existing ? 'Edit exercise' : 'New exercise'}</h3>
    <div class="modal-sub">Anything you train. Peak uses what you set here instead of guessing from the name.</div>
    <label for="ce-name">Name</label>
    <input id="ce-name" value="${esc(n)}" maxlength="60" autocomplete="off" placeholder="e.g. Belt Squat, Dead Hang, Sled Push">
    <label>Type</label>
    <div class="seg" id="ce-kind">
      ${EXERCISE_KINDS.map(k => `<button data-v="${k.id}" class="${k.id === kind ? 'on' : ''}">${k.label}</button>`).join('')}
    </div>
    <label class="check-row"><input type="checkbox" id="ce-perhand" ${existing?.perHand || (n && perHandLift(n)) ? 'checked' : ''}>
      <span>Weight is per hand (dumbbells, single-arm)</span></label>
    <label>How it's loaded</label>
    <div class="seg seg-wrap" id="ce-load">
      ${LOAD_CHOICES.map(l => `<button data-v="${l.id}" class="${l.id === load ? 'on' : ''}">${l.label}</button>`).join('')}
    </div>
    <label>Default sets × reps <span class="muted">(seconds, for a timed hold)</span></label>
    <div class="grid-2">
      <input id="ce-sets" type="number" inputmode="numeric" min="1" max="12" value="${tg.sets}" aria-label="Sets">
      <input id="ce-reps" type="number" inputmode="numeric" min="1" max="600" value="${tg.reps}" aria-label="Reps or seconds">
    </div>
    <label>Primary muscles</label>
    <div class="mus-grid" id="ce-primary">
      ${MUSCLES.map(x => `<button data-m="${x}" class="${m.p.includes(x) ? 'on' : ''}">${MUSCLE_LABEL[x]}</button>`).join('')}
    </div>
    <label>Secondary muscles (optional)</label>
    <div class="mus-grid" id="ce-secondary">
      ${MUSCLES.map(x => `<button data-m="${x}" class="${m.s.includes(x) ? 'on' : ''}">${MUSCLE_LABEL[x]}</button>`).join('')}
    </div>
    <button class="btn primary mt" data-action="ce-save">${existing ? 'Save changes' : ctx.pick ? 'Create and add' : 'Create exercise'}</button>
    <button class="btn ghost mt" data-action="close-modal">Cancel</button>
  `);
}

function saveExerciseEditor() {
  const st = App.exEditor || { ctx: {} };
  const name = (document.getElementById('ce-name')?.value || '').trim().replace(/\s+/g, ' ');
  if (!name) { toast('Give it a name'); return; }
  const kind = document.querySelector('#ce-kind button.on')?.dataset.v || 'weighted';
  const sets = Math.round(Number(document.getElementById('ce-sets')?.value)) || 3;
  const reps = Math.round(Number(document.getElementById('ce-reps')?.value)) || 10;
  const pick = id => [...document.querySelectorAll(`#${id} button.on`)].map(b => b.dataset.m);
  const p = pick('ce-primary');
  const s = pick('ce-secondary').filter(x => !p.includes(x));
  if (!p.length) { toast('Pick at least one primary muscle, so it counts toward your weekly volume'); return; }
  const def = {
    n: name, kind, perHand: !!document.getElementById('ce-perhand')?.checked,
    t: `${Math.min(Math.max(sets, 1), 12)}×${Math.min(Math.max(reps, 1), 600)}`,
    load: document.querySelector('#ce-load button.on')?.dataset.v || 'none', p, s
  };
  if (st.orig && st.orig.toLowerCase() !== name.toLowerCase()) {
    if (!renameExerciseEverywhere(st.orig, name)) return;
    const all = { ...getCustomExercises() };
    delete all[progKey(st.orig)];
    Store.set('customExercises', all);
  }
  saveCustomExercise(def);
  closeModal();
  App.exEditor = null;
  const ctx = st.ctx || {};
  if (ctx.pick) {
    App.picker = { action: ctx.pick, ctx: ctx.pickCtx || {}, q: '', group: 'all' };
    pickerChoose(name);
  } else {
    toast(`${name} saved`);
    App.render();
  }
}

/* ---------- 2. rename everywhere ----------
   History is keyed by name — sessions, routines, goals, preferences, taught
   muscles and loading. A rename that missed one of them would quietly split a
   lift into two histories, so it rewrites all of them at once, and one Undo
   puts every one of them back. */
const NAME_KEYED = ['workouts', 'routine', 'routineLibrary', 'progressionPrefs', 'liftGoals', 'muscleMap', 'loadMap', 'customExercises'];
function renameExerciseEverywhere(from, to) {
  const f = from.toLowerCase(), t = to.toLowerCase();
  if (f === t) return true;
  const taken = getWorkouts().some(s => (s.exercises || []).some(e => e.name.toLowerCase() === t))
    || !!customExercise(to);
  if (taken) { toast(`There's already an exercise called ${to} — pick another name`); return false; }
  const snapshot = {};
  NAME_KEYED.forEach(k => { snapshot[k] = JSON.stringify(Store.get(k, null)); });
  const sessionNames = App.activeSession ? App.activeSession.exercises.map(e => e.name) : null;

  const ren = n => (String(n).toLowerCase() === f ? to : n);
  Store.set('workouts', getWorkouts().map(s => ({ ...s, exercises: (s.exercises || []).map(e => ({ ...e, name: ren(e.name) })) })));
  const fixRoutine = r => r && Array.isArray(r.days) ? { ...r, days: r.days.map(d => ({ ...d, ex: d.ex.map(([n, tg]) => [ren(n), tg]) })) } : r;
  const r = Store.get('routine', null);
  if (r) Store.set('routine', fixRoutine(r));
  const lib = getRoutineLibrary();
  if (lib.length) Store.set('routineLibrary', lib.map(fixRoutine));
  ['progressionPrefs', 'liftGoals', 'muscleMap', 'loadMap'].forEach(k => {
    const m = { ...(Store.get(k, {}) || {}) };
    if (m[f] !== undefined) { m[t] = m[f]; delete m[f]; Store.set(k, m); }
  });
  if (App.activeSession) App.activeSession.exercises.forEach(e => { e.name = ren(e.name); });
  destructive('rename-exercise', { snapshot, sessionNames }, `Renamed ${from} to ${to} everywhere`);
  return true;
}
registerUndo('rename-exercise', u => {
  NAME_KEYED.forEach(k => {
    const v = JSON.parse(u.snapshot[k]);
    if (v == null) Store.remove(k); else Store.set(k, v);
  });
  if (App.activeSession && u.sessionNames) App.activeSession.exercises.forEach((e, i) => { if (u.sessionNames[i]) e.name = u.sessionNames[i]; });
});

/* ---------- 3. several routines ----------
   `routine` stays what it always was — the active custom routine — so every
   reader keeps working. The others wait in `routineLibrary`. Switching swaps
   one in and parks the current one; nothing is ever silently discarded. */
function getRoutineLibrary() {
  const l = Store.get('routineLibrary', []);
  return Array.isArray(l) ? l.filter(r => r && Array.isArray(r.days)) : [];
}
function newRoutineId() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* park the active routine (if it's a custom one) in the library */
function parkActiveRoutine() {
  const cur = Store.get('routine', null);
  if (!cur || !Array.isArray(cur.days) || !cur.days.length) return;
  const lib = getRoutineLibrary().filter(r => r.id !== cur.id);
  lib.unshift({ ...cur, id: cur.id || newRoutineId() });
  Store.set('routineLibrary', lib);
}

function createRoutine({ name, from = 'blank', days = 3 }) {
  const prev = { routine: Store.get('routine', null), lib: getRoutineLibrary() };
  parkActiveRoutine();
  let r;
  if (from === 'blank') {
    const n = Math.min(Math.max(Math.round(days) || 3, 1), 7);
    r = { name: name || 'My routine', days: Array.from({ length: n }, (_, i) => ({ name: `Day ${i + 1}`, ex: [] })) };
  } else {
    const base = TEMPLATES[from] || TEMPLATES.ppl6;
    r = { name: name || base.name, base: from, days: base.days.map(d => ({ name: d.name, ex: d.ex.map(e => [e[0], e[1]]) })) };
  }
  r.id = newRoutineId();
  r.createdAt = todayKey();
  Store.set('routine', r);
  destructive('routine-swap', prev, `Started ${r.name}`);
  return r;
}

function switchRoutine(id) {
  const lib = getRoutineLibrary();
  const pick = lib.find(r => r.id === id);
  if (!pick) return;
  const prev = { routine: Store.get('routine', null), lib };
  parkActiveRoutine();
  Store.set('routineLibrary', getRoutineLibrary().filter(r => r.id !== id));
  Store.set('routine', pick);
  destructive('routine-swap', prev, `Switched to ${pick.name}`);
}
function deleteLibraryRoutine(id) {
  const lib = getRoutineLibrary();
  const gone = lib.find(r => r.id === id);
  if (!gone) return;
  Store.set('routineLibrary', lib.filter(r => r.id !== id));
  destructive('routine-swap', { routine: Store.get('routine', null), lib }, `Deleted ${gone.name}`);
}
function renameActiveRoutine(name) {
  const r = editableRoutine();
  r.name = name;
  if (!r.id) r.id = newRoutineId();
  saveRoutine(r);
}
registerUndo('routine-swap', u => {
  if (u.routine) Store.set('routine', u.routine); else Store.remove('routine');
  Store.set('routineLibrary', u.lib || []);
});

function routineSwitcherHtml() {
  const r = activeRoutine();
  const lib = getRoutineLibrary();
  return `
  <div class="card">
    <h2>Your routines</h2>
    <div class="rt-row on">
      <span class="grow"><b>${esc(r.name)}</b> <span class="muted small">· in use · ${r.days.length} days</span></span>
      <button class="btn small" data-action="routine-rename-all">Rename</button>
    </div>
    ${lib.map(x => `
    <div class="rt-row">
      <span class="grow">${esc(x.name)} <span class="muted small">· ${x.days.length} days</span></span>
      <button class="btn small" data-action="routine-switch" data-id="${esc(x.id)}">Use</button>
      <button class="x-btn" data-action="routine-lib-del" data-id="${esc(x.id)}" aria-label="Delete ${esc(x.name)}">✕</button>
    </div>`).join('')}
    <button class="btn mt" data-action="routine-new">＋ New routine</button>
  </div>`;
}

function openNewRoutineSheet() {
  const p = getProfile();
  openModal(`
    <h3>New routine</h3>
    <div class="modal-sub">Your current routine is kept — switch back any time.</div>
    <label for="nr-name">Name</label>
    <input id="nr-name" maxlength="60" placeholder="e.g. Summer strength block">
    <label>Start from</label>
    <div class="seg seg-wrap" id="nr-from">
      <button data-v="blank" class="on">Blank</button>
      ${Object.entries(TEMPLATES).map(([k, v]) => `<button data-v="${k}">${esc(v.name)}</button>`).join('')}
    </div>
    <label for="nr-days">Days (for a blank routine)</label>
    <input id="nr-days" type="number" inputmode="numeric" min="1" max="7" value="${p?.gymDays || 3}">
    <button class="btn primary mt" data-action="routine-new-save">Create</button>
    <button class="btn ghost mt" data-action="close-modal">Cancel</button>
  `);
}
function saveNewRoutineSheet() {
  const name = (document.getElementById('nr-name')?.value || '').trim();
  const from = document.querySelector('#nr-from button.on')?.dataset.v || 'blank';
  const days = Number(document.getElementById('nr-days')?.value) || 3;
  closeModal();
  createRoutine({ name, from, days });
  App.routineDay = 0;
  App.render();
}

/* ---------- 4. save a session as a routine day ----------
   Train something freestyle that worked? Keep it. Each lift's target is the
   number of working sets you did × the rep count you did most often. */
function sessionAsDay(session) {
  return (session.exercises || []).map(ex => {
    const work = workingSets(ex.sets).filter(st => st.reps > 0);
    if (!work.length) return null;
    const counts = {};
    work.forEach(st => { counts[st.reps] = (counts[st.reps] || 0) + 1; });
    const reps = Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]);
    return [ex.name, `${Math.min(work.length, 12)}×${Math.min(reps, 600)}`];
  }).filter(Boolean);
}
function openSaveAsDay(id) {
  const s = getWorkouts().find(w => w.id === id);
  if (!s) return;
  const ex = sessionAsDay(s);
  openModal(`
    <h3>Save as a routine day</h3>
    <div class="modal-sub">${ex.map(([n, t]) => `${esc(n)} ${esc(t)}`).join(' · ')}</div>
    <label for="sd-name">Day name</label>
    <input id="sd-name" maxlength="60" value="${esc(s.freestyle ? '' : s.dayName || '')}" placeholder="e.g. Arms & Abs">
    <button class="btn primary mt" data-action="save-as-day" data-id="${esc(id)}">Add to ${esc(activeRoutine().name)}</button>
    <button class="btn ghost mt" data-action="close-modal">Cancel</button>
  `);
}
function saveSessionAsDay(id, name) {
  const s = getWorkouts().find(w => w.id === id);
  if (!s) return false;
  const ex = sessionAsDay(s);
  if (!ex.length) { toast('Nothing in that session to save'); return false; }
  const prev = { routine: Store.get('routine', null), lib: getRoutineLibrary() };
  const r = editableRoutine();
  r.days.push({ name: name || `Day ${r.days.length + 1}`, ex });
  saveRoutine(r);
  destructive('routine-swap', prev, `Added ${name || 'the day'} to ${r.name}`);
  return true;
}

/* ---------- 5. import from Strong or Hevy ----------
   Years of history elsewhere is exactly what the plateau engine and the coach
   need on day one. Both apps export a CSV with one row per set; this turns it
   into Peak sessions.

     Strong: Date, Workout Name, Exercise Name, Set Order, Weight, Reps, Seconds…
             (comma or semicolon; weight in whatever unit Strong was set to —
             the file doesn't say, so we ask)
     Hevy:   title, start_time, exercise_title, set_type, weight_lbs|weight_kg,
             reps, duration_seconds…

   A CSV from someone else's app is untrusted input like a backup (D-17): it's
   parsed into plain values here, and the whole store goes back through
   sanitizeStored before anything renders it. */

/* RFC-4180-ish: quoted fields, doubled quotes, CRLF, the delimiter sniffed from the header */
function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/* "2023-01-15 10:30:00" (Strong) · "15 Jan 2023, 10:30" (Hevy) → YYYY-MM-DD */
function importDate(s) {
  const v = String(s || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(v);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/* "Bench Press (Barbell)" → Peak's "Bench Press"; "Bicep Curl (Dumbbell)" →
   "Dumbbell Curl". Tries the library under a few spellings; a lift Peak
   doesn't know keeps its own name and lands in the "not counted yet" tagging
   flow, where Create exercise can define it. */
const IMPORT_ALIASES = {
  'bent over row': 'Barbell Row', 'bent over row (barbell)': 'Barbell Row', 'bicep curl (dumbbell)': 'Dumbbell Curl',
  'bicep curl (barbell)': 'Barbell Curl', 'bicep curl (cable)': 'Cable Curl', 'hammer curl (dumbbell)': 'Hammer Curl',
  'triceps pushdown (cable - straight bar)': 'Triceps Pushdown', 'triceps rope pushdown': 'Rope Pushdown',
  'lat pulldown (cable)': 'Lat Pulldown', 'seated row (cable)': 'Seated Cable Row', 'pull up': 'Pull-up', 'chin up': 'Chin-up',
  'squat (barbell)': 'Squat', 'front squat (barbell)': 'Front Squat', 'deadlift (barbell)': 'Deadlift',
  'romanian deadlift (barbell)': 'Romanian Deadlift', 'overhead press (barbell)': 'Overhead Press',
  'shoulder press (dumbbell)': 'Seated Dumbbell Shoulder Press', 'lateral raise (dumbbell)': 'Lateral Raise',
  'hip thrust (barbell)': 'Hip Thrust', 'leg press (machine)': 'Leg Press', 'leg extension (machine)': 'Leg Extension',
  'lying leg curl (machine)': 'Leg Curl', 'seated leg curl (machine)': 'Seated Leg Curl', 'plank': 'Plank (seconds)'
};
const squash = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
let _libSquashed = null;
function libBySquash(s) {
  if (!_libSquashed) { _libSquashed = new Map(); libAll().forEach(e => _libSquashed.set(squash(e.n), e.n)); }
  return _libSquashed.get(squash(s)) || null;
}
function mapImportedName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!name) return '';
  const alias = IMPORT_ALIASES[name.toLowerCase()];
  if (alias) return alias;
  const direct = libBySquash(name);
  if (direct) return direct;
  const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(name);
  if (m) {
    const base = m[1], equip = m[2].split(/\s*-\s*/)[0];
    for (const c of [`${equip} ${base}`, base, `${base} ${equip}`]) { const hit = libBySquash(c); if (hit) return hit; }
  }
  return name;
}

function importHash(k) {
  let h = 0;
  for (let i = 0; i < k.length; i++) { h = (h << 5) - h + k.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}

/* → { format, sessions: [...], sets, skipped, unknown: [names] } */
function parseWorkoutCsv(text, weightUnit) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('That file has no rows to import.');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = n => head.indexOf(n);
  let format;
  if (col('exercise_title') >= 0 && col('start_time') >= 0) format = 'hevy';
  else if (col('exercise name') >= 0 && col('date') >= 0) format = 'strong';
  else throw new Error("That doesn't look like a Strong or Hevy export — check it's the workout CSV.");

  const lbCol = col('weight_lbs'), kgCol = col('weight_kg');
  const get = (r, n) => { const i = col(n); return i >= 0 ? (r[i] ?? '') : ''; };
  const toKg = v => {
    const n = Number(String(v).replace(',', '.'));
    if (!(n > 0)) return 0;
    if (format === 'hevy') return kgCol >= 0 ? n : n / 2.20462;
    return weightUnit === 'kg' ? n : n / 2.20462;
  };

  const byKey = new Map();
  let sets = 0, skipped = 0;
  rows.slice(1).forEach(r => {
    const stamp = format === 'hevy' ? get(r, 'start_time') : get(r, 'date');
    const date = importDate(stamp);
    const exName = mapImportedName(format === 'hevy' ? get(r, 'exercise_title') : get(r, 'exercise name'));
    if (!date || !exName) { skipped++; return; }
    const workout = String(format === 'hevy' ? get(r, 'title') : get(r, 'workout name')).trim().slice(0, 60) || 'Imported workout';
    let reps = Math.round(Number(get(r, 'reps')) || 0);
    const secs = Math.round(Number(format === 'hevy' ? get(r, 'duration_seconds') : get(r, 'seconds')) || 0);
    const weight = toKg(format === 'hevy' ? (kgCol >= 0 ? r[kgCol] : lbCol >= 0 ? r[lbCol] : '') : get(r, 'weight'));
    const dist = Number(format === 'hevy' ? (get(r, 'distance_km') || get(r, 'distance_miles')) : get(r, 'distance')) || 0;
    if (dist > 0 && !(weight > 0)) { skipped++; return; }   // a run or a row: cardio, not a lift
    if (!reps && secs) reps = secs;            // a timed hold: seconds are the reps, as elsewhere in Peak
    if (!reps) { skipped++; return; }           // cardio rows and empty sets
    const kindRaw = String(format === 'hevy' ? get(r, 'set_type') : get(r, 'set order')).toLowerCase();
    const type = /warm|^w$/.test(kindRaw) ? 'warmup' : /drop|^d$/.test(kindRaw) ? 'drop' : /fail|^f$/.test(kindRaw) ? 'failure' : 'normal';
    const key = `${stamp}|${workout}`;
    if (!byKey.has(key)) byKey.set(key, { date, workout, stamp, exercises: new Map() });
    const s = byKey.get(key);
    if (!s.exercises.has(exName)) s.exercises.set(exName, []);
    s.exercises.get(exName).push({ weight: Math.round(weight * 1000) / 1000, reps: Math.min(reps, 1000), type });
    sets++;
  });

  const sessions = [...byKey.values()].map(s => ({
    id: 'imp' + importHash(`${format}|${s.stamp}|${s.workout}`),
    date: s.date, dayName: s.workout, imported: format, freestyle: true,
    exercises: [...s.exercises.entries()].map(([name, st]) => ({ name, target: '', sets: st }))
  })).sort((a, b) => a.date < b.date ? -1 : 1);

  const names = new Set(sessions.flatMap(s => s.exercises.map(e => e.name)));
  const unknown = [...names].filter(n => { const m = musclesFor(n); return !m.p.length && !m.s.length; });
  return { format, sessions, sets, skipped, unknown };
}

/* Adds the sessions you don't already have. "Already have" is the same import
   id (re-importing the same file), or a session already in Peak on that date
   with the same lifts — so importing after switching apps doesn't double up. */
function importWorkouts(parsed) {
  const existing = getWorkouts();
  const ids = new Set(existing.map(w => w.id));
  const sig = w => `${w.date}|${(w.exercises || []).map(e => e.name.toLowerCase()).sort().join(',')}`;
  const have = new Set(existing.map(sig));
  const fresh = parsed.sessions.filter(s => !ids.has(s.id) && !have.has(sig(s)));
  if (!fresh.length) return { added: 0, duplicate: parsed.sessions.length };
  Store.set('workouts', existing.concat(fresh));
  sanitizeStored();
  destructive('import', { ids: fresh.map(s => s.id) },
    `Imported ${plural(fresh.length, 'workout')} from ${parsed.format === 'hevy' ? 'Hevy' : 'Strong'}`);
  return { added: fresh.length, duplicate: parsed.sessions.length - fresh.length };
}
registerUndo('import', u => {
  const gone = new Set(u.ids);
  Store.set('workouts', getWorkouts().filter(w => !gone.has(w.id)));
});

function openImportSheet() {
  openModal(`
    <h3>Import from Strong or Hevy</h3>
    <div class="modal-sub">Export your workouts as CSV from the other app, then pick the file here. Your history lands in Peak alongside what you've logged — nothing is replaced, and Undo takes it all back out.</div>
    <label>Weights in a Strong file are in</label>
    <div class="seg" id="imp-unit">
      <button data-v="lb" class="${isMetric() ? '' : 'on'}">lb</button>
      <button data-v="kg" class="${isMetric() ? 'on' : ''}">kg</button>
    </div>
    <div class="chart-note">Hevy files say their unit themselves.</div>
    <label class="btn primary mt" style="display:flex">Choose CSV file<input id="imp-file" type="file" accept=".csv,text/csv" style="display:none"></label>
    <div class="chart-note">Strong: Settings → Export data. Hevy: Settings → Export &amp; import data → Export workouts.</div>
    <button class="btn ghost mt" data-action="close-modal">Cancel</button>
  `, { label: 'Import workouts' });
  document.getElementById('imp-file')?.addEventListener('change', ev => {
    const f = ev.target.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast('That file is over 20 MB — is it the workout export?'); return; }
    const unit = document.querySelector('#imp-unit button.on')?.dataset.v || 'lb';
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const parsed = parseWorkoutCsv(rd.result, unit);
        const res = importWorkouts(parsed);
        closeModal();
        App.render();
        if (!res.added) { toast('Nothing new in that file — every workout is already in Peak'); return; }
        if (parsed.unknown.length) {
          setTimeout(() => toast(`${plural(parsed.unknown.length, 'lift')} Peak doesn't know yet — tag them on Train so they count toward your volume`), 1200);
        }
      } catch (e) { toast(e.message); }
    };
    rd.readAsText(f);
  });
}
