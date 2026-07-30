# Shipping Peak

The release runbook. Peak is static files on GitHub Pages, so a release is a `git push` —
which makes it easy to push something broken. The point of this document is the checks
either side of that push.

**Live:** https://tripod110.github.io/peak/ · **Repo:** `Tripod110/peak` · Pages serves `main`.

---

## The version footgun, first

One version number lives in 22 places across three files, and the failure modes are quiet:

| Where | What it does | If it's stale |
|---|---|---|
| `app.js` → `APP_VERSION` | what Settings reports | you can't tell which build a user is on |
| `index.html` → `?v=NN` ×10 | what the browser requests | browsers serve the old file from HTTP cache |
| `sw.js` → `CACHE = 'peak-vNN'` | cache name | **`activate()` never clears the old cache — users keep the previous build indefinitely** |
| `sw.js` → `SHELL` `?v=NN` ×10 | pre-cache list | pre-cache is dead weight; first paint waits on the network |

Never edit these by hand:

```bash
node tools/release.mjs --check
```

```bash
node tools/release.mjs 28
```

`--check` also verifies that `SHELL` names every script `index.html` actually loads — add a
new `.js` file and forget the `SHELL` entry, and it silently stops being available offline.

---

## Pre-flight

Run every time. Nothing here takes more than a couple of minutes.

- [ ] `node tools/release.mjs --check` passes
- [ ] `for f in *.js; do node --check "$f"; done` — all clean
- [ ] Onboarding completes from a wiped state (`Settings → Reset everything`, then reload)
- [ ] Start a workout → log a set → reload the page mid-session → the session comes back
- [ ] `Settings → Export data` produces a valid JSON file, then `Import backup` restores it
- [ ] No console errors after visiting all five tabs and every drill-in
- [ ] **Real device pass** (see below) — the one gate that has never actually been run

### Real-device pass

Everything in the app has been verified by measuring the DOM. None of it has been *seen* on
a phone. Do this once properly before the first public push, then only when layout changes:

- [ ] iPhone Safari: install to home screen, confirm no gap above the tab bar and nothing
      hidden behind the home indicator (`env(safe-area-inset-bottom)`)
- [ ] iPhone: the in-gym set row — can you hit ✓ without hitting ✕, one-handed, in a hurry?
- [ ] Android Chrome: install prompt appears, launches standalone
- [ ] Rotate to landscape on both; nothing overlaps
- [ ] Pinch-zoom works (it should — `user-scalable=no` was removed deliberately)
- [ ] Rest timer fires its beep and vibration with the screen locked and the app backgrounded
- [ ] Camera scan: take a real photo of a real meal, check the review sheet is usable
      one-handed and the macro inputs are reachable above the keyboard

---

## Release

```bash
node tools/release.mjs 28 && git add -A && git commit -m "v28: <what changed>" && git push origin main
```

Pages takes 30–60 seconds. Then:

- [ ] Reload the live URL **once**. The new version should be live immediately — versioned
      assets are cached under their exact `?v=NN` URL, so a bump is always a cache miss and
      goes to the network. If you see the *old* version, something is wrong; don't shrug it off
      as caching. (Before v29 this genuinely took two loads and could serve a mixed bundle —
      the service worker matched with `ignoreSearch`, which stripped the version query.)
- [ ] Settings shows the new version number
- [ ] DevTools → Application → Cache Storage shows **only** `peak-vNN`; no older caches
- [ ] Open the *installed* PWA on a phone and confirm it updated too — installed instances
      update on next launch, not while open

## Rollback

Pages has no rollback button. Revert and re-push — and bump the version *up*, never back,
because the service worker only clears its cache when `CACHE` changes:

```bash
git revert --no-edit HEAD && node tools/release.mjs 29 && git commit -a --amend --no-edit && git push origin main
```

A user stuck on a broken build can always self-recover with
`Settings → Backup & data → Export`, then clear site data and reload. Worth knowing before
you need to say it to someone.

---

## Still missing before the first public push

Two items from `ROADMAP.md` week 1 that are not code and not done:

1. **Instrumentation.** There is currently zero visibility — you will not know if anyone
   installs, or where they drop off. Minimum viable: installs, tab views, first workout
   logged, day-7 return. Self-hosted Umami or a counter on the existing Cloudflare Worker.
   No third-party trackers — that would contradict the privacy promise in the README.
2. **A way to hear from people.** The feedback channel shipped in v27; make sure the address
   behind it is one you actually read.

## Later: app stores

`ROADMAP.md` puts Google Play (via PWABuilder) in Month 1. Before starting that, read the
"Play Store conflict" section in [PAYMENTS.md](PAYMENTS.md) — distributing through Play
changes what you're allowed to do about payments, and it's cheaper to know that before you
build the billing integration than after.
