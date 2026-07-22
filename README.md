# Peak ⛰️

A personal fitness PWA: **fuel, train, recover** — built to break plateaus.

**Live app:** https://tripod110.github.io/peak/

## Features

- **Calorie & macro tracking** — daily targets computed from your stats (Mifflin-St Jeor), goal-adjusted (cut / recomp / bulk), with protein emphasis.
- **AI meal scanning** — snap a photo (or just describe a meal) and Gemini estimates calories, macros, fiber, and a nutrition-quality score per item. Review and edit before logging. Runs on Gemini's free tier — $0.
- **Workout log** — built-in training splits (Full Body, Upper/Lower, PPL), per-set logging with "beat last time" hints, estimated-1RM PR detection, and **automatic plateau alerts** with concrete fixes.
- **Sleep scores** — nightly log (duration + quality + bedtime consistency → 0–100 score) with 14-day trends and recovery insights.
- **Smart grocery list** — checklist for the store, one-tap quick-adds (budget protein staples, snacks, and easy meals that add all their ingredients at once), and nudges when your week ran under your protein target.
- **Streaks, weight trend, weekly dashboard.**

## Privacy

All data lives in your browser's local storage — nothing is uploaded anywhere.
The only network call is the optional AI meal scan, sent directly from your device
to the Google Gemini API using **your own free API key** (stored on-device only, never in this repo).

## Install on your phone

1. Open the live URL in Safari (iPhone) or Chrome (Android).
2. **iPhone:** Share → *Add to Home Screen*. **Android:** menu → *Install app*.
3. Open it from your home screen like a normal app. Works offline (except scanning).

## AI scanning setup (free)

1. Create a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (sign in with any Google account — no card needed).
2. In Peak: ⚙ Settings → paste the key → Save.
3. Scanning is free on Gemini's free tier, with a generous daily allowance that resets overnight.

## Stack

Vanilla HTML/CSS/JS, zero dependencies, zero build step. Installable PWA with offline support via a service worker. Charts are hand-rolled inline SVG.
