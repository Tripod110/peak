# Peak scan proxy

Hosted meal scanning, so users don't need their own Gemini API key.

**Status: scaffolded, not deployed.** Peak v27 still ships bring-your-own-key. This goes
live in v29 (week 3 — see [../ROADMAP.md](../ROADMAP.md)).

**The request/response contract is in [API.md](API.md)** — read that before wiring the app up.

## Why this exists

An API key embedded in a PWA is a public key. The app's source ships to every device —
view-source, the devtools Network tab, or reading the deployed `.js` on GitHub Pages all
reveal it, and no amount of obfuscation helps because the key must be plaintext at the
moment `fetch` runs. Putting it here is the only way to have both a hidden key and
zero-setup scanning.

## Deploy

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler kv namespace create PEAK_KV     # paste the id into wrangler.toml
wrangler secret put GEMINI_API_KEY       # paste your key when prompted
wrangler deploy
```

## Wiring the app up

In [`../api.js`](../api.js), replace the direct Gemini call with a POST to the Worker and
delete the client-side `SCAN_PROMPT` / `SCAN_SCHEMA` (this Worker becomes the only copy):

```js
const res = await fetch('https://peak-scan.<subdomain>.workers.dev/scan', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ image: imageBase64, mediaType, description, deviceId: getDeviceId() })
});
```

`getDeviceId()` needs writing — a random UUID generated once and kept in `Store`. Keep the
existing BYO-key path as a Settings option: users who hit the daily cap can supply their own
key for unlimited scans, which costs you nothing and gives them an out that isn't "pay me."

Handle `429` with `code: 'RATE_LIMIT'` in the UI — that's the upsell moment for Pro, and the
response carries `remaining` on success so the app can show "2 scans left today."

## Cost controls, in order of importance

1. **`GLOBAL_DAILY_CAP`** — the only hard stop on your bill. Gemini offers budget *alerts*,
   not caps, so nothing else prevents a bad day from becoming a real invoice. Default 5,000
   scans/day ≈ $6/day worst case on 2.5 Flash.
2. **`FREE_SCANS_PER_DAY`** — the dial you turn if costs outrun revenue. Server-side on
   purpose: changing it needs no app release.
3. **`MODEL`** — pinned, never a `*-latest` alias. Google hot-swaps those on every release,
   and 3.5 Flash costs 5× 2.5 Flash on input, 3.6× on output.
4. **`thinkingConfig.thinkingBudget: 0`** — thinking bills as output. Portion estimation is
   perception, not reasoning.

Both counters are KV, which is eventually consistent and can undercount slightly under
concurrency. That's acceptable for a courtesy limit; the global cap is set well under budget
to absorb the slack. Move to a Durable Object only if you need exactness.

## Watch after launch

`wrangler tail` streams one JSON line per scan with real token counts. Compare them against
the estimates in ROADMAP.md — those are guesses until this has been live for a week.
