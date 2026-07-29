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
  if (!weight || weight < 0 || !reps) return 0;
  return weight * (1 + Math.min(reps, 12) / 30);
}

/* Session score 0-100: intensity vs your bests (50) + sets vs plan (35) + PR/completion bonus (15).
   Call BEFORE saveWorkout so history excludes the session being scored. */
function scoreWorkout(s) {
  let intensitySum = 0, n = 0, prs = 0;
  s.exercises.forEach(ex => {
    const nowBest = Math.max(0, ...ex.sets.map(st => e1rm(st.weight, st.reps)));
    if (nowBest <= 0) return; // bodyweight-only work carries no intensity signal
    const prevBest = Math.max(0, ...exerciseHistory(ex.name).map(h => h.bestE1rm));
    if (prevBest > 0) {
      intensitySum += Math.min(nowBest / prevBest, 1.1);
      if (nowBest > prevBest + 0.01) prs++;
    } else intensitySum += 1; // first time on a lift: full credit
    n++;
  });
  const intensity = n ? intensitySum / n : 0.9;
  const intensityPts = Math.max(0, Math.min(1, (intensity - 0.5) / 0.5)) * 50;
  const setsDone = s.exercises.reduce((x, e) => x + e.sets.length, 0);
  const setsPlanned = s.exercises.reduce((x, e) => {
    const m = /^(\d+)/.exec(e.target || '');
    return x + (m ? Number(m[1]) : 3);
  }, 0);
  const volumePts = Math.min(setsDone / Math.max(setsPlanned, 1), 1) * 35;
  const bonus = Math.min(prs * 10, 10) + (setsDone >= setsPlanned ? 5 : 0);
  return Math.round(Math.min(100, intensityPts + volumePts + bonus));
}

