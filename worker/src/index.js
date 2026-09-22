/* Peak scan proxy — Cloudflare Worker.
 *
 * Exists so users don't have to create their own Gemini API key. The key lives
 * here as a secret and never reaches the browser.
 *
 * The prompt and responseSchema live here too, deliberately: a client that can't
 * choose the prompt can't repurpose this endpoint as a free general-purpose LLM.
 * It answers exactly one question — "what food is in this photo" — and returns
 * nothing else.
 *
 * NOTE: SCAN_PROMPT and SCAN_SCHEMA are duplicated from ../../api.js. When the
 * app switches to hosted scanning, delete them there and keep this the only copy.
 *
 * Also handles push-notification subscriptions (/subscribe, /unsubscribe) and a
 * cron trigger (`scheduled` below) that fires reminders at each subscriber's
 * configured local time. See webpush.js for the actual Web Push/VAPID mechanics.
 */

import { sendWebPush } from './webpush.js';

const SCAN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Short food name, e.g. "Grilled chicken breast"' },
          portion: { type: 'STRING', description: 'Estimated portion, e.g. "6 oz" or "1 cup"' },
          calories: { type: 'INTEGER' },
          protein_g: { type: 'INTEGER' },
          carbs_g: { type: 'INTEGER' },
          fat_g: { type: 'INTEGER' },
          fiber_g: { type: 'INTEGER' },
          quality_score: { type: 'INTEGER', description: '0-10 nutrient density / whole-food score. 10 = whole unprocessed nutrient-dense food, 5 = mixed, 0 = ultra-processed empty calories.' }
        },
        required: ['name', 'portion', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'quality_score']
      }
    },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    notes: { type: 'STRING', description: 'One short sentence: assumptions made or a tip. Empty string if none.' }
  },
  required: ['items', 'confidence', 'notes']
};

const SCAN_PROMPT = `Analyze this meal and estimate its nutrition. Identify each distinct food item, estimate a realistic portion size from visual cues (plate size, utensils, packaging), and give calories and macros per item. Be realistic, not optimistic — restaurant and home-cooked meals usually have more oil and butter than they appear to. If the user provided a description, trust it for identifying the food but still estimate portions yourself unless quantities are given. quality_score reflects nutrient density and processing level.`;

const MAX_IMAGE_BYTES = 1_500_000;   // the app downscales to ~1024px; this is slack, not a target
const MAX_DESC_CHARS = 400;

/* New `sub:` records created per UTC day, across everyone. A subscription is a
   permanent (no-TTL) KV record that the cron then walks on every run, so an
   unbounded number of them is both a storage bill and a way to starve the cron
   before it reaches real subscribers. Re-subscribing from a device that already
   has a record doesn't count — only genuinely new ones do. */
const NEW_SUBS_PER_DAY = 500;

/* A push endpoint is a URL this Worker will POST to, unattended, every time the
   cron fires. Without an allowlist that makes /subscribe an open request relay:
   anyone can register any URL and have Cloudflare hit it on a schedule. These
   are the only hosts a real browser's pushManager can ever hand us.
   Checked as an exact host or a subdomain — never a substring, which would let
   `fcm.googleapis.com.evil.example` through. */
const PUSH_HOSTS = [
  'fcm.googleapis.com',              // Chrome / Chromium
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com',              // Safari / iOS
  'notify.windows.com',              // Edge (legacy WNS)
  'push.services.mozilla.com'
];
function isAllowedPushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  let u;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOSTS.some(h => host === h || host.endsWith('.' + h));
}

function utcDay() { return new Date().toISOString().slice(0, 10); }

function cors(env) {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400'
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(env) }
  });
}

/* Read-modify-write on an eventually-consistent store: two requests that land
   together read the same value and one increment is lost. That is tolerable for
   the per-device courtesy limit, and it is NOT tolerable for the global cap —
   Gemini has no hard spend cap, so that counter is the actual spend control.
   The global cap compensates by reserving its slot *before* the paid call and
   never refunding (see below), which makes the failure direction overcounting
   rather than undercounting. Swap to a Durable Object if you need exactness. */
