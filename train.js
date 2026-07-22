/* Forge — Train tab: routines, set logging, PRs, plateau detection */

const TEMPLATES = {
  fb3: {
    name: 'Full Body ×3', days: [
      { name: 'Full Body A', ex: [['Squat', '3×5'], ['Bench Press', '3×5'], ['Barbell Row', '3×8'], ['Overhead Press', '2×10'], ['Plank', '3×45s']] },
      { name: 'Full Body B', ex: [['Deadlift', '3×5'], ['Overhead Press', '3×5'], ['Lat Pulldown', '3×10'], ['Walking Lunge', '3×10'], ['Hanging Leg Raise', '3×10']] },
      { name: 'Full Body C', ex: [['Front Squat', '3×8'], ['Incline DB Press', '3×10'], ['Seated Cable Row', '3×10'], ['Romanian Deadlift', '3×8'], ['Dumbbell Curl', '3×12']] }
    ]
  },
  ul4: {
    name: 'Upper / Lower ×4', days: [
      { name: 'Upper A', ex: [['Bench Press', '4×5'], ['Barbell Row', '4×6'], ['Overhead Press', '3×8'], ['Lat Pulldown', '3×10'], ['Dumbbell Curl', '3×12'], ['Triceps Pushdown', '3×12']] },
      { name: 'Lower A', ex: [['Squat', '4×5'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '4×12']] },
      { name: 'Upper B', ex: [['Overhead Press', '4×5'], ['Weighted Pull-up', '4×6'], ['Incline DB Press', '3×10'], ['Seated Cable Row', '3×10'], ['Lateral Raise', '3×15'], ['Hammer Curl', '3×12']] },
      { name: 'Lower B', ex: [['Deadlift', '3×5'], ['Front Squat', '3×8'], ['Walking Lunge', '3×10'], ['Leg Extension', '3×12'], ['Seated Calf Raise', '4×15']] }
    ]
  },
  ppl5: {
    name: 'PPL + Upper/Lower ×5', days: [
      { name: 'Push', ex: [['Bench Press', '4×6'], ['Overhead Press', '3×8'], ['Incline DB Press', '3×10'], ['Lateral Raise', '4×15'], ['Triceps Pushdown', '3×12'], ['Overhead Extension', '3×12']] },
      { name: 'Pull', ex: [['Deadlift', '3×5'], ['Weighted Pull-up', '4×6'], ['Barbell Row', '3×8'], ['Face Pull', '3×15'], ['Dumbbell Curl', '3×12'], ['Hammer Curl', '3×12']] },
      { name: 'Legs', ex: [['Squat', '4×6'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '5×12']] },
      { name: 'Upper', ex: [['Overhead Press', '4×6'], ['Lat Pulldown', '3×10'], ['Incline DB Press', '3×10'], ['Seated Cable Row', '3×10'], ['Lateral Raise', '3×15'], ['Dumbbell Curl', '3×12']] },
      { name: 'Lower', ex: [['Front Squat', '4×6'], ['Hip Thrust', '3×10'], ['Walking Lunge', '3×10'], ['Leg Extension', '3×15'], ['Seated Calf Raise', '4×15']] }
    ]
  },
  ppl6: {
    name: 'Push/Pull/Legs ×6', days: [
      { name: 'Push A', ex: [['Bench Press', '4×5'], ['Overhead Press', '3×8'], ['Incline DB Press', '3×10'], ['Lateral Raise', '4×15'], ['Triceps Pushdown', '3×12']] },
      { name: 'Pull A', ex: [['Deadlift', '3×5'], ['Weighted Pull-up', '4×6'], ['Seated Cable Row', '3×10'], ['Face Pull', '3×15'], ['Dumbbell Curl', '3×12']] },
      { name: 'Legs A', ex: [['Squat', '4×5'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '5×12']] },
      { name: 'Push B', ex: [['Overhead Press', '4×5'], ['Incline Bench Press', '3×8'], ['Dip', '3×10'], ['Lateral Raise', '4×15'], ['Overhead Extension', '3×12']] },
      { name: 'Pull B', ex: [['Barbell Row', '4×6'], ['Lat Pulldown', '3×10'], ['Chest-supported Row', '3×10'], ['Rear Delt Fly', '3×15'], ['Hammer Curl', '3×12']] },
      { name: 'Legs B', ex: [['Front Squat', '4×6'], ['Hip Thrust', '3×10'], ['Walking Lunge', '3×10'], ['Leg Extension', '3×15'], ['Seated Calf Raise', '4×15']] }
    ]
  }
};
const TEMPLATE_FOR_DAYS = { 2: 'fb3', 3: 'fb3', 4: 'ul4', 5: 'ppl5', 6: 'ppl6', 7: 'ppl6' };