/* cardio */
const CARDIO_TYPES = ['Run', 'Incline walk', 'Bike', 'Row', 'Stairmaster', 'Swim', 'Jump rope', 'Sports / other'];
const CARDIO_MET = { easy: 5, moderate: 8, hard: 11 };
function scoreCardio(min, intensity) {
  const durPts = Math.min(min / 45, 1) * 55;
  return Math.round(Math.min(100, durPts + ({ easy: 25, moderate: 35, hard: 45 }[intensity] || 30)));
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
      if (!top) { // bodyweight-only (abs etc.): track the best rep set instead
        (ex.sets || []).forEach(st => { if (st.reps > 0 && (!top || st.reps > top.reps)) top = st; });
      }
      if (top) out.push({ date: s.date, bestE1rm: best, topSet: top });
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
    if (max <= 0) return; // bodyweight-only exercises aren't plateau-tracked
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

/* ---------- auto-progression (double progression) ----------
   Rule: hit every prescribed set at the target reps → add weight next session.
   Fall short → repeat the weight and chase the missing reps. Stalled (plateau
   detected) → deload ~10% and build back. Bodyweight work progresses by reps. */

function parseTarget(t) {
  const m = /^(\d+)\s*[×x]\s*(\d+)/.exec((t || '').trim());
  return m ? { sets: +m[1], reps: +m[2] } : null;
}

/* every logged set of this exercise from its most recent session */
function lastSessionSets(name) {
  const key = name.toLowerCase();
  const sessions = getWorkouts()
    .filter(s => !s.cardio && (s.exercises || []).some(e => e.name.toLowerCase() === key))
    .sort((a, b) => a.date < b.date ? 1 : -1);
  if (!sessions.length) return null;
  const s = sessions[0];
  const ex = s.exercises.find(e => e.name.toLowerCase() === key);
  return { date: s.date, sets: (ex.sets || []).filter(st => st.reps > 0) };
}

function incrementLb(name) {
  return /squat|deadlift|leg press|hip thrust|lunge|calf raise/i.test(name) ? 10 : 5;
}

/* the prescribed sets×reps for an exercise, looked up from the user's template */
function findTargetFor(name) {
  const key = name.toLowerCase();
  const p = getProfile();
  const order = [TEMPLATES[p?.template], ...Object.values(TEMPLATES)].filter(Boolean);
  for (const tpl of order) {
    for (const d of tpl.days) {
      const hit = d.ex.find(e => e[0].toLowerCase() === key);
      if (hit) return hit[1];
    }
  }
  return '';
}
function roundLb5(lb) { return Math.max(5, Math.round(lb / 5) * 5); }

/* → {type, lb, sets, reps, text, lastText} */
function nextTarget(name, targetStr, stalledNames) {
  const tgt = parseTarget(targetStr) || { sets: 3, reps: 8 };
  const last = lastSessionSets(name);
  if (!last || !last.sets.length) {
    return { type: 'baseline', sets: tgt.sets, reps: tgt.reps, short: 'first time — set a baseline',
      text: `First time — find a working weight for ${tgt.sets}×${tgt.reps}. That's your baseline.` };
  }
  const maxKg = Math.max(...last.sets.map(s => s.weight || 0));
  const bestReps = Math.max(...last.sets.map(s => s.reps));
  const when = prettyDate(last.date).replace(/^\w+, /, '');

  if (maxKg <= 0) { // bodyweight / timed
    return { type: 'add_reps', lb: 0, sets: tgt.sets, reps: bestReps + 1, short: `last ${bestReps} reps`,
      text: `Beat ${bestReps} — aim ${bestReps + 1}+ this time.`,
      lastText: `${bestReps} reps · ${when}` };
  }

  const lastLb = kgToLb(maxKg);
  const lastText = `${Math.round(lastLb)} lb × ${bestReps} · ${when}`;
  const stalled = (stalledNames || new Set(detectPlateaus().map(p => p.name.toLowerCase()))).has(name.toLowerCase());
  if (stalled) {
    const lb = roundLb5(lastLb * 0.9);
    return { type: 'deload', lb, sets: tgt.sets, reps: tgt.reps, lastText,
      short: `stalled at ${Math.round(lastLb)} lb — deload`,
      text: `Stalled — deload to ${lb} lb × ${tgt.reps}, then add ${incrementLb(name)} lb a session.` };
  }

  const topSets = last.sets.filter(s => Math.abs((s.weight || 0) - maxKg) < 0.01);
  const allHit = topSets.length >= tgt.sets && topSets.every(s => s.reps >= tgt.reps);
  if (allHit) {
    const lb = roundLb5(lastLb + incrementLb(name));
    return { type: 'add_weight', lb, sets: tgt.sets, reps: tgt.reps, lastText,
      short: `up from ${Math.round(lastLb)} lb`,
      text: `Hit all ${tgt.sets}×${tgt.reps} — go up to ${lb} lb.` };
  }
  const lb = roundLb5(lastLb);
  const spread = topSets.map(s => s.reps).join('/');
  return { type: 'add_reps', lb, sets: tgt.sets, reps: tgt.reps, lastText,
    short: `last ${spread} — finish the sets`,
    text: `Stay at ${lb} lb — last time ${spread}. Get all ${tgt.sets} sets to ${tgt.reps}.` };
}

/* ---------- progress / volume engine ----------
   "Weight moved" = external load only (sets × reps × weight). Bodyweight work
   contributes 0 so the number stays honest and comparable over time. */

function sessionVolumeKg(s) {
  if (s.cardio) return 0;
  return (s.exercises || []).reduce((v, e) =>
    v + (e.sets || []).reduce((x, st) => x + Math.max(st.weight || 0, 0) * (st.reps || 0), 0), 0);
}
function volumeInDays(days) {
  return getWorkouts().reduce((v, s) => {
    const d = daysBetween(s.date, todayKey());
    return (d >= 0 && d < days) ? v + sessionVolumeKg(s) : v;
  }, 0);
}
function lifetimeVolumeKg() {
  return getWorkouts().reduce((v, s) => v + sessionVolumeKg(s), 0);
}
function weeklyVolumeSeries(weeks) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let sum = 0;
    getWorkouts().forEach(s => {
      const d = daysBetween(s.date, todayKey());
      if (d >= w * 7 && d < (w + 1) * 7) sum += sessionVolumeKg(s);
    });
    out.push(kgToLb(sum));
  }
  return out;
}
function sessionsInDays(days, liftsOnly) {
  return getWorkouts().filter(s => {
    const d = daysBetween(s.date, todayKey());
    return d >= 0 && d < days && (!liftsOnly || !s.cardio);
  }).length;
}
/* consecutive weeks meeting (planned − 1) sessions; the current partial week
   counts only if it already qualifies */