async function bump(kv, key, ttlSeconds) {
  const n = Number(await kv.get(key)) || 0;
  await kv.put(key, String(n + 1), { expirationTtl: ttlSeconds });
  return n + 1;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });

    /* Not a security boundary — a header is trivially forged by anything that
       isn't a browser, so it stops casual abuse and nothing more. The real
       protection is the caps below and the endpoint allowlist in
       handleSubscribe. Missing Origin is rejected too: every legitimate caller
       is the page on ALLOWED_ORIGIN making a cross-origin JSON POST, which the
       browser always labels. */
    const origin = request.headers.get('origin');
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: 'Forbidden' }, 403, env);
    }
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, env);

    const url = new URL(request.url);
    if (url.pathname === '/subscribe') return handleSubscribe(request, env);
    if (url.pathname === '/unsubscribe') return handleUnsubscribe(request, env);
    if (url.pathname !== '/scan') return json({ error: 'Not found' }, 404, env);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Bad request' }, 400, env); }

    const { image, mediaType = 'image/jpeg', description = '', deviceId } = body || {};
    if (!image && !description) return json({ error: 'Send a photo or a description.' }, 400, env);
    if (image && image.length > MAX_IMAGE_BYTES) return json({ error: 'Image too large.' }, 413, env);
    if (!/^image\/(jpeg|png|webp)$/.test(mediaType)) return json({ error: 'Unsupported image type.' }, 400, env);
    if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
      return json({ error: 'Bad request' }, 400, env);
    }

    const day = utcDay();

    /* Global kill switch. Gemini has no hard spend cap — only budget alerts — so
       this counter is the only thing standing between a bad day and a real bill.
       Checked before the per-device limit so a distributed flood still stops. */
    const globalCap = Number(env.GLOBAL_DAILY_CAP) || 5000;
    const globalUsed = Number(await env.PEAK_KV.get(`global:${day}`)) || 0;
    if (globalUsed >= globalCap) {
      return json({ error: 'Scanning is at capacity today — try again tomorrow, or add your own free key in Settings.' }, 503, env);
    }

    // Per-device courtesy limit. Spoofable, which is what the global cap is for.
    const perDay = Number(env.FREE_SCANS_PER_DAY) || 3;
    const deviceKey = `dev:${deviceId}:${day}`;
    const used = Number(await env.PEAK_KV.get(deviceKey)) || 0;
    if (used >= perDay) {
      return json({
        error: `You've used your ${perDay} free scans today.`,
        code: 'RATE_LIMIT',
        resetsAt: `${day}T24:00:00Z`
      }, 429, env);
    }

    /* Reserve the global slot BEFORE spending money, not after the response comes
       back. Incrementing afterwards left the whole Gemini round-trip as a window
       in which every concurrent request read the same pre-increment value and
       sailed past a cap that was already met — the one counter that is supposed
       to bound the bill was the one that failed open under exactly the load it
       exists for. Deliberately not refunded when the call fails: a refund path
       reopens the same race in the direction that costs money, and a failing
       scan has usually still been billed for its input tokens. */
    await bump(env.PEAK_KV, `global:${day}`, 172800);

    const parts = [];
    if (image) parts.push({ inline_data: { mime_type: mediaType, data: image } });
    let text = SCAN_PROMPT;
    if (description) text += `\n\nUser description of the meal: "${String(description).slice(0, MAX_DESC_CHARS)}"`;
    if (!image) text += '\n\n(No photo — estimate from the description alone.)';
    parts.push({ text });

    const model = env.MODEL || 'gemini-2.5-flash';
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: SCAN_SCHEMA,
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 }
            }
          })
        }
      );
    } catch {
      return json({ error: 'Could not reach the scanner — try again.' }, 502, env);
    }

    if (!res.ok) {
      // Never surface Google's error text: it can name the model, the project, or the key.
      console.log(`gemini ${res.status}`, (await res.text()).slice(0, 300));
      return json({ error: res.status === 429 ? 'Scanner is busy — try again shortly.' : 'Scan failed — try again.' },
        res.status === 429 ? 429 : 502, env);
    }

    const data = await res.json();
    const jsonText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    let parsed;
    try { parsed = JSON.parse(jsonText); } catch { parsed = null; }
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      // Don't spend the user's quota on a result they can't use.
      return json({ error: "Couldn't identify any food. Try a clearer photo or add a description." }, 422, env);
    }

    /* Only charge the *user's* free allowance for a scan that produced something
       — the global counter was already reserved above and stays spent either way. */
    await bump(env.PEAK_KV, deviceKey, 172800);

    const u = data.usageMetadata || {};
    console.log(JSON.stringify({
      day, model, in: u.promptTokenCount, out: u.candidatesTokenCount,
      thoughts: u.thoughtsTokenCount, globalUsed: globalUsed + 1
    }));

    return json({
      ...parsed,
      remaining: Math.max(0, perDay - (used + 1))
    }, 200, env);
  },

  /* Cloudflare Cron Trigger — see [triggers] in wrangler.toml. Runs every 15
     minutes; each subscriber only actually gets pushed to once their local
     reminder time falls inside the window that just ran. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminders(env));
  }
};

/* ---------- push subscriptions ---------- */

function subKey(deviceId) { return `sub:${deviceId}`; }

