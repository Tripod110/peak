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
 */

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

/* KV counters are eventually consistent, so under heavy concurrency these can
   undercount slightly. That's fine for a courtesy limit — the global cap below
   is the thing protecting the bill, and it's set well under budget for exactly
   this reason. Swap to a Durable Object if you ever need exactness. */
async function bump(kv, key, ttlSeconds) {
  const n = Number(await kv.get(key)) || 0;
  await kv.put(key, String(n + 1), { expirationTtl: ttlSeconds });
  return n + 1;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, env);

    const url = new URL(request.url);
    if (url.pathname !== '/scan') return json({ error: 'Not found' }, 404, env);

    // Weak, but it filters casual abuse. Real protection is the caps below.
    const origin = request.headers.get('origin');
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: 'Forbidden' }, 403, env);
    }

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

    // Only count scans that actually produced something.
    await bump(env.PEAK_KV, deviceKey, 172800);
    await bump(env.PEAK_KV, `global:${day}`, 172800);

    const u = data.usageMetadata || {};
    console.log(JSON.stringify({
      day, model, in: u.promptTokenCount, out: u.candidatesTokenCount,
      thoughts: u.thoughtsTokenCount, globalUsed: globalUsed + 1
    }));

    return json({
      ...parsed,
      remaining: Math.max(0, perDay - (used + 1))
    }, 200, env);
  }
};
