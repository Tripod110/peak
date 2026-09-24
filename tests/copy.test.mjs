/* Copy honesty: a screen never says the same sentence twice. Stage 2 of
 * UI-PASS.md removed the repeats by hand; this keeps them out. Renders Today
 * and Train's coach card for a profile with a few weeks of history, strips the markup, and fails on
 * any sentence over 20 characters that appears more than once.
 *
 *   node --test tests/*.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAppContext } from './harness.mjs';

const localDay = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function seeded() {
  const A = makeAppContext().__app;
  A.setProfile({ sex: 'male', age: 30, weightKg: 80, heightCm: 180, activity: 'moderate', goal: 'recomp', gymDays: 4, template: 'ppl6' });
  A.setSettings({ units: 'metric' });
  for (let d = 30; d >= 1; d--) {
    if ([0, 2, 4].includes(d % 7)) A.saveWorkout({ id: `w${d}`, date: localDay(d), dayName: 'Push A', score: 55 + d,
      exercises: [{ name: 'Bench Press', target: '3×8', sets: [1, 2, 3].map(() => ({ weight: 60 + (30 - d), reps: 8, type: 'normal' })) }] });
    if (d % 5) A.setSleepEntry(localDay(d), { bed: '23:15', wake: '06:30', quality: 3 });
    if (d % 6) A.addFoodEntry(localDay(d), { name: 'Chicken & rice', portion: '1 plate', time: '13:00', kcal: 1600, protein: 110, carbs: 170, fat: 40, fiber: 8 });
  }
  A.addFoodEntry(localDay(0), { name: 'Oats', portion: 'bowl', time: '08:00', kcal: 420, protein: 30, carbs: 60, fat: 9, fiber: 7 });
  return A;
}

function repeatedSentences(html) {
  const text = html.replace(/<[^>]+>/g, '\n').replace(/&[a-z]+;|&#\d+;/g, ' ');
  const seen = new Map();
  text.split(/\.\s|\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 20)
    .forEach(s => seen.set(s, (seen.get(s) || 0) + 1));
  return [...seen].filter(([, n]) => n > 1).map(([s]) => s);
}

test('Today never says the same sentence twice — with the weekly check-in', () => {
  const A = seeded();
  assert.ok(A.checkinDue(), 'the seeded profile has a week to review');
  const html = A.renderTodayHome();
  assert.ok(html.length > 1000, 'rendered something real');
  assert.deepEqual(repeatedSentences(html), []);
});

test('Today never says the same sentence twice — with the coach line', () => {
  const A = seeded();
  A.dismissCheckin();
  assert.deepEqual(repeatedSentences(A.renderTodayHome()), []);
});

test('Train\'s coach card never says the same sentence twice — two days with lifts you skip', () => {
  const A = seeded();
  // two routine days, each logged three times with only its first lift
  A.activeRoutine().days.slice(0, 2).forEach((day, k) => {
    for (let i = 0; i < 3; i++) A.saveWorkout({ id: `t${k}${i}`, date: localDay(1 + i * 2 + k), dayName: day.name,
      // as many sets as the plan asks, so the only advice left is about the skipped lifts
      exercises: [{ name: day.ex[0][0], target: day.ex[0][1],
        sets: Array.from({ length: parseInt(day.ex[0][1], 10) || 3 }, () => ({ weight: 50, reps: 8, type: 'normal' })) }] });
  });
  const html = A.renderCoachCard();
  assert.ok(html, 'there is advice to render');
  assert.deepEqual(repeatedSentences(html), []);
});

test('the repeat detector catches a repeat', () => {
  assert.deepEqual(repeatedSentences('<p>Consistency outranks intensity right now. Go.</p><p>Consistency outranks intensity right now. Again.</p>'),
    ['Consistency outranks intensity right now']);
});
