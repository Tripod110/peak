# Peak ⛰️

**Your lifts stall and no app tells you.** Peak does — and it tells you what to do next.

**Live app:** https://tripod110.github.io/peak/

Most training apps are logbooks. They record what you lifted and draw you a nice line
chart, and it's entirely on you to notice that the line stopped going up four weeks ago.
Peak watches for that and says something.

## The part that matters

**Plateau detection.** Peak tracks estimated 1RM per exercise. When a lift hasn't beaten
its own best in **3+ sessions and 21+ days**, it gets flagged on the Train tab by name:

> ⚠ **Incline Bench Press — no PR in 4 sessions (28 days)**
> Stalled — deload to 135 lb × 8, then add 5 lb each session you complete until you pass 155 lb.

**And then it walks you back up.** The deload isn't a suggestion you have to remember —
your next session is pre-filled at the reduced weight, and every session you complete
adds the increment back until you clear your old best. Peak deloads *once*, from the top
only. While you're rebuilding it says "climbing back" instead of re-flagging you, so you
never get stuck on a staircase down.

**It also tells you *why* you stalled.** If the stalled lift's primary muscle is below its
effective weekly volume range, the alert says so. Peak maps every logged exercise to the
muscles it trains (secondary movers count half) and tracks weekly sets against
evidence-based MEV/MRV landmarks — so "no PR in 4 weeks" comes with "and you've only hit
6 sets of chest a week" attached.

**Progression is automatic the rest of the time, too.** Hit your prescription → next
session is pre-filled heavier. Fall short → repeat the weight and chase the missing reps.
Bodyweight work adds reps instead. You don't program; you just show up and beat the number
on the screen.

## The supporting cast

Stalling is rarely only a training problem, so Peak tracks the inputs that feed a lift:

- **Calories & macros** — targets from your stats (Mifflin-St Jeor), goal-adjusted
  (cut / slow cut / recomp / lean bulk), protein-emphasised. Optional goal weight with an ETA.
- **AI meal scanning** — snap a photo or just describe a meal; Gemini estimates calories,
  macros, fiber, and a nutrient-density score per item. Every number is editable before you
  log it. Runs on Gemini's free tier — $0.
- **Sleep scores** — duration + quality + bed *and* wake consistency → a 0–100 nightly score,
  with 14-day trends and backfill for missed nights. Logging one is two taps: Peak learns your
  usual bed and wake times and pre-fills them, **☀ I'm up** takes the wake time off the clock,
  and small corrections are nudge buttons rather than a spinning time wheel. And once there's
  enough of both logged,
  Peak splits your session scores by how you slept the night before, so the claim that sleep
  feeds the lift shows up in your own numbers instead of being asserted at you.
- **Smart grocery list** — quick-adds for budget protein staples and easy meals, plus a list
  built from what you actually log: your usuals, a nudge when a regular buy hasn't appeared in
  a couple of weeks, aisle grouping once it gets long, and quantities ("eggs ×2").
- **Streaks, weight trend, weekly review.** Metric or imperial throughout.

## Logging is built to be fast

Sets are pre-filled from your plan, so a working set is one tap. Per-set "beat last time"
hints, a rest timer that auto-starts and scales per lift, live PR toasts the moment you
clear one. Warmup, failure, and drop sets are tagged and excluded from volume, PR, and
progression math. Dumbbell and single-arm lifts log **per hand**; volume counts both sides.

**And it tells you what to load.** Not just for barbells — the leg press, the hack squat and
the T-bar all take plates and all take them differently, so Peak models each: bar weight
subtracted where there's a bar, both pegs where there are two, one post where there's one.
It draws the actual plates, follows the next set you haven't ticked (so a warmup ramp is
right on every set), updates as you type, and tells you when a number can't be loaded
exactly. Guessed wrong for your gym? Tap it and correct it once.

## Routines that become yours

Eleven built-in splits — Full Body ×2 and ×3, Upper/Lower, three flavours of Push/Pull/Legs,
Arnold, a body-part split, big-lifts-only, and a dumbbells-only routine for training at home —
with the next day queued automatically.

