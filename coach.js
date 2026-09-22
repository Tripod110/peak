/* Peak — the Coach.

   Everything else in Peak answers "what is this number?". The coach answers
   "how am I actually doing, and what should I do about it?" — the question a
   good gym coach answers by looking at the whole of your last month, not one
   lift on one day.

   Three layers, and the order is the design (DECISIONS.md D-22):
     1. signals   — pure functions over what you logged. Every claim the coach
                    makes is one of these numbers.
     2. state     — one reading of where you are (on a roll, grinding, drifting…),
                    derived fresh from history every time, never stored — the
                    same no-state-machine rule as the plateau engine (D-12).
     3. words     — the same facts said in the voice you picked. Voice changes
                    the wording, never the verdict or the action.

   Bias, as everywhere advisory in Peak: stay quiet when unsure. A coach who
   has an opinion about everything is one you stop listening to. */

const COACH_WINDOW = 28;          // "lately" — four weeks
const COACH_MIN_DAYS = 28;        // history before the coach judges momentum
const COACH_VOICES = [
  { id: 'encouraging', label: 'Encouraging', sample: "Three PRs this month — you're building something. Keep showing up." },
  { id: 'straight', label: 'Straight-talking', sample: 'Bench has been flat for four weeks. Time to change the stimulus.' },
  { id: 'drill', label: 'Drill sergeant', sample: 'Two sessions in two weeks. The bar did not lift itself. Get in there.' }
];
const COACH_VOICE_IDS = COACH_VOICES.map(v => v.id);

function coachVoice() {
  const v = getSettings().coachVoice;
  return COACH_VOICE_IDS.includes(v) ? v : 'straight';
}

/* ---------- memory: what you told the coach ----------
   The only coach state that is stored, and it is only ever *your* answers —
   "not now", "I switched it up" — never a verdict about you. */
function getCoachMemory() {
  const m = Store.get('coachMemory', {});
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
}
function setCoachMemory(patch) { Store.set('coachMemory', { ...getCoachMemory(), ...patch }); }
function coachSnoozed(state) {
  const until = getCoachMemory().snooze?.[state];
  return typeof until === 'string' && until > todayKey();
}
function snoozeCoach(state, days) {
  const snooze = { ...(getCoachMemory().snooze || {}) };
  snooze[state] = todayKey(days);
  setCoachMemory({ snooze });
}

/* ---------- 1. signals ---------- */

function liftingSessions() {
  return getWorkouts().filter(s => !s.cardio).sort((a, b) => a.date < b.date ? -1 : 1);
}

/* sessions in each of the last `weeks` 7-day blocks, newest first */
function sessionsPerWeek(weeks) {
  const out = Array(weeks).fill(0);
  liftingSessions().forEach(s => {
    const d = daysBetween(s.date, todayKey());
    if (d >= 0 && d < weeks * 7) out[Math.floor(d / 7)]++;
  });
  return out;
}

/* Where one lift stands right now. `stalled` is detectPlateaus' answer, passed
   in so the whole picture is built from one run of it. */
function liftStatus(name, stalled) {
  const full = exerciseHistory(name);
  if (!full.length) return null;
  const idle = daysBetween(full[full.length - 1].date, todayKey());
  const hist = historySinceLayoff(full);
  if (Math.max(...hist.map(h => h.bestE1rm)) <= 0) return null;   // bodyweight: no load to judge
  let recentPrs = 0, lastPr = null;
  for (let i = 1; i < full.length; i++) {
    if (!beats(full[i], full.slice(0, i), 1.0001)) continue;
    lastPr = full[i].date;
    if (daysBetween(full[i].date, todayKey()) < COACH_WINDOW) recentPrs++;
  }
  let status;
  if (idle > DORMANT_DAYS) status = 'dormant';
  else if (hist.length < 4) status = 'new';
  else if (stalled.has(name.toLowerCase())) status = 'stalled';
  else if (recentPrs || isClimbing(hist)) status = 'progressing';
  else status = 'flat';
  const best = Math.max(...hist.map(h => h.bestE1rm));
  // losing ground, not just standing still: the last session 5%+ under the best
  const declining = hist[hist.length - 1].bestE1rm < best * 0.95;
  return { name, status, sessions: hist.length, recentPrs, lastPr, idle, best, declining };
}

