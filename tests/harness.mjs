/* Shared test context for Peak's node:test suites.
 *
 * Peak has no build step and no module system, so this loads the real tab
 * files into one VM context with just enough of a browser stubbed in to run
 * them — the same globals the page sees, in the same order index.html loads
 * them. Rendering is stubbed out; what's under test is the data the UI reads
 * and writes.
 *
 * charts.js is loaded rather than stubbed: it is pure string-building over
 * numbers, it needs nothing but esc, and loading it gives the tests the real
 * CHART palette instead of a hand-maintained fake that drifts.
 *
 * app.js is deliberately NOT loaded — it owns the DOM, the event dispatcher
 * and the boot sequence. Its handful of pure helpers are stubbed below.
 *
 * Note `esc()` is the identity here. Escaping is verified by reading the render
 * sinks, not by these tests; what these cover is the other half of the defence,
 * the coercion every value passes through on import (see DECISIONS.md D-17). */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function makeContext() {
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
  const src = ['store.js', 'ui.js', 'charts.js', 'food.js', 'train.js', 'routines.js', 'sleep.js', 'grocery.js']
    .map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n;\n');
  vm.runInContext(`
    var App = { activeSession: null, rest: null, undo: null, setSel: null, tab: 'train', render() {},
      foodDay: null, foodView: 'home', sleepDay: null, sleepView: 'home', grocView: 'home',
      scanImage: null, scanResult: null, _renderedTab: null };
    function esc(s) { return String(s ?? ''); }
    function toast(m) { toasts.push(m); }
    function announce() {}
    function openModal() {}
    function closeModal() {}
    function paintRest() {}
    function navHeader() { return ''; }
    function prepareImage() {}
    ${src}
    ;globalThis.__api = { Store, App, getSettings, setSettings, setProfile, saveWorkout, getWorkouts,
      nextTarget, progressionPref, setProgressionPref, getProgressionPrefs, exerciseHasLoad,
      plannedSetsFor, startWorkout, restoreSession, persistSession, ensureSessionIds, focusedExercise,
      completeSet, deleteExercise, undoLast, moveExercise, moveExerciseTo, moveExerciseNext, finishWorkout, applyHoldToSession,
      prevSetsText, lastSessionSets, todayKey, lbToKg, kgToLb, fromW, toW, registerUndo, destructive,
      sanitizeStored, normTime, getProfile, AISLE_IDS,
      addFoodEntry, updateFoodEntry, removeFoodEntry, restoreFoodEntry, findFoodEntry, foodForDay, dayTotals,
      nutritionScore, computeTargets, rememberRecentFood, getGroceryFoodCache,
      loggedDayCount, lastLoggedDay, daySummary,
      sleepDurationMin, sleepDurationPoints, sleepConsistency, sleepScore, usualNight, sleepAvgDays,
      sleepTrainingLink, setSleepEntry, removeSleepEntry, getSleep, minutesOf, timeOf, median, SLEEP_BANDS,
      parseQty, aisleFor, groupByAisle, yourUsuals, groceryAdd, groceryQty, groceryAddFromSection,
      getGrocery, setGrocery, AISLES, STAPLES, SNACKS, EASY_MEALS, grocKey, groceryMatch, grocGrouped, rememberGroceryFood };
  `, ctx);
  // wipeAll uses Object.keys(localStorage); give it the real key list
  vm.runInContext(`Store.wipeAll = function () { localStorage.keys().filter(k => k.startsWith('forge:')).forEach(k => localStorage.removeItem(k)); _cache.clear(); };`, ctx);
  return ctx;
}
