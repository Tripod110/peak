/* Peak — Food tab: fast logging first, browsing behind drill-ins.
   This tab gets opened several times a day, so the top of the screen answers
   "how much room is left?" and the next tap logs something. */

const FOOD_SUBVIEWS = {
  frequents: { title: 'Frequent foods', sub: 'ranked by how often you log them — one tap to add' },
  days: { title: 'Past days', sub: 'the last two weeks at a glance' },
  macros: { title: 'Macros', sub: 'protein, carbs, fat and fiber against target' }
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
    case 'macros': body = renderMacroDetail(); break;
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
  const proteinPct = t.protein ? Math.min(100, Math.round(totals.protein / t.protein * 100)) : 0;

  return `
  ${renderFoodHero(key, t, totals, items, isToday)}

  ${tileStrip([
    tile({
      action: 'food-nav', data: { view: 'macros' }, ico: 'egg', label: 'Protein',
      value: Math.round(totals.protein), unit: `/ ${t.protein} g`, pct: proteinPct,
      ariaLabel: `Protein ${Math.round(totals.protein)} of ${t.protein} grams. Open macros`
    }),
    tile({
      action: 'food-nav', data: { view: 'macros' }, ico: 'flame', label: 'Calories',
      value: Math.round(totals.kcal).toLocaleString(), unit: `/ ${t.kcal.toLocaleString()}`,
      sub: kcalStatusLabel(totals.kcal, t.kcal),
      ariaLabel: `${Math.round(totals.kcal)} of ${t.kcal} calories. Open macros`
    }),
    tile({
      action: 'food-score', ico: 'chart', label: 'Score',
      ...(score == null
        ? { empty: true, value: 'No food', sub: 'log a meal', ariaLabel: 'No score yet: nothing logged this day' }
        : { value: score, unit: '/ 100', sub: score >= 70 ? 'solid day' : score >= 45 ? 'room to improve' : 'off target',
            ariaLabel: `Nutrition score ${score} out of 100. What goes into this?` })
    })
  ])}

  <div class="card">
    <h2>Log something else</h2>
    <div class="grid-2">
      <button class="btn" data-action="open-manual-food">${icon('plus')} Manual entry</button>
      <button class="btn" data-action="repeat-last" ${lastLoggedDay() ? '' : 'disabled'}>${icon('refresh')} Repeat a day</button>
    </div>
    ${frequentChips()}
    ${groceryFoodChips()}
  </div>

  <div class="card">
    <h2>${isToday ? "Today's food" : 'Logged'}
      <span class="h2-right">${items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : ''}</span></h2>
    ${items.length === 0
      ? `<div class="muted center" style="padding:14px 0">Nothing logged ${isToday ? 'yet today' : 'this day'}. Scan a meal above.</div>`
      : items.map(e => `
      <div class="list-item">
        <button class="li-main li-tap" data-action="edit-food" data-id="${e.id}" aria-label="Edit ${esc(e.name)}">
          <div class="li-title">${esc(e.name)}${e.source === 'ai' ? ' <span class="tag-ai">AI</span>' : ''} ${dietaryBadgesHtml(e.name)}</div>
          <div class="li-sub">${e.time ? esc(fmtTime(e.time)) : ''}${e.portion ? ' · ' + esc(e.portion) : ''} · P${Math.round(e.protein)} C${Math.round(e.carbs)} F${Math.round(e.fat)}</div>
        </button>
        <div class="li-val">${Math.round(e.kcal)}<span class="unit"> kcal</span></div>
        <button class="x-btn" data-action="del-food" data-id="${e.id}" aria-label="Delete ${esc(e.name)}">✕</button>
      </div>`).join('')}
    ${items.length ? '<div class="chart-note">Tap any entry to edit its amounts or time.</div>' : ''}
  </div>

  <div class="card">
    <h2>Explore</h2>
    ${navRow('food-nav', 'macros', icon('egg'), 'Macros', `${Math.round(totals.carbs)}g carbs · ${Math.round(totals.fat)}g fat`)}
    ${navRow('food-nav', 'frequents', icon('refresh'), 'Frequent foods', freqCount() ? `${freqCount()} saved` : 'none yet')}
    ${navRow('food-nav', 'days', icon('calendar'), 'Past days', `${daySummary().loggedCount} of last 14 logged`)}
    ${navRow('goto-nutrition', null, icon('chart'), 'Nutrition trends', '14-day charts')}
  </div>`;
}

