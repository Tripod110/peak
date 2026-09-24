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
  const full = exerciseHistory(name).filter(h => !h.deload);
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
    straight:    [f => ({ h: `${plural(f.sessions, 'session')} logged`, b: `Peak needs about four sessions per lift before it can judge progress. ${f.watchNeed ? `Log your next lift ${f.watchNeed} more time${f.watchNeed === 1 ? '' : 's'} to get there.` : 'Keep logging — you\'re nearly there.'}` })],
    drill:       [f => ({ h: `${plural(f.sessions, 'session')}. That's a start, not a streak.`, b: `Four sessions per lift before Peak can judge you. Stack them up.` })]
  },
  roll: {
    encouraging: [f => ({ h: `${plural(f.prs, 'PR')} in the last four weeks 🔥`, b: `${f.names} ${f.progN === 1 ? 'is' : 'are'} climbing — the sleep, the food and the showing up are working. Keep it exactly like this.` }),
                  f => ({ h: `You're on a roll`, b: `${plural(f.prs, 'personal best')} this month across ${f.names}. This is what a good block feels like — enjoy it.` })],
    straight:    [f => ({ h: `${plural(f.prs, 'PR')} in four weeks`, b: `${f.names} ${f.progN === 1 ? 'is' : 'are'} progressing. Don't change anything that's working.` }),
                  f => ({ h: `Momentum is good`, b: `${plural(f.prs, 'PR')} this month. Keep the plan, keep the sleep, keep the protein.` })],
    drill:       [f => ({ h: `${plural(f.prs, 'PR')}. Good. Now do it again.`, b: `${f.names} ${f.progN === 1 ? 'is' : 'are'} moving. Nobody gets to coast — earn the next one.` })]
  },
  grinding: {
    encouraging: [f => ({ h: `You've been putting in the work — let's make it pay`, b: `${f.names} ${f.flatN === 1 ? "hasn't" : "haven't"} moved despite ${f.adherencePct}% attendance. That's adaptation, not effort — change the stimulus.` })],
    straight:    [f => ({ h: `Flat for a while — switch it up`, b: `${f.flatN} of ${f.judgedN} lifts are flat (${f.names}) at ${f.adherencePct}% attendance. You're showing up — change the program.` }),
                  f => ({ h: `Same plan, same numbers`, b: `${f.names}: no real progress lately, and it isn't attendance. Time for a new block.` })],
    drill:       [f => ({ h: `Same weights, week after week. Enough.`, b: `${f.names} ${f.flatN === 1 ? 'is' : 'are'} stuck. You're turning up — now change the plan and make it hurt in a new way.` })]
  },
  holding: {
    encouraging: [f => ({ h: `Strength holding on a cut — that's a win`, b: `You're keeping ${f.names} where ${f.judgedN === 1 ? 'it is' : 'they are'} — most people can't in a deficit. Protein and sleep protect it.` })],
    straight:    [f => ({ h: `Holding strength in a deficit`, b: `Flat numbers on a cut are the goal, not a problem. Keep protein high and don't chase PRs until you're back at maintenance.` })],
    drill:       [f => ({ h: `You're cutting and you're not getting weaker. Good.`, b: `Hold the line and hit your protein. PRs come back when the food does.` })]
  },
  drifting: {
    encouraging: [f => ({ h: f.daysSince >= 7 ? `It's been ${plural(f.daysSince, 'day')} — let's ease back in` : `Life's been busy — that's okay`, b: `You don't need a perfect week. One short session keeps the habit alive — even just the first three lifts of ${f.nextDay}.` })],
    straight:    [f => ({ h: f.daysSince >= 7 ? `${plural(f.daysSince, 'day')} since your last session` : `Sessions are slipping`, b: `${f.recentPerWeek} a week lately against a plan of ${f.planned}. Either do a short session today, or change the plan to one you'll actually keep.` })],
    drill:       [f => ({ h: f.daysSince >= 7 ? `${plural(f.daysSince, 'day')}. Where have you been?` : `You're skipping sessions.`, b: `Excuses don't build muscle. Three lifts, today, no negotiating.` })]
  },
  rundown: {
    encouraging: [f => ({ h: `Your body's asking for a breather`, b: `Session scores have dipped${f.lowSleep ? ` and sleep's averaging ${f.sleepText}` : ''}${f.lowProtein ? `${f.lowSleep ? ',' : ' and'} protein's been short most days` : ''}. An easier week now sets up a strong one next.` })],
    straight:    [f => ({ h: `Recovery is the bottleneck`, b: `Scores are down ${f.scoreDrop} points${f.lowSleep ? `, sleep is ${f.sleepText} a night` : ''}${f.lowProtein ? `, protein hit on only ${f.proteinHit} of ${f.proteinLogged} days` : ''}. Fix that before adding load — or take a lighter week.` })],
    drill:       [f => ({ h: `You're running on empty.`, b: `No wonder the numbers dropped${f.lowSleep ? ` on ${f.sleepText} of sleep` : ''}${f.lowProtein ? `${f.lowSleep ? ' and' : ' on'} missed protein` : ''}. Sleep, eat, then we train.` })]
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
  // a planned lighter week is judged as what it is, and never used as the bar to beat
  if (h.deload) return { name, kind: 'light', text: 'Lighter week, as planned.' };
  const prior = hist.slice(0, idx).filter(p => !p.deload);
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
  // lighter because Peak prescribed a deload: that's the plan working, not a bad day
  if (stalled) return { name, kind: 'light', text: 'Deload, as planned — build back up from here.', watch };
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
  const full = exerciseHistory(name).filter(h => h.bestE1rm > 0 && !h.deload);
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

/* ======================================================================
   UI. Everything above is data; everything below renders it. Strings from
   history (lift names) are user data, so every interpolation goes through
   esc() — see D-17.
   ====================================================================== */

/* ---------- deload week ----------
   The one coach action that changes prescriptions. It lives in coachMemory as
   an end date, nextTarget reads it, and sessions trained during it are marked
   so progression and plateau watch step over them afterwards — a planned
   lighter week must not read as "you got weaker" or "you've stalled". */
function coachDeloadActive() {
  const until = getCoachMemory().deloadUntil;
  return typeof until === 'string' && until >= todayKey();
}
function startDeloadWeek() {
  const prev = getCoachMemory().deloadUntil || null;
  setCoachMemory({ deloadUntil: todayKey(6) });
  snoozeCoach('rundown', 10);
  destructive('coach-deload', { prev }, 'Lighter week on — every lift ~10% down with a set less, for 7 days');
}
function endDeloadWeek() {
  const m = { ...getCoachMemory() };
  delete m.deloadUntil;
  Store.set('coachMemory', m);
}
registerUndo('coach-deload', u => {
  const m = { ...getCoachMemory() };
  if (u.prev) m.deloadUntil = u.prev; else delete m.deloadUntil;
  if (m.snooze) delete m.snooze.rundown;
  Store.set('coachMemory', m);
});

/* ---------- Today: the coach line ---------- */
function renderCoachLine() {
  const i = coachInsight();
  const deload = coachDeloadActive()
    ? `<div class="coach-sub">Lighter week until ${esc(prettyDate(getCoachMemory().deloadUntil))} · <button class="link-btn" data-action="coach-deload-end">End it early</button></div>` : '';
  if (!i) return deload ? `<section class="card coach-card" aria-label="Coach">${deload}</section>` : '';
  return `
  <section class="card coach-card ${i.tone}" aria-label="Coach">
    <div class="eyebrow coach-eyebrow">Coach</div>
    <b class="coach-h">${esc(i.headline)}</b>
    <p class="coach-b">${esc(i.body)}</p>
    ${deload}
    ${i.action ? `<div class="row coach-actions">
      <button class="btn small primary" data-action="${i.action.action}">${esc(i.action.label)}</button>
      ${i.action.dismiss ? `<button class="btn small ghost" data-action="coach-snooze" data-state="${i.state}" data-days="${i.action.dismiss.days}">${esc(i.action.dismiss.label)}</button>` : ''}
    </div>` : ''}
  </section>`;
}

/* ---------- post-workout debrief ---------- */
const DEBRIEF_ICON = { pr: '▲', up: '▲', matched: '=', light: '·', below: '▽', baseline: '·' };
function openDebrief(saved) {
  const rows = sessionDebrief(saved);
  const i = coachInsight();
  const prs = rows.filter(r => r.kind === 'pr').length;
  const goalRows = rows.map(r => {
    const o = liftOutlook(r.name);
    if (o.status === 'ok') return `<div class="db-goal">${esc(r.name)} → ${esc(fmtGoal(o.goal))} around <b>${esc(shortDate(o.eta))}</b> at this pace</div>`;
    if (o.status === 'reached') return `<div class="db-goal good">🎯 ${esc(r.name)}: goal ${esc(fmtGoal(o.goal))} reached. Set the next one from “Why this target?”.</div>`;
    return '';
  }).join('');
  openModal(`
    <h3>${prs ? `${plural(prs, 'PR')} today 🎉` : 'Workout saved 💪'}</h3>
    <div class="modal-sub">${esc(saved.dayName || 'Workout')} · score ${saved.score}/100${saved.durationMin ? ` · ${saved.durationMin} min` : ''}${saved.deloadWeek ? ' · lighter week' : ''}</div>
    <ul class="debrief">
      ${rows.map(r => `
      <li class="db-${r.kind}">
        <span class="db-ico" aria-hidden="true">${DEBRIEF_ICON[r.kind] || '·'}</span>
        <span><b>${esc(r.name)}</b> ${esc(r.text)}${r.watch ? `<span class="db-watch"> ${esc(r.watch)}</span>` : ''}</span>
      </li>`).join('')}
    </ul>
    ${goalRows}
    ${i && i.state !== 'steady' ? `<div class="db-coach"><b>${esc(i.headline)}</b> ${esc(i.body)}</div>` : ''}
    <button class="btn primary mt" data-action="close-modal">Done</button>
  `, { label: 'Workout debrief' });
}

/* ---------- switch it up ----------
   Concrete, one-tap changes to the routine, each undoable. Only offered for
   lifts that are actually in the routine and actually flat. */
const VARIATION_WORDS = ['bench', 'squat', 'deadlift', 'press', 'row', 'curl', 'pulldown', 'pull', 'raise', 'lunge', 'fly', 'extension', 'thrust'];
function variationFor(name, inRoutine) {
  const lib = libEntry(name);
  const group = lib ? lib.group : musclesFor(name).p[0];
  if (!group || !LIB[group]) return null;
  const words = VARIATION_WORDS.filter(wd => name.toLowerCase().includes(wd));
  const options = LIB[group].filter(e => e.n.toLowerCase() !== name.toLowerCase() && !inRoutine.has(e.n.toLowerCase()));
  const pick = options.find(e => words.some(wd => e.n.toLowerCase().includes(wd))) || options[0];
  return pick ? pick.n : null;
}
function switchPlan() {
  const sig = coachSignals();
  const r = activeRoutine();
  const inRoutine = new Set(r.days.flatMap(d => d.ex.map(e => e[0].toLowerCase())));
  const flat = new Set(sig.flatOrStalled.map(l => l.name.toLowerCase()));
  const swaps = [], reps = [];
  r.days.forEach((d, di) => d.ex.forEach(([n, t], ei) => {
    if (!flat.has(n.toLowerCase())) return;
    const alt = variationFor(n, inRoutine);
    if (alt && swaps.length < 3) { swaps.push({ di, ei, from: n, to: alt }); inRoutine.add(alt.toLowerCase()); }
    const tg = parseTarget(t);
    if (tg && reps.length < 4) reps.push({ di, ei, name: n, day: d.name, from: t, to: `${tg.sets}×${tg.reps <= 6 ? 10 : 6}` });
  }));
  // a lift on two days needs its day named, or the sheet lists it twice with no way to tell them apart
  const dup = new Set(reps.map(x => x.name.toLowerCase()).filter((n, i, a) => a.indexOf(n) !== i));
  reps.forEach(x => { x.label = dup.has(x.name.toLowerCase()) ? `${x.name} (${x.day})` : x.name; });
  return { swaps, reps };
}
function openCoachSwitch() {
  const { swaps, reps } = switchPlan();
  openModal(`
    <h3>Switch it up</h3>
    <div class="modal-sub">Pick one. Each is a change to your routine you can undo, and the coach checks back in a few weeks.</div>
    ${swaps.length ? `
    <button class="coach-opt" data-action="coach-apply" data-kind="swap">
      <b>Swap in variations</b>
      <span>${swaps.map(s => `${esc(s.from)} → ${esc(s.to)}`).join(' · ')}</span>
      <em>New movements, same muscles. Usually unsticks a lift within a block.</em>
    </button>` : ''}
    ${reps.length ? `
    <button class="coach-opt" data-action="coach-apply" data-kind="reps">
      <b>Change the rep ranges</b>
      <span>${reps.map(s => `${esc(s.label)} ${esc(s.from)} → ${esc(s.to)}`).join(' · ')}</span>
      <em>Heavy lifts go lighter and longer, light ones heavier. A new stimulus without new exercises.</em>
    </button>` : ''}
    <button class="coach-opt" data-action="coach-apply" data-kind="deload">
      <b>Take a lighter week first</b>
      <span>Every lift ~10% down with a set less, for 7 days</span>
      <em>Sometimes you're not stuck, you're tired. Then come back to the same plan fresher.</em>
    </button>
    <button class="coach-opt" data-action="coach-apply" data-kind="split">
      <b>Try a different split</b>
      <span>Open your routine and pick another</span>
    </button>
    <button class="btn ghost mt" data-action="close-modal">Not now</button>
  `);
}
function applyCoachSwitch(kind) {
  closeModal();
  if (kind === 'deload') { startDeloadWeek(); App.render(); return; }
  if (kind === 'split') {
    snoozeCoach('grinding', 21);
    App.tab = 'train'; App.trainView = 'routine'; App._renderedTab = null; App.render(); return;
  }
  const prev = Store.get('routine', null);
  const { swaps, reps } = switchPlan();
  if (kind === 'swap') swaps.forEach(s => routineSwapExercise(s.di, s.ei, s.to));
  if (kind === 'reps') reps.forEach(s => routineSetTarget(s.di, s.ei, s.to));
  setCoachMemory({ lastSwitch: { date: todayKey(), kind } });
  snoozeCoach('grinding', 21);
  destructive('coach-switch', { prev: prev ? JSON.parse(JSON.stringify(prev)) : null },
    kind === 'swap' ? `Swapped in ${plural(swaps.length, 'variation')}` : `Changed ${plural(reps.length, 'rep range')}`);
  App.render();
}
registerUndo('coach-switch', u => {
  if (u.prev) Store.set('routine', u.prev); else Store.remove('routine');
  const m = { ...getCoachMemory() };
  delete m.lastSwitch;
  if (m.snooze) delete m.snooze.grinding;
  Store.set('coachMemory', m);
});

/* the drifting lifter's smaller ask: today's day, first three lifts only */
function startShortSession() {
  App.tab = 'train'; App.trainView = 'home';
  startWorkout(nextDayIndex(), false, { maxEx: 3 });
}

/* ---------- lift goals: the sheet section and the editor ---------- */
function goalSectionHtml(name) {
  if (!exerciseHasLoad(name)) return '';
  const o = liftOutlook(name);
  const u = wUnit();
  if (o.status === 'nogoal') {
    return `<div class="sheet-h">Goal</div>
      <p class="sheet-p muted">Set a target like ${esc(name)} 225×5 and Peak projects when you'll get there from your own trend.</p>
      <button class="btn" data-action="goal-edit" data-name="${esc(name)}">🎯 Set a goal</button>`;
  }
  let say = '';
  if (o.status === 'ok') {
    const pace = `${Math.round(toW(o.perWeekKg) * 10) / 10} ${u}/week`;
    const vs = o.vsTargetDays == null ? ''
      : o.vsTargetDays <= 0 ? ` That's ${plural(Math.max(1, Math.round(-o.vsTargetDays / 7)), 'week')} ahead of your ${shortDate(o.goal.by)} target.`
      : ` That's ${plural(Math.max(1, Math.round(o.vsTargetDays / 7)), 'week')} after your ${shortDate(o.goal.by)} target.`;
    say = `At your current pace (+${pace} on est. max) you'll hit ${fmtGoal(o.goal)} around ${shortDate(o.eta)} — likely between ${shortDate(o.etaEarly)} and ${o.etaLate ? shortDate(o.etaLate) : 'later'}.${vs}`;
  } else if (o.status === 'reached') say = `Goal reached — you've already done the equivalent of ${fmtGoal(o.goal)}. Time to set the next one.`;
  else if (o.status === 'short') say = `Log this lift ${plural(Math.max(1, o.need), 'more time')} over a few weeks and the projection appears.`;
  else if (o.status === 'flat') say = `Flat right now, so there's no honest date to give. The projection comes back as soon as you're climbing.`;
  else if (o.status === 'far') say = `At this pace it's over two years out — a closer goal, or switching things up, would help.`;
  return `<div class="sheet-h">Goal · ${esc(fmtGoal(o.goal))}${perHandLift(name) ? ' per hand' : ''}</div>
    ${outlookChart(o)}
    <p class="sheet-p">${esc(say)}</p>
    <div class="row" style="gap:8px">
      <button class="btn small" data-action="goal-edit" data-name="${esc(name)}">Edit goal</button>
      <button class="btn small ghost" data-action="goal-clear" data-name="${esc(name)}">Remove</button>
    </div>`;
}
function openGoalSheet(name) {
  const g = liftGoal(name);
  const u = wUnit();
  openModal(`
    <h3>Goal for ${esc(name)}</h3>
    <div class="modal-sub">Any weight × reps — Peak compares it on estimated max, so progress at other rep ranges still counts.</div>
    <div class="grid-2">
      <div><label for="goal-w">Weight (${u}${perHandLift(name) ? ' per hand' : ''})</label>
        <input id="goal-w" type="number" inputmode="decimal" value="${g ? Math.round(toW(g.kg) * 10) / 10 : ''}"></div>
      <div><label for="goal-r">Reps</label>
        <input id="goal-r" type="number" inputmode="numeric" value="${g ? g.reps : 5}"></div>
    </div>
    <label for="goal-by">By (optional)</label>
    <input id="goal-by" type="date" min="${todayKey(1)}" value="${g && g.by ? g.by : ''}">
    <button class="btn primary mt" data-action="goal-save" data-name="${esc(name)}">Save goal</button>
    <button class="btn ghost mt" data-action="why-target" data-name="${esc(name)}">Back</button>
  `);
}
function saveGoalFromSheet(name) {
  const w = Number(document.getElementById('goal-w')?.value);
  const reps = Math.round(Number(document.getElementById('goal-r')?.value));
  const by = document.getElementById('goal-by')?.value || null;
  if (!(w > 0)) { toast('Enter a goal weight'); return; }
  if (!(reps >= 1 && reps <= 30)) { toast('Reps between 1 and 30'); return; }
  setLiftGoal(name, { kg: fromW(w), reps, by: by && by > todayKey() ? by : null });
  toast(`Goal set: ${name} ${w}×${reps}`);
  openWhyTarget(name);
}

/* ---------- Settings: the voice picker ---------- */
function coachVoicePickerHtml() {
  const cur = coachVoice();
  return `
    <label>Coach voice</label>
    <div class="voice-picker" id="set-voice" role="radiogroup" aria-label="Coach voice">
      ${COACH_VOICES.map(v => `
      <button role="radio" aria-checked="${v.id === cur}" class="voice-opt ${v.id === cur ? 'on' : ''}" data-action="pick-voice" data-v="${v.id}">
        <b>${esc(v.label)}</b><span>“${esc(v.sample)}”</span>
      </button>`).join('')}
    </div>`;
}

/* ---------- the weekly check-in ----------
   Once a week the coach steps back and talks about the week as a whole: what
   you did against the plan, what moved, what to focus on. It replaces the
   day-to-day coach card while it's up, so the two never say the same thing
   twice, and "Got it" puts it away until next week. */

/* Monday of the week containing `key` (defaults to today), as YYYY-MM-DD */
function weekKeyOf(key = todayKey()) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return dateKey(dt);
}

