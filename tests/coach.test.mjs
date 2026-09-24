/* The Coach: signals → state → words, tested against whole training lives
 * rather than single lifts. Each persona is a month or two of realistic
 * history; the assertion is what a good coach would say about it. See
 * DECISIONS.md D-22.
 *
 *   node --test tests/*.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from './harness.mjs';

let ctx, P;
const localDay = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lb = v => v / 2.20462;

function seed(goal = 'recomp', gymDays = 3) {
  P.setProfile({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'light', goal, gymDays, template: 'fb3' });
  P.setSettings({ units: 'imperial', restSec: 90 });
}
beforeEach(() => { ctx = makeContext(); P = ctx.__api; seed(); });

/* a full-body session: each lift at `w(lift)` lb for 3×5, all reps hit */
const LIFTS = { 'Squat': 225, 'Bench Press': 185, 'Barbell Row': 155, 'Overhead Press': 115 };
function session(daysBack, bump = 0, { score = 80, reps = [5, 5, 5] } = {}) {
  P.saveWorkout({
    id: `s${daysBack}${Math.random()}`, date: localDay(daysBack), dayName: 'Full Body A', score,
    exercises: Object.entries(LIFTS).map(([name, w]) => ({
      name, target: '3×5', sets: reps.map(r => ({ weight: lb(w + bump), reps: r, type: 'normal' }))
    }))
  });
}
/* three sessions a week for `weeks` weeks ending `endBack` days ago */
function block(weeks, { endBack = 1, progress = 0, score = 80, reps } = {}) {
  let n = 0;
  for (let d = endBack + weeks * 7 - 1; d >= endBack; d--) {
    if (d % 7 === 0 || d % 7 === 2 || d % 7 === 4) session(d, progress * n++, { score, reps });
  }
}
const state = () => P.coachState(P.coachSignals());

/* ---------- states ---------- */

test('a new lifter is "getting started", and told how far off plateau watch is', () => {
  session(9); session(5); session(2);
  assert.equal(state(), 'starting');
  const i = P.coachInsight('straight');
  assert.equal(i.facts.watchNeed, 1);
  assert.equal(i.action, null, 'nothing to fix yet');
});

test('steady gains across the board read as "on a roll"', () => {
  block(6, { progress: 5 });
  assert.equal(state(), 'roll');
  assert.ok(P.coachInsight('straight').facts.prs >= 2);
});

test('six flat weeks with good attendance is "grinding", and the coach says switch it up', () => {
  block(6, { reps: [5, 5, 4] });
  assert.equal(state(), 'grinding');
  const i = P.coachInsight('straight');
  assert.equal(i.action.action, 'coach-switch');
  assert.match(i.body, /Squat|Bench|Row|Press/, 'names the lifts it means');
});

test('the same flat weeks on a cut are "holding" — a win, not a problem', () => {
  seed('cut');
  block(6, { reps: [5, 5, 4] });
  assert.equal(state(), 'holding');
  assert.equal(P.coachInsight('straight').action, null, 'never tells a cutter to change a working plan');
});

test('a lifter who stopped turning up is "drifting", and gets a smaller ask', () => {
  block(4, { endBack: 10, progress: 5 });
  assert.equal(state(), 'drifting');
  const i = P.coachInsight('straight');
  assert.equal(i.action.action, 'coach-short');
  assert.ok(i.facts.daysSince >= 10, 'says how long it has been');
});

test('sessions falling off without a full stop still reads as drifting', () => {
  block(2, { endBack: 15, progress: 5 });   // 3/week, then…
  session(4, 30);                             // one session in the last two weeks
  assert.equal(state(), 'drifting');
});

test('back from a layoff is "comeback" — no stall talk while rebuilding', () => {
  block(4, { endBack: 50, reps: [5, 5, 4] });   // would read as grinding…
  session(8); session(4); session(1);           // …but there was a 40-day break
  assert.equal(state(), 'comeback');
});

