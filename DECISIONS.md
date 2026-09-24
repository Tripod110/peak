# Decision log

Why Peak is built the way it is. One entry per decision that would otherwise get re-litigated
or quietly reversed.

Each entry: **status**, the date, what was decided, what was rejected, and what it blocks or
enables. Open decisions sit at the top — those are the ones waiting on you.

| # | Decision | Status |
|---|---|---|
| [D-01](#d-01) | Merchant of record vs Stripe direct | 🟡 **OPEN** — blocks all billing work |
| [D-02](#d-02) | What a "user" is | 🟡 **OPEN** — blocks billing *and* cloud sync |
| [D-03](#d-03) | Where Pro is sold (web vs Play) | 🟡 **OPEN** — decide before Play work starts |
| [D-04](#d-04) | Dumbbells are logged per hand | 🟢 Decided · v27 |
| [D-05](#d-05) | Cache-first for versioned assets, network-first for HTML | 🟢 Decided · v27 |
| [D-06](#d-06) | Deload once, then climb back — never re-deload while rebuilding | 🟢 Decided · v27 |
| [D-07](#d-07) | Server owns entitlement; the client never decides | 🟢 Decided (design) |
| [D-08](#d-08) | `forge:` storage prefix kept after the rename | 🟢 Decided · v1 |
| [D-09](#d-09) | Cardio never fills a lifting slot | 🟢 Decided · v27 |
| [D-10](#d-10) | No build step | 🟢 Decided · v1 |
| [D-11](#d-11) | Unmatched exercises fail loud, not to zero | 🟢 Decided · v27 |
| [D-12](#d-12) | A plateau requires four gates, not one | 🟢 Decided · v29 |
| [D-13](#d-13) | The API key stays in plaintext; the blast radius shrinks instead | 🟢 Decided · v30 |
| [D-14](#d-14) | Model ids are discovered from the user's key, not pinned in source | 🟢 Decided · v30 |
| [D-15](#d-15) | Routines fork on write; built-ins are never mutated | 🟢 Decided · v31 |
| [D-16](#d-16) | The coach reads the plan for volume, the log for habits | 🟢 Decided · v31 |
| [D-17](#d-17) | Restored backups are untrusted; escape at the sink and coerce at the boundary | 🟢 Decided · v33 |
| [D-19](#d-19) | Every tab is hero, tiles, list, Explore — no flat tabs, no in-page switchers | 🟢 Decided · v40 |
| [D-20](#d-20) | Destructive actions are undoable, not confirmed | 🟢 Decided · v40 |
| [D-21](#d-21) | Progress is reps at a load, not only the top set | 🟢 Decided · v41 |
| [D-22](#d-22) | The coach: rules decide, voice words it, you can always say no | 🟢 Decided · v42 |
| [D-23](#d-23) | Your definition of an exercise beats the name-based guess | 🟢 Decided · v43 |
| [D-24](#d-24) | Several routines: the active one keeps its key, the rest wait in a library | 🟢 Decided · v43 |
| [D-25](#d-25) | Develop Peak as a product; park the launch plan | 🟢 Decided · 2026-09-22 |

---

## <a name="d-01"></a>D-01 · Merchant of record vs Stripe direct
**🟡 OPEN.** Raised 2026-07-29. Blocks: everything in [PAYMENTS.md](PAYMENTS.md) phase 1.

Selling a digital subscription internationally means someone must collect and remit VAT/GST,
and US sales tax on SaaS in some states. The decision is *who*.

- **Stripe direct** — ~2.9% + 30¢ ($29 nets ~$27.86). **You** are the seller of record: VAT
  registration and filing are yours. Stripe Tax calculates; it does not file.
- **Paddle / Lemon Squeezy (MoR)** — ~5% + 50¢ ($29 nets ~$27.05). They are the seller of
  record; tax, invoices, chargebacks and fraud are theirs.

**Recommendation: start with a merchant of record.** At the roadmap's own scale — 50 paying
customers — the fee difference is roughly $40/year, against an open-ended and recurring
compliance obligation on a solo project whose Month 6 gate explicitly includes "stop
investing." Migrating to Stripe direct later is bounded, known work, and by then it pays for
itself.

**Not decided by me.** This has tax and legal consequences and wants an accountant for your
jurisdiction. Nothing has been created in Stripe or anywhere else.

**Consequence either way:** the integration shape is identical — hosted checkout → webhook →
entitlement. Only the dashboard and the signature verification differ, so this decision does
not block *designing* the entitlement layer.

## <a name="d-02"></a>D-02 · What a "user" is
**🟡 OPEN.** Raised 2026-07-29. Blocks: billing, and cloud sync.

Peak has no concept of a user. Everything is `localStorage` on one device. The planned
`deviceId` is a rate-limit key, not identity — it dies with cleared storage, can't move to a
new phone, and can't be proven.

- **A. Email magic link** — one email, no password. ~1 week. **Also the foundation for cloud
  sync.**
- **B. License key** — issued after payment, pasted into Settings. ~2 days. No durable
  identity, so it cannot support sync. Keys get shared; cap devices to mitigate.
- **C. Email + password** — most work, worst UX, no advantage over A here.

**Recommendation: A.** Month 2 sells cloud sync and Pro *together*, and sync is impossible
without durable identity — so A has to be built regardless. Choosing B first means building
identity twice and throwing one away.

**Legitimate exception:** if you want revenue before sync exists, B is a defensible stepping
stone. Take it deliberately, knowing it's disposable.

## <a name="d-03"></a>D-03 · Where Pro is sold
**🟡 OPEN.** Raised 2026-07-29. Decide **before** starting Play Store work, not after.

`ROADMAP.md` puts Google Play in Month 1 and Stripe in Month 2. Those can collide: Play policy
has historically required Play Billing for in-app digital purchases (15–30%) and forbidden
steering to external payment. That area has been in active legal flux — *Epic v. Google*
remedies, EU DMA, regional carve-outs — so **verify current policy directly; do not trust this
entry or anything written months ago.**

1. **Web-only Pro** — sell only on the PWA; the Play build stays free with no in-app upgrade.
   Zero policy risk, cheapest, loses some conversion.
2. **Play Billing for Play, Stripe for web** — correct and safe, but two billing integrations
   and two entitlement sources to reconcile.
3. **Skip Play until there's revenue** — the Month 1 gate is *retention*, not distribution.

**Recommendation: 1**, revisited only if Play traffic proves a second billing stack is worth it.

---

## <a name="d-04"></a>D-04 · Dumbbells are logged per hand
**🟢 Decided.** v27 · `train.js` · `perHandLift`, `setLoadKg`

Dumbbell and single-arm loads were a bare number with no stated convention, so a year of
history was ambiguous by 2× and e1RM comparisons were meaningless.

**Decided:** per hand, stated in the UI (`lb/hand` on the input, "per hand" on records), with
volume counting both sides so "weight moved" stays comparable to barbell work. e1RM stays
per-hand, which is how lifters actually compare dumbbell lifts.

**Rejected:** logging combined total — nobody thinks "I pressed 100 lb" holding two 50s.

**Known limitation:** pre-v27 history was logged without any convention and cannot be
retroactively disambiguated. The convention applies going forward.

## <a name="d-05"></a>D-05 · Cache-first assets, network-first HTML
**🟢 Decided.** v27 · `sw.js`

Network-first for everything fixed stale updates but cost a network timeout on every launch
offline or on weak signal — a gym-floor app.

**Decided:** navigations (HTML) are network-first, because `index.html` carries the `?v=NN`
references and must never be stale. Versioned assets are cache-first, because their URL
changes whenever their content does, so a cache hit is always correct.

**Accepted cost:** an edit that does *not* change the URL never lands, which is why every
release must bump the version — see the corollary below.

**Amended v29.** The original implementation matched the cache with `ignoreSearch: true`, which
strips `?v=NN` — so every version of a file collapsed onto one cache entry and a bump could
serve the previous build's script in response to a request for the new one, or hand out a mixed
bundle. Matching is now exact. A bump is therefore always a cache miss, goes to the network,
and lands on the *first* load.

**D-05a, corollary:** a release must bump `CACHE`. `activate()` only clears old caches when the
name changes, so an in-place edit reaches nobody. This bit us for real — the v28 backup nudge
had to become its own release because v27 was already live. Enforced by
[`tools/release.mjs`](tools/release.mjs), which refuses to move a version backwards.

## <a name="d-06"></a>D-06 · Deload once, then climb back
**🟢 Decided.** v27 · `train.js` · `nextTarget`, `bestWorkingWeightKg`

The original rule cut 10% whenever a lift read as stalled. Because "stalled" measured the
all-time best — still unbeaten during a rebuild — it cut again every session, walking a 155 lb
bench to 85 lb over six *compliant* sessions. See [AUDIT.md](AUDIT.md) finding 1.

**Decided:** completing the prescription always earns the increment (`allHit` is tested before
the stall flag), and a deload only fires at ≥98% of the all-time best.

**Rejected:** persisting an explicit deload state machine. The rule above is derivable from
history alone, so there is no new state and nothing to migrate — which also means it fixes
existing users' data retroactively.

## <a name="d-07"></a>D-07 · Server owns entitlement
**🟢 Decided (design).** Not yet built · [PAYMENTS.md](PAYMENTS.md), [worker/API.md](worker/API.md)

**Decided:** the Worker is the only authority on Pro. The app may cache "I am Pro" for offline
use, but never gates on a `localStorage` flag alone — that is one devtools edit from free.

Card details never reach Peak or the Worker: hosted Stripe Checkout only, never Elements or a
custom form. This keeps the project entirely out of PCI scope.

**Corollary — fail closed on payment, open on outage.** If Stripe or the Worker is unreachable,
paying users keep Pro for a grace window (7 days). Revoking someone's paid features because
your webhook was down is worse than a week of unpaid access.

## <a name="d-08"></a>D-08 · `forge:` storage prefix kept
**🟢 Decided.** v1 · `store.js`

The app was renamed Forge → Peak in `54026c3`. The `localStorage` prefix was not renamed.

**Decided:** keep `forge:`. Renaming would orphan every existing user's data for zero
user-visible benefit. The cost is one confusing line in `store.js`, which carries a comment
saying exactly this.

## <a name="d-09"></a>D-09 · Cardio never fills a lifting slot
**🟢 Decided.** v27 · `train.js` · `sessionsInDays(days, liftsOnly)`, `weekStreak`

`liftsOnly` existed but no caller passed it, so a Sunday walk counted toward "3 of 5 sessions"
and kept the week streak alive — while the weekly review counted it separately, so the same
week read as met on one screen and short on another.

**Decided:** cardio is tracked and celebrated but never substitutes for a planned lift. Every
plan-adherence counter is lifts-only; cardio is reported alongside.

**Accepted cost:** existing users' week-streak numbers dropped when this shipped (5 → 2 on the
audit's seeded month). The smaller number is the true one.

## <a name="d-10"></a>D-10 · No build step
**🟢 Decided.** v1 · reaffirmed in [ROADMAP.md](ROADMAP.md) non-goals

Vanilla HTML/CSS/JS, no dependencies, no bundler, no framework.

**Decided:** keep it. A fix ships in ten minutes and there is no toolchain to rot. Explicitly
listed as a non-goal to rewrite in React.

**Accepted cost:** one version number in 22 places (mitigated by `tools/release.mjs`), no type
checking, and `train.js`/`app.js` are both over 1,300 lines. Revisit only if file size actually
starts causing bugs — not because large files feel wrong.

## <a name="d-11"></a>D-11 · Unmatched exercises fail loud
**🟢 Decided.** v27 · `train.js` · `muscleSetsInDays`, `openTagMuscleModal`

The exercise→muscle regex map returned empty for anything it didn't recognise, so unmapped
lifts silently contributed zero volume — and the plateau advice then blamed the phantom
deficit ("your hamstrings volume is only 0 sets") on lifts the user was actually doing.

**Decided:** unmatched lifts surface in an "N lifts not counted yet" bucket with one-tap
tagging, and volume-based advice stays silent until nothing is untagged. Better to admit
ignorance than to compute confidently on a gap.

**Rejected:** expanding the regex table alone. It will always miss something; the failure mode
was the problem, not the coverage.

**Open risk:** this only works if users tag. Tracked in [ROADMAP.md](ROADMAP.md) week 2 as
something to observe rather than assume.

## <a name="d-12"></a>D-12 · A plateau requires four gates, not one
**🟢 Decided.** v29 · `train.js` · `detectPlateaus`

"Best e1RM unbeaten for ≥3 sessions and ≥21 days" fired on roughly three out of four plausible
training histories — an abandoned lift, a lift sitting under one fluke PR while adding weight
every session, and a lift rebuilding after time off. See [AUDIT.md](AUDIT.md) finding 31.

**Decided:** a lift is stalled only if it is *(1)* still being trained (within 21 days),
*(2)* has ≥4 sessions since the last ≥28-day break, *(3)* has no PR in ≥3 sessions and ≥21 days,
and *(4)* is not currently climbing (recent 3-session best ≤ prior 3-session best × 1.01).

**Why this bias:** on the app's defining feature, a false positive costs far more than a false
negative. Telling a progressing lifter to deload is actively harmful and unrecoverable trust;
missing a plateau for one extra session costs almost nothing, because the next session will
catch it. All four gates are therefore tuned to stay quiet when uncertain.

**Rejected:** tuning the thresholds on the single existing rule. The rule wasn't mis-tuned, it
was missing context — no amount of threshold adjustment distinguishes "stalled" from "just came
back from holiday."

**Rejected:** persisting a per-lift state machine. All four gates are derived from history, so
there is nothing to migrate and existing users' data is reinterpreted correctly on upgrade.

## <a name="d-13"></a>D-13 · The API key stays in plaintext; the blast radius shrinks instead
**🟢 Decided.** v30 · `store.js`, `app.js`, `index.html`

The Gemini key sits in `localStorage` under `forge:settings`, unencrypted, and a user
reasonably asked whether that should be fixed.

**Decided:** it stays in plaintext, and the three ways it actually escaped get closed.

**Why not encrypt it.** Whatever decrypts the key ships to the same device as the ciphertext.
A passphrase would have to be typed before every scan to avoid being cached somewhere equally
readable, which trades the app's fastest feature for protection against an attacker who, by
definition, already runs code on the device — and who would just read the key at `fetch` time
instead. Encryption here is a claim, not a control, and a false claim is worse than an honest
label. The UI now states plainly where the key lives and who can read it.

**What was actually fixed** — each is a path the key took *off* the device:

1. **Exported backups carried it.** A backup is the one Peak artefact meant to leave the
   device — emailed, synced, attached to a bug report. It contained a live credential in
   every copy. Stripped on export; the file says so; a restore preserves the key already
   present rather than blanking it.
2. **Settings rendered it back into the page.** A field pre-filled with a live credential puts
   it in the DOM, in autofill, and in any screenshot of that screen, for no benefit — nobody
   edits an API key in place. Replaced with a masked preview plus Replace / Remove.
3. **Nothing constrained where it could be sent.** A CSP now names
   `generativelanguage.googleapis.com` as the only host the app may open a connection to, with
   `script-src 'self'` and no inline scripts. This is the one control that still works if
   something hostile *is* executing here: the key can be read, but not exfiltrated.

**The real fix remains [D-07](#d-07) / [worker/](worker/README.md)** — a hosted proxy means the
app holds no key at all. Everything above is what's worth doing while that is unbuilt, and
none of it is a substitute for it.

## <a name="d-14"></a>D-14 · Model ids are discovered from the user's key, not pinned in source
**🟢 Decided.** v30 · `api.js`, `store.js`

v27 pinned the scan model to a stable id rather than a `*-latest` alias, to stop Google
hot-swapping quality and price underneath us. Correct, and insufficient: on 2026-07-09 Google
made `gemini-2.5-flash` return 404 "no longer available" months ahead of its announced
2026-10-16 shutdown. A pinned id is still a guess about someone else's roadmap, and the app
failed with a valid key and no way for the user to understand why.

**Decided:** hard-coded ids are a *seed list only*. The authority on what works is the key
itself, via `ListModels`. Settings' picker is populated from it, and a 404 mid-scan triggers a
discover-repoint-retry rather than an error.

**Why not just bump the pin to 3.5.** That fixes today and re-breaks on Google's next
deprecation, with the same user-visible symptom and the same required app release. The pin is
the bug class, not the specific version.

**Existing users are not migrated.** 2.5 still works for them until October and may carry
different free-tier limits than 3.x; moving someone off a model that works for them is its own
bug. New installs default to `gemini-3.5-flash`, Settings warns when the selected model is
scheduled for shutdown, and the automatic repoint catches everyone else the moment it matters.

**Kept from v27:** never a `*-latest` alias, and `thinkingBudget: 0` — both still hold.

## <a name="d-15"></a>D-15 · Routines fork on write; built-ins are never mutated
**🟢 Decided.** v31 · `routines.js` · `activeRoutine`, `editableRoutine`

Making routines editable had two plausible shapes: mutate the template in place, or copy it
the first time the user changes something.

**Decided:** fork on write. `TEMPLATES` is read-only seed data. The first edit copies the
active split into `Store('routine')`, and from then on the whole Train tab reads that.

**Why:** "reset to the standard split" has to keep working, and it can only work if the
standard split still exists somewhere. It also means shipping an improved built-in in a later
release never silently rewrites a routine someone has tuned — their copy is theirs, and the
upgrade is an offer rather than an edit.

**Consequence:** the split dropdown in Settings no longer decides anything on its own once a
custom routine exists, so it asks before replacing one. A dropdown that appears to do nothing
is worse than a confirm.

**Rejected:** versioning routines, or diffing user edits against the built-in to merge
upstream changes. Enormously more machinery for a solo-user local app where the "upstream
change" is me editing a literal a few times a year.

## <a name="d-16"></a>D-16 · The coach reads the plan for volume, the log for habits
**🟢 Decided.** v31 · `routines.js` · `coachSuggestions`, `routineWeeklyMuscleSets`

The "Peak noticed" suggestions all derive from logged sessions, with one deliberate exception:
the muscle-volume rule measures what the *routine programs*, not what was *logged*.

**Why:** the first implementation used logged sets over the trailing 7 days, and on a 3-day
split it flagged four muscles at once — every muscle whose day happened to fall outside the
window. Back was "under its minimum" because Pull was eight days ago, and it helpfully offered
to add a fifth back exercise to a routine that already had plenty. Volume you didn't do
because you skipped a session is an adherence problem, and the plateau and consistency
surfaces already own that. Volume the routine *cannot* deliver even if you attend perfectly is
a programming problem, and that is the only one worth offering to fix here.

**Also decided:** the threshold is 80% of MEV, not MEV. These landmarks are ranges, and
flagging 7 sets against a "minimum" of 8 trains people to ignore the card.

**Consistent with [D-12](#d-12):** on anything advisory, bias toward silence. A suggestion has
to be specific about what it observed and fixable in one tap, or it does not earn the space —
"consider more volume" is a horoscope, not a suggestion.

## <a name="d-17"></a>D-17 · Restored backups are untrusted input; escape at the sink AND coerce at the boundary
**🟢 Decided.** v33 · `store.js` · `sanitizeStored`, `normTime`, `importAll`

A security triage found stored HTML injection reachable through Settings → Import backup. The
app escaped everything it thought of as *text* — exercise names, food names, grocery items, AI
scan output — and treated everything it thought of as *structural* (times, reps, quality
ratings, scores) as trustworthy, interpolating it raw. Storage is not trustworthy: a backup is
a file a user can be handed, and the app actively nags them to make one, so receiving one looks
routine.

The clearest path: `fmtTime` returned its argument verbatim in 24-hour mode, and the same
backup that supplied the payload also supplied `timeFmt: "24"`. Opening the Sleep tab rendered
attacker markup as live DOM. Reproduced, including a full-viewport phishing overlay with an
off-site link that survived reload.

**Decided: both layers, because each covers the other's failure mode.**

- **Escape at the sink.** Every interpolation is `esc()`d, with no exceptions for values
  believed to be numeric. "Everything is escaped" is a rule you can grep for and enforce;
  "escaped unless we're confident it's a number" is a rule that silently rots.
- **Coerce at the boundary.** `sanitizeStored()` re-shapes every key after an import — times
  through `normTime`, numbers clamped to ranges, enums checked against their allowed sets,
  anything unrecognised dropped rather than repaired.

**Why not just one.** There are ~40 interpolation sites and the set grows every release; one
missed `esc()` is an injection, so sink-escaping alone is one careless line from failing. But
boundary-coercion alone fails the moment a new field is added and not covered. Together, a bug
needs both a missed sink and a missed field.

**Bonus, and the reason this was worth doing properly:** the same validator fixed a way to
brick the app. `restoreSession` only checked `Array.isArray(exercises)`, so a backup whose
`sets` was a string threw inside `renderExerciseBlock` on every render of the Train tab —
permanently, since the bad session reloads from storage on each boot.

**Also decided:** imports drop any key outside the `forge:` namespace, and report how many were
dropped. GitHub Pages puts every project on one origin, so an unnamespaced key lands in storage
shared with the user's other sites — and `wipeAll` is prefix-scoped, so "Reset everything"
would have left it behind while claiming the device was clean.

**What the CSP bought.** [D-13](#d-13)'s `script-src 'self'` blocked script execution
throughout — `onerror` never fired. Without it this was straightforwardly "steal the API key
and everything else on the origin." It downgraded a High to a Medium, which is exactly what
defence in depth is supposed to do, and is a good argument for never adding `'unsafe-inline'`
to `script-src` for convenience.

## <a name="d-19"></a>D-19 · Every tab is hero, tiles, list, Explore
**🟢 Decided.** v40 · `ui.js`, every tab file

v37 rebuilt Today and Train around one shape and left the other three tabs alone, so Peak had
two design languages: a hero card with a glance strip and drill-ins on two tabs, and a long
scroll of competing cards on the rest. Sleep stacked five blocks; Grocery hid four sections
behind an in-page segmented switcher whose state nothing ever reset.

**Decided:** every tab's home screen is, in order — a **hero** that answers "what now?" for
whatever the tab is about, a **stat-tile strip** of at most three numbers, the tab's **main
list**, and an **Explore** card of nav rows into drill-in subviews. Everything that is a record
rather than a decision goes one tap deeper.

The conventions that make it one pattern rather than five:

- State is `App.{tab}View`, defaulting to `'home'`, and the tab bar resets it.
- Actions are `{tab}-nav` (carrying `data-view`) and `{tab}-back`. Both set
  `App._renderedTab = null`, or the drill-in opens scrolled to wherever home was.
- The subview table is a `const {TAB}_SUBVIEWS` of `{title, sub}`, rendered by the shared
  `navHeader`.
- Markup comes from the shared builders in `ui.js` — `heroCard`, `tile`, `navRow`,
  `heroStats`, `progressBar`. A tab that needs a shape none of them make gets a new builder
  there, not a private copy.

**Rejected: in-page segmented switchers for navigation.** They carry state nothing resets, they
need tablist semantics nobody adds, and they compete with the content for a 375px screen. A
`.seg` control is still right for picking a *value* — units, sex, a theme — which is what the
remaining ones do.

**Rejected: a tile that is not a destination.** Every tile is a button that goes somewhere. A
number with nowhere to go is a card. This is why Grocery has no tile strip: its one number is
already the hero's title, and every candidate tile duplicated an Explore row.

**Cost, accepted:** eleven subviews is a lot of screens to walk before a release, so
SHIPPING.md's pre-flight now names them.

## <a name="d-20"></a>D-20 · Destructive actions are undoable, not confirmed
**🟢 Decided.** v40 · `ui.js` (`destructive`, `registerUndo`), every tab file

Peak destroyed data three different ways depending on which tab you were in: Food's entry
delete had a full undo, Sleep's night delete used a native `confirm()` that named neither the
date nor the length of what it was about to erase, and Grocery's delete, clear-checked and
quantity-down-from-one destroyed on one tap with nothing at all.

**Decided: deleting something offers Undo; it does not ask first.** A confirm makes you answer
for an action whose result you have not seen, and it costs the same two taps whether you meant
it or not — an undo costs one tap only when you were wrong. `destructive(kind, data, message)`
is the one way to delete, and `registerUndo(kind, fn)` puts each restore next to the code that
deleted it. Restores put the row back at its original index: a shopping list ordered by the
shop, or a ranked list of frequent foods, is not much use reshuffled.

**`confirm()` survives in exactly five places**, and naming them is the point — otherwise the
next release deletes them too:

| Kept | Why |
|---|---|
| `reset-app` | the whole dataset; there is nothing left to undo with |
| `discard-workout` | throws away a session that was never saved |
| `routine-use-template` | replaces a custom routine wholesale |
| `routine-reset` | same |
| `routine-del-day` | takes a day and everything in it out of the plan |

The test is whether an undo could actually restore what was lost. Where it could, it does.

## <a name="d-21"></a>D-21 · Progress is reps at a load, not only the top set
**🟢 Decided.** v41 · `train.js` · `beats`, `repsAtOrAbove`, `isClimbing`, `lastSessionSets`, `bestComparableKg`

An 18-scenario review of realistic intermediate histories found the v29 engine (D-12) still
telling progressing lifters to deload. Every false positive had the same root: progress was
measured as *the single best set's e1RM*, and that number cannot see most of the ways an
intermediate actually progresses.

**Decided:** a session counts as progress if it beats the earlier ones on e1RM, **or** does more
total reps at-or-above some load it used than any earlier session did. Double progression
(8/7/7 → 8/8/7) and high-rep work past the formula's 12-rep cap are now progress. The rep test
only applies when the session's e1RM is within 3% of the prior best, so a heavy single at a new
weight is not "more reps at 365 than ever".

The same review drove four smaller rules, all derived from history, with no stored state:

- **Climbing is judged locally.** Gate 4 now asks whether either of the last two sessions beat
  the three before it. The v29 rule compared the best of each 3-session block, which kept a
  pre-break PR in the "prior" block and deloaded a lifter rebuilding after ten days off.
- **Prescriptions read the same rep scheme.** A lift on a heavy 4×5 day and a light 3×10 day has
  two histories. `lastSessionSets(name, target)` prefers the most recent session at that rep
  target, if it's within `LAYOFF_DAYS` of the latest session.
- **The deload ceiling ignores heavy singles and the other scheme.** `bestComparableKg` only
  counts sets with at least half the target reps, at the same rep target when there is one.
- **An extra set doesn't block the increase.** "Hit everything" is judged on the best `sets` sets
  at the top weight.

Also: increments are ~2.5% for every lift (lower-body lifts had 5%, a novice-sized jump), and the
plateau card's volume sentence follows D-16. It reads the routine rather than the trailing 7
days, uses 80% of MEV, and no longer says "before dropping weight" beside a deload.

**Accepted cost:** a stall whose reps happen to rise for two sessions in a row reads as climbing,
which delays the flag by about a session. D-12 already accepts that trade.

**Rejected:** an effort (RPE) input as the fix. Effort would help, but it's optional data. The
engine has to be right about the reps people already log.

**Known limits, still open:**
- A top set followed by lighter back-off sets never earns an increase. That needs a back-off set
  type.
- After a deload, coming back to the old top weight and missing once deloads again straight away
  (unchanged since D-06). That needs a short grace window.

## <a name="d-22"></a>D-22 · The coach: rules decide, voice words it, you can always say no
**🟢 Decided.** v42 · `coach.js`

Peak had plenty of numbers and no opinion about them. The goal is that it feels like a coach who
knows *you*: it notices when you haven't been progressing and tells you to change something.

**Decided:** three layers, in this order.
1. **Signals** are pure functions over logged history. Every claim the coach makes is one of them.
2. **State** is one reading (starting, roll, grinding, holding, drifting, rundown, comeback,
   steady), derived fresh on every render and never stored. It follows the same rule as D-12:
   nothing to migrate, and old data is reinterpreted correctly.
3. **Words** come in three user-chosen voices. The voice changes the wording, never the facts or
   the action. A test enforces this.

**Why rules and not a model:** the coach's advice changes your routine. It has to be the same
advice for the same history, explainable, and testable against personas. An LLM can later
*word* a weekly check-in from these facts, and it will be rejected if it names anything the facts
don't contain. It never decides.

**Order of readings:**
- A comeback outranks everything, because stall talk during a rebuild is the worst possible
  message.
- Drifting outranks momentum, because you can't progress sessions you don't do.
- On a cut, flat strength reads as *holding* (a win). The plateau engine still flags those lifts,
  because it can't see the deficit; the coach can.

**Only your answers are stored** (`coachMemory`: snoozes, the last switch-up, a lighter week's
end date). The coach never writes down a verdict about you.

**Every action is undoable** (D-20). After a switch-up, the "grinding" reading is snoozed for
three weeks, because a new block needs time before it can be judged.

**Rejected:** a chat coach. It's still a non-goal, for the same reasons as before.

## <a name="d-23"></a>D-23 · Your definition of an exercise beats the name-based guess
**🟢 Decided.** v43 · `custom.js`, `train.js` (`perHandLift`, `isTimedLift`, `exerciseHasLoad`), `routines.js` (`defaultTargetFor`)

Peak decided what a lift was from its name: a regex for per-hand, another for bodyweight, "(seconds)"
for timed holds, a table for plate loading. That's a fine default and a bad master. "Hammer Curl"
on a cable rope isn't per hand, and a "Dead Hang" isn't anything the patterns know.

**Decided:** a user-defined exercise (`customExercises`) is consulted first by every one of those
readers, and the name-based guess is only the fallback. Muscles and loading are **not** duplicated
into the definition. They're written to the existing `muscleMap` / `loadMap` overrides, which
every reader already checks first, so each question still has one source of truth.

**Renaming is one operation across every name-keyed store.** A partial rename would quietly split
one lift into two histories. A rename onto a name that already has history is refused, because
merging two lifts is a different operation with different consequences.

## <a name="d-24"></a>D-24 · Several routines: the active one keeps its key, the rest wait in a library
**🟢 Decided.** v43 · `custom.js`

**Decided:** `routine` stays exactly what it was, the active custom routine, and every other
routine waits in `routineLibrary`. Switching parks the active one and swaps the chosen one in.

**Why not one `routines` list with an active id:** about fifteen readers across four files read
`routine` directly, including the coach's undo. Moving them all behind a new accessor is a
migration with a lot of ways to go wrong and nothing for the user to see. With this layout there's
nothing to migrate: an existing routine simply becomes the active one of a library of one.

**Nothing is ever discarded by a switch or a new routine,** and every such change registers an undo
(D-20).

## <a name="d-25"></a>D-25 · Develop Peak as a product; park the launch plan
**🟢 Decided.** 2026-09-22 · `ROADMAP.md`, `PAYMENTS.md`

The July roadmap was a launch plan: instrumentation, 10–20 users, distribution, a Pro tier by the end
of September, and install and retention gates at months 1, 2 and 6. After weeks spent getting Peak
launch-ready, none of the gate work had started, and the owner concluded they'd rather build the app
than sell it.

**Decided:** Peak is developed as an all-in-one fitness app that feels like a coach tailored to one
person. Food, sleep and grocery are core, not supporting features. The launch material is
**parked, not deleted**: PAYMENTS.md carries a header saying so, and ROADMAP.md keeps a *Parked*
section so the thinking isn't lost.

**Rejected:** the product review's advice to hide or freeze the non-training tabs. That advice was
right for a plateau-only product, which Peak isn't trying to be.

**Consequence:** "done" now means *right and pleasant to use*, measured by tests, browser checks
and the real-device pass, rather than installs and conversion. The one launch-plan item that still
matters for its own sake is the device pass, and it stays in SHIPPING.md.