function coachSignals() {
  const p = getProfile() || {};
  const planned = Math.max(1, p.gymDays || 3);
  const sessions = liftingSessions();
  const today = todayKey();
  const first = sessions[0];
  const last = sessions[sessions.length - 1];

  const stalled = new Set(detectPlateaus().map(x => x.name.toLowerCase()));
  const names = new Map();
  sessions.forEach(s => (s.exercises || []).forEach(ex => names.set(ex.name.toLowerCase(), ex.name)));
  const lifts = [...names.values()].map(n => liftStatus(n, stalled)).filter(Boolean);
  const judged = lifts.filter(l => ['progressing', 'flat', 'stalled'].includes(l.status));

  const weeks = sessionsPerWeek(4);
  const recent2 = (weeks[0] + weeks[1]) / 2;
  const prior2 = (weeks[2] + weeks[3]) / 2;

  const scored = sessions.filter(s => typeof s.score === 'number');
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const scoreRecent = avg(scored.slice(-3).map(s => s.score));
  const scorePrior = avg(scored.slice(-8, -3).map(s => s.score));

  /* A comeback is a session that follows a real layoff, recently enough that
     you're still rebuilding. Same threshold the plateau engine resets on. */
  let comebackDays = null;
  for (let i = 1; i < sessions.length; i++) {
    if (daysBetween(sessions[i - 1].date, sessions[i].date) >= LAYOFF_DAYS) {
      comebackDays = daysBetween(sessions[i].date, today);
    }
  }

  const t = p.weightKg ? computeTargets(p) : null;
  let proteinLogged = 0, proteinHit = 0;
  for (let i = 0; i < 7; i++) {
    const k = todayKey(-i);
    if (!foodForDay(k).length) continue;
    proteinLogged++;
    if (t && dayTotals(k).protein >= t.protein * 0.9) proteinHit++;
  }

  return {
    goal: p.goal || 'recomp', planned,
    totalSessions: sessions.length,
    historyDays: first ? daysBetween(first.date, today) : 0,
    daysSinceLast: last ? daysBetween(last.date, today) : null,
    lastDay: last ? last.dayName : null,
    weeks, recent2, prior2,
    adherence: (weeks[0] + weeks[1] + weeks[2] + weeks[3]) / 4 / planned,
    lifts, judged,
    progressing: judged.filter(l => l.status === 'progressing'),
    flatOrStalled: judged.filter(l => l.status !== 'progressing'),
    stalled: judged.filter(l => l.status === 'stalled'),
    prs28: lifts.reduce((n, l) => n + l.recentPrs, 0),
    scoreRecent, scorePrior,
    comebackDays,
    sleep7: sleepAvgDays(7), sleep28: sleepAvgDays(28),
    proteinLogged, proteinHit, proteinTarget: t ? t.protein : null
  };
}

/* ---------- 2. state ----------
   Ordered: the first reading that fits wins, and the order is "what would a
   coach bring up first". A comeback outranks everything because stall talk
   during a rebuild is exactly the wrong message; drifting outranks momentum
   because you can't progress sessions you don't do. */
