# Peak — Roadmap

*Rewritten 2026-09-24. Peak is being developed as a product, not launched as a business — see
[D-25](DECISIONS.md#d-25). Revisit when the "Next" list empties.*

> **Status — 2026-09-24.** v48 on `main`. Coach, lift goals and outlook, log-anything, Strong/Hevy
> import and the review fixes are all shipped (CHANGELOG v41–v48). 135 tests pass. The one gap that
> can't be closed from a desk: **the real-device pass has never been run** ([SHIPPING.md](SHIPPING.md)).

## North star

**Peak is a coach that knows you — training, food and sleep together.**

The lifting headline is still the plateau engine: *Peak tells you when a lift has stalled and what
to do about it.* But Peak is all-in-one on purpose. Food, sleep and groceries are core, because
they're what a lift runs on, and a coach that could only see the gym would be guessing.

Every feature gets tested against one question: *does this make Peak feel more like it's coached
to this person, and less like a generic logbook?*

## Operating principles

1. **Rules decide, words adapt.** Advice comes from deterministic, tested rules over your own
   history (D-12, D-21, D-22). Voice, and optional AI wording, only change how it's said.
2. **Bias toward silence.** A false plateau or a wrong nudge costs more trust than a missed one. When
   the data is thin, say so rather than guess.
3. **Everything is yours to change.** Your definitions beat Peak's guesses (D-23), every
   destructive action is undoable (D-20), and nothing leaves the device unless you send it.
4. **No build step** (D-10). Ship small; a fix goes out in minutes.
5. **Tests before claims.** Every engine rule has a history in `tests/` that proves it.

## Shipped in this development push

| Version | What |
|---|---|
| v41 | Plateau engine judges progress by reps at a load; backups stop carrying the device id; Worker hardening |
| v42 | The Coach: states, switch-it-up, voices, debrief, lighter week; lift goals and outlook; weekly check-in; optional Gemini wording |
| v43 | Log anything: custom exercises, rename everywhere, any activity, several routines, save a session as a day |
| v44 | Engine refinements: second attempt after a deload, back-off sets, rest-dock rep check and effort, MRV note, side delts |
| v45 | Gym floor: warm-up ramp, supersets, 1.25 kg stepper, rest times, keyboard handling |
| v46 | Looks and access: 4.5:1 contrast in every theme, Light bars, 44px targets, focus, spoken toasts, safer service worker |
| v47 | Onboarding leads with training; tab order; 0 lb guard; cross-tab links |
| v48 | Import from Strong / Hevy |

## Next

In rough order. Each is a hypothesis, and any can be dropped.

1. **Real-device pass** (SHIPPING.md): the keyboard with the dock, safe areas, one-handed reach,
   the offline fallback, VoiceOver/TalkBack. Emulation has covered everything it can.
2. **Goal-aware plateau engine.** On a cut, Train still calls flat lifts "stalled" while the coach
   calls holding strength a win. The engine should see the deficit too.
3. **Supersets in routines.** Today they're per-session. Store the pairing on the routine day so it
   comes back every time.
4. **Coach memory, deeper.** Follow up on accepted switch-ups ("three weeks into your new
   block…"), learn preferred rep ranges, and put your best training weekday to use.
5. **Food ↔ training.** Training-day and rest-day calorie targets; protein timing around sessions.
6. **Apple Health / Google Fit** for bodyweight and sleep, so logging those is optional.
7. **Import from more apps** (FitNotes, JEFIT) if anyone asks.

## Parked — not dropped

Deliberately set aside while Peak is being built rather than sold (D-25). Nothing here is lost; the
thinking is in git history and these files.

- **Instrumentation and retention gates.** The old Month 1/2/6 gates assumed a launch.
- **Distribution:** Play Store, Reddit, video, comparison pages, creators.
- **Peak Pro and payments:** [PAYMENTS.md](PAYMENTS.md) is marked parked. If this is ever revisited,
  note that the product review found cloud sync and the program builder poor paid features
  (competitors include sync free, and routines are already free in Peak).
- **Cloud sync.** Still the biggest data-loss risk (everything lives in localStorage). Mitigated
  for now by the backup nudge and `storage.persist()`.

## Explicit non-goals

- **A social feed, friends or leaderboards.**
- **An AI chat coach.** The optional AI only words the weekly check-in from computed facts, and its
  reply is rejected if it invents anything (D-22).
- **A barcode database.** Photo scan is the deliberately different answer.
- **Rewriting in a framework.**
- **Ads.**
