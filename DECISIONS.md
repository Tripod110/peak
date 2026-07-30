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

**Accepted cost:** an edit to a same-URL asset lands on the *second* launch. This is why
[SHIPPING.md](SHIPPING.md) says hard-reload twice, and why [D-05a] below exists.

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
