/* Peak — Train tab: routines, set logging, PRs, plateau detection */

const TEMPLATES = {
  fb3: {
    name: 'Full Body ×3', days: [
      { name: 'Full Body A', ex: [['Squat', '3×5'], ['Bench Press', '3×5'], ['Barbell Row', '3×8'], ['Overhead Press', '2×10'], ['Plank (seconds)', '3×45']] },
      { name: 'Full Body B', ex: [['Deadlift', '3×5'], ['Overhead Press', '3×5'], ['Lat Pulldown', '3×10'], ['Walking Lunge', '3×10'], ['Hanging Leg Raise', '3×10']] },
      { name: 'Full Body C', ex: [['Front Squat', '3×8'], ['Incline DB Press', '3×10'], ['Seated Cable Row', '3×10'], ['Romanian Deadlift', '3×8'], ['Dumbbell Curl', '3×12']] }
    ]
  },
  ul4: {
    name: 'Upper / Lower ×4', days: [
      { name: 'Upper A', ex: [['Bench Press', '4×5'], ['Barbell Row', '4×6'], ['Overhead Press', '3×8'], ['Lat Pulldown', '3×10'], ['Dumbbell Curl', '3×12'], ['Triceps Pushdown', '3×12']] },
      { name: 'Lower A', ex: [['Squat', '4×5'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '4×12'], ['Hanging Leg Raise', '3×12']] },
      { name: 'Upper B', ex: [['Overhead Press', '4×5'], ['Weighted Pull-up', '4×6'], ['Incline DB Press', '3×10'], ['Seated Cable Row', '3×10'], ['Lateral Raise', '3×15'], ['Hammer Curl', '3×12']] },
      { name: 'Lower B', ex: [['Deadlift', '3×5'], ['Front Squat', '3×8'], ['Walking Lunge', '3×10'], ['Leg Extension', '3×12'], ['Seated Calf Raise', '4×15'], ['Cable Crunch', '3×15']] }
    ]
  },
  ppl5: {
    name: 'PPL + Upper/Lower ×5', days: [
      { name: 'Push', ex: [['Bench Press', '4×6'], ['Overhead Press', '3×8'], ['Incline DB Press', '3×10'], ['Lateral Raise', '4×15'], ['Triceps Pushdown', '3×12'], ['Overhead Extension', '3×12']] },
      { name: 'Pull', ex: [['Deadlift', '3×5'], ['Weighted Pull-up', '4×6'], ['Barbell Row', '3×8'], ['Face Pull', '3×15'], ['Dumbbell Curl', '3×12'], ['Hammer Curl', '3×12']] },
      { name: 'Legs', ex: [['Squat', '4×6'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '5×12'], ['Hanging Leg Raise', '3×12']] },
      { name: 'Upper', ex: [['Overhead Press', '4×6'], ['Lat Pulldown', '3×10'], ['Incline DB Press', '3×10'], ['Seated Cable Row', '3×10'], ['Lateral Raise', '3×15'], ['Dumbbell Curl', '3×12']] },
      { name: 'Lower', ex: [['Front Squat', '4×6'], ['Hip Thrust', '3×10'], ['Walking Lunge', '3×10'], ['Leg Extension', '3×15'], ['Seated Calf Raise', '4×15'], ['Cable Crunch', '3×15']] }
    ]
  },
  ppl6: {
    name: 'Push/Pull/Legs ×6', days: [
      { name: 'Push A', ex: [['Bench Press', '4×5'], ['Overhead Press', '3×8'], ['Incline DB Press', '3×10'], ['Lateral Raise', '4×15'], ['Triceps Pushdown', '3×12']] },
      { name: 'Pull A', ex: [['Deadlift', '3×5'], ['Weighted Pull-up', '4×6'], ['Seated Cable Row', '3×10'], ['Face Pull', '3×15'], ['Dumbbell Curl', '3×12']] },
      { name: 'Legs A', ex: [['Squat', '4×5'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '5×12'], ['Hanging Leg Raise', '3×12']] },
      { name: 'Push B', ex: [['Overhead Press', '4×5'], ['Incline Bench Press', '3×8'], ['Dip', '3×10'], ['Lateral Raise', '4×15'], ['Overhead Extension', '3×12']] },
      { name: 'Pull B', ex: [['Barbell Row', '4×6'], ['Lat Pulldown', '3×10'], ['Chest-supported Row', '3×10'], ['Rear Delt Fly', '3×15'], ['Hammer Curl', '3×12']] },
      { name: 'Legs B', ex: [['Front Squat', '4×6'], ['Hip Thrust', '3×10'], ['Walking Lunge', '3×10'], ['Leg Extension', '3×15'], ['Seated Calf Raise', '4×15'], ['Cable Crunch', '3×15']] }
    ]
  }
};
/* Built-ins are starting points, not the product — every one of them can be
   edited, and the moment a user changes anything they get their own copy (see
   `editableRoutine` in routines.js). What matters here is covering the shapes
   people actually walk in with, including "I only have dumbbells" and "I have
   45 minutes twice a week", which the original four did not. */
Object.assign(TEMPLATES, {
  fb2: {
    name: 'Full Body ×2', days: [
      { name: 'Full Body 1', ex: [['Squat', '3×5'], ['Bench Press', '3×5'], ['Barbell Row', '3×8'], ['Overhead Press', '3×8'], ['Plank (seconds)', '3×45']] },
      { name: 'Full Body 2', ex: [['Deadlift', '3×5'], ['Incline DB Press', '3×10'], ['Lat Pulldown', '3×10'], ['Walking Lunge', '3×10'], ['Hanging Leg Raise', '3×12']] }
    ]
  },
  ul3: {
    name: 'Upper / Lower / Full ×3', days: [
      { name: 'Upper', ex: [['Bench Press', '4×6'], ['Barbell Row', '4×6'], ['Overhead Press', '3×8'], ['Lat Pulldown', '3×10'], ['Dumbbell Curl', '3×12'], ['Triceps Pushdown', '3×12']] },
      { name: 'Lower', ex: [['Squat', '4×6'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '4×12']] },
      { name: 'Full Body', ex: [['Deadlift', '3×5'], ['Incline DB Press', '3×10'], ['Weighted Pull-up', '3×8'], ['Bulgarian Split Squat', '3×10'], ['Lateral Raise', '3×15'], ['Cable Crunch', '3×15']] }
    ]
  },
  ppl3: {
    name: 'Push / Pull / Legs ×3', days: [
      { name: 'Push', ex: [['Bench Press', '4×6'], ['Overhead Press', '3×8'], ['Incline DB Press', '3×10'], ['Lateral Raise', '4×15'], ['Triceps Pushdown', '3×12']] },
      { name: 'Pull', ex: [['Deadlift', '3×5'], ['Weighted Pull-up', '4×6'], ['Seated Cable Row', '3×10'], ['Face Pull', '3×15'], ['Dumbbell Curl', '3×12']] },
      { name: 'Legs', ex: [['Squat', '4×6'], ['Romanian Deadlift', '3×8'], ['Leg Press', '3×10'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '4×12'], ['Hanging Leg Raise', '3×12']] }
    ]
  },
  arnold6: {
    name: 'Arnold split ×6', days: [
      { name: 'Chest & Back', ex: [['Bench Press', '4×8'], ['Barbell Row', '4×8'], ['Incline DB Press', '3×10'], ['Weighted Pull-up', '3×8'], ['Dumbbell Fly', '3×12'], ['Dumbbell Pullover', '3×12']] },
      { name: 'Shoulders & Arms', ex: [['Overhead Press', '4×8'], ['Lateral Raise', '4×15'], ['Rear Delt Fly', '3×15'], ['Barbell Curl', '3×10'], ['Skull Crusher', '3×10'], ['Hammer Curl', '3×12'], ['Triceps Pushdown', '3×12']] },
      { name: 'Legs & Abs', ex: [['Squat', '4×8'], ['Romanian Deadlift', '3×10'], ['Leg Press', '3×12'], ['Leg Curl', '3×12'], ['Standing Calf Raise', '4×15'], ['Hanging Leg Raise', '3×15']] },
      { name: 'Chest & Back II', ex: [['Incline Bench Press', '4×8'], ['Seated Cable Row', '4×10'], ['Dip', '3×10'], ['Lat Pulldown', '3×12'], ['Pec Deck', '3×15'], ['Straight-arm Pulldown', '3×15']] },
      { name: 'Shoulders & Arms II', ex: [['Seated Dumbbell Shoulder Press', '4×10'], ['Cable Lateral Raise', '4×15'], ['Face Pull', '3×15'], ['Preacher Curl', '3×12'], ['Overhead Extension', '3×12'], ['Cable Curl', '3×15'], ['Rope Pushdown', '3×15']] },
      { name: 'Legs & Abs II', ex: [['Front Squat', '4×8'], ['Hip Thrust', '3×10'], ['Bulgarian Split Squat', '3×10'], ['Leg Extension', '3×15'], ['Seated Calf Raise', '4×15'], ['Cable Crunch', '3×15']] }
    ]
  },
  bro5: {
    name: 'Body part split ×5', days: [
      { name: 'Chest', ex: [['Bench Press', '4×8'], ['Incline DB Press', '4×10'], ['Dip', '3×10'], ['Cable Fly', '3×15'], ['Pec Deck', '3×15']] },
      { name: 'Back', ex: [['Deadlift', '3×5'], ['Weighted Pull-up', '4×8'], ['Barbell Row', '4×8'], ['Seated Cable Row', '3×12'], ['Straight-arm Pulldown', '3×15'], ['Barbell Shrug', '3×12']] },
      { name: 'Shoulders', ex: [['Overhead Press', '4×8'], ['Seated Dumbbell Shoulder Press', '3×10'], ['Lateral Raise', '4×15'], ['Rear Delt Fly', '3×15'], ['Face Pull', '3×15'], ['Upright Row', '3×12']] },
      { name: 'Arms', ex: [['Barbell Curl', '4×10'], ['Skull Crusher', '4×10'], ['Hammer Curl', '3×12'], ['Rope Pushdown', '3×15'], ['Preacher Curl', '3×12'], ['Overhead Extension', '3×12']] },
      { name: 'Legs', ex: [['Squat', '4×8'], ['Romanian Deadlift', '3×10'], ['Leg Press', '3×12'], ['Leg Curl', '3×12'], ['Leg Extension', '3×15'], ['Standing Calf Raise', '4×15']] }
    ]
  },
  home3: {
    name: 'Dumbbells only ×3', days: [
      { name: 'Push', ex: [['Dumbbell Bench Press', '4×10'], ['Seated Dumbbell Shoulder Press', '3×10'], ['Incline DB Press', '3×12'], ['Lateral Raise', '4×15'], ['Dumbbell Kickback', '3×15'], ['Push-up', '3×15']] },
      { name: 'Pull', ex: [['Single-arm Dumbbell Row', '4×10'], ['Dumbbell Pullover', '3×12'], ['Rear Delt Fly', '3×15'], ['Dumbbell Curl', '3×12'], ['Hammer Curl', '3×12'], ['Dumbbell Shrug', '3×15']] },
      { name: 'Legs', ex: [['Goblet Squat', '4×12'], ['Romanian Deadlift', '3×10'], ['Bulgarian Split Squat', '3×10'], ['Walking Lunge', '3×12'], ['Single-leg Calf Raise', '4×15'], ['Plank (seconds)', '3×45']] }
    ]
  },
  minimal3: {
    name: 'Big lifts only ×3', days: [
      { name: 'Squat day', ex: [['Squat', '5×5'], ['Bench Press', '5×5'], ['Barbell Row', '5×5']] },
      { name: 'Press day', ex: [['Overhead Press', '5×5'], ['Deadlift', '1×5'], ['Weighted Pull-up', '3×8']] },
      { name: 'Squat day II', ex: [['Squat', '5×5'], ['Incline Bench Press', '5×5'], ['Barbell Row', '5×5']] }
    ]
  }
});

const TEMPLATE_FOR_DAYS = { 2: 'fb2', 3: 'fb3', 4: 'ul4', 5: 'ppl5', 6: 'ppl6', 7: 'ppl6' };

/* ---------- muscle mapping & weekly set volume ----------
   Sets per muscle per week is the standard hypertrophy dose metric. Primary
   movers score a full set, secondary movers half. Ranges below are the widely
   used evidence-based landmarks (minimum effective → maximum recoverable
   weekly sets, per Renaissance Periodization's volume-landmark framework) —
   general guidance for a trained lifter, not precise personal limits. */

const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];
const MUSCLE_LABEL = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', abs: 'Abs'
};
const MUSCLE_LANDMARKS = {   // [minimum effective, maximum recoverable] sets/week
  chest: [8, 22], back: [10, 25], shoulders: [8, 24], biceps: [8, 26], triceps: [6, 22],
  quads: [8, 20], hamstrings: [6, 20], glutes: [4, 16], calves: [8, 20], abs: [6, 25]
};

/* order matters — most specific patterns first ("leg curl" before "curl") */
const MUSCLE_RULES = [
  { re: /calf raise|calf press|calves|soleus/i, p: ['calves'] },
  { re: /pull.?through|reverse hyper/i, p: ['glutes'], s: ['hamstrings'] },
  { re: /hip abduct|hip adduct|abductor|adductor/i, p: ['glutes'] },
  { re: /glute.?ham raise|\bghr\b/i, p: ['hamstrings'], s: ['glutes', 'back'] },
  { re: /leg curl|nordic|ham(string)? curl/i, p: ['hamstrings'] },
  { re: /leg extension/i, p: ['quads'] },
  { re: /romanian deadlift|\brdl\b|stiff.?leg/i, p: ['hamstrings'], s: ['glutes', 'back'] },
  { re: /hip thrust|glute bridge|glute kick/i, p: ['glutes'], s: ['hamstrings'] },
  { re: /back extension|hyperextension/i, p: ['hamstrings'], s: ['glutes', 'back'] },
  { re: /kettlebell swing|\bkb swing/i, p: ['glutes', 'hamstrings'], s: ['back'] },
  { re: /sled (push|drag)|prowler/i, p: ['quads'], s: ['glutes', 'calves'] },
  { re: /front squat/i, p: ['quads'], s: ['glutes', 'abs'] },
  { re: /hack squat|leg press|bulgarian|split squat|step.?up/i, p: ['quads'], s: ['glutes'] },
  { re: /lunge/i, p: ['quads', 'glutes'] },
  { re: /squat/i, p: ['quads'], s: ['glutes', 'hamstrings'] },
  { re: /deadlift|good morning/i, p: ['hamstrings', 'back'], s: ['glutes', 'quads'] },
  { re: /lateral raise|side raise|upright row/i, p: ['shoulders'] },
  { re: /rear delt|face pull|reverse fly/i, p: ['shoulders'], s: ['back'] },
  { re: /landmine press/i, p: ['shoulders'], s: ['chest', 'triceps'] },
  { re: /overhead press|shoulder press|military|arnold/i, p: ['shoulders'], s: ['triceps'] },
  { re: /incline (bench|db|dumbbell|barbell)?\s*press|incline press/i, p: ['chest'], s: ['shoulders', 'triceps'] },
  { re: /bench press|chest press|push.?up|\bdip\b|chest fly|pec/i, p: ['chest'], s: ['triceps', 'shoulders'] },
  { re: /pushdown|skull.?crusher|overhead extension|triceps|kickback|close.?grip/i, p: ['triceps'] },
  { re: /pull.?up|chin.?up|pulldown|\blat\b/i, p: ['back'], s: ['biceps'] },
  { re: /shrug|\btrap\b/i, p: ['back'] },
  { re: /\brow\b/i, p: ['back'], s: ['biceps'] },
  { re: /pullover/i, p: ['back'], s: ['chest'] },
  { re: /curl/i, p: ['biceps'] },
  { re: /crunch|sit.?up|leg raise|knee raise|plank|ab wheel|rollout|russian twist|dead bug|hollow|woodchop|oblique/i, p: ['abs'] },
  { re: /farmer|carry/i, p: ['back'], s: ['abs'] },
  { re: /fly|flye/i, p: ['chest'], s: ['shoulders'] }
];

/* User-taught mappings win over the regex table, so a lift the patterns miss can
   be fixed once instead of silently reading as zero volume forever. */
function getMuscleMap() { return Store.get('muscleMap', {}); }
function setMuscleOverride(name, p, s) {
  const m = getMuscleMap();
  m[String(name).toLowerCase()] = { p, s };
  Store.set('muscleMap', m);
}
/* Order matters: what the user taught us, then the library (which states its
   movers explicitly), then the patterns. The library sits above the regexes
   because a rule written to catch a family will occasionally catch a lift it
   shouldn't — "Reverse Curl" is biceps, "Cable Pull-through" is not a pull. */
function musclesFor(name) {
  const o = getMuscleMap()[String(name || '').toLowerCase()];
  if (o) return { p: o.p || [], s: o.s || [] };
  const lib = typeof libEntry === 'function' ? libEntry(name) : null;
  if (lib) return { p: lib.p || [lib.group], s: lib.s || [] };
  for (const r of MUSCLE_RULES) if (r.re.test(name)) return { p: r.p || [], s: r.s || [] };
  return { p: [], s: [] };
}

/* weighted sets per muscle over the trailing N days, plus anything the map
   couldn't place — an unmatched lift must never be reported as zero volume */