function weekStreak(target) {
  const bar = Math.max(1, target - 1);
  let streak = 0;
  for (let w = 0; w < 104; w++) {
    let n = 0;
    getWorkouts().forEach(s => {
      const d = daysBetween(s.date, todayKey());
      if (d >= w * 7 && d < (w + 1) * 7) n++;
    });
    if (n >= bar) streak++;
    else if (w === 0) continue;   // this week is still in progress
    else break;
  }
  return streak;
}
function fmtVol(lb) {
  if (lb >= 1e6) return (lb / 1e6).toFixed(2) + 'M';
  if (lb >= 1e5) return Math.round(lb / 1000) + 'k';
  if (lb >= 1e4) return (lb / 1000).toFixed(1) + 'k';
  return Math.round(lb).toLocaleString();
}
const VOLUME_MILESTONES = [25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 5e6, 10e6];

/* best est. 1RM per lift + 30-day movement, heaviest first */
function prBoard(limit) {
  const names = new Set();
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => names.add(ex.name)));
  return [...names].map(n => {
    const hist = exerciseHistory(n).filter(h => h.bestE1rm > 0);
    if (!hist.length) return null;
    const best = Math.max(...hist.map(h => h.bestE1rm));
    const older = hist.filter(h => daysBetween(h.date, todayKey()) > 30).map(h => h.bestE1rm);
    const oldBest = older.length ? Math.max(...older) : 0;
    return {
      name: n, bestLb: Math.round(kgToLb(best)), sessions: hist.length, hist,
      deltaLb: oldBest ? Math.round(kgToLb(best - oldBest)) : null
    };
  }).filter(Boolean).sort((a, b) => b.bestLb - a.bestLb).slice(0, limit || 6);
}

/* last N days as a weekday-aligned dot grid */
function trainingCalendar(days) {
  const marks = {};
  getWorkouts().forEach(s => {
    marks[s.date] = marks[s.date] || {};
    if (s.cardio) marks[s.date].cardio = true; else marks[s.date].lift = true;
  });
  let cells = '';
  for (let i = days - 1; i >= 0; i--) {
    const k = todayKey(-i);
    const m = marks[k];
    const cls = m ? (m.lift ? 'lift' : 'cardio') : '';
    const label = prettyDate(k) + (m ? (m.lift ? ' · lifted' : '') + (m.cardio ? ' · cardio' : '') : ' · rest');
    cells += `<div class="cal-day ${cls}" title="${esc(label)}"></div>`;
  }
  return `<div class="cal-grid">${cells}</div>`;
}

const CUE = { add_weight: '▲', add_reps: '→', deload: '▼', baseline: '●' };
function cueColor(type) {
  return type === 'add_weight' ? 'var(--good)' : type === 'deload' ? 'var(--warning)' : 'var(--ink-2)';
}

/* ---------- render ---------- */
function renderTrain() {
  if (App.activeSession) return renderActiveSession();
  const p = getProfile();
  const tpl = TEMPLATES[p.template];
  const nextIdx = nextDayIndex();
  const plateaus = detectPlateaus();
  const stalledNames = new Set(plateaus.map(pl => pl.name.toLowerCase()));
  const day = tpl.days[nextIdx];
  const all = getWorkouts();

  return `
  ${plateaus.map(pl => {
    const dl = nextTarget(pl.name, findTargetFor(pl.name), stalledNames);
    return `
    <div class="alert">
      <span class="a-ico">⚠</span>
      <div class="a-body"><b>${esc(pl.name)} has stalled — no PR in ${pl.sessions} sessions (${pl.days} days)</b>
      ${dl.type === 'deload' ? esc(dl.text) : esc(pl.tip)}</div>
    </div>`;
  }).join('')}

  ${renderTodaysSession(tpl, day, nextIdx, stalledNames)}
  ${renderVolumeCard(all)}
  ${renderConsistencyCard(p, all)}
  ${renderRecordsCard()}
  ${renderRecentCard(all)}`;
}