function coachState(sig) {
  if (!sig.totalSessions) return 'empty';
  if (sig.comebackDays != null && sig.comebackDays <= 21) return 'comeback';
  if (sig.daysSinceLast >= 7 ||
      (sig.historyDays >= 21 && sig.prior2 >= 1 && sig.recent2 < sig.prior2 * 0.6 && sig.recent2 < sig.planned * 0.6)) {
    return 'drifting';
  }
  if (sig.historyDays < COACH_MIN_DAYS) return 'starting';

  const lowSleep = sig.sleep7.nights >= 4 && sig.sleep7.avgMin < SLEEP_BANDS.short;
  const lowProtein = sig.proteinLogged >= 4 && sig.proteinHit < sig.proteinLogged / 2;
  const scoresFalling = sig.scoreRecent != null && sig.scorePrior != null && sig.scoreRecent < sig.scorePrior - 8;
  if (scoresFalling && (lowSleep || lowProtein)) return 'rundown';

  /* Most of what you train has gone quiet, and it isn't because you stopped
     turning up. That's a stimulus problem — the case for switching it up. */
  const flatShare = sig.judged.length ? sig.flatOrStalled.length / sig.judged.length : 0;
  if (sig.judged.length >= 3 && flatShare >= 0.75 && sig.adherence >= 0.7) {
    /* On a deficit, strength that holds IS the win — don't tell a cutter to
       change a plan that's doing its job. The plateau engine will still call
       these lifts stalled (it can't see the deficit); the coach can. */
    const holding = (sig.goal === 'cut' || sig.goal === 'slowcut') && !sig.judged.some(l => l.declining);
    return holding ? 'holding' : 'grinding';
  }
  if (sig.prs28 >= 2 && sig.progressing.length >= Math.max(1, sig.judged.length * 0.4)) return 'roll';
  return 'steady';
}

/* ---------- 3. words ----------
   Each state has a few variants per voice so the coach doesn't repeat itself
   verbatim, chosen by week so a message is stable for the week it's about
   instead of reshuffling on every render. */
function pickVariant(list) {
  const week = Math.floor(daysBetween('2026-01-05', todayKey()) / 7);
  return list[((week % list.length) + list.length) % list.length];
}
function listNames(lifts, max = 2) {
  const n = lifts.slice(0, max).map(l => l.name);
  if (lifts.length > max) return `${n.join(', ')} and ${lifts.length - max} more`;
  return n.length === 2 ? `${n[0]} and ${n[1]}` : (n[0] || '');
}
function plural(n, one, many) { return `${n} ${n === 1 ? one : many || one + 's'}`; }