function muscleSetsInDays(days) {
  const sets = {};
  MUSCLES.forEach(m => { sets[m] = 0; });
  const unknown = {};
  getWorkouts().forEach(s => {
    const d = daysBetween(s.date, todayKey());
    if (d < 0 || d >= days || s.cardio) return;
    (s.exercises || []).forEach(ex => {
      const n = workingSets(ex.sets).filter(st => st.reps > 0).length;
      if (!n) return;
      const m = musclesFor(ex.name);
      if (!m.p.length && !m.s.length) { unknown[ex.name] = (unknown[ex.name] || 0) + n; return; }
      m.p.forEach(x => { if (sets[x] != null) sets[x] += n; });
      m.s.forEach(x => { if (sets[x] != null) sets[x] += n * 0.5; });
    });
  });
  return { sets, unclassified: Object.entries(unknown).map(([name, n]) => ({ name, sets: n })) };
}

/* if a stalled lift's primary muscle is under-trained by the ROUTINE, say so.
   Same rules as the coach's volume card (D-16): it reads what the plan
   programs, not the trailing 7 days — a weekly bench session from eight days
   ago is not a volume deficit — and only a real shortfall (under 80% of MEV)
   earns the sentence. It sits beside the prescription, so it adds to it and
   never argues with it: the old "before dropping weight" read as "ignore the
   deload above". Quiet while any routine lift is unmapped, because the
   "deficit" may just be a lift we failed to classify. */
function plateauVolumeNote(exName) {
  const r = activeRoutine();
  if (r.days.some(d => d.ex.some(([n]) => { const m = musclesFor(n); return !m.p.length && !m.s.length; }))) return '';
  const sets = routineWeeklyMuscleSets();
  const lacking = musclesFor(exName).p.filter(x => MUSCLE_LANDMARKS[x] && sets[x] < MUSCLE_LANDMARKS[x][0] * 0.8);
  if (!lacking.length) return '';
  const names = lacking.map(x => MUSCLE_LABEL[x].toLowerCase()).join(' and ');
  const got = lacking.map(x => Math.round(sets[x] * 2) / 2).join('/');
  const need = lacking.map(x => MUSCLE_LANDMARKS[x][0]).join('/');
  return ` Your routine also programs only ${got} ${names} sets a week, against an effective minimum of ${need} — adding a set or two there will help this lift climb.`;
}

/* Warmup sets are logged but must never count toward volume, PRs, est. 1RM,
   session score, or progression — only working sets do. */
function isWarmup(st) { return st && st.type === 'warmup'; }
function workingSets(sets) { return (sets || []).filter(st => !isWarmup(st)); }

/* Dumbbell and single-arm work is logged PER HAND. Stating the convention is the
   only way the number means anything a month later; volume doubles it so
   "weight moved" stays comparable with barbell work. */
function perHandLift(name) {
  return /dumbbell|\bdb\b|hammer curl|lateral raise|goblet|single.?arm|one.?arm|kettlebell/i.test(name);
}
function setLoadKg(exName, st) {
  const w = Math.max(st.weight || 0, 0);
  return perHandLift(exName) ? w * 2 : w;
}

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
    const nowBest = Math.max(0, ...workingSets(ex.sets).map(st => e1rm(st.weight, st.reps)));
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
  const setsDone = s.exercises.reduce((x, e) => x + workingSets(e.sets).length, 0);
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

/* Per-exercise history: [{date, bestE1rm, topSet, sets}] oldest→newest.
   `sets` is every working set with reps, which is what the plateau engine
   judges progress on — the top set alone can't see added reps. */
function exerciseHistory(name) {
  const out = [];
  getWorkouts().forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (ex.name.toLowerCase() !== name.toLowerCase()) return;
      let best = 0, top = null;
      const work = workingSets(ex.sets).filter(st => st.reps > 0);
      work.forEach(st => {
        const v = e1rm(st.weight, st.reps);
        if (v > best) { best = v; top = st; }
      });
      if (!top) { // bodyweight-only (abs etc.): track the best rep set instead
        work.forEach(st => { if (st.reps > 0 && (!top || st.reps > top.reps)) top = st; });
      }
      if (top) out.push({ date: s.date, bestE1rm: best, topSet: top, sets: work });
    });
  });
  out.sort((a, b) => a.date < b.date ? -1 : 1);
  return out;
}

/* Heaviest weight you've done for real work at this prescription, in kg — the
   ceiling a deload is measured against. Two things are not that ceiling:
     · a heavy single or double — a 365×1 test doesn't mean 315×5 is "below your
       best", so sets under half the target reps don't count
     · the other day's scheme — a 3×10 light day is not "rebuilding" toward the
       4×5 heavy day's weight, so sessions logged at the same rep target win
       whenever there are any */
function bestComparableKg(name, tgt) {
  const key = name.toLowerCase();
  const minReps = Math.max(1, Math.ceil(tgt.reps / 2));
  const entries = [];
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => {
    if (ex.name.toLowerCase() === key) entries.push(ex);
  }));
  const same = entries.filter(ex => parseTarget(ex.target)?.reps === tgt.reps);
  let best = 0;
  (same.length ? same : entries).forEach(ex => workingSets(ex.sets).forEach(st => {
    if ((st.reps || 0) >= minReps && (st.weight || 0) > best) best = st.weight;
  }));
  return best;
}

/* heaviest working set ever logged on a lift, in kg */
function bestWorkingWeightKg(name) {
  const key = name.toLowerCase();
  let best = 0;
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => {
    if (ex.name.toLowerCase() !== key) return;
    workingSets(ex.sets).forEach(st => { if ((st.weight || 0) > best) best = st.weight; });
  }));
  return best;
}

/* ---------- what counts as progress ----------
   A session "beats" earlier ones if EITHER
     · its best e1RM is higher (by `margin`), or
     · at some load it used, it did more total reps at-or-above that load than
       any earlier session did — 8/8/7 after 8/7/7, or 15 reps past the e1RM
       formula's 12-rep cap.
   The rep test is only allowed when the session's e1RM is within 3% of the
   earlier best: otherwise a heavy single at a new weight would be "more reps at
   that load than ever" and count as progress. */
function repsAtOrAbove(h, kg) {
  return h.sets.reduce((n, st) => n + ((st.weight || 0) >= kg - 0.01 ? st.reps : 0), 0);
}
function beats(h, before, margin) {
  if (!before.length) return true;
  const prevBest = Math.max(...before.map(b => b.bestE1rm));
  if (h.bestE1rm > prevBest * margin) return true;
  if (h.bestE1rm < prevBest * 0.97) return false;
  return h.sets.some(st => (st.weight || 0) > 0 &&
    repsAtOrAbove(h, st.weight) > Math.max(...before.map(b => repsAtOrAbove(b, st.weight))));
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

/* ---------- plateau detection ----------
   This is the whole product, so a false positive is the most expensive bug the
   app can have: it tells someone who is progressing to cut their weight.

   A lift is plateaued when ALL of these hold:
     1. still in the program   — trained within DORMANT_DAYS
     2. enough evidence        — ≥4 sessions since the last training break
     3. no PR                  — no session has beaten all before it (see
                                 `beats`) for ≥3 sessions and ≥21 days
     4. not currently climbing — neither of the last two sessions beat the three
                                 before it

   (2) and (4) exist because (3) alone is fooled in three common ways:
     · an abandoned lift stays flagged forever, since the old rule compared the
       PR date to the last session rather than to today
     · one fluke PR poisons a lift permanently — a lifter adding 5 lb every
       session sits under an outlier from months ago and reads as "stalled"
     · returning from a layoff looks identical to stalling, because the old best
       is still unbeaten while you rebuild toward it */

const DORMANT_DAYS = 21;   // not trained this recently → dormant, not stalled
const LAYOFF_DAYS = 28;    // a gap this long resets the evidence window

/* history since the most recent training break — you cannot have plateaued in
   the three sessions since coming back from six weeks off */
function historySinceLayoff(hist) {
  let start = 0;
  for (let i = 1; i < hist.length; i++) {
    if (daysBetween(hist[i - 1].date, hist[i].date) >= LAYOFF_DAYS) start = i;
  }
  return hist.slice(start);
}

/* Is the lift moving up right now? Judged locally — does either of the last two
   sessions beat the three before it — not against the all-time best. Comparing
   the best of each 3-session block (the v29 rule) kept a pre-break PR in the
   "prior" block, so a lifter back from ten days off and adding weight every
   session read as flat and got deloaded mid-rebuild. A stall wobbling around
   its best never beats its own recent sessions; at worst noise that happens to
   rise delays a flag by a session, which D-12 accepts. >1% ignores rounding. */
function isClimbing(hist) {
  for (let i = hist.length - 2; i < hist.length; i++) {
    if (i < 3) continue;                         // too little data to tell
    if (beats(hist[i], hist.slice(i - 3, i), 1.01)) return true;
  }
  return false;
}

function detectPlateaus() {
  const names = new Set();
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => names.add(ex.name)));
  const flags = [];
  names.forEach(name => {
    const full = exerciseHistory(name);
    if (!full.length) return;

    // 1. dormant lifts are not stalled — they're not being trained
    const idleDays = daysBetween(full[full.length - 1].date, todayKey());
    if (idleDays > DORMANT_DAYS) return;

    // 2. only judge what happened since the last real break
    const hist = historySinceLayoff(full);
    if (hist.length < 4) return;

    const max = Math.max(...hist.map(h => h.bestE1rm));
    if (max <= 0) return; // bodyweight-only exercises aren't plateau-tracked

    // 4. still climbing → not stalled, whatever the all-time best says
    if (isClimbing(hist)) return;

    // 3. no PR for long enough — by e1RM or by reps at a load
    let lastPrIdx = 0;
    for (let i = 1; i < hist.length; i++) if (beats(hist[i], hist.slice(0, i), 1.0001)) lastPrIdx = i;
    const sessionsSince = hist.length - 1 - lastPrIdx;
    const daysSince = daysBetween(hist[lastPrIdx].date, hist[hist.length - 1].date);
    if (sessionsSince >= 3 && daysSince >= 21) {
      flags.push({
        name, sessions: sessionsSince, days: daysSince,
        sinceLayoff: hist.length !== full.length,
        tip: PLATEAU_TIPS[Math.abs(hashCode(name)) % PLATEAU_TIPS.length]
      });
    }
  });
  return flags;
}
function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }

/* Same eligibility gates as detectPlateaus, so "watching N lifts" only ever
   counts lifts that could actually be flagged. Surfaced when nothing is flagged
   so the alert engine is visible before it ever has cause to fire — otherwise a
   new user waits three weeks to learn it exists. */
function plateauWatchCount() {
  const names = new Set();
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => names.add(ex.name)));
  let n = 0;
  names.forEach(name => {
    const full = exerciseHistory(name);
    if (!full.length) return;
    if (daysBetween(full[full.length - 1].date, todayKey()) > DORMANT_DAYS) return;
    const hist = historySinceLayoff(full);
    if (hist.length >= 4 && Math.max(...hist.map(h => h.bestE1rm)) > 0) n++;
  });
  return n;
}

function plateauWatchRow() {
  const n = plateauWatchCount();
  return `
  <div class="alert good">
    <span class="a-ico">✓</span>
    <div class="a-body"><b>${n ? `Watching ${n} lift${n > 1 ? 's' : ''} — everything progressing` : 'Plateau watch is on'}</b>
    ${n
      ? 'Peak flags a lift that goes 3 sessions and 21 days without a PR — but not while it is still climbing, and not after time off. Then it deloads once and walks you back up.'
      : 'Log a lift 4 times and Peak starts tracking it for plateaus — you get told the moment it stalls, and what to do about it.'}</div>
  </div>`;
}

/* Which day is next. Counting sessions modulo the day count broke as soon as
   routines became editable — adding a day silently reshuffled the rotation, and
   deleting one could point at a day that no longer exists. Anchor on the last
   day actually trained instead, which is both stable under edits and what a
   lifter means by "what's next". */
function nextDayIndex() {
  const days = activeRoutine().days;
  const last = getWorkouts()
    .filter(s => !s.cardio && !s.freestyle && s.dayName)
    .sort((a, b) => a.date < b.date ? 1 : -1)[0];
  if (!last) return 0;
  const i = days.findIndex(d => d.name === last.dayName);
  if (i < 0) return 0;                       // that day is gone from the routine
  return (i + 1) % days.length;
}

/* ---------- auto-progression (double progression) ----------
   Rule: hit every prescribed set at the target reps → add weight next session.
   Fall short → repeat the weight and chase the missing reps. Stalled at your
   best weight → deload ~10% once, then climb back. Bodyweight work adds reps. */

function parseTarget(t) {
  const m = /^(\d+)\s*[×x]\s*(\d+)/.exec((t || '').trim());
  return m ? { sets: +m[1], reps: +m[2] } : null;
}

/* Every logged set of this exercise from its most recent session — or, given
   the prescription, its most recent session AT that prescription. A lift on a
   heavy 4×5 day and a light 3×10 day has two histories; reading whichever came
   last prescribed the light day at the heavy weight and the heavy day 40 lb
   short. Only a recent match counts (within LAYOFF_DAYS of the latest session),
   so changing a lift's rep target doesn't resurrect a months-old weight. */
function lastSessionSets(name, targetStr) {
  const key = name.toLowerCase();
  const sessions = getWorkouts()
    .filter(s => !s.cardio && (s.exercises || []).some(e => e.name.toLowerCase() === key))
    .sort((a, b) => a.date < b.date ? 1 : -1);
  if (!sessions.length) return null;
  const exOf = s => s.exercises.find(e => e.name.toLowerCase() === key);
  const want = parseTarget(targetStr);
  const same = want && sessions.find(s =>
    parseTarget(exOf(s).target)?.reps === want.reps && daysBetween(s.date, sessions[0].date) < LAYOFF_DAYS);
  const s = same || sessions[0];
  const ex = exOf(s);
  return { date: s.date, sets: workingSets(ex.sets).filter(st => st.reps > 0), allSets: (ex.sets || []).filter(st => st.reps > 0) };
}

/* Increment scales with the load instead of a flat 5 lb, which was a 25% jump on
   a lateral raise and a rounding error on a heavy squat. ~2.5% for everything:
   big lower-body lifts used to get 5%, which is a novice jump — 20 lb a session
   on a 405 deadlift misses early and then reads as a stall. The step rounding
   still gives lighter lowers the same 5 lb they always got. */
function incrementW(name, currentDisp) {
  const pct = (currentDisp || 0) * 0.025;
  if (perHandLift(name)) {
    const s = isMetric() ? 1.25 : 2.5;   // dumbbells step in smaller pairs
    return Math.max(s, Math.round(pct / s) * s);
  }
  const step = wStep();
  return Math.max(step, Math.round(pct / step) * step);
}
function roundW(v, name) {
  const s = perHandLift(name) ? (isMetric() ? 1.25 : 2.5) : wStep();
  return Math.max(s, Math.round(v / s) * s);
}

/* the prescribed sets×reps for an exercise — the user's own routine wins */
function findTargetFor(name) {
  const key = name.toLowerCase();
  const order = [activeRoutine(), ...Object.values(TEMPLATES)].filter(Boolean);
  for (const tpl of order) {
    for (const d of tpl.days) {
      const hit = d.ex.find(e => e[0].toLowerCase() === key);
      if (hit) return hit[1];
    }
  }
  return '';
}

/* ---------- progression preferences ----------
   Two per-exercise overrides on top of automatic double progression:

     incKg — a custom increase. Total logged load, or per-hand load for per-hand
             lifts — i.e. the same number you type into the weight field. Stored
             in kg like every other weight, so switching units only changes how
             it's shown.
     hold  — {kg, since}. "Keep my weight": the prescription stays at this load,
             no increases and no deloads, until you resume progression. Records
             and plateau detection carry on underneath; the plan just says it's
             paused instead of arguing with you.

   Keyed by trimmed, lower-cased name — the same convention the history lookups
   use. Nothing here exists until someone sets it, and a missing entry is
   exactly the old behaviour, so there is no migration. */
const PROG_KEY = 'progressionPrefs';
function progKey(name) { return String(name || '').trim().toLowerCase(); }
function getProgressionPrefs() {
  const p = Store.get(PROG_KEY, {});
  return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
}
/* sanitised: anything malformed (a hand-edited backup) reads as "no preference" */
function progressionPref(name) {
  const raw = getProgressionPrefs()[progKey(name)] || {};
  const out = {};
  if (Number.isFinite(raw.incKg) && raw.incKg > 0) out.incKg = raw.incKg;
  if (raw.hold && Number.isFinite(raw.hold.kg) && raw.hold.kg > 0) out.hold = { kg: raw.hold.kg, since: raw.hold.since || null };
  return out;
}
function setProgressionPref(name, patch) {
  const all = { ...getProgressionPrefs() };
  const key = progKey(name);
  if (!key) return;
  const next = { ...(all[key] || {}), ...patch };
  Object.keys(next).forEach(k => { if (next[k] == null) delete next[k]; });
  if (Object.keys(next).length) all[key] = next; else delete all[key];
  Store.set(PROG_KEY, all);
}

/* Does this lift carry external load? Weight you've logged says yes outright;
   otherwise the name decides — a plank or a push-up has nothing to increment,
   a "Weighted Pull-up" does. */