test('falling scores with short sleep is "run down", and points at recovery', () => {
  block(5, { endBack: 8, progress: 5, score: 85 });
  session(6, 125, { score: 60 }); session(4, 125, { score: 58 }); session(2, 125, { score: 55 });
  for (let d = 0; d < 7; d++) P.setSleepEntry(localDay(d), { bed: '01:00', wake: '06:30', durationMin: 330, quality: 2 });
  assert.equal(state(), 'rundown');
  const i = P.coachInsight('straight');
  assert.ok(i.facts.lowSleep);
  assert.equal(i.action.action, 'coach-deload');
});

/* ---------- voice and memory ---------- */

test('every voice gets the same facts and the same action — only the words change', () => {
  block(6, { reps: [5, 5, 4] });
  const [a, b, c] = P.COACH_VOICE_IDS.map(v => P.coachInsight(v));
  assert.deepEqual({ ...a.facts }, { ...b.facts });
  assert.deepEqual({ ...b.facts }, { ...c.facts });
  assert.equal(a.action.action, c.action.action);
  assert.notEqual(a.headline, c.headline);
});

test('"keep my routine" silences that message until the snooze runs out', () => {
  block(6, { reps: [5, 5, 4] });
  assert.ok(P.coachInsight());
  P.snoozeCoach('grinding', 28);
  assert.equal(P.coachInsight(), null);
});

test('coach memory and voice survive a backup round trip, and junk in them does not', () => {
  P.setSettings({ ...P.getSettings(), coachVoice: 'drill' });
  P.snoozeCoach('grinding', 28);
  const json = JSON.parse(P.Store.exportAll());
  json.data['forge:coachMemory'] = JSON.stringify({ snooze: { grinding: localDay(-28), '<img>': 'x' } });
  P.Store.importAll(JSON.stringify(json));
  assert.equal(P.getSettings().coachVoice, 'drill');
  assert.deepEqual(Object.keys(P.getCoachMemory().snooze), ['grinding']);
});

/* ---------- the post-workout debrief ---------- */

function bench(daysBack, w, reps, target = '3×5') {
  const date = localDay(daysBack);
  P.saveWorkout({ id: `b${daysBack}`, date, dayName: 'Full Body A', exercises: [
    { name: 'Bench Press', target, sets: reps.map(r => ({ weight: lb(w), reps: r, type: 'normal' })) }] });
  return date;
}

test('the debrief calls added reps progress, even with the weight unchanged', () => {
  bench(7, 185, [5, 5, 4]);
  const d = P.debriefLift('Bench Press', bench(0, 185, [5, 5, 5]));
  assert.equal(d.kind, 'pr');
  assert.match(d.text, /\+1 rep at 185 lb/);
});

test('the debrief names a new best, a match, a light day, and a first time', () => {
  assert.equal(P.debriefLift('Bench Press', bench(21, 185, [5, 5, 5])).kind, 'baseline');
  assert.equal(P.debriefLift('Bench Press', bench(14, 190, [5, 5, 5])).kind, 'pr');
  assert.equal(P.debriefLift('Bench Press', bench(7, 190, [5, 5, 5])).kind, 'matched');
  const light = P.debriefLift('Bench Press', bench(3, 155, [10, 10, 10], '3×10'));
  assert.equal(light.kind, 'light');
  assert.match(P.debriefLift('Bench Press', localDay(21)).watch, /3 more sessions/);
});

/* ---------- lift goals and outlook ---------- */

test('a steady climb projects a date to the goal, with a range', () => {
  // +5 lb a week on 3×5, from 185 to 210 over six weeks
  [42, 35, 28, 21, 14, 7, 0].forEach((d, i) => bench(d, 180 + i * 5, [5, 5, 5]));
  P.setLiftGoal('Bench Press', { kg: lb(225), reps: 5 });
  const o = P.liftOutlook('Bench Press');
  assert.equal(o.status, 'ok');
  // 210 → 225 at 5 lb/week is ~3 weeks; allow for the e1RM conversion
  assert.ok(o.days >= 14 && o.days <= 35, `projected ${o.days} days`);
  assert.ok(o.etaEarly <= o.eta && (!o.etaLate || o.etaLate >= o.eta));
});

