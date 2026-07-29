# Payments — getting Peak Pro sellable

Target from `ROADMAP.md`: **Peak Pro, $29/year** — unlimited scans, cloud sync + backup,
unlimited history, program builder, CSV export. Month 2 (through Sep 30).

This document is the process. It is deliberately split into **paperwork you can start today**
and **engineering that is blocked** — because they have very different lead times, and the
blocker is not obvious.

> **What I can't do for you:** create the Stripe account, enter your bank details, tax ID, or
> identity documents, or accept Stripe's terms. Those are yours to do — I'd be handling your
> financial credentials, which I won't. Everything below is either something you do in
> Stripe's dashboard yourself, or code I can write once the decisions are made. None of this
> is tax or legal advice; the tax section in particular needs an accountant for your
> jurisdiction.

---

## The blocker: you cannot sell Pro yet

Peak has **no concept of a user**. Everything is `localStorage` keyed to one browser on one
device. There is a planned `deviceId` for scan rate-limiting, but a device ID is not identity:

- it dies when the user clears site data, so their subscription would vanish with it
- it can't move to a new phone, so "I bought this and lost it" becomes your support load
- it can't be proven, so you can't distinguish a paying user from anyone who copies the value

So the real dependency chain is:

```
identity  →  entitlement  →  Stripe integration  →  revenue
```

Stripe is the *last* step, not the first. The good news is that the commercial setup (which
involves verification delays measured in days) is completely independent of it, so start there.

---

## Phase 0 — decide two things

Everything downstream depends on these. Both are genuine judgement calls.

### Decision 1: Stripe direct, or a merchant of record?

Selling a digital subscription internationally means someone has to collect and remit VAT/GST
and, in some US states, sales tax on SaaS. Who that someone is, is the decision:

| | **Stripe direct** | **Paddle / Lemon Squeezy (MoR)** |
|---|---|---|
| Fee | ~2.9% + 30¢ → **$29 nets ~$27.86** | ~5% + 50¢ → **$29 nets ~$27.05** |
| Who is the seller of record | **You** | **They** |
| VAT/GST registration & filing | Your responsibility (Stripe Tax calculates, it does not file for you) | Handled entirely |
| EU B2C digital sales | No threshold — VAT due from the first sale, via OSS/non-Union scheme | Handled |
| Invoices, refunds, chargebacks, fraud | You | Them |
| Effort at 50 customers | Real and recurring | Roughly zero |

**Recommendation: start with a merchant of record.** The ~$0.80/customer/year difference is
irrelevant at the scale in the roadmap (50 paying customers ≈ $40/year of extra fee), and it
removes an open-ended compliance obligation from a solo project whose Month 6 gate explicitly
includes "stop investing." If Peak ever reaches thousands of subscribers, migrating to Stripe
direct is a known, bounded piece of work — and by then it will be worth doing.

The rest of this document is written for **Stripe**, because you asked for Stripe and because
Paddle/Lemon Squeezy integrations are near-identical in shape (hosted checkout → webhook →
entitlement). If you pick an MoR, the only real changes are the dashboard you configure and
the webhook signature verification.

### Decision 2: what is a user?

Three viable models. This is the fork that unblocks everything else.

| | **A. Email magic link** | **B. License key** | **C. Email + password** |
|---|---|---|---|
| Signup friction | one email, no password | none — key arrives after payment | highest |
| Works on a new phone | yes | yes, paste the key | yes |
| Sharing control | one identity, cap devices | keys get shared; cap devices | good |
| Extra infra | an email sender (Resend/Postmark free tier) | none | email + password hashing |
| Also unlocks cloud sync | **yes** | no — no durable identity to sync against | yes |
| Build time | ~1 week | ~2 days | ~1.5 weeks |

**Recommendation: A, email magic link.** Month 2 sells *cloud sync and Pro together*, and sync
is impossible without durable identity — so you have to build A eventually regardless.
Building B first means building identity twice.

**But:** if you want revenue before sync exists, B is a legitimate stepping stone. Ship Pro as
"unlimited scans + unlimited history" behind a license key, then add A when sync lands and
migrate keys to accounts. Only take that path deliberately, knowing it's throwaway work.

---

## Phase 1 — do this now (paperwork, days of latency)

None of this needs code, and Stripe's verification can take several business days, so it
should not be on the critical path later.