async function handleSubscribe(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400, env); }
  const { deviceId, subscription, tzOffsetMin, reminders } = body || {};
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
    return json({ error: 'Bad request' }, 400, env);
  }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json({ error: 'Invalid subscription' }, 400, env);
  }
  /* The endpoint is a URL the cron will POST to unattended — it has to be a real
     push service, or this route is an open relay. See PUSH_HOSTS. */
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return json({ error: 'Invalid subscription' }, 400, env);
  }
  /* Shape-check the crypto material too. Junk here doesn't reach a browser, it
     just throws inside sendWebPush on every cron run, forever. p256dh is a
     65-byte EC point and auth is 16 bytes, both base64url. */
  const { p256dh, auth } = subscription.keys;
  if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{86,88}$/.test(p256dh) ||
      typeof auth !== 'string' || !/^[A-Za-z0-9_-]{22,24}$/.test(auth)) {
    return json({ error: 'Invalid subscription' }, 400, env);
  }
  if (typeof tzOffsetMin !== 'number' || tzOffsetMin < -720 || tzOffsetMin > 840) {
    return json({ error: 'Invalid timezone offset' }, 400, env);
  }
  const clean = {
    sleep: /^\d{2}:\d{2}$/.test(reminders?.sleep) ? reminders.sleep : null,
    food: /^\d{2}:\d{2}$/.test(reminders?.food) ? reminders.food : null
  };

  // no TTL: a subscription lives until the user turns reminders off, unlike
  // the 48h rate-limit counters (`dev:`/`global:`) elsewhere in this file
  const existing = await env.PEAK_KV.get(subKey(deviceId), 'json');

  /* Creating a record is the expensive direction — it's permanent and the cron
     walks it on every run — and deviceId is client-chosen, so without this a
     loop over random ids grows KV without bound and starves runReminders before
     it reaches anyone real. Updating an existing record is free by comparison
     and stays uncapped, so a user toggling their own reminder times is never
     told to come back tomorrow. */
  if (!existing) {
    const day = utcDay();
    const cap = Number(env.NEW_SUBS_PER_DAY) || NEW_SUBS_PER_DAY;
    const madeToday = Number(await env.PEAK_KV.get(`newsub:${day}`)) || 0;
    if (madeToday >= cap) {
      return json({ error: 'Reminder sign-ups are at capacity today — try again tomorrow.' }, 503, env);
    }
    await bump(env.PEAK_KV, `newsub:${day}`, 172800);
  }

  await env.PEAK_KV.put(subKey(deviceId), JSON.stringify({
    subscription, tzOffsetMin, reminders: clean,
    lastSent: existing?.lastSent || {}
  }));
  return json({ ok: true }, 200, env);
}

async function handleUnsubscribe(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request' }, 400, env); }
  const { deviceId } = body || {};
  // same shape check as /subscribe — a non-string here builds a key like
  // `sub:[object Object]` and silently deletes nothing
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
    return json({ error: 'Bad request' }, 400, env);
  }
  await env.PEAK_KV.delete(subKey(deviceId));
  return json({ ok: true }, 200, env);
}

/* HH:MM in the subscriber's own local time, from a UTC-minutes offset (the
   sign JS's Date.getTimezoneOffset() convention — the same value the client
   already computes, so it just gets forwarded, no timezone name/DB needed). */
function localHHMM(tzOffsetMin) {
  const local = new Date(Date.now() - tzOffsetMin * 60000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}
function minutesSinceMidnight(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
const REMINDER_COPY = {
  sleep: { title: 'Log last night’s sleep', body: 'Takes ten seconds — open Peak to log it.' },
  food: { title: 'Log today’s food', body: 'A quick scan or manual entry keeps the streak going.' }
};

async function runReminders(env) {
  const nowMin = minutesSinceMidnight(new Date().toISOString().slice(11, 16));
  const today = utcDay();
  let cursor;
  do {
    const page = await env.PEAK_KV.list({ prefix: 'sub:', cursor });
    for (const k of page.keys) {
      const rec = await env.PEAK_KV.get(k.name, 'json');
      if (!rec) continue;
      /* Re-checked at send time, not just at /subscribe: records written before
         the endpoint allowlist existed are still in KV, and this is the line
         that actually makes the outbound request. Drop them rather than keep
         POSTing to whatever they name. */
      if (!isAllowedPushEndpoint(rec.subscription?.endpoint)) {
        await env.PEAK_KV.delete(k.name);
        continue;
      }
      let changed = false;
      for (const kind of ['sleep', 'food']) {
        const time = rec.reminders?.[kind];
        if (!time) continue;
        if (rec.lastSent?.[kind] === today) continue;
        const localNow = minutesSinceMidnight(localHHMM(rec.tzOffsetMin));
        // fires once inside the 15-minute window the cron trigger runs in
        if (Math.abs(localNow - minutesSinceMidnight(time)) > 7) continue;
        try {
          const res = await sendWebPush(rec.subscription, REMINDER_COPY[kind], env);
          if (res.status === 404 || res.status === 410) {
            // push service says this endpoint is gone — stop tracking it
            await env.PEAK_KV.delete(k.name);
            changed = false;
            break;
          }
        } catch (err) {
          console.log('push failed', k.name, String(err));
          continue;
        }
        rec.lastSent = { ...rec.lastSent, [kind]: today };
        changed = true;
      }
      if (changed) await env.PEAK_KV.put(k.name, JSON.stringify(rec));
    }
    cursor = page.cursor;
  } while (cursor);
}