/* The hero says how many kcal are left; the Calories tile under it says only
   which side of the target you're on, so the number is printed once. */
function kcalLeftLabel(eaten, target) {
  const left = Math.round(target - eaten);
  if (left > 0) return `${left.toLocaleString()} kcal left`;
  if (left === 0) return 'Exactly on target';
  return `${Math.abs(left).toLocaleString()} kcal over`;
}
function kcalStatusLabel(eaten, target) {
  const left = Math.round(target - eaten);
  return left > 0 ? 'under target' : left === 0 ? 'on target' : 'over target';
}

/* The day you are looking at, what is left in it, and the fastest way to add
   to it. The ring and the four macro bars moved to the Macros drill-in: on the
   screen you open five times a day, one number matters and it is protein. */
function renderFoodHero(key, t, totals, items, isToday) {
  const proteinLeft = Math.round(Math.max(0, t.protein - totals.protein));
  const nav = `
    <div class="day-nav">
      <button class="dn-btn" data-action="food-day" data-dir="-1" aria-label="Previous day">‹</button>
      <div class="dn-label"><b>${isToday ? 'Today' : esc(prettyDate(key))}</b></div>
      <button class="dn-btn" data-action="food-day" data-dir="1" ${isToday ? 'disabled' : ''} aria-label="Next day">›</button>
    </div>
    ${isToday ? '' : '<div class="center"><button class="link-btn" data-action="food-today">Back to today</button></div>'}`;

  /* A past day is over: say how it went, not what's left of it. */
  if (!isToday) {
    const left = Math.round(t.kcal - totals.kcal);
    return heroCard({
      id: 'food-hero', eyebrowHtml: nav,
      state: items.length && proteinLeft === 0 ? 'done' : '',
      // the gap, not the total — the Calories tile under it already prints what was eaten
      title: !items.length ? 'Nothing logged'
        : left > 0 ? `${left.toLocaleString()} kcal under` : left < 0 ? `${Math.abs(left).toLocaleString()} kcal over` : 'On target',
      meta: items.length
        ? (proteinLeft > 0 ? `Protein finished ${proteinLeft}g short.` : 'Protein target hit.')
        : `If you remember what you ate on ${prettyDate(key)}, add it — trends read better without gaps.`,
      actions: [
        { label: 'Scan a meal', icon: 'camera', action: 'open-scan', cls: 'accent big' },
        ...(items.length ? [] : [{ label: 'Add manually', icon: 'plus', action: 'open-manual-food', cls: 'ghost' }])
      ]
    });
  }

  if (!items.length) {
    return heroCard({
      id: 'food-hero', eyebrowHtml: nav,
      title: `${t.kcal.toLocaleString()} kcal to spend`,
      meta: `${t.protein}g protein today · ${GOAL_LABEL[getProfile().goal]}`,
      actions: [
        { label: 'Scan a meal', icon: 'camera', action: 'open-scan', cls: 'accent big' },
        { label: 'Add manually', icon: 'plus', action: 'open-manual-food', cls: 'ghost' }
      ]
    });
  }

  return heroCard({
    id: 'food-hero', eyebrowHtml: nav,
    state: proteinLeft === 0 ? 'done' : '',
    title: kcalLeftLabel(totals.kcal, t.kcal),
    meta: proteinLeft > 0
      ? `${proteinLeft}g protein still to go — the number that decides whether the training sticks.`
      : 'Protein target hit. That is the one that matters.',
    actions: [{ label: 'Scan a meal', icon: 'camera', action: 'open-scan', cls: 'accent big' }]
  });
}

