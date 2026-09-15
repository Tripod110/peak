/* Regression tests for progression preferences and the focused workout flow.
 *
 *   node --test tests/*.test.mjs
 *
 * Peak has no build step and no module system, so these load the real
 * store.js / train.js / routines.js into one VM context with just enough of a
 * browser stubbed in to run them — the same globals the page sees. Rendering
 * is stubbed out; what's under test is the data the UI reads and writes. */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function makeContext() {
  const mem = new Map();
  const localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
    key: i => [...mem.keys()][i] ?? null,
    get length() { return mem.size; }
  };
  Object.defineProperty(localStorage, 'keys', { value: () => [...mem.keys()] });
  const noopEl = { addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} }, style: { setProperty() {} } };
  const document = {
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
    getElementById: () => null, body: noopEl, documentElement: noopEl, activeElement: null
  };
  const ctx = {
    console, localStorage, document, navigator: {}, window: { matchMedia: () => ({ matches: false }) },
    setTimeout, clearTimeout, crypto: globalThis.crypto,
    toasts: []
  };
  vm.createContext(ctx);
  // Object.keys(localStorage) is how wipeAll enumerates — mirror the browser
  const src = ['store.js', 'train.js', 'routines.js'].map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n;\n');
  vm.runInContext(`
    var App = { activeSession: null, rest: null, undo: null, setSel: null, tab: 'train', render() {} };
    function esc(s) { return String(s ?? ''); }
    function toast(m) { toasts.push(m); }
    function announce() {}
    function openModal() {}
    function closeModal() {}
    function icon() { return ''; }
    function paintRest() {}
    const CHART = { good: 'g', warning: 'w', critical: 'c', orange: 'o', blue: 'b', aqua: 'a', muted: 'm' };
    ${src}
    ;globalThis.__api = { Store, App, getSettings, setSettings, setProfile, saveWorkout, getWorkouts,
      nextTarget, progressionPref, setProgressionPref, getProgressionPrefs, exerciseHasLoad,
      plannedSetsFor, startWorkout, restoreSession, persistSession, ensureSessionIds, focusedExercise,
      completeSet, deleteExercise, undoLast, moveExercise, finishWorkout, applyHoldToSession,
      prevSetsText, lastSessionSets, todayKey, lbToKg, kgToLb, fromW, toW };
  `, ctx);
  // wipeAll uses Object.keys(localStorage); give it the real key list
  vm.runInContext(`Store.wipeAll = function () { localStorage.keys().filter(k => k.startsWith('forge:')).forEach(k => localStorage.removeItem(k)); _cache.clear(); };`, ctx);
  return ctx;
}

let ctx, P;
const localDay = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function seed(units = 'imperial') {
  P.setProfile({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'light', goal: 'recomp', gymDays: 4, template: 'ul4' });
  P.setSettings({ units, restSec: 90 });
}
const lb = v => v / 2.20462;
function benchSession(daysBack, weightsLb, reps) {
  P.saveWorkout({ id: 'w' + daysBack + Math.random(), date: localDay(daysBack), dayName: 'Upper A', exercises: [
    { name: 'Bench Press', target: '4×5', sets: weightsLb.map((w, i) => ({ weight: lb(w), reps: reps[i], type: 'normal' })) }
  ] });
}

beforeEach(() => { ctx = makeContext(); P = ctx.__api; seed(); });

test('automatic progression is unchanged when no preference exists', () => {
  benchSession(3, [185, 185, 185, 185], [5, 5, 5, 5]);
  const t = P.nextTarget('Bench Press', '4×5');
  assert.equal(t.type, 'add_weight');
  assert.equal(t.w, 190);
  assert.deepEqual({ ...P.progressionPref('Bench Press') }, {});
});

