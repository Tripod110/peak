# Peak — Roadmap

*Written 2026-07-29. Revisit at every gate below; delete anything that stops being true.*

> **Status — 2026-07-29.** **v27 is live** on GitHub Pages. Four of its five hardening items
> shipped in it; the fifth (backup nudge) is in **v28**, not yet pushed — it needed its own
> version because the service worker is cache-first and only drops the old bundle when
> `CACHE` changes, so an in-place edit to v27 would never have reached anyone.
> What remains before this counts as *shipped* is not code: instrumentation, and putting it in
> front of real people. A UX audit also pre-empted two of Week 2's four predicted issues (see
> notes there), leaving onboarding drop-off and iOS PWA behaviour as the live risks — neither
> observed on a real device yet.
>
> Release process: [SHIPPING.md](SHIPPING.md) · Payments: [PAYMENTS.md](PAYMENTS.md)

## North star

**Peak tells you when a lift has stalled and what to do about it.**

Every roadmap decision gets tested against that sentence. Food, sleep, and grocery exist
because they feed a lift — they are never the headline, and they never get built out at the
expense of the training engine.

## Operating principles

1. **Retention before acquisition.** Driving traffic to an app people abandon in week two
   just burns the audience. Fix the leak first.
2. **Never gate the plateau engine.** It costs nothing to serve, it's the entire positioning,
   and it's the thing people screenshot. Monetize storage and convenience, not intelligence.
3. **Ship small, ship often.** A 1,400-line vanilla JS file with no build step is an asset —
   a fix can go out in ten minutes. Protect that.
4. **Measure before building.** Every feature below is a hypothesis. Most of them should die.

---

## Week 1 — Ship and survive first contact
**Jul 29 → Aug 5** · release **v27**

The goal is not features. It's: don't lose anyone's data, know what's happening, and be
reachable.

- [x] **v27 hardening** (see `#v27` below) — pinned the Gemini model, killed thinking tokens,
      requested persistent storage, added a feedback channel *(live in v27)* and a backup
      nudge *(v28, pending push)*. All five done.
- [ ] **Instrumentation.** Right now there is zero visibility. Minimum viable: a
      privacy-respecting counter (self-hosted Umami, or a Worker endpoint) for installs,
      tab views, first workout logged, and day-7 return. No personal data, no third-party
      trackers — it would contradict the privacy promise in the README.
- [x] **Ship it.** v27 is live on GitHub Pages. *(v28 still to push — follow
      [SHIPPING.md](SHIPPING.md), including the real-device pass, which has never been run.)*
- [ ] **Get 10–20 humans on it.** Friends, gym floor, one lifting Discord. Watch at least
      three of them do onboarding *without helping them*. That hour is worth more than a
      month of guessing.

**Done looks like:** 15+ installs, 5+ people who logged a real workout, a written list of
everything that confused them.

---

## Week 2 — Fix what week 1 broke
**Aug 6 → Aug 12** · release **v28**

Triage feedback. Build nothing new. Predicted top issues, in likelihood order:

1. ~~**Unrecognised exercises.**~~ **Pre-empted in v27.** Unmatched lifts now land in an
   "N lifts not counted yet" bucket with one-tap tagging, and volume-based plateau advice
   stays switched off until nothing is untagged — so a regex miss can no longer silently
   report zero volume or invent a deficit. *Watch anyway:* whether people actually tag, or
   ignore the prompt. If they ignore it, the volume "why" is still effectively broken.
2. **Onboarding drop-off** — people bouncing before targets are set. **Now the top live
   risk.** Nobody has watched a stranger complete onboarding.
3. **iOS PWA quirks** — safe areas, storage eviction, the install flow. **Unverified on real
   hardware.** All layout work to date has been measured, not seen.
4. ~~**Unit conversion bugs** at metric/imperial boundaries.~~ **Pre-empted in v27.** Full
   metric support shipped with the boundary cases tested (bar defaults, plate math,
   increments, per-hand dumbbell loads, stored-string unit staleness).