function checkinDue() {
  const sessions = liftingSessions();
  if (sessions.length < 3) return false;                       // nothing to review yet
  if (daysBetween(sessions[sessions.length - 1].date, todayKey()) > 14) return false;
  return getCoachMemory().checkinSeen !== weekKeyOf();
}

/* The week in numbers, plus the words. Everything the AI version is allowed to
   mention is in `facts` — see coachAiGuard. */
function weeklyCheckin() {
  const sig = coachSignals();
  const state = coachState(sig);
  const f = coachFacts(sig, state);
  const words = pickVariant(COACH_COPY[state === 'empty' ? 'steady' : state][coachVoice()])(f);
  let prs7 = 0;
  sig.lifts.forEach(l => {
    const full = exerciseHistory(l.name).filter(h => !h.deload);
    for (let i = 1; i < full.length; i++) {
      if (daysBetween(full[i].date, todayKey()) < 7 && beats(full[i], full.slice(0, i), 1.0001)) prs7++;
    }
  });
  const goals = sig.lifts.map(l => liftOutlook(l.name)).filter(o => o.status === 'ok')
    .map(o => ({ name: o.name, goal: fmtGoal(o.goal), eta: shortDate(o.eta), weeksVsTarget: o.vsTargetDays == null ? null : Math.round(o.vsTargetDays / 7) }));
  const facts = {
    state, voice: coachVoice(),
    sessions7: sig.weeks[0], planned: sig.planned, prs7, prs28: sig.prs28,
    progressing: sig.progressing.map(l => l.name), flat: sig.flatOrStalled.map(l => l.name),
    sleepAvg: sig.sleep7.avgMin ? `${Math.floor(sig.sleep7.avgMin / 60)}h${String(sig.sleep7.avgMin % 60).padStart(2, '0')}` : null,
    proteinHitDays: sig.proteinLogged ? `${sig.proteinHit} of ${sig.proteinLogged}` : null,
    proteinStreak: proteinStreak(sig.proteinTarget),
    goals
  };
  // the week's weak link has its own row in Explore → This week; the check-in doesn't repeat it
  const rule = { headline: words.h, body: words.b };
  const ai = coachAiCached(facts);
  return { week: weekKeyOf(), facts, ...(ai || rule), aiWorded: !!ai, rule, action: COACH_ACTIONS[state] ? COACH_ACTIONS[state]() : null };
}