test('a custom increment replaces the automatic one and is not rounded onto the default grid', () => {
  benchSession(3, [185, 185, 185, 185], [5, 5, 5, 5]);
  P.setProgressionPref('  BENCH press ', { incKg: lb(2.5) });   // keyed by trimmed lower-case name
  const t = P.nextTarget('Bench Press', '4×5');
  assert.equal(t.type, 'add_weight');
  assert.equal(t.w, 187.5);
  assert.ok(Math.abs(t.wKg - lb(187.5)) < 1e-9, 'pre-fill uses the exact kg, not a display round-trip');
  // the session pre-fill reads the same target
  const sets = P.plannedSetsFor('Bench Press', '4×5', new Set());
  assert.ok(sets.every(s => Math.abs(s.weight - lb(187.5)) < 1e-9 && s.planned && !s.done && !s.touched));
  // repeat-the-weight branch keeps a custom weight exact too
  benchSession(1, [187.5, 187.5, 187.5, 187.5], [5, 5, 4, 4]);
  const again = P.nextTarget('Bench Press', '4×5', new Set());
  assert.equal(again.type, 'add_reps');
  assert.equal(again.w, 187.5);
});

test('custom increments are stored in kg and only their display changes with units', () => {
  benchSession(3, [185, 185, 185, 185], [5, 5, 5, 5]);
  P.setProgressionPref('Bench Press', { incKg: 1.25 });
  const stored = () => P.getProgressionPrefs()['bench press'].incKg;
  assert.equal(stored(), 1.25);
  const imperial = P.nextTarget('Bench Press', '4×5');
  assert.equal(imperial.w, Math.round(P.kgToLb(lb(185) + 1.25) * 10) / 10);
  P.setSettings({ ...P.getSettings(), units: 'metric' });
  const metric = P.nextTarget('Bench Press', '4×5');
  assert.equal(metric.w, Math.round((lb(185) + 1.25) * 10) / 10);
  assert.equal(stored(), 1.25, 'switching units never rewrites the stored increment');
});

test('a hold overrides increases and deloads, persists across reloads, and resuming restores progression', () => {
  // a stalled lift: 5 sessions at the same top weight, never completing 4×5
  [35, 28, 21, 14, 7].forEach(d => benchSession(d, [200, 200, 200, 200], [5, 5, 4, 4]));
  const before = P.nextTarget('Bench Press', '4×5');
  assert.equal(before.type, 'deload', 'precondition: the lift would be deloaded');

  P.setProgressionPref('Bench Press', { hold: { kg: lb(200), since: localDay(0) } });
  const held = P.nextTarget('Bench Press', '4×5');
  assert.equal(held.type, 'hold');
  assert.equal(held.paused, true);
  assert.equal(held.w, 200);
  assert.match(held.text, /paused/i);

  // "reload": a fresh read from storage, cache dropped
  P.Store.clearCache();
  assert.equal(P.nextTarget('Bench Press', '4×5').type, 'hold');

  // a completed prescription doesn't sneak an increase past the hold either
  benchSession(1, [200, 200, 200, 200], [5, 5, 5, 5]);
  assert.equal(P.nextTarget('Bench Press', '4×5').w, 200);

  P.setProgressionPref('Bench Press', { hold: null });
  const resumed = P.nextTarget('Bench Press', '4×5');
  assert.equal(resumed.type, 'add_weight');
  assert.equal(P.getProgressionPrefs()['bench press'], undefined, 'an empty preference is removed entirely');
});

test('a hold on a lift with no history prescribes the held load', () => {
  P.setProgressionPref('Incline Bench Press', { hold: { kg: lb(135), since: localDay(0) } });
  const t = P.nextTarget('Incline Bench Press', '3×8');
  assert.equal(t.type, 'hold');
  assert.equal(t.w, 135);
});

