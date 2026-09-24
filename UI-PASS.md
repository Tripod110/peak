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

- [x] Spacing scale in `style.css` `:root` (`--sp-1: 4px` … `--sp-5: 24px`) and use it in the
      components this pass touches. Don't rewrite every old rule — convert what you edit.
      *Converted so far: `.stat-tiles`, `.tile`, `.tile-l`, `.ck-stats`/`.ck-stat`, `.coach-rows`.
      Off-scale values rounded to the nearest step (tile 12/11px → 12px, gap 5 → 4px); every
      measured size moved ≤6px.*
- [x] Card padding and heading treatment: one `h2` style for section cards, one eyebrow style
      for heroes. List the exceptions here if any survive, with the reason.
      *Measured on all five tabs: section `h2` was already one style everywhere. The check-in and
      coach cards had their own 11px eyebrow; they now use `.eyebrow`. `.card` padding and
      spacing are on the scale (16px, cards now 16px apart like the tile strip).
      Exceptions kept: **hero padding** stays 20/18/18px, since the hero is the screen's
      headline card; **Food and Sleep heroes** open with the day stepper, not an eyebrow,
      because which day you're looking at and how to change it are one control.*
- [x] Every number that can change while you watch it (`timers, weights, counts`) uses
      `font-variant-numeric: tabular-nums`. *Split from the type-rhythm item. Found by scanning a
      live workout for digit-bearing elements without it: the progress line, the exercise
      eyebrow, the set label and numbers, the plate maths and the dock's "Complete set N of M"
      now have it. Timers, tiles, hero stats and set rows already did. What's left is static
      (prescriptions like 3×8, "+30s", rep-count buttons).*
- [x] Type rhythm: hero / section / body / meta sizes come from a small set. *185 `font-size`
      declarations across 28 distinct sizes today: define the set as tokens, convert what this
      pass touches, list the rest.*
      *Tokens: `--fs-hero` 36 · `--fs-value` 23 · `--fs-title` 16 · `--fs-body` 14 · `--fs-meta`
      12 · `--fs-label` 11. Converted: card `h2` and its right-hand note, `.eyebrow`, the hero
      title, tile label/value/sub, the check-in stats, the coach headline and body. Measured
      before/after on all five tabs at 390 and 320px: the one change is the check-in stat,
      17 → 16px. Still literal: 173 declarations (9px 9.5px 10px 10.5px 11px 11.5px 12px 13px 14px 15px 16px 17px 18px 19px 20px 21px 22px 24px 25px 26px 28px 30px 34px 42px), including the 320px overrides
      (hero 30px, tile value 19px) — they convert when a later edit touches them.*
- [x] Icons: `ICONS` in `ui.js` is the source. Replace the leftover emoji in Today's Quick log
      and the `navRow` calls across Today/Train/Food/Sleep/Grocery with `icon()` — or decide
      emoji stay and make their size and alignment consistent in one rule. Write the decision
      here either way.
      *Decision: icons, not emoji. Emoji draw differently on every platform and ignore the
      theme's colours; the tab bar and tiles already used `ICONS`. All 22 `navRow` calls and the
      five Quick log buttons now pass `icon()`; `ICONS` gained `apple` and `bowl` for Grocery's
      Snacks and Easy meals. `.nr-ico`/`.qa-i` give every icon the same box (20px / 22px) and
      the muted ink colour. `navRow`'s `ico` argument is renamed `icoHtml` (D-17: caller-built
      markup). Emoji left elsewhere (alerts, the focus line, toasts, check-in goals) are not
      in this item's scope.*
