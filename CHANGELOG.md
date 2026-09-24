# Changelog

Every release, newest first. Each heading carries the commit it shipped in, so any line here
can be traced to a diff with `git show <hash>`.

> **Convention:** a commit cannot cite its own hash — amending to insert it changes the hash
> again. So an entry's hash is always added by the *next* commit. If a hash here isn't in
> `git log`, it's an orphan from an amend and should be corrected.

Peak has no build step, so "release" means: version bumped with
[`tools/release.mjs`](tools/release.mjs), committed, pushed to `main`, served by GitHub Pages.
See [SHIPPING.md](SHIPPING.md).

> **Version numbering note.** There is no v25 or v26. A UX audit ran between v24 and v27 and
> its ~30 fixes were folded into the v27 commit rather than released separately, so the version
> sequence jumps. Every one of those fixes is itemised in [AUDIT.md](AUDIT.md) and attributed
> to `5f0a417`.

> **There is no v39 release.** v40 landed the Food, Sleep and Grocery rebuild in one push
> together with v38's security fixes, which had also never been pushed.

> **There is no v33 release.** v33 was committed locally on 2026-08-12 and never pushed; v34–v37
> shipped from a different machine, branched from v32. Its security fixes reached users in v38.

---

## v46 — looks and access
2026-09-24 · **pending push**

The mobile and accessibility review's findings.

- **Button text passes 4.5:1 in every theme** (measured in the browser; it used to be 1.9–3.9).
  The dark theme keeps white text on slightly deeper fills, and pink, ocean and forest use dark ink
  on their bright accents. New tokens: `--fill-blue`, `--fill-orange`, `--on-accent`. Chart
  colours are unchanged.
- **The Light theme finally has light bars.** The header and tab bar were hard-coded black
  (`--bar-bg` per theme). Light's warning and good text also go from 1.8:1 and 3.4:1 to 5.9:1
  and 5.5:1.
- **Scan review inputs are 16px,** so iOS no longer zooms in when you edit macros.
- **44px tap targets** for segmented buttons, picker filters, routine day headers, theme swatches,
  onboarding Back and the grocery steppers.
- **Landscape on notched phones:** the header, content, tab bar, dock and + button respect the
  left/right safe areas.
- **Focus follows drill-ins.** Opening any of the eleven subviews focuses its heading, and Back
  returns focus to the row that opened it. Before, focus fell to the page on every change.
- **Toasts are spoken** through the live region, including the Undo ones.
- **The service worker can't half-install.** A failed download now fails the install and keeps the
  previous full cache. Before, a partial install deleted the good cache and the app stopped
  opening offline. Page loads also fall back to the cached shell after 2.5s on a weak connection,
  instead of hanging.
- Gym-mode tabs are dimmed less (0.6 opacity instead of 0.35), so their labels stay readable.

Checked in the browser at 375×812: contrast measured in all five themes, the Light bars, and focus
in and out of a drill-in. 127 tests pass. *Still unverifiable without hardware: the offline
fallback timing and VoiceOver/TalkBack. Both are on the SHIPPING.md device pass.*

---

## v45 — the gym floor
2026-09-24 · **pending push**

The in-gym friction the lifter and mobile reviews found.

- **Warm-up ramp.** Each tap on *Warmup* adds the next step, in order, before the first working
  set: 40% × 8, 60% × 5, 80% × 3, 90% × 1. Three taps used to give three identical sets at 55%.
- **Supersets.** In a live workout, open a lift's ⋯ menu and choose *Superset with (next lift)*.
  Completing a set jumps straight to the partner with no rest, and rest starts after the round.
  Both lifts show an *SS A* tag. It's per session for now; routines don't store supersets.
- **The metric stepper moves in 1.25 kg,** the smallest plate most gyms have (it used to move 1 kg).
- **Rest times:** only barbell, Pendlay, T-bar and Yates rows get the heavy-compound rest. A seated
  cable row no longer gets the squat's 1.5×, and machine and goblet variants of the big lifts don't
  either.
- **Keyboard.** When the on-screen keyboard opens, the tab bar and + button hide and the
  Complete-set dock rides on top of the keyboard (`visualViewport`). *Needs the real-device
  check in SHIPPING.md: emulators don't show a real keyboard.*
- **The + button and toasts stop covering content.** The page reserves the button's height, and
  toasts float above it.

Tests: 4 new; 127 pass. Checked in the browser at 375×812.

---

## v44 — the engine listens
`1fb59de` · 2026-09-23 · **live**

The rest of the lifter review's findings, the ones the v41 fixes left open.

- **A second attempt after a deload.** Back at the old top weight after a rebuild, one miss no
  longer triggers another deload straight away. The plan says "one more go", and only a second
  miss at the top counts as a stall (`attemptsAtTopSinceDeload`).
- **Back-off sets.** A new set type, next to warmup, drop and failure. They count as volume, but
  progression judges only the top sets. A 405×5 top set plus two 365 back-offs now earns 415.
  Before, it read as two missed sets and never went up.
- **Reps check and effort in the rest dock.** Tick a pre-filled set and the dock asks "All 5 reps?"
  with one-tap fixes (4, 3), so a missed rep can't silently be logged as a hit and earn a false
  increase. Easy / Hard are optional. When every top set is marked easy, the next jump is a double
  step. Hard or blank changes nothing.
- **Too much volume is named.** When a stalled lift's muscle is programmed past its maximum
  recoverable volume (MRV), the plateau note says it's probably fatigue, which agrees with the
  deload, instead of suggesting more sets.
- **Side delts are their own muscle.** Lateral raises, cable Y-raises and upright rows count there,
  and presses count half. "Shoulders" becomes *Front & rear delts*. Before, a press-heavy routine
  with no lateral work read as fully trained shoulders. Two new library lifts: Machine Lateral
  Raise and Cable Y-Raise.

Stored: `effort` on sets and the `backoff` set type, both sanitised on restore. Tests: 6 new;
123 pass. The dock row was checked in the browser at 375×812.

---

## v43 — log anything
2026-09-22 · **live** (pushed with v44)

