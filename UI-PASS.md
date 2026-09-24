# UI pass — the plan a loop works through

Four passes over Peak's interface, smallest blast radius first. Nothing here adds a feature;
it removes repetition, shortens copy, and makes the screens look like one app.

**Start the loop with:**

```bash
/loop Work UI-PASS.md: do the next unchecked item, verify it, commit it, tick it off.
```

Leave the interval off so the session paces itself — each item is a real edit plus a browser
check, not a poll.

---

## How one iteration works

1. Read this file. Take the **first unchecked box**, top to bottom. Stages are ordered; don't
   start stage 3 while stage 2 has open boxes.
2. Do only that item. If it turns out to be two items, split it in this file and do the first.
3. Verify it (see *Checks* below).
4. Commit it on its own, message `ui: <what changed>`.
5. Tick the box here, append one line to *Progress* with the short hash, and stop.

An item that turns out to be wrong — the duplication isn't real, the change makes it worse —
gets struck through here with one line saying why. That is a valid iteration.

### Rules that outrank everything below

- Vanilla JS, no build step, no dependencies, no new tabs. Five tabs stay five tabs.
- Reuse the builders in `ui.js` (`tile`, `tileStrip`, `heroCard`, `heroStats`, `navRow`,
  `icon`). If two screens need the same markup, it belongs in `ui.js`, not copied.
- `ui.js` load-order rule: reference `esc`/`icon`/`App`/`CHART` **inside function bodies only**,
  never at module scope.
- Escaping rule (D-17): a field named `*Html` is caller-built markup; everything else is escaped
  by the builder. Don't widen that.
- Stored data shapes don't change. No migrations, no backup-format changes, no `worker/` edits.
- Keep every theme, 44px targets, visible focus, reduced-motion support, and the v46 contrast
  gains. Don't regress accessibility to save a line.
- Don't push. Commit locally; the human decides when a stage goes live.

### Checks — run before ticking any box

```bash
for f in *.js; do node --check "$f"; done
node --test tests/*.test.mjs
node tools/release.mjs --check
```

Then in the browser (`preview_start` → `peak-static`, seeded profile with a few weeks of
history), at **390px** and **320px**:

