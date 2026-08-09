/* Peak — the exercise library, editable routines, and the coach that learns
   from what you actually do.

   Built-in splits (TEMPLATES in train.js) are seeds. The moment a user changes
   anything the routine forks into their own copy in storage, and from then on
   the app is working from their routine rather than ours. Nothing here mutates
   a built-in. */

/* ---------- exercise library ----------
   Two jobs. It is the thing you pick from when adding a lift, and it is the
   authoritative muscle mapping for everything in it — `musclesFor` consults it
   before falling back to pattern matching, so a library lift can never be
   silently mis-counted by a regex that happened to match the wrong word.

   n = name · p = primary movers (defaults to its group) · s = secondary
   t = a sane default prescription, used when the lift is added to a routine */
const LIB = {
  chest: [
    { n: 'Bench Press', s: ['triceps', 'shoulders'], t: '4×6' },
    { n: 'Incline Bench Press', s: ['shoulders', 'triceps'], t: '3×8' },
    { n: 'Decline Bench Press', s: ['triceps'], t: '3×8' },
    { n: 'Dumbbell Bench Press', s: ['triceps', 'shoulders'], t: '3×10' },
    { n: 'Incline DB Press', s: ['shoulders', 'triceps'], t: '3×10' },
    { n: 'Machine Chest Press', s: ['triceps'], t: '3×10' },
    { n: 'Push-up', s: ['triceps', 'shoulders'], t: '3×15' },
    { n: 'Weighted Push-up', s: ['triceps', 'shoulders'], t: '3×10' },
    { n: 'Dip', s: ['triceps', 'shoulders'], t: '3×10' },
    { n: 'Weighted Dip', s: ['triceps', 'shoulders'], t: '3×8' },
    { n: 'Cable Fly', s: ['shoulders'], t: '3×12' },
    { n: 'Dumbbell Fly', s: ['shoulders'], t: '3×12' },
    { n: 'Incline Dumbbell Fly', s: ['shoulders'], t: '3×12' },
    { n: 'Pec Deck', s: ['shoulders'], t: '3×15' }
  ],
  back: [
    { n: 'Deadlift', p: ['hamstrings', 'back'], s: ['glutes', 'quads'], t: '3×5' },
    { n: 'Rack Pull', p: ['back'], s: ['hamstrings', 'glutes'], t: '3×6' },
    { n: 'Barbell Row', s: ['biceps'], t: '4×6' },
    { n: 'Pendlay Row', s: ['biceps'], t: '4×5' },
    { n: 'T-Bar Row', s: ['biceps'], t: '3×10' },
    { n: 'Chest-supported Row', s: ['biceps'], t: '3×10' },
    { n: 'Seated Cable Row', s: ['biceps'], t: '3×10' },
    { n: 'Single-arm Dumbbell Row', s: ['biceps'], t: '3×10' },
    { n: 'Machine Row', s: ['biceps'], t: '3×12' },
    { n: 'Inverted Row', s: ['biceps'], t: '3×12' },
    { n: 'Pull-up', s: ['biceps'], t: '3×8' },
    { n: 'Weighted Pull-up', s: ['biceps'], t: '4×6' },
    { n: 'Chin-up', s: ['biceps'], t: '3×8' },
    { n: 'Neutral-grip Pull-up', s: ['biceps'], t: '3×8' },
    { n: 'Lat Pulldown', s: ['biceps'], t: '3×10' },
    { n: 'Wide-grip Lat Pulldown', s: ['biceps'], t: '3×12' },
    { n: 'Straight-arm Pulldown', t: '3×15' },
    { n: 'Dumbbell Pullover', s: ['chest'], t: '3×12' },
    { n: 'Barbell Shrug', t: '3×12' },
    { n: 'Dumbbell Shrug', t: '3×15' },
    { n: 'Farmer Carry', s: ['abs'], t: '3×40' }
  ],
  shoulders: [
    { n: 'Overhead Press', s: ['triceps'], t: '4×5' },
    { n: 'Seated Dumbbell Shoulder Press', s: ['triceps'], t: '3×10' },
    { n: 'Arnold Press', s: ['triceps'], t: '3×10' },
    { n: 'Push Press', s: ['triceps', 'quads'], t: '3×5' },
    { n: 'Machine Shoulder Press', s: ['triceps'], t: '3×12' },
    { n: 'Landmine Press', s: ['chest', 'triceps'], t: '3×10' },
    { n: 'Lateral Raise', t: '4×15' },
    { n: 'Cable Lateral Raise', t: '3×15' },
    { n: 'Front Raise', t: '3×15' },
    { n: 'Rear Delt Fly', s: ['back'], t: '3×15' },
    { n: 'Reverse Pec Deck', s: ['back'], t: '3×15' },
    { n: 'Face Pull', s: ['back'], t: '3×15' },
    { n: 'Upright Row', t: '3×12' }
  ],
  biceps: [
    { n: 'Barbell Curl', t: '3×10' },
    { n: 'EZ-Bar Curl', t: '3×10' },
    { n: 'Dumbbell Curl', t: '3×12' },
    { n: 'Hammer Curl', t: '3×12' },
    { n: 'Incline Dumbbell Curl', t: '3×12' },
    { n: 'Preacher Curl', t: '3×12' },
    { n: 'Cable Curl', t: '3×15' },
    { n: 'Concentration Curl', t: '3×12' },
    { n: 'Spider Curl', t: '3×12' },
    { n: 'Reverse Curl', t: '3×15' },
    { n: 'Zottman Curl', t: '3×12' }
  ],
  triceps: [
    { n: 'Close-grip Bench Press', s: ['chest', 'shoulders'], t: '3×8' },
    { n: 'Triceps Pushdown', t: '3×12' },
    { n: 'Rope Pushdown', t: '3×15' },
    { n: 'Overhead Extension', t: '3×12' },
    { n: 'Cable Overhead Extension', t: '3×15' },
    { n: 'Skull Crusher', t: '3×10' },
    { n: 'Dumbbell Kickback', t: '3×15' },
    { n: 'JM Press', s: ['chest'], t: '3×10' },
    { n: 'Bench Dip', s: ['chest'], t: '3×15' },
    { n: 'Diamond Push-up', s: ['chest'], t: '3×15' }
  ],
  quads: [
    { n: 'Squat', s: ['glutes', 'hamstrings'], t: '4×5' },
    { n: 'Front Squat', s: ['glutes', 'abs'], t: '3×8' },
    { n: 'Box Squat', s: ['glutes'], t: '3×5' },
    { n: 'Pause Squat', s: ['glutes'], t: '3×5' },
    { n: 'Goblet Squat', s: ['glutes'], t: '3×12' },
    { n: 'Smith Machine Squat', s: ['glutes'], t: '3×10' },
    { n: 'Hack Squat', s: ['glutes'], t: '3×10' },
    { n: 'Pendulum Squat', s: ['glutes'], t: '3×12' },
    { n: 'Belt Squat', s: ['glutes'], t: '3×12' },
    { n: 'Leg Press', s: ['glutes'], t: '3×10' },
    { n: 'Bulgarian Split Squat', s: ['glutes'], t: '3×10' },
    { n: 'Walking Lunge', p: ['quads', 'glutes'], t: '3×10' },
    { n: 'Reverse Lunge', p: ['quads', 'glutes'], t: '3×10' },
    { n: 'Step-up', s: ['glutes'], t: '3×12' },
    { n: 'Leg Extension', t: '3×15' },
    { n: 'Sissy Squat', t: '3×15' },
    { n: 'Sled Push', s: ['glutes', 'calves'], t: '4×30' }
  ],
  hamstrings: [
    { n: 'Romanian Deadlift', s: ['glutes', 'back'], t: '3×8' },
    { n: 'Stiff-leg Deadlift', s: ['glutes', 'back'], t: '3×8' },
    { n: 'Leg Curl', t: '3×12' },
    { n: 'Seated Leg Curl', t: '3×12' },
    { n: 'Nordic Curl', t: '3×8' },
    { n: 'Glute Ham Raise', s: ['glutes', 'back'], t: '3×10' },
    { n: 'Good Morning', p: ['hamstrings', 'back'], s: ['glutes'], t: '3×10' },
    { n: 'Back Extension', s: ['glutes', 'back'], t: '3×15' }
  ],
  glutes: [
    { n: 'Hip Thrust', s: ['hamstrings'], t: '3×10' },
    { n: 'Barbell Glute Bridge', s: ['hamstrings'], t: '3×12' },
    { n: 'Sumo Deadlift', p: ['glutes', 'hamstrings'], s: ['back', 'quads'], t: '3×5' },
    { n: 'Cable Pull-through', s: ['hamstrings'], t: '3×15' },
    { n: 'Cable Kickback', t: '3×15' },
    { n: 'Hip Abduction', t: '3×20' },
    { n: 'Reverse Hyper', s: ['hamstrings'], t: '3×15' },
    { n: 'Kettlebell Swing', p: ['glutes', 'hamstrings'], s: ['back'], t: '4×15' }
  ],
  calves: [
    { n: 'Standing Calf Raise', t: '4×12' },
    { n: 'Seated Calf Raise', t: '4×15' },
    { n: 'Leg Press Calf Raise', t: '4×15' },
    { n: 'Single-leg Calf Raise', t: '3×15' },
    { n: 'Donkey Calf Raise', t: '4×15' }
  ],
  abs: [
    { n: 'Plank (seconds)', t: '3×45' },
    { n: 'Side Plank (seconds)', t: '3×30' },
    { n: 'Hollow Hold (seconds)', t: '3×30' },
    { n: 'Hanging Leg Raise', t: '3×12' },
    { n: 'Hanging Knee Raise', t: '3×15' },
    { n: 'Toes-to-Bar', t: '3×10' },
    { n: 'Cable Crunch', t: '3×15' },
    { n: 'Crunch', t: '3×20' },
    { n: 'Machine Crunch', t: '3×15' },
    { n: 'Decline Sit-up', t: '3×15' },
    { n: 'Ab Wheel Rollout', t: '3×12' },
    { n: 'Russian Twist', t: '3×20' },
    { n: 'Dead Bug', t: '3×12' },
    { n: 'V-up', t: '3×15' },
    { n: 'Pallof Press', t: '3×12' },
    { n: 'Woodchop', t: '3×15' }
  ]
};