Anything you train, defined the way you train it ([D-23](DECISIONS.md#d-23), [D-24](DECISIONS.md#d-24)).

- **Custom exercises.** "＋ Create your own exercise" is always in the picker. Set a name, a type
  (weights, bodyweight or timed hold), whether the weight is per hand, how it's loaded, default
  sets × reps, and the primary and secondary muscles. Peak uses what you set everywhere it used to
  guess from the name: plate math, per-hand volume, timed holds, weekly muscle volume and
  progression. Custom lifts are tagged *mine* in the picker. **Edit exercise** is in every lift's ⋯
  menu.
- **Rename everywhere.** Renaming a lift rewrites every place its name is a key: sessions,
  routines, goals, progression settings, taught muscles and loading. Undo restores all of them in
  one step. A rename onto a name that already has history is refused rather than merging two lifts.
- **Any activity.** "Log cardio" is now **Log activity**. The built-in activities are chips, and
  anything you name (climbing, yoga, pickleball) becomes a chip of its own next time. Optional
  distance (km/mi) and notes. It still never counts as a lifting session (D-09).
- **Several routines, and routines from scratch.** The routine editor has a *Your routines* list
  where you can use, rename or delete a routine, plus **＋ New routine**, either blank with N empty
  days or copied from a built-in split. The current routine is always kept; nothing is discarded,
  and every change can be undone. Onboarding's split picker has **Build my own**, which opens the
  editor on empty days.
- **Save a session as a routine day.** From any logged workout. Each lift's target is the number of
  working sets you did × the rep count you did most often.

Stored: `customExercises`, `routineLibrary`, `activities`, and `distanceKm` / `notes` on
activity sessions. All of them are sanitised on restore.

Tests: `tests/custom.test.mjs` covers 9 cases; 117 pass. Checked in the browser at 375×812: create
an exercise from the picker (it lands in the live workout), the editor layout, logging a new
activity (it's remembered), and a blank routine.

---

## v42 — Peak starts coaching
2026-09-22 · **live** (pushed with v44)

Peak used to tell you what a number was. Now it tells you how you're doing and what to do about
it, from your own last month rather than one lift on one day ([D-22](DECISIONS.md#d-22)).

**The coach** ([coach.js](coach.js)) reads everything you log: each lift's status (using the same
`beats` rule as the plateau engine), PRs in the last four weeks, sessions against your plan,
score trend, breaks, and 7-day sleep and protein. It picks the one reading that fits:

| Reading | What it does |
|---|---|
| Getting started | tells you how far off plateau watch is |
| On a roll | names the wins, says don't change anything |
| **Grinding** — most lifts flat, attendance fine | **Switch it up**: variations, new rep ranges, a lighter week, or a new split — all one tap, all undoable |
| Holding — flat on a cut | calls it the win it is, and doesn't tell you to change a working plan |
| Drifting — sessions falling off | a smaller ask: a 3-lift session today |
| Run down — scores falling with short sleep or low protein | points at the cause, offers a lighter week |
| Comeback — after a break | no stall talk while you rebuild |

It shows up on **Today** under the next workout. "Not now" and "Keep my routine" are
remembered, and after a switch-up the coach gives the new block three weeks before judging it.

**Your coach, your voice.** Settings → Coach voice: *Encouraging*, *Straight-talking* or *Drill
sergeant*. Same facts, same advice, different words.

**After every workout, a debrief** replaces the toast. It gives one verdict per lift in plain words —
"+1 rep at 185 lb, that's progress", "matched last time", "deload, as planned", "lighter day, as
planned" — plus how many sessions until plateau watch starts, pace toward any goal, and the
coach's read.

**Lift goals and outlook.** "Why this target?" now has a Goal section. Set any weight × reps
(optionally by a date), and Peak fits your trend since the last break with Theil–Sen (one freak
day can't swing it). It projects when you'll get there as a date with a likely range, and says
whether that's ahead of or behind your target. When a lift is flat or too new, it says so rather
than inventing a date. The chart has a "show the numbers" table.

**A lighter week** is a real mode. For 7 days every lift is ~10% down with a set less, then
progression resumes from your last *real* session. Plateau watch and the coach step over the
lighter week, so it never reads as a stall or a regression.

Stored: `coachVoice` (settings), `coachMemory` (only your own answers), `liftGoals`. All three
are sanitised on restore.

Tests: `tests/coach.test.mjs` covers 23 persona, maths and guard cases; 108 pass. Checked in the
browser at 375×812 in the dark and light themes: the coach card, the switch-it-up sheet, undo,
the debrief and the outlook chart.

**Weekly check-in.** Once a week the Today card becomes a check-in: the week's sessions against
plan, PRs, average sleep and protein days, the coach's read, this week's focus, and the pace of
each goal. "Got it" puts it away until Monday.

**Optional: Gemini words the check-in** (Settings → Coach, off by default). It only works with
your own key and sends only the check-in's numbers and lift names, never your log. The reply is
discarded if it contains any number or lift name that wasn't in those facts, too-long replies
are discarded too, and the rule-written version stays whenever the request fails.

**Train tab:** one coach line under today's session when there's something to act on.

> Known: the toast and + button can overlap the coach card's buttons (mobile review item).

---

## v41 — the plateau engine reads reps, and the device id stays home
2026-09-22 · **live** (pushed with v44)

`forge:deviceId` is the only thing the Worker checks on `/subscribe` and `/unsubscribe`, so
whoever holds it can delete a device's reminders or repoint its push subscription. Backups are
made to be shared, so it was the wrong thing to put in one.

- **Export** leaves `deviceId` out, alongside the Gemini key, and the file's note says so.
- **Restore** keeps this device's own id rather than inheriting one from the file. Older
  backups that still carry it restore normally, and it isn't counted in "ignored N entries" —
  Peak wrote it, so the file isn't misdescribing itself.
- Test: `tests/untrusted-backup.test.mjs` covers export, restore and the skipped count.

**The plateau engine stops deloading lifters who are progressing** ([D-21](DECISIONS.md#d-21)).
An 18-scenario review found these histories being flagged or deloaded:

- **Adding reps at the same weight.** Rows going 8/6/6 → 8/8/7 got "deload to 140". More total
  reps at a load now counts as a PR, including high-rep work past the e1RM formula's 12-rep cap.
- **Rebuilding after a 1–3 week break.** "Climbing" now compares the last sessions with the ones
  just before them, not with a pre-break best.
- **Heavy and light days of the same lift.** A 3×10 day was prescribed the 4×5 day's 225 lb, and
  the reverse. Each rep scheme now builds from its own last session.
- **One old heavy single** kept a lift "below its best" forever, so the deload never came. The
  deload ceiling now ignores sets under half the target reps.
- **An extra set** beyond the plan blocked the weight increase.
- **Lower-body jumps were 5% a session** (405 → 425 on a deadlift). They're 2.5% now, like
  everything else.
- **The plateau card contradicted itself:** "deload to 205" next to "add sets before dropping
  weight", based on the trailing 7 days. It now reads the routine, per D-16, and adds to the
  prescription instead of arguing with it.

Genuine stalls, including noisy ones, are still flagged and deloaded. Tests:
`tests/plateau.test.mjs` adds 11 histories; 85 pass.

**Worker** (ships with `wrangler deploy`, separately from the Pages push):

- Push endpoints must be `https` on a real push-service host (exact or subdomain match, never a
  substring). They're checked at `/subscribe` and again before each send, and records saved
  before this check are deleted. Without it, the reminder cron would POST to any URL anyone
  registered.
- `p256dh` / `auth` are shape-checked, so junk can't throw on every cron run.
- New subscriptions are capped per UTC day (`NEW_SUBS_PER_DAY`, default 500). Updating an
  existing one is never capped.
- The global scan cap reserves its slot **before** the Gemini call and never refunds it.
  Counting after the response meant concurrent requests all read the same value and got past
  a cap that was already reached.
- Requests without an `Origin` header are rejected. `/unsubscribe` shape-checks `deviceId`.

---

## v40 — the rest of the app catches up
`60d53af` · 2026-09-15 · **live**

v37 rebuilt Today and Train and left the other three tabs alone, so Peak had two design
languages: a hero card with a glance strip and drill-ins on two tabs, and a long scroll of
competing cards on the rest. This is the other three, plus the bugs that turned up while
reading them properly. **There is no v39** — see the numbering note at the top.

**Every tab is now hero, tiles, list, Explore** ([D-19](DECISIONS.md#d-19)). Eleven drill-in
subviews, one set of conventions — `App.{tab}View`, `{tab}-nav` / `{tab}-back`, a
`{TAB}_SUBVIEWS` table, and shared builders in the new `ui.js`. `navRow` existed in three
copies before this; the hero card and the stat tiles were inline markup nobody could reuse.

**Grocery** leads with the list and the add field, and the four quick-add sections became
subviews. The segmented switcher they used to live in kept state that nothing ever reset, had
none of the semantics a tablist needs, and competed with the list for the screen you hold in a
shop. Aisle grouping got a control instead of switching itself on at the sixth item.

**Sleep** was five blocks fighting for one screen. Home is the night in front of you and how
the week is going; the chart, the fourteen nights, the training split and the bed/wake
regularity are each one tap deeper. The night stepper is the hero's top line and now has a
floor — the ‹ arrow used to walk backwards forever through empty dates.

**Food** opens on how much room is left and how much protein is still to go, with Scan as the
hero's action. The ring and the four macro bars moved to a Macros drill-in: on a screen opened
five times a day, one number decides the day and it is protein. The score pill was an
unexplained diamond; the Score tile now opens a sheet that explains the 45/25/30 split.

**Reordering a workout** ([train.js](train.js)) stops being three taps per place. It was two
one-step items in a menu that only appeared on the exercise you already had open — every move
closed the sheet, and touching any other lift meant focusing it first, mid-set. One sheet now,
every exercise in it, and it stays open while you work. "Do next" drops a lift straight after
the one you are on, for when the rack is busy. Not drag-and-drop: the document is the scroll
container and a one-handed drag between sets is the worst possible input for this.

### Fixed

- **A restored backup could brick the app permanently.** `groceryFoodCache` was not in
  `sanitizeStored`'s whitelist, so a backup carrying a string there survived the import — and a
  string has `.slice` but not `.map`, so Food threw inside `renderFood`, `App.render` aborted
  before assigning `view.innerHTML`, and the app came up blank on every boot. Same failure as
  the sets-is-a-string session in [D-17](DECISIONS.md#d-17): not a hostile value, just a type
  nobody checked.
- **`scanStats.scans` was interpolated unescaped** and was unsanitized, so a restored backup
  could put markup in a number and have Settings render it. Fixed at both layers.
- **Grocery hid items.** An item whose stored `aisle` was not a real aisle counted toward
  "N to get" and then rendered in no group at all.
- **Sleep's learned defaults drifted.** `usualNight` took the last fourteen *entries* rather
  than the last fourteen *days*, so after a gap in logging a night from three months ago
  pre-filled tonight's form — the same bug v27 records fixing in `sleepAvgDays`, one function
  away.
- **Three definitions of a bad night** became one `SLEEP_BANDS` table. Train warned under 6h,
  the weekly verdict got severe at a 7h average, and the training split banded at 7h/7h30, so
  the same week could be called fine, short or severe depending on the screen.
- **The training split miscounted its own coverage**, telling someone who sleeps 7h10 every
  night that "0 lifting sessions so far have a logged night attached". The 7h–7h30 gap is
  deliberate; the count was not.
- **Editing a food entry counted as eating it again**, so correcting a typo in a meal name
  ranked the corrected spelling as if you had logged it twice.
- **`App.scanImage` survived a closed sheet**, so "Rescan" silently re-sent a photo you could
  no longer see, and opening Scan the next morning still held last night's dinner.
- **Adding a meal after its staple double-listed the ingredients** — `grocKey` treats
  "Eggs (dozen)" and "Eggs (dozen ×2)" as the same eggs for dedup.
- **`focusSelector` lost focus on every re-render** in Food, Grocery, Sleep and the routine
  editor: their controls key off `data-id` / `data-key` / `data-day` / `data-ex`, none of which
  were in its whitelist. Because `openModal` reuses it to remember its opener, closing a sheet
  in those tabs also never gave focus back to the button that opened it.
- `renderConsistencyNote` hung off the "your sleep is on point" branch, so the person whose
  wake time swings two hours could never reach it. `sleepDebt` — written, commented, never
  called — is gone. The chart note promised "tap a dot for details" to people on phones, where
  the SVG `<title>` it meant does nothing; the trend subview carries the same fourteen values
  as text instead.

### Destructive actions are undoable, not confirmed

[D-20](DECISIONS.md#d-20). Grocery's delete, clear-checked and quantity-down-from-one destroyed
data on one tap with no confirm and no undo; Sleep used a native `confirm()` that named neither
the date nor the length of the night; forgetting a frequent food was silent and permanent. All
of them go through `destructive()` now and restore at their original position. `confirm()`
survives in exactly five places, all of them named in D-20 — the ones where an undo could not
restore what was lost.

### Accessibility

Sleep's quality picker is a real radiogroup with `aria-checked`, its live duration line is
announced, and its night rows are buttons. Grocery's check control exposes `aria-pressed`, its
add field has a label, and its aisle headings are headings. Food's past-day rows are buttons
and its scan spinner is a `role="status"`. All three tabs call `announce()` now — before this,
`#sr-live` was used by Train and nothing else.

Tests: `node --test tests/*.test.mjs` — **73**, up from 22. The harness loads what index.html
loads, so Food, Sleep and Grocery are testable at all for the first time; 28 of the new tests
were written as characterization tests *before* the rebuild, so a rewrite that quietly changed
a number would fail rather than pass.

> **Not verified on a real phone.** Eleven drill-ins, a hero card containing a text input
> (Grocery), and a sheet you operate repeatedly (Reorder) are exactly what a desktop browser
> cannot judge. The real-device pass in [SHIPPING.md](SHIPPING.md) has still never been run.

---

## v38 — restored backups are no longer trusted
`01a7a92` · 2026-09-15 · **live** (pushed with v40)

**This is v33's work, landing three releases late.** v33 was committed on 2026-08-12 but never
pushed, and v34–v37 were built from v32, so every fix below was absent from the live app the
whole time. Cherry-picked onto this line (`git show 2652381` is the original), with the parts
v37 rewrote re-applied by hand rather than merged blindly — see the escaping sweep note at the
end. There is no v33 release on this line and there never will be.

A security triage of the whole app found two issues, both reachable through Settings → Import
backup. Both are fixed, and both fixes were verified by re-running the working exploit. Full
reasoning in [D-17](DECISIONS.md#d-17).

**Fixed — stored HTML injection from a restored backup.** Peak escaped everything it thought of
as *text* (exercise names, food names, grocery items, AI scan output) and treated everything it
thought of as *structural* — times, reps, quality ratings, scores — as trustworthy, writing it
into HTML raw. Storage is not trustworthy: a backup is a file someone can hand you, and the app
nags you to make one, so being sent one looks routine.

The clean path was `fmtTime`, which returned its input verbatim in 24-hour mode — and the same
backup that carried the payload also set `timeFmt: "24"`. Opening the Sleep tab rendered
attacker markup as live DOM. Reproduced end to end, including a full-viewport fake "re-enter
your API key" overlay with an off-site link that survived reload.

Two layers now, because each covers the other's failure mode:

- **Every interpolation is escaped**, with no exceptions for values believed to be numbers.
  "Everything is escaped" is greppable; "escaped unless we're sure it's a number" rots silently.
- **Every value is coerced on import** — times through a strict `HH:MM` parser, numbers clamped
  to ranges, enums checked against their allowed sets, anything unrecognised dropped rather
  than repaired.

`script-src 'self'` from v30 held the whole time: the injected `onerror` never fired, which is
the difference between this being a Medium and being "steal the API key and everything else on
the origin." Good reason never to add `'unsafe-inline'` for convenience.

**Fixed — imports could write storage keys Peak never owns.** `importAll` wrote every key in the
file. GitHub Pages puts every project on one origin, so an unnamespaced key landed in storage
shared with any other site published from the same account — and `wipeAll` is `forge:`-scoped,
so **Reset everything** left it behind while reporting the device clean. Non-`forge:` keys are
now dropped, and the restore toast says how many were ignored, since a real Peak export has none.

**Also fixed — a backup could permanently brick the Train tab.** `restoreSession` checked only
`Array.isArray(exercises)`, so a session whose `sets` was a string threw inside
`renderExerciseBlock` on every render — and reloaded from storage on every boot, so it never
recovered. The same import validator repairs it.

**Verified clean:** no secrets anywhere in git history, `worker/wrangler.toml` carries no key,
`toast()` uses text nodes (not a sink despite many unescaped call sites), AI scan fields were
already escaped, chart labels are all generated, and the service worker has no cache-poisoning
path. A legitimate export → import round-trip is lossless: lifetime volume, set weights, warmup
tags, custom routines and taught muscle/loading maps all survive byte-identical.

Added a `.gitignore` — the repo *is* the deploy target, so a stray `git add .` would publish
local scratch directories.

**Now covered by tests.** v37 brought the first test suite; the import boundary now has its
own — `tests/untrusted-backup.test.mjs`, 8 cases over foreign keys, hostile times, crafted
`uid`s, unknown themes and restrictions, bounded progression preferences, and the
sets-is-a-string session that used to brick the Train tab. The VM harness the two suites share
moved to `tests/harness.mjs`. `node --test tests/*.test.mjs` — 22 tests.

**Re-applied to code that did not exist in v33.** v37 rebuilt the active-session renderer, and
v34–v36 added themes, dietary badges, Gym Mode and push subscriptions — none of which the
original commit could have touched. Their sinks were swept for the same class of bug and their
stored keys added to the import validator, so "everything is escaped, every value is coerced"
is true of the whole app again, not just the parts that existed in August.

---

## v37 — bold, focused training
2026-09-15

**Today leads with the workout.** One hero card with three states: *Up next* (the queued day,
its first lifts at today's weights, and **Start workout**), *Workout in progress* (sets done,
**Resume workout**), and *Trained today* (score, sets, volume, duration, **View workout**, a
secondary **Train again**). Below it: protein progress, last night's sleep duration and
lifting sessions in the last 7 days. Quick log and the Explore drill-ins stay; install and
backup notices moved under the main content with their actions and dismissal unchanged.

**Train overview.** The selected day is the headline, day chips stay visible, and each
exercise row opens **Why this target?** — the prescription, its reasoning, last session's
actual sets and plates. The cue legend and plateau calls moved into a collapsed *Why these
targets?* section instead of stacking alert cards above the plan.

**One exercise at a time.** A compact header (elapsed time, sets done), one expanded
exercise, and every other exercise as a one-line row with its completion count. The next
set is a large weight/reps editor; other sets are tappable summaries, and completed sets stay
editable. **Complete set** and the rest timer share one dock above the tab bar — never a second
rest bar — and the page reserves its height so nothing hides behind it. Finishing an exercise
opens the next unfinished one in routine order, wrapping to anything skipped. When every set is
done the dock offers **Review & finish**; nothing is ever saved automatically, and finishing
early goes through a review sheet listing what will and won't be saved.

- Exercises in a live session carry a stable `uid`; focus is stored as `focusUid`. Both are
  optional — older sessions get them on restore, and a missing or stale focus falls back to the
  first unfinished exercise, then the first exercise. Duplicate names, reorder, delete and undo
  all keep the right exercise open.
- Deletion and set type moved into labelled menus (⋯). Undo still works. Exercises can be moved
  up/down from the menu.
- Selecting a set, opening an exercise, or a coaching pre-fill never marks a set performed or
  edited. Only a field whose value actually changed counts as an edit.
- Fixed: ending a session with nothing logged stripped the live session's planned sets.
- Fixed: "last time" paired the heaviest weight with the best reps from a different set.
- Dialogs are named, trap focus, close on Escape (except onboarding) and return focus to their
  opener. Set completion and exercise changes are announced; timer ticks are not. 44px targets,
  visible keyboard focus, `prefers-reduced-motion`, local SVG icons in the tab bar.

**Progression settings** (from an exercise's *Why this target?* sheet or its ⋯ menu), stored
under the new `forge:progressionPrefs` key, keyed by trimmed lower-case name:

- **Custom increment** — replaces the automatic jump, stored in kg (total load, or per hand
  for per-hand lifts), used exactly rather than rounded back onto 5 lb / 2.5 kg steps.
- **Keep my weight** — holds the load across workouts until **Resume progression**. Overrides
  increases *and* deloads; records and plateau watch keep running and the plan says "paused".
  Saving a hold mid-workout updates only untouched, incomplete, normal working sets; resuming
  takes effect next workout. Hidden for lifts with no external load.
- `nextTarget` remains the single source for previews, pre-fills, added sets and explanations.
- No migration: a missing preference is the old behaviour; backups round-trip the key and older
  backups import unchanged.

Tests: `node --test tests/*.test.mjs` — 14 regression tests covering the above.

> **Not verified on a real phone.** Keyboard overlap with the dock, safe-area insets under the
> dock, and one-handed reach to *Complete set* need the real-device pass in SHIPPING.md.

---

## v32 — logging a night stops feeling like data entry
`35dc6bb` · 2026-08-09 · **live**

Reported directly: *"the manually logging and dragging numbers or punching them in just doesn't
feel good."* Fair. Logging a night meant a hardcoded `23:30 → 07:00` to correct via the OS time
wheel, a date field you almost never needed, and a slider to drag to a number nobody can feel —
four inputs, every morning, half awake.

**Peak now knows your usual night.** The form opens on the median of your last 14 logged
nights instead of the same two hardcoded times it used on night one. Median rather than mean on
purpose: one 3am night shouldn't drag the default that every subsequent night starts from.
Verified against a fortnight containing two deliberate outliers (02:40 and 03:10 bedtimes) —
the learned default stayed at 23:18.

**"☀ I'm up" — the one-tap path.** On the Sleep tab, wake time comes from the clock and bedtime
from your usual, so the only thing left to answer is how you feel. It only appears when the
resulting duration is one a person could plausibly have slept (3–14h); tapped at 6pm it would
otherwise have offered a 19-hour night, which is exactly what the first build did.

**Nudge chips instead of the time wheel.** `−30 −15 +15 +30` either side of each time, wrapping
correctly across midnight, with the resulting duration updating live above the Save button. The
±15-minute correction is the only edit most mornings need and the wheel was the worst way to
make it.

**Quality is five buttons, not a slider** — faces and words (`😐 OK`, `🙂 Good`), each a full
tap target, pre-selected to your usual.

**The date field moved** behind "Logging a different night". Backfilling still works, and the ‹
arrow on the tab still does it too; it just no longer sits in the path of the common case.

Net effect on a typical morning: open Sleep → **I'm up** → tap a face → Save. Two taps of
actual decision instead of four fields of data entry.

> Not built, and worth saying plainly: reading Apple Health or Health Connect is impossible
> from a PWA — there is no web API for it, so this is not a permissions problem that can be
> worked around. The only true "never log again" route a website can take is a bring-your-own
> token for a tracker with a REST API (Oura, Fitbit, Whoop), the same shape as the Gemini key.
> Deferred, not rejected.

---

## v31 — the routine is yours, and Peak starts noticing
`6d231c1` · 2026-08-09 · **live**

Peak shipped four fixed splits and no way to change them. If your gym had no hack squat, or
you always did an extra fly, or you never once touched the calf raise sitting in the plan,
that was your problem forever. This release makes the routine editable, gives it a real
exercise library to draw on, and — the part that matters — has Peak watch what you actually
log and offer to fix the plan itself.

**Added — editable routines.** Every built-in is now a starting point. Add or remove
exercises, reorder them, change sets and reps, rename days, add or delete whole days, or
start from a different split. The first edit forks the built-in into your own copy, so the
standard version stays available to reset back to and nothing you log is ever touched.
(`routines.js`, Train → Edit your routine)

**Added — 123-exercise library and a picker that can find things.** Adding a lift used to be
a text box with a hidden `datalist` behind it: a keyboard, a guess at spelling, and no way to
browse. It's now searchable and filterable by muscle, listing lifts you've already logged
first, with anything unrecognised still accepted as free text. The library also carries its
own muscle mapping, so `musclesFor` consults it before falling back to pattern matching — a
regex written to catch a family occasionally catches a lift it shouldn't.

**Added — 7 more built-in splits** (11 total): Full Body ×2, Upper/Lower/Full ×3, PPL ×3,
Arnold ×6, body-part split ×5, dumbbells-only ×3, and big-lifts-only ×3. The originals
covered 3–6 days in a commercial gym and nothing else — not two sessions a week, not a rack
and a pair of dumbbells at home.

**Added — "Peak noticed": suggestions derived from your own sessions.** No new tracking, no
settings, nothing to opt into — all four rules read the logs that already exist:

- **A lift you keep adding yourself** in 3+ of the last 5 sessions of a day → offer to put it
  in the routine so it's pre-filled.
- **A planned lift you never do** → offer to drop it. One at a time: a day you consistently
  cut short would otherwise produce five cards saying the same thing.
- **Sets that disagree with the plan** — every recent session logging exactly 5 working sets
  where the plan says 4 → offer to change the target, so the pre-fill and the "sets left"
  count stop lying.
- **A muscle the routine cannot reach MEV for** → offer a specific lift on the day that
  already trains it. This measures the *plan*, not the log: judging it on logged sets flags
  every muscle whose day fell outside the trailing week, which on a 3-day split is most of
  them, every week. Threshold is 80% of MEV, because flagging 7 sets against a "minimum" of 8
  is pedantry.

Each is one tap to accept, one to dismiss for good, capped at two on screen.

**Fixed — "next day" broke under editable routines.** It counted sessions modulo the day
count, so adding a day silently reshuffled the rotation and deleting one could point at a day
that no longer existed. Now anchored to the last day actually trained.

**Sleep — the tab finally shows the connection it keeps asserting.**

- **Sleep vs training.** Peak's whole pitch is that sleep feeds the lift, and the Sleep tab
  had never once shown that in the user's own numbers. It now splits your session scores by
  how you slept the night before. Careful about what it claims: it needs 4 sessions on each
  side before it says anything, and it says "a pattern in your log", not "caused".
- **Fixed the score's two cliffs.** 479 minutes scored 59.75, 480 scored a flat 60 all the way
  to 599, and 600 dropped straight back to 50 — sleeping ten minutes longer could cost you ten
  points. It now ramps 4h→8h, holds through 8–9h, and tapers gently past 9h.
- **Consistency counts wake time, not just bedtime.** A lifter waking at 6 on weekdays and 11
  at weekends scored as perfectly consistent. Split 8 points bed / 7 wake, and the tab now
  names which of the two is drifting and by how much — it was 15% of the score with nothing
  on screen explaining it.
- Quality is labelled (`3 · OK`, not `3/5`), and the log modal shows the resulting duration
  before you save.

**Grocery — it now knows what you buy.** Peak has recorded every logged food with a running
count since v1, and the grocery tab ignored all of it, offering the same fifteen generic
staples to someone who has logged the same six things for three months.

- **"Your usuals"** — a quick-add section built from your own food log.
- **Restock nudge** — something you log regularly that hasn't appeared in 5–21 days is
  probably out.
- **Aisle grouping** once the list passes six items, so you walk the shop once.
- **Quantities** — type "eggs ×2", "3 bananas" or "Milk x4"; adding a duplicate bumps the
  count instead of refusing with "already on the list", which was true and useless.
- Check-off is its own target now, so the steppers and ✕ can't be hit mid-aisle.

---

## v30 — the gym-floor release
`efbfc5f` · 2026-08-08 · **live**

Five things reported from actually using Peak in a gym. Four are fixes; one is the feature
that should have shipped with set logging.

**Fixed — ticking a set threw you back to the top of the workout.** The single worst thing
about logging a session. `snapViewport` undid the mobile keyboard's pan by scrolling to 0,
which is only the right answer if you were at the top when you started typing — and in a gym
you never are. Every ✓ and every weight entry on the fourth exercise sent you to the top of
the page and you scrolled back down by hand. It now records the scroll position *before* the
field takes focus and restores that. (`app.js`)

**Added — plate math for everything that takes plates, not just barbells.** The old
`isBarbellLift` check meant the leg press — the lift most likely to need the arithmetic —
showed nothing. Loading is now modelled per lift as one of: Olympic bar (two sleeves, bar
weight subtracted), plate-loaded machine (two pegs, nothing to subtract), single post (T-bar,
landmine — every plate on one end), or not plate-loaded. The indicator is visual: the plates
you need, drawn at relative size in IWF colours, above the same thing in words. It tracks the
weight field as you type, follows the *next unticked set* rather than the session's top set
(so a warmup ramp shows the right plates on every set), and says how far off it is when the
number can't be made exactly. Any lift Peak guesses wrong can be corrected by tapping the
indicator — the same "teach it once" contract as the muscle map. (`train.js`, `style.css`)

**Fixed — meal scanning died with a valid API key.** Google pulled `gemini-2.5-flash` and the
app surfaced its raw reply: *"This model is no longer available. Please update your code."* —
addressed to a user who wrote no code, with nothing in the UI explaining it. Three changes:

- A 404 or "no longer available" now triggers a `ListModels` call against the user's own key,
  repoints to the best model it actually offers, saves it, and retries the scan. The user sees
  one toast instead of a dead end.
- Settings' model picker is populated from that same list, so it shows what the key can really
  run rather than two hard-coded ids with a shelf life. **Test key & refresh models** does it
  on demand and reports whether the key works — the missing diagnostic for "is it my key or
  their model?"
- The default for new users moves to `gemini-3.5-flash`. Existing users are *not* moved: 2.5
  still works for them until Google's 2026-10-16 shutdown, and Settings now says so.

(`api.js`, `store.js`, `app.js`)

**Fixed — exported backups contained your API key in plaintext.** A backup is the one piece of
Peak data that deliberately leaves the device: emailed to yourself, dropped in cloud storage,
attached to a bug report. It carried a live Google credential in every one. The key is now
stripped on export and the file says so; a restore keeps the key already on the device rather
than blanking it. Also: the key is no longer written back into the Settings field (a masked
preview plus Replace/Remove), and a CSP names `generativelanguage.googleapis.com` as the only
host this app may ever talk to — the useful control, since a key in `localStorage` cannot be
encrypted away. See [D-13](DECISIONS.md#d-13). (`store.js`, `app.js`, `index.html`)

**Changed — the Train tab reads as one screen instead of four.** It opened with a status
alert, then a Start button *above* the plan it referred to, then four stat tiles that were
really navigation, then five nav rows repeating those same four numbers, then the day picker
collapsed inside a `<details>` behind a `<select>` and a second Start.

- The plan comes first and Start sits under it — you read, then act.
- The day switcher is a row of chips, one tap, with the queued day marked. Was three taps
  behind a disclosure triangle.
- The `▲ → ▼ ●` cue column now has a legend, listing only the cues in today's plan. It was
  the plan's entire vocabulary and nothing on screen defined it.
- Plateau alerts sit directly under the plan, because they explain its ▼ and ▲ cues.
- The four glance tiles are gone; every number they held was already in the nav rows below.
- In-session: Finish is in the summary card at the top as well as the bottom, so ending a
  long day doesn't mean scrolling past it; and the set-number button says once that it sets
  warmup / failure / drop, which no tooltip can teach on a phone.

(`train.js`, `app.js`, `style.css`)

---

## v29 — the plateau engine gets it right
`216b66c` · 2026-07-29 · **live**

The headline feature was wrong about three quarters of the time. This release is entirely
about making the one thing Peak is named for trustworthy.

**Fixed — plateau detection false positives** (`train.js` · `detectPlateaus`)

Three ways the old rule fired on lifters who were progressing fine:

- **An abandoned lift stayed flagged forever.** The rule compared the PR date to the last
  session, never to today — so a lift untouched for five months still showed "stalled."
- **One fluke PR poisoned a lift permanently.** A lifter with a single outlier `185×8`, then
  `150 → 180 lb` across seven sessions, was told "no PR in 7 sessions" and prescribed a
  deload *down* to 160. The best-progressing lift in the app got the worst advice.
- **Returning from a layoff looked identical to stalling.** Six weeks off, back and rebuilding
  `225 → 245`, reported as "stalled, 93 days."

Now gated on four conditions: still being trained (21 days), enough evidence since the last
≥28-day break, no PR in ≥3 sessions and ≥21 days, and not currently climbing. Verified against
seven training histories — the three cases above stay silent, and a flat lift, a lift stalled
*after* a layoff, and a lift failing its sets all still fire. See
[D-12](DECISIONS.md#d-12) for why this is deliberately biased toward silence.

**Fixed — the alert could contradict the plan row.** A lift completing all its sets is flagged
(e1RM is flat) while the prescription correctly says go up; the alert then showed a random tip,
so the app could print "Drop the weight ~10%" above "▲ go up to 165 lb." The alert now leads
with the actual prescription.

**Fixed — the service worker defeated its own cache-busting.** The cache-first path matched with
`ignoreSearch: true`, stripping `?v=NN`, so every version collapsed onto one cache entry and a
release could serve the previous build's script — or a *mixed* bundle. Now matched exactly, so a
bump lands on the **first** load. This also means the "hard-reload twice" step in `SHIPPING.md`
was documenting a bug; it's gone.

**Fixed — `tools/release.mjs` rewrote prose.** A blanket `?v=\d+` replace edited any text
mentioning a version query, including the comment explaining the bug above. Now only quoted
asset references are touched.

Full detail with verification evidence: [AUDIT.md](AUDIT.md) findings 31–34.

---

## v28 — backup nudge, release tooling, process docs
`d5f2c02` · 2026-07-29 · **live**

**Added**
- **Backup nudge.** Prompts for a JSON export once there is history worth losing (≥10 logged
  days or ≥6 sessions) and no backup in 30 days. Names what is at stake ("back up your 7
  sessions and 4 logged days"). Today tab only, so it can never interrupt logging. *Not now*
  snoozes 7 days; exporting stands it down for 30. — `app.js` · `backupState`, `backupBanner`
- Settings shows the last-backup date and flags the section `due` when one is overdue.
- **`tools/release.mjs`** — one version number lived in 22 places across three files.
  `--check` verifies they agree *and* that `sw.js` `SHELL` names every script `index.html`
  loads; passing a number bumps them together and refuses to move backwards.
- **[SHIPPING.md](SHIPPING.md)** — pre-flight, release, post-deploy verification, rollback,
  and a real-device checklist.
- **[PAYMENTS.md](PAYMENTS.md)** — what it takes to make Peak Pro sellable, and why Stripe is
  the last step rather than the first.

**Fixed**
- `export-data` now revokes its own object URL instead of leaking it.

**Changed**
- `ROADMAP.md` rewritten to reflect what actually shipped rather than what was intended;
  README gained a docs index.

**Why v28 and not a v27 patch:** v27 was already live. The service worker is cache-first for
versioned assets and only drops the old bundle when `CACHE` changes, so editing v27 in place
would have reached nobody.

### Documentation
`385dda1` · docs-only follow-up — no app code changed, so no version bump.

- **[CHANGELOG.md](CHANGELOG.md)** — this file. Every release traced to its commit.
- **[AUDIT.md](AUDIT.md)** — the 30 audit findings, each traced to the symbol that fixed it and
  the check that proved it, plus an explicit list of what was *not* verified.
- **[DECISIONS.md](DECISIONS.md)** — why Peak is built this way. Eleven entries, three of them
  still open and blocking billing.
- **[worker/API.md](worker/API.md)** — the Worker's request/response contract documented from
  `src/index.js`: every status code, both distinct `429`s, the two KV counters, and the six
  planned endpoints marked NOT BUILT.
- README gained a docs index and the current-release marker; `PAYMENTS.md` and
  `worker/README.md` now cross-link into the decision log and the API contract.

---

## v27 — reposition around plateau detection; UX audit fixes
`5f0a417` · 2026-07-29

This release carries two distinct bodies of work.

### Launch hardening
- Gemini model **pinned** to `gemini-2.5-flash`; `*-latest` aliases mapped. An alias rolling
  to a new generation would have raised input cost 5× with no code change. — `store.js`
- **`thinkingBudget: 0`.** Thinking is on by default and bills as output; portion estimation
  is perception, not reasoning. Roughly halves per-scan cost. — `api.js`
- **`navigator.storage.persist()`** on boot, so iOS is less likely to evict a training history.
- **Feedback channel** in Settings.
- Positioning rewritten around plateau detection (README, in-app copy).
- `worker/` scaffolded — a Cloudflare scan proxy so users don't need their own API key.
  **Not deployed** — see ROADMAP week 3.

### UX audit — ~30 fixes
Full itemisation with verification evidence in **[AUDIT.md](AUDIT.md)**. The three that
mattered most:

- **The deload spiral.** A user who followed the app's own stall advice was deloaded 10% *every
  session*, walking a 155 lb bench to 85 lb over six compliant sessions. `allHit` is now tested
  before the stall flag, and a deload only fires at ≥98% of the all-time best. — `train.js` ·
  `nextTarget`, `bestWorkingWeightKg`
- **In-progress workouts were memory-only.** A reload or an iOS purge between sets took the
  whole session, PRs included, with no warning. Now mirrored to storage on every mutation and
  restored on boot. — `train.js` · `persistSession`, `restoreSession`
- **Two contradictory "7-day sleep averages."** The Sleep tab averaged the last 7 *entries*
  regardless of date, reporting 8h 26m — and a green "recovery is on point" — for a week that
  actually averaged 5h. Now calendar-day based, with coverage stated. — `sleep.js` ·
  `sleepAvgDays`

Also in this release: metric/imperial support throughout, editable food entries and scan
estimates, prescribed set rows pre-filled (20 taps → 0), frequency-ranked frequent foods,
sleep and weight backfill, fiber targets, goal weight with an ETA, a per-hand dumbbell
convention, 44pt tap targets, pinch-zoom restored, and a ~6× render speed-up at a year of
history.

---

## v24 — Food restructured for logging speed
`1bc82ed` · 2026-07-29

Compact day navigator, protein-remaining callout, Scan promoted to the primary action,
one-tap frequent-food chips, repeat-a-day copier. Frequents and past days moved into drill-ins
with a cross-link to nutrition trends.

## v23 — Today became a status dashboard
`bdfc565` · 2026-07-29

Time-aware focus line ("what to do next"), 5-button quick-log row, tappable glance strip,
Explore nav rows. Weekly review, nutrition trends, weight and consistency moved into drill-in
subviews. Shared `weeklyWeakLink` analysis; one-tap weight modal with goal-aware verdicts.

## v22 — Train became a dashboard with drill-ins
`4499189` · 2026-07-28

Compact hero session plan, tappable glance strip, Explore nav rows carrying live values.
Analytics moved into back-navigable subviews instead of a six-card scroll.

## v21 — Weekly sets per muscle
`7b81aac` · 2026-07-28

MEV/MRV volume landmarks with a regex exercise→muscle map (secondary movers count half).
Plateau alerts can now name an under-trained muscle. Randomized non-repeating volume
milestone quips.

## v20 — The in-gym layer
`fc90f6d` · 2026-07-28

Rest timer (auto-starts on working-set completion, per-lift scaling, +30s/skip, audio +
haptic). Warmup/failure/drop set types, excluded from volume, PRs, e1RM, score and
progression. Per-set previous-value hints, live PR toasts, plate calculator, live session
stats. Rest and bar-weight settings.

## v19 — Train as a progress dashboard
`9c81715` · 2026-07-28

Hero session with scannable plan rows. Weight-moved stats (day/week/month/year/lifetime,
milestones, 8-week trend), consistency calendar with week streak, PR leaderboard with 30-day
deltas.

## v18 — The coach layer
`1dfe17b` · 2026-07-28

Auto-progression (double progression) with per-lift next-session targets, deload prescriptions
with real numbers, set pre-fill from prescription, and a rolling 7-day review with a
weakest-link recommendation.

## v17 — Service worker caches only successful responses
`174c41a` · 2026-07-28

A failed fetch during an update could be cached and then served, producing a white screen.

## v10–v16 — The bottom-gap saga
`a54f249` `d0fbec8` `74933f7` `640dbef` `9321468` `0c2af80` `962e16a` · 2026-07-23 → 07-28

Seven releases spent establishing why the installed PWA had dead space at the bottom of the
screen on iOS. Included on-device diagnostics, a magenta paintability probe, and a version
badge to confirm updates were even reaching the device.

**Conclusion:** a rigid `position:fixed` + `overflow:hidden` shell makes iOS report a
shortened viewport with zero safe-area insets. Natural document flow with `min-height:100dvh`
and sticky bars lets iOS go full-screen and report real insets. That shell is still in use.
Asset URLs gained `?v=NN` cache-busting here (`640dbef`) — the mechanism `tools/release.mjs`
now manages.

## Pre-v10 — foundation
`95513c0` `6e80d05` `08806eb` `6246d02` `65ae3e7` `de290d0` `012eaa8` `54026c3` `60e593f`
· 2026-07-22 → 07-23

First working app: calorie and macro tracking, AI meal scanning, workout log with plateau
detection, sleep scores, grocery lists. Then: renamed **Forge → Peak** (`54026c3`) — the
`forge:` localStorage prefix is still in use so existing data survives the rename — grocery
quick-adds, 12/24h setting, workout scores, cardio logging, bodyweight sets, the browser
install banner, and **AI scanning switched from the Claude API to the Gemini free tier**
(`012eaa8`) to make scanning free.
