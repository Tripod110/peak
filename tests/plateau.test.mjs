/* The plateau engine and the progression rules around it, tested against the
 * training histories a real intermediate lifter produces. A false plateau tells
 * someone who is progressing to cut their weight, which DECISIONS.md D-12 calls
 * the most expensive bug the app can have — so most of these are histories that
 * must NOT be flagged. See D-21 and CHANGELOG v41.
 *
 *   node --test tests/*.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from './harness.mjs';

let ctx, P;
const localDay = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const lb = v => v / 2.20462;

beforeEach(() => {
  ctx = makeContext(); P = ctx.__api;
  P.setProfile({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'light', goal: 'recomp', gymDays: 4, template: 'ul4' });
  P.setSettings({ units: 'imperial', restSec: 90 });
});

/* one session of one lift: weights in lb, one entry per set */
function log(name, daysBack, target, weightsLb, reps, types) {
  P.saveWorkout({ id: `${name}${daysBack}${Math.random()}`, date: localDay(daysBack), dayName: 'Upper A', exercises: [
    { name, target, sets: weightsLb.map((w, i) => ({ weight: lb(w), reps: reps[i], type: (types && types[i]) || 'normal' })) }
  ] });
}
const flagged = name => P.detectPlateaus().some(p => p.name === name);

/* ---- histories that must never be called a plateau ---- */

test('adding reps at the same weight is progress, not a stall', () => {
  // double progression doing exactly what it should, one rep at a time
  [[8, 6, 6], [8, 7, 6], [8, 7, 7], [8, 8, 7], [8, 8, 7]].forEach((r, i) =>
    log('Barbell Row', 35 - i * 7, '3×8', [155, 155, 155], r));
  assert.equal(flagged('Barbell Row'), false);
  assert.notEqual(P.nextTarget('Barbell Row', '3×8').type, 'deload');
});

test('high-rep work that climbs past 12 reps is still progress', () => {
  // the e1RM formula caps at 12 reps, so this history is flat on e1RM alone
  [[13, 13, 12, 12], [14, 13, 13, 12], [14, 14, 13, 13], [15, 14, 14, 13], [15, 15, 14, 14]].forEach((r, i) =>
    log('Lateral Raise', 35 - i * 7, '4×15', [20, 20, 20, 20], r));
  assert.equal(flagged('Lateral Raise'), false);
});

test('a lift rebuilding after a short break is not deloaded again', () => {
  // 315 → 320 → 325 (missed), ten days off, then working back up
  log('Squat', 49, '3×5', [315, 315, 315], [5, 5, 5]);
  log('Squat', 42, '3×5', [320, 320, 320], [5, 5, 5]);
  log('Squat', 35, '3×5', [325, 325, 325], [5, 4, 4]);
  log('Squat', 24, '3×5', [305, 305, 305], [5, 5, 5]);
  log('Squat', 17, '3×5', [315, 315, 315], [5, 5, 4]);
  log('Squat', 10, '3×5', [315, 315, 315], [5, 5, 5]);
  log('Squat', 3, '3×5', [320, 320, 320], [5, 5, 4]);
  assert.equal(flagged('Squat'), false);
  assert.notEqual(P.nextTarget('Squat', '3×5').type, 'deload');
});

/* ---- histories that must still be called a plateau ---- */

test('a genuine stall is still flagged and deloaded', () => {
  [35, 28, 21, 14, 7, 1].forEach(d => log('Bench Press', d, '4×5', [225, 225, 225, 225], [5, 5, 4, 4]));
  assert.equal(flagged('Bench Press'), true);
  const t = P.nextTarget('Bench Press', '4×5');
  assert.equal(t.type, 'deload');
  assert.equal(t.w, 205);
});

test('a noisy stall — reps wobbling but never beating their best — is still flagged', () => {
  [[5, 5, 4, 4], [5, 5, 5, 4], [5, 4, 4, 4], [5, 5, 5, 4], [5, 5, 4, 4], [5, 5, 5, 4]].forEach((r, i) =>
    log('Bench Press', 36 - i * 7, '4×5', [225, 225, 225, 225], r));
  assert.equal(flagged('Bench Press'), true);
});

test('one heavy single does not count as the weight you are stuck under', () => {
  // a 365 single test, then five weeks stuck at 315 for 5/5/4/4
  log('Squat', 42, '4×5', [365], [1]);
  [35, 28, 21, 14, 7].forEach(d => log('Squat', d, '4×5', [315, 315, 315, 315], [5, 5, 4, 4]));
  const t = P.nextTarget('Squat', '4×5');
  assert.equal(t.type, 'deload', 'stalled at 315 is a stall, whatever a single at 365 says');
  assert.ok(!/365/.test(t.text));
});

test('a heavier weight for a real rep count is progress; a heavy low-rep grind is not', () => {
  // 225×5 → 230×4: e1RM roughly level, but more reps at 230 than ever before
  [42, 35, 28, 21].forEach(d => log('Bench Press', d, '4×5', [225, 225, 225, 225], [5, 5, 4, 4]));
  log('Bench Press', 14, '4×5', [230, 230, 230, 230], [4, 4, 4, 4]);
  assert.equal(flagged('Bench Press'), false);
});

/* ---- prescriptions ---- */

test('heavy and light days of the same lift are prescribed from their own history', () => {
  log('Squat', 10, '4×5', [225, 225, 225, 225], [5, 5, 5, 5]);   // heavy day
  log('Squat', 7, '3×10', [185, 185, 185], [10, 10, 10]);          // light day
  const heavy = P.nextTarget('Squat', '4×5');
  const light = P.nextTarget('Squat', '3×10');
  assert.ok(heavy.w > 225, `heavy day builds from 225, got ${heavy.w}`);
  assert.ok(light.w > 185 && light.w < 225, `light day builds from 185, got ${light.w}`);
});

test('an extra set beyond the plan does not block the increase', () => {
  log('Barbell Row', 3, '3×8', [155, 155, 155, 155], [8, 8, 8, 6]);
  assert.equal(P.nextTarget('Barbell Row', '3×8').type, 'add_weight');
});

test('heavy lower-body lifts step up by intermediate-sized jumps', () => {
  log('Deadlift', 3, '3×5', [405, 405, 405], [5, 5, 5]);
  log('Squat', 3, '3×5', [315, 315, 315], [5, 5, 5]);
  assert.equal(P.nextTarget('Deadlift', '3×5').w, 415);
  assert.equal(P.nextTarget('Squat', '3×5').w, 325);
});

test('the plateau note never argues with a deload, and reads the plan, not the last 7 days', () => {
  [35, 28, 21, 14, 7, 1].forEach(d => log('Bench Press', d, '4×5', [225, 225, 225, 225], [5, 5, 4, 4]));
  const note = P.plateauVolumeNote('Bench Press');
  assert.ok(!/before dropping weight/i.test(note));
  assert.ok(!/this week/i.test(note));
});