- [ ] **Create the Stripe account** at stripe.com. Use a business email you'll keep.
- [ ] **Complete verification** — legal name/entity, address, bank account for payouts,
      tax ID. Stripe will not let you leave test mode until this is done.
- [ ] **Decide the selling entity.** Sole trader vs a limited company changes your liability
      and your tax position. Worth one conversation with an accountant *before* you take the
      first payment, not after.
- [ ] **Create the product** — Products → *Peak Pro* → recurring price **$29 / year**.
      Note the price ID (`price_...`); it goes in the Worker config, never hardcoded in the app.
- [ ] **Decide on a trial.** A 14-day trial with no card up front converts better but needs
      trial-expiry handling. A trial *with* card is simpler and still standard. Pick one now
      — it changes the Checkout session config.
- [ ] **Enable the customer portal** (Settings → Billing → Customer portal). This gives you
      cancellation, payment-method updates, and invoice history for free. Building any of that
      yourself would be wasted work.
- [ ] **Turn on Stripe Tax** if going direct (Settings → Tax). It calculates; you still file.
- [ ] **Write the three legal pages** you need before charging anyone: Terms, Privacy Policy,
      and a Refund Policy. The privacy policy has to be honest about the one thing that
      changes with Pro: meal photos transit your Worker, and cloud sync means training data
      leaves the device. The current README promises everything stays local — that promise
      needs updating in the same release that ships sync.
- [ ] **Set a Gemini budget alert** in Google Cloud. The Worker's `GLOBAL_DAILY_CAP` is the
      hard stop; this is the early warning.

**Done looks like:** a verified Stripe account in test mode with a $29/yr price object, and
three legal pages written but not yet linked.

---

## Phase 2 — the entitlement architecture

Extend the existing `worker/` (Cloudflare) rather than adding a service. It already holds the
Gemini key, KV, and the rate limiter — entitlement belongs next to the thing it gates.

```
┌──────────┐   1. POST /checkout        ┌──────────────┐   2. create session   ┌────────┐
│   PWA    │ ─────────────────────────► │ peak-scan    │ ────────────────────► │ Stripe │
│          │ ◄───── checkout URL ────── │   Worker     │ ◄──── session URL ─── │        │
└────┬─────┘                            │              │                       └───┬────┘
     │  3. redirect to Stripe Checkout  │  + D1        │                           │
     │     (card details never touch    │  + KV        │ ◄─── 4. webhook ──────────┘
     │      Peak or the Worker)         └──────┬───────┘   checkout.session.completed
     │                                        │           customer.subscription.*
     │  5. GET /entitlement (signed token) ───┘           invoice.payment_failed
     ▼
  Pro unlocked — server decides, never the client
```

**Non-negotiables:**

1. **Card details never reach your code.** Use Stripe **Checkout** (hosted) — redirect out,
   come back. Not Elements, not a custom form. This keeps you out of PCI scope entirely and
   is the single biggest reason to do it this way.
2. **The server owns entitlement.** The app may cache "I am Pro" for offline use, but the
   Worker is the only authority. Never gate on a `localStorage` flag alone — it's a devtools
   edit away.
3. **Verify every webhook signature** with `stripe.webhooks.constructEvent` and the endpoint
   secret. An unverified webhook endpoint is a "grant myself Pro" button.
4. **Webhooks must be idempotent.** Stripe retries. Store processed `event.id`s and no-op on
   repeats.
5. **Secrets via `wrangler secret put`**, never `wrangler.toml` — that file is committed.
   You'll need `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
6. **Fail closed on payment, open on outage.** If Stripe is unreachable, don't revoke Pro for
   paying users — cache the last known good entitlement with a grace window (7 days is
   reasonable). Revoking someone's paid features because your webhook was down is worse than
   a week of unpaid access.

