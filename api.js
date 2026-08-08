/* Peak — AI meal analysis via Google Gemini (free tier; key stays on-device) */

/* Gemini responseSchema uses an OpenAPI-style subset: UPPERCASE types, no additionalProperties */
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

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';

/* Ask the key what it can actually run.
   Every hard-coded model id in this app is a guess with an expiry date: Google
   retires models on its own schedule and has 404'd a pinned one before its
   announced shutdown. The key itself is the only authority on what works today,
   so ListModels is what the picker and the fallback chain are built on.
   Returns [{id, label}] best-first, or throws with a usable message. */
async function fetchModelList(apiKey) {
  const res = await fetch(`${GEMINI}/models?pageSize=1000`, { headers: { 'x-goog-api-key': apiKey } });
  if (!res.ok) {
    let msg = 'Could not reach Google (' + res.status + ')';
    try { const e = await res.json(); if (e?.error?.message) msg = e.error.message; } catch { /* keep default */ }
    if (res.status === 400 || res.status === 403) msg = 'That key was rejected — create a free one at aistudio.google.com/apikey.';
    throw new Error(msg);
  }
  const data = await res.json();
  return (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => ({ id: String(m.name || '').replace(/^models\//, ''), display: m.displayName || '' }))
    /* Scanning is a vision job, so text-only, embedding, image-out and realtime
       variants are noise in a picker with one purpose. Previews are excluded for
       the same reason the aliases are: they get swapped and shut down early. */
    .filter(m => /^gemini-[\d.]+-(flash|pro)(-lite)?$/.test(m.id))
    .sort((a, b) => modelRank(a.id) - modelRank(b.id))
    .map(m => ({ id: m.id, label: modelLabel(m) }));
}

/* newest first, and within a generation prefer flash (quality) over lite (volume);
   pro is last because a meal photo does not need it and it burns the free quota */
function modelRank(id) {
  const gen = Number((/^gemini-([\d.]+)/.exec(id) || [])[1] || 0);
  const tier = /pro/.test(id) ? 2 : /lite/.test(id) ? 1 : 0;
  return -gen * 10 + tier;
}
function modelLabel(m) {
  const name = m.display || m.id;
  const hint = /lite/.test(m.id) ? ' — more scans/day'
    : /pro/.test(m.id) ? ' — slowest, uses quota fastest'
    : ' — best quality';
  return name + hint + (RETIRING_MODEL.test(m.id) ? ' (retiring)' : '');
}

/* Refresh the cached picker contents. Never throws — a failed refresh just leaves
   the previous list in place, because a settings screen that errors on open is
   worse than one showing a slightly stale list. */
async function refreshModelList(apiKey) {
  try {
    const list = await fetchModelList(apiKey || getSettings().apiKey);
    if (list.length) { setCachedModelList(list); return list; }
  } catch { /* keep whatever we had */ }
  return null;
}

/* A 404 means the configured model is gone, which is not something the user did
   or can be expected to diagnose — the previous build surfaced Google's raw
   "no longer available" string and left them stuck. Ask the key what it does
   have, switch to the best of it, and say so. Returns the new id, or null. */
async function repointModel(apiKey) {
  const list = await refreshModelList(apiKey);
  if (!list || !list.length) return null;
  const next = list[0].id;
  const s = getSettings();
  if (next === s.model) return null;   // the model list agrees with us; 404 was something else
  s.model = next;
  setSettings(s);
  return next;
}

async function analyzeMeal(opts) {
  const { apiKey } = getSettings();
  if (!apiKey) throw new ApiKeyMissingError();
  try {
    return await scanOnce(opts);
  } catch (e) {
    if (!e.modelGone) throw e;
    const next = await repointModel(apiKey);
    if (!next) throw new Error('This scan model is no longer available, and Google offered no replacement for your key. Check Settings → Scan model.');
    toast(`Scan model retired — switched to ${next}`);
    return await scanOnce(opts);
  }
}

async function scanOnce({ imageBase64 = null, mediaType = 'image/jpeg', description = '' }) {
  const { apiKey, model } = getSettings();

  const parts = [];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mediaType, data: imageBase64 } });
  }
  let text = SCAN_PROMPT;
  if (description) text += `\n\nUser description of the meal: "${description}"`;
  if (!imageBase64) text += '\n\n(No photo — estimate from the description alone.)';
  parts.push({ text });

  const res = await fetch(
    `${GEMINI}/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCAN_SCHEMA,
          maxOutputTokens: 8192,
          /* Thinking is on by default on 2.5 Flash and bills as output tokens.
             Portion estimation is perception, not reasoning — disabling it roughly
             halves the cost per scan with no measurable accuracy loss, and makes
             scans noticeably faster. Flash-Lite ignores this; it doesn't think. */
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    }
  );

  if (!res.ok) {
    let msg = 'API error ' + res.status;
    try {
      const err = await res.json();
      if (err?.error?.message) msg = err.error.message;
    } catch { /* keep default */ }
    /* A retired model reads as a broken key to anyone who hasn't memorised
       Google's deprecation calendar — it fails with a valid key, on a valid
       request, for a reason nothing in the UI mentions. Flag it so analyzeMeal
       can repoint and retry instead of showing Google's copy about "updating
       your code" to someone who did not write any. */
    const modelGone = res.status === 404 || /no longer available|is not found for API version|not supported for generateContent/i.test(msg);
    if (res.status === 400 && /api key/i.test(msg)) msg = 'Invalid API key — check Settings.';
    if (res.status === 403) msg = 'Key rejected — check Settings (create a free key at aistudio.google.com/apikey).';
    if (res.status === 429) msg = 'Free-tier limit hit — wait a minute and retry (daily quota resets overnight).';
    if (res.status === 503) msg = 'Gemini is busy — try again shortly.';
    const e = new Error(msg);
    e.modelGone = modelGone;
    throw e;
  }

  const data = await res.json();
  recordScanUsage(data.usageMetadata, model || DEFAULT_MODEL);
  if (data.promptFeedback?.blockReason) throw new Error('The model declined to analyze this image.');
  const cand = data.candidates?.[0];
  if (!cand) throw new Error('Empty response from the model.');
  if (cand.finishReason === 'SAFETY') throw new Error('The model declined to analyze this image.');
  const jsonText = (cand.content?.parts || []).map(p => p.text || '').join('');
  if (!jsonText) throw new Error('Empty response from the model — try again.');
  let parsed;
  try { parsed = JSON.parse(jsonText); }
  catch { throw new Error('Could not parse the model response — try again.'); }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Couldn't identify any food. Try a clearer photo or add a description.");
  }
  return parsed;
}

/* Running tally of what scanning actually costs, read back in Settings.
   Every cost estimate for the hosted-key proxy is guesswork until this has real
   numbers in it. thoughts should sit at 0 — if it doesn't, thinkingBudget isn't
   taking effect and the output bill is roughly double what it should be. */
function recordScanUsage(u, model) {
  if (!u) return;
  const st = Store.get('scanStats', { scans: 0, in: 0, out: 0, thoughts: 0 });
  st.scans += 1;
  st.in += u.promptTokenCount || 0;
  st.out += u.candidatesTokenCount || 0;
  st.thoughts += u.thoughtsTokenCount || 0;
  st.model = model;
  Store.set('scanStats', st);
}

class ApiKeyMissingError extends Error {
  constructor() { super('Add your free Gemini API key in Settings to use AI meal scanning.'); this.isKeyMissing = true; }
}

/* Downscale an image File to max 1024px long edge, return {base64, mediaType} */
function prepareImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      const scale = Math.min(1, MAX / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}
