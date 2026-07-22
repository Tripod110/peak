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

async function analyzeMeal({ imageBase64 = null, mediaType = 'image/jpeg', description = '' }) {
  const { apiKey, model } = getSettings();
  if (!apiKey) throw new ApiKeyMissingError();

  const parts = [];
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: mediaType, data: imageBase64 } });
  }
  let text = SCAN_PROMPT;
  if (description) text += `\n\nUser description of the meal: "${description}"`;
  if (!imageBase64) text += '\n\n(No photo — estimate from the description alone.)';
  parts.push({ text });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-flash-latest')}:generateContent`,
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
          maxOutputTokens: 8192
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
    if (res.status === 400 && /api key/i.test(msg)) msg = 'Invalid API key — check Settings.';
    if (res.status === 403) msg = 'Key rejected — check Settings (create a free key at aistudio.google.com/apikey).';
    if (res.status === 429) msg = 'Free-tier limit hit — wait a minute and retry (daily quota resets overnight).';
    if (res.status === 503) msg = 'Gemini is busy — try again shortly.';
    throw new Error(msg);
  }

  const data = await res.json();
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
