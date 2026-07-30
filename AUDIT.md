# UX & engineering audit — 2026-07-29

A senior-mobile-lead review of Peak, simulating a month of real use. Every finding below is
traced to the code that fixed it and the check that proved it.

**Audited:** v24 (`1bc82ed`) · **Fixes shipped in:** v27 (`5f0a417`), except the backup nudge
in v28 (`d5f2c02`) · **Findings:** 30 · **Fixed:** 30 · **Independently verified:** 29

## Method

Read all ~2,900 lines, then ran the app on a 375×812 viewport against a seeded 35 days of
realistic use: 23M, 176 lb, slow cut, 5×/week PPL — 29 sessions, 27 food days, 30 sleep
nights, 19 weigh-ins, with deliberate messiness (weekend logging gaps, a week-3 sleep slump,
a bench stall). Findings were reproduced by instrumenting the running app, not inferred from
reading.

**Reproducing this:** the seed script is not committed — it was executed against
`localStorage` in a throwaway browser context, never against production data. Re-running the
audit means re-seeding; the shape of the data is described above and in each finding below.

Line numbers are deliberately omitted in favour of file + symbol, which survive edits.

---

## P0 — ship-blockers

### 1. The deload spiral detrained compliant users
**Symptom.** `detectPlateaus()` flagged a lift whose all-time best e1RM was unbeaten, and
`nextTarget()` cut 10% off the *last* weight. After deloading, the all-time best was still
unbeaten, so the lift read as stalled again and got cut again — off the already-reduced weight.
A user following the app's own advice, hitting every prescribed set, went
`155 → 145 → 130 → 115 → 105 → 95 → 85 lb` in six sessions while the text promised "then add
5 lb a session."

**Fix.** `train.js` · `nextTarget`, `bestWorkingWeightKg`. Two changes: `allHit` is tested
*before* the stall flag, so completing the prescription always earns the increment; and a
deload only fires at ≥98% of the all-time best, because below it you are already rebuilding.
No new persisted state — it is derived from history, so nothing to migrate.

**Verified.** Replayed the same eight-session compliant trace:
`145▼ 150▲ 155▲ 160▲ 165▲ 170▲ 175▲ 180▲` — one deload, then climbing past the old best.
Separately verified a user who keeps *missing* reps holds at 145 with "climbing back to 160"
rather than being cut again.

### 2. In-progress workouts existed only in RAM
**Symptom.** `App.activeSession` was never persisted. A reload or an iOS memory purge between
sets discarded the entire session — completed sets and PRs — with no warning and no recovery.

**Fix.** `train.js` · `persistSession`, `restoreSession`, `clearPersistedSession`. Mirrored to
storage at 16 mutation points including a debounced typing handler. Restored on boot; the rest
timer resumes from its absolute `endsAt`. A session from a previous day gets a banner offering
to finish it under that date or discard it.

**Verified.** Reloaded mid-workout: the done set, the typed weight (185), and a running 3:00
rest timer all survived, landing on the Train tab. Finishing after the reload saved exactly
the marked sets.

### 3. Typed set values were silently discarded on tab switch
**Symptom.** Every mutating action called `readSetInputs()` first — except the tab bar. Typing
185, tapping Food, returning to Train showed 140 again. Mid-workout tab switching is normal.

**Fix.** `app.js` · tabbar handler and `go-tab` now call `readSetInputs()` before re-render.
A delegated `input` listener marks sets `touched` so an edited-but-unticked set still saves.

**Verified.** 185 → Food → Train → still 185, and mirrored to storage as 185.

---

## P1 — trust-breaking

### 4. Two contradictory "7-day sleep averages"
**Symptom.** The Sleep tab averaged the last 7 *entries* regardless of date. With sparse
logging — 7 nights spread over 37 days — it reported **"7-day avg 8h 26m"** and a green
*"recovery is on point"*, while the Today tab, iterating calendar days, computed **5h 00m**
for the same data. The reassuring number was the wrong one.

**Fix.** `sleep.js` · `sleepAvgDays(days)` walks calendar days and returns coverage alongside
the average. Copy states the coverage; a verdict is withheld below 4 nights.

**Verified.** Same sparse dataset: both screens now report **5h 00m**, and the insight reads
"Only 1 of the last 7 nights logged."

### 5. Sleep and weight could only be logged for today
**Symptom.** `setSleepEntry` and `logWeight` hard-coded `todayKey()`. A forgotten night or
weigh-in was permanently unrecordable, which then skewed the averages driving the advice.

**Fix.** `sleep.js` gained a day navigator, a 14-night list showing gaps, an editable date and
delete. `store.js` · `logWeight(kg, date)` takes an optional date and only updates
`profile.weightKg` when the entry is the newest. The duplicate inline weight input was removed
in favour of one validated modal.

**Verified.** Backfilled a gap night (495 min) and a weigh-in 9 days back; confirmed the
backfilled weight did *not* overwrite the profile weight.