/* flat, lower-cased index — built once, read on every muscle lookup */
const LIB_INDEX = (() => {
  const m = new Map();
  Object.entries(LIB).forEach(([group, list]) =>
    list.forEach(e => m.set(e.n.toLowerCase(), { ...e, group })));
  return m;
})();
function libEntry(name) { return LIB_INDEX.get(String(name || '').trim().toLowerCase()) || null; }
function libAll() { return [...LIB_INDEX.values()]; }

/* the default prescription for a lift, wherever we can find one */
function defaultTargetFor(name) {
  const e = libEntry(name);
  if (e) return e.t;
  return findTargetFor(name) || '3×10';
}

/* ---------- the user's routine ----------
   `activeRoutine` is what the whole Train tab reads. It is the user's stored
   routine if they have one, otherwise the built-in their profile names. */
function activeRoutine() {
  const r = Store.get('routine', null);
  if (r && Array.isArray(r.days) && r.days.length) return r;
  const p = getProfile();
  return TEMPLATES[p?.template] || TEMPLATES.ppl6;
}
function isCustomRoutine() {
  const r = Store.get('routine', null);
  return !!(r && Array.isArray(r.days) && r.days.length);
}

/* Fork on write. Editing a built-in copies it first, so the originals stay
   intact as starting points and "reset to the standard split" always works. */