const BODYWEIGHT_RE = /\(seconds?\)|plank|hollow hold|push.?up|pull.?up|chin.?up|\bdips?\b|crunch|sit.?up|leg raise|knee raise|toes.?to.?bar|\bv.?up\b|dead bug|russian twist|inverted row|nordic|sissy squat|ab wheel|rollout|bench dip|burpee/i;
function exerciseHasLoad(name) {
  if (bestWorkingWeightKg(name) > 0) return true;
  if (progressionPref(name).hold) return true;
  return /weighted/i.test(name) || !BODYWEIGHT_RE.test(name);
}

const r1 = v => Math.round(v * 10) / 10;

/* → {type, w, wKg, sets, reps, text, short, lastText, rebuilding, paused} — w is
   in the user's display unit (lb or kg), 0 for bodyweight, undefined for a new
   lift. wKg, when present, is the exact stored load behind w, so pre-filling a
   set doesn't round-trip a held or custom weight through the display rounding.

   This is the ONE place a target is decided: the Train preview, the session
   pre-fill, an added set and the "Why this target?" sheet all read it. */
function nextTarget(name, targetStr, stalledNames) {
  const tgt = parseTarget(targetStr) || { sets: 3, reps: 8 };
  const pref = progressionPref(name);
  const u = wUnit();
  const last = lastSessionSets(name, targetStr);
  const isStalled = () => (stalledNames || new Set(detectPlateaus().map(p => p.name.toLowerCase()))).has(name.toLowerCase());

  const holdResult = lastText => {
    const w = r1(toW(pref.hold.kg));
    const stalled = isStalled();
    return { type: 'hold', paused: true, w, wKg: pref.hold.kg, sets: tgt.sets, reps: tgt.reps, lastText,
      short: `keeping ${w} ${u} — progression paused`,
      text: `Progression paused — you chose to keep ${w} ${u}, so Peak won't add weight or deload this lift.${
        stalled ? ' Plateau watch still sees no recent PR on it.' : ''} Aim for ${tgt.sets}×${tgt.reps}, and resume progression in Progression settings when you're ready to build again.` };
  };

  if (!last || !last.sets.length) {
    if (pref.hold) return holdResult(undefined);
    return { type: 'baseline', sets: tgt.sets, reps: tgt.reps, short: 'first time — set a baseline',
      text: `First time — find a working weight for ${tgt.sets}×${tgt.reps}. That's your baseline.` };
  }
  const maxKg = Math.max(...last.sets.map(s => s.weight || 0));
  const bestReps = Math.max(...last.sets.map(s => s.reps));
  const when = prettyDate(last.date).replace(/^\w+, /, '');

  if (maxKg <= 0) { // bodyweight / timed
    if (pref.hold) return holdResult(`${bestReps} reps · ${when}`);
    return { type: 'add_reps', w: 0, sets: tgt.sets, reps: bestReps + 1, short: `last ${bestReps} reps`,
      text: `Beat ${bestReps} — aim ${bestReps + 1}+ this time.`,
      lastText: `${bestReps} reps · ${when}` };
  }

  const lastDisp = toW(maxKg);
  const topSets = last.sets.filter(s => Math.abs((s.weight || 0) - maxKg) < 0.01);
  /* a set that actually happened — the heaviest weight with the reps done AT
     that weight, not the session's best reps borrowed from a lighter set */
  const topReps = Math.max(...topSets.map(s => s.reps));
  const lastText = `${r1(lastDisp)} ${u} × ${topReps} · ${when}`;
  /* judged on the best `tgt.sets` sets at that weight — an extra set beyond the
     plan is bonus work, not a missed rep that blocks the increase */
  const best = [...topSets].sort((a, b) => b.reps - a.reps).slice(0, tgt.sets);
  const allHit = best.length >= tgt.sets && best.every(s => s.reps >= tgt.reps);

  // a hold outranks everything below: no increase, no deload
  if (pref.hold) return holdResult(lastText);

  /* A custom increment is the user's own grid. Rounding its result back onto
     the automatic 5 lb / 2.5 kg steps would silently undo it (185 + 2.5 → 190),
     so custom values stay exact and plate math flags anything unloadable. */
  const custom = pref.incKg > 0;
  const incText = custom ? r1(toW(pref.incKg)) : null;

  /* Completing the prescription always earns the increment. Testing the stall
     flag first is what turned one deload into an endless staircase down: the
     all-time best stays unbeaten while you rebuild, so the lift reads as stalled
     every session and got cut another 10% off the already-reduced weight. */
  if (allHit) {
    if (custom) {
      const wKg = maxKg + pref.incKg;
      const val = r1(toW(wKg));
      return { type: 'add_weight', w: val, wKg, custom: true, sets: tgt.sets, reps: tgt.reps, lastText,
        short: `up ${incText} ${u} from ${r1(lastDisp)} ${u}`,
        text: `Hit all ${tgt.sets}×${tgt.reps} — go up your custom ${incText} ${u} to ${val} ${u}.` };
    }
    const inc = incrementW(name, lastDisp);
    const val = roundW(lastDisp + inc, name);
    return { type: 'add_weight', w: val, sets: tgt.sets, reps: tgt.reps, lastText,
      short: `up from ${Math.round(lastDisp)} ${u}`,
      text: `Hit all ${tgt.sets}×${tgt.reps} — go up to ${val} ${u}.` };
  }

  const stalled = isStalled();
  const bestDisp = toW(bestComparableKg(name, tgt));

  // Deload only from the top. Below your best you are already climbing back.
  if (stalled && lastDisp >= bestDisp * 0.98) {
    const val = roundW(lastDisp * 0.9, name);
    const inc = custom ? incText : incrementW(name, val);
    return { type: 'deload', w: val, sets: tgt.sets, reps: tgt.reps, lastText,
      short: `stalled at ${Math.round(lastDisp)} ${u} — deload`,
      text: `Stalled — deload to ${val} ${u} × ${tgt.reps}, then add ${inc} ${u} each session you complete until you pass ${Math.round(bestDisp)} ${u}.` };
  }

  const val = custom ? r1(lastDisp) : roundW(lastDisp, name);
  const spread = topSets.map(s => s.reps).join('/');
  const rebuilding = stalled && lastDisp < bestDisp * 0.98;
  return { type: 'add_reps', w: val, wKg: custom ? maxKg : undefined, sets: tgt.sets, reps: tgt.reps, lastText, rebuilding,
    short: rebuilding ? `rebuilding — ${Math.round(lastDisp)} of ${Math.round(bestDisp)} ${u}` : `last ${spread} — finish the sets`,
    text: rebuilding
      ? `Climbing back to ${Math.round(bestDisp)} ${u} — stay at ${val} ${u} and get all ${tgt.sets} sets to ${tgt.reps}.`
      : `Stay at ${val} ${u} — last time ${spread}. Get all ${tgt.sets} sets to ${tgt.reps}.` };
}

/* ---------- progression settings sheet ---------- */
/* "2.5" not "2.50", "1.13" not "1.1339" — enough precision that a 1.25 kg
   increment still reads correctly in lb */
function fmtInc(disp) { return String(Math.round(disp * 100) / 100); }