- the screen you changed, plus one screen you didn't, for collateral damage
- no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`)
- the dock/tab bar still clears the last control
- one theme other than dark

Version bumps happen **once per stage**, not per item: when a stage's boxes are all ticked, run
`node tools/release.mjs --check` to see the current number, bump to the next one, write the
CHANGELOG entry, commit as `vNN: <stage name>`.

---

## Stage 1 — one number, one place

Today shows "1 of 4 sessions" three times, protein twice, sleep twice. Food stacks two stat
blocks back to back. Sleep prints its score twice. Every duplicate is a place the eye has to
decide which copy matters.

**Today** — `app.js:renderTodayHome`, `coach.js:renderWeeklyCheckin` / `renderCoachLine`

- [x] Sessions this week appears in the weekly check-in, the Week tile, and Explore → This week.
      The tile is the one people look at: keep it, drop the count from the check-in's stat row,
      and give the Explore row a value that isn't the same number.
- [x] Protein appears in the check-in ("7 of 7 protein days") and the Protein tile. Keep the
      tile. The check-in may keep protein only as a *streak* framing the tile can't show.
- [x] Sleep appears as the check-in's 7-day average and the tile's last night. Both are useful
      and neither says which it is — label them ("7-day avg" / "last night"), and delete
      `sleep score NN` from the Explore card's `chart-note`.
- [x] The check-in body is a paragraph that says consistency twice ("Consistency is the whole
      job right now… Consistency outranks intensity"). Cap it at two sentences: one thing
      observed, one thing to do. The "This week's focus:" sentence repeats `weeklyWeakLink`,
      which Explore already shows — keep one.
- [x] Card order on Today: hero → coach line → tiles → quick log → explore → notices. Fix
      whatever doesn't match. *Already matched (checked in the browser, with the check-in and
      with the coach line in its slot). The one unlisted block, the focus line ("114g protein
      to go · Log food"), stays directly under the tiles: it's the action for whichever tile is
      behind, so it belongs next to them.*

**Food** — `food.js:renderFoodHome`, `renderFoodHero`

- [x] The hero's `heroStats` (protein / items / score) and the tile strip (protein / calories /
      score) are the same three numbers twice, 40px apart. Keep the tile strip; the hero keeps
      its headline ("590 kcal left") and its protein sentence, and loses the stat row — or keeps
      only `items`, which the tiles don't carry.
- [x] "590 kcal left" is the hero title *and* the Calories tile's sub. Pick one phrasing per
      place (`kcalLeftLabel`).

**Sleep** — `sleep.js:renderSleepHome`, `renderSleepHero`

- [x] The score is in the hero and in the Score tile. Hero keeps duration, times and how rested;
      the tile keeps the score.
- [x] Sleep overflows at 320px: a tile label (`span.tile-l`) ends at 325px. Found while
      verifying stage 1 item 2; pre-existing on v48.
- [x] Sleep still repeats itself: the 7-day average is in the 7-day tile, the insight line
      ("averaging 7h 06m over 6 nights") and Explore → Hours slept; regularity (±N min) is in
      the tile and Explore → Bed & wake times. Explore rows should say something the tiles
      don't. Found while verifying the score item.
- [x] Stage-done sweep (every repeated number on Today/Food/Sleep, seeded, listed by script):
      Today's Explore note repeated the kcal target from the Nutrition row; Food's "Today's
      food" header repeated the tiles' kcal and protein (now shows the item count the hero
      dropped); Food → Macros repeated protein (now carbs · fat). Remaining matches are
      coincidences (a single entry equals the day total; "7" in "7-day" and "7h 45m").

Stage done when: Today, Food and Sleep each print any given number once, and the three screens
still answer their question in the first viewport.

---

## Stage 2 — the coach says less

Train currently shows two "Drop X from day?" cards, each carrying the same parenthetical telling
you to deal with them one at a time. The card that says don't do this twice is doing it twice.

- [x] `routines.js:renderCoachCard` — group suggestions that share a kind and a day into **one**
      card: a heading, then a row per lift with its own action. Two separate "Drop X?" cards
      become "Three lifts you never do on Upper A" with three rows.
      *Amended by the no-repeat test: two days of skipped lifts made two cards ending in the
      same sentence, so grouping is by kind across days; rows name their day when a card spans
      more than one ("8 lifts you never do" → "Push A · Overhead Press").*
- [x] With grouping in place, delete the "(2 other lifts are in the same position — deal with
      them one at a time.)" clause from `coachSuggestions` bodies.
- [x] Every suggestion body gets a ceiling of ~140 characters: what was seen, then the
      consequence of acting. No restating the title.
- [x] `coach.js:COACH_COPY` — same ceiling. Any string longer than two sentences gets cut, and
      no sentence may appear twice in one render.
- [x] Add a test: render Today's HTML for a seeded profile and assert no sentence (split on
      `. `, trimmed, >20 chars) appears twice. That's the regression that keeps copy honest.
      *`tests/copy.test.mjs`, via a new `makeAppContext()` in the harness that loads app.js
      without boot(). Covers Today (check-in and coach line) and Train's coach card. Today at
      v48 would have passed: its repeats were numbers, not identical sentences. The Train case
      fails on v49's code with the "one at a time" clause, as it should.*

Stage done when: no screen repeats a sentence, and the Train suggestions read as a list rather
than a stack of paragraphs.

---

## Stage 3 — one visual system

The app has grown three generations of styling. This makes them agree. No content moves.

- [ ] Spacing scale in `style.css` `:root` (`--sp-1: 4px` … `--sp-5: 24px`) and use it in the
      components this pass touches. Don't rewrite every old rule — convert what you edit.
- [ ] Card padding and heading treatment: one `h2` style for section cards, one eyebrow style
      for heroes. List the exceptions here if any survive, with the reason.
- [ ] Type rhythm: hero / section / body / meta sizes come from a small set. Every number that
      can change while you watch it (`timers, weights, counts`) uses `font-variant-numeric:
      tabular-nums`.
- [ ] Icons: `ICONS` in `ui.js` is the source. Replace the leftover emoji in Today's Quick log
      and the `navRow` calls across Today/Train/Food/Sleep/Grocery with `icon()` — or decide
      emoji stay and make their size and alignment consistent in one rule. Write the decision
      here either way.
- [ ] Tile strips are the same height across tabs whatever they contain (Today's "Not logged"
      vs Food's "1,860 / 2,450").
- [ ] Re-check the v46 gains: button text contrast ≥4.5:1 in all five themes, 44px targets,
      landscape safe areas. Measure, don't assume.

Stage done when: switching tabs doesn't feel like switching apps.

---

## Stage 4 — rebuild Food

Only once stages 1–3 are ticked. Food is the tab with the most competing blocks: hero, tiles,
"Log something else", the day's entries, Explore — five places to look before you know what you
ate.

- [ ] Sketch the target layout in this file first (a list of blocks in order, with what each
      answers). Get it written before writing code.
- [ ] Day navigation and the day's headline in one place.
- [ ] Entries grouped by part of day (morning / afternoon / evening) with a running total, rather
      than one flat list.
- [ ] Logging affordances stop being a grab-bag: scan is primary, manual entry and repeat-a-day
      are secondary, frequents and grocery chips appear only when they have content.
- [ ] Everything that worked still works: scan → review → log, manual entry, edit an entry's
      amounts and time, delete with undo, repeat a day, past days, macro drill-in, trends.

Stage done when: the Food tab answers "what have I eaten, and what's left?" above the fold, and
nothing was lost.

---

## Progress

One line per iteration: date, hash, what landed.

- 2026-09-24 · (pending) · plan written
- 2026-09-24 · 0ad9e1f · stage 1: sessions count on the Week tile only (check-in stat dropped, Explore row reworded)
- 2026-09-24 · 5cd5dc8 · stage 1: check-in protein becomes a streak (≥2 days); logged Sleep 320px overflow
- 2026-09-24 · d52ebc6 · stage 1: sleep labelled '7-day avg' vs 'last night'; Explore note loses sleep score
- 2026-09-24 · 3b555ce · stage 1: check-in body capped at two sentences, focus sentence dropped, test added
- 2026-09-24 · (no code change) · stage 1: Today's card order already matched; focus line kept under tiles
- 2026-09-24 · d8d4775 · stage 1: Food hero loses heroStats; tiles own protein/kcal/score
- 2026-09-24 · d4e915b · stage 1: kcal-left lives in Food's hero; Calories tile says under/on/over target
- 2026-09-24 · f57a671 · stage 1: Sleep hero loses heroStats (score on tile only); logged Sleep's other repeats
- 2026-09-24 · 0d609a8 · stage 1: Sleep 320px overflow fixed (label 'Timing', .tile-l wraps)
- 2026-09-24 · c6d80c5 · stage 1: Sleep's 7-day avg and ± spread printed once; Explore rows show week-on-week and usual window
- 2026-09-24 · a0f1841 · stage 1: done-sweep — kcal target, Food header totals, Macros protein de-duplicated
- 2026-09-24 · 4f4115d · v49: stage 1 released (version bump + CHANGELOG); stage 2 next
- 2026-09-24 · c218cee · stage 2: coach suggestions grouped by kind + day, row per lift; test added
- 2026-09-24 · ab39cda · stage 2: 'one at a time' clause deleted from drop suggestions
- 2026-09-24 · 8046e1c · stage 2: suggestion bodies ≤140 chars (longest 116); test added
- 2026-09-24 · 965b7e5 · stage 2: COACH_COPY bodies ≤140 chars (3 rewritten); test extended
- 2026-09-24 · 3fb5fd0 · stage 2: no-repeat test (Today + Train coach card); coach grouping moved to kind-across-days
- 2026-09-24 · 39d4f29 · v50: stage 2 released (all five tabs swept, no repeated sentences); stage 3 next