const COACH_COPY = {
  starting: {
    encouraging: [f => ({ h: `${plural(f.sessions, 'session')} in — the foundation's going in`, b: `Peak is learning how you train. Log each lift ${f.watchNeed} more time${f.watchNeed === 1 ? '' : 's'} and it starts calling your plateaus for you.` })],
    straight:    [f => ({ h: `${plural(f.sessions, 'session')} logged`, b: `Peak needs about four sessions per lift before it can judge progress. ${f.watchNeed ? `${f.watchNeed} to go on your next lift.` : 'Nearly there.'} Consistency is the whole job right now.` })],
    drill:       [f => ({ h: `${plural(f.sessions, 'session')}. That's a start, not a streak.`, b: `Four sessions per lift before Peak can judge you. Stack them up.` })]
  },
  roll: {
    encouraging: [f => ({ h: `${plural(f.prs, 'PR')} in the last four weeks 🔥`, b: `${f.names} ${f.progN === 1 ? 'is' : 'are'} climbing. Whatever you're doing — the sleep, the food, the showing up — it's working. Keep it exactly like this.` }),
                  f => ({ h: `You're on a roll`, b: `${plural(f.prs, 'personal best')} this month across ${f.names}. This is what a good block feels like — enjoy it.` })],
    straight:    [f => ({ h: `${plural(f.prs, 'PR')} in four weeks`, b: `${f.names} ${f.progN === 1 ? 'is' : 'are'} progressing. Don't change anything that's working.` }),
                  f => ({ h: `Momentum is good`, b: `${plural(f.prs, 'PR')} this month. Keep the plan, keep the sleep, keep the protein.` })],
    drill:       [f => ({ h: `${plural(f.prs, 'PR')}. Good. Now do it again.`, b: `${f.names} ${f.progN === 1 ? 'is' : 'are'} moving. Nobody gets to coast — earn the next one.` })]
  },
  grinding: {
    encouraging: [f => ({ h: `You've been putting in the work — let's make it pay`, b: `You've hit ${f.adherencePct}% of your sessions, but ${f.names} ${f.flatN === 1 ? "hasn't" : "haven't"} moved in a while. That's not effort, that's your body adapting. A change of stimulus usually wakes things up.` })],
    straight:    [f => ({ h: `Flat for a while — switch it up`, b: `${f.flatN} of ${f.judgedN} lifts have gone quiet (${f.names}) while you've made ${f.adherencePct}% of sessions. You're showing up; the program has stopped working. Change the stimulus.` }),
                  f => ({ h: `Same plan, same numbers`, b: `${f.names}: no real progress lately, and it isn't attendance. Time for a new block.` })],
    drill:       [f => ({ h: `Same weights, week after week. Enough.`, b: `${f.names} ${f.flatN === 1 ? 'is' : 'are'} stuck. You're turning up — now change the plan and make it hurt in a new way.` })]
  },
  holding: {
    encouraging: [f => ({ h: `Strength holding on a cut — that's a win`, b: `Most people lose strength in a deficit. You're keeping ${f.names} where ${f.judgedN === 1 ? 'it is' : 'they are'}. Protect it: protein and sleep are doing the heavy lifting now.` })],
    straight:    [f => ({ h: `Holding strength in a deficit`, b: `Flat numbers on a cut are the goal, not a problem. Keep protein high and don't chase PRs until you're back at maintenance.` })],
    drill:       [f => ({ h: `You're cutting and you're not getting weaker. Good.`, b: `Hold the line. Hit your protein. PRs come back when the food does.` })]
  },
  drifting: {
    encouraging: [f => ({ h: f.daysSince >= 7 ? `It's been ${plural(f.daysSince, 'day')} — let's ease back in` : `Life's been busy — that's okay`, b: `You don't need a perfect week. One short session keeps the habit alive — even just the first three lifts of ${f.nextDay}.` })],
    straight:    [f => ({ h: f.daysSince >= 7 ? `${plural(f.daysSince, 'day')} since your last session` : `Sessions are slipping`, b: `${f.recentPerWeek} a week lately against a plan of ${f.planned}. Either do a short session today, or change the plan to one you'll actually keep.` })],
    drill:       [f => ({ h: f.daysSince >= 7 ? `${plural(f.daysSince, 'day')}. Where have you been?` : `You're skipping sessions.`, b: `Excuses don't build muscle. Three lifts. Today. No negotiating.` })]
  },
  rundown: {
    encouraging: [f => ({ h: `Your body's asking for a breather`, b: `Session scores have dipped${f.lowSleep ? ` and sleep's averaging ${f.sleepText}` : ''}${f.lowProtein ? `${f.lowSleep ? ',' : ' and'} protein's been short most days` : ''}. An easier week now sets up a strong one next.` })],
    straight:    [f => ({ h: `Recovery is the bottleneck`, b: `Scores are down ${f.scoreDrop} points${f.lowSleep ? `, sleep is ${f.sleepText} a night` : ''}${f.lowProtein ? `, protein hit on only ${f.proteinHit} of ${f.proteinLogged} days` : ''}. Fix that before adding load — or take a lighter week.` })],
    drill:       [f => ({ h: `You're running on empty.`, b: `${f.lowSleep ? `${f.sleepText} of sleep. ` : ''}${f.lowProtein ? 'Protein missed. ' : ''}No wonder the numbers dropped. Sleep, eat, then we train.` })]
  },
  comeback: {
    encouraging: [f => ({ h: `Welcome back 💪`, b: `After a break, strength comes back much faster than it was built. Peak won't call any plateaus while you rebuild — just train.` })],
    straight:    [f => ({ h: `Rebuilding after a break`, b: `Expect a few sessions below your old numbers. Plateau calls are paused until you're back to full training.` })],
    drill:       [f => ({ h: `Back. Good. Don't ego-lift.`, b: `Your old numbers come back in a few weeks if you respect the ramp. Train smart, then train hard.` })]
  },
  steady: {
    encouraging: [f => ({ h: `Steady progress`, b: `${f.progN ? `${f.names} ${f.progN === 1 ? 'is' : 'are'} moving. ` : ''}Keep stacking sessions.` })],
    straight:    [f => ({ h: `On plan`, b: `${f.progN ? `${f.names} progressing. ` : ''}Nothing needs changing this week.` })],
    drill:       [f => ({ h: `Fine. Keep going.`, b: `Steady is good. Better is better.` })]
  }
};