function editableRoutine() {
  const stored = Store.get('routine', null);
  if (stored && Array.isArray(stored.days) && stored.days.length) return stored;
  const p = getProfile();
  const key = p?.template || 'ppl6';
  const base = TEMPLATES[key] || TEMPLATES.ppl6;
  return {
    name: base.name,
    base: key,
    days: base.days.map(d => ({ name: d.name, ex: d.ex.map(e => [e[0], e[1]]) }))
  };
}
function saveRoutine(r) {
  r.days = r.days.filter(d => d && Array.isArray(d.ex));
  Store.set('routine', r);
}
function resetRoutine() { Store.remove('routine'); }

/* ---------- routine editing ---------- */
function routineAddExercise(dayIdx, name, target) {
  const r = editableRoutine();
  const day = r.days[dayIdx];
  if (!day) return false;
  if (day.ex.some(e => e[0].toLowerCase() === name.toLowerCase())) return false;
  day.ex.push([name, target || defaultTargetFor(name)]);
  saveRoutine(r);
  return true;
}
function routineRemoveExercise(dayIdx, exIdx) {
  const r = editableRoutine();
  const removed = r.days[dayIdx]?.ex.splice(exIdx, 1)[0];
  saveRoutine(r);
  return removed;
}
function routineMoveExercise(dayIdx, exIdx, dir) {
  const r = editableRoutine();
  const ex = r.days[dayIdx]?.ex;
  const to = exIdx + dir;
  if (!ex || to < 0 || to >= ex.length) return;
  [ex[exIdx], ex[to]] = [ex[to], ex[exIdx]];
  saveRoutine(r);
}
function routineSetTarget(dayIdx, exIdx, target) {
  const r = editableRoutine();
  if (r.days[dayIdx]?.ex[exIdx]) { r.days[dayIdx].ex[exIdx][1] = target; saveRoutine(r); }
}
function routineSwapExercise(dayIdx, exIdx, name) {
  const r = editableRoutine();
  const row = r.days[dayIdx]?.ex[exIdx];
  if (!row) return;
  row[0] = name;
  row[1] = defaultTargetFor(name);
  saveRoutine(r);
}
function routineAddDay(name) {
  const r = editableRoutine();
  r.days.push({ name: name || `Day ${r.days.length + 1}`, ex: [] });
  saveRoutine(r);
}
function routineRemoveDay(dayIdx) {
  const r = editableRoutine();
  if (r.days.length <= 1) { toast('A routine needs at least one day'); return false; }
  r.days.splice(dayIdx, 1);
  saveRoutine(r);
  return true;
}
function routineRenameDay(dayIdx, name) {
  const r = editableRoutine();
  if (r.days[dayIdx] && name.trim()) { r.days[dayIdx].name = name.trim(); saveRoutine(r); }
}