/* est. 1RM (Epley), capped at 12 reps for sanity */
function e1rm(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + Math.min(reps, 12) / 30);
}

/* Per-exercise history: [{date, bestE1rm, topSet}] oldest→newest */
function exerciseHistory(name) {
  const out = [];
  getWorkouts().forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (ex.name.toLowerCase() !== name.toLowerCase()) return;
      let best = 0, top = null;
      (ex.sets || []).forEach(st => {
        const v = e1rm(st.weight, st.reps);
        if (v > best) { best = v; top = st; }
      });
      if (best > 0) out.push({ date: s.date, bestE1rm: best, topSet: top });
    });
  });
  out.sort((a, b) => a.date < b.date ? -1 : 1);
  return out;
}

/* PR indexes within a history array */
function prIndexes(hist) {
  const idx = [];
  let best = 0;
  hist.forEach((h, i) => { if (h.bestE1rm > best + 0.01) { best = h.bestE1rm; if (i > 0) idx.push(i); } });
  return idx;
}

const PLATEAU_TIPS = [
  'Drop the weight ~10% for a week (deload), then build back up.',
  'Switch rep range: if you\'ve been doing 5s, run 8–10s for 3 weeks (or vice versa).',
  'Add one extra set per week for this lift.',
  'Check the basics: your sleep score and protein streak feed this lift more than any technique tweak.',
  'Swap in a close variation for 4 weeks (e.g. pause reps, incline, front squat).'
];

/* An exercise is plateaued when its best est. 1RM was first reached ≥3 sessions
   and ≥21 days ago and hasn't been beaten since (min 4 sessions logged). */
function detectPlateaus() {
  const names = new Set();
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => names.add(ex.name)));
  const flags = [];
  names.forEach(name => {
    const hist = exerciseHistory(name);
    if (hist.length < 4) return;
    const max = Math.max(...hist.map(h => h.bestE1rm));
    const firstBestIdx = hist.findIndex(h => h.bestE1rm >= max - 0.01);
    const sessionsSince = hist.length - 1 - firstBestIdx;
    const daysSince = daysBetween(hist[firstBestIdx].date, hist[hist.length - 1].date);
    if (sessionsSince >= 3 && daysSince >= 21) {
      flags.push({ name, sessions: sessionsSince, days: daysSince, tip: PLATEAU_TIPS[Math.abs(hashCode(name)) % PLATEAU_TIPS.length] });
    }
  });
  return flags;
}
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

/* which template day is next */
function nextDayIndex() {
  const p = getProfile();
  const tpl = TEMPLATES[p.template];
  const count = getWorkouts().filter(s => s.template === p.template && !s.freestyle).length;
  return count % tpl.days.length;
}

