/* Sleep's maths, which the v40 rebuild moves around but must not change.
 * These were written before that rebuild so a rewrite that quietly alters a
 * score shows up as a failure rather than as a number nobody checked.
 *
 *   node --test tests/*.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from './harness.mjs';

let ctx, P;
beforeEach(() => { ctx = makeContext(); P = ctx.__api; });

const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const night = (n, bed, wake, quality = 3) =>
  P.setSleepEntry(day(n), { bed, wake, quality, durationMin: P.sleepDurationMin(bed, wake) });

test('a night that crosses midnight is measured forwards, not backwards', () => {
  assert.equal(P.sleepDurationMin('23:30', '07:00'), 450);
  assert.equal(P.sleepDurationMin('01:15', '09:45'), 510);
  assert.equal(P.sleepDurationMin('07:00', '07:00'), 1440, 'bed == wake is a full day, not zero');
  assert.equal(P.sleepDurationMin('22:00', '05:30'), 450);
});

test('the duration curve ramps, holds through 8-9h, then tapers without a cliff', () => {
  assert.equal(P.sleepDurationPoints(240), 0);
  assert.equal(P.sleepDurationPoints(480), 60, '8h is full marks');
  assert.equal(P.sleepDurationPoints(540), 60, 'and so is 9h');
  assert.ok(P.sleepDurationPoints(479) > 59, 'one minute under 8h is not a ten-point drop');
  assert.ok(P.sleepDurationPoints(600) < 60 && P.sleepDurationPoints(600) >= 42);
  assert.equal(P.sleepDurationPoints(1200), 42, 'the taper has a floor');
  // monotonic up to 8h: no step anywhere on the ramp
  for (let d = 241; d <= 480; d += 7) assert.ok(P.sleepDurationPoints(d) >= P.sleepDurationPoints(d - 7));
});

test('consistency is bed AND wake, and stays neutral until there are three nights', () => {
  night(0, '23:00', '07:00'); night(1, '23:00', '07:00');
  assert.equal(P.sleepConsistency(day(0)).points, 7.5, 'two nights says nothing either way');

  night(2, '23:00', '07:00');
  const tight = P.sleepConsistency(day(0));
  assert.equal(tight.points, 15, 'same times three nights running is full marks');
  assert.equal(tight.bedSd, 0);

  ctx = makeContext(); P = ctx.__api;
  night(0, '23:00', '06:00'); night(1, '23:00', '11:00'); night(2, '23:00', '06:30');
  const drifting = P.sleepConsistency(day(0));
  assert.ok(drifting.points < 15, 'a steady bedtime does not excuse a wake time that swings');
  assert.ok(drifting.wakeSd > 60);
});

test('a bedtime after midnight counts as late, not as early the same morning', () => {
  night(0, '00:30', '08:00'); night(1, '23:50', '07:20'); night(2, '00:10', '07:40');
  const c = P.sleepConsistency(day(0));
  assert.ok(c.bedSd < 30, `00:30 and 23:50 are 40 minutes apart, not 23 hours (got ${c.bedSd})`);
  assert.equal(P.minutesOf('00:30', 720), 1470);
  assert.equal(P.timeOf(1470), '00:30');
});

test('the score is duration, quality and consistency, and nothing else', () => {
  night(0, '23:00', '07:00', 5); night(1, '23:00', '07:00', 5); night(2, '23:00', '07:00', 5);
  assert.equal(P.sleepScore(day(0)), 100, '8h, best quality, perfectly regular');
  assert.equal(P.sleepScore('2099-01-01'), null, 'a night with no entry has no score');

  ctx = makeContext(); P = ctx.__api;
  night(0, '01:00', '05:00', 1);
  assert.ok(P.sleepScore(day(0)) < 15, `4h at worst quality should be near zero (got ${P.sleepScore(day(0))})`);
});

test('the weekly average counts calendar days, not the last N entries', () => {
  night(0, '23:00', '04:00');   // 5h
  night(1, '23:00', '04:00');
  night(40, '22:00', '08:00');  // 10h, well outside the window
  const wk = P.sleepAvgDays(7);
  assert.equal(wk.nights, 2, 'a night from six weeks ago is not part of this week');
  assert.equal(wk.avgMin, 300);
  assert.equal(wk.days, 7);
  assert.equal(P.sleepAvgDays(1).nights, 1);
});

test('usual night is a median, so one late night cannot move the default', () => {
  night(0, '23:00', '07:00'); night(1, '23:15', '07:10'); night(2, '03:30', '11:00'); night(3, '23:05', '07:05');
  const u = P.usualNight();
  assert.ok(u.learned);
  assert.ok(P.minutesOf(u.bed, 720) < P.minutesOf('23:40', 720), `one 3:30am night should not drag the default (got ${u.bed})`);
});

test('usual night falls back to a sane default until it has three nights', () => {
  night(0, '22:45', '06:45');
  const u = P.usualNight();
  assert.equal(u.learned, false);
  assert.equal(u.bed, '23:30');
  assert.equal(u.wake, '07:00');
  assert.equal(u.nights, 1);
});

test('the sleep-vs-training split refuses to report until both sides have enough sessions', () => {
  for (let i = 1; i <= 5; i++) {
    night(i, '23:00', '07:00');   // 8h — the good side
    P.saveWorkout({ id: 'g' + i, date: day(i), dayName: 'Push', score: 80, exercises: [] });
  }
  let l = P.sleepTrainingLink();
  assert.equal(l.ready, false, 'five good nights and no short ones is not a comparison');

  for (let i = 6; i <= 9; i++) {
    night(i, '00:30', '06:00');   // 5h30 — the short side
    P.saveWorkout({ id: 's' + i, date: day(i), dayName: 'Push', score: 60, exercises: [] });
  }
  l = P.sleepTrainingLink();
  assert.equal(l.ready, true);
  assert.equal(l.goodN, 5);
  assert.equal(l.shortN, 4);
  assert.equal(l.delta, 20);
});

test('cardio and unscored sessions stay out of the sleep split', () => {
  for (let i = 1; i <= 5; i++) {
    night(i, '23:00', '07:00');
    P.saveWorkout({ id: 'c' + i, date: day(i), dayName: 'Run', cardio: true, score: 99, exercises: [] });
  }
  assert.equal(P.sleepTrainingLink().good, 0);
});

/* ---- v40 ---- */