/* ---------- the routine editor screen ---------- */
function renderRoutineEditor() {
  const r = activeRoutine();
  const custom = isCustomRoutine();
  const open = App.routineDay;
  return `
  <div class="sub-head">
    <button class="back-btn" data-action="train-back" aria-label="Back to training">‹</button>
    <div class="grow">
      <div class="sub-title">Your routine</div>
      <div class="muted small">${esc(r.name)}${custom ? ' · customised' : ' · standard split'}</div>
    </div>
  </div>

  ${custom ? '' : `<div class="alert" style="border-left-color:var(--blue)"><span class="a-ico">✎</span>
    <div class="a-body"><b>This is one of Peak's standard splits.</b>
    Change anything below — add a lift, drop one, change the sets — and it becomes yours.
    The standard version stays available to reset back to.</div></div>`}

  ${r.days.map((d, i) => {
    const sets = d.ex.reduce((n, [, t]) => n + (parseTarget(t)?.sets || 3), 0);
    const isOpen = open === i;
    return `
    <div class="card">
      <button class="day-head" data-action="routine-open-day" data-idx="${i}" aria-expanded="${isOpen}">
        <span class="dh-name">${esc(d.name)}</span>
        <span class="dh-meta">${d.ex.length} lifts · ${sets} sets</span>
        <span class="nr-chev" style="transform:rotate(${isOpen ? '90' : '0'}deg)">›</span>
      </button>
      ${isOpen ? `
        ${d.ex.length ? d.ex.map(([n, t], j) => `
          <div class="re-row">
            <span class="re-name">${esc(n)}</span>
            <button class="re-target" data-action="routine-target" data-day="${i}" data-ex="${j}"
              aria-label="Change sets and reps for ${esc(n)}">${esc(t)}</button>
            <button class="re-btn" data-action="routine-move" data-day="${i}" data-ex="${j}" data-dir="-1"
              ${j === 0 ? 'disabled' : ''} aria-label="Move ${esc(n)} up">↑</button>
            <button class="re-btn" data-action="routine-move" data-day="${i}" data-ex="${j}" data-dir="1"
              ${j === d.ex.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(n)} down">↓</button>
            <button class="x-btn" data-action="routine-del-ex" data-day="${i}" data-ex="${j}"
              aria-label="Remove ${esc(n)}">✕</button>
          </div>`).join('')
        : '<div class="muted small" style="padding:8px 0">No lifts yet — add one below.</div>'}
        <div class="row mt">
          <button class="btn small grow" data-action="routine-add-ex" data-day="${i}">＋ Add exercise</button>
          <button class="btn small" data-action="routine-rename" data-day="${i}">Rename</button>
          <button class="btn small ghost danger" data-action="routine-del-day" data-day="${i}">Delete day</button>
        </div>` : ''}
    </div>`;
  }).join('')}

  <button class="btn mt" data-action="routine-add-day">＋ Add a day</button>
  <details class="adv">
    <summary>Start from a different split</summary>
    <div class="chart-note">Replaces every day below. Your logged history is never touched.</div>
    ${Object.entries(TEMPLATES).map(([k, v]) => `
      <button class="btn small mt" style="width:100%;justify-content:flex-start"
        data-action="routine-use-template" data-key="${k}">${esc(v.name)}
        <span class="muted">· ${v.days.length} days</span></button>`).join('')}
    ${custom ? `<button class="btn ghost danger mt" data-action="routine-reset">Discard my changes and use the standard split</button>` : ''}
  </details>`;
}