/* Consecutive days at ≥90% of the protein target, ending today if today already
   counts, else yesterday. The Protein tile shows today; this is the part it can't. */
function proteinStreak(target) {
  if (!target) return 0;
  const hit = i => dayTotals(todayKey(-i)).protein >= target * 0.9;
  let n = 0;
  for (let i = hit(0) ? 0 : 1; i < 90 && hit(i); i++) n++;
  return n;
}

function renderWeeklyCheckin() {
  if (!checkinDue()) return '';
  const c = weeklyCheckin();
  if (coachAiEnabled() && !c.aiWorded) requestCoachAi(c.facts, c.rule);
  const f = c.facts;
  const stat = (v, label) => `<div class="ck-stat"><b>${esc(v)}</b><span>${esc(label)}</span></div>`;
  return `
  <section class="card coach-card checkin" aria-label="Weekly check-in">
    <div class="eyebrow coach-eyebrow">Your week · from ${esc(shortDate(c.week))}</div>
    <div class="ck-stats">
      ${stat(String(f.prs7), f.prs7 === 1 ? 'PR' : 'PRs')}
      ${f.sleepAvg ? stat(f.sleepAvg, 'sleep, 7-day avg') : ''}
      ${f.proteinStreak >= 2 ? stat(`${f.proteinStreak} days`, 'protein streak') : ''}
    </div>
    <b class="coach-h">${esc(c.headline)}</b>
    <p class="coach-b">${esc(c.body)}</p>
    ${f.goals.map(g => `<div class="coach-sub">🎯 ${esc(g.name)} ${esc(g.goal)} ~${esc(g.eta)}${g.weeksVsTarget == null ? '' : g.weeksVsTarget <= 0 ? ' · on pace' : ` · ${g.weeksVsTarget} wk behind target`}</div>`).join('')}
    <div class="row coach-actions">
      ${c.action && c.action.action ? `<button class="btn small primary" data-action="${c.action.action}">${esc(c.action.label)}</button>` : ''}
      <button class="btn small ${c.action ? 'ghost' : 'primary'}" data-action="checkin-done">Got it</button>
    </div>
    ${c.aiWorded ? '<div class="coach-sub">Worded by Gemini from the numbers above</div>' : ''}
  </section>`;
}
function dismissCheckin() { setCoachMemory({ checkinSeen: weekKeyOf() }); }

