# Peak Worker — API contract

The interface between the PWA and the Cloudflare Worker. Written so the client and server
can't drift once [`../api.js`](../api.js) is rewired in v29.

**Status:** `POST /scan` is **implemented but not deployed** — `wrangler.toml` still has
`id = "REPLACE_ME"` for the KV namespace. Everything under [Planned](#planned) is **NOT BUILT**.

**Source of truth:** [`src/index.js`](src/index.js). This document describes what that code
does today; if they disagree, the code is right and this file is a bug.

**Base URL:** `https://peak-scan.<subdomain>.workers.dev`

---

## `POST /scan`

Estimates the nutrition of a meal from a photo, a description, or both. The Gemini key,
prompt and response schema all live server-side — a client that cannot choose the prompt
cannot repurpose this as a general-purpose LLM. It answers one question and returns nothing else.

### Request

`content-type: application/json`

| Field | Type | Required | Notes |
|---|---|---|---|
| `image` | string (base64, no data-URI prefix) | one of `image`/`description` | Max **1,500,000 characters**. Named `MAX_IMAGE_BYTES` in source but compared against string length, so the real ceiling is ~**1.07 MB** of image data. The app downscales to 1024px long edge, well under this. |
| `mediaType` | string | no (default `image/jpeg`) | Must match `image/(jpeg\|png\|webp)`. The app only ever sends JPEG. |
| `description` | string | one of `image`/`description` | Truncated server-side to **400 characters**. |
| `deviceId` | string | **yes** | Opaque, ≤64 chars. Used only as a rate-limit key. Not identity — see [Planned](#planned). |

```json
{ "image": "<base64>", "mediaType": "image/jpeg", "description": "chipotle bowl, double chicken", "deviceId": "<uuid>" }
```

### `200` success

The Gemini `responseSchema` guarantees the shape, plus `remaining` added by the Worker.

```json
{
  "items": [{
    "name": "Grilled chicken breast",
    "portion": "6 oz",
    "calories": 280, "protein_g": 52, "carbs_g": 0, "fat_g": 6, "fiber_g": 0,
    "quality_score": 9
  }],
  "confidence": "high",
  "notes": "Assumed no added oil.",
  "remaining": 2
}
```

- Every field in `items[]` is required and integer-typed except `name` and `portion`.
- `confidence` ∈ `high` · `medium` · `low`.
- `notes` is an empty string when there is nothing to say.
- `quality_score` is 0–10 nutrient density (10 = whole and nutrient-dense, 0 = ultra-processed).
- `remaining` — free scans left today for this `deviceId`. Show it as "N scans left today".

### Errors

Every error is `{ "error": "<user-safe sentence>" }`, plus `code` where listed. Messages are
written to be shown to the user directly. **Google's error text is never forwarded** — it can
name the model, project or key; it goes to `console.log` instead.

| Status | `code` | When | Client should |
|---|---|---|---|
| `400` | — | Malformed JSON, no image *and* no description, bad `mediaType`, or missing/oversized `deviceId` | Fix and retry; a bug if it happens |
| `403` | — | `Origin` doesn't match `ALLOWED_ORIGIN` | Nothing — misconfiguration |
| `404` | — | Any path other than `/scan` | — |
| `405` | — | Any method other than `POST`/`OPTIONS` | — |
| `413` | — | `image` over the character cap | Downscale further |
| `422` | — | Gemini returned no identifiable food | Show the message; suggest a clearer photo. **Quota is not consumed** |
| `429` | `RATE_LIMIT` | Per-device daily free scans used up | **This is the Pro upsell moment.** Response carries `resetsAt` |
| `429` | — | Gemini itself rate-limited (no `code`) | Transient — retry shortly |
| `502` | — | Gemini unreachable, or a non-429 upstream failure | Transient — retry |
| `503` | — | `GLOBAL_DAILY_CAP` hit — the kill switch | Offer the bring-your-own-key path in Settings |

Distinguish the two `429`s by `code`: `RATE_LIMIT` is the user's quota (upsell), a bare `429`
is upstream congestion (retry).

```json
{ "error": "You've used your 3 free scans today.", "code": "RATE_LIMIT", "resetsAt": "2026-07-29T24:00:00Z" }
```

> `resetsAt` uses ISO 8601 end-of-day `T24:00:00Z`, which is legal and means midnight *closing*
> that UTC day. V8 parses it correctly. Historically some Safari versions have rejected `24:00`
> — verify before parsing it client-side, or just show the date.

### `OPTIONS /scan`

Returns `204` with CORS headers. `access-control-allow-origin` is `ALLOWED_ORIGIN`, falling
back to `*` when unset. Origin checking is deliberately weak — it filters casual abuse; the
caps below are the real protection.

### Rate limiting and cost control

Two independent KV counters, both keyed to the **UTC** day with a 48-hour TTL:

| Key | Limit | Purpose |
|---|---|---|
| `dev:<deviceId>:<YYYY-MM-DD>` | `FREE_SCANS_PER_DAY` (default `3`) | Per-device courtesy limit. Spoofable — clearing storage yields a new `deviceId`. |
| `global:<YYYY-MM-DD>` | `GLOBAL_DAILY_CAP` (default `5000`) | **The only hard stop on the bill.** Gemini offers budget alerts, not spend caps. |

The global cap is checked **first**, so a distributed flood of fresh device IDs still stops.

Both counters increment **only after a successful scan** — a `422` doesn't cost the user a
scan, and a failed upstream call doesn't count toward the global cap.

KV is eventually consistent, so both can undercount slightly under concurrency. Acceptable for
a courtesy limit; the global cap is set well under budget to absorb the slack. A Durable Object
would be needed for exactness.

### Configuration

Vars in [`wrangler.toml`](wrangler.toml), tunable without an app release:
`FREE_SCANS_PER_DAY` · `GLOBAL_DAILY_CAP` · `MODEL` (pinned, never a `*-latest` alias) ·
`ALLOWED_ORIGIN`.

Secret, never committed: `GEMINI_API_KEY` via `wrangler secret put`.

### Observability

One JSON line per successful scan via `console.log`, readable with `wrangler tail`:

```json
{"day":"2026-07-29","model":"gemini-2.5-flash","in":1234,"out":210,"thoughts":0,"globalUsed":41}
```

`thoughts` should always be `0` — if it isn't, `thinkingConfig.thinkingBudget: 0` isn't taking
effect and you're paying for reasoning tokens on a perception task.

---

## <a name="planned"></a>Planned — NOT BUILT

Proposed in [../PAYMENTS.md](../PAYMENTS.md). None of this exists in `src/index.js`; do not
write client code against it yet. Listed here so the contract has one home when it is built.

| Route | Purpose |
|---|---|
| `POST /auth/request` | email → send a signed single-use magic link (15-min expiry) |
| `GET /auth/verify` | consume the link → return a long-lived signed session token |
| `POST /checkout` | authed → create a Stripe Checkout session, return its URL |
| `POST /portal` | authed → create a Stripe Customer Portal session, return its URL |
| `GET /entitlement` | authed → `{ pro, status, periodEnd }` — the only authority on Pro |
| `POST /stripe/webhook` | verify signature → upsert subscription → record `event.id` |

Two consequences for `/scan` when these land:

1. It reads entitlement to choose the daily cap instead of always applying
   `FREE_SCANS_PER_DAY`.
2. `deviceId` stops being the rate-limit key for signed-in users, who get keyed to their
   account instead. `deviceId` is **not** identity: it cannot survive cleared storage, move to
   a new phone, or be proven — which is exactly why entitlement needs a real account. See
   [../DECISIONS.md](../DECISIONS.md).

## Known duplication

`SCAN_PROMPT` and `SCAN_SCHEMA` exist in **both** `src/index.js` and [`../api.js`](../api.js).
That is intentional while the app still ships bring-your-own-key. When hosted scanning goes
live in v29, delete them from `api.js` and leave this Worker as the only copy — otherwise the
two will drift and identical photos will score differently depending on which path ran.
