/* A restored backup is the one file that writes straight into Peak's storage,
 * so it is treated as untrusted input: keys outside the `forge:` namespace are
 * dropped, and every value is coerced before anything renders it. These tests
 * cover that boundary — see DECISIONS.md D-17 and CHANGELOG v38.
 *
 *   node --test tests/*.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from './harness.mjs';

let ctx, P;
beforeEach(() => { ctx = makeContext(); P = ctx.__api; });

const XSS = '<img src=x onerror=alert(1)>';
const backup = data => JSON.stringify({
  app: 'peak', version: 2, exported: new Date().toISOString(),
  data: Object.fromEntries(Object.entries(data).map(([k, v]) => ['forge:' + k, JSON.stringify(v)]))
});
/* a backup carrying keys Peak never wrote — the shape that used to land in
   storage shared with every other site on the same GitHub Pages origin */
function withForeignKeys(json, keys) {
  const p = JSON.parse(json);
  keys.forEach(k => { p.data[k] = '"whatever"'; });
  return JSON.stringify(p);
}

test('keys outside the forge: namespace are dropped and counted', () => {
  const json = withForeignKeys(backup({ settings: { units: 'metric' } }), ['evil', 'other-app:token']);
  const { skipped } = P.Store.importAll(json);
  assert.equal(skipped, 2);
  assert.equal(ctx.localStorage.getItem('evil'), null);
  assert.equal(ctx.localStorage.getItem('other-app:token'), null);
  assert.equal(P.getSettings().units, 'metric', 'the legitimate part still restores');
});

test('a time-shaped field that is not a time never survives the import', () => {
  P.Store.importAll(backup({
    settings: { timeFmt: '24' },                                   // the mode that rendered it verbatim
    sleep: { '2026-09-01': { bed: XSS, wake: '07:00', quality: 3 },
             '2026-09-02': { bed: '23:15', wake: '07:00', quality: 99 } }
  }));
  const sleep = P.Store.get('sleep', {});
  assert.equal(sleep['2026-09-01'], undefined, 'an unparseable time drops the whole night');
  assert.equal(sleep['2026-09-02'].bed, '23:15');
  assert.equal(sleep['2026-09-02'].quality, 5, 'out-of-range ratings clamp to the scale');
  assert.equal(P.normTime(XSS), '');
});

test('reminder times are coerced, because they render into a value attribute', () => {
  P.Store.importAll(backup({ settings: { reminders: { enabled: true, sleep: `" autofocus onfocus=${XSS} x="`, food: '21:30' } } }));
  const r = P.getSettings().reminders;
  assert.equal(r.sleep, null);
  assert.equal(r.food, '21:30');
  assert.equal(r.enabled, true);
});

test('settings added after v33 survive a round trip instead of being reset', () => {
  P.setSettings({ theme: 'forest', dietary: { restrictions: ['peanut', 'vegan'] },
                  reminders: { enabled: true, sleep: '22:00', food: null } });
  const json = P.Store.exportAll();
  P.Store.wipeAll();
  P.Store.importAll(json);
  const s = P.getSettings();
  assert.equal(s.theme, 'forest');
  assert.deepEqual([...s.dietary.restrictions], ['peanut', 'vegan']);   // spread: the array is born in the VM realm
  assert.equal(s.reminders.sleep, '22:00');
});

test('a theme or restriction Peak does not define falls back to the default', () => {
  P.Store.importAll(backup({ settings: { theme: `dark" onload=${XSS}`, dietary: { restrictions: ['peanut', 'made-up', XSS] } } }));
  const s = P.getSettings();
  assert.equal(s.theme, 'dark');
  assert.deepEqual([...s.dietary.restrictions], ['peanut']);
});

test('a crafted exercise uid is replaced, so it never reaches a data-uid attribute', () => {
  const evil = '" onmouseover=alert(1) data-x="';
  P.Store.importAll(backup({
    activeSession: { id: 'w1', date: P.todayKey(), dayName: 'Upper A', exercises: [
      { name: 'Bench Press', target: '4×5', uid: evil, sets: [{ weight: 60, reps: 5, type: 'normal' }] },
      { name: 'Barbell Row', target: '4×6', uid: 'xabc123def', sets: [{ weight: 50, reps: 6, type: 'normal' }] }
    ], focusUid: evil }
  }));
  const s = P.restoreSession();
  assert.ok(/^x[a-z0-9]{6,32}$/.test(s.exercises[0].uid), 'hostile uid regenerated');
  assert.equal(s.exercises[1].uid, 'xabc123def', 'a well-formed uid is kept, so focus survives a restore');
  assert.ok(/^x[a-z0-9]{6,32}$/.test(s.focusUid));
  assert.notEqual(s.focusUid, evil);
});

test('a session whose sets are not an array no longer bricks the Train tab', () => {
  P.Store.importAll(backup({
    activeSession: { id: 'w1', date: P.todayKey(), dayName: 'Upper A',
                     exercises: [{ name: 'Bench Press', target: '4×5', sets: 'not an array' }] }
  }));
  const s = P.restoreSession();
  assert.equal(s.exercises[0].sets.length, 0);
  assert.doesNotThrow(() => P.focusedExercise());
});

test('progression preferences from a backup are bounded, and prototype keys are dropped', () => {
  P.Store.importAll(backup({
    progressionPrefs: {
      'bench press': { incKg: 1.25, hold: { kg: 90, since: '2026-09-01' } },
      'barbell row': { incKg: -5, hold: { kg: 'heavy', since: XSS } },
      '__proto__': { incKg: 999 }
    }
  }));
  const all = P.getProgressionPrefs();
  assert.equal(all['bench press'].incKg, 1.25);
  assert.equal(all['bench press'].hold.since, '2026-09-01');
  assert.equal(all['barbell row'], undefined, 'nothing valid left, so the entry goes');
  assert.equal(Object.prototype.hasOwnProperty.call(all, '__proto__'), false);
  assert.equal(({}).incKg, undefined, 'and the prototype was never touched');
});