/* ---------- optional: Gemini words the check-in ----------
   Off by default, and only with your own key (the same key scans use). What
   is sent is `facts` — the handful of numbers and lift names on the card —
   never your log. The reply is only accepted if every number and every lift
   name in it came from those facts; otherwise the rule-written version stays.
   The rules decide what's true; the model only gets to say it nicer. */
const COACH_AI_SCHEMA = {
  type: 'OBJECT',
  properties: { headline: { type: 'STRING' }, body: { type: 'STRING' } },
  required: ['headline', 'body']
};
function coachAiEnabled() { return !!getSettings().coachAi && !!getSettings().apiKey; }
function factsHash(facts) {
  const s = JSON.stringify(facts);
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return String(h);
}
function coachAiCached(facts) {
  if (!coachAiEnabled()) return null;
  const c = Store.get('coachWeekly', null);
  if (!c || c.week !== weekKeyOf() || c.hash !== factsHash(facts)) return null;
  return typeof c.headline === 'string' && typeof c.body === 'string' ? { headline: c.headline, body: c.body } : null;
}

/* every number and lift name the model used must be one we gave it */
function coachAiGuard(reply, facts) {
  if (!reply || typeof reply.headline !== 'string' || typeof reply.body !== 'string') return false;
  const text = `${reply.headline} ${reply.body}`;
  if (reply.headline.length > 90 || reply.body.length > 520) return false;
  const factText = JSON.stringify(facts);
  const allowedNums = new Set((factText.match(/\d+(\.\d+)?/g) || []));
  const nums = text.match(/\d+(\.\d+)?/g) || [];
  if (nums.some(n => !allowedNums.has(n))) return false;
  const known = new Set();
  getWorkouts().forEach(s => (s.exercises || []).forEach(ex => known.add(ex.name.toLowerCase())));
  const lower = text.toLowerCase();
  const allowedNames = factText.toLowerCase();
  for (const n of known) if (n.length > 3 && lower.includes(n) && !allowedNames.includes(n)) return false;
  return true;
}

