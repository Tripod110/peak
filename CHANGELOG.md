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

---

## v32 — logging a night stops feeling like data entry
`pending` · 2026-08-09 · **pending push**

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
`pending` · 2026-08-09 · **pending push**

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
