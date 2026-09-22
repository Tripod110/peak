/* Log anything: custom exercises, renaming, several routines, sessions saved
 * as routine days, custom activities. See DECISIONS.md D-23 and D-24.
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
  P.setProfile({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'light', goal: 'recomp', gymDays: 3, template: 'fb3' });
  P.setSettings({ units: 'imperial', restSec: 90 });
});

test('your definition beats every name-based guess', () => {
  // "Hammer Curl" reads as per-hand, "Dead Hang" as neither timed nor bodyweight, by name alone
  assert.equal(P.perHandLift('Hammer Curl'), true);
  assert.equal(P.isTimedLift('Dead Hang'), false);
  P.saveCustomExercise({ n: 'Hammer Curl', kind: 'weighted', perHand: false, t: '3×12', p: ['biceps'], s: [] });
  P.saveCustomExercise({ n: 'Dead Hang', kind: 'timed', t: '3×45', p: ['back'], s: ['abs'] });
  assert.equal(P.perHandLift('Hammer Curl'), false, 'you said it is a two-hand cable curl');
  assert.equal(P.isTimedLift('Dead Hang'), true);
  assert.equal(P.exerciseHasLoad('Dead Hang'), false);
  assert.equal(P.defaultTargetFor('dead hang'), '3×45');
  assert.deepEqual([...P.musclesFor('Dead Hang').p], ['back']);
  const t = P.nextTarget('Dead Hang', '3×45');
  assert.equal(t.type, 'baseline');
});

test('custom exercises appear in the picker, tagged as yours', () => {
  P.saveCustomExercise({ n: 'Sled Push', kind: 'weighted', t: '4×20', p: ['quads'], s: ['glutes'] });
  const c = P.pickerCandidates().find(e => e.n === 'Sled Push');
  assert.ok(c && c.mine);
});

test('renaming a lift carries its whole history, goals and preferences — and undoes in one step', () => {
  P.saveWorkout({ id: 'a', date: localDay(7), dayName: 'Full Body A', exercises: [
    { name: 'DB Bench', target: '3×10', sets: [{ weight: lb(60), reps: 10, type: 'normal' }] }] });
  P.setLiftGoal('DB Bench', { kg: lb(80), reps: 10 });
  P.setProgressionPref('DB Bench', { incKg: lb(5) });
  P.createRoutine({ name: 'Mine', from: 'blank', days: 1 });
  ctx.__api.Store.set('routine', { ...P.activeRoutine(), days: [{ name: 'Day 1', ex: [['DB Bench', '3×10']] }] });

  assert.equal(P.renameExerciseEverywhere('DB Bench', 'Dumbbell Bench Press'), true);
  assert.equal(P.getWorkouts()[0].exercises[0].name, 'Dumbbell Bench Press');
  assert.ok(P.liftGoal('Dumbbell Bench Press'));
  assert.ok(P.progressionPref('Dumbbell Bench Press').incKg);
  assert.equal(P.activeRoutine().days[0].ex[0][0], 'Dumbbell Bench Press');
  assert.equal(P.liftGoal('DB Bench'), null);

  P.undoLast();
  assert.equal(P.getWorkouts()[0].exercises[0].name, 'DB Bench');
  assert.ok(P.liftGoal('DB Bench'));
});

test('a rename onto a name that already has history is refused', () => {
  P.saveWorkout({ id: 'a', date: localDay(7), dayName: 'X', exercises: [
    { name: 'Squat', target: '3×5', sets: [{ weight: lb(200), reps: 5, type: 'normal' }] },
    { name: 'Back Squat', target: '3×5', sets: [{ weight: lb(200), reps: 5, type: 'normal' }] }] });
  assert.equal(P.renameExerciseEverywhere('Back Squat', 'squat'), false);
});

test('several routines: a new one parks the current one, switching swaps them, undo restores', () => {
  P.createRoutine({ name: 'Strength block', from: 'blank', days: 4 });
  assert.equal(P.activeRoutine().name, 'Strength block');
  assert.equal(P.activeRoutine().days.length, 4);
  assert.ok(P.activeRoutine().days.every(d => d.ex.length === 0), 'built from nothing');
  P.createRoutine({ name: 'PPL', from: 'ppl6' });
  assert.equal(P.getRoutineLibrary().length, 1, 'the strength block was kept');
  const parked = P.getRoutineLibrary()[0];
  P.switchRoutine(parked.id);
  assert.equal(P.activeRoutine().name, 'Strength block');
  assert.equal(P.getRoutineLibrary()[0].name, 'PPL');
  P.undoLast();
  assert.equal(P.activeRoutine().name, 'PPL');
});

test('routines and their library survive a backup round trip, and junk in them does not', () => {
  P.createRoutine({ name: 'A', from: 'blank', days: 2 });
  P.createRoutine({ name: 'B', from: 'fb3' });
  const json = JSON.parse(P.Store.exportAll());
  const lib = JSON.parse(json.data['forge:routineLibrary']);
  lib.push({ name: '<img>', days: 'nope' });
  json.data['forge:routineLibrary'] = JSON.stringify(lib);
  P.Store.importAll(JSON.stringify(json));
  assert.equal(P.activeRoutine().name, 'B');
  assert.deepEqual([...P.getRoutineLibrary().map(r => r.name)], ['A']);
});

test('a logged session becomes a routine day with sets × the reps you did most', () => {
  P.saveWorkout({ id: 'f', date: localDay(1), dayName: 'Freestyle', freestyle: true, exercises: [
    { name: 'Cable Fly', sets: [12, 12, 10].map(r => ({ weight: lb(30), reps: r, type: 'normal' })) },
    { name: 'Dips', sets: [{ weight: 0, reps: 8, type: 'warmup' }, { weight: 0, reps: 10, type: 'normal' }, { weight: 0, reps: 10, type: 'normal' }] }] });
  assert.deepEqual(P.sessionAsDay(P.getWorkouts()[0]).map(x => [...x]), [['Cable Fly', '3×12'], ['Dips', '2×10']]);
  assert.equal(P.saveSessionAsDay('f', 'Chest finisher'), true);
  const r = P.activeRoutine();
  assert.equal(r.days[r.days.length - 1].name, 'Chest finisher');
});

test('custom exercises and activities are sanitised on restore', () => {
  P.saveCustomExercise({ n: 'Sled Push', kind: 'weighted', t: '4×20', p: ['quads'] });
  P.rememberActivity('Climbing');
  const json = JSON.parse(P.Store.exportAll());
  const cx = JSON.parse(json.data['forge:customExercises']);
  cx.evil = { n: 'Evil', kind: '<script>' };
  json.data['forge:customExercises'] = JSON.stringify(cx);
  json.data['forge:activities'] = JSON.stringify(['Climbing', { x: 1 }, 'y'.repeat(500)]);
  P.Store.importAll(JSON.stringify(json));
  assert.ok(P.customExercise('Sled Push'));
  assert.equal(P.customExercise('Evil'), null);
  assert.equal(P.getActivities()[0], 'Climbing');
  assert.ok(P.getActivities().every(a => a.length <= 40));
});

test('a new activity is remembered once, and the built-ins are not duplicated', () => {
  P.rememberActivity('Climbing'); P.rememberActivity('climbing'); P.rememberActivity('Run');
  assert.deepEqual([...P.getActivities()], ['climbing']);
});