**Done looks like:** every issue from week 1 either fixed or explicitly deferred with a
reason.

---

## Week 3 — Remove the scan cliff
**Aug 13 → Aug 19** · release **v29**

- [ ] **Cloudflare Worker scan proxy** goes live. Key server-side, prompt and schema
      server-side, so the endpoint can only ever return food JSON.
- [ ] **Free tier: 3 scans/day**, enforced server-side, with the limit as a **KV config
      value** — turn the dial without shipping an app update.
- [ ] **Global daily kill switch.** A KV counter that hard-rejects past N scans/day. Gemini
      has no native hard spend cap, only budget alerts, so this is the only thing standing
      between a bad day and a real bill.
- [ ] Keep BYO-key in Settings as "unlimited — bring your own free key." Costs nothing,
      already built, gives power users an escape hatch that isn't "pay me."

**Done looks like:** a new user can scan a meal within 30 seconds of install, with no Google
account and no setup.

---

## Month 1 — Distribution
**through Aug 29**

Only start this once week-2 retention isn't visibly broken.

- [ ] **Google Play via PWABuilder.** A weekend of work. Fitness is a search-driven category
      and being absent from store search cuts off most of the market.
- [ ] **Reddit.** r/naturalbodybuilding and r/weightroom, posting as a lifter who built a
      tool, not a founder. Read the self-promo rules first.
- [ ] **Short-form video of the plateau alert firing.** This is the one genuinely visual
      moment the app has. A macro pie chart is not a hook; "my app just told me I've been
      stalled for four weeks and put me on a deload" is.
- [ ] **Two comparison pages** — "Hevy alternative that tracks weekly volume," "free RP
      Hypertrophy alternative." Low competition, high intent.
- [ ] **One mid-tier YouTuber** (50–200k, evidence-based niche). Free lifetime code and a
      short note, not a sponsorship pitch.

**Gate — end of Month 1:** 100 installs and **≥25% of installs still logging in week 2**.

If retention is under 15%, stop all distribution work. More traffic into a leaky app is
wasted audience — go back to week 2 and find out why people leave.

---

## Month 2 — Monetization
**through Sep 30**

- [ ] **Cloud sync + backup.** The actual product people will pay for. Everything is
      localStorage today: switch phones, clear browsing data, or let iOS evict storage and a
      year of history is gone. Cloudflare D1 + a device-keyed account. ~$0.10/user/year.
- [ ] **Peak Pro, $29/year** via Stripe or Paddle:
      unlimited scans · cloud sync + backup · unlimited history (free: 90 days) ·
      custom program builder · CSV export.
- [ ] **Free tier stays genuinely good:** full logbook, plateau alerts, volume vs MEV/MRV,
      3 scans/day, unlimited local history.

**Gate — end of Month 2:** first 5 paying customers. Five is not a business; it's proof the
willingness to pay exists at all. Zero after a month of asking means the value isn't where
this plan assumes it is — and the assumption, not the price, is what needs to change.

---

## Months 3–6 — Grow, or learn it won't
**Oct 2026 → Jan 2027**

Sequenced by whatever month-2 feedback actually demands. Current best guesses:

- **iOS App Store** via Capacitor. More work than Play, but iOS is where fitness spending
  concentrates.
- **Custom program builder** — the most-requested feature in every training app, ever.
- **Deeper plateau intelligence.** The current rule (3 sessions + 21 days, no e1RM PR) is a
  good v1. Obvious upgrades: rep-quality and volume trend as inputs, per-lift sensitivity,
  distinguishing "stalled" from "recovering from a bad week."
- **Apple Health / Google Fit import** for bodyweight and sleep.

**Gate — end of Month 6 (Jan 2027), the honest one:**

| Signal | Read | Action |
|---|---|---|
| 1,000+ users, 50+ paying, growing monthly | It's working | Invest properly — consider going part-time on it |
| A few hundred users, handful paying, flat | Real but not a business | Keep as a maintained side project, cap effort at a few hours a month |
| Under 100 users after six months of trying | Distribution isn't landing | Stop investing. Fold the lessons into the services business, keep Peak as a portfolio piece and a personal tool |

