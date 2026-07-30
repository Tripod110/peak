# Changelog

Every release, newest first. Each heading carries the commit it shipped in, so any line here
can be traced to a diff with `git show <hash>`.

Peak has no build step, so "release" means: version bumped with
[`tools/release.mjs`](tools/release.mjs), committed, pushed to `main`, served by GitHub Pages.
See [SHIPPING.md](SHIPPING.md).

> **Version numbering note.** There is no v25 or v26. A UX audit ran between v24 and v27 and
> its ~30 fixes were folded into the v27 commit rather than released separately, so the version
> sequence jumps. Every one of those fixes is itemised in [AUDIT.md](AUDIT.md) and attributed
> to `5f0a417`.

---

## v28 — backup nudge, release tooling, process docs
`d5f2c02` · 2026-07-29 · **not yet pushed**

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
`ad832e2` · docs-only follow-up — no app code changed, so no version bump.

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
`5f0a417` · 2026-07-29 · **live**

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
  **Not deployed;** ships in v29.

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
