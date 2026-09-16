/* Grocery's list logic, written before the v40 rebuild so the rebuild has to
 * keep it true. Everything here is pure or store-only; the rendering is not
 * under test.
 *
 *   node --test tests/*.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from './harness.mjs';

let ctx, P;
beforeEach(() => { ctx = makeContext(); P = ctx.__api; });

const names = () => P.getGrocery().map(i => i.name);

test('a quantity typed into the name is understood, whichever way round it is written', () => {
  assert.deepEqual({ ...P.parseQty('2 eggs') }, { name: 'eggs', qty: 2 });
  assert.deepEqual({ ...P.parseQty('2x eggs') }, { name: 'eggs', qty: 2 });
  assert.deepEqual({ ...P.parseQty('2 × eggs') }, { name: 'eggs', qty: 2 });
  assert.deepEqual({ ...P.parseQty('eggs x2') }, { name: 'eggs', qty: 2 });
  assert.deepEqual({ ...P.parseQty('eggs ×2') }, { name: 'eggs', qty: 2 });
  assert.deepEqual({ ...P.parseQty('eggs') }, { name: 'eggs', qty: 1 });
  assert.deepEqual({ ...P.parseQty('  ') }, { name: '', qty: 1 });
});

test('quantities are clamped to something a shopping list can mean', () => {
  assert.equal(P.parseQty('900 eggs').qty, 99);
  assert.equal(P.parseQty('0 eggs').qty, 1);
});

test('frozen beats produce, because frozen broccoli is bought in the freezer aisle', () => {
  assert.equal(P.aisleFor('frozen broccoli'), 'frozen');
  assert.equal(P.aisleFor('broccoli'), 'produce');
  assert.equal(P.aisleFor('chicken thighs'), 'meat');
  assert.equal(P.aisleFor('greek yogurt'), 'dairy');
  assert.equal(P.aisleFor('whey protein'), 'supps');
  assert.equal(P.aisleFor('paper towels'), 'other', 'anything unmatched still lands somewhere');
});

test('grouping walks the shop in order and never loses an item', () => {
  ['Greek yogurt', 'Chicken thighs', 'Frozen peas', 'Rice', 'Paper towels'].forEach(n => P.groceryAdd(n));
  const groups = P.groupByAisle(P.getGrocery());
  const grouped = groups.flatMap(g => g.items);
  assert.equal(grouped.length, 5, 'every item appears in exactly one group');
  const order = groups.map(g => g.id);
  assert.deepEqual([...order], [...P.AISLES.filter(a => order.includes(a.id)).map(a => a.id)]);
});

test('adding something already on the list bumps its quantity instead of duplicating it', () => {
  P.groceryAdd('Greek yogurt');
  P.groceryAdd('greek YOGURT');
  assert.equal(P.getGrocery().length, 1);
  assert.equal(P.getGrocery()[0].qty, 2);

  P.groceryAdd('3 greek yogurt');
  assert.equal(P.getGrocery()[0].qty, 5, 'and it adds the quantity, not one');
});

test('a checked-off item does not absorb the next add of the same thing', () => {
  P.groceryAdd('Eggs');
  const list = P.getGrocery();
  list[0].done = true;
  P.setGrocery(list);
  P.groceryAdd('Eggs');
  assert.equal(P.getGrocery().length, 2, 'what is in the cart is not what you still need');
});

test('an empty add is ignored rather than adding a blank row', () => {
  P.groceryAdd('   ');
  assert.equal(P.getGrocery().length, 0);
});

test('"your usuals" is what you log repeatedly, minus what is already on the list', () => {
  P.Store.set('recentFoods', [
    { name: 'Greek yogurt', kcal: 120, protein: 18, count: 9, lastAt: P.todayKey() },
    { name: 'Chicken thighs', kcal: 300, protein: 40, count: 4, lastAt: P.todayKey() },
    { name: 'Birthday cake', kcal: 500, protein: 4, count: 1, lastAt: P.todayKey() }
  ]);
  assert.deepEqual(P.yourUsuals().map(u => u.name), ['Greek yogurt', 'Chicken thighs'],
    'logged once is a one-off, not a habit');

  P.groceryAdd('greek yogurt');
  assert.deepEqual(P.yourUsuals().map(u => u.name), ['Chicken thighs'],
    'and it stops suggesting what you have already written down');
});

test('a meal adds its ingredients, and adding it twice does not double the list', () => {
  P.groceryAddFromSection('meals', 0);
  const first = P.getGrocery().length;
  assert.equal(first, P.EASY_MEALS[0].items.length, 'a meal adds every ingredient');
  P.groceryAddFromSection('meals', 0);
  assert.equal(P.getGrocery().length, first, 'the second add is all duplicates');
});

test('checking an item off tells Food about it, exactly once', () => {
  P.rememberGroceryFood('Greek yogurt');
  P.rememberGroceryFood('greek yogurt');
  assert.deepEqual([...P.getGroceryFoodCache()], ['greek yogurt'], 'newest spelling wins, no duplicate');
});

/* ---- v40 ---- */