/* ---------- 1. the hero: what to do today ---------- */
function renderTodaysSession(tpl, day, nextIdx, stalledNames) {
  const plannedSets = day.ex.reduce((n, [, t]) => n + (parseTarget(t)?.sets || 3), 0);
  const estMin = Math.max(20, Math.round(plannedSets * 2.6 / 5) * 5);
  return `
  <div class="card">
    <h2>Today's session <span class="h2-right">${esc(tpl.name)}</span></h2>
    <div class="hero-num" style="font-size:28px">${esc(day.name)}</div>
    <div class="muted small">${day.ex.length} lifts · ${plannedSets} sets · about ${estMin} min</div>
    <button class="btn accent mt" data-action="start-workout" data-idx="${nextIdx}">Start workout</button>
    <div class="mt">
      ${day.ex.map(([n, tstr]) => {
        const pr = nextTarget(n, tstr, stalledNames);
        const val = pr.lb > 0 ? `${pr.lb}<span class="unit"> lb × ${pr.reps}</span>`
          : pr.lb === 0 ? `${pr.reps}<span class="unit"> reps</span>`
          : '<span class="unit">choose</span>';
        return `
        <div class="list-item">
          <span style="color:${cueColor(pr.type)};font-weight:700;width:14px">${CUE[pr.type] || '→'}</span>
          <div class="li-main">
            <div class="li-title">${esc(n)}</div>
            <div class="li-sub">${esc(pr.short || '')}</div>
          </div>
          <div class="li-val">${val}</div>
        </div>`;
      }).join('')}
    </div>
    <details class="adv">
      <summary>Train something else</summary>
      <div class="row mt">
        <select id="day-picker" class="grow">
          ${tpl.days.map((d, i) => `<option value="${i}" ${i === nextIdx ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
        </select>
        <button class="btn small" data-action="start-picked">Start</button>
      </div>
      <div class="grid-2 mt">
        <button class="btn" data-action="start-freestyle">Freestyle lift</button>
        <button class="btn" data-action="open-cardio">🏃 Log cardio</button>
      </div>
    </details>
  </div>`;
}

/* ---------- 2. weight moved: the number that only goes up ---------- */
function renderVolumeCard(all) {
  const lifeLb = kgToLb(lifetimeVolumeKg());
  if (lifeLb <= 0) {
    return `
    <div class="card">
      <h2>Weight moved</h2>
      <div class="muted small">Log your first session and this starts counting — every pound, every set, for as long as you use Peak.</div>
    </div>`;
  }
  const tiles = [
    ['today', kgToLb(volumeInDays(1))],
    ['7 days', kgToLb(volumeInDays(7))],
    ['30 days', kgToLb(volumeInDays(30))],
    ['this year', kgToLb(volumeInDays(365))]
  ];
  const series = weeklyVolumeSeries(8);
  const showTrend = series.filter(v => v > 0).length >= 2;
  const next = VOLUME_MILESTONES.find(m => m > lifeLb);
  const sets = all.reduce((n, s) => n + (s.exercises || []).reduce((x, e) => x + (e.sets || []).length, 0), 0);
  return `
  <div class="card">
    <h2>Weight moved <span class="h2-right">lb lifted</span></h2>
    <div class="grid-4">
      ${tiles.map(([label, lb]) => `
        <div class="stat"><div class="sv">${lb > 0 ? fmtVol(lb) : '—'}</div><div class="sl">${label}</div></div>`).join('')}
    </div>
    ${showTrend ? `
      <div class="spread mt">
        <span class="muted small">Weekly volume, last 8 weeks</span>
        ${sparkline(series, { color: CHART.orange, w: 150, h: 38, fmt: v => fmtVol(v) })}
      </div>` : ''}
    <div class="mt" style="border-top:1px solid var(--grid);padding-top:10px">
      <div class="spread">
        <span class="muted small">Lifetime</span>
        <b>${fmtVol(lifeLb)} lb</b>
      </div>
      <div class="spread" style="margin-top:4px">
        <span class="muted small">Sessions · sets</span>
        <span class="small">${all.length} · ${sets}</span>
      </div>
      ${next ? `<div class="chart-note mt">${fmtVol(next - lifeLb)} lb to go until you've moved ${fmtVol(next)} lb.</div>` : ''}
    </div>
  </div>`;
}

/* ---------- 3. consistency: showing up ---------- */
function renderConsistencyCard(p, all) {
  if (!all.length) return '';
  const wk = sessionsInDays(7), mo = sessionsInDays(30);
  const streak = weekStreak(p.gymDays);
  return `
  <div class="card">
    <h2>Consistency <span class="h2-right">last 5 weeks</span></h2>
    ${trainingCalendar(35)}
    <div class="cal-legend">
      <span><i style="background:var(--orange)"></i>lift</span>
      <span><i style="background:var(--blue)"></i>cardio</span>
      <span><i style="background:var(--surface-2)"></i>rest</span>
    </div>
    <div class="grid-4 mt" style="border-top:1px solid var(--grid);padding-top:10px">
      <div class="stat"><div class="sv">${wk}</div><div class="sl">this week</div></div>
      <div class="stat"><div class="sv">${p.gymDays}</div><div class="sl">planned</div></div>
      <div class="stat"><div class="sv">${mo}</div><div class="sl">30 days</div></div>
      <div class="stat"><div class="sv">${streak}</div><div class="sl">week streak</div></div>
    </div>
  </div>`;
}

/* ---------- 4. records: the trophy case ---------- */
function renderRecordsCard() {
  const prs = prBoard(6);
  if (!prs.length) return '';
  return `
  <div class="card">
    <h2>Personal records <span class="h2-right">est. 1RM · vs 30 days ago</span></h2>
    ${prs.map(r => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(r.name)}</div>
          <div class="li-sub">${r.sessions} session${r.sessions !== 1 ? 's' : ''}${
            r.deltaLb != null ? ` · <span style="color:${r.deltaLb > 0 ? CHART.good : 'var(--muted)'}">${r.deltaLb > 0 ? '+' + r.deltaLb + ' lb' : 'holding'}</span>` : ''}</div>
        </div>
        ${r.hist.length >= 2 ? sparkline(r.hist.map(h => kgToLb(h.bestE1rm)), { markers: prIndexes(r.hist), color: CHART.blue, w: 108, h: 34 }) : ''}
        <div class="li-val">${r.bestLb}<span class="unit"> lb</span></div>
      </div>`).join('')}
  </div>`;
}

/* ---------- 5. history ---------- */
function renderRecentCard(all) {
  const recent = all.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5);
  if (!recent.length) {
    return `<div class="card"><h2>Recent sessions</h2>
      <div class="muted center" style="padding:10px 0">No sessions yet. Your first one sets the baseline.</div></div>`;
  }
  return `
  <div class="card">
    <h2>Recent sessions</h2>
    ${recent.map(s => {
      const scoreChip = s.score != null ? `<span class="pill ${s.score >= 75 ? 'good' : s.score >= 50 ? 'warn' : ''}">${s.score}</span>` : '';
      const sub = s.cardio
        ? `${prettyDate(s.date)} · ${s.durationMin} min ${esc(s.intensity)} · ~${s.kcalEst} kcal`
        : `${prettyDate(s.date)} · ${(s.exercises || []).reduce((n, e) => n + (e.sets || []).length, 0)} sets · ${fmtVol(kgToLb(sessionVolumeKg(s)))} lb`;
      return `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(s.dayName)}</div>
          <div class="li-sub">${sub}</div>
        </div>
        ${scoreChip}
        <button class="btn small" data-action="view-workout" data-id="${s.id}">View</button>
      </div>`;
    }).join('')}
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
  const pr = nextTarget(ex.name, ex.target || findTargetFor(ex.name));
  return `
  <div class="card">
    <div class="ex-head">
      <span class="ex-name">${esc(ex.name)}</span>
      <span class="ex-target">${ex.target ? 'target ' + esc(ex.target) : ''}</span>
    </div>
    <div class="last-time" style="color:${cueColor(pr.type)};font-weight:600">${CUE[pr.type] || '→'} ${esc(pr.text)}</div>
    ${pr.lastText ? `<div class="last-time">Last: ${esc(pr.lastText)}</div>` : ''}
    ${ex.sets.map((st, si) => `
      <div class="set-row">
        <span class="set-no">${si + 1}</span>
        <input type="number" step="any" placeholder="lb" value="${st.weight != null && st.weight !== 0 ? Math.round(kgToLb(st.weight) * 10) / 10 : ''}"
          data-set-w data-xi="${xi}" data-si="${si}">
        <input type="number" placeholder="reps" value="${st.reps ?? ''}"
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
    // pre-fill the first set with today's prescribed target
    const pr = nextTarget(ex.name, ex.target || findTargetFor(ex.name));
    ex.sets.push({ weight: pr.lb ? lbToKg(pr.lb) : null, reps: pr.reps ?? null });
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
  // reps are required; weight is optional (0 = bodyweight, e.g. ab work)
  s.exercises = s.exercises
    .map(ex => ({ ...ex, sets: ex.sets.filter(st => st.reps > 0).map(st => ({ weight: st.weight || 0, reps: st.reps })) }))
    .filter(ex => ex.sets.length > 0);
  if (!s.exercises.length) { toast('No completed sets — add reps or discard'); return; }
  // PR check (weighted lifts only)
  const prs = [];
  s.exercises.forEach(ex => {
    const prevBest = Math.max(0, ...exerciseHistory(ex.name).map(h => h.bestE1rm));
    const nowBest = Math.max(0, ...ex.sets.map(st => e1rm(st.weight, st.reps)));
    if (nowBest > prevBest + 0.01 && prevBest > 0) prs.push(ex.name);
  });
  s.score = scoreWorkout(s);
  saveWorkout(s);
  App.activeSession = null;
  toast(prs.length ? `🎉 PR on ${prs.join(', ')}! Score ${s.score}` : `Workout saved — score ${s.score} 💪`);
  App.render();
}

const EXTRA_EXERCISES = [
  'Crunch', 'Cable Crunch', 'Ab Wheel Rollout', 'Russian Twist', 'Sit-up', 'Decline Sit-up',
  'Leg Raise', 'Plank (seconds)', 'Side Plank (seconds)', 'Dead Bug', 'Back Extension', 'Farmer Carry'
];

function openAddExercise() {
  const names = new Set();
  Object.values(TEMPLATES).forEach(t => t.days.forEach(d => d.ex.forEach(e => names.add(e[0]))));
  EXTRA_EXERCISES.forEach(n => names.add(n));
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => names.add(ex.name)));
  openModal(`
    <h3>Add exercise</h3>
    <label>Exercise name</label>
    <input id="ax-name" list="ax-list" placeholder="e.g. Cable Crunch">
    <datalist id="ax-list">${[...names].sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="chart-note">Bodyweight ab work: leave the weight blank and just log reps (or seconds).</div>
    <button class="btn primary mt" data-action="confirm-add-exercise">Add</button>
  `);
  setTimeout(() => document.getElementById('ax-name')?.focus(), 50);
}

function viewWorkoutModal(id) {
  const s = getWorkouts().find(w => w.id === id);
  if (!s) return;
  openModal(`
    <h3>${esc(s.dayName)}</h3>
    <div class="modal-sub">${prettyDate(s.date)}${s.score != null ? ` · score ${s.score}/100` : ''}</div>
    ${s.cardio
      ? `<div class="muted small">${s.durationMin} min · ${esc(s.intensity)} intensity · ~${s.kcalEst} kcal burned</div>`
      : (s.exercises || []).map(ex => `
      <div class="exercise-block">
        <div class="ex-head"><span class="ex-name">${esc(ex.name)}</span></div>
        ${(ex.sets || []).map((st, i) => `<div class="muted small">Set ${i + 1}: ${st.weight ? Math.round(kgToLb(st.weight)) + ' lb × ' + st.reps : st.reps + ' reps'}</div>`).join('')}
      </div>`).join('')}
    ${s.score != null && !s.cardio ? `<div class="chart-note mt">Score = intensity vs your bests (50) + sets vs plan (35) + PR bonus (15).</div>` : ''}
    <button class="btn ghost danger mt" data-action="delete-workout" data-id="${s.id}">Delete session</button>
  `);
}

/* ---------- cardio ---------- */
function openCardioModal() {
  openModal(`
    <h3>Log cardio</h3>
    <label>Type</label>
    <select id="cd-type">${CARDIO_TYPES.map(t => `<option>${esc(t)}</option>`).join('')}</select>
    <label>Duration (minutes)</label>
    <input id="cd-min" type="number" placeholder="e.g. 25">
    <label>Intensity</label>
    <div class="seg" id="cd-int">
      <button data-v="easy">Easy</button>
      <button data-v="moderate" class="on">Moderate</button>
      <button data-v="hard">Hard</button>
    </div>
    <button class="btn primary mt" data-action="save-cardio">Save</button>
  `);
}

function saveCardio() {
  const min = Number(document.getElementById('cd-min').value);
  if (!min || min < 1) { toast('Enter the duration'); return; }
  const type = document.getElementById('cd-type').value;
  const intensity = document.querySelector('#cd-int button.on')?.dataset.v || 'moderate';
  const kg = getProfile().weightKg;
  const kcalEst = Math.round(CARDIO_MET[intensity] * 3.5 * kg / 200 * min);
  const score = scoreCardio(min, intensity);
  saveWorkout({
    id: 'c' + Date.now(), date: todayKey(), cardio: true, freestyle: true,
    dayName: 'Cardio · ' + type, type, durationMin: min, intensity, kcalEst, score, exercises: []
  });
  closeModal();
  toast(`Cardio logged — score ${score} 🏃 (~${kcalEst} kcal)`);
  App.render();
}
