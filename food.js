/* Forge — Food tab: log, AI scan, manual add */

function renderFood() {
  const key = App.foodDay;
  const p = getProfile();
  const t = computeTargets(p);
  const totals = dayTotals(key);
  const items = foodForDay(key);
  const score = nutritionScore(key);
  const isToday = key === todayKey();

  const scorePill = score == null ? '' :
    `<span class="pill ${score >= 70 ? 'good' : score >= 45 ? 'warn' : 'crit'}">◆ Quality ${score}</span>`;

  return `
  <div class="card">
    <div class="spread">
      <button class="btn small ghost" data-action="food-day" data-dir="-1">‹</button>
      <div class="center">
        <b>${isToday ? 'Today' : prettyDate(key)}</b><br>
        ${scorePill}
      </div>
      <button class="btn small ghost" data-action="food-day" data-dir="1" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    <div class="row mt" style="justify-content:center">
      ${ringChart(totals.kcal, t.kcal, { color: CHART.blue, unit: 'kcal' })}
    </div>
    <div class="mt">
      ${macroBar('Protein', totals.protein, t.protein, CHART.blue)}
      ${macroBar('Carbs', totals.carbs, t.carbs, CHART.orange)}
      ${macroBar('Fat', totals.fat, t.fat, CHART.aqua)}
    </div>
  </div>

  <div class="grid-2">
    <button class="btn accent" data-action="open-scan">📷 Scan meal</button>
    <button class="btn" data-action="open-manual-food">＋ Add manually</button>
  </div>

  <div class="card mt">
    <h2>Logged <span class="h2-right">${Math.round(totals.kcal)} kcal · ${Math.round(totals.protein)}g protein</span></h2>
    ${items.length === 0 ? `<div class="muted center" style="padding:12px 0">Nothing logged ${isToday ? 'yet today' : 'this day'}.</div>` :
      items.map(e => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(e.name)}</div>
          <div class="li-sub">${e.time ? fmtTime(e.time) : ''}${e.portion ? ' · ' + esc(e.portion) : ''} · P${Math.round(e.protein)} C${Math.round(e.carbs)} F${Math.round(e.fat)}</div>
        </div>
        <div class="li-val">${Math.round(e.kcal)}<span class="unit"> kcal</span></div>
        <button class="x-btn" data-action="del-food" data-id="${e.id}" aria-label="Delete">✕</button>
      </div>`).join('')}
  </div>
  ${renderRecentFoods()}`;
}

function renderRecentFoods() {
  const rec = Store.get('recentFoods', []);
  if (!rec.length) return '';
  return `
  <div class="card">
    <h2>Quick re-add</h2>
    ${rec.slice(0, 8).map((r, i) => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(r.name)}</div>
          <div class="li-sub">P${Math.round(r.protein)} C${Math.round(r.carbs)} F${Math.round(r.fat)}</div>
        </div>
        <div class="li-val">${Math.round(r.kcal)}<span class="unit"> kcal</span></div>
        <button class="btn small" data-action="readd-food" data-idx="${i}">＋</button>
      </div>`).join('')}
  </div>`;
}

/* ---------- scan modal ---------- */
function openScanModal() {
  const s = getSettings();
  const keyWarning = s.apiKey ? '' :
    `<div class="alert crit"><span class="a-ico">⚠</span><div class="a-body"><b>API key needed</b>
     AI scanning uses your Anthropic API key. Add it in Settings — it never leaves this device.</div></div>`;
  openModal(`
    <h3>Scan a meal</h3>
    <div class="modal-sub">Snap a photo, or just describe the meal — Claude estimates calories and macros.</div>
    ${keyWarning}
    <input type="file" id="scan-file" accept="image/*" capture="environment" style="display:none">
    <div id="scan-stage">
      <button class="btn accent" data-action="scan-pick">📷 Take / choose photo</button>
      <label>Optional: describe it (helps accuracy)</label>
      <textarea id="scan-desc" rows="2" placeholder="e.g. chipotle bowl, double chicken, no rice"></textarea>
      <button class="btn primary mt" data-action="scan-run">Analyze ${s.apiKey ? '' : '(needs key)'}</button>
      <div class="chart-note center">A scan costs roughly 1–2¢ with the default model.</div>
    </div>
    <div id="scan-busy" style="display:none" class="center">
      <div class="spinner"></div>
      <div class="muted mt">Analyzing your meal…</div>
    </div>
    <div id="scan-result"></div>
  `);
  const fileInput = document.getElementById('scan-file');
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      App.scanImage = await prepareImage(f);
      const stage = document.getElementById('scan-stage');
      const btn = stage.querySelector('[data-action=scan-pick]');
      btn.insertAdjacentHTML('afterend', `<img class="scan-preview mt" src="${App.scanImage.dataUrl}" alt="meal photo">`);
      btn.textContent = '📷 Retake photo';
    } catch (e) { toast(e.message); }
  });
}