/* the facts every voice gets — the same numbers whatever the wording */
function coachFacts(sig, state) {
  const dur = sig.sleep7.avgMin;
  const firstWatch = sig.lifts.filter(l => l.status === 'new').sort((a, b) => b.sessions - a.sessions)[0];
  return {
    sessions: sig.totalSessions,
    watchNeed: firstWatch ? Math.max(0, 4 - firstWatch.sessions) : 0,
    prs: sig.prs28,
    names: listNames(['roll', 'steady'].includes(state) ? sig.progressing : sig.flatOrStalled),
    progN: sig.progressing.length, flatN: sig.flatOrStalled.length, judgedN: sig.judged.length,
    adherencePct: Math.round(Math.min(1, sig.adherence) * 100),
    daysSince: sig.daysSinceLast || 0,
    recentPerWeek: Math.round(sig.recent2 * 10) / 10,
    planned: sig.planned,
    nextDay: (() => { try { return activeRoutine().days[nextDayIndex()].name; } catch { return 'your next day'; } })(),
    lowSleep: sig.sleep7.nights >= 4 && dur < SLEEP_BANDS.short,
    sleepText: dur ? `${Math.floor(dur / 60)}h${String(dur % 60).padStart(2, '0')}` : '',
    lowProtein: sig.proteinLogged >= 4 && sig.proteinHit < sig.proteinLogged / 2,
    proteinHit: sig.proteinHit, proteinLogged: sig.proteinLogged,
    scoreDrop: sig.scoreRecent != null && sig.scorePrior != null ? Math.round(sig.scorePrior - sig.scoreRecent) : 0
  };
}

const COACH_ACTIONS = {
  starting: () => null,
  roll: () => null,
  steady: () => null,
  holding: () => null,
  comeback: () => ({ label: 'Start workout', action: 'quick-train' }),
  grinding: () => ({ label: 'Switch it up', action: 'coach-switch', dismiss: { label: 'Keep my routine', days: 28 } }),
  drifting: () => ({ label: 'Quick 3-lift session', action: 'coach-short', dismiss: { label: 'Not now', days: 3 } }),
  rundown: () => ({ label: 'Take a lighter week', action: 'coach-deload', dismiss: { label: 'Not now', days: 7 } })
};

/* → {state, tone, headline, body, action, facts} or null when the coach has
   nothing worth saying (no history, or you told it "not now") */
function coachInsight(voice) {
  const sig = coachSignals();
  const state = coachState(sig);
  if (state === 'empty' || coachSnoozed(state)) return null;
  const facts = coachFacts(sig, state);
  const v = COACH_VOICE_IDS.includes(voice) ? voice : coachVoice();
  const words = pickVariant(COACH_COPY[state][v])(facts);
  const tone = { roll: 'good', holding: 'good', comeback: 'good', starting: '', steady: '',
    grinding: 'warn', drifting: 'warn', rundown: 'warn' }[state];
  return { state, tone, headline: words.h, body: words.b, action: COACH_ACTIONS[state](), facts, signals: sig };
}

/* ---------- the post-workout debrief ----------
   One verdict per lift, in plain words, from the same `beats` rule the plateau
   engine uses — so "that's progress" here and "no PR" on Train can never
   disagree about the same session. */