/* The ring and the four bars, one tap from home. */
function renderMacroDetail() {
  const key = App.foodDay;
  const t = computeTargets(getProfile());
  const totals = dayTotals(key);
  return `
  <div class="card">
    <h2>${key === todayKey() ? 'Today' : esc(prettyDate(key))}
      <span class="h2-right">${Math.round(totals.kcal)} / ${t.kcal.toLocaleString()} kcal</span></h2>
    <div class="row mt">
      <div>${ringChart(totals.kcal, t.kcal, { size: 116, color: CHART.blue, unit: 'kcal' })}</div>
      <div class="grow">
        ${macroBar('Protein', totals.protein, t.protein, CHART.blue)}
        ${macroBar('Carbs', totals.carbs, t.carbs, CHART.orange)}
        ${macroBar('Fat', totals.fat, t.fat, CHART.aqua)}
        ${macroBar('Fiber', totals.fiber, t.fiber, CHART.violet)}
      </div>
    </div>
    <div class="chart-note">Protein and calories are the two that move the needle. Carbs and fat are the remainder of your calorie target once protein is set — treat them as a budget, not a rule.</div>
  </div>`;
}

/* The score is 45/25/30 and used to be an unexplained diamond next to a date. */
function openNutritionScoreSheet() {
  const key = App.foodDay;
  const score = nutritionScore(key);
  openModal(`
    <h3>Nutrition score${score == null ? '' : `: ${score}`}</h3>
    <div class="modal-sub">${key === todayKey() ? 'Today' : esc(prettyDate(key))}</div>
    <div class="sheet-list">
      <div class="sheet-item"><b>45</b> · protein against your target — the one that decides whether training sticks</div>
      <div class="sheet-item"><b>25</b> · calorie accuracy against your goal, over and under both count</div>
      <div class="sheet-item"><b>30</b> · food quality, from the AI scan's rating of what you logged</div>
    </div>
    <div class="chart-note">A day with no quality ratings is scored out of the other 70 and rescaled, so hand-logging is never penalised for lacking a rating it could not have.</div>
    <button class="btn mt" data-action="close-modal">Close</button>
  `);
}

/* Restores for what Food deletes — undoLast() in ui.js dispatches here. */
registerUndo('food', u => restoreFoodEntry(u.key, u.entry));
registerUndo('recent-food', u => {
  const rec = Store.get('recentFoods', []);
  rec.splice(Math.min(u.idx, rec.length), 0, u.entry);
  Store.set('recentFoods', rec);
});

function freqCount() { return Store.get('recentFoods', []).length; }

/* Home used to walk the last fortnight three times per render — once to count
   logged days, once to find a day worth repeating, once to draw Past days. One
   walk, three answers. */
function daySummary(days = 14) {
  const rows = [];
  let loggedCount = 0, lastLogged = null;
  for (let i = 0; i < days; i++) {
    const k = todayKey(-i);
    const items = foodForDay(k);
    if (!items.length) continue;
    loggedCount++;
    rows.push({ key: k, items });
    if (lastLogged === null && i > 0 && k !== App.foodDay) lastLogged = k;
  }
  return { loggedCount, lastLogged, rows };
}
function loggedDayCount(days) { return daySummary(days).loggedCount; }
/* most recent day (other than the one on screen) that has food logged */
function lastLoggedDay() { return daySummary().lastLogged; }

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
        <span class="chip-sub">${Math.round(r.kcal)} kcal · ${Math.round(r.protein)}g P${(r.count || 1) > 1 ? ` · ×${esc(r.count)}` : ''}</span>
      </button>`).join('')}
    ${rec.length > 4 ? `<button class="chip chip-more" data-action="food-nav" data-view="frequents">+${rec.length - 4} more</button>` : ''}
  </div>`;
}

/* Checked-off grocery items land here — name only, no macros to guess at, so
   tapping one opens the manual-entry form pre-filled rather than re-logging
   stale numbers the way a frequent-food chip does. */
