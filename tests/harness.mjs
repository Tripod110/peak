/* Shared test context for Peak's node:test suites.
 *
 * Peak has no build step and no module system, so this loads the real
 * store.js / train.js / routines.js into one VM context with just enough of a
 * browser stubbed in to run them — the same globals the page sees. Rendering is
 * stubbed out; what's under test is the data the UI reads and writes.
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
  const src = ['store.js', 'ui.js', 'train.js', 'routines.js'].map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n;\n');
  vm.runInContext(`
    var App = { activeSession: null, rest: null, undo: null, setSel: null, tab: 'train', render() {} };
    function esc(s) { return String(s ?? ''); }
    function toast(m) { toasts.push(m); }
    function announce() {}
    function openModal() {}
    function closeModal() {}
    function paintRest() {}
    const CHART = { good: 'g', warning: 'w', critical: 'c', orange: 'o', blue: 'b', aqua: 'a', muted: 'm' };
    ${src}
    ;globalThis.__api = { Store, App, getSettings, setSettings, setProfile, saveWorkout, getWorkouts,
      nextTarget, progressionPref, setProgressionPref, getProgressionPrefs, exerciseHasLoad,
      plannedSetsFor, startWorkout, restoreSession, persistSession, ensureSessionIds, focusedExercise,
      completeSet, deleteExercise, undoLast, moveExercise, finishWorkout, applyHoldToSession,
      prevSetsText, lastSessionSets, todayKey, lbToKg, kgToLb, fromW, toW, registerUndo, destructive,
      sanitizeStored, normTime, getProfile };
  `, ctx);
  // wipeAll uses Object.keys(localStorage); give it the real key list
  vm.runInContext(`Store.wipeAll = function () { localStorage.keys().filter(k => k.startsWith('forge:')).forEach(k => localStorage.removeItem(k)); _cache.clear(); };`, ctx);
  return ctx;
}