/* ---------- render ---------- */
function renderTrain() {
  if (App.activeSession) return renderActiveSession();
  const p = getProfile();
  const tpl = TEMPLATES[p.template];
  const nextIdx = nextDayIndex();
  const plateaus = detectPlateaus();
  const recent = getWorkouts().slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 6);
  const week = getWorkouts().filter(s => daysBetween(s.date, todayKey()) < 7).length;

  return `
  ${plateaus.map(pl => `
    <div class="alert">
      <span class="a-ico">⚠</span>
      <div class="a-body"><b>${esc(pl.name)} has stalled — no PR in ${pl.sessions} sessions (${pl.days} days)</b>
      ${esc(pl.tip)}</div>
    </div>`).join('')}

  <div class="card">
    <h2>Next up <span class="h2-right">${esc(tpl.name)} · ${week}/${p.gymDays} sessions this week</span></h2>
    <div class="spread">
      <div>
        <div class="hero-num" style="font-size:24px">${esc(tpl.days[nextIdx].name)}</div>
        <div class="muted small">${tpl.days[nextIdx].ex.map(e => esc(e[0])).join(' · ')}</div>
      </div>
    </div>
    <button class="btn accent mt" data-action="start-workout" data-idx="${nextIdx}">Start workout</button>
    <div class="row mt">
      <select id="day-picker" class="grow">
        ${tpl.days.map((d, i) => `<option value="${i}" ${i === nextIdx ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
      </select>
      <button class="btn small" data-action="start-picked">Start</button>
      <button class="btn small" data-action="start-freestyle">Freestyle</button>
    </div>
  </div>

  ${renderLiftTrends()}

  <div class="card">
    <h2>Recent sessions</h2>
    ${recent.length === 0 ? '<div class="muted center" style="padding:10px 0">No sessions yet. Time to put in work.</div>' :
      recent.map(s => {
        const sets = (s.exercises || []).reduce((n, e) => n + (e.sets || []).length, 0);
        const vol = (s.exercises || []).reduce((v, e) => v + (e.sets || []).reduce((x, st) => x + (st.weight || 0) * (st.reps || 0), 0), 0);
        return `
        <div class="list-item">
          <div class="li-main">
            <div class="li-title">${esc(s.dayName)}</div>
            <div class="li-sub">${prettyDate(s.date)} · ${sets} sets · ${Math.round(kgToLb(vol)).toLocaleString()} lb volume</div>
          </div>
          <button class="btn small" data-action="view-workout" data-id="${s.id}">View</button>
        </div>`;
      }).join('')}
  </div>`;
}

function renderLiftTrends() {
  const names = new Set();
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => names.add(ex.name)));
  const trends = [...names].map(n => ({ name: n, hist: exerciseHistory(n) }))
    .filter(t => t.hist.length >= 2)
    .sort((a, b) => b.hist.length - a.hist.length)
    .slice(0, 5);
  if (!trends.length) return '';
  return `
  <div class="card">
    <h2>Lift trends <span class="h2-right">est. 1RM, lb · <span style="color:${CHART.good}">●</span> PR</span></h2>
    ${trends.map(t => `
      <div class="list-item">
        <div class="li-main"><div class="li-title">${esc(t.name)}</div>
        <div class="li-sub">${t.hist.length} sessions</div></div>
        ${sparkline(t.hist.map(h => kgToLb(h.bestE1rm)), { markers: prIndexes(t.hist), color: CHART.blue })}
      </div>`).join('')}
  </div>`;
}

/* ---------- active session ---------- */
function startWorkout(dayIdx, freestyle = false) {
  const p = getProfile();
  const tpl = TEMPLATES[p.template];
  const day = freestyle ? null : tpl.days[dayIdx];
  App.activeSession = {
    id: 'w' + Date.now(),
    date: todayKey(),
    template: p.template,
    dayName: freestyle ? 'Freestyle' : day.name,
    freestyle,
    exercises: freestyle ? [] : day.ex.map(([name, target]) => ({ name, target, sets: [] }))
  };
  App.render();
}

function renderActiveSession() {
  const s = App.activeSession;
  return `
  <div class="card">
    <div class="spread">
      <h2 class="mb0">${esc(s.dayName)} — in progress</h2>
      <span class="muted small">${prettyDate(s.date)}</span>
    </div>
  </div>
  ${s.exercises.map((ex, xi) => renderExerciseBlock(ex, xi)).join('')}
  <button class="btn mt" data-action="add-exercise">＋ Add exercise</button>
  <button class="btn primary mt" data-action="finish-workout">✓ Finish workout</button>
  <button class="btn ghost danger mt" data-action="discard-workout">Discard</button>`;
}

function renderExerciseBlock(ex, xi) {
  const hist = exerciseHistory(ex.name);
  const last = hist.length ? hist[hist.length - 1] : null;
  const lastTxt = last
    ? `Last time: ${Math.round(kgToLb(last.topSet.weight))} lb × ${last.topSet.reps} (${prettyDate(last.date)}) — beat it.`
    : 'First time logging this — set the baseline.';
  return `
  <div class="card">
    <div class="ex-head">
      <span class="ex-name">${esc(ex.name)}</span>
      <span class="ex-target">${ex.target ? 'target ' + esc(ex.target) : ''}</span>
    </div>
    <div class="last-time">${lastTxt}</div>
    ${ex.sets.map((st, si) => `
      <div class="set-row">
        <span class="set-no">${si + 1}</span>
        <input type="number" inputmode="decimal" placeholder="lb" value="${st.weight != null ? Math.round(kgToLb(st.weight) * 10) / 10 : ''}"
          data-set-w data-xi="${xi}" data-si="${si}">
        <input type="number" inputmode="numeric" placeholder="reps" value="${st.reps ?? ''}"
          data-set-r data-xi="${xi}" data-si="${si}">
        <button class="x-btn" data-action="del-set" data-xi="${xi}" data-si="${si}">✕</button>
      </div>`).join('')}
    <button class="btn small mt" data-action="add-set" data-xi="${xi}">＋ Add set</button>
  </div>`;
}

function addSet(xi) {
  const ex = App.activeSession.exercises[xi];
  const prev = ex.sets[ex.sets.length - 1];
  if (prev) { ex.sets.push({ weight: prev.weight, reps: prev.reps }); }
  else {
    const hist = exerciseHistory(ex.name);
    const last = hist.length ? hist[hist.length - 1].topSet : null;
    ex.sets.push({ weight: last ? last.weight : null, reps: last ? last.reps : null });
  }
  App.render();
}

function readSetInputs() {
  document.querySelectorAll('[data-set-w]').forEach(inp => {
    const st = App.activeSession.exercises[inp.dataset.xi]?.sets[inp.dataset.si];
    if (st) st.weight = inp.value === '' ? null : lbToKg(Number(inp.value));
  });
  document.querySelectorAll('[data-set-r]').forEach(inp => {
    const st = App.activeSession.exercises[inp.dataset.xi]?.sets[inp.dataset.si];
    if (st) st.reps = inp.value === '' ? null : Number(inp.value);
  });
}

function finishWorkout() {
  readSetInputs();
  const s = App.activeSession;
  s.exercises = s.exercises
    .map(ex => ({ ...ex, sets: ex.sets.filter(st => st.weight > 0 && st.reps > 0) }))
    .filter(ex => ex.sets.length > 0);
  if (!s.exercises.length) { toast('No completed sets — add weight & reps or discard'); return; }
  // PR check
  const prs = [];
  s.exercises.forEach(ex => {
    const prevBest = Math.max(0, ...exerciseHistory(ex.name).map(h => h.bestE1rm));
    const nowBest = Math.max(...ex.sets.map(st => e1rm(st.weight, st.reps)));
    if (nowBest > prevBest + 0.01 && prevBest > 0) prs.push(ex.name);
  });
  saveWorkout(s);
  App.activeSession = null;
  toast(prs.length ? `🎉 PR on ${prs.join(', ')}!` : 'Workout saved 💪');
  App.render();
}

function openAddExercise() {
  const names = new Set();
  Object.values(TEMPLATES).forEach(t => t.days.forEach(d => d.ex.forEach(e => names.add(e[0]))));
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => names.add(ex.name)));
  openModal(`
    <h3>Add exercise</h3>
    <label>Exercise name</label>
    <input id="ax-name" list="ax-list" placeholder="e.g. Cable Fly">
    <datalist id="ax-list">${[...names].sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <button class="btn primary mt" data-action="confirm-add-exercise">Add</button>
  `);
  setTimeout(() => document.getElementById('ax-name')?.focus(), 50);
}

function viewWorkoutModal(id) {
  const s = getWorkouts().find(w => w.id === id);
  if (!s) return;
  openModal(`
    <h3>${esc(s.dayName)}</h3>
    <div class="modal-sub">${prettyDate(s.date)}</div>
    ${(s.exercises || []).map(ex => `
      <div class="exercise-block">
        <div class="ex-head"><span class="ex-name">${esc(ex.name)}</span></div>
        ${(ex.sets || []).map((st, i) => `<div class="muted small">Set ${i + 1}: ${Math.round(kgToLb(st.weight))} lb × ${st.reps}</div>`).join('')}
      </div>`).join('')}
    <button class="btn ghost danger mt" data-action="delete-workout" data-id="${s.id}">Delete session</button>
  `);
}