function groceryFoodChips() {
  const names = getGroceryFoodCache();
  if (!names.length) return '';
  return `
  <div class="mt">
    <div class="chart-note" style="margin-bottom:6px">From your grocery list — tap to log</div>
    <div class="chips">
      ${names.slice(0, 6).map((n, i) => `
        <button class="chip" data-action="add-from-grocery" data-idx="${i}">
          <span class="chip-name">${esc(n)}</span>
        </button>`).join('')}
    </div>
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
          <div class="li-sub">P${Math.round(r.protein)} C${Math.round(r.carbs)} F${Math.round(r.fat)} · logged ${esc(r.count || 1)}×${
            typeof r.quality === 'number' ? ` · quality ${esc(r.quality)}/10` : ''}</div>
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
  const t = computeTargets(getProfile());
  const kcals = [];
  const rows = daySummary().rows.map(({ key: k, items }) => {
    const d = dayTotals(k);
    kcals.push(d.kcal);
    const sc = nutritionScore(k);
    const label = k === todayKey() ? 'Today' : prettyDate(k);
    return `
      <button class="list-item li-tap" data-action="open-day" data-key="${k}"
        aria-label="${esc(label)}: ${Math.round(d.kcal)} calories, ${Math.round(d.protein)} grams protein. Open it">
        <div class="li-main">
          <div class="li-title">${esc(label)}</div>
          <div class="li-sub">${Math.round(d.kcal)} kcal · ${Math.round(d.protein)}g protein · ${items.length} item${items.length !== 1 ? 's' : ''}</div>
        </div>
        ${sc != null ? `<span class="pill ${sc >= 70 ? 'good' : sc >= 45 ? 'warn' : 'crit'}">${esc(sc)}</span>` : ''}
        <span class="nr-chev" aria-hidden="true">›</span>
      </button>`;
  });
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
  /* Nothing here is carried between openings. App.scanImage used to survive a
     closed sheet, so "Rescan" re-sent a photo you could no longer see, and
     opening Scan the next morning still held last night's dinner. */
  App.scanImage = null;
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
    <div id="scan-busy" style="display:none" class="center" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
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
        ${dietaryBadgesHtml(it.name + ' ' + (result.notes || '')) ? `<div class="mt">${dietaryBadgesHtml(it.name + ' ' + (result.notes || ''))}</div>` : ''}
        <input class="si-portion" value="${esc(it.portion)}" data-scan-portion="${i}" aria-label="Portion">
        <div class="si-macros">
          <label>kcal<input type="number" inputmode="numeric" value="${esc(it.calories)}" data-scan-kcal="${i}"></label>
          <label>P<input type="number" inputmode="numeric" value="${esc(it.protein_g)}" data-scan-p="${i}"></label>
          <label>C<input type="number" inputmode="numeric" value="${esc(it.carbs_g)}" data-scan-c="${i}"></label>
          <label>F<input type="number" inputmode="numeric" value="${esc(it.fat_g)}" data-scan-f="${i}"></label>
          <label>Fib<input type="number" inputmode="numeric" value="${esc(it.fiber_g)}" data-scan-fib="${i}"></label>
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
  const crit = result.items.some(it => dietaryWarnings(it.name).some(w => w.tier === 1));
  toast(crit ? `Logged ${n} item${n !== 1 ? 's' : ''} — check the allergy flags` : `Logged ${n} item${n !== 1 ? 's' : ''}`);
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
      <div><label>Time eaten</label><input id="mf-time" type="time" value="${esc(normTime(f.time) || nowTime())}"></div>
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
  const warns = dietaryWarnings(name);
  const flag = warns.length ? ` — ${warns[0].tier === 1 ? '⚠ allergy flag' : 'flagged'}: ${warns.map(w => w.label).join(', ')}` : '';
  if (id) {
    updateFoodEntry(App.foodDay, id, entry);
    closeModal(); toast('Entry updated' + flag);
  } else {
    addFoodEntry(App.foodDay, { ...entry, source: 'manual' });
    closeModal(); toast('Logged' + flag);
  }
  App.render();
}
