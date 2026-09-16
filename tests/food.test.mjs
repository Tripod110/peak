/* The Food tab's data layer: the day log, the frequency ranking that feeds
 * both the chips and Grocery's "your usuals", and the day-summary reads the
 * home screen makes on every render.
 *
 *   node --test tests/*.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeContext } from './harness.mjs';

let ctx, P;
beforeEach(() => {
  ctx = makeContext(); P = ctx.__api;
  P.setProfile({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'moderate', goal: 'recomp', gymDays: 4, template: 'ppl6' });
});

const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const meal = (over = {}) => ({ name: 'Chicken burrito bowl', portion: '1', time: '13:05', kcal: 700, protein: 50, carbs: 70, fat: 20, fiber: 8, ...over });

test('a day totals what is logged against it, and nothing from any other day', () => {
  P.addFoodEntry(day(0), meal());
  P.addFoodEntry(day(0), meal({ name: 'Greek yogurt', kcal: 300, protein: 28, carbs: 30, fat: 8, time: '08:15' }));
  P.addFoodEntry(day(1), meal({ name: 'Oats', kcal: 400, protein: 18 }));
  const t = P.dayTotals(day(0));
  assert.equal(t.kcal, 1000);
  assert.equal(t.protein, 78);
  assert.equal(P.dayTotals(day(2)).kcal, 0, 'a day with nothing logged is zero, not NaN');
});

test('the day reads back in the order you ate, whatever order it was entered', () => {
  P.addFoodEntry(day(0), meal({ name: 'Dinner', time: '19:30' }));
  P.addFoodEntry(day(0), meal({ name: 'Breakfast', time: '07:45' }));
  P.addFoodEntry(day(0), meal({ name: 'Lunch', time: '12:15' }));
  assert.deepEqual([...P.foodForDay(day(0)).map(e => e.name)], ['Breakfast', 'Lunch', 'Dinner']);
});

test('deleting an entry and undoing it puts the same entry back in the same place', () => {
  P.addFoodEntry(day(0), meal({ name: 'Breakfast', time: '07:45' }));
  P.addFoodEntry(day(0), meal({ name: 'Lunch', time: '12:15' }));
  const lunch = P.foodForDay(day(0))[1];

  P.removeFoodEntry(day(0), lunch.id);
  assert.deepEqual([...P.foodForDay(day(0)).map(e => e.name)], ['Breakfast']);

  P.restoreFoodEntry(day(0), lunch);
  const back = P.foodForDay(day(0));
  assert.deepEqual([...back.map(e => e.name)], ['Breakfast', 'Lunch']);
  assert.equal(back[1].id, lunch.id, 'the same entry, not a copy of it');
  assert.equal(back[1].time, '12:15');
});

test('frequent foods rank by how often you log them, not by what you ate last', () => {
  for (let i = 0; i < 5; i++) P.addFoodEntry(day(0), meal({ name: 'Greek yogurt', kcal: 300, protein: 28 }));
  P.addFoodEntry(day(0), meal({ name: 'Birthday cake', kcal: 500, protein: 4 }));
  const rec = P.Store.get('recentFoods', []);
  assert.equal(rec[0].name, 'Greek yogurt', 'one weekend of one-offs must not evict your breakfast');
  assert.equal(rec[0].count, 5);
});

test('the frequent list is capped, so it cannot grow without bound', () => {
  for (let i = 0; i < 60; i++) P.addFoodEntry(day(0), meal({ name: `Food ${i}` }));
  assert.equal(P.Store.get('recentFoods', []).length, 40);
});

test('the home screen knows how many of the last fourteen days were logged', () => {
  P.addFoodEntry(day(0), meal());
  P.addFoodEntry(day(3), meal());
  P.addFoodEntry(day(20), meal());
  assert.equal(P.loggedDayCount(14), 2, 'a day three weeks back is not in the last fourteen');
});

test('"repeat a day" copies from a past day, never from the one on screen', () => {
  P.addFoodEntry(day(0), meal());
  P.addFoodEntry(day(2), meal());
  P.addFoodEntry(day(5), meal());

  P.App.foodDay = day(0);
  assert.equal(P.lastLoggedDay(), day(2), 'the most recent day that is not this one');

  P.App.foodDay = day(2);
  assert.equal(P.lastLoggedDay(), day(5), 'today is never a source — you copy a day forward, not back');
});

test('the nutrition score rewards protein and calorie accuracy, and survives a day with no quality ratings', () => {
  const t = P.computeTargets(P.getProfile());
  P.addFoodEntry(day(0), meal({ kcal: t.kcal, protein: t.protein, carbs: 100, fat: 40 }));
  const score = P.nutritionScore(day(0));
  assert.ok(score > 80, `hitting both targets should score well (got ${score})`);
  assert.ok(score <= 100);

  P.addFoodEntry(day(1), meal({ kcal: 300, protein: 2 }));
  assert.ok(P.nutritionScore(day(1)) < score, 'a day nowhere near target scores lower');
  assert.equal(P.nutritionScore(day(5)), null, 'a day with nothing logged has no score');
});

/* ---- v40 ---- */

test('one walk over the fortnight answers all three questions home asks', () => {
  P.addFoodEntry(day(0), meal());
  P.addFoodEntry(day(2), meal());
  P.addFoodEntry(day(20), meal());
  P.App.foodDay = day(0);

  const sum = P.daySummary();
  assert.equal(sum.loggedCount, 2, 'the day three weeks back is outside the window');
  assert.equal(sum.lastLogged, day(2));
  assert.deepEqual([...sum.rows.map(r => r.key)], [day(0), day(2)], 'newest first, and only logged days');
  assert.equal(sum.rows[0].items.length, 1);

  assert.equal(P.loggedDayCount(14), sum.loggedCount, 'the old helpers still agree with it');
  assert.equal(P.lastLoggedDay(), sum.lastLogged);
});

test('forgetting a frequent food can be taken back', () => {
  ['Greek yogurt', 'Oats', 'Chicken'].forEach(n => {
    P.addFoodEntry(day(0), meal({ name: n }));
    P.addFoodEntry(day(1), meal({ name: n }));
  });
  const before = P.Store.get('recentFoods', []).map(r => r.name);
  const idx = 1;
  const rec = P.Store.get('recentFoods', []);
  const [entry] = rec.splice(idx, 1);
  P.Store.set('recentFoods', rec);

  P.destructive('recent-food', { idx, entry }, 'forgot');
  P.undoLast();
  assert.deepEqual([...P.Store.get('recentFoods', []).map(r => r.name)], [...before],
    'back in the same position in the ranking');
});