test('no projection is invented when the lift is flat, too new, or already there', () => {
  P.setLiftGoal('Bench Press', { kg: lb(225), reps: 5 });
  bench(14, 185, [5, 5, 5]); bench(7, 185, [5, 5, 5]);
  assert.equal(P.liftOutlook('Bench Press').status, 'short');
  bench(28, 185, [5, 5, 5]); bench(21, 185, [5, 5, 5]); bench(0, 185, [5, 5, 5]);
  assert.equal(P.liftOutlook('Bench Press').status, 'flat');
  bench(1, 230, [5, 5, 5]);
  assert.equal(P.liftOutlook('Bench Press').status, 'reached');
  P.setLiftGoal('Bench Press', null);
  assert.equal(P.liftOutlook('Bench Press').status, 'nogoal');
});

test('Theil–Sen ignores one freak session', () => {
  const pts = [0, 7, 14, 21, 28, 35].map((x, i) => ({ x, y: 100 + i * 2 }));
  pts[3].y = 160;   // one absurd day
  const fit = P.theilSen(pts);
  assert.ok(Math.abs(fit.slope * 7 - 2) < 0.5, `slope ${fit.slope * 7}/week`);
});

test('lift goals are sanitised on restore', () => {
  P.setLiftGoal('Bench Press', { kg: lb(225), reps: 5, by: localDay(-60) });
  const json = JSON.parse(P.Store.exportAll());
  const g = JSON.parse(json.data['forge:liftGoals']);
  g['squat'] = { kg: '<b>', reps: 5 };
  json.data['forge:liftGoals'] = JSON.stringify(g);
  P.Store.importAll(JSON.stringify(json));
  assert.ok(P.liftGoal('Bench Press'));
  assert.equal(P.liftGoal('Squat'), null);
});

/* ---------- coach actions ---------- */

test('a lighter week drops every lift ~10% with a set less, and progression resumes from the real session', () => {
  bench(7, 200, [5, 5, 5]);
  P.startDeloadWeek();
  assert.equal(P.coachDeloadActive(), true);
  const t = P.nextTarget('Bench Press', '3×5');
  assert.equal(t.type, 'deload');
  assert.equal(t.w, 180);
  assert.equal(t.sets, 2);
  // a session trained during it is marked, and never becomes the new baseline
  P.saveWorkout({ id: 'dl', date: localDay(0), dayName: 'Full Body A', deloadWeek: true, exercises: [
    { name: 'Bench Press', target: '3×5', sets: [5, 5].map(r => ({ weight: lb(180), reps: r, type: 'normal' })) }] });
  assert.equal(P.debriefLift('Bench Press', localDay(0)).kind, 'light');
  P.undoLast();   // ends the lighter week
  assert.equal(P.coachDeloadActive(), false);
  assert.equal(P.nextTarget('Bench Press', '3×5').w, 205, 'builds from 200, not from the 180 week');
});

test('switch it up offers real variations for flat lifts, applies them, and undoes cleanly', () => {
  block(6, { reps: [5, 5, 4] });
  const before = JSON.stringify(P.activeRoutine());
  const plan = P.switchPlan();
  assert.ok(plan.swaps.length >= 1, 'at least one variation offered');
  plan.swaps.forEach(s => assert.notEqual(s.from.toLowerCase(), s.to.toLowerCase()));
  P.applyCoachSwitch('swap');
  const after = P.activeRoutine();
  assert.ok(after.days.some(d => d.ex.some(([n]) => n === plan.swaps[0].to)));
  assert.equal(P.coachInsight(), null, 'the coach gives the new block time before judging it');
  P.undoLast();
  assert.equal(JSON.stringify(P.activeRoutine()), before);
});

test('the drifting lifter\'s short session is the next day, first three lifts only', () => {
  P.startShortSession();
  assert.equal(P.App.activeSession.exercises.length, 3);
});

/* ---------- weekly check-in ---------- */

test('weeks start on Monday', () => {
  assert.equal(P.weekKeyOf('2026-09-22'), '2026-09-21');   // a Tuesday
  assert.equal(P.weekKeyOf('2026-09-27'), '2026-09-21');   // the Sunday after
  assert.equal(P.weekKeyOf('2026-09-28'), '2026-09-28');
});

