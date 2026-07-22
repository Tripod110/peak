/* Forge — Claude API meal analysis (direct browser access; key stays on-device) */

const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short food name, e.g. "Grilled chicken breast"' },
          portion: { type: 'string', description: 'Estimated portion, e.g. "6 oz" or "1 cup"' },
          calories: { type: 'integer' },
          protein_g: { type: 'integer' },
          carbs_g: { type: 'integer' },
          fat_g: { type: 'integer' },
          fiber_g: { type: 'integer' },
          quality_score: { type: 'integer', description: '0-10 nutrient density / whole-food score. 10 = whole unprocessed nutrient-dense food, 5 = mixed, 0 = ultra-processed empty calories.' }
        },
        required: ['name', 'portion', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'quality_score'],
        additionalProperties: false
      }
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: { type: 'string', description: 'One short sentence: assumptions made or a tip. Empty string if none.' }
  },
  required: ['items', 'confidence', 'notes'],
  additionalProperties: false
};

const SCAN_PROMPT = `Analyze this meal and estimate its nutrition. Identify each distinct food item, estimate a realistic portion size from visual cues (plate size, utensils, packaging), and give calories and macros per item. Be realistic, not optimistic — restaurant and home-cooked meals usually have more oil and butter than they appear to. If the user provided a description, trust it for identifying the food but still estimate portions yourself unless quantities are given. quality_score reflects nutrient density and processing level.`;

async function analyzeMeal({ imageBase64 = null, mediaType = 'image/jpeg', description = '' }) {
  const { apiKey, model } = getSettings();
  if (!apiKey) throw new ApiKeyMissingError();

  const content = [];
  if (imageBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } });
  }
  let text = SCAN_PROMPT;
  if (description) text += `\n\nUser description of the meal: "${description}"`;
  if (!imageBase64) text += '\n\n(No photo — estimate from the description alone.)';
  content.push({ type: 'text', text });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: model || 'claude-opus-4-8',
      max_tokens: 1500,
      output_config: { format: { type: 'json_schema', schema: SCAN_SCHEMA } },
      messages: [{ role: 'user', content }]
    })
  });

  if (!res.ok) {
    let msg = 'API error ' + res.status;
    try {
      const err = await res.json();
      if (err?.error?.message) msg = err.error.message;
    } catch { /* keep default */ }
    if (res.status === 401) msg = 'Invalid API key — check Settings.';
    if (res.status === 429) msg = 'Rate limited — wait a moment and try again.';
    if (res.status === 529) msg = 'Claude is overloaded — try again shortly.';
    throw new Error(msg);
  }

  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('The model declined to analyze this image.');
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) throw new Error('Empty response from the model.');
  let parsed;
  try { parsed = JSON.parse(textBlock.text); }
  catch { throw new Error('Could not parse the model response — try again.'); }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Couldn't identify any food. Try a clearer photo or add a description.");
  }
  return parsed;
}

class ApiKeyMissingError extends Error {
  constructor() { super('Add your Anthropic API key in Settings to use AI meal scanning.'); this.isKeyMissing = true; }
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
