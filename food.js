/* Peak — Food tab: fast logging first, browsing behind drill-ins.
   This tab gets opened several times a day, so the top of the screen answers
   "how much room is left?" and the next tap logs something. */

const FOOD_SUBVIEWS = {
  frequents: { title: 'Frequent foods', sub: 'ranked by how often you log them — one tap to add' },
  days: { title: 'Past days', sub: 'the last two weeks at a glance' }
};

function renderFood() {
  const view = App.foodView || 'home';
  return view === 'home' ? renderFoodHome() : renderFoodSub(view);
}

function renderFoodSub(view) {
  const meta = FOOD_SUBVIEWS[view] || { title: '', sub: '' };
  let body = '';
  switch (view) {
    case 'frequents': body = renderFrequentsFull(); break;
    case 'days': body = renderPastDays(); break;
  }
  return navHeader(meta.title, meta.sub, 'food-back') + body;
}

function renderFoodHome() {
  const key = App.foodDay;
  const p = getProfile();
  const t = computeTargets(p);
  const totals = dayTotals(key);
  const items = foodForDay(key);
  const score = nutritionScore(key);
  const isToday = key === todayKey();
  const proteinLeft = Math.round(Math.max(0, t.protein - totals.protein));

  const scorePill = score == null ? '' :
    `<span class="pill ${score >= 70 ? 'good' : score >= 45 ? 'warn' : 'crit'}">◆ ${score}</span>`;

  return `
  <div class="card">
    <div class="day-nav">
      <button class="dn-btn" data-action="food-day" data-dir="-1" aria-label="Previous day">‹</button>
      <div class="dn-label">
        <b>${isToday ? 'Today' : prettyDate(key)}</b>
        ${scorePill}
      </div>
      <button class="dn-btn" data-action="food-day" data-dir="1" ${isToday ? 'disabled' : ''} aria-label="Next day">›</button>
    </div>
    <div class="row mt">
      <div>${ringChart(totals.kcal, t.kcal, { size: 116, color: CHART.blue, unit: 'kcal' })}</div>
      <div class="grow">
        ${macroBar('Protein', totals.protein, t.protein, CHART.blue)}
        ${macroBar('Carbs', totals.carbs, t.carbs, CHART.orange)}
        ${macroBar('Fat', totals.fat, t.fat, CHART.aqua)}
        ${macroBar('Fiber', totals.fiber, t.fiber, CHART.violet)}
      </div>
    </div>
    ${proteinLeft > 0 ? `<div class="chart-note center">${proteinLeft}g protein still to go${isToday ? ' today' : ''}.</div>`
      : totals.kcal > 0 ? `<div class="chart-note center" style="color:${CHART.good}">Protein target hit. That's the one that matters.</div>` : ''}
  </div>

  <div class="card">
    <button class="btn accent" data-action="open-scan">📷 Scan a meal</button>
    <div class="grid-2 mt">
      <button class="btn" data-action="open-manual-food">＋ Manual entry</button>
      <button class="btn" data-action="repeat-last" ${lastLoggedDay() ? '' : 'disabled'}>🔁 Repeat a day</button>
    </div>
    ${frequentChips()}
  </div>

  <div class="card">
    <h2>${isToday ? "Today's food" : 'Logged'}
      <span class="h2-right">${Math.round(totals.kcal)} kcal · ${Math.round(totals.protein)}g protein</span></h2>
    ${items.length === 0
      ? `<div class="muted center" style="padding:14px 0">Nothing logged ${isToday ? 'yet today' : 'this day'}. Scan a meal above.</div>`
      : items.map(e => `
      <div class="list-item">
        <button class="li-main li-tap" data-action="edit-food" data-id="${e.id}" aria-label="Edit ${esc(e.name)}">
          <div class="li-title">${esc(e.name)}${e.source === 'ai' ? ' <span class="tag-ai">AI</span>' : ''}</div>
          <div class="li-sub">${e.time ? fmtTime(e.time) : ''}${e.portion ? ' · ' + esc(e.portion) : ''} · P${Math.round(e.protein)} C${Math.round(e.carbs)} F${Math.round(e.fat)}</div>
        </button>
        <div class="li-val">${Math.round(e.kcal)}<span class="unit"> kcal</span></div>
        <button class="x-btn" data-action="del-food" data-id="${e.id}" aria-label="Delete ${esc(e.name)}">✕</button>
      </div>`).join('')}
    ${items.length ? '<div class="chart-note">Tap any entry to edit its amounts or time.</div>' : ''}
  </div>

  <div class="card">
    <h2>Explore</h2>
    ${foodNavRow('frequents', '🔁', 'Frequent foods', freqCount() ? `${freqCount()} saved` : 'none yet')}
    ${foodNavRow('days', '📅', 'Past days', `${loggedDayCount(14)} of last 14 logged`)}
    <button class="nav-row" data-action="goto-nutrition">
      <span class="nr-ico">📈</span>
      <span class="nr-label">Nutrition trends</span>
      <span class="nr-value">14-day charts</span>
      <span class="nr-chev">›</span>
    </button>
  </div>`;
}

function foodNavRow(view, ico, label, value) {
  return `
  <button class="nav-row" data-action="food-nav" data-view="${view}">
    <span class="nr-ico">${ico}</span>
    <span class="nr-label">${esc(label)}</span>
    <span class="nr-value">${esc(value)}</span>
    <span class="nr-chev">›</span>
  </button>`;
}

function freqCount() { return Store.get('recentFoods', []).length; }
function loggedDayCount(days) {
  let n = 0;
  for (let i = 0; i < days; i++) if (foodForDay(todayKey(-i)).length) n++;
  return n;
}
/* most recent day (other than the one on screen) that has food logged */
function lastLoggedDay() {
  for (let i = 1; i <= 14; i++) {
    const k = todayKey(-i);
    if (k !== App.foodDay && foodForDay(k).length) return k;
  }
  return null;
}

/* The four foods you log MOST — ranked by count, not by recency. A pure
   recency list gets taken over by one-off restaurant meals and evicts the
   breakfast you actually eat every day. */
function frequentChips() {
  const rec = Store.get('recentFoods', []);
  if (!rec.length) return '';
  const top = rec.slice(0, 4);
  return `
  <div class="chips mt">
    ${top.map((r, i) => `
      <button class="chip" data-action="readd-food" data-idx="${i}">
        <span class="chip-name">${esc(r.name)}</span>
        <span class="chip-sub">${Math.round(r.kcal)} kcal · ${Math.round(r.protein)}g P${(r.count || 1) > 1 ? ` · ×${r.count}` : ''}</span>
      </button>`).join('')}
    ${rec.length > 4 ? `<button class="chip chip-more" data-action="food-nav" data-view="frequents">+${rec.length - 4} more</button>` : ''}
  </div>`;
}

/* ---------- subview: all frequent foods ---------- */
function renderFrequentsFull() {
  const rec = Store.get('recentFoods', []);
  if (!rec.length) return emptyNote('Foods you log will collect here automatically, so re-adding them takes one tap.');
  return `
  <div class="card">
    ${rec.map((r, i) => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(r.name)}</div>
          <div class="li-sub">P${Math.round(r.protein)} C${Math.round(r.carbs)} F${Math.round(r.fat)} · logged ${r.count || 1}×${
            typeof r.quality === 'number' ? ` · quality ${r.quality}/10` : ''}</div>
        </div>
        <div class="li-val">${Math.round(r.kcal)}<span class="unit"> kcal</span></div>
        <button class="btn small primary" data-action="readd-food" data-idx="${i}">＋</button>
        <button class="x-btn" data-action="del-recent" data-idx="${i}" aria-label="Remove ${esc(r.name)}">✕</button>
      </div>`).join('')}
    <div class="chart-note">Ordered by how often you log each one. ✕ forgets it. The top four appear as one-tap chips on the Food screen.</div>
  </div>`;
}

/* ---------- subview: past days ---------- */
function renderPastDays() {
  const p = getProfile();
  const t = computeTargets(p);
  const rows = [];
  const kcals = [];
  for (let i = 0; i < 14; i++) {
    const k = todayKey(-i);
    const items = foodForDay(k);
    if (!items.length) continue;
    const d = dayTotals(k);
    kcals.push(d.kcal);
    const sc = nutritionScore(k);
    rows.push(`
      <div class="list-item" data-action="open-day" data-key="${k}" style="cursor:pointer">
        <div class="li-main">
          <div class="li-title">${i === 0 ? 'Today' : prettyDate(k)}</div>
          <div class="li-sub">${Math.round(d.kcal)} kcal · ${Math.round(d.protein)}g protein · ${items.length} item${items.length !== 1 ? 's' : ''}</div>
        </div>
        ${sc != null ? `<span class="pill ${sc >= 70 ? 'good' : sc >= 45 ? 'warn' : 'crit'}">${sc}</span>` : ''}
        <span class="nr-chev">›</span>
      </div>`);
  }
  if (!rows.length) return emptyNote('No days logged in the last two weeks yet.');
  const avgK = Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length);
  return `
  <div class="card">
    <h2>Last 14 days <span class="h2-right">avg ${avgK.toLocaleString()} kcal · target ${t.kcal.toLocaleString()}</span></h2>
    ${rows.join('')}
    <div class="chart-note">Tap a day to open and edit it.</div>
  </div>`;
}