let _coachAiInFlight = null;
async function requestCoachAi(facts, rule) {
  const week = weekKeyOf(), hash = factsHash(facts);
  if (_coachAiInFlight === hash) return;
  _coachAiInFlight = hash;
  try {
    const { apiKey, model } = getSettings();
    const voiceLine = { encouraging: 'warm and encouraging', straight: 'direct and honest, like a good gym coach', drill: 'a tough-love drill sergeant, blunt but never insulting' }[facts.voice] || 'direct';
    const prompt = `You are a strength coach writing a short weekly check-in for one lifter. Voice: ${voiceLine}.
Use ONLY the facts below. Do not add numbers, lifts or advice that are not in them. Do not give medical advice.
headline: at most 8 words. body: exactly 2 sentences, under 45 words — one thing observed, one thing to do, speaking to the lifter as "you".
The coach's verdict (keep its meaning and its advice): "${rule.headline} — ${rule.body}"
Facts: ${JSON.stringify(facts)}`;
    const res = await fetch(`${GEMINI}/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: COACH_AI_SCHEMA, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } }
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const txt = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    let reply;
    try { reply = JSON.parse(txt); } catch { return; }
    if (!coachAiGuard(reply, facts)) return;     // the rule-written version stays
    Store.set('coachWeekly', { week, hash, headline: reply.headline.trim(), body: reply.body.trim() });
    if (App.tab === 'today') App.render();
  } catch { /* offline, quota, anything: the rule-written check-in is already showing */ }
  finally { if (_coachAiInFlight === hash) _coachAiInFlight = null; }
}

function coachAiToggleHtml() {
  const s = getSettings();
  return `
    <label class="check-row"><input type="checkbox" id="set-coach-ai" data-action="toggle-coach-ai" ${s.coachAi ? 'checked' : ''} ${s.apiKey ? '' : 'disabled'}>
      <span>Let Gemini word the weekly check-in</span></label>
    <div class="chart-note">${s.apiKey
      ? 'Uses your key. Sends only the check-in’s numbers and lift names — never your log — and the reply is thrown out if it mentions anything that wasn’t in them.'
      : 'Needs a Gemini key (the same one scanning uses). Without it, the coach writes the check-in itself.'}</div>`;
}

/* ---------- Train: the coach, one line ---------- */
function renderCoachTrainLine() {
  const i = coachInsight();
  if (!i || !['grinding', 'drifting', 'rundown', 'comeback', 'roll'].includes(i.state)) return '';
  return `
  <div class="focus-line coach-line ${i.tone}">
    <span class="fc-ico" aria-hidden="true">${i.tone === 'good' ? '▲' : '●'}</span>
    <span class="fc-text"><b>${esc(i.headline)}</b></span>
    ${i.action ? `<button class="btn small" data-action="${i.action.action}">${esc(i.action.label)}</button>` : ''}
  </div>`;
}