function debriefLift(name, date) {
  const hist = exerciseHistory(name);
  let idx = -1;
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i].date === date) { idx = i; break; }
  if (idx < 0) return null;
  const h = hist[idx];
  const prior = hist.slice(0, idx);
  const u = wUnit();
  const w = kg => `${Math.round(toW(kg) * 10) / 10} ${u}`;
  const since = historySinceLayoff(hist.slice(0, idx + 1));
  const watch = h.bestE1rm > 0 && since.length < 4
    ? `Plateau watch starts in ${plural(4 - since.length, 'more session')}.` : '';

  if (!prior.length) return { name, kind: 'baseline', text: 'First time logged — that’s your baseline.', watch };

  const topKg = Math.max(0, ...h.sets.map(s => s.weight || 0));
  if (topKg <= 0) {   // bodyweight: reps are the whole story
    const now = Math.max(...h.sets.map(s => s.reps));
    const best = Math.max(0, ...prior.flatMap(p => p.sets.map(s => s.reps)));
    return now > best ? { name, kind: 'pr', text: `${now} reps — a new best.` }
      : { name, kind: now === best ? 'matched' : 'below', text: now === best ? `Matched your best of ${best} reps.` : `${now} reps (best ${best}).` };
  }

  const prevBest = Math.max(...prior.map(p => p.bestE1rm));
  if (h.bestE1rm > prevBest * 1.0001) {
    return { name, kind: 'pr', text: `New best — est. max ${w(h.bestE1rm)} (+${w(h.bestE1rm - prevBest)}).`, watch };
  }
  if (beats(h, prior, 1.0001)) {
    // the load where you out-did every earlier session, and by how much
    let bestGain = 0, at = topKg;
    h.sets.forEach(st => {
      if (!(st.weight > 0)) return;
      const gain = repsAtOrAbove(h, st.weight) - Math.max(...prior.map(p => repsAtOrAbove(p, st.weight)));
      if (gain > bestGain) { bestGain = gain; at = st.weight; }
    });
    return { name, kind: 'pr', text: `+${plural(bestGain, 'rep')} at ${w(at)} — more than you've ever done there. That's progress.`, watch };
  }

  /* compare with the last time you did this lift at the same prescription */
  const tgt = parseTarget(h.target);
  const sameFound = tgt ? [...prior].reverse().find(p => parseTarget(p.target)?.reps === tgt.reps) : null;
  const same = sameFound || prior[prior.length - 1];
  const thenKg = Math.max(0, ...same.sets.map(s => s.weight || 0));
  const stalled = detectPlateaus().find(p => p.name.toLowerCase() === name.toLowerCase());
  const stallNote = stalled ? ` ${plural(stalled.sessions, 'session')} without a PR — Train has the plan.` : '';
  if (topKg > thenKg + 0.01) return { name, kind: 'up', text: `Up ${w(topKg - thenKg)} from last time.`, watch };
  if (Math.abs(topKg - thenKg) <= 0.01) {
    const diff = repsAtOrAbove(h, topKg) - repsAtOrAbove(same, topKg);
    if (diff > 0) return { name, kind: 'up', text: `+${plural(diff, 'rep')} at ${w(topKg)} on last time.`, watch };
    if (diff === 0) return { name, kind: 'matched', text: `Matched last time at ${w(topKg)}.${stallNote}`, watch };
    return { name, kind: 'below', text: `${plural(-diff, 'rep')} short of last time at ${w(topKg)}.${stallNote}`, watch };
  }
  // lighter, and there's no earlier session at this prescription: it's the other day's scheme
  if (!sameFound && tgt && parseTarget(same.target)?.reps !== tgt.reps) {
    return { name, kind: 'light', text: 'Lighter day, as planned.', watch };
  }
  return { name, kind: 'below', text: `Lighter than last time (${w(thenKg)}).${stallNote}`, watch };
}

function sessionDebrief(session) {
  return (session.exercises || []).map(ex => debriefLift(ex.name, session.date)).filter(Boolean);
}

/* ---------- lift goals and outlook ----------
   "When will I bench 225×5?" answered from your own trend, honestly: a robust
   fit (Theil–Sen — the median of every pairwise slope, so one great or awful
   day can't swing it), a range from how consistent those slopes are, and no
   projection at all when there's no trend to project. */
const OUTLOOK_WINDOW = 56;       // fit the last 8 weeks
const OUTLOOK_MIN_SESSIONS = 4;
const OUTLOOK_MIN_SPAN = 21;
const OUTLOOK_MAX_DAYS = 730;    // past two years it isn't a forecast, it's a guess

