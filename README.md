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
- **Sleep scores** — duration + quality + bedtime consistency → a 0–100 nightly score, with
  14-day trends and backfill for missed nights.
- **Smart grocery list** — one-tap quick-adds for budget protein staples and easy meals, plus
  a nudge when your week ran under target.
- **Streaks, weight trend, weekly review.** Metric or imperial throughout.

## Logging is built to be fast

Sets are pre-filled from your plan, so a working set is one tap. Per-set "beat last time"
hints, a rest timer that auto-starts and scales per lift, plate math per side, live PR
toasts the moment you clear one. Warmup, failure, and drop sets are tagged and excluded
from volume, PR, and progression math. Dumbbell and single-arm lifts log **per hand**;
volume counts both sides.

## Built-in splits

Full Body, Upper/Lower, and Push/Pull/Legs, with the next day queued automatically. Log a
freestyle session any time. Any lift Peak doesn't recognise can be tagged to a muscle so it
counts toward your weekly volume.

## Privacy

All data lives in your browser's local storage — nothing is uploaded anywhere. The only
network call is the optional AI meal scan, sent directly from your device to the Google
Gemini API using **your own free API key** (stored on-device only, never in this repo).

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
2. In Peak: ⚙ Settings → paste the key → Save.
3. Scanning is free on Gemini's free tier, with a generous daily allowance that resets
   overnight.

## Stack

Vanilla HTML/CSS/JS, zero dependencies, zero build step. Installable PWA with offline
support via a service worker. Charts are hand-rolled inline SVG.