test('an item stored with an aisle Peak does not recognise still appears on the list', () => {
  P.setGrocery([
    { id: 'g1', name: 'Chicken thighs', qty: 1, done: false, aisle: 'produce2' },
    { id: 'g2', name: 'Rice', qty: 1, done: false, aisle: 'pantry' }
  ]);
  const groups = P.groupByAisle(P.getGrocery());
  const shown = groups.flatMap(g => g.items).map(i => i.name);
  assert.equal(shown.length, 2, 'it used to count toward "N to get" and then render nowhere');
  assert.ok(shown.includes('Chicken thighs'));
  assert.equal(groups.find(g => g.items.some(i => i.name === 'Chicken thighs')).id, 'meat',
    'and it lands where its name says it belongs');
});

test('packaging is not identity: the same item written two ways is one row', () => {
  assert.ok(P.groceryMatch('Eggs (dozen)', 'Eggs (dozen ×2)'));
  assert.ok(P.groceryMatch('Chicken thighs (family pack)', 'chicken thighs'));
  assert.ok(P.groceryMatch('Canned tuna ×4', 'Canned tuna'));
  assert.ok(!P.groceryMatch('Ground turkey', 'Ground beef'));
  assert.ok(!P.groceryMatch('', 'anything'));

  P.groceryAdd('Eggs (dozen ×2)');
  P.groceryAddFromSection('meals', P.EASY_MEALS.findIndex(m => m.items.some(i => /^eggs/i.test(i))));
  assert.equal(names().filter(n => /eggs/i.test(n)).length, 1,
    'adding a meal after its staple must not put the same eggs on twice');
});

test('grouping follows the preference, not just the length of the list', () => {
  ['Greek yogurt', 'Chicken thighs', 'Rice'].forEach(n => P.groceryAdd(n));
  const open = () => P.getGrocery().filter(i => !i.done);

  assert.equal(P.grocGrouped(open()), null, 'auto leaves a short list flat');

  P.setSettings({ grocGroup: 'aisle' });
  assert.equal(P.grocGrouped(open()).length, 3, 'always means always');

  P.setSettings({ grocGroup: 'flat' });
  assert.equal(P.grocGrouped(open()), null, 'off means off');

  P.setSettings({ grocGroup: 'auto' });
  ['Oats', 'Milk', 'Bananas'].forEach(n => P.groceryAdd(n));
  assert.ok(P.grocGrouped(open()), 'and auto switches on once the list is worth walking');
});

test('deleting an item offers it back, in the place it came from', () => {
  ['First', 'Second', 'Third'].forEach(n => P.groceryAdd(n));
  const middle = P.getGrocery()[1];
  const idx = 1;

  P.setGrocery(P.getGrocery().filter(i => i.id !== middle.id));
  P.destructive('grocery-item', { idx, item: middle }, 'removed');
  assert.equal(P.App.undo.kind, 'grocery-item');

  P.undoLast();
  assert.deepEqual([...names()], ['Third', 'Second', 'First'], 'back in the middle, not on top');
  assert.equal(P.App.undo, null, 'and the offer is spent');
});

test('the last − on an item is a delete, and it is undoable like any other', () => {
  P.groceryAdd('Greek yogurt');
  const it = P.getGrocery()[0];
  P.groceryQty(it.id, -1);
  assert.equal(P.getGrocery().length, 0);

  P.undoLast();
  assert.deepEqual([...names()], ['Greek yogurt'], 'a mis-tap at quantity one is not permanent');
  assert.equal(P.getGrocery()[0].qty, 1);
});

test('clearing the cart can be taken back whole', () => {
  ['Milk', 'Rice', 'Oats'].forEach(n => P.groceryAdd(n));
  const list = P.getGrocery();
  list[0].done = true; list[2].done = true;     // Oats and Milk are in the cart
  P.setGrocery(list);

  const cleared = P.getGrocery().map((item, idx) => ({ item, idx })).filter(({ item }) => item.done);
  P.setGrocery(P.getGrocery().filter(i => !i.done));
  P.destructive('grocery-clear', { items: cleared }, 'cleared');
  assert.equal(P.getGrocery().length, 1);

  P.undoLast();
  assert.equal(P.getGrocery().length, 3);
  assert.deepEqual([...names()], ['Oats', 'Rice', 'Milk'], 'every row back at its own index');
});