test('previous-session summaries describe sets that actually happened', () => {
  P.saveWorkout({ id: 'mix', date: localDay(2), dayName: 'Upper A', exercises: [
    { name: 'Barbell Row', target: '3×6', sets: [
      { weight: lb(155), reps: 5, type: 'normal' }, { weight: lb(135), reps: 10, type: 'normal' }, { weight: lb(155), reps: 6, type: 'normal' }] }
  ] });
  const t = P.nextTarget('Barbell Row', '3×6');
  // heaviest weight with the reps done at that weight — not 155 × 10
  assert.match(t.lastText, /^155 lb × 6 ·/);
  const last = P.lastSessionSets('Barbell Row');
  assert.equal(P.prevSetsText('Barbell Row', last.sets), '155×5 · 135×10 · 155×6 lb');
});

test('bodyweight and timed lifts have no weight controls to offer', () => {
  assert.equal(P.exerciseHasLoad('Plank (seconds)'), false);
  assert.equal(P.exerciseHasLoad('Push-up'), false);
  assert.equal(P.exerciseHasLoad('Weighted Pull-up'), true);
  assert.equal(P.exerciseHasLoad('Bench Press'), true);
});

test('saving a hold mid-workout only changes untouched, incomplete normal working sets', () => {
  benchSession(3, [185, 185, 185, 185], [5, 5, 5, 5]);
  P.startWorkout(0);   // ul4 day 0 = Upper A, Bench Press first
  const s = P.App.activeSession;
  const bench = s.exercises.find(e => e.name === 'Bench Press');
  bench.sets.unshift({ weight: lb(95), reps: 10, type: 'warmup', done: false });
  // set 1 completed, set 2 edited by hand, set 3 a drop set, set 4 untouched
  Object.assign(bench.sets[1], { done: true, planned: false });
  Object.assign(bench.sets[2], { weight: lb(180), touched: true, planned: false });
  Object.assign(bench.sets[3], { type: 'drop' });
  const snapshot = JSON.parse(JSON.stringify(bench.sets));

  const n = P.applyHoldToSession('bench press', lb(175));
  assert.equal(n, 1);
  assert.equal(JSON.stringify(bench.sets[0]), JSON.stringify(snapshot[0]), 'warmup untouched');
  assert.equal(JSON.stringify(bench.sets[1]), JSON.stringify(snapshot[1]), 'completed set untouched');
  assert.equal(JSON.stringify(bench.sets[2]), JSON.stringify(snapshot[2]), 'hand-edited set untouched');
  assert.equal(JSON.stringify(bench.sets[3]), JSON.stringify(snapshot[3]), 'special set type untouched');
  assert.ok(Math.abs(bench.sets[4].weight - lb(175)) < 1e-9);
  assert.equal(bench.sets[4].done, false);
  assert.ok(!bench.sets[4].touched, 'the updated set is still just the plan');
});

test('an early finish saves only performed or edited sets, never the untouched plan', () => {
  P.startWorkout(0);
  const s = P.App.activeSession;
  const first = s.exercises[0];
  // focus changes and selection are navigation only
  P.App.setSel = { uid: s.exercises[1].uid, si: 0 };
  assert.ok(s.exercises.every(e => e.sets.every(st => !st.touched && !st.done)));
  first.sets[0].done = true;
  s.exercises[1].sets[0].touched = true;
  P.finishWorkout();
  const saved = P.getWorkouts().at(-1);
  assert.equal(saved.exercises.length, 2);
  assert.equal(saved.exercises[0].sets.length, 1);
  assert.equal(saved.exercises[1].sets.length, 1);
  assert.ok(!('focusUid' in saved) && saved.exercises.every(e => !('uid' in e)), 'session-only fields are not written to history');
  assert.equal(P.App.activeSession, null);
  P.finishWorkout();   // a second tap is harmless
  assert.equal(P.getWorkouts().length, 1);
});