test('the usual night comes from the last fortnight, not the last fourteen entries', () => {
  // three nights from the spring, logged, then nothing for months
  night(80, '03:00', '11:00'); night(81, '03:15', '11:10'); night(82, '02:45', '10:50');
  const stale = P.usualNight();
  assert.equal(stale.learned, false, 'nights that old say nothing about tonight');
  assert.equal(stale.bed, '23:30', 'so the form opens on the neutral default');

  night(1, '23:00', '07:00'); night(2, '23:10', '07:05'); night(3, '22:55', '06:55');
  const now = P.usualNight();
  assert.equal(now.learned, true);
  assert.equal(now.nights, 3, 'the old nights are outside the window and are not counted');
  assert.ok(P.minutesOf(now.bed, 720) > P.minutesOf('22:00', 720) && now.bed < '23:30',
    `the default should come from this fortnight, not from the spring (got ${now.bed})`);
});

test('one table defines a bad night, and every threshold reads it', () => {
  assert.deepEqual({ ...P.SLEEP_BANDS }, { severe: 360, short: 420, good: 450, target: 480 });
  assert.ok(P.SLEEP_BANDS.severe < P.SLEEP_BANDS.short, 'Train warns earlier than the weekly split bands');
  assert.ok(P.SLEEP_BANDS.short < P.SLEEP_BANDS.good, 'and the two populations do not touch');
});

test('the training split counts every session it covers, not only the ones it can band', () => {
  // 7h10 every night: inside the gap, so neither side gets it
  for (let i = 1; i <= 6; i++) {
    night(i, '23:00', '06:10');
    P.saveWorkout({ id: 'm' + i, date: day(i), dayName: 'Push', score: 70, exercises: [] });
  }
  const l = P.sleepTrainingLink();
  assert.equal(l.ready, false);
  assert.equal(l.good, 0);
  assert.equal(l.short, 0);
  assert.equal(l.covered, 6, 'six sessions with a logged night is not "0 sessions so far"');
});

test('a deleted night can be put back exactly as it was', () => {
  night(1, '23:20', '07:05', 4);
  const key = day(1);
  const entry = { ...P.getSleep()[key] };

  P.removeSleepEntry(key);
  assert.equal(P.getSleep()[key], undefined);

  P.destructive('sleep', { key, entry }, 'removed');
  P.undoLast();
  assert.deepEqual({ ...P.getSleep()[key] }, entry, 'same times, same quality, same duration');
});

test('sleepDebt is gone, and nothing else lost its meaning with it', () => {
  assert.equal(typeof ctx.sleepDebt, 'undefined', 'it was computed, commented, and never rendered');
  night(1, '23:00', '04:00');
  assert.equal(P.sleepAvgDays(7).avgMin, 300, 'the average is what the verdict actually reads');
});