All of them are starting points. Add or remove exercises, reorder them, change the sets and
reps, rename days, add or delete whole days, or switch splits entirely. The first edit forks
the built-in into your own copy, so the standard version is always there to reset back to and
nothing you've logged is touched. Pick from a 123-exercise library, searchable and filtered by
muscle, or type in whatever your gym calls it.

## And it starts noticing things

The longer you use Peak, the more of your plan it can fix for you — all of it read from
sessions you already logged, with nothing to switch on:

> **＋ Add Cable Fly to Push?**
> You've added it yourself in 4 of your last 5 Push sessions.

> **≠ Bench Press: plan says 4 sets, you do 5.**
> Every one of your last 5 Push sessions logged exactly 5 working sets.

It also offers to drop a lift that's been in the plan for five sessions without a single set
logged, and to add a specific exercise when your routine *as written* can't reach a muscle's
effective weekly volume. Each is one tap to accept, one to dismiss for good, and never more
than two on screen at once.

## Privacy

All data lives in your browser's local storage — nothing is uploaded anywhere. The only
network call is the optional AI meal scan, sent directly from your device to the Google
Gemini API using **your own free API key**. A Content-Security-Policy restricts the app to
that one host, so there is nowhere else for anything to go.

Your API key is stored on this device in plain `localStorage`, and Peak says so in Settings
rather than implying otherwise — it can't be meaningfully encrypted in a client-side app,
because whatever decrypts it ships to the same device. What Peak does instead is keep it from
leaking: it is **stripped from exported backups**, never written back into the Settings field
(masked preview + Replace/Remove), and the CSP blocks sending it anywhere but Google. If that
isn't good enough for you, remove the key in Settings — everything except meal scanning works
without one.

Because everything is local, **clearing your browser data will erase your training
history.** Export a backup from Settings periodically.

## Install on your phone

1. Open the live URL in Safari (iPhone) or Chrome (Android).
2. **iPhone:** Share → *Add to Home Screen*. **Android:** menu → *Install app*.
3. Open it from your home screen like a normal app. Works offline (except scanning).

## AI scanning setup (free, optional)

Peak's training features work with no setup. Meal scanning needs a free Google key:

1. Create one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (sign in
   with any Google account — no card needed).
2. In Peak: ⚙ Settings → paste the key → **Test key & refresh models** → Save.
3. Scanning is free on Gemini's free tier, with a generous daily allowance that resets
   overnight.

Google retires models on its own schedule, so Peak doesn't rely on a model id baked into its
source. The picker is filled from what *your* key can actually run, and if a model disappears
mid-scan Peak finds a replacement and retries rather than showing you Google's advice to
"update your code."

## Stack

Vanilla HTML/CSS/JS, zero dependencies, zero build step. Installable PWA with offline
support via a service worker. Charts are hand-rolled inline SVG.

## Project docs

| | |
|---|---|
| [CHANGELOG.md](CHANGELOG.md) | What shipped in every release, traceable to its commit |
| [ROADMAP.md](ROADMAP.md) | Where this is going, with the gates that decide whether it keeps going |
| [DECISIONS.md](DECISIONS.md) | Why it's built this way — and the three decisions still open |
| [AUDIT.md](AUDIT.md) | The 2026-07 UX audit: 30 findings, each traced to its fix and its proof |
| [SHIPPING.md](SHIPPING.md) | Release runbook — pre-flight checks, the push, rollback |
| [PAYMENTS.md](PAYMENTS.md) | Getting Peak Pro sellable: Stripe setup and what blocks it |
| [worker/README.md](worker/README.md) | The hosted meal-scan proxy (scaffolded, not deployed) |
| [worker/API.md](worker/API.md) | The Worker's API contract — `/scan` as built, plus what's planned |

Current release: **v32** (see [CHANGELOG.md](CHANGELOG.md)). One open verification item —
the real-device pass in [SHIPPING.md](SHIPPING.md) has never been run, and v30's ergonomics
changes are exactly what a desktop browser cannot verify.

Releasing? Never hand-edit version strings — one version lives in 22 places:

```bash
node tools/release.mjs --check
```