function openProgressionSheet(name, draft) {
  const pref = progressionPref(name);
  const u = wUnit();
  const perHand = perHandLift(name);
  const unitLabel = perHand ? `${u} per hand` : u;
  const hasLoad = exerciseHasLoad(name);
  const last = lastSessionSets(name);
  const lastKg = last && last.sets.length ? Math.max(...last.sets.map(s => s.weight || 0)) : 0;
  const autoInc = incrementW(name, lastKg > 0 ? toW(lastKg) : 0);
  const d = draft || {};
  const mode = d.mode || (pref.incKg ? 'custom' : 'auto');
  const holdOpen = d.holdOpen ?? !!pref.hold;

  let holdDefault = '';
  if (pref.hold) holdDefault = fmtW1(toW(pref.hold.kg));
  else if (lastKg > 0) holdDefault = fmtW1(toW(lastKg));
  else {
    const pr = nextTarget(name, findTargetFor(name));
    if (pr.w > 0) holdDefault = fmtW1(pr.w);
  }

  if (!hasLoad) {
    openModal(`
      <h3>${esc(name)}</h3>
      <div class="modal-sub">Progression settings</div>
      <p class="sheet-p">This exercise has no external load logged, so there is no weight to increase or hold. Peak progresses it by adding reps${isTimedLift(name) ? ' (seconds)' : ''} each session.</p>
      <p class="chart-note">Log a set with added weight and weight settings appear here.</p>
      <button class="btn mt" data-action="close-modal">Close</button>
    `);
    return;
  }

  openModal(`
    <h3>${esc(name)}</h3>
    <div class="modal-sub">Progression settings · weights in ${esc(unitLabel)}</div>

    <div class="sheet-h" id="pg-inc-h">When you hit every set</div>
    <div class="seg" id="pg-mode" role="radiogroup" aria-labelledby="pg-inc-h">
      <button data-v="auto" role="radio" aria-checked="${mode === 'auto'}" class="${mode === 'auto' ? 'on' : ''}" data-action="pg-mode">Automatic</button>
      <button data-v="custom" role="radio" aria-checked="${mode === 'custom'}" class="${mode === 'custom' ? 'on' : ''}" data-action="pg-mode">Custom increment</button>
    </div>
    ${mode === 'auto'
      ? `<p class="chart-note">Peak scales the jump to the load — about ${fmtInc(autoInc)} ${esc(unitLabel)} at your current weight.</p>`
      : `<label for="pg-inc">Add this much each time (${esc(unitLabel)})</label>
         <input id="pg-inc" type="number" inputmode="decimal" step="any" min="0" value="${pref.incKg ? fmtInc(toW(pref.incKg)) : ''}" placeholder="e.g. ${isMetric() ? '1.25' : '2.5'}">
         <p class="chart-note">${perHand ? 'Per hand, the same number you log for each dumbbell.' : 'Total load, the same number you log.'} Used exactly — never rounded to plate steps; the plate indicator shows when a weight can't be loaded exactly.</p>`}

    <div class="sheet-h">Keep my weight</div>
    ${holdOpen ? `
      <label for="pg-hold">Hold every working set at (${esc(unitLabel)})</label>
      <input id="pg-hold" type="number" inputmode="decimal" step="any" min="0" value="${esc(d.holdVal ?? holdDefault)}" placeholder="weight">
      <p class="chart-note">${pref.hold ? `Held since ${esc(pref.hold.since ? prettyDate(pref.hold.since) : 'earlier')}. ` : ''}No increases or deloads until you resume. Records and plateau watch keep running.${App.activeSession ? ' Saving updates this workout\'s untouched sets only — anything you completed or edited stays as it is.' : ''}</p>
      ${pref.hold
        ? `<button class="btn mt" data-action="pg-resume" data-name="${esc(name)}">Resume progression</button>
           <p class="chart-note">Takes effect from your next workout.</p>`
        : `<button class="btn ghost small mt" data-action="pg-hold-cancel" data-name="${esc(name)}">Don't hold</button>`}`
    : `<p class="chart-note">Stay at one load for a while — a new movement pattern, an injury, a cut — without Peak pushing you up.</p>
       <button class="btn mt" data-action="pg-hold-open" data-name="${esc(name)}">Keep my weight</button>`}

    <button class="btn accent big mt" data-action="pg-save" data-name="${esc(name)}">Save settings</button>
    <button class="btn ghost mt" data-action="close-modal">Cancel</button>
  `);
  const dlg = document.querySelector('#modal-root .modal');
  if (dlg) { dlg.dataset.pgMode = mode; dlg.dataset.pgHold = holdOpen ? '1' : ''; }
}

/* redraw the sheet with a change, keeping whatever was already typed */
function progressionSheetDraft(name, change) {
  const dlg = document.querySelector('#modal-root .modal');
  const draft = {
    mode: dlg?.dataset.pgMode || 'auto',
    holdOpen: !!dlg?.dataset.pgHold,
    holdVal: document.getElementById('pg-hold')?.value
  };
  const typedInc = document.getElementById('pg-inc')?.value;
  Object.assign(draft, change);
  openProgressionSheet(name, draft);
  if (typedInc != null && document.getElementById('pg-inc')) document.getElementById('pg-inc').value = typedInc;
  const focusId = change.holdOpen ? 'pg-hold' : change.mode === 'custom' ? 'pg-inc' : null;
  if (focusId) document.getElementById(focusId)?.focus();
}

/* A hold saved mid-workout applies to sets that are still just the plan:
   not done, never edited, ordinary working sets. They stay unperformed and
   untouched, so an early finish still leaves them out of history. */
function applyHoldToSession(name, kg) {
  const s = App.activeSession;
  if (!s) return 0;
  const key = progKey(name);
  let n = 0;
  s.exercises.forEach(ex => {
    if (progKey(ex.name) !== key) return;
    ex.sets.forEach(st => {
      if (st.done || st.touched || (st.type || 'normal') !== 'normal') return;
      st.weight = kg;
      n++;
    });
  });
  if (n) persistSession();
  return n;
}

function saveProgressionSheet(name) {
  const dlg = document.querySelector('#modal-root .modal');
  if (!dlg) return;
  const pref = progressionPref(name);
  const patch = {};
  const u = wUnit();

  if ((dlg.dataset.pgMode || 'auto') === 'custom') {
    const inp = document.getElementById('pg-inc');
    const v = Number(inp?.value);
    if (!inp || inp.value === '' || !(v > 0)) { toast(`Enter an increment above 0 ${u}`); inp?.focus(); return; }
    // an unchanged field keeps the stored kg exactly — no drift from display rounding
    patch.incKg = pref.incKg && inp.value === inp.defaultValue ? pref.incKg : fromW(v);
  } else {
    patch.incKg = null;
  }

  let holdKg = null, holdChanged = false;
  if (dlg.dataset.pgHold) {
    const inp = document.getElementById('pg-hold');
    const v = Number(inp?.value);
    if (!inp || inp.value === '' || !(v > 0)) { toast(`Enter the weight to keep, above 0 ${u}`); inp?.focus(); return; }
    holdKg = pref.hold && inp.value === fmtW1(toW(pref.hold.kg)) ? pref.hold.kg : fromW(v);
    holdChanged = !pref.hold || Math.abs(pref.hold.kg - holdKg) > 1e-9;
    patch.hold = { kg: holdKg, since: pref.hold && !holdChanged ? pref.hold.since : todayKey() };
  } else {
    patch.hold = null;
  }

  setProgressionPref(name, patch);
  const updated = holdKg && holdChanged ? applyHoldToSession(name, holdKg) : 0;
  closeModal();
  App.render();
  const msg = holdKg
    ? `Keeping ${fmtW1(toW(holdKg))} ${u} on ${name}${updated ? ` — ${updated} planned set${updated !== 1 ? 's' : ''} updated` : ''}`
    : patch.incKg ? `${name}: +${fmtInc(toW(patch.incKg))} ${u} when you hit every set` : `${name}: automatic progression`;
  toast(msg);
  announce(msg);
}

function resumeProgression(name) {
  setProgressionPref(name, { hold: null });
  closeModal();
  App.render();
  toast(`${name}: progression resumes next workout`);
  announce(`${name}: progression resumes next workout`);
}

/* ---------- progress / volume engine ----------
   "Weight moved" = external load only (sets × reps × weight, doubled for
   per-hand work). Bodyweight contributes 0 so the number stays honest. */

function sessionVolumeKg(s) {
  if (s.cardio) return 0;
  return (s.exercises || []).reduce((v, e) =>
    v + workingSets(e.sets).reduce((x, st) => x + setLoadKg(e.name, st) * (st.reps || 0), 0), 0);
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
/* returns display-unit values */
function weeklyVolumeSeries(weeks) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let sum = 0;
    getWorkouts().forEach(s => {
      const d = daysBetween(s.date, todayKey());
      if (d >= w * 7 && d < (w + 1) * 7) sum += sessionVolumeKg(s);
    });
    out.push(toW(sum));
  }
  return out;
}
function sessionsInDays(days, liftsOnly) {
  return getWorkouts().filter(s => {
    const d = daysBetween(s.date, todayKey());
    return d >= 0 && d < days && (!liftsOnly || !s.cardio);
  }).length;
}
/* consecutive weeks meeting (planned − 1) LIFTING sessions; the current partial
   week counts only if it already qualifies. Cardio is tracked but never stands
   in for a lift, or five walks would keep a lifting streak alive. */
function weekStreak(target) {
  const bar = Math.max(1, target - 1);
  let streak = 0;
  for (let w = 0; w < 104; w++) {
    let n = 0;
    getWorkouts().forEach(s => {
      if (s.cardio) return;
      const d = daysBetween(s.date, todayKey());
      if (d >= w * 7 && d < (w + 1) * 7) n++;
    });
    if (n >= bar) streak++;
    else if (w === 0) continue;   // this week is still in progress
    else break;
  }
  return streak;
}
function fmtVol(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e5) return Math.round(v / 1000) + 'k';
  if (v >= 1e4) return (v / 1000).toFixed(1) + 'k';
  return Math.round(v).toLocaleString();
}
/* kg in → formatted display-unit string */
function fmtWt(kg) { return fmtVol(toW(kg)); }
function volumeMilestones() {
  return isMetric()
    ? [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 5e6]
    : [25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 5e6, 10e6];
}

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
      name: n, best, bestDisp: Math.round(toW(best)), sessions: hist.length, hist,
      deltaDisp: oldBest ? Math.round(toW(best - oldBest)) : null
    };
  }).filter(Boolean).sort((a, b) => b.best - a.best).slice(0, limit || 6);
}

/* The headline "top lift" ranked by absolute load always crowned the leg press,
   which says nothing. Restrict the hero number to the lifts people actually
   measure themselves by. */
const CORE_LIFTS = /^(back squat|squat|front squat|bench press|incline bench press|deadlift|romanian deadlift|overhead press|barbell row|weighted pull-?up)$/i;
function topCoreLift() {
  return prBoard(60).find(r => CORE_LIFTS.test(r.name.trim())) || null;
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

const CUE = { add_weight: '▲', add_reps: '→', deload: '▼', baseline: '●', hold: '=' };
function cueColor(type) {
  return type === 'add_weight' ? 'var(--good)' : type === 'deload' ? 'var(--warning)' : 'var(--ink-2)';
}

/* ---------- session persistence ----------
   An in-progress workout used to live only in App.activeSession, so a reload or
   an OS purge between sets took the whole session — PRs included — with no
   warning. Every mutation now mirrors it to storage. */
const ACTIVE_KEY = 'activeSession', REST_KEY = 'restState';
function persistSession() {
  if (App.activeSession) Store.set(ACTIVE_KEY, App.activeSession); else Store.remove(ACTIVE_KEY);
  if (App.rest) Store.set(REST_KEY, App.rest); else Store.remove(REST_KEY);
}
function restoreSession() {
  const s = Store.get(ACTIVE_KEY, null);
  if (!s || !Array.isArray(s.exercises)) return null;
  // sessions saved before exercise ids existed get them now; focus falls back
  // to the first unfinished exercise when it is missing or stale
  ensureSessionIds(s);
  App.activeSession = s;
  Store.set(ACTIVE_KEY, s);
  const r = Store.get(REST_KEY, null);
  if (r && r.endsAt > Date.now()) App.rest = r;   // endsAt is absolute, so it just resumes
  return s;
}
function clearPersistedSession() { Store.remove(ACTIVE_KEY); Store.remove(REST_KEY); }

/* ---------- render ---------- */
/* The Train tab is a dashboard with drill-ins, not one long scroll:
   home answers "what am I doing today, and am I progressing?" in a glance;
   everything analytical lives one tap deeper. */
function renderTrain() {
  if (App.activeSession) return renderActiveSession();
  const view = App.trainView || 'home';
  if (view === 'routine') return renderRoutineEditor();
  return view === 'home' ? renderTrainHome() : renderTrainSub(view);
}

const TRAIN_SUBVIEWS = {
  moved: { title: 'Weight moved', sub: 'every pound you have lifted' },
  muscles: { title: 'Weekly sets by muscle', sub: 'volume distribution vs effective ranges' },
  records: { title: 'Personal records', sub: 'your best on every lift' },
  consistency: { title: 'Consistency', sub: 'showing up, week after week' },
  history: { title: 'Session history', sub: 'everything you have logged' }
};

function renderTrainSub(view) {
  const p = getProfile();
  const all = getWorkouts();
  let body = '';
  switch (view) {
    case 'moved': body = renderVolumeCard(all); break;
    case 'muscles': body = renderMuscleVolumeCard(all) || emptyNote('Log a lifting session and your muscle volume shows up here.'); break;
    case 'records': body = renderRecordsCard(24) || emptyNote('Records appear once you have logged a weighted lift.'); break;
    case 'consistency': body = renderConsistencyCard(p, all) || emptyNote('Your training calendar starts with your first session.'); break;
    case 'history': body = renderRecentCard(all, 40); break;
  }
  const meta = TRAIN_SUBVIEWS[view] || { title: '', sub: '' };
  return navHeader(meta.title, meta.sub, 'train-back') + body;
}

/* Same-day, forward-looking — "you slept badly, ease off today" — distinct
   from sleep.js's renderSleepTrainingLink(), which is a retrospective stat
   over many sessions. This only needs last night. */
function renderLowSleepNudge() {
  const last = sleepAvgDays(1);
  /* The threshold lives in sleep.js's SLEEP_BANDS with every other definition
     of a bad night. sleep.js loads after this file; the reference resolves at
     call time, same as sleepAvgDays right above it. */
  if (last.nights === 0 || last.avgMin >= SLEEP_BANDS.severe) return '';
  const hrs = (last.avgMin / 60).toFixed(1);
  return `<div class="alert" style="border-left-color:var(--warning)"><span class="a-ico">☾</span><div class="a-body">
    <b>${hrs}h of sleep last night.</b>
    Consider trimming today's volume ~10% or treating it as a lighter day — recovery drives the numbers as much as the sets do.</div></div>`;
}

function renderTrainHome() {
  const p = getProfile();
  const tpl = activeRoutine();
  const nextIdx = nextDayIndex();
  const plateaus = detectPlateaus();
  const stalledNames = new Set(plateaus.map(pl => pl.name.toLowerCase()));
  /* The queued day unless you've picked another. Switching days used to mean
     opening a collapsed section, choosing from a <select> and pressing a second
     Start — three taps and a hidden control for something people do weekly. */
  const dayIdx = (App.trainDay != null && tpl.days[App.trainDay]) ? App.trainDay : nextIdx;
  const day = tpl.days[dayIdx];
  const all = getWorkouts();

  const weekKg = volumeInDays(7);
  const lifeKg = lifetimeVolumeKg();
  const wkLifts = sessionsInDays(7, true);
  const wkCardio = sessionsInDays(7) - wkLifts;
  const streak = weekStreak(p.gymDays);
  const topPr = topCoreLift();

  // muscle-volume summary for the nav row
  const mv = muscleSetsInDays(7);
  const low = MUSCLES.filter(m => mv.sets[m] < MUSCLE_LANDMARKS[m][0]).length;
  const hasLifts = all.some(s => !s.cardio);

  const quip = volumeQuip(lifeKg, weekKg);
  if (quip && quip.fresh) { setTimeout(() => { toast(quip.text); settleQuip(); }, 400); }

  return `
  ${renderLowSleepNudge()}
  ${renderTodaysSession(tpl, day, dayIdx, nextIdx, stalledNames, plateaus)}

  ${renderCoachCard()}

  <div class="grid-2">
    <button class="btn" data-action="start-freestyle">✎ Freestyle session</button>
    <button class="btn" data-action="open-cardio">🏃 Log cardio</button>
  </div>
  <div class="chart-note center" style="margin-bottom:14px">Freestyle logs anything off-plan. Cardio is tracked separately and never fills a lifting slot.</div>

  <div class="card">
    <h2>Your training <span class="h2-right">tap any row</span></h2>
    ${navRow('train-nav', 'history', '📜', 'Session history', all.length ? `${all.length} logged` : 'nothing yet')}
    ${navRow('train-nav', 'routine', '✎', 'Edit your routine',
      `${tpl.days.length} days${isCustomRoutine() ? ' · yours' : ' · standard'}`)}
    ${navRow('train-nav', 'muscles', '💪', 'Weekly sets by muscle',
      !hasLifts ? 'no data yet' : mv.unclassified.length ? `${mv.unclassified.length} lift${mv.unclassified.length > 1 ? 's' : ''} to tag` : low ? `${low} below range` : 'all in range',
      !hasLifts ? '' : (mv.unclassified.length || low) ? 'warn' : 'good')}
    ${navRow('train-nav', 'moved', '🏋', 'Weight moved', weekKg > 0 ? `${fmtWt(weekKg)} ${wUnit()} this week` : 'starts with set one')}
    ${navRow('train-nav', 'records', '🏆', 'Personal records', topPr ? `${topPr.name} ${topPr.bestDisp} ${wUnit()}` : 'none yet')}
    ${navRow('train-nav', 'consistency', '📅', 'Consistency',
      `${wkLifts}/${p.gymDays} this week${streak ? ` · ${streak}-week streak` : ''}`)}
    ${wkCardio ? `<div class="chart-note">Plus ${wkCardio} cardio session${wkCardio > 1 ? 's' : ''} this week.</div>` : ''}
    ${quip ? `<div class="quip ${quip.fresh ? 'fresh' : ''}" style="margin:12px 0 0">${esc(quip.text)}</div>` : ''}
  </div>`;
}

/* ---------- 1. the hero: what to do today ----------
   The selected day, what's in it, and Start — in that order, and nothing else
   competing. The reasoning behind the numbers (cue legend, plateau calls) is one
   tap away under "Why these targets?", and each lift's own explanation opens
   from its row. */

const CUE_LEGEND = {
  add_weight: 'go up',
  add_reps: 'same weight, chase the reps',
  deload: 'drop back and rebuild',
  baseline: 'new lift — set a baseline',
  hold: 'weight held — progression paused'
};

/* planned sets and a rough duration for a routine day */
function dayPlanStats(day) {
  const sets = day.ex.reduce((n, [, t]) => n + (parseTarget(t)?.sets || 3), 0);
  return { sets, estMin: Math.max(20, Math.round(sets * 2.6 / 5) * 5) };
}

/* "185 lb × 5", "12 reps", "pick a weight" for a prescription */
function prescriptionValue(name, pr) {
  const u = wUnit();
  const timed = isTimedLift(name);
  if (pr.w > 0) return `${fmtW1(pr.w)}<span class="unit"> ${perHandLift(name) ? u + '/hand' : u} × ${pr.reps}${timed ? 's' : ''}</span>`;
  if (pr.w === 0) return `${pr.reps}<span class="unit"> ${timed ? 'sec' : 'reps'}</span>`;
  return '<span class="unit">pick a weight</span>';
}

function renderPlateauNotes(plateaus, stalledNames) {
  if (!plateaus.length) return plateauWatchRow();
  return plateaus.map(pl => {
    const dl = nextTarget(pl.name, findTargetFor(pl.name), stalledNames);
    if (dl.type === 'hold') {
      return `
      <div class="alert">
        <span class="a-ico">❚❚</span>
        <div class="a-body"><b>Plateau: ${esc(pl.name)} — progression paused</b>
        No PR in ${pl.sessions} sessions (${pl.days} days). You're keeping ${esc(fmtW1(dl.w))} ${wUnit()}, so Peak won't deload it — resume progression when you want the fix.</div>
      </div>`;
    }
    /* The prescription is always concrete, so lead with it. A generic tip only
       earns space when the prescription is "hold and finish the sets", which on
       its own doesn't tell you how to break out. Never show a tip that can
       contradict the plan row — "drop the weight 10%" beside "▲ go up to 165"
       is the app arguing with itself. */
    const body = dl.type === 'add_reps' && !dl.rebuilding ? `${dl.text} ${pl.tip}` : dl.text;
    const heading = dl.rebuilding
      ? `${esc(pl.name)} — climbing back after a deload`
      : dl.type === 'add_weight'
        ? `${esc(pl.name)} — ${pl.sessions} sessions at the same weight`
        : `Plateau: ${esc(pl.name)} — no PR in ${pl.sessions} sessions (${pl.days} days)`;
    return `
    <div class="alert">
      <span class="a-ico">${dl.rebuilding || dl.type === 'add_weight' ? '▲' : '⚠'}</span>
      <div class="a-body"><b>${heading}</b>
      ${esc(body)}${esc(plateauVolumeNote(pl.name))}</div>
    </div>`;
  }).join('');
}

function renderTodaysSession(tpl, day, dayIdx, nextIdx, stalledNames, plateaus = []) {
  const { sets: plannedSets, estMin } = dayPlanStats(day);
  const isNext = dayIdx === nextIdx;
  const prescriptions = day.ex.map(([n, tstr]) => [n, tstr, nextTarget(n, tstr, stalledNames)]);
  const cuesUsed = [...new Set(prescriptions.map(([, , pr]) => pr.type))];
  const flagged = plateaus.filter(pl => day.ex.some(([n]) => n.toLowerCase() === pl.name.toLowerCase())).length;

  return `
  <section class="card hero-card" aria-labelledby="train-day-title">
    <div class="eyebrow">${isNext ? 'Up next' : 'Training instead'} · ${esc(tpl.name)}</div>
    <h2 class="hero-title" id="train-day-title">${esc(day.name)}</h2>
    <div class="hero-meta">${day.ex.length} exercise${day.ex.length !== 1 ? 's' : ''} · ${plannedSets} sets · ~${estMin} min</div>

    <div class="day-chips" role="group" aria-label="Choose which day to train">
      ${tpl.days.map((d, i) => `
        <button class="day-chip ${i === dayIdx ? 'on' : ''}" data-action="pick-day" data-idx="${i}"
          aria-pressed="${i === dayIdx}">${esc(d.name)}${i === nextIdx ? '<span class="dc-next">next</span>' : ''}</button>`).join('')}
    </div>

    ${day.ex.length ? `
    <ul class="plan" aria-label="Exercises in ${esc(day.name)}">
      ${prescriptions.map(([n, tstr, pr]) => {
        const note = pr.type === 'deload' ? 'deload' : pr.type === 'hold' ? 'paused' : pr.rebuilding ? 'climbing back' : '';
        // what to actually put on the bar, so the number above isn't homework
        const spec = pr.w > 0 ? loadSpec(n) : null;
        const m = spec ? plateMath(pr.w, spec.baseDisp, spec.sides) : null;
        const plates = m && m.list.length ? plateSummary(m, spec) : '';
        return `
        <li><button class="plan-row" data-action="why-target" data-name="${esc(n)}" data-target="${esc(tstr)}"
          aria-label="${esc(n)}: ${esc(cueHeadline(n, pr))}. Why this target?">
          <span class="pl-cue" style="color:${cueColor(pr.type)}" aria-hidden="true">${CUE[pr.type] || '→'}</span>
          <span class="pl-name">
            <span class="pl-nm">${esc(n)}${note ? ` <span class="pl-note">${esc(note)}</span>` : ''}</span>
            ${plates ? `<span class="pl-plates">${esc(plates)}</span>` : `<span class="pl-plates">${esc(tstr)}</span>`}</span>
          <span class="pl-val">${prescriptionValue(n, pr)}</span>
          <span class="pl-chev" aria-hidden="true">${icon('chevron')}</span>
        </button></li>`;
      }).join('')}
    </ul>
    <details class="why">
      <summary>Why these targets?${flagged ? ` <span class="pill warn">${flagged} flagged</span>` : ''}</summary>
      <div class="why-body">
        <div class="cue-key">
          ${cuesUsed.map(t => `<span><b style="color:${cueColor(t)}">${CUE[t] || '→'}</b> ${esc(CUE_LEGEND[t] || '')}</span>`).join('')}
        </div>
        <p class="chart-note">Tap any exercise for its own explanation and progression settings.</p>
        <div class="mt">${renderPlateauNotes(plateaus, stalledNames)}</div>
      </div>
    </details>
    <button class="btn accent big mt" data-action="start-workout" data-idx="${dayIdx}">${icon('play')} Start ${esc(day.name)}</button>`
    : `
    <div class="empty-inline">
      <b>No exercises in ${esc(day.name)} yet.</b>
      <span class="muted">Add some to this day, or log a freestyle session instead.</span>
    </div>
    <button class="btn accent big mt" data-action="routine-edit-day" data-idx="${dayIdx}">${icon('plus')} Add exercises to ${esc(day.name)}</button>`}
  </section>`;
}

/* ---------- 2. weight moved: the number that only goes up ---------- */
function renderVolumeCard(all) {
  const lifeKg = lifetimeVolumeKg();
  const u = wUnit();
  if (lifeKg <= 0) {
    return `
    <div class="card">
      <h2>Weight moved</h2>
      <div class="muted small">Log your first session and this starts counting — every ${u}, every set, for as long as you use Peak.</div>
    </div>`;
  }
  const lifeDisp = toW(lifeKg);
  const tiles = [
    ['today', volumeInDays(1)],
    ['7 days', volumeInDays(7)],
    ['30 days', volumeInDays(30)],
    ['this year', volumeInDays(365)]
  ];
  const series = weeklyVolumeSeries(8);
  const showTrend = series.filter(v => v > 0).length >= 2;
  const next = volumeMilestones().find(m => m > lifeDisp);
  const sets = all.reduce((n, s) => n + (s.exercises || []).reduce((x, e) => x + workingSets(e.sets).length, 0), 0);
  const quip = volumeQuip(lifeKg, volumeInDays(7));
  if (quip && quip.fresh) { setTimeout(() => { toast(quip.text); settleQuip(); }, 400); }
  return `
  <div class="card">
    <h2>Weight moved <span class="h2-right">${u} lifted</span></h2>
    ${quip ? `<div class="quip ${quip.fresh ? 'fresh' : ''}">${esc(quip.text)}</div>` : ''}
    <div class="grid-4">
      ${tiles.map(([label, kg]) => `
        <div class="stat"><div class="sv">${kg > 0 ? fmtWt(kg) : '—'}</div><div class="sl">${label}</div></div>`).join('')}
    </div>
    ${showTrend ? `
      <div class="spread mt">
        <span class="muted small">Weekly volume, last 8 weeks</span>
        ${sparkline(series, { color: CHART.orange, w: 150, h: 38, fmt: v => fmtVol(v) })}
      </div>` : ''}
    <div class="mt" style="border-top:1px solid var(--grid);padding-top:10px">
      <div class="spread">
        <span class="muted small">Lifetime</span>
        <b>${fmtWt(lifeKg)} ${u}</b>
      </div>
      <div class="spread" style="margin-top:4px">
        <span class="muted small">Sessions · sets</span>
        <span class="small">${all.length} · ${sets}</span>
      </div>
      ${next ? `<div class="chart-note mt">${fmtVol(next - lifeDisp)} ${u} to go until you've moved ${fmtVol(next)} ${u}.</div>` : ''}
      <div class="chart-note">Dumbbell and single-arm lifts are logged per hand and counted for both.</div>
    </div>
  </div>`;
}

/* ---------- 2b. weekly sets per muscle ---------- */
function renderMuscleVolumeCard(all) {
  if (!all.filter(s => !s.cardio).length) return '';
  const { sets: t, unclassified } = muscleSetsInDays(7);
  const rows = MUSCLES.map(m => {
    const [mev, mrv] = MUSCLE_LANDMARKS[m];
    const v = Math.round(t[m] * 2) / 2;
    return { m, v, mev, mrv, state: v < mev ? 'under' : v > mrv ? 'over' : 'in' };
  });
  const under = rows.filter(r => r.state === 'under');
  const over = rows.filter(r => r.state === 'over');
  // problems first, then heaviest-trained
  const order = [...rows].sort((a, b) =>
    (a.state === 'under' ? -1 : 0) - (b.state === 'under' ? -1 : 0) || b.v - a.v);

  const headline = under.length
    ? `<span style="color:var(--warning)">${under.length} muscle${under.length > 1 ? 's' : ''} below effective volume</span>`
    : over.length ? `<span style="color:var(--critical)">${over.length} above recoverable volume</span>`
    : `<span style="color:${CHART.good}">Every muscle in range</span>`;

  return `
  ${unclassified.length ? `
  <div class="alert" style="border-left-color:var(--warning)">
    <span class="a-ico">?</span>
    <div class="a-body"><b>${unclassified.length} lift${unclassified.length > 1 ? 's' : ''} not counted yet</b>
    Peak doesn't know which muscles these train, so their sets are missing from the numbers below — and volume advice stays switched off until they're tagged.
    <div class="mt">${unclassified.map(x => `
      <button class="btn small mt" data-action="tag-muscle" data-name="${esc(x.name)}" style="width:100%;text-align:left">
        Tag ${esc(x.name)} <span class="muted">· ${x.sets} set${x.sets !== 1 ? 's' : ''} this week</span></button>`).join('')}
    </div></div>
  </div>` : ''}
  <div class="card">
    <h2>Weekly sets per muscle <span class="h2-right">last 7 days</span></h2>
    <div class="small" style="margin-bottom:12px">${headline}</div>
    ${order.map(r => {
      const color = r.state === 'under' ? CHART.warning : r.state === 'over' ? CHART.critical : CHART.aqua;
      const pct = Math.min(r.v / r.mrv * 100, 100);
      return `
      <div class="mv-row">
        <div class="macro-head">
          <span class="name">${MUSCLE_LABEL[r.m]}</span>
          <span class="val" style="color:${r.state === 'in' ? 'var(--ink-2)' : color}">${r.v} <span class="muted">/ ${r.mev}–${r.mrv}</span></span>
        </div>
        <div class="bar-track mv-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
          <div class="mv-mev" style="left:${Math.min(r.mev / r.mrv * 100, 99)}%" title="minimum effective volume"></div>
        </div>
      </div>`;
    }).join('')}
    <div class="chart-note">Bar fills toward your max recoverable volume; the tick marks the effective minimum. Secondary movers count as half a set. Ranges are general guidance for a trained lifter — adjust to how you actually recover.</div>
  </div>`;
}

/* teach Peak what an unrecognised lift trains */
function openTagMuscleModal(name) {
  const cur = musclesFor(name);
  openModal(`
    <h3>What does ${esc(name)} train?</h3>
    <div class="modal-sub">Peak counts primary movers as a full set and secondary movers as half. This is remembered for every future session.</div>
    <label>Primary movers</label>
    <div class="mus-grid" id="tm-primary">
      ${MUSCLES.map(m => `<button data-m="${m}" class="${cur.p.includes(m) ? 'on' : ''}">${MUSCLE_LABEL[m]}</button>`).join('')}
    </div>
    <label>Secondary movers (optional)</label>
    <div class="mus-grid" id="tm-secondary">
      ${MUSCLES.map(m => `<button data-m="${m}" class="${cur.s.includes(m) ? 'on' : ''}">${MUSCLE_LABEL[m]}</button>`).join('')}
    </div>
    <button class="btn primary mt" data-action="save-muscle-tag" data-name="${esc(name)}">Save</button>
  `);
}
function saveMuscleTag(name) {
  const pick = id => [...document.querySelectorAll(`#${id} button.on`)].map(b => b.dataset.m);
  const p = pick('tm-primary'), s = pick('tm-secondary').filter(m => !p.includes(m));
  if (!p.length) { toast('Pick at least one primary muscle'); return; }
  setMuscleOverride(name, p, s);
  closeModal(); toast(`${name} tagged`); App.render();
}

/* ---------- 3. consistency: showing up ---------- */
function renderConsistencyCard(p, all) {
  if (!all.length) return '';
  const wk = sessionsInDays(7, true), mo = sessionsInDays(30, true);
  const wkC = sessionsInDays(7) - wk, moC = sessionsInDays(30) - mo;
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
      <div class="stat"><div class="sv">${wk}</div><div class="sl">lifts this week</div></div>
      <div class="stat"><div class="sv">${p.gymDays}</div><div class="sl">planned</div></div>
      <div class="stat"><div class="sv">${mo}</div><div class="sl">lifts / 30d</div></div>
      <div class="stat"><div class="sv">${streak}</div><div class="sl">week streak</div></div>
    </div>
    <div class="chart-note">${wkC} cardio this week, ${moC} in 30 days. Cardio is counted separately — it never fills a lifting slot.</div>
  </div>`;
}

/* ---------- 4. records: the trophy case ---------- */
function renderRecordsCard(limit) {
  const prs = prBoard(limit || 6);
  if (!prs.length) return '';
  const u = wUnit();
  return `
  <div class="card">
    <h2>Personal records <span class="h2-right">est. 1RM · vs 30 days ago</span></h2>
    ${prs.map(r => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(r.name)}${perHandLift(r.name) ? ' <span class="muted small">per hand</span>' : ''}</div>
          <div class="li-sub">${r.sessions} session${r.sessions !== 1 ? 's' : ''}${
            r.deltaDisp != null ? ` · <span style="color:${r.deltaDisp > 0 ? CHART.good : 'var(--muted)'}">${r.deltaDisp > 0 ? '+' + r.deltaDisp + ' ' + u : 'holding'}</span>` : ''}</div>
        </div>
        ${r.hist.length >= 2 ? sparkline(r.hist.map(h => toW(h.bestE1rm)), { markers: prIndexes(r.hist), color: CHART.blue, w: 108, h: 34 }) : ''}
        <div class="li-val">${r.bestDisp}<span class="unit"> ${u}</span></div>
      </div>`).join('')}
  </div>`;
}

/* ---------- 5. history ---------- */
function renderRecentCard(all, limit) {
  const recent = all.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, limit || 5);
  if (!recent.length) {
    return `<div class="card"><h2>Recent sessions</h2>
      <div class="muted center" style="padding:10px 0">No sessions yet. Your first one sets the baseline.</div></div>`;
  }
  const u = wUnit();
  return `
  <div class="card">
    <h2>Recent sessions</h2>
    ${recent.map(s => {
      const scoreChip = s.score != null ? `<span class="pill ${s.score >= 75 ? 'good' : s.score >= 50 ? 'warn' : ''}">${esc(s.score)}</span>` : '';
      const sub = s.cardio
        ? `${prettyDate(s.date)} · ${esc(s.durationMin)} min ${esc(s.intensity)} · ~${esc(s.kcalEst)} kcal`
        : `${prettyDate(s.date)} · ${(s.exercises || []).reduce((n, e) => n + workingSets(e.sets).length, 0)} sets · ${fmtWt(sessionVolumeKg(s))} ${u}`;
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
  if (App.activeSession) { App.render(); return; }   // a double tap on Start must not replace a live session
  const p = getProfile();
  const tpl = activeRoutine();
  const day = freestyle ? null : (tpl.days[dayIdx] || tpl.days[0]);
  const stalled = new Set(detectPlateaus().map(x => x.name.toLowerCase()));
  App.activeSession = {
    id: 'w' + Date.now(),
    date: todayKey(),
    startedAt: Date.now(),
    template: p.template,
    dayName: freestyle ? 'Freestyle' : day.name,
    freestyle,
    exercises: freestyle ? [] : day.ex.map(([name, target]) => ({ uid: newExerciseUid(), name, target, sets: plannedSetsFor(name, target, stalled) }))
  };
  ensureSessionIds(App.activeSession);
  App.setSel = null;
  persistSession();
  App.render();
  announce(`${App.activeSession.dayName} started${App.activeSession.exercises[0] ? ` — ${App.activeSession.exercises[0].name} is open` : ''}`);
}

/* The prescription is already known, so build its rows up front. Creating them
   by hand was 20 taps before a single number could be entered. These rows are a
   plan, not a record: planned and untouched until you complete or edit them. */
function plannedSetsFor(name, target, stalled) {
  const t = parseTarget(target) || { sets: 3, reps: 8 };
  const pr = nextTarget(name, target, stalled);
  const sets = [];
  for (let i = 0; i < t.sets; i++) {
    sets.push({
      weight: pr.w > 0 ? (pr.wKg ?? fromW(pr.w)) : null,
      reps: pr.reps ?? t.reps,
      type: 'normal', done: false, planned: true
    });
  }
  return sets;
}

/* ---------- in-gym helpers ---------- */

const SET_TYPES = ['normal', 'warmup', 'failure', 'drop'];
const SET_BADGE = { normal: null, warmup: 'W', failure: 'F', drop: 'D' };
const SET_BADGE_COLOR = { warmup: 'var(--warning)', failure: 'var(--critical)', drop: 'var(--violet)' };

/* ---------- plate math ----------
   "What do I load?" is arithmetic nobody should be doing between sets, and it is
   different arithmetic per machine: a barbell has two sleeves and weighs
   something, a leg press has two pegs and a sled whose weight isn't part of what
   you log, a T-bar has one post and takes the whole load on it. Printing the
   wrong answer is worse than printing none, so anything unrecognised shows
   nothing until it's taught — same contract as the muscle map. */

const PLATE_SIZES = { metric: [25, 20, 15, 10, 5, 2.5, 1.25], imperial: [45, 35, 25, 10, 5, 2.5] };
/* IWF colours for kg, the matching convention for lb — a plate reads faster as a
   colour than as a number, which is the entire point of showing this at all */
const PLATE_COLOR = {
  metric: { 25: '#d03b3b', 20: '#3987e5', 15: '#fab219', 10: '#199e70', 5: '#e6e6e2', 2.5: '#9a4b4b', 1.25: '#8f8f8c' },
  imperial: { 45: '#3987e5', 35: '#fab219', 25: '#199e70', 10: '#e6e6e2', 5: '#7a7a78', 2.5: '#5c5c5a' }
};
const DARK_PLATES = /^(#e6e6e2|#fab219|#8f8f8c)$/;   // need dark text on them

const LOAD_RULES = [
  /* one loading post: the whole load goes on a single end */
  { re: /t.?bar row|landmine/i, kind: 'post' },
  /* plate-loaded machines: two pegs, nothing to subtract — the sled's own weight
     varies by machine and isn't what you logged */
  { re: /leg press|hack squat|pendulum squat|belt squat|plate.?loaded|iso.?lateral/i, kind: 'sled' },
  /* nothing to load. Smith machines are deliberately here: their bar weighs
     anywhere from 6 to 25 kg depending on the counterweight, so any number shown
     would be wrong on most of them. */
  { re: /dumbbell|\bdb\b|kettlebell|goblet|cable|pulldown|pushdown|smith|leg curl|leg extension|pec deck|\bfly\b|flye|lateral raise|face pull|rear delt|pull.?up|chin.?up|\bdip\b|push.?up|plank|crunch|sit.?up|leg raise|knee raise|rollout|machine|band/i, kind: null },
  /* loaded on an Olympic bar */
  { re: /squat|bench|deadlift|overhead press|military|barbell|\brow\b|hip thrust|shrug|good morning|\brdl\b|romanian|clean|snatch|press/i, kind: 'bar' }
];

/* User-taught loading wins over the patterns, because half the ambiguous cases
   are genuinely gym-specific — a chest-supported row is a barbell in one gym and
   a stack in the next, and only the person standing in front of it knows. */
function getLoadMap() { return Store.get('loadMap', {}); }
function setLoadOverride(name, kind) {
  const m = getLoadMap();
  if (kind === 'auto') delete m[String(name).toLowerCase()];
  else m[String(name).toLowerCase()] = kind;
  Store.set('loadMap', m);
}
function loadKind(name) {
  const o = getLoadMap()[String(name || '').toLowerCase()];
  if (o !== undefined) return o === 'none' ? null : o;
  for (const r of LOAD_RULES) if (r.re.test(name)) return r.kind;
  return null;
}
/* → {kind, sides, baseDisp, baseLabel} in display units, or null if this lift
   isn't plate-loaded at all */
function loadSpec(name) {
  const kind = loadKind(name);
  if (!kind) return null;
  const u = wUnit();
  if (kind === 'bar') {
    const bar = Math.round(toW(getSettings().barKg) * 10) / 10;
    return { kind, sides: 2, baseDisp: bar, baseLabel: `${bar} ${u} bar`, per: 'per side' };
  }
  if (kind === 'sled') return { kind, sides: 2, baseDisp: 0, baseLabel: '', per: 'per side' };
  return { kind, sides: 1, baseDisp: 0, baseLabel: '', per: 'on the post' };
}

/* plates for one side (or the one post) — null if the base alone already exceeds
   the target, which is a real answer: you cannot load 30 lb on a 45 lb bar */
function plateMath(totalDisp, baseDisp, sides) {
  const PLATES = PLATE_SIZES[isMetric() ? 'metric' : 'imperial'];
  let per = (totalDisp - baseDisp) / (sides || 2);
  if (per < -0.001) return null;
  const list = [];
  PLATES.forEach(p => { while (per >= p - 0.001) { list.push(p); per -= p; } });
  return { list, exact: per < 0.001, off: Math.round(per * (sides || 2) * 10) / 10 };
}

/* "2×45 + 10 per side" */
function plateSummary(m, spec) {
  const counts = [];
  let i = 0;
  while (i < m.list.length) {
    let j = i; while (j < m.list.length && m.list[j] === m.list[i]) j++;
    counts.push((j - i > 1 ? (j - i) + '×' : '') + m.list[i]);
    i = j;
  }
  return counts.join(' + ') + ' ' + spec.per;
}

/* The whole indicator: a row of plates drawn at relative size, then the same
   thing in words. Returns '' when there is nothing useful to say. */
function plateStack(name, totalDisp) {
  const spec = loadSpec(name);
  if (!spec || !(totalDisp > 0)) return '';
  const m = plateMath(totalDisp, spec.baseDisp, spec.sides);
  const u = wUnit();
  if (!m) return `<div class="plates"><span class="pl-none">${esc(spec.baseLabel || 'the machine')} alone is heavier than ${Math.round(totalDisp)} ${u}</span></div>`;
  if (!m.list.length) {
    return spec.baseLabel
      ? `<div class="plates"><span class="pl-none">just the ${esc(spec.baseLabel)} — no plates</span></div>`
      : '';
  }
  const colors = PLATE_COLOR[isMetric() ? 'metric' : 'imperial'];
  const biggest = PLATE_SIZES[isMetric() ? 'metric' : 'imperial'][0];
  const chips = m.list.map(p => {
    const c = colors[p] || '#8f8f8c';
    const h = Math.round(20 + 22 * Math.sqrt(p / biggest));
    return `<span class="pl-plate" style="height:${h}px;background:${c};color:${DARK_PLATES.test(c) ? '#1a1a19' : '#fff'}">${p}</span>`;
  }).join('');
  return `
    <div class="plates">
      <div class="pl-stack">
        ${spec.baseLabel ? `<span class="pl-base">${esc(spec.baseLabel)}</span>` : ''}
        ${chips}
      </div>
      <div class="pl-text">${esc(plateSummary(m, spec))} → ${Math.round(totalDisp)} ${u}${
        m.exact ? '' : ` <span style="color:var(--warning)">(${m.off} ${u} short — nearest you can load)</span>`}</div>
    </div>`;
}

/* teach Peak how a lift is loaded when the patterns get it wrong */
const LOAD_LABELS = {
  auto: 'Work it out from the name',
  bar: 'Olympic barbell — two sleeves, bar weight subtracted',
  sled: 'Plate-loaded machine — two pegs, no bar weight',
  post: 'Single post — every plate on one end',
  none: 'Not plate-loaded (dumbbell, cable, stack, bodyweight)'
};
function openLoadModal(name) {
  const cur = getLoadMap()[String(name).toLowerCase()];
  const auto = LOAD_RULES.find(r => r.re.test(name))?.kind ?? null;
  openModal(`
    <h3>How is ${esc(name)} loaded?</h3>
    <div class="modal-sub">This decides the plate numbers Peak shows you. Remembered for every future session.</div>
    ${Object.entries(LOAD_LABELS).map(([k, label]) => `
      <button class="btn mt" style="justify-content:flex-start;text-align:left;${(cur === undefined ? k === 'auto' : cur === k) ? 'border-color:var(--blue)' : ''}"
        data-action="save-load-kind" data-name="${esc(name)}" data-kind="${k}">
        ${esc(label)}${k === 'auto' ? ` <span class="muted">· currently ${esc(auto ? LOAD_LABELS[auto].split(' —')[0] : 'not plate-loaded')}</span>` : ''}
      </button>`).join('')}
    <div class="chart-note">Set your barbell's weight in Settings — plate math for barbell lifts subtracts it.</div>
  `);
}

/* rest timer — driven off a timestamp so throttled/background tabs stay accurate */
function suggestedRestSec(name) {
  const base = getSettings().restSec || 120;
  if (/squat|deadlift|bench|overhead press|row|hip thrust/i.test(name)) return Math.round(base * 1.5);
  if (/curl|raise|fly|pushdown|extension|calf|crunch|plank/i.test(name)) return Math.round(base * 0.6);
  return base;
}
function startRest(sec, label) {
  App.rest = { endsAt: Date.now() + sec * 1000, total: sec, label };
  persistSession();
  paintRest();
}
/* ---------- the bottom action dock ----------
   One place for the thing you do next: the rest countdown and "Complete set"
   share a single bar above the tab bar, so there is never a second rest bar and
   the main action is always under your thumb. It repaints every second, so it is
   only rebuilt when what it shows actually changes — otherwise a keyboard user
   sitting on "+30s" would lose focus once a second. */
let _dockKey = '';
function dockAction() {
  const s = App.activeSession;
  if (!s || App.tab !== 'train' || !getProfile()) return null;
  ensureSessionIds(s);
  if (!s.exercises.length) return { label: 'Add an exercise', action: 'add-exercise' };
  const live = sessionLiveStats();
  if (live.total > 0 && live.doneAll === live.total) return { label: 'Review & finish', action: 'review-finish' };
  const ex = focusedExercise();
  if (!ex.sets.length) return { label: 'Add a set', action: 'add-set', uid: ex.uid };
  const si = nextPendingSetIndex(ex);
  if (si < 0) {
    const next = sessionExercise(firstPendingFrom(s, exerciseIndex(ex.uid) + 1));
    return next ? { label: `Next: ${next.name}`, action: 'focus-ex', uid: next.uid } : { label: 'Review & finish', action: 'review-finish' };
  }
  const label = isWarmup(ex.sets[si]) ? 'Complete warmup' : `Complete set ${workingNumber(ex, si)} of ${workingCount(ex)}`;
  return { label, action: 'complete-set', uid: ex.uid, si };
}
function setDockHeight(px) {
  document.documentElement.style.setProperty('--dock-h', px + 'px');
}
function paintRest() {
  const root = document.getElementById('rest-root');
  if (!root) return;
  let left = null;
  if (App.rest) {
    left = Math.ceil((App.rest.endsAt - Date.now()) / 1000);
    if (left <= -2) { App.rest = null; persistSession(); left = null; }
  }
  const act = dockAction();
  document.body.classList.toggle('in-workout', !!act);
  if (!App.rest && !act) {
    if (_dockKey) { root.innerHTML = ''; _dockKey = ''; }
    setDockHeight(0);
    return;
  }
  const done = !!App.rest && left <= 0;
  if (done && !App.rest.beeped) {
    App.rest.beeped = true;
    restBeep();
    announce('Rest done');
  }
  const key = [App.rest ? 'rest' : '', done ? 'done' : '', App.rest?.label || '',
    act ? `${act.action}|${act.uid || ''}|${act.si ?? ''}|${act.label}` : ''].join('/');
  if (key !== _dockKey) {
    const hadFocus = root.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    root.innerHTML = `
    <div class="dock ${act ? '' : 'rest-only'}" role="region" aria-label="${act ? 'Workout controls' : 'Rest timer'}">
      ${App.rest ? `
      <div class="dock-rest ${done ? 'done' : ''}">
        <div class="rest-track" aria-hidden="true"><div class="rest-fill" data-rest-fill></div></div>
        <span class="rest-time" data-rest-time></span>
        <span class="rest-label">${done ? 'Rest done' : 'Rest'}${App.rest.label ? ` · ${esc(App.rest.label)}` : ''}</span>
        <button class="btn small ghost" data-action="rest-add" aria-label="Add 30 seconds of rest">+30s</button>
        <button class="btn small ghost" data-action="rest-skip">${done ? 'Dismiss' : 'Skip rest'}</button>
      </div>` : ''}
      ${act ? `
      <button class="btn accent dock-main" data-action="${act.action}"${act.uid ? ` data-uid="${act.uid}"` : ''}${act.si != null ? ` data-si="${act.si}"` : ''}>
        ${act.action === 'complete-set' || act.action === 'review-finish' ? icon('check') : act.action === 'focus-ex' ? icon('chevron') : icon('plus')}
        <span>${esc(act.label)}</span></button>` : ''}
    </div>`;
    _dockKey = key;
    if (hadFocus) {
      (root.querySelector(`[data-action="${hadFocus}"]`) || root.querySelector('.dock-main'))?.focus({ preventScroll: true });
    }
    setDockHeight(root.offsetHeight);
  }
  if (App.rest) {
    const pct = done ? 100 : Math.min(100, (1 - left / App.rest.total) * 100);
    const mm = Math.max(0, Math.floor(left / 60)), ss = Math.max(0, left % 60);
    const t = root.querySelector('[data-rest-time]');
    const f = root.querySelector('[data-rest-fill]');
    if (t) t.textContent = done ? 'Go' : `${mm}:${String(ss).padStart(2, '0')}`;
    if (f) f.style.width = pct + '%';
  }
}
function restBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      o.start(); o.stop(ctx.currentTime + 0.52);
      setTimeout(() => ctx.close().catch(() => {}), 800);
    }
  } catch { /* audio unavailable — silent */ }
  if (navigator.vibrate) { try { navigator.vibrate([140, 70, 140]); } catch {} }
}

/* live PR check the moment a working set is completed */
function checkSetPR(exName, st) {
  if (isWarmup(st) || !st.reps) return null;
  const s = App.activeSession;
  s.bestSeen = s.bestSeen || {};
  const hist = exerciseHistory(exName);
  const histBestE1rm = Math.max(0, ...hist.map(h => h.bestE1rm));
  const seen = s.bestSeen[exName] || { e1rm: 0, reps: 0, weight: 0 };
  const val = e1rm(st.weight, st.reps);

  let msg = null;
  if (val > 0 && val > histBestE1rm + 0.01 && val > seen.e1rm + 0.01 && histBestE1rm > 0) {
    msg = `🎉 ${exName} PR — ${Math.round(toW(val))} ${wUnit()} est. 1RM`;
  } else if (!st.weight) {
    const histBestReps = Math.max(0, ...hist.map(h => h.topSet?.reps || 0));
    if (st.reps > histBestReps && st.reps > seen.reps && histBestReps > 0) {
      msg = `🎉 ${exName} PR — ${st.reps} reps`;
    }
  }
  s.bestSeen[exName] = {
    e1rm: Math.max(seen.e1rm, val),
    reps: Math.max(seen.reps, st.reps || 0),
    weight: Math.max(seen.weight, st.weight || 0)
  };
  return msg;
}

function sessionLiveStats() {
  const s = App.activeSession;
  let sets = 0, volKg = 0, warm = 0, planned = 0, total = 0, doneAll = 0;
  s.exercises.forEach(ex => (ex.sets || []).forEach(st => {
    total++;
    if (st.done) doneAll++;
    if (!st.done) { if (!isWarmup(st)) planned++; return; }
    if (!st.reps) return;
    if (isWarmup(st)) { warm++; return; }
    sets++; volKg += setLoadKg(ex.name, st) * st.reps;
  }));
  return { sets, volKg, warm, remaining: planned, total, doneAll };
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60), ss = sec % 60;
  return (m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ':' + String(ss).padStart(2, '0'));
}

/* ---------- focused workout: which exercise is which ----------
   One exercise is open at a time, so "the open one" has to survive everything a
   session goes through: reordering, deleting, undo, a reload, and a routine that
   lists the same lift twice. An array index survives none of those — delete the
   second exercise and the index silently points at the third. Every exercise in
   a live session carries its own id instead, and focus is stored by that id.

   Both fields are optional additions to the stored session. A session saved by
   an older build simply has neither, and gets them on restore. */
function newExerciseUid() {
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function ensureSessionIds(s) {
  if (!s || !Array.isArray(s.exercises)) return s;
  const seen = new Set();
  s.exercises.forEach(ex => {
    /* Regenerate anything that isn't shaped like newExerciseUid()'s output, not
       just anything missing: uid goes straight into data-uid="..." at ~20 sites,
       and a session can arrive from a restored backup. See szUid in store.js. */
    if (!/^x[a-z0-9]{6,32}$/.test(ex.uid || '') || seen.has(ex.uid)) ex.uid = newExerciseUid();
    seen.add(ex.uid);
    if (!Array.isArray(ex.sets)) ex.sets = [];
  });
  if (!s.exercises.some(ex => ex.uid === s.focusUid)) s.focusUid = defaultFocusUid(s);
  return s;
}
function sessionExercise(uid) {
  const s = App.activeSession;
  return (s && uid) ? s.exercises.find(ex => ex.uid === uid) || null : null;
}
function exerciseIndex(uid) {
  const s = App.activeSession;
  return s ? s.exercises.findIndex(ex => ex.uid === uid) : -1;
}
function exPending(ex) { return (ex.sets || []).some(st => !st.done); }
function exComplete(ex) { return (ex.sets || []).length > 0 && !exPending(ex); }
/* the first exercise with sets left, scanning forward from `start` and wrapping
   round to the ones before it — routine order, never "whatever is nearest" */
function firstPendingFrom(s, start) {
  const n = s.exercises.length;
  for (let k = 0; k < n; k++) {
    const ex = s.exercises[(((start + k) % n) + n) % n];
    if (exPending(ex)) return ex.uid;
  }
  return null;
}
function defaultFocusUid(s) {
  if (!s.exercises.length) return null;
  return firstPendingFrom(s, 0) || s.exercises[0].uid;
}
function focusedExercise() {
  const s = App.activeSession;
  if (!s) return null;
  if (!sessionExercise(s.focusUid)) s.focusUid = defaultFocusUid(s);
  return sessionExercise(s.focusUid);
}

/* The set on screen in the editor: whichever one you picked, else the next one
   still to do. Picking a set is navigation — it never marks anything performed
   or edited, so an early finish still leaves an untouched plan out of history. */
function currentSetIndex(ex) {
  const sel = App.setSel;
  if (sel && sel.uid === ex.uid && ex.sets[sel.si]) return sel.si;
  return ex.sets.findIndex(st => !st.done);
}
/* the set "Complete set" acts on — a picked set only if it still needs doing */
function nextPendingSetIndex(ex) {
  const sel = App.setSel;
  if (sel && sel.uid === ex.uid && ex.sets[sel.si] && !ex.sets[sel.si].done) return sel.si;
  return ex.sets.findIndex(st => !st.done);
}
function workingCount(ex) { return workingSets(ex.sets).length; }
function workingNumber(ex, si) {
  let n = 0;
  for (let i = 0; i <= si; i++) if (ex.sets[i] && !isWarmup(ex.sets[i])) n++;
  return n;
}
function setLabel(ex, si) {
  return isWarmup(ex.sets[si]) ? 'Warmup' : `Set ${workingNumber(ex, si)}`;
}
function isTimedLift(name) { return /\(seconds?\)/i.test(name || ''); }
function fmtW1(disp) { return String(Math.round((disp || 0) * 10) / 10); }

/* one set as it was actually lifted: "185 lb × 5", "12 reps", "45s" */
function setValueText(name, st) {
  const u = wUnit();
  const timed = isTimedLift(name);
  const reps = st.reps != null ? `${st.reps}${timed ? 's' : ''}` : '—';
  if (st.weight > 0) return `${fmtW1(toW(st.weight))} ${u} × ${reps}`;
  return timed ? reps : `${reps} reps`;
}
/* Last session exactly as logged, set by set. The old single line paired the
   heaviest weight with the most reps even when they came from different sets,
   which described a set nobody had ever done. */
function prevSetsText(name, sets) {
  if (!sets || !sets.length) return '';
  const u = wUnit();
  const anyLoad = sets.some(st => st.weight > 0);
  const body = sets.map(st => st.weight > 0 ? `${fmtW1(toW(st.weight))}×${st.reps}` : `${st.reps}${isTimedLift(name) ? 's' : ''}`).join(' · ');
  return anyLoad ? `${body} ${perHandLift(name) ? u + '/hand' : u}` : body;
}

/* the short, glanceable version of a prescription; the full reasoning lives
   behind "Why this target?" */
function cueHeadline(name, pr) {
  const u = wUnit();
  const load = pr.w > 0 ? `${fmtW1(pr.w)} ${perHandLift(name) ? u + '/hand' : u}` : '';
  const reps = `${pr.reps}${isTimedLift(name) ? 's' : ''}`;
  switch (pr.type) {
    case 'baseline': return 'First time — find a working weight';
    case 'add_weight': return `Go up to ${load} × ${reps}`;
    case 'deload': return `Deload to ${load} × ${reps}`;
    case 'hold': return `Keeping ${load} × ${reps} · progression paused`;
    default: return pr.w > 0 ? `Stay at ${load} — finish ${pr.sets}×${reps}` : `Aim for ${reps}${isTimedLift(name) ? '' : '+ reps'}`;
  }
}

function renderActiveSession() {
  const s = App.activeSession;
  ensureSessionIds(s);
  const live = sessionLiveStats();
  const elapsed = s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0;
  const stale = s.date !== todayKey();
  const focus = focusedExercise();
  const pct = live.total ? Math.round(live.doneAll / live.total * 100) : 0;
  const allDone = live.total > 0 && live.doneAll === live.total;
  return `
  ${stale ? `<div class="alert" style="border-left-color:var(--warning)"><span class="a-ico">⏳</span>
    <div class="a-body"><b>This session is from ${prettyDate(s.date)}.</b>
    Finish it to save it under that date, or discard it.</div></div>` : ''}
  <section class="wk-head" aria-label="Workout progress">
    <div class="eyebrow">${allDone ? `${icon('check')} Every set complete` : '<span class="live-dot" aria-hidden="true"></span> Workout in progress'}</div>
    <div class="wk-title-row">
      <h2 class="wk-title">${esc(s.dayName)}</h2>
      <span class="wk-clock" id="sess-timer" role="timer" aria-label="Elapsed time">${fmtClock(elapsed)}</span>
    </div>
    <div class="wk-bar" role="progressbar" aria-label="Sets completed" aria-valuemin="0"
      aria-valuemax="${live.total}" aria-valuenow="${live.doneAll}"><span style="width:${pct}%"></span></div>
    <div class="wk-meta"><b>${live.doneAll}</b> of ${live.total} set${live.total !== 1 ? 's' : ''} done${
      live.volKg > 0 ? ` · ${fmtWt(live.volKg)} ${wUnit()} moved` : ''}</div>
  </section>
  ${s.exercises.length ? `
  <div class="ex-list">
    ${s.exercises.map((ex, xi) => ex.uid === focus?.uid
      ? renderFocusedExercise(ex, xi, s.exercises.length)
      : renderExerciseRow(ex)).join('')}
  </div>` : `
  <div class="card empty-state">
    <h3>No exercises yet</h3>
    <p class="muted">${s.freestyle ? "Freestyle session — add whatever you're training and log it as you go." : 'Add an exercise to start logging sets.'}</p>
    <button class="btn accent big mt" data-action="add-exercise">${icon('plus')} Add exercise</button>
  </div>`}
  <div class="wk-foot">
    ${s.exercises.length ? `<button class="btn" data-action="add-exercise">${icon('plus')} Add exercise</button>` : ''}
    ${s.exercises.length > 1 ? `<button class="btn" data-action="open-reorder">${icon('reorder')} Reorder</button>` : ''}
    <button class="btn" data-action="review-finish">${allDone ? 'Review &amp; finish' : 'Review &amp; finish early'}</button>
    <button class="btn ghost danger" data-action="discard-workout">Discard workout</button>
  </div>`;
}

/* a closed exercise: enough to know where you stand, one tap to open */
function renderExerciseRow(ex) {
  const total = ex.sets.length, done = ex.sets.filter(st => st.done).length;
  const complete = exComplete(ex);
  const status = !total ? 'no sets' : complete ? 'complete' : `${done} of ${total} sets done`;
  return `
  <button class="ex-row ${complete ? 'complete' : ''}" data-action="focus-ex" data-uid="${ex.uid}"
    aria-label="${esc(ex.name)}, ${status}. Open exercise">
    <span class="exr-badge" aria-hidden="true">${complete ? icon('check') : `${done}/${total}`}</span>
    <span class="exr-name">${esc(ex.name)}</span>
    <span class="exr-meta" aria-hidden="true">${esc(ex.target || '')}</span>
    <span class="exr-chev" aria-hidden="true">${icon('chevron')}</span>
  </button>`;
}

function renderFocusedExercise(ex, xi, count) {
  const pr = nextTarget(ex.name, ex.target || findTargetFor(ex.name));
  const last = lastSessionSets(ex.name, ex.target || findTargetFor(ex.name));
  const prevWork = last ? last.sets : [];
  const done = ex.sets.filter(st => st.done).length;
  const cur = currentSetIndex(ex);
  const nextSi = nextPendingSetIndex(ex);
  let workIdx = 0;
  const rows = ex.sets.map((st, si) => {
    if (!isWarmup(st)) workIdx++;
    const prevSet = isWarmup(st) ? null : prevWork[workIdx - 1];
    return si === cur ? renderSetEditor(ex, st, si, prevSet) : renderSetLine(ex, st, si, si === nextSi);
  }).join('');
  return `
  <section class="card ex-focus" id="ex-focus" aria-labelledby="exf-title">
    <div class="exf-head">
      <div class="grow">
        <div class="eyebrow">Exercise ${xi + 1} of ${count} · ${done}/${ex.sets.length} sets</div>
        <h3 class="exf-title" id="exf-title" tabindex="-1">${esc(ex.name)}${perHandLift(ex.name) ? ' <span class="exf-tag">per hand</span>' : ''}</h3>
      </div>
      <button class="icon-btn2" data-action="ex-menu" data-uid="${ex.uid}" aria-label="Options for ${esc(ex.name)}">${icon('more')}</button>
    </div>
    <div class="exf-coach">
      <span class="exf-cue" style="color:${cueColor(pr.type)}" aria-hidden="true">${CUE[pr.type] || '→'}</span>
      <span class="exf-cue-text">${esc(cueHeadline(ex.name, pr))}</span>
      <button class="link-btn" data-action="why-target" data-name="${esc(ex.name)}" data-target="${esc(ex.target || '')}">Why this target?</button>
    </div>
    ${prevWork.length ? `<div class="exf-prev"><span class="muted">Last time · ${esc(prettyDate(last.date))}</span><br>${esc(prevSetsText(ex.name, prevWork))}</div>` : ''}
    <div class="set-list">${rows || '<div class="muted small">No sets yet — add one below.</div>'}</div>
    <div class="exf-actions">
      <button class="btn small" data-action="add-set" data-uid="${ex.uid}">${icon('plus')} Add set</button>
      <button class="btn small" data-action="add-warmup" data-uid="${ex.uid}">${icon('plus')} Warmup</button>
    </div>
  </section>`;
}

function renderSetLine(ex, st, si, isNext) {
  const type = st.type || 'normal';
  const badge = SET_BADGE[type];
  const label = setLabel(ex, si);
  const val = setValueText(ex.name, st);
  const state = st.done ? 'Done' : isNext ? 'Next' : st.touched ? 'Edited' : 'Planned';
  const typeWord = type !== 'normal' && type !== 'warmup' ? ` (${type === 'drop' ? 'drop set' : 'to failure'})` : '';
  return `
  <div class="set-line ${st.done ? 'done' : ''} ${isNext ? 'next' : ''}">
    <button class="set-sum" data-action="select-set" data-uid="${ex.uid}" data-si="${si}"
      aria-label="${label}${typeWord}: ${esc(val)}, ${state.toLowerCase()}. Edit set">
      <span class="ss-no" style="${badge ? `color:${SET_BADGE_COLOR[type]}` : ''}" aria-hidden="true">${badge || workingNumber(ex, si)}</span>
      <span class="ss-val" aria-hidden="true">${esc(val)}</span>
      <span class="ss-state" aria-hidden="true">${st.done ? icon('check') : esc(state)}</span>
    </button>
    <button class="set-more" data-action="set-menu" data-uid="${ex.uid}" data-si="${si}" aria-label="Options for ${esc(label.toLowerCase())}">${icon('more')}</button>
  </div>`;
}

/* The one set you are about to lift, big enough to read from the bench. The
   inputs carry the exercise id rather than an index, so a reorder or delete
   between keystrokes can never write a number into the wrong lift. */
function renderSetEditor(ex, st, si, prevSet) {
  const u = wUnit();
  const type = st.type || 'normal';
  const label = isWarmup(st) ? 'Warmup' : `Set ${workingNumber(ex, si)} of ${workingCount(ex)}`;
  const typeName = { failure: 'to failure', drop: 'drop set' }[type];
  const timed = isTimedLift(ex.name);
  const noLoad = !(st.weight > 0) && typeof exerciseHasLoad === 'function' && !exerciseHasLoad(ex.name);
  const id = `se-${ex.uid}-${si}`;
  const wVal = st.weight != null && st.weight !== 0 ? fmtW1(toW(st.weight)) : '';
  const prevTxt = prevSet ? (prevSet.weight > 0 ? `${fmtW1(toW(prevSet.weight))} × ${prevSet.reps}` : `${prevSet.reps}${timed ? 's' : ''}`) : '';
  const untouched = !st.done && !st.touched;
  return `
  <div class="set-edit ${st.done ? 'done' : ''} ${untouched ? 'planned' : ''}" id="set-edit" tabindex="-1" role="group" aria-labelledby="${id}-l">
    <div class="se-head">
      <span class="se-label" id="${id}-l">${label}${typeName ? ` · ${typeName}` : ''}${st.done ? ' · done' : ''}</span>
      ${prevTxt ? `<span class="se-prev">last time ${esc(prevTxt)}</span>` : ''}
      <button class="set-more" data-action="set-menu" data-uid="${ex.uid}" data-si="${si}" aria-label="Options for ${esc(label.toLowerCase())}">${icon('more')}</button>
    </div>
    <div class="se-field">
      <label for="${id}-w">${noLoad ? 'Added' : 'Weight'}<span>${perHandLift(ex.name) ? u + ' / hand' : u}</span></label>
      <button class="se-step" data-action="step-weight" data-dir="-1" data-uid="${ex.uid}" data-si="${si}" aria-label="Decrease weight">${icon('minus')}</button>
      <input id="${id}-w" type="number" step="any" min="0" inputmode="decimal" enterkeyhint="next" autocomplete="off"
        value="${wVal}" placeholder="${prevSet && prevSet.weight > 0 ? fmtW1(toW(prevSet.weight)) : '0'}"
        data-set-w data-uid="${ex.uid}" data-si="${si}">
      <button class="se-step" data-action="step-weight" data-dir="1" data-uid="${ex.uid}" data-si="${si}" aria-label="Increase weight">${icon('plus')}</button>
    </div>
    <div class="se-field">
      <label for="${id}-r">${timed ? 'Time' : 'Reps'}<span>${timed ? 'seconds' : 'count'}</span></label>
      <button class="se-step" data-action="step-reps" data-dir="-1" data-uid="${ex.uid}" data-si="${si}" aria-label="Decrease ${timed ? 'seconds' : 'reps'}">${icon('minus')}</button>
      <input id="${id}-r" type="number" min="0" inputmode="numeric" enterkeyhint="done" autocomplete="off"
        value="${st.reps ?? ''}" placeholder="${prevSet ? prevSet.reps : '0'}"
        data-set-r data-uid="${ex.uid}" data-si="${si}">
      <button class="se-step" data-action="step-reps" data-dir="1" data-uid="${ex.uid}" data-si="${si}" aria-label="Increase ${timed ? 'seconds' : 'reps'}">${icon('plus')}</button>
    </div>
    <div id="plates-focus">${plateBlock(ex)}</div>
    ${st.done ? `<button class="btn small ghost mt" data-action="set-undone" data-uid="${ex.uid}" data-si="${si}">Mark ${esc(label.split(' of')[0].toLowerCase())} not done</button>` : ''}
  </div>`;
}

/* The weight you are about to load — the set in the editor, not the heaviest of
   the session. A warmup ramp changes the plates on every set, and an indicator
   showing the top set while you're loading the first one is a wrong answer
   delivered confidently. */
function plateWeightFor(ex) {
  const cur = (ex.sets || [])[currentSetIndex(ex)];
  if (cur && cur.weight > 0) return toW(cur.weight);
  const heaviest = Math.max(0, ...(ex.sets || []).filter(s => !isWarmup(s)).map(s => toW(s.weight || 0)));
  if (heaviest > 0) return heaviest;
  return nextTarget(ex.name, ex.target || findTargetFor(ex.name)).w || 0;
}

function plateBlock(ex) {
  const w = plateWeightFor(ex);
  const stack = plateStack(ex.name, w);
  if (stack) {
    return `<button class="plate-btn" data-action="edit-load" data-name="${esc(ex.name)}"
      aria-label="Plates for ${esc(ex.name)} — change how this lift is loaded">${stack}</button>`;
  }
  // nothing to load, or Peak doesn't know — offer the fix rather than staying silent
  if (!(w > 0) || perHandLift(ex.name)) return '';
  return `<button class="plate-hint" data-action="edit-load" data-name="${esc(ex.name)}">🏋 Plate math off — set how this lift is loaded</button>`;
}

/* Typing a weight has to move the plates with it; the set inputs deliberately
   never trigger a re-render, so this patches the one block that changed. */
function repaintPlates(uid) {
  const el = document.getElementById('plates-focus');
  const ex = sessionExercise(uid);
  if (el && ex) el.innerHTML = plateBlock(ex);
}

/* ---------- session edits ---------- */
function addSet(uid) {
  const ex = sessionExercise(uid);
  if (!ex) return;
  const prevWorking = workingSets(ex.sets).slice(-1)[0];
  if (prevWorking) { ex.sets.push({ weight: prevWorking.weight, reps: prevWorking.reps, type: 'normal', done: false }); }
  else {
    // pre-fill the first working set with today's prescribed target
    const pr = nextTarget(ex.name, ex.target || findTargetFor(ex.name));
    ex.sets.push({ weight: pr.w ? (pr.wKg ?? fromW(pr.w)) : null, reps: pr.reps ?? null, type: 'normal', done: false });
  }
  persistSession();
  App.render();
}

/* a warmup ramp set — ~55% of the working weight, higher reps, never counted */
function addWarmup(uid) {
  const ex = sessionExercise(uid);
  if (!ex) return;
  const pr = nextTarget(ex.name, ex.target || findTargetFor(ex.name));
  const workDisp = pr.w || Math.round(toW(Math.max(0, ...workingSets(ex.sets).map(s => s.weight || 0))));
  const warmDisp = workDisp > 0 ? roundW(workDisp * 0.55, ex.name) : 0;
  ex.sets.unshift({ weight: warmDisp ? fromW(warmDisp) : null, reps: Math.max(5, (pr.reps || 8) + 2), type: 'warmup', done: false });
  // the set being edited moved down one; keep pointing at the same set
  if (App.setSel && App.setSel.uid === uid) App.setSel = { uid, si: App.setSel.si + 1 };
  persistSession();
  App.render();
}

/* +/- steppers so weight/reps can be adjusted without the on-screen keyboard.
   These are real edits, so they do mark the set touched. */
function stepSetWeight(uid, si, dir) {
  const st = sessionExercise(uid)?.sets[si];
  if (!st) return;
  const step = isMetric() ? 1 : 2.5;
  const cur = st.weight != null ? toW(st.weight) : 0;
  st.weight = fromW(Math.max(0, Math.round((cur + dir * step) * 10) / 10));
  st.touched = true;
  st.planned = false;
  App.setSel = { uid, si };
  persistSession();
  App.render();
}

function stepSetReps(uid, si, dir) {
  const st = sessionExercise(uid)?.sets[si];
  if (!st) return;
  const cur = st.reps != null ? st.reps : 0;
  st.reps = Math.max(0, cur + dir);
  st.touched = true;
  st.planned = false;
  App.setSel = { uid, si };
  persistSession();
  App.render();
}

function setSetType(uid, si, type) {
  const st = sessionExercise(uid)?.sets[si];
  if (!st || !SET_TYPES.includes(type) || (st.type || 'normal') === type) return;
  st.type = type;
  st.touched = true;
  persistSession();
  App.render();
}

/* opening an exercise is navigation only — nothing about its sets changes */
function focusExercise(uid, opts = {}) {
  const s = App.activeSession;
  const ex = sessionExercise(uid);
  if (!s || !ex) return;
  const changed = s.focusUid !== uid;
  s.focusUid = uid;
  App.setSel = null;
  persistSession();
  App._scrollFocus = opts.moveFocus === false ? 'scroll' : 'focus';
  App.render();
  if (changed) announce(`${ex.name} open — ${ex.sets.filter(st => st.done).length} of ${ex.sets.length} sets done`);
}

function selectSet(uid, si) {
  const s = App.activeSession;
  const ex = sessionExercise(uid);
  if (!s || !ex || !ex.sets[si]) return;
  s.focusUid = uid;
  App.setSel = { uid, si };
  App._focusSetEditor = true;
  persistSession();
  App.render();
}

/* Completing a set starts rest and fires any live PR. Finishing the last set of
   an exercise opens the next unfinished one in routine order, wrapping round to
   anything skipped earlier. It never finishes the workout — that is always a
   deliberate review. */
let _lastCompleteAt = 0;
function completeSet(uid, si) {
  const s = App.activeSession;
  const xi = exerciseIndex(uid);
  const ex = s?.exercises[xi];
  const st = ex?.sets[si];
  if (!st || st.done) return;
  // a double tap must not tick off the set after this one too
  if (Date.now() - _lastCompleteAt < 450) return;
  if (!st.reps) {
    toast(isTimedLift(ex.name) ? 'Enter the time first' : 'Enter reps first');
    App.setSel = { uid, si };
    App.render();
    document.querySelector('[data-set-r]')?.focus();
    return;
  }
  _lastCompleteAt = Date.now();
  st.done = true;
  st.planned = false;
  if (navigator.vibrate) navigator.vibrate(30);
  const pr = checkSetPR(ex.name, st);
  if (pr) toast(pr);
  if (!isWarmup(st)) startRest(suggestedRestSec(ex.name), ex.name);
  App.setSel = null;
  let msg = `${ex.name}: ${setLabel(ex, si).toLowerCase()} complete.`;
  if (!exPending(ex)) {
    const next = firstPendingFrom(s, xi + 1);
    if (next) {
      s.focusUid = next;
      App._scrollFocus = 'scroll';
      msg += ` ${ex.name} finished. Next: ${sessionExercise(next).name}.`;
    } else {
      msg += ' Every set is done — review and finish when you are ready.';
    }
  }
  persistSession();
  App.render();
  announce(msg);
}

function uncompleteSet(uid, si) {
  const ex = sessionExercise(uid);
  const st = ex?.sets[si];
  if (!st || !st.done) return;
  st.done = false;
  // it was performed once, so it stays a real (touched) set rather than reverting to plan
  st.touched = true;
  App.setSel = { uid, si };
  persistSession();
  App.render();
  announce(`${ex.name}: ${setLabel(ex, si).toLowerCase()} marked not done`);
}

/* deletes are undoable, and live behind a labelled menu rather than an ✕ that
   sat next to ✓ and got hit by accident */
function deleteSet(uid, si) {
  const ex = sessionExercise(uid);
  if (!ex || !ex.sets[si]) return;
  const [removed] = ex.sets.splice(si, 1);
  App.setSel = null;
  persistSession();
  App.render();
  destructive('set', { uid, si, set: removed }, 'Set removed');
}
function deleteExercise(uid) {
  const s = App.activeSession;
  const xi = exerciseIndex(uid);
  if (!s || xi < 0) return;
  const [removed] = s.exercises.splice(xi, 1);
  if (s.focusUid === uid) {
    // the next unfinished lift in routine order, else whatever is first
    s.focusUid = s.exercises.length ? (firstPendingFrom(s, xi) || s.exercises[0].uid) : null;
    App.setSel = null;
  }
  persistSession();
  App.render();
  destructive('exercise', { xi, exercise: removed }, `${removed.name} removed`);
}
/* Move a lift to an absolute position. Everything that reorders goes through
   here, so there is one splice to get right. Focus is held by uid, so the open
   exercise stays open wherever it lands. */
function moveExerciseTo(uid, to) {
  const s = App.activeSession;
  const xi = exerciseIndex(uid);
  if (!s || xi < 0 || to < 0 || to >= s.exercises.length || to === xi) return false;
  const [ex] = s.exercises.splice(xi, 1);
  s.exercises.splice(to, 0, ex);
  persistSession();
  App.render();
  return true;
}
function moveExercise(uid, dir) {
  const s = App.activeSession;
  const from = exerciseIndex(uid);
  if (!moveExerciseTo(uid, from + dir)) return;
  announce(`${sessionExercise(uid).name} moved ${dir < 0 ? 'up' : 'down'} to position ${exerciseIndex(uid) + 1}`);
}

/* "Do next" puts a lift directly after the one that is open — the rack is
   busy, the bench is taken, so do this instead and come back. Moving the open
   lift itself means "start here", so it goes to the front. */
function moveExerciseNext(uid) {
  const s = App.activeSession;
  if (!s) return;
  const focus = exerciseIndex(s.focusUid);
  const to = uid === s.focusUid || focus < 0 ? 0 : (exerciseIndex(uid) < focus ? focus : focus + 1);
  if (!moveExerciseTo(uid, to)) return;
  announce(`${sessionExercise(uid).name} is next`);
}
/* Restores for what this file deletes — undoLast() in ui.js dispatches here. */
registerUndo('set', u => {
  if (App.activeSession) sessionExercise(u.uid)?.sets.splice(u.si, 0, u.set);
});
registerUndo('exercise', u => {
  const s = App.activeSession;
  if (!s) return;
  s.exercises.splice(Math.min(u.xi, s.exercises.length), 0, u.exercise);
  // restoring never steals focus from an exercise that is still open
  ensureSessionIds(s);
});

/* Flush whatever is typed into the open set before anything re-renders or
   switches. Only a field whose value really changed counts as an edit — a
   pre-filled number that was merely rendered must stay untouched, or ending
   early would save a set nobody lifted. */
function applySetField(inp) {
  const st = sessionExercise(inp.dataset.uid)?.sets[inp.dataset.si];
  if (!st) return false;
  const v = inp.value === '' ? null : Number(inp.value);
  if (v != null && !Number.isFinite(v)) return false;
  if (inp.dataset.setW !== undefined) st.weight = v == null ? null : fromW(Math.max(0, v));
  else st.reps = v == null ? null : Math.max(0, Math.round(v));
  st.touched = true;
  st.planned = false;
  inp.defaultValue = inp.value;   // applied; a later flush must not count it twice
  return true;
}
let _typeTimer = null;
function readSetInputs() {
  if (!App.activeSession) return;
  let changed = false;
  document.querySelectorAll('[data-set-w], [data-set-r]').forEach(inp => {
    if (inp.value !== inp.defaultValue && applySetField(inp)) changed = true;
  });
  if (changed || _typeTimer) { clearTimeout(_typeTimer); _typeTimer = null; persistSession(); }
}

/* Typing applies immediately and mirrors to storage without re-rendering, which
   would steal focus and close the keyboard mid-number. */
document.addEventListener('input', e => {
  const el = e.target;
  if (!App.activeSession || !el.dataset) return;
  if (el.dataset.setW === undefined && el.dataset.setR === undefined) return;
  if (!applySetField(el)) return;
  if (el.dataset.setW !== undefined) repaintPlates(el.dataset.uid);
  clearTimeout(_typeTimer);
  _typeTimer = setTimeout(() => { _typeTimer = null; persistSession(); }, 400);
});

/* ---------- menus & sheets ---------- */
function openExerciseMenu(uid) {
  const s = App.activeSession;
  const xi = exerciseIndex(uid);
  if (!s || xi < 0) return;
  const ex = s.exercises[xi];
  openModal(`
    <h3>${esc(ex.name)}</h3>
    <div class="modal-sub">Exercise ${xi + 1} of ${s.exercises.length} · ${ex.sets.filter(st => st.done).length} of ${ex.sets.length} sets done</div>
    <div class="sheet-list">
      ${typeof openProgressionSheet === 'function' ? `<button class="sheet-item" data-action="open-progression" data-name="${esc(ex.name)}">${icon('sliders')} Progression settings</button>` : ''}
      <button class="sheet-item" data-action="edit-load" data-name="${esc(ex.name)}">${icon('dumbbell')} How this lift is loaded</button>
      ${s.exercises.length > 1 ? `<button class="sheet-item" data-action="open-reorder">${icon('reorder')} Reorder exercises</button>` : ''}
      <button class="sheet-item danger" data-action="del-exercise" data-uid="${uid}">${icon('trash')} Remove ${esc(ex.name)} from this workout</button>
    </div>
    <button class="btn mt" data-action="close-modal">Cancel</button>
  `);
}

const SET_TYPE_LABEL = {
  normal: 'Working set', warmup: 'Warmup — not counted',
  failure: 'Taken to failure', drop: 'Drop set'
};
/* Reordering used to be two one-step items inside a per-exercise menu that only
   existed on the OPEN exercise — so moving a lift three places meant opening
   the sheet three times, and touching a lift you were not already doing meant
   focusing it first, mid-set. One sheet, every exercise in it, and it stays
   open while you work: refreshModal keeps the scroll position and the focused
   button, which is the whole reason that helper exists.

   Not drag-and-drop. The document is the scroll container, a touch-drag inside
   a sheet that scrolls fights it, and a sweaty one-handed drag between sets is
   the worst possible input for this. Two arrows and "Do next" cover both real
   motions: nudge one place, or jump a lift forward because the rack is busy. */
function reorderSheetHtml() {
  const s = App.activeSession;
  if (!s) return '';
  const focus = exerciseIndex(s.focusUid);
  return `
    <h3>Reorder exercises</h3>
    <div class="modal-sub">${s.dayName ? esc(s.dayName) + ' · ' : ''}arrows move one place, “Do next” jumps a lift to right after the one you are on.</div>
    <div class="sheet-list">
      ${s.exercises.map((ex, i) => {
        const done = ex.sets.filter(st => st.done).length;
        const complete = exComplete(ex);
        return `
        <div class="ro-row${complete ? ' complete' : ''}" role="group"
          aria-label="Position ${i + 1} of ${s.exercises.length}: ${esc(ex.name)}, ${done} of ${ex.sets.length} sets done">
          <span class="ro-pos" aria-hidden="true">${complete ? icon('check') : i + 1}</span>
          <span class="ro-name">${esc(ex.name)}<small>${done}/${ex.sets.length} sets${i === focus ? ' · open' : ''}</small></span>
          <button class="ro-btn" data-action="ro-move" data-uid="${ex.uid}" data-dir="-1" ${i === 0 ? 'disabled' : ''}
            aria-label="Move ${esc(ex.name)} up">${icon('up')}</button>
          <button class="ro-btn" data-action="ro-move" data-uid="${ex.uid}" data-dir="1" ${i === s.exercises.length - 1 ? 'disabled' : ''}
            aria-label="Move ${esc(ex.name)} down">${icon('down')}</button>
          ${i === focus || i === focus + 1 ? '<span class="ro-spacer" aria-hidden="true"></span>'
            : `<button class="btn small" data-action="ro-next" data-uid="${ex.uid}">Do next</button>`}
        </div>`;
      }).join('')}
    </div>
    <button class="btn mt" data-action="close-modal">Done</button>`;
}
function openReorderSheet() {
  if (!App.activeSession || App.activeSession.exercises.length < 2) return;
  openModal(reorderSheetHtml());
}
/* Re-render in place: closing the sheet after every single move is what made
   the old two-item version useless. */
function refreshReorderSheet() { refreshModal(reorderSheetHtml()); }

function openSetMenu(uid, si) {
  const ex = sessionExercise(uid);
  const st = ex?.sets[si];
  if (!st) return;
  const label = setLabel(ex, si);
  const type = st.type || 'normal';
  openModal(`
    <h3>${esc(label)} · ${esc(ex.name)}</h3>
    <div class="modal-sub">${esc(setValueText(ex.name, st))}${st.done ? ' · done' : ''}. Warmups are logged but never count toward volume or records.</div>
    <div class="sheet-h" id="set-type-h">Set type</div>
    <div class="sheet-list" role="radiogroup" aria-labelledby="set-type-h">
      ${SET_TYPES.map(t => `
        <button class="sheet-item" role="radio" aria-checked="${t === type}" data-action="set-type"
          data-uid="${uid}" data-si="${si}" data-type="${t}">
          <span class="grow">${esc(SET_TYPE_LABEL[t])}</span>${t === type ? icon('check') : ''}</button>`).join('')}
    </div>
    <div class="sheet-list mt">
      <button class="sheet-item danger" data-action="del-set" data-uid="${uid}" data-si="${si}">${icon('trash')} Remove ${esc(label.toLowerCase())}</button>
    </div>
    <button class="btn mt" data-action="close-modal">Cancel</button>
  `);
}

/* the reasoning behind a number, one tap away instead of always on screen */
function openWhyTarget(name, targetStr) {
  const plateaus = detectPlateaus();
  const stalled = new Set(plateaus.map(p => p.name.toLowerCase()));
  const pr = nextTarget(name, targetStr || findTargetFor(name), stalled);
  const last = lastSessionSets(name, targetStr || findTargetFor(name));
  const plateau = plateaus.find(p => p.name.toLowerCase() === name.toLowerCase());
  const u = wUnit();
  const big = pr.w > 0 ? `${fmtW1(pr.w)}<span class="unit"> ${perHandLift(name) ? u + '/hand' : u} × ${pr.reps}${isTimedLift(name) ? 's' : ''}</span>`
    : pr.w === 0 ? `${pr.reps}<span class="unit"> ${isTimedLift(name) ? 'seconds' : 'reps'}</span>`
    : '<span class="unit">Pick a working weight</span>';
  openModal(`
    <h3>${esc(name)}</h3>
    <div class="modal-sub">${targetStr ? `Plan ${esc(targetStr)} · ` : ''}${esc(CUE_LEGEND[pr.type] || '')}</div>
    <div class="why-big">${big}</div>
    ${pr.w > 0 ? plateStack(name, pr.w) : ''}
    <div class="sheet-h">Why this target?</div>
    <p class="sheet-p">${esc(pr.text)}${plateau && pr.type !== 'hold' ? esc(plateauVolumeNote(name)) : ''}</p>
    ${last && last.sets.length ? `
      <div class="sheet-h">Last time · ${esc(prettyDate(last.date))}</div>
      <p class="sheet-p">${esc(prevSetsText(name, last.sets))}</p>` : ''}
    ${typeof openProgressionSheet === 'function' ? `<button class="btn mt" data-action="open-progression" data-name="${esc(name)}">${icon('sliders')} Progression settings</button>` : ''}
    <button class="btn ghost mt" data-action="close-modal">Close</button>
  `);
}

/* Ending a session is always reviewed, never automatic — and ending early shows
   exactly what will be saved and what will not. */
function openReviewSheet() {
  const s = App.activeSession;
  if (!s) return;
  readSetInputs();
  const live = sessionLiveStats();
  const elapsed = s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0;
  let loggedAny = false;
  const rows = s.exercises.map(ex => {
    const kept = ex.sets.filter(st => (st.done || st.touched) && st.reps > 0);
    const editedOnly = kept.filter(st => !st.done).length;
    const left = ex.sets.filter(st => !st.done && !(st.touched && st.reps > 0)).length;
    if (kept.length) loggedAny = true;
    return `
    <div class="review-ex">
      <b>${esc(ex.name)}</b>
      <div class="rv-sets">${kept.length ? esc(kept.map(st => setValueText(ex.name, st) + (isWarmup(st) ? ' (warmup)' : '')).join(' · ')) : '<span class="muted">Nothing logged</span>'}</div>
      ${editedOnly ? `<div class="rv-note">${editedOnly} edited but not ticked — saved as logged</div>` : ''}
      ${left ? `<div class="rv-left">${left} set${left !== 1 ? 's' : ''} remaining — not saved</div>` : ''}
    </div>`;
  }).join('');
  const allDone = live.total > 0 && live.doneAll === live.total;
  openModal(`
    <h3>${allDone ? 'Finish workout' : 'Finish early?'}</h3>
    <div class="modal-sub">${esc(s.dayName)} · ${fmtClock(elapsed)} · ${live.doneAll} of ${live.total} sets done</div>
    ${rows || '<div class="muted small">No exercises in this session.</div>'}
    ${loggedAny
      ? `<button class="btn accent big mt" data-action="finish-workout">${icon('check')} Save workout</button>`
      : `<div class="chart-note mt">Complete or edit at least one set and it can be saved.</div>`}
    <button class="btn mt" data-action="close-modal">Keep training</button>
  `);
}

function finishWorkout() {
  const s = App.activeSession;
  if (!s) return;   // a second tap after the first one already saved
  readSetInputs();
  // Only sets the user ticked or edited count. Rows are pre-filled, so "has
  // reps" alone would save a whole workout nobody performed. The live session
  // is left intact until the save succeeds — returning early used to strip it.
  const exercises = s.exercises
    .map(({ uid, ...ex }) => ({ ...ex, sets: ex.sets.filter(st => (st.done || st.touched) && st.reps > 0)
      .map(st => ({ weight: st.weight || 0, reps: st.reps, type: st.type || 'normal' })) }))
    .filter(ex => ex.sets.length > 0);
  if (!exercises.length) { toast('Complete or edit at least one set first'); return; }
  const { focusUid, ...saved } = s;
  saved.exercises = exercises;
  // PR check (weighted lifts only)
  const prs = [];
  saved.exercises.forEach(ex => {
    const prevBest = Math.max(0, ...exerciseHistory(ex.name).map(h => h.bestE1rm));
    const nowBest = Math.max(0, ...workingSets(ex.sets).map(st => e1rm(st.weight, st.reps)));
    if (nowBest > prevBest + 0.01 && prevBest > 0 && !prs.includes(ex.name)) prs.push(ex.name);
  });
  saved.score = scoreWorkout(saved);
  if (saved.startedAt) saved.durationMin = Math.max(1, Math.round((Date.now() - saved.startedAt) / 60000));
  // same MET formula cardio uses (train.js saveCardio); 6 MET is a reasonable
  // flat estimate for straight-set resistance training (ACSM puts it 3-6)
  const kg = getProfile()?.weightKg;
  if (kg && saved.durationMin) saved.kcalEst = Math.round(6 * 3.5 * kg / 200 * saved.durationMin);
  saveWorkout(saved);
  App.activeSession = null;
  App.rest = null;
  App.undo = null;
  App.setSel = null;
  clearPersistedSession();
  App.trainView = 'home';
  App.trainDay = null;   // the template queues the next day; a manual pick is spent
  // land on Today, where the finished session is summarised
  App.tab = 'today';
  App.todayView = 'home';
  if (typeof closeModal === 'function') closeModal();
  paintRest();
  toast(prs.length ? `🎉 PR on ${prs.join(', ')}! Score ${saved.score}` : `Workout saved — score ${saved.score} 💪`);
  App.render();
  announce(`Workout saved. Score ${saved.score}.`);
}

/* The old add-exercise modal was a text box with a datalist behind it: on a
   phone that is a keyboard and a guess at spelling, over a list of ~50 names
   nobody could browse. Replaced by the searchable, muscle-filtered picker in
   routines.js, which draws on the full library plus everything you've logged. */
function openAddExercise() {
  openExercisePicker('session');
}

function viewWorkoutModal(id) {
  const s = getWorkouts().find(w => w.id === id);
  if (!s) return;
  const u = wUnit();
  openModal(`
    <h3>${esc(s.dayName)}</h3>
    <div class="modal-sub">${prettyDate(s.date)}${s.score != null ? ` · score ${s.score}/100` : ''}</div>
    ${s.cardio
      ? `<div class="muted small">${esc(s.durationMin)} min · ${esc(s.intensity)} intensity · ~${esc(s.kcalEst)} kcal burned</div>`
      : (s.exercises || []).map(ex => `
      <div class="exercise-block">
        <div class="ex-head"><span class="ex-name">${esc(ex.name)}${perHandLift(ex.name) ? ' <span class="muted small">per hand</span>' : ''}</span></div>
        ${(ex.sets || []).map((st, i) => {
          /* SET_BADGE_COLOR is keyed by a known set kind, so an unrecognised
             type must never reach the style attribute — look it up, don't echo it. */
          const tag = SET_BADGE_COLOR[st.type] ? ` <span style="color:${SET_BADGE_COLOR[st.type]}">${esc(st.type)}</span>` : '';
          return `<div class="muted small">Set ${i + 1}: ${esc(st.weight ? Math.round(toW(st.weight)) + ' ' + u + ' × ' + st.reps : st.reps + ' reps')}${tag}</div>`;
        }).join('')}
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
    <div class="grid-2">
      <div><label>Duration (minutes)</label><input id="cd-min" type="number" inputmode="numeric" placeholder="e.g. 25"></div>
      <div><label>Date</label><input id="cd-date" type="date" value="${todayKey()}" max="${todayKey()}"></div>
    </div>
    <label>Intensity</label>
    <div class="seg" id="cd-int">
      <button data-v="easy">Easy</button>
      <button data-v="moderate" class="on">Moderate</button>
      <button data-v="hard">Hard</button>
    </div>
    <button class="btn primary mt" data-action="save-cardio">Save</button>
    <div class="chart-note center">Cardio is tracked on its own — it never counts toward your lifting sessions.</div>
  `);
}

function saveCardio() {
  const min = Number(document.getElementById('cd-min').value);
  if (!min || min < 1) { toast('Enter the duration'); return; }
  const date = document.getElementById('cd-date').value || todayKey();
  const type = document.getElementById('cd-type').value;
  const intensity = document.querySelector('#cd-int button.on')?.dataset.v || 'moderate';
  const kg = getProfile().weightKg;
  const kcalEst = Math.round(CARDIO_MET[intensity] * 3.5 * kg / 200 * min);
  const score = scoreCardio(min, intensity);
  saveWorkout({
    id: 'c' + Date.now(), date, cardio: true, freestyle: true,
    dayName: 'Cardio · ' + type, type, durationMin: min, intensity, kcalEst, score, exercises: []
  });
  closeModal();
  toast(`Cardio logged — score ${score} 🏃 (~${kcalEst} kcal)`);
  App.render();
}