- [x] Tile strips are the same height across tabs whatever they contain (Today's "Not logged"
      vs Food's "1,860 / 2,450").
      *Measured every tile on Today, Food and Sleep, with history and as a new user, at 390 and
      320px: 96–101px, always from a sub-line wrapping. Four subs shortened ("last 7 days",
      "log a night", "0/14 nights", "log a meal") and `.tile-s` is one line with an ellipsis as
      a backstop; a two-line empty value still fits the 96px minimum. Now 96px everywhere, and
      no sub is cut in any measured state.*
- [x] Re-check the v46 gains: button text contrast ≥4.5:1 in all five themes, 44px targets,
      landscape safe areas. Measure, don't assume.
      *Measured every visible button/link/row on all five tabs in all five themes (text colour
      against its real rendered background; bounding box for size), and ran the identical
      audit against v48: **the same 30 findings on both — this pass regressed nothing.**
      Landscape (844×390): no overflow on any tab; the left/right `env(safe-area-inset-*)` rules
      and `viewport-fit=cover` are intact. But the audit shows v46 didn't fully land — next box.*
- [x] Fix the gaps the audit found (all pre-existing, present in v48):
      contrast — light theme's inactive tab labels 3.91, Train's day chips 3.61 (light) / 4.33
      (dark), Sleep's ghost-danger "Delete" 3.44–3.64 in four themes, Food's entry ✕ and
      Grocery's aisle toggle 4.30 (light); targets — day chips 40px tall, Food entry rows 37px,
      Grocery's add field 41px and add button 42px wide.
      *`--muted` retuned in dark (#898781 → #8e8c86) and light (#7c7a71 → #6b6961); pink, ocean
      and forest already passed. New `--critical-ink` for red text (#dd7272 dark themes,
      #bf3636 light) — `--critical` stays the fill/border red. Day chips 44px, Food entry rows
      44px, text inputs and selects 44px, `.btn.small` at least 44px wide. Same audit after:
      0 findings on all five tabs and the live workout screen, in all five themes.*

Stage done when: switching tabs doesn't feel like switching apps.

---

## Stage 4 — rebuild Food

Only once stages 1–3 are ticked. Food is the tab with the most competing blocks: hero, tiles,
"Log something else", the day's entries, Explore — five places to look before you know what you
ate.

- [x] Sketch the target layout in this file first (a list of blocks in order, with what each
      answers). Get it written before writing code.

      **Target layout, top to bottom** (390×844; blocks 1–3 must start above the fold):

      1. **Day hero** — *which day, and what's left?* `‹ Today ›` stepper as its top line (as
         now), headline "2,320 kcal left", the protein sentence, **Scan a meal** as the one big
         button, then two small secondary buttons in one row: *Enter manually* · *Repeat a day*.
         This absorbs the "Log something else" card's two buttons; past days stay on the stepper.
      2. **Tile strip** — *how do the numbers stack up?* Protein / Calories / Score, unchanged
         (they're the drill-ins to Macros and the score breakdown).
      3. **The day's food** — *what have I eaten?* One card, one flat list in time order (as
         now): tap a row to edit amounts/time, ✕ to delete with undo. The header keeps the item
         count. Nothing logged → one line pointing at Scan. *(No part-of-day grouping — see the
         struck box below.)*
      4. **Quick add** — *can I log a usual in one tap?* Frequent-food chips, then grocery chips.
         Each row renders only if it has chips; the whole card only if either does.
      5. **Explore** — Macros, Frequent foods, Past days, Nutrition trends; unchanged.

      What moves: the "Log something else" card is gone — manual and repeat join the hero,
      chips become block 4 and sit *under* the list. Nothing is removed; no data shape changes.
      *Signed off 2026-09-24: no part-of-day grouping; quick-add below the list.*
- [x] Day navigation and the day's headline in one place.
      *Placement already held (the stepper is the hero's top line). What was wrong was the
      headline on past days: "1,090 kcal left" and "24g protein still to go — the number that
      decides…" for a day that's over, "2,740 kcal to spend" for an unlogged one. Past days now
      say how it went — "1,090 kcal under" / "Protein finished 24g short." — or "Nothing
      logged" with a nudge to backfill. The gap, not the total: the tiles carry the totals.*
- [x] ~~Entries grouped by part of day (morning / afternoon / evening) with a running total, rather
      than one flat list.~~ *Dropped at sign-off (2026-09-24): the human chose to keep one flat
      list.*
- [x] Logging affordances stop being a grab-bag: scan is primary, manual entry and repeat-a-day
      are secondary, frequents and grocery chips appear only when they have content.
      *Scan a meal is the hero's one big button in every state; Enter manually and Repeat a day
      sit under it as a small two-button row (new `secondary` option on `heroCard`). The "Log
      something else" card is gone; a "Quick add" card after the day's list holds the chips and
      renders only when there are some. Clicked through: both secondary buttons open their
      sheets, a chip logs its food, Repeat is disabled with no history.*
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
- 2026-09-24 · 02bd9a1 · stage 3: spacing scale in :root; tiles, check-in stats, coach rows converted
- 2026-09-24 · a9e5b44 · stage 3: one eyebrow style; card spacing on scale; 2 exceptions recorded
- 2026-09-24 · 92ba401 · stage 3: tabular-nums on live workout counters; type rhythm split into its own box
- 2026-09-24 · 3dbb757 · stage 3: type tokens; 12 touched rules converted (1 size moved, 17→16px)
- 2026-09-24 · 8e2650c · stage 3: icons not emoji in Quick log + 22 Explore rows (decision recorded)
- 2026-09-24 · 88a14dd · stage 3: tile strips 96px on every tab (subs shortened, .tile-s one line)
- 2026-09-24 · (docs) · stage 3: a11y re-check — 30 findings, identical on v48 (no regression); fixes split into a new box
- 2026-09-24 · 7f92e25 · stage 3: a11y gaps closed (30 → 0 findings across five themes)
- 2026-09-24 · f101583 · stage 3: Sleep week-over-week in minutes (found in tab screenshots)
- 2026-09-24 · 35e82be · v51: stage 3 released; stage 4 (rebuild Food) next
- 2026-09-24 · (docs) · stage 4: Food target layout sketched; paused for sign-off before code
- 2026-09-24 · (docs) · stage 4: sketch signed off — flat list kept (grouping box struck), quick-add below the list
- 2026-09-24 · d171e6b · stage 4: day nav + headline — past days get past-tense headlines
- 2026-09-24 · 991eeff · fix: tile labels broke mid-word under 378px (Stage 1 regression); icon drops instead
- 2026-09-24 · c238b76 · stage 4: logging affordances — scan primary, manual/repeat secondary, Quick add only with chips
