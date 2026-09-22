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