### 6. The day score punished hand-logging, not bad food
**Symptom.** Quality contributed 70 of 100 points and manual entries defaulted to `quality: 5`.
A nutritionally perfect manual day — calories exactly on target, protein over — scored **65**
and got an amber pill. It was arithmetically impossible for a hand-logged day to beat 65.

**Fix.** `store.js` · `nutritionScore`. Protein 45 + calorie accuracy 25 + quality 30, where
quality counts only items carrying a real rating and the remaining 70 is rescaled when none do.
Quality is opt-in in the manual form rather than silently defaulting.

**Verified.** The same perfect manual day now scores **100**; a junk manual day (2,230 kcal,
40 g protein) scores **50**, so the metric still discriminates on food.

### 7. Cardio counted as a lifting session everywhere
**Symptom.** `sessionsInDays(days, liftsOnly)` existed but **no caller ever passed
`liftsOnly`**. A Sunday walk counted toward "3 of 5 sessions this week" and kept `weekStreak`
alive. Meanwhile the weekly review deliberately separated the two, so the same week read as
met on one screen and short on another.

**Fix.** `train.js`, `app.js` — `liftsOnly: true` passed at every plan-adherence site;
`weekStreak` counts lifts only; cardio reported separately.

**Verified.** `sessionsInDays(7)` = 6, `sessionsInDays(7, true)` = 5. **User-visible
consequence:** week-streak numbers drop after this release — on the seeded month, 5 → 2. That
is the honest figure.

### 8. The muscle map failed silently to zero
**Symptom.** `musclesFor()` returned `{p: [], s: []}` for any unmatched name, so unmapped
lifts contributed nothing. Glute Ham Raise, Kettlebell Swing, Landmine Press and Sled Push all
missed. A lifter whose hamstring work was Glute Ham Raises saw "Hamstrings 0 / 6–20 — below
effective volume", and `plateauVolumeNote` then blamed that phantom deficit for their stall.

**Fix.** `train.js` · `muscleSetsInDays` returns an `unclassified` list; the muscle screen
surfaces it with one-tap tagging (`openTagMuscleModal`, `setMuscleOverride`, persisted and
consulted ahead of the regex table); `plateauVolumeNote` stays silent while anything is
untagged. Rules added for the four misses above.

**Verified.** End-to-end with `Tibialis Raise`: bucket appears → volume advice suppressed →
tagged as calves/quads → calves 9 → 12 → bucket empties → advice re-enables.

**Residual risk:** this only works if users actually tag. Flagged in `ROADMAP.md` week 2 as
something to watch, not assume.

### 9. Three of four built-in templates trained zero abs
**Symptom.** `ul4`, `ppl5` and `ppl6` contained no ab work, so following the app's own program
produced a permanent amber "1 muscle below effective volume — Abs 2 / 6–25". The 2 sets were
phantom secondary credit from front squats. Two features contradicting each other.

**Fix.** `train.js` · `TEMPLATES` — `Hanging Leg Raise` and `Cable Crunch` added across
`ul4`, `ppl5`, `ppl6`.

**Verified.** Abs now reads **8 sets/week against an MEV of 6** on `ppl5`.

---

## P2 — daily friction

| # | Finding | Fix (file · symbol) | Verified |
|---|---|---|---|
| 10 | Sessions opened with **zero** set rows — 20 taps before logging anything, though the prescription was already known and displayed | `train.js` · `plannedSetsFor`, `startWorkout` | 19–20 rows created up front, **0 taps**, marked `planned` and dimmed; only ticked-or-edited sets save |
| 11 | "Frequent foods" was a recency list (LRU, cap 20) — one weekend of one-offs evicted the daily breakfast, so it degraded as it should have improved | `store.js` · `rememberRecentFood` (count + `lastAt`, cap 40) | Chips ordered by count with `×23` shown |
| 12 | Food entries could not be edited; `openManualFood(prefill)` accepted a prefill nothing ever passed. README claimed "review and edit before logging" | `store.js` · `updateFoodEntry`; `food.js` · `openManualFood`, editable scan-review fields | Edit preserves the id, updates amounts and time; scan estimates editable before logging |
| 13 | `addFoodEntry` stamped `new Date()`, so repeat-a-day gave every copied meal the current time and there was no way to correct one | `store.js` · `addFoodEntry` honours a supplied time; `foodForDay` sorts by time | Copied day preserved `08:15 / 13:40 / 19:40 / 22:15` exactly |
| 14 | Age, sex, height and activity were uneditable after onboarding — activity is a 44% TDEE swing, and onboarding promised "adjust anytime in Settings" | `app.js` · `openSettingsModal`, `saveSettings` | All editable, plus units and goal weight |
| 15 | The weak-link verdict was a first-match chain on a hard threshold: a 418-minute sleep average was "your bottleneck", 421 was fine | `app.js` · `weeklyWeakLink` — severity ranking, deadbands, hysteresis | Mild-sleep + severe-protein now picks protein (previously always sleep); near-ties hold the prior verdict; clearly-worse still takes over |
| 16 | Flat +5 lb on all upper-body work — a 25% jump on a lateral raise — and dumbbell weights were never defined as per-hand or total, making history ambiguous by 2× | `train.js` · `incrementW`, `perHandLift`, `setLoadKg` | Lateral raise +2.5, bench +5 at 160 and +10 at 315, squat +10; per-hand labelled and doubled for volume |
| 17 | One Train render re-read and re-parsed the whole workouts blob ~70 times; 159 ms at a year of history, on every interaction | `store.js` · `const _cache` read-through cache | **1** `localStorage` read per render; 4.5 ms at 35 days, 27.9 ms at 280 sessions |