/* ---------- scan modal ---------- */
function openScanModal() {
  const s = getSettings();
  const keyWarning = s.apiKey ? '' :
    `<div class="alert"><span class="a-ico">🔑</span><div class="a-body"><b>One-time setup: add a free key</b>
     Scanning runs on Google Gemini's free tier, so Peak needs your own key — no card, takes a minute. Grab one at aistudio.google.com/apikey and paste it in Settings; it never leaves this device.</div></div>`;
  openModal(`
    <h3>Scan a meal</h3>
    <div class="modal-sub">Snap a photo, or just describe the meal — Gemini estimates calories and macros. Every number is editable before it's logged, so treat it as a fast first draft, not gospel.</div>
    ${keyWarning}
    <input type="file" id="scan-file" accept="image/*" capture="environment" style="display:none">
    <div id="scan-stage">
      <button class="btn accent" data-action="scan-pick">📷 Take / choose photo</button>
      <label>Optional: describe it (helps accuracy)</label>
      <textarea id="scan-desc" rows="2" placeholder="e.g. chipotle bowl, double chicken, no rice"></textarea>
      <button class="btn primary mt" data-action="scan-run">Analyze ${s.apiKey ? '' : '(needs key)'}</button>
      <div class="chart-note center">Scans are free (Gemini free tier — generous daily allowance).</div>
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

/* Every estimate is editable here. Portion guesses are routinely off by a third,
   and "uncheck it or accept it" was the only choice on offer. */
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
      <div class="scan-item">
        <label class="si-head">
          <input type="checkbox" checked data-scan-check="${i}">
          <input class="si-name" value="${esc(it.name)}" data-scan-name="${i}" aria-label="Item name">
        </label>
        <input class="si-portion" value="${esc(it.portion)}" data-scan-portion="${i}" aria-label="Portion">
        <div class="si-macros">
          <label>kcal<input type="number" inputmode="numeric" value="${it.calories}" data-scan-kcal="${i}"></label>
          <label>P<input type="number" inputmode="numeric" value="${it.protein_g}" data-scan-p="${i}"></label>
          <label>C<input type="number" inputmode="numeric" value="${it.carbs_g}" data-scan-c="${i}"></label>
          <label>F<input type="number" inputmode="numeric" value="${it.fat_g}" data-scan-f="${i}"></label>
          <label>Fib<input type="number" inputmode="numeric" value="${it.fiber_g}" data-scan-fib="${i}"></label>
        </div>
      </div>`).join('')}
    </div>
    <div class="chart-note">Estimates are editable — halve a portion or fix a macro before logging.</div>
    <button class="btn primary mt" data-action="scan-log">Log selected</button>
    <button class="btn ghost mt" data-action="scan-again">↻ Rescan</button>`;
}

function logScanItems() {
  const result = App.scanResult;
  if (!result) return;
  const num = (attr, i, fallback) => {
    const el = document.querySelector(`[data-scan-${attr}="${i}"]`);
    const v = el ? Number(el.value) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };
  const str = (attr, i, fallback) => {
    const el = document.querySelector(`[data-scan-${attr}="${i}"]`);
    return el && el.value.trim() ? el.value.trim() : fallback;
  };
  let n = 0;
  [...document.querySelectorAll('[data-scan-check]')].forEach(c => {
    if (!c.checked) return;
    const i = Number(c.dataset.scanCheck);
    const it = result.items[i];
    addFoodEntry(App.foodDay, {
      name: str('name', i, it.name), portion: str('portion', i, it.portion),
      kcal: num('kcal', i, it.calories), protein: num('p', i, it.protein_g),
      carbs: num('c', i, it.carbs_g), fat: num('f', i, it.fat_g),
      fiber: num('fib', i, it.fiber_g), quality: it.quality_score, source: 'ai'
    });
    n++;
  });
  if (!n) { toast('Nothing selected'); return; }
  App.scanImage = null; App.scanResult = null;
  closeModal();
  toast(`Logged ${n} item${n !== 1 ? 's' : ''}`);
  App.render();
}

/* ---------- manual add / edit ---------- */
function openManualFood(prefill) {
  const f = prefill || {};
  const editing = !!f.id;
  const rated = typeof f.quality === 'number';
  openModal(`
    <h3>${editing ? 'Edit entry' : 'Add food'}</h3>
    <label>Name</label>
    <input id="mf-name" value="${esc(f.name || '')}" placeholder="e.g. Chicken & rice">
    <div class="grid-2">
      <div><label>Portion (optional)</label><input id="mf-portion" value="${esc(f.portion || '')}" placeholder="e.g. 6 oz"></div>
      <div><label>Time eaten</label><input id="mf-time" type="time" value="${f.time || nowTime()}"></div>
    </div>
    <div class="grid-2">
      <div><label>Calories</label><input id="mf-kcal" type="number" inputmode="numeric" value="${f.kcal ?? ''}"></div>
      <div><label>Protein (g)</label><input id="mf-protein" type="number" inputmode="numeric" value="${f.protein ?? ''}"></div>
      <div><label>Carbs (g)</label><input id="mf-carbs" type="number" inputmode="numeric" value="${f.carbs ?? ''}"></div>
      <div><label>Fat (g)</label><input id="mf-fat" type="number" inputmode="numeric" value="${f.fat ?? ''}"></div>
    </div>
    <label>Fiber (g, optional)</label>
    <input id="mf-fiber" type="number" inputmode="numeric" value="${f.fiber ?? ''}">
    <label class="check-row">
      <input type="checkbox" id="mf-qrate" ${rated ? 'checked' : ''}>
      <span>Rate food quality (optional)</span>
    </label>
    <div id="mf-qwrap" style="${rated ? '' : 'display:none'}">
      <label>How whole / nutrient-dense? (<span id="mf-qval">${rated ? f.quality : 5}</span>/10)</label>
      <input id="mf-quality" type="range" min="0" max="10" value="${rated ? f.quality : 5}" style="padding:0">
    </div>
    <div class="chart-note">Leave quality unrated and your day is scored on protein and calories alone — never penalised for logging by hand.</div>
    <button class="btn primary mt" data-action="manual-food-save" ${editing ? `data-id="${f.id}"` : ''}>${editing ? 'Save changes' : 'Log it'}</button>
  `);
  const cb = document.getElementById('mf-qrate');
  cb.addEventListener('change', () => {
    document.getElementById('mf-qwrap').style.display = cb.checked ? '' : 'none';
  });
  document.getElementById('mf-quality')?.addEventListener('input', ev => {
    document.getElementById('mf-qval').textContent = ev.target.value;
  });
  if (!editing) setTimeout(() => document.getElementById('mf-name')?.focus(), 60);
}

function saveManualFood(id) {
  const name = document.getElementById('mf-name').value.trim();
  const kcal = Number(document.getElementById('mf-kcal').value);
  if (!name || !(kcal >= 0)) { toast('Name and calories are required'); return; }
  const numOf = elId => Number(document.getElementById(elId).value) || 0;
  const rated = document.getElementById('mf-qrate').checked;
  const entry = {
    name,
    portion: document.getElementById('mf-portion').value.trim(),
    time: document.getElementById('mf-time').value || nowTime(),
    kcal,
    protein: numOf('mf-protein'),
    carbs: numOf('mf-carbs'),
    fat: numOf('mf-fat'),
    fiber: numOf('mf-fiber'),
    quality: rated ? Number(document.getElementById('mf-quality').value) : null
  };
  if (id) {
    updateFoodEntry(App.foodDay, id, entry);
    closeModal(); toast('Entry updated');
  } else {
    addFoodEntry(App.foodDay, { ...entry, source: 'manual' });
    closeModal(); toast('Logged');
  }
  App.render();
}