Write the honest answer down in January. The failure mode for a solo project is not picking
the wrong branch — it's never reaching the fork and grinding on for another year.

---

## Year 1 — Jul 2027

Three plausible outcomes, none of them promised:

- **Base case (most likely).** A few hundred users, $500–2k/yr, a genuinely good personal
  app with a small real audience. Modest money, excellent portfolio piece.
- **Upside (~10–15%).** Something catches — one video, one community. 5–10k users, $5–15k/yr,
  a real decision about whether to take it seriously.
- **Downside.** No traction. Peak stays the best training app you personally use, and the
  services business becomes the income. This is still a fine outcome as long as you reached
  it deliberately at the Month 6 gate instead of drifting into it.

Expected value in dollars is low. The reason to run the plan anyway is that it's the only
version of this that can earn while you sleep — and the build cost is already sunk.

---

## Metrics that matter

Ignore vanity numbers. Track four:

| Metric | Why | Target by Month 2 |
|---|---|---|
| **Week-2 retention** | The only leading indicator that matters | ≥25% |
| Workouts logged per active user per week | Are they actually training with it | ≥2 |
| % of users who ever see a plateau alert | Does the headline feature ever fire | ≥40% by week 4 of use |
| Free → Pro conversion | The business | 2–3% |

That third one is easy to overlook and load-bearing: the whole pitch is a feature that needs
4 sessions and 21 days before it can fire. If most users churn before ever seeing one, the
positioning is writing a cheque the product never gets to cash.

---

## Explicit non-goals

Things that will look tempting and should be refused:

- **A social feed, friends, or leaderboards.** Enormous surface area, changes what the app
  is, and every competitor already lost this fight to Strava.
- **An AI chat coach.** Costly per user, undifferentiated, and a worse version of the
  deterministic advice Peak already gives for free.
- **Barcode scanning / a full food database.** MyFitnessPal's database is a 20-year moat.
  Don't compete there — the photo scan is the deliberately different answer.
- **Rewriting in React.** Zero build step is why a fix ships in ten minutes.
- **Ads.** Pennies at this scale, and it would wreck the feel of the app.
- **Android/iOS native rewrites** before the PWA has proven retention.

---

## <a name="v27"></a>v27 — ship release

**All five complete (2026-07-29).** Items 1–3 and 5 are live in v27; the backup nudge is in
v28, awaiting a push.

- [x] **Pin the Gemini model.** `gemini-flash-latest` is an alias; when it rolls to 3.5 Flash,
      input goes $0.30 → $1.50 and output $2.50 → $9.00 per 1M with no code change.
      → `DEFAULT_MODEL = 'gemini-2.5-flash'` with the old aliases mapped, `store.js`.
- [x] **`thinkingBudget: 0`.** Thinking is on by default on 2.5 Flash and bills as output.
      Meal estimation doesn't need reasoning; this roughly halves per-scan cost.
      → `thinkingConfig: { thinkingBudget: 0 }`, `api.js`.
- [x] **`navigator.storage.persist()`.** Asks the browser not to evict localStorage. Not a
      guarantee, but it's the difference between "usually safe" and "iOS may bin your training
      history after a week of not opening the app." → `app.js`, on boot.
- [x] **Backup nudge.** Prompts for a JSON export once there's history worth losing
      (≥10 logged days or ≥6 sessions) and no backup in 30 days. Names what's actually at
      risk ("back up your 7 sessions and 4 logged days"), Today-only so it never interrupts
      logging, "Not now" snoozes 7 days, exporting stands it down for 30. Settings shows the
      last backup date and flags it when due.
- [x] **Feedback channel** in Settings. You cannot act on feedback you never receive.

### Deferred out of v27

- [ ] **Real-device pass on iOS and Android.** The only unverified area of the audit — layout
      and tap targets were measured in code, never seen on a phone. Do this before the push,
      not after.
