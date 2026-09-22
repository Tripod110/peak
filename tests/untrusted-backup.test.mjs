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

/* ---- v40: keys that reached a sink without passing the boundary ---- */

test('a groceryFoodCache that is not an array cannot brick the Food tab', () => {
  P.Store.importAll(backup({ groceryFoodCache: 'not an array' }));
  const cache = P.Store.get('groceryFoodCache', []);
  assert.ok(Array.isArray(cache), 'a string here used to survive, and a string has .slice but not .map');
  assert.equal(cache.length, 0);
});

test('groceryFoodCache is bounded and holds strings only', () => {
  P.Store.importAll(backup({
    groceryFoodCache: [...Array(80).keys()].map(i => `Item ${i}`).concat([null, 42, { name: 'x' }])
  }));
  const cache = P.Store.get('groceryFoodCache', []);
  assert.equal(cache.length, 20);
  assert.ok(cache.every(n => typeof n === 'string' && n.length));
});

test('scan stats are numbers by the time Settings renders them', () => {
  P.Store.importAll(backup({ scanStats: { scans: XSS, in: 1e12, out: 500, thoughts: 0, model: `gemini" onload=${XSS}` } }));
  const st = P.Store.get('scanStats', {});
  assert.equal(st.scans, 0, 'markup coerces to 0, not to a string that renders');
  assert.equal(typeof st.out, 'number');
  assert.equal(st.model, '', 'a model id that is not a model id is dropped');
});

test('a grocery item with an unrecognised aisle is repaired, never left invisible', () => {
  P.Store.importAll(backup({
    grocery: [{ id: 'g1', name: 'Chicken thighs', qty: 1, done: false, aisle: 'produce2' },
              { id: 'g2', name: 'Frozen peas', qty: 1, done: false, aisle: 'frozen' }]
  }));
  const items = P.Store.get('grocery', []);
  assert.equal(items[0].aisle, undefined, 'unknown aisle dropped, so aisleFor() re-derives it');
  assert.equal(items[1].aisle, 'frozen', 'a known one is kept');
  assert.ok(items.every(i => i.aisle === undefined || P.AISLE_IDS.includes(i.aisle)));
});

test('the grocery grouping preference round-trips, and a made-up value does not', () => {
  P.setSettings({ grocGroup: 'aisle' });
  const json = P.Store.exportAll();
  P.Store.wipeAll();
  P.Store.importAll(json);
  assert.equal(P.getSettings().grocGroup, 'aisle');
  P.Store.importAll(backup({ settings: { grocGroup: `flat" onload=${XSS}` } }));
  assert.equal(P.getSettings().grocGroup, 'auto');
});

test('editing a food entry refreshes its macros without counting it as eaten again', () => {
  P.addFoodEntry(P.todayKey(), { name: 'Chicken burrito bowl', kcal: 700, protein: 50, carbs: 70, fat: 20 });
  const entry = P.Store.get('food', {})[P.todayKey()][0];
  const first = P.Store.get('recentFoods', []).find(r => r.name === 'Chicken burrito bowl');
  assert.equal(first.count, 1);

  P.updateFoodEntry(P.todayKey(), entry.id, { protein: 56 });
  const after = P.Store.get('recentFoods', []).find(r => r.name === 'Chicken burrito bowl');
  assert.equal(after.count, 1, 'a correction is not a second helping');
  assert.equal(after.protein, 56, 'but the numbers Peak remembers do update');

  P.addFoodEntry(P.todayKey(), { name: 'Chicken burrito bowl', kcal: 700, protein: 56, carbs: 70, fat: 20 });
  assert.equal(P.Store.get('recentFoods', []).find(r => r.name === 'Chicken burrito bowl').count, 2);
});

/* deviceId is the only thing the Worker checks on /subscribe and /unsubscribe,
   so it must never leave in a backup or arrive from one. */
test('deviceId is never exported, and a backup cannot overwrite this device\'s', () => {
  ctx.localStorage.setItem('forge:deviceId', JSON.stringify('mine'));
  const out = JSON.parse(P.Store.exportAll());
  assert.equal(out.data['forge:deviceId'], undefined, 'not in the exported file');

  const { skipped } = P.Store.importAll(backup({ deviceId: 'someone-elses', settings: { units: 'metric' } }));
  assert.equal(P.Store.get('deviceId', null), 'mine', 'this device keeps its own id');
  assert.equal(skipped, 0, 'an older backup carrying one is not reported as foreign');
  assert.equal(P.getSettings().units, 'metric');
});