### Data model (Cloudflare D1)

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,      -- uuid
  email         TEXT UNIQUE NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE TABLE subscriptions (
  user_id            TEXT PRIMARY KEY REFERENCES users(id),
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_sub_id      TEXT UNIQUE,
  status             TEXT NOT NULL,     -- trialing|active|past_due|canceled
  current_period_end INTEGER,
  updated_at         INTEGER NOT NULL
);
CREATE TABLE webhook_events (             -- idempotency
  id          TEXT PRIMARY KEY,           -- Stripe event.id
  received_at INTEGER NOT NULL
);
```

### Worker endpoints to add

| Route | Does |
|---|---|
| `POST /auth/request` | email → send magic link (signed, 15-min expiry, single use) |
| `GET /auth/verify` | consume link → return a long-lived signed session token |
| `POST /checkout` | authed → create a Stripe Checkout session, return its URL |
| `POST /portal` | authed → create a Customer Portal session, return its URL |
| `GET /entitlement` | authed → `{ pro: bool, status, periodEnd }` — the only source of truth |
| `POST /stripe/webhook` | verify signature → upsert `subscriptions` → record `event.id` |

The existing `/scan` route then reads entitlement to choose the daily cap instead of always
applying `FREE_SCANS_PER_DAY`.

### Webhooks to handle

`checkout.session.completed` · `customer.subscription.created` · `.updated` · `.deleted` ·
`invoice.payment_failed` · `invoice.paid`

Treat `customer.subscription.updated` as the workhorse — it covers renewals, cancellations,
trial endings, and dunning transitions. `checkout.session.completed` mainly tells you which
`user_id` a new `stripe_customer_id` belongs to (pass it as `client_reference_id`).

---

## Phase 3 — test before going live

- [ ] Test mode end-to-end with card `4242 4242 4242 4242`
- [ ] Decline path with `4000 0000 0000 0002` — the app should stay on the free tier cleanly
- [ ] `stripe listen --forward-to localhost:8787/stripe/webhook` against `wrangler dev`
- [ ] Replay the same webhook event twice — confirm the second is a no-op
- [ ] Forge a webhook with a bad signature — confirm it's rejected
- [ ] **Test clocks** (Stripe dashboard) to fast-forward a year and watch the renewal, then a
      failed renewal and the dunning path
- [ ] Cancel via the customer portal → confirm Pro persists until `current_period_end`, then
      lapses
- [ ] Point the app at a dead Worker → confirm a paying user keeps Pro through the grace window
- [ ] Confirm free-tier users are unaffected by all of the above

## Phase 4 — go live

- [ ] Swap test keys for live keys (`wrangler secret put`)
- [ ] Register the live webhook endpoint; store the *live* signing secret
- [ ] Link Terms / Privacy / Refund policy from Settings and from Checkout
- [ ] Charge yourself $29 with a real card. Confirm the payout arrives.
- [ ] Refund yourself. Confirm entitlement revokes.

---

## The Play Store conflict — read before Month 1

`ROADMAP.md` sequences **Google Play in Month 1** and **Stripe in Month 2**. Those two plans
can collide: Google Play's policy has historically required in-app purchases of digital
content to use Google Play Billing, at a 15–30% cut, and forbidden steering users to external
payment. That would put a Stripe-powered upgrade inside a Play-distributed Peak in breach.

This area has been in active legal flux (the *Epic v. Google* remedies, EU DMA obligations,
and various regional carve-outs have all moved the line, at different times, in different
markets). **Verify the current policy yourself before building either integration** — do not
rely on this paragraph or on anything you read six months ago.

Three ways through it, in increasing effort:

1. **Web-only Pro.** Sell exclusively on the PWA at `tripod110.github.io`; the Play build
   stays free with no upgrade path in-app. Zero policy risk, cheapest, and loses some
   conversion.
2. **Play Billing for the Play build**, Stripe for web. Correct and safe, but means two
   billing integrations and two entitlement sources to reconcile.
3. **Skip Play until there's revenue.** The Month 1 gate is *retention*, not distribution.
   If week-2 retention is under 25%, the roadmap already says stop distribution work — in
   which case this decision never needs making.

Given the roadmap's own gates, **(1) is the right first answer**: ship web-only Pro, and
revisit only if Play traffic proves it's worth a second billing stack.

---

## Suggested order of work

1. **Now:** Phase 0 decisions, Phase 1 paperwork (verification latency).
2. **Week 3 (v29):** deploy the existing scan proxy. It's the same Worker payments will live
   in, so you'll have `wrangler`, KV, and secrets working before money is involved.
3. **Month 1:** instrumentation and retention. Do not build billing while you still don't
   know whether anyone comes back on day 7.
4. **Month 2, first half:** identity (magic link) + D1. This is the actual work.
5. **Month 2, second half:** Stripe Checkout + webhook + entitlement, then Phase 3 testing.
6. **Gate:** 5 paying customers. Zero after a month of asking means the assumption about
   *what* people would pay for is wrong — change that, not the price.