/* ---------- exercise picker ----------
   Search plus muscle filter over the library, your own history, and anything
   you've typed before — because the library will never contain every gym's
   machine names, and a picker that can't find your lift is worse than a text
   box. */
function pickerCandidates() {
  const seen = new Map();
  libAll().forEach(e => seen.set(e.n.toLowerCase(), { n: e.n, group: e.group, lib: true }));
  // anything you've actually logged outranks the library — it is proof of use
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => {
    const k = ex.name.toLowerCase();
    if (!seen.has(k)) seen.set(k, { n: ex.name, group: musclesFor(ex.name).p[0] || 'other', lib: false });
    seen.get(k).logged = true;
  }));
  return [...seen.values()];
}

function openExercisePicker(onPickAction, ctx) {
  App.picker = { action: onPickAction, ctx: ctx || {}, q: '', group: 'all' };
  renderPickerModal();
}
function renderPickerModal() {
  const { q, group } = App.picker;
  const groups = ['all', ...MUSCLES];
  let list = pickerCandidates();
  if (group !== 'all') list = list.filter(e => e.group === group);
  const needle = q.trim().toLowerCase();
  if (needle) list = list.filter(e => e.n.toLowerCase().includes(needle));
  list.sort((a, b) => {
    if (needle) {   // prefix matches first — you are usually typing the start
      const ap = a.n.toLowerCase().startsWith(needle), bp = b.n.toLowerCase().startsWith(needle);
      if (ap !== bp) return ap ? -1 : 1;
    }
    if (!!b.logged !== !!a.logged) return b.logged ? 1 : -1;
    return a.n.localeCompare(b.n);
  });
  const shown = list.slice(0, 60);

  openModal(`
    <h3>Add an exercise</h3>
    <div class="modal-sub">${list.length} match${list.length === 1 ? '' : 'es'}. Lifts you've logged before are listed first.</div>
    <input id="pk-q" placeholder="Search…" value="${esc(q)}" autocomplete="off" enterkeyhint="done">
    <div class="pk-groups">
      ${groups.map(g => `<button class="pk-g ${g === group ? 'on' : ''}" data-action="pk-group" data-g="${g}">${
        g === 'all' ? 'All' : MUSCLE_LABEL[g]}</button>`).join('')}
    </div>
    <div class="pk-list">
      ${shown.length ? shown.map(e => `
        <button class="pk-item" data-action="pk-choose" data-name="${esc(e.n)}">
          <span class="pk-n">${esc(e.n)}</span>
          <span class="pk-m">${e.logged ? '<span class="pk-tag">logged</span> ' : ''}${
            e.group && MUSCLE_LABEL[e.group] ? esc(MUSCLE_LABEL[e.group]) : ''}</span>
        </button>`).join('')
      : `<div class="muted small" style="padding:10px 0">Nothing matches "${esc(q)}".</div>`}
      ${list.length > shown.length ? `<div class="chart-note center">${list.length - shown.length} more — keep typing to narrow it.</div>` : ''}
    </div>
    ${needle && !shown.some(e => e.n.toLowerCase() === needle) ? `
      <button class="btn primary mt" data-action="pk-choose" data-name="${esc(q.trim())}">
        ＋ Use "${esc(q.trim())}"</button>
      <div class="chart-note">Anything Peak doesn't recognise can be tagged to a muscle after you log it, so it still counts toward your weekly volume.</div>` : ''}
  `);
  const input = document.getElementById('pk-q');
  if (input) {
    input.addEventListener('input', ev => {
      App.picker.q = ev.target.value;
      const pos = ev.target.selectionStart;
      renderPickerModal();
      const again = document.getElementById('pk-q');
      if (again) { again.focus(); again.setSelectionRange(pos, pos); }
    });
  }
}
function pickerChoose(name) {
  const { action, ctx } = App.picker || {};
  closeModal();
  if (action === 'routine') {
    if (routineAddExercise(ctx.day, name)) toast(`${name} added to ${activeRoutine().days[ctx.day].name}`);
    else toast('Already in that day');
  } else if (action === 'session') {
    const target = defaultTargetFor(name);
    App.activeSession.exercises.push({ name, target, sets: plannedSetsFor(name, target) });
    persistSession();
  }
  App.picker = null;
  App.render();
}

/* ---------- the coach ----------
   Everything here is derived from logged sessions — no new tracking, no
   settings, nothing to opt into. The rule for a suggestion earning space: it
   has to be specific about what it saw, and fixable in one tap. "Consider more
   volume" is not a suggestion, it is a horoscope. */

const COACH_MIN_SESSIONS = 3;   // never infer a habit from fewer than this

function coachDismissed() { return Store.get('coachDismissed', {}); }
function dismissCoach(key) {
  const d = coachDismissed();
  d[key] = todayKey();
  Store.set('coachDismissed', d);
}

/* sessions logged against a given routine day, newest first */
function sessionsForDay(dayName, limit) {
  return getWorkouts()
    .filter(s => !s.cardio && s.dayName === dayName)
    .sort((a, b) => a.date < b.date ? 1 : -1)
    .slice(0, limit || 5);
}

function coachSuggestions() {
  const out = [];
  const dismissed = coachDismissed();
  const r = activeRoutine();

  r.days.forEach((day, dayIdx) => {
    const recent = sessionsForDay(day.name, 5);
    if (recent.length < COACH_MIN_SESSIONS) return;
    const planned = new Set(day.ex.map(e => e[0].toLowerCase()));

    /* 1. a lift you keep adding yourself belongs in the routine */
    const extras = {};
    recent.forEach(s => (s.exercises || []).forEach(ex => {
      if (planned.has(ex.name.toLowerCase())) return;
      extras[ex.name] = (extras[ex.name] || 0) + 1;
    }));
    Object.entries(extras).forEach(([name, n]) => {
      if (n < COACH_MIN_SESSIONS) return;
      out.push({
        key: `add:${day.name}:${name}`, tone: 'good', ico: '＋', rank: 1,
        title: `Add ${name} to ${day.name}?`,
        body: `You've added it yourself in ${n} of your last ${recent.length} ${day.name} sessions. Peak can put it in the routine so it's pre-filled next time.`,
        label: 'Add it', action: 'coach-add-ex', data: { day: dayIdx, name }
      });
    });

    /* 2. a planned lift you never actually do is costing you a scroll.
       One at a time: a day you consistently cut short produces a suggestion per
       missing lift, and five cards saying the same thing is nagging, not help. */
    const skipped = day.ex
      .map(([name], exIdx) => ({ name, exIdx }))
      .filter(({ name }) => !recent.some(s =>
        (s.exercises || []).some(ex => ex.name.toLowerCase() === name.toLowerCase())));
    if (skipped.length && skipped.length < day.ex.length) {
      const { name, exIdx } = skipped[0];
      out.push({
        key: `drop:${day.name}:${name}`, tone: 'warn', ico: '−', rank: 3,
        title: `Drop ${name} from ${day.name}?`,
        body: `It's been in the plan for your last ${recent.length} ${day.name} sessions and you haven't logged a single set of it.${
          skipped.length > 1 ? ` (${skipped.length - 1} other lift${skipped.length > 2 ? 's are' : ' is'} in the same position — deal with them one at a time.)` : ''
        } Removing it shortens the session; your history stays.`,
        label: 'Remove it', action: 'coach-drop-ex', data: { day: dayIdx, ex: exIdx, name }
      });
    }

    /* 3. the prescription disagrees with what you consistently do */
    day.ex.forEach(([name, tstr], exIdx) => {
      const tgt = parseTarget(tstr);
      if (!tgt) return;
      const counts = recent.map(s => {
        const ex = (s.exercises || []).find(e => e.name.toLowerCase() === name.toLowerCase());
        return ex ? workingSets(ex.sets).filter(st => st.reps > 0).length : null;
      }).filter(n => n != null);
      if (counts.length < COACH_MIN_SESSIONS) return;
      if (!counts.every(n => n === counts[0]) || counts[0] === tgt.sets || counts[0] < 1) return;
      out.push({
        key: `sets:${day.name}:${name}:${counts[0]}`, tone: '', ico: '≠', rank: 2,
        title: `${name}: plan says ${tgt.sets} sets, you do ${counts[0]}`,
        body: `Every one of your last ${counts.length} ${day.name} sessions logged exactly ${counts[0]} working sets. Matching the plan to that makes the pre-fill right and your "sets left" count honest.`,
        label: `Make it ${counts[0]}×${tgt.reps}`, action: 'coach-set-target',
        data: { day: dayIdx, ex: exIdx, target: `${counts[0]}×${tgt.reps}` }
      });
    });
  });

  /* 4. a muscle the ROUTINE cannot reach its effective minimum for.
     This deliberately measures the plan, not the log. Judging it on logged sets
     flags every muscle whose day happens to fall outside the trailing week — on
     a 3-day split that is most of them, every week, which is noise. A routine
     that programs enough and still comes up short is an adherence problem, and
     the plateau and consistency surfaces already own that. */
  if (getWorkouts().filter(s => !s.cardio).length >= 6) {
    const planned = routineWeeklyMuscleSets();
    const inRoutine = new Set(r.days.flatMap(d => d.ex.map(e => e[0].toLowerCase())));
    MUSCLES.forEach(m => {
      const [mev] = MUSCLE_LANDMARKS[m];
      /* MEV is a soft landmark, not a threshold — flagging 7 sets against a
         "minimum" of 8 is pedantry, and four near-misses at once reads as the
         app disapproving of your routine. Only a real shortfall earns a card. */
      if (planned[m] >= mev * 0.8) return;
      // put it in the day that already trains this muscle most
      let bestDay = -1, bestScore = 0;
      r.days.forEach((day, i) => {
        const score = day.ex.filter(([n]) => musclesFor(n).p.includes(m)).length;
        if (score > bestScore) { bestScore = score; bestDay = i; }
      });
      if (bestDay < 0) return;   // nothing in the routine trains it — too big a call to make for someone
      const pick = (LIB[m] || []).find(e => !inRoutine.has(e.n.toLowerCase()));
      if (!pick) return;
      out.push({
        key: `vol:${m}:${pick.n}`, tone: 'warn', ico: '💪', rank: 4,
        title: `Your routine under-trains ${MUSCLE_LABEL[m].toLowerCase()}`,
        body: `As written it programs about ${Math.round(planned[m] * 2) / 2} ${MUSCLE_LABEL[m].toLowerCase()} sets a week, against an effective minimum of ${mev}. Adding ${pick.n} to ${r.days[bestDay].name} closes most of that gap.`,
        label: `Add ${pick.n}`, action: 'coach-add-ex', data: { day: bestDay, name: pick.n }
      });
    });
  }

  /* Most useful first: things you already do, then things you don't. A drop or a
     volume gap can wait; a lift you add by hand every week costs you taps now. */
  return out
    .filter(s => !dismissed[s.key])
    .sort((a, b) => (a.rank || 9) - (b.rank || 9));
}

/* What the routine programs per muscle per week, independent of whether you
   turned up. gymDays sets how many times the rotation actually comes round. */
function routineWeeklyMuscleSets() {
  const r = activeRoutine();
  const p = getProfile();
  const perWeek = (p?.gymDays || r.days.length) / Math.max(1, r.days.length);
  const sets = {};
  MUSCLES.forEach(m => { sets[m] = 0; });
  r.days.forEach(d => d.ex.forEach(([n, t]) => {
    const k = parseTarget(t)?.sets || 3;
    const m = musclesFor(n);
    m.p.forEach(x => { if (sets[x] != null) sets[x] += k; });
    m.s.forEach(x => { if (sets[x] != null) sets[x] += k * 0.5; });
  }));
  MUSCLES.forEach(m => { sets[m] = sets[m] * perWeek; });
  return sets;
}

/* The Train home card. Capped at two, because a wall of advice is the same as
   no advice — and every one of them is one tap from being gone for good. */
function renderCoachCard() {
  const all = coachSuggestions();
  if (!all.length) return '';
  const show = all.slice(0, 2);
  return `
  <div class="card">
    <h2>Peak noticed <span class="h2-right">${all.length > 2 ? `${all.length} suggestions` : 'from your logged sessions'}</span></h2>
    ${show.map(s => `
      <div class="coach ${s.tone}">
        <span class="a-ico">${s.ico}</span>
        <div class="a-body">
          <b>${esc(s.title)}</b>
          ${esc(s.body)}
          <div class="row" style="margin-top:8px;gap:8px">
            <button class="btn small primary" data-action="${s.action}" data-key="${esc(s.key)}"
              data-d='${esc(JSON.stringify(s.data))}'>${esc(s.label)}</button>
            <button class="btn small ghost" data-action="coach-dismiss" data-key="${esc(s.key)}">No thanks</button>
          </div>
        </div>
      </div>`).join('')}
    ${all.length > 2 ? `<div class="chart-note">${all.length - 2} more will appear as you clear these.</div>` : ''}
  </div>`;
}

/* one handler for every suggestion that edits the routine */
function applyCoach(action, key, data) {
  const d = JSON.parse(data || '{}');
  if (action === 'coach-add-ex') {
    routineAddExercise(d.day, d.name);
    toast(`${d.name} added to ${activeRoutine().days[d.day].name}`);
  } else if (action === 'coach-drop-ex') {
    routineRemoveExercise(d.day, d.ex);
    toast(`${d.name} removed`);
  } else if (action === 'coach-set-target') {
    routineSetTarget(d.day, d.ex, d.target);
    toast(`Target updated to ${d.target}`);
  }
  dismissCoach(key);
  App.render();
}