test('the check-in appears once there is a week to review, and "Got it" puts it away until next week', () => {
  session(9); session(5);
  assert.equal(P.checkinDue(), false, 'two sessions is not a week to review');
  session(2);
  assert.equal(P.checkinDue(), true);
  const c = P.weeklyCheckin();
  assert.ok(c.headline && c.body);
  assert.equal(c.facts.planned, 3);
  P.dismissCheckin();
  assert.equal(P.checkinDue(), false);
});

test('an AI rewording is only accepted if every number and lift in it came from the facts', () => {
  block(6, { reps: [5, 5, 4] });
  const f = P.weeklyCheckin().facts;
  const n = f.sessions7;
  assert.equal(P.coachAiGuard({ headline: 'Time to shake things up', body: `You made ${n} sessions but Squat has gone quiet.` }, f), true);
  assert.equal(P.coachAiGuard({ headline: 'Shake it up', body: 'Add 20 lb to your squat next week.' }, f), false, 'invented number');
  P.saveWorkout({ id: 'x', date: localDay(60), dayName: 'Old', exercises: [{ name: 'Leg Press', target: '3×10', sets: [{ weight: lb(300), reps: 10, type: 'normal' }] }] });
  assert.equal(P.coachAiGuard({ headline: 'Nice week', body: 'Your leg press is flying.' }, P.weeklyCheckin().facts), false, 'a lift the facts never mentioned');
  assert.equal(P.coachAiGuard({ headline: 'x', body: 'y'.repeat(600) }, f), false, 'too long');
});

test('every coach message is at most two sentences — one observed, one to do', () => {
  const sentences = b => b.split(/(?<=[.!?])\s+/).filter(x => x.trim()).length;
  const base = { sessions: 5, watchNeed: 2, prs: 3, names: 'Squat and Bench Press', progN: 2, flatN: 2, judgedN: 4,
    adherencePct: 90, daysSince: 9, nextDay: 'Full Body A', recentPerWeek: 1, planned: 3,
    scoreDrop: 9, sleepText: '6h10', proteinHit: 2, proteinLogged: 6 };
  const variants = [{}, { lowSleep: true }, { lowProtein: true }, { lowSleep: true, lowProtein: true }, { watchNeed: 0, progN: 0, daysSince: 3 }];
  for (const [state, voices] of Object.entries(P.COACH_COPY))
    for (const [voice, list] of Object.entries(voices))
      list.forEach((fn, i) => variants.forEach(v => {
        const { b } = fn({ ...base, ...v });
        assert.ok(sentences(b) <= 2, `${state}/${voice}[${i}] ${JSON.stringify(v)}: "${b}"`);
      }));
});

test('lifts you never do on one day become one card with a row each, not a stack of cards', () => {
  const day = P.activeRoutine().days[0];
  const [kept, ...never] = day.ex.map(e => e[0]);
  for (let i = 0; i < 3; i++) P.saveWorkout({ id: `g${i}`, date: localDay(2 + i * 3), dayName: day.name,
    exercises: [{ name: kept, target: '3×5', sets: [{ weight: 60, reps: 5, type: 'normal' }] }] });
  const drops = P.coachSuggestions().filter(s => s.action === 'coach-drop-ex');
  assert.equal(drops.length, never.length, 'one suggestion per lift you skip');
  const html = P.renderCoachCard();
  assert.ok(!/Drop .* from /.test(html), 'no separate "Drop X?" cards');
  assert.equal(html.split('lifts you never do on').length - 1, 1, 'one card for the day');
  assert.match(html, new RegExp(`${never.length} lifts you never do on ${day.name}`));
  never.forEach(n => assert.ok(html.includes(`aria-label="Remove it: ${n}"`), `a row with its own action for ${n}`));
  assert.ok(!/one at a time/.test(html.split('coach-rows')[0].split('lifts you never do')[1] || ''), 'the grouped card doesn\'t say deal with them one at a time');
});