test('completing an exercise advances to the next unfinished one, wrapping round', () => {
  P.startWorkout(0);
  const s = P.App.activeSession;
  s.exercises.forEach((e, i) => { if (i !== 0 && i !== s.exercises.length - 1) e.sets.forEach(st => { st.done = true; }); });
  const lastEx = s.exercises.at(-1);
  s.focusUid = lastEx.uid;
  lastEx.sets.forEach((st, i) => { if (i < lastEx.sets.length - 1) st.done = true; });
  P.completeSet(lastEx.uid, lastEx.sets.length - 1);
  assert.equal(s.focusUid, s.exercises[0].uid, 'wrapped back to the skipped first exercise');
});

test('identifiers survive duplicates, reorder, delete and undo; focus falls back sensibly', () => {
  P.startWorkout(0);
  const s = P.App.activeSession;
  s.exercises.push({ name: s.exercises[0].name, target: '1×5', sets: [{ weight: 0, reps: 5, type: 'normal', done: false }] });
  P.ensureSessionIds(s);
  const ids = s.exercises.map(e => e.uid);
  assert.equal(new Set(ids).size, ids.length, 'duplicate names still get distinct ids');

  s.exercises[0].sets.forEach(st => { st.done = true; });
  const focus = s.exercises[2].uid;
  s.focusUid = focus;
  P.moveExercise(focus, -1);
  assert.equal(s.focusUid, focus, 'reordering keeps focus by id');

  P.deleteExercise(focus);
  assert.equal(s.focusUid, s.exercises[1].uid, 'next incomplete exercise after the deleted position');
  const now = s.focusUid;
  P.undoLast();
  assert.ok(s.exercises.some(e => e.uid === focus), 'restored with the same id');
  assert.equal(s.focusUid, now, 'restoring keeps the current valid focus');
});

test('older active sessions restore with ids and a sensible focus', () => {
  P.Store.set('activeSession', { id: 'old', date: localDay(0), dayName: 'Legacy', exercises: [
    { name: 'Squat', sets: [{ weight: 100, reps: 5, done: true }] },
    { name: 'Squat', sets: [{ weight: 100, reps: 5, done: false }] }
  ] });
  const s = P.restoreSession();
  assert.ok(s.exercises.every(e => typeof e.uid === 'string'));
  assert.equal(s.focusUid, s.exercises[1].uid);
  s.focusUid = 'gone';
  assert.equal(P.focusedExercise().uid, s.exercises[1].uid, 'invalid focus falls back to first incomplete');
  s.exercises[1].sets[0].done = true;
  s.focusUid = 'gone';
  assert.equal(P.focusedExercise().uid, s.exercises[0].uid, 'then to the first exercise');
});

test('preferences survive a backup round trip, and older backups without them still import', () => {
  benchSession(3, [185, 185, 185, 185], [5, 5, 5, 5]);
  P.setProgressionPref('Bench Press', { incKg: 1.25, hold: { kg: 90, since: '2026-09-01' } });
  const json = P.Store.exportAll();
  P.Store.wipeAll();
  assert.deepEqual({ ...P.getProgressionPrefs() }, {});
  P.Store.importAll(json);
  const pref = P.progressionPref('Bench Press');
  assert.equal(pref.incKg, 1.25);
  assert.equal(pref.hold.kg, 90);

  // a v36-era backup: no progressionPrefs key at all
  const old = JSON.parse(json);
  delete old.data['forge:progressionPrefs'];
  P.Store.importAll(JSON.stringify(old));
  assert.deepEqual({ ...P.progressionPref('Bench Press') }, {});
  assert.equal(P.nextTarget('Bench Press', '4×5').type, 'add_weight');
});

test('malformed preferences read as no preference', () => {
  benchSession(3, [185, 185, 185, 185], [5, 5, 5, 5]);
  P.Store.set('progressionPrefs', { 'bench press': { incKg: -5, hold: { kg: 'heavy' } } });
  assert.deepEqual({ ...P.progressionPref('Bench Press') }, {});
  assert.equal(P.nextTarget('Bench Press', '4×5').w, 190);
});