async function runScan() {
  const desc = (document.getElementById('scan-desc')?.value || '').trim();
  if (!App.scanImage && !desc) { toast('Add a photo or a description first'); return; }
  const stage = document.getElementById('scan-stage');
  const busy = document.getElementById('scan-busy');
  stage.style.display = 'none'; busy.style.display = 'block';
  try {
    const result = await analyzeMeal({
      imageBase64: App.scanImage?.base64 || null,
      mediaType: App.scanImage?.mediaType || 'image/jpeg',
      description: desc
    });
    App.scanResult = result;
    busy.style.display = 'none';
    renderScanReview(result);
  } catch (e) {
    busy.style.display = 'none';
    stage.style.display = 'block';
    if (e.isKeyMissing) { closeModal(); openSettingsModal(); }
    toast(e.message);
  }
}

function renderScanReview(result) {
  const box = document.getElementById('scan-result');
  const conf = { high: ['good', 'High confidence'], medium: ['warn', 'Medium confidence'], low: ['crit', 'Low confidence — double-check'] }[result.confidence] || ['warn', ''];
  box.innerHTML = `
    <div class="spread mt">
      <b>Found ${result.items.length} item${result.items.length > 1 ? 's' : ''}</b>
      <span class="pill ${conf[0]}">${conf[1]}</span>
    </div>
    ${result.notes ? `<div class="muted small mt">${esc(result.notes)}</div>` : ''}
    <div id="scan-items">
    ${result.items.map((it, i) => `
      <div class="list-item">
        <input type="checkbox" checked data-scan-check="${i}" style="width:auto">
        <div class="li-main">
          <div class="li-title">${esc(it.name)}</div>
          <div class="li-sub">${esc(it.portion)} · P${it.protein_g} C${it.carbs_g} F${it.fat_g} · quality ${it.quality_score}/10</div>
        </div>
        <div class="li-val">${it.calories}<span class="unit"> kcal</span></div>
      </div>`).join('')}
    </div>
    <button class="btn primary mt" data-action="scan-log">Log selected</button>
    <button class="btn ghost mt" data-action="scan-again">↻ Rescan</button>`;
}

function logScanItems() {
  const result = App.scanResult;
  if (!result) return;
  const checks = [...document.querySelectorAll('[data-scan-check]')];
  let n = 0;
  checks.forEach(c => {
    if (!c.checked) return;
    const it = result.items[Number(c.dataset.scanCheck)];
    addFoodEntry(App.foodDay, {
      name: it.name, portion: it.portion, kcal: it.calories,
      protein: it.protein_g, carbs: it.carbs_g, fat: it.fat_g,
      fiber: it.fiber_g, quality: it.quality_score, source: 'ai'
    });
    n++;
  });
  App.scanImage = null; App.scanResult = null;
  closeModal();
  toast(`Logged ${n} item${n !== 1 ? 's' : ''}`);
  App.render();
}

/* ---------- manual add ---------- */
function openManualFood(prefill) {
  const f = prefill || {};
  openModal(`
    <h3>${f.name ? 'Edit & log' : 'Add food'}</h3>
    <label>Name</label>
    <input id="mf-name" value="${esc(f.name || '')}" placeholder="e.g. Chicken & rice">
    <div class="grid-2">
      <div><label>Calories</label><input id="mf-kcal" type="number" inputmode="numeric" value="${f.kcal ?? ''}"></div>
      <div><label>Protein (g)</label><input id="mf-protein" type="number" inputmode="numeric" value="${f.protein ?? ''}"></div>
      <div><label>Carbs (g)</label><input id="mf-carbs" type="number" inputmode="numeric" value="${f.carbs ?? ''}"></div>
      <div><label>Fat (g)</label><input id="mf-fat" type="number" inputmode="numeric" value="${f.fat ?? ''}"></div>
    </div>
    <label>Quality (how whole / nutrient-dense, 0–10)</label>
    <input id="mf-quality" type="range" min="0" max="10" value="${f.quality ?? 5}" style="padding:0">
    <button class="btn primary mt" data-action="manual-food-save">Log it</button>
  `);
}

function saveManualFood() {
  const name = document.getElementById('mf-name').value.trim();
  const kcal = Number(document.getElementById('mf-kcal').value);
  if (!name || !(kcal >= 0)) { toast('Name and calories are required'); return; }
  addFoodEntry(App.foodDay, {
    name,
    kcal,
    protein: Number(document.getElementById('mf-protein').value) || 0,
    carbs: Number(document.getElementById('mf-carbs').value) || 0,
    fat: Number(document.getElementById('mf-fat').value) || 0,
    fiber: 0,
    quality: Number(document.getElementById('mf-quality').value),
    source: 'manual'
  });
  closeModal(); toast('Logged'); App.render();
}