---

## P3 — polish, accessibility, hygiene

| # | Finding | Fix | Verified |
|---|---|---|---|
| 18 | `user-scalable=no` blocked pinch-zoom (WCAG 1.4.4) | `index.html` viewport meta | Removed; `viewport-fit=cover` retained |
| 19 | Delete-set was 24×34 px, 6 px from the 36×36 ✓, destructive, no undo | `style.css` · `.set-row`, `.x-btn`; `train.js` · `deleteSet` + undo toast | Both 44×44 with a 16 px gap; delete undoable |
| 20 | Tapping outside onboarding left a blank screen with no way back | `app.js` · `openModal(html, {dismissible:false})` | Survives backdrop tap; Back added; real validation |
| 21 | Import overwrote data with no confirmation and merged rather than replaced, producing hybrid state | `store.js` · `importAll` wipes first; `app.js` confirms | Confirm dialog; clean replace |
| 22 | Scan modal said "Claude estimates calories" — the scanner is Gemini | `food.js` copy | Corrected |
| 23 | Fiber was collected by the AI schema, stored, and never surfaced or targeted | `store.js` · `computeTargets` (14 g/1000 kcal); `food.js` bar + manual field; trends card | Target 31 g shown and tracked |
| 24 | A stable weight week printed gridlines `174 / 174 / 174` | `charts.js` · `axisDecimals` | Now `174.1 / 174.2 / 174.3` |
| 25 | Trend charts spaced unequal date gaps evenly, distorting every trend for inconsistent loggers | `charts.js` · `lineChart` optional `x` day-offset scale | Date-scaled; gap segments dashed with a note |
| 26 | "Top lift" ranked by absolute e1RM, so the leg press always won | `train.js` · `topCoreLift`, `CORE_LIFTS` | Restricted to lifts people measure themselves by |
| 27 | No goal weight — a cut with no finish line | `app.js` · `renderGoalWeight`; `profile.goalWeightKg` | "X to go" with an ETA from the 7-day rate |
| 28 | Service worker was network-first for everything, so every launch on weak signal waited for a timeout | `sw.js` — network-first HTML, cache-first versioned assets | Confirmed; the two-load update behaviour is documented in `SHIPPING.md` |
| 29 | Dead code: `renderStreaks` (28 lines, uncalled), unused `prefill` param, unused `liftsOnly`, vestigial `live-sets`/`live-vol` ids | Removed or wired | `grep` clean |
| 30 | lb hard-coded throughout while storing kg; a time-format toggle existed but no units toggle | `store.js` · `isMetric`, `toW`, `fromW`, `wUnit`, `wStep`; metric plate math and increments | No stray `lb` anywhere in metric mode; unit switch never mutates stored data |

**One bug found while fixing #30:** the volume quip stored a *rendered sentence*, so it kept
saying "lb" after a switch to kg. Now stores the data and renders at display time —
`quips.js` · `quipText`, with a migration that clears pre-v25 pre-rendered quips.

---

## Not verified

**Real-device behaviour — the one open item.** Every layout and tap-target claim above was
measured from computed DOM geometry, because the browser pane never composited during the
audit (`window.innerHeight` reported 0, so screenshots and `elementFromPoint` were both
unavailable). Sizes and gaps are trustworthy; *appearance and feel are not evidence-backed.*

The checklist to close this is in [SHIPPING.md](SHIPPING.md) → "Real-device pass". The
highest-risk single item: whether ✓ can be hit without hitting ✕ one-handed, mid-set, on a real
phone. Tracked as an open item in [ROADMAP.md](ROADMAP.md).

## Deliberately not changed

- **`forge:` localStorage prefix.** Renaming it would orphan every existing user's data for no
  user-visible benefit.
- **Historic day scores shift as bodyweight changes**, because `nutritionScore` uses the
  current protein target rather than the target on that day. Fixing it means snapshotting
  targets per day — real work, near-zero user impact.
- **Plateau rule left as-is** (3 sessions + 21 days, no e1RM PR). It is a defensible v1;
  `ROADMAP.md` months 3–6 lists the upgrades.
