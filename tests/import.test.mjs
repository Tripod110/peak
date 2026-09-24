/* Importing history from Strong and Hevy CSV exports.
 *
 *   node --test tests/*.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from './harness.mjs';

let ctx, P;
beforeEach(() => {
  ctx = makeContext(); P = ctx.__api;
  P.setProfile({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'light', goal: 'recomp', gymDays: 3, template: 'fb3' });
  P.setSettings({ units: 'imperial', restSec: 90 });
});

const STRONG = [
  'Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE',
  '2026-08-03 18:00:00;"Push; heavy";1h;Bench Press (Barbell);W;95;8;0;0;;;',
  '2026-08-03 18:00:00;"Push; heavy";1h;Bench Press (Barbell);1;185;5;0;0;;;',
  '2026-08-03 18:00:00;"Push; heavy";1h;Bench Press (Barbell);2;185;5;0;0;;;',
  '2026-08-03 18:00:00;"Push; heavy";1h;Plank;1;0;0;0;60;;;',
  '2026-08-03 18:00:00;"Push; heavy";1h;Rowing (Machine);1;0;0;2000;480;;;',
  '2026-08-05 18:00:00;Legs;1h;Squat (Barbell);1;225;5;0;0;"felt ""strong""";;',
  '2026-08-05 18:00:00;Legs;1h;Tire Flip;1;135;30;0;0;;;'
].join('\r\n');

const HEVY = [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  'Upper A,"12 Aug 2026, 07:30","12 Aug 2026, 08:30",,Bicep Curl (Dumbbell),,,0,warmup,8,12,,,',
  'Upper A,"12 Aug 2026, 07:30","12 Aug 2026, 08:30",,Bicep Curl (Dumbbell),,,1,normal,14,10,,,',
  'Upper A,"12 Aug 2026, 07:30","12 Aug 2026, 08:30",,Lat Pulldown (Cable),,,0,dropset,50,10,,,'
].join('\n');

test('the CSV parser handles quotes, doubled quotes, semicolons and CRLF', () => {
  const rows = P.parseCsv(STRONG);
  assert.equal(rows.length, 8);
  assert.equal(rows[1][1], 'Push; heavy', 'a delimiter inside quotes stays in the field');
  assert.equal(rows[6][9], 'felt "strong"');
});

test('a Strong export becomes Peak sessions, in the unit you say it was in', () => {
  const p = P.parseWorkoutCsv(STRONG, 'lb');
  assert.equal(p.format, 'strong');
  assert.equal(p.sessions.length, 2);
  const push = p.sessions[0];
  assert.equal(push.date, '2026-08-03');
  assert.equal(push.dayName, 'Push; heavy');
  const bench = push.exercises.find(e => e.name === 'Bench Press');
  assert.ok(bench, '"Bench Press (Barbell)" maps onto the library lift');
  assert.equal(bench.sets[0].type, 'warmup');
  assert.ok(Math.abs(bench.sets[1].weight - 185 / 2.20462) < 0.01);
  const plank = push.exercises.find(e => e.name === 'Plank (seconds)');
  assert.equal(plank.sets[0].reps, 60, 'a timed hold keeps its seconds');
  assert.ok(!push.exercises.some(e => /Rowing/.test(e.name)), 'cardio rows are skipped, not logged as a lift');
  const kg = P.parseWorkoutCsv(STRONG, 'kg');
  assert.equal(kg.sessions[0].exercises.find(e => e.name === 'Bench Press').sets[1].weight, 185);
});

test('a Hevy export reads its own unit, set types and dates', () => {
  const p = P.parseWorkoutCsv(HEVY, 'lb');
  assert.equal(p.format, 'hevy');
  assert.equal(p.sessions.length, 1);
  const s = p.sessions[0];
  assert.equal(s.date, '2026-08-12');
  const curl = s.exercises.find(e => e.name === 'Dumbbell Curl');
  assert.ok(curl, '"Bicep Curl (Dumbbell)" → Dumbbell Curl');
  assert.equal(curl.sets[0].type, 'warmup');
  assert.equal(curl.sets[1].weight, 14, 'weight_kg is already kg');
  assert.equal(s.exercises.find(e => e.name === 'Lat Pulldown').sets[0].type, 'drop');
});

test('importing adds history, skips what is already there, and undoes in one step', () => {
  const p = P.parseWorkoutCsv(STRONG, 'lb');
  assert.equal(P.importWorkouts(p).added, 2);
  assert.equal(P.getWorkouts().length, 2);
  assert.equal(P.importWorkouts(P.parseWorkoutCsv(STRONG, 'lb')).added, 0, 're-importing the same file adds nothing');
  // imported history feeds the engine straight away
  assert.equal(P.exerciseHistory('Bench Press').length, 1);
  P.undoLast();
  assert.equal(P.getWorkouts().length, 0);
});

test('a file that is not a workout export is refused with a clear message', () => {
  assert.throws(() => P.parseWorkoutCsv('name,price\nmilk,2', 'lb'), /Strong or Hevy/);
  assert.throws(() => P.parseWorkoutCsv('', 'lb'), /no rows/);
});

test('names Peak does not know are kept, and reported for tagging', () => {
  const p = P.parseWorkoutCsv(STRONG, 'lb');
  assert.ok(p.unknown.includes('Tire Flip'));
  assert.equal(P.mapImportedName('Pull Up'), 'Pull-up');
  assert.equal(P.mapImportedName('Incline Bench Press (Barbell)'), 'Incline Bench Press');
});

test('imported sessions go through the backup sanitiser: hostile fields do not survive', () => {
  const evil = STRONG.replace('Legs;1h;Squat (Barbell);1;225;5', 'Legs;1h;<img src=x onerror=alert(1)>;1;225;5');
  P.importWorkouts(P.parseWorkoutCsv(evil, 'lb'));
  const names = P.getWorkouts().flatMap(w => w.exercises.map(e => e.name));
  assert.ok(names.every(n => n.length <= 80));
  // stored as inert text; escaping at the render sink is the other half (D-17)
  assert.ok(P.getWorkouts().every(w => /^\d{4}-\d{2}-\d{2}$/.test(w.date)));
});