function getLiftGoals() {
  const g = Store.get('liftGoals', {});
  return g && typeof g === 'object' && !Array.isArray(g) ? g : {};
}
function liftGoal(name) {
  const g = getLiftGoals()[progKey(name)];
  if (!g || !(g.kg > 0) || !(g.reps >= 1)) return null;
  return { kg: g.kg, reps: g.reps, by: typeof g.by === 'string' ? g.by : null, set: g.set || null };
}
function setLiftGoal(name, goal) {
  const all = { ...getLiftGoals() };
  if (goal) all[progKey(name)] = { kg: goal.kg, reps: goal.reps, by: goal.by || null, set: todayKey() };
  else delete all[progKey(name)];
  Store.set('liftGoals', all);
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
/* pts: [{x (days), y}] → {slope, intercept, lo, hi} with lo/hi the quartile slopes */
function theilSen(pts) {
  const slopes = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (pts[j].x !== pts[i].x) slopes.push((pts[j].y - pts[i].y) / (pts[j].x - pts[i].x));
  }
  if (!slopes.length) return null;
  slopes.sort((a, b) => a - b);
  const slope = quantile(slopes, 0.5);
  const ints = pts.map(p => p.y - slope * p.x).sort((a, b) => a - b);
  return { slope, intercept: quantile(ints, 0.5), lo: quantile(slopes, 0.25), hi: quantile(slopes, 0.75) };
}

/* → {status, ...}. status: 'nogoal' | 'reached' | 'short' (not enough data)
   | 'flat' (no upward trend) | 'far' | 'ok'. Everything in kg of est. max. */
function liftOutlook(name) {
  const goal = liftGoal(name);
  const full = exerciseHistory(name).filter(h => h.bestE1rm > 0);
  const today = todayKey();
  const hist = historySinceLayoff(full).filter(h => daysBetween(h.date, today) <= OUTLOOK_WINDOW);
  const points = hist.map(h => ({ x: -daysBetween(h.date, today), y: h.bestE1rm, date: h.date }));
  const base = { name, goal, points, goalE1rm: goal ? e1rm(goal.kg, goal.reps) : null };
  if (!goal) return { ...base, status: 'nogoal' };
  const best = full.length ? Math.max(...full.map(h => h.bestE1rm)) : 0;
  if (best >= base.goalE1rm) return { ...base, status: 'reached', best };
  const span = points.length ? points[points.length - 1].x - points[0].x : 0;
  if (points.length < OUTLOOK_MIN_SESSIONS || span < OUTLOOK_MIN_SPAN) {
    return { ...base, status: 'short', need: Math.max(0, OUTLOOK_MIN_SESSIONS - points.length), best };
  }
  const fit = theilSen(points);
  if (!fit) return { ...base, status: 'short', need: 1, best };
  const now = fit.intercept;                       // fitted value today (x = 0)
  // under ~0.1% a week isn't a trend worth projecting — it's noise around flat
  if (fit.slope * 7 <= now * 0.001) return { ...base, status: 'flat', fit, best };
  const days = (base.goalE1rm - now) / fit.slope;
  const daysAt = s => s > 0 ? (base.goalE1rm - now) / s : Infinity;
  const fast = daysAt(fit.hi), slow = daysAt(fit.lo);
  if (days > OUTLOOK_MAX_DAYS) return { ...base, status: 'far', fit, best, days: Math.round(days) };
  const out = {
    ...base, status: 'ok', fit, best, now,
    days: Math.max(0, Math.round(days)),
    eta: todayKey(Math.max(0, Math.round(days))),
    etaEarly: todayKey(Math.max(0, Math.round(fast))),
    etaLate: slow <= OUTLOOK_MAX_DAYS ? todayKey(Math.round(slow)) : null,
    perWeekKg: fit.slope * 7
  };
  if (goal.by) out.vsTargetDays = daysBetween(goal.by, out.eta);   // + = late, − = early
  return out;
}
