/* Peak — app shell, dashboard, onboarding, settings */

const APP_VERSION = 'v6';

/* Size the app to the REAL visible height. CSS viewport units (vh/dvh) misreport
   on some phones — especially after the keyboard closes — leaving dead space
   under the tab bar. window.innerHeight is the ground truth; re-measure on
   every viewport change. */
function setAppHeight() {
  document.body.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 120));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => setTimeout(setAppHeight, 60));
}
setAppHeight();

const App = {
  tab: 'today',
  foodDay: todayKey(),
  activeSession: null,
  scanImage: null,
  scanResult: null,
  grocSection: 'staples',
  ob: {},

  render() {
    const view = document.getElementById('view');
    // keep the reading position when re-rendering the same tab (e.g. adding a set);
    // only jump to the top when actually switching tabs
    const keepScroll = App._renderedTab === App.tab ? view.scrollTop : 0;
    document.getElementById('header-date').textContent =
      new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === App.tab));
    const p = getProfile();
    if (!p) { view.innerHTML = ''; openOnboarding(); return; }
    switch (App.tab) {
      case 'today': view.innerHTML = renderToday(); break;
      case 'food': view.innerHTML = renderFood(); break;
      case 'train': view.innerHTML = renderTrain(); break;
      case 'sleep': view.innerHTML = renderSleep(); break;
      case 'grocery': view.innerHTML = renderGrocery(); break;
    }
    view.scrollTop = keepScroll;
    App._renderedTab = App.tab;
  }
};

/* Mobile keyboards can pan/resize the viewport and leave the app shifted with
   dead space under the tab bar. The window itself never scrolls in our layout,
   so snapping it back whenever the keyboard closes is always safe. */
function snapViewport() {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; // keyboard still open
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
}
document.addEventListener('focusout', () => setTimeout(snapViewport, 60));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => setTimeout(snapViewport, 60));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Today dashboard ---------- */
function renderToday() {
  const p = getProfile();
  const t = computeTargets(p);
  const tk = todayKey();
  const totals = dayTotals(tk);
  const slScore = sleepScore(tk);
  const plateaus = detectPlateaus();
  const tpl = TEMPLATES[p.template];
  const nextIdx = nextDayIndex();
  const todayScores = getWorkouts().filter(s => s.date === tk).map(s => s.score || 0);
  const trainedToday = todayScores.length > 0;
  const todayBest = trainedToday ? Math.max(...todayScores) : 0;

  // 7-day calories
  const weekVals = [];
  for (let i = 6; i >= 0; i--) weekVals.push(dayTotals(todayKey(-i)).kcal);

  // weight trend
  const ws = getWeights().slice(-14);
  const wPoints = ws.map(w => ({ label: prettyDate(w.date).replace(/^\w+, /, ''), value: Math.round(kgToLb(w.kg) * 10) / 10 }));

  const slColor = slScore == null ? CHART.muted : slScore >= 75 ? CHART.good : slScore >= 50 ? CHART.warning : CHART.critical;

  return `
  ${plateaus.slice(0, 2).map(pl => `
    <div class="alert">
      <span class="a-ico">⚠</span>
      <div class="a-body"><b>Plateau: ${esc(pl.name)}</b>${esc(pl.tip)}</div>
    </div>`).join('')}

  <div class="card">
    <div class="row">
      <div>${ringChart(totals.kcal, t.kcal, { size: 118, color: CHART.blue, unit: 'kcal' })}</div>
      <div class="grow">
        ${macroBar('Protein', totals.protein, t.protein, CHART.blue)}
        ${macroBar('Carbs', totals.carbs, t.carbs, CHART.orange)}
        ${macroBar('Fat', totals.fat, t.fat, CHART.aqua)}
      </div>
    </div>
    <div class="spread mt">
      <span class="muted small">Target ${t.kcal.toLocaleString()} kcal · ${GOAL_LABEL[p.goal]}</span>
      <span>${weekBars(weekVals, t.kcal, { w: 110, h: 26 })}</span>
    </div>
  </div>

  <div class="grid-2">
    <div class="card mb0" data-action="go-tab" data-tab="train" style="cursor:pointer">
      <h2>Training</h2>
      ${trainedToday
        ? `<div class="pill good">✓ Trained${todayBest ? ' · ' + todayBest : ''}</div>`
        : `<div style="font-weight:700">${esc(tpl.days[nextIdx].name)}</div><div class="muted small">up next — tap to start</div>`}
    </div>
    <div class="card mb0" data-action="go-tab" data-tab="sleep" style="cursor:pointer">
      <h2>Sleep</h2>
      ${slScore != null
        ? `<div class="hero-num" style="font-size:26px;color:${slColor}">${slScore}<span class="unit"> /100</span></div>`
        : `<div class="muted small">Not logged — tap to log last night</div>`}
    </div>
  </div>

  <div class="card mt">
    <h2>Body weight <span class="h2-right">lb</span></h2>
    ${wPoints.length >= 2 ? lineChart(wPoints, { color: CHART.blue, h: 110, yFmt: v => Math.round(v) }) :
      `<div class="muted small">Log your weight a few times to see the trend.</div>`}
    <div class="row mt">
      <input id="tw-weight" type="number" inputmode="decimal" placeholder="Today's weight (lb)" class="grow">
      <button class="btn small primary" data-action="log-weight">Log</button>
    </div>
  </div>

  ${renderStreaks()}`;
}

function renderStreaks() {
  // protein streak: consecutive days (ending yesterday or today) hitting ≥90% protein target
  const t = computeTargets(getProfile());
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const k = todayKey(-i);
    const tot = dayTotals(k);
    const hit = tot.protein >= t.protein * 0.9;
    if (i === 0 && !hit) continue; // today may be in progress
    if (hit) streak++; else break;
  }
  let logStreak = 0;
  for (let i = 0; i < 60; i++) {
    const k = todayKey(-i);
    const logged = foodForDay(k).length > 0;
    if (i === 0 && !logged) continue;
    if (logged) logStreak++; else break;
  }
  if (!streak && !logStreak) return '';
  return `
  <div class="card">
    <h2>Streaks</h2>
    <div class="row" style="gap:20px">
      <div><div class="hero-num" style="font-size:24px">${logStreak}🔥</div><div class="muted small">days logged</div></div>
      <div><div class="hero-num" style="font-size:24px">${streak}💪</div><div class="muted small">protein target hit</div></div>
    </div>
  </div>`;
}

/* ---------- modal & toast ---------- */
function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal">${html}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function toast(msg) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------- onboarding ---------- */
function openOnboarding(step = 1) {
  const ob = App.ob;
  const dots = [1, 2, 3].map(i => `<span class="${i <= step ? 'on' : ''}"></span>`).join('');
  if (step === 1) {
    openModal(`
      <div class="ob-step-dots">${dots}</div>
      <h3>Welcome to Peak ⛰️</h3>
      <div class="modal-sub">30 seconds of setup — this calibrates your calorie & protein targets.</div>
      <label>Sex (for the metabolism formula)</label>
      <div class="seg" id="ob-sex">
        <button data-v="male" class="${ob.sex !== 'female' ? 'on' : ''}">Male</button>
        <button data-v="female" class="${ob.sex === 'female' ? 'on' : ''}">Female</button>
      </div>
      <div class="grid-2">
        <div><label>Age</label><input id="ob-age" type="number" inputmode="numeric" value="${ob.age || 23}"></div>
        <div><label>Weight (lb)</label><input id="ob-weight" type="number" inputmode="decimal" value="${ob.weightLb || ''}" placeholder="e.g. 170"></div>
        <div><label>Height (ft)</label><input id="ob-ft" type="number" inputmode="numeric" value="${ob.ft || 5}"></div>
        <div><label>Height (in)</label><input id="ob-in" type="number" inputmode="numeric" value="${ob.inch ?? 10}"></div>
      </div>
      <button class="btn primary mt" data-action="ob-next" data-step="1">Continue</button>
    `);
  } else if (step === 2) {
    openModal(`
      <div class="ob-step-dots">${dots}</div>
      <h3>Goal & activity</h3>
      <label>Primary goal right now</label>
      <select id="ob-goal">
        <option value="cut" ${ob.goal === 'cut' ? 'selected' : ''}>Fat loss (−20% calories, high protein)</option>
        <option value="slowcut" ${ob.goal === 'slowcut' || !ob.goal ? 'selected' : ''}>Slow cut (−10%, easier to stick to)</option>
        <option value="recomp" ${ob.goal === 'recomp' ? 'selected' : ''}>Recomp (maintenance, high protein)</option>
        <option value="bulk" ${ob.goal === 'bulk' ? 'selected' : ''}>Lean bulk (+10%)</option>
      </select>
      <label>Activity outside the gym</label>
      <select id="ob-activity">
        <option value="sedentary">Mostly sitting (desk / home)</option>
        <option value="light" selected>Lightly active</option>
        <option value="moderate">On my feet a lot</option>
        <option value="high">Physical job</option>
      </select>
      <label>Gym days per week</label>
      <div class="seg" id="ob-days">
        ${[3, 4, 5, 6].map(d => `<button data-v="${d}" class="${(ob.gymDays || 5) === d ? 'on' : ''}">${d}</button>`).join('')}
      </div>
      <button class="btn primary mt" data-action="ob-next" data-step="2">Continue</button>
    `);
  } else {
    const days = ob.gymDays || 5;
    const tplKey = TEMPLATE_FOR_DAYS[days];
    ob.template = ob.template || tplKey;
    const p = buildProfileFromOb();
    const t = computeTargets(p);
    openModal(`
      <div class="ob-step-dots">${dots}</div>
      <h3>Your plan</h3>
      <div class="modal-sub">Based on your stats — adjust anytime in Settings.</div>
      <div class="grid-2">
        <div class="card mb0 center"><div class="hero-num" style="font-size:26px">${t.kcal.toLocaleString()}</div><div class="muted small">kcal / day</div></div>
        <div class="card mb0 center"><div class="hero-num" style="font-size:26px">${t.protein}g</div><div class="muted small">protein / day</div></div>
      </div>
      <label>Training split (${days} days/week)</label>
      <select id="ob-template">
        ${Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}" ${k === ob.template ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select>
      <button class="btn accent mt" data-action="ob-finish">Start the climb ⛰️</button>
    `);
  }
}

function buildProfileFromOb() {
  const ob = App.ob;
  return {
    sex: ob.sex || 'male',
    age: ob.age || 23,
    weightKg: lbToKg(ob.weightLb || 170),
    heightCm: Math.round(((ob.ft || 5) * 12 + (ob.inch ?? 10)) * 2.54),
    activity: ob.activity || 'light',
    goal: ob.goal || 'slowcut',
    gymDays: ob.gymDays || 5,
    template: ob.template || 'ppl5',
    createdAt: todayKey()
  };
}

/* ---------- settings ---------- */
function openSettingsModal() {
  const s = getSettings();
  const p = getProfile();
  const t = p ? computeTargets(p) : null;
  openModal(`
    <h3>Settings</h3>
    <div class="modal-sub">${p ? `${GOAL_LABEL[p.goal]} · ${t.kcal.toLocaleString()} kcal · ${t.protein}g protein · ${TEMPLATES[p.template].name}` : ''}</div>

    <label>Google Gemini API key (for AI meal scanning — free)</label>
    <div class="key-row">
      <input id="set-key" type="password" value="${esc(s.apiKey)}" placeholder="AIza…" autocomplete="off">
    </div>
    <div class="chart-note">Free: aistudio.google.com/apikey → sign in with Google → Create API key. Stored only on this device.</div>

    <label>Scan model</label>
    <select id="set-model">
      <option value="gemini-flash-latest" ${s.model === 'gemini-flash-latest' ? 'selected' : ''}>Gemini Flash — best quality (free)</option>
      <option value="gemini-flash-lite-latest" ${s.model === 'gemini-flash-lite-latest' ? 'selected' : ''}>Gemini Flash-Lite — more scans/day (free)</option>
    </select>

    <label>Time format</label>
    <div class="seg" id="set-timefmt">
      <button data-v="12" class="${s.timeFmt !== '24' ? 'on' : ''}">12-hour</button>
      <button data-v="24" class="${s.timeFmt === '24' ? 'on' : ''}">24-hour</button>
    </div>

    <details class="adv">
      <summary>Edit profile & goal</summary>
      <label>Goal</label>
      <select id="set-goal">
        ${Object.entries(GOAL_LABEL).map(([k, v]) => `<option value="${k}" ${p?.goal === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <label>Training split</label>
      <select id="set-template">
        ${Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}" ${p?.template === k ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select>
      <div class="grid-2">
        <div><label>Weight (lb)</label><input id="set-weight" type="number" inputmode="decimal" value="${p ? Math.round(kgToLb(p.weightKg)) : ''}"></div>
        <div><label>Gym days/week</label><input id="set-days" type="number" inputmode="numeric" value="${p?.gymDays || 5}"></div>
      </div>
    </details>

    <details class="adv">
      <summary>Backup & data</summary>
      <button class="btn mt" data-action="export-data">⬇ Export data (JSON)</button>
      <label class="btn mt" style="display:flex">⬆ Import backup<input id="import-file" type="file" accept=".json" style="display:none"></label>
      <button class="btn ghost danger mt" data-action="reset-app">Reset everything</button>
    </details>

    <button class="btn primary mt" data-action="save-settings">Save</button>
    <div class="chart-note center mt">Peak ${APP_VERSION}</div>
  `);
  document.getElementById('import-file')?.addEventListener('change', ev => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { Store.importAll(r.result); toast('Backup restored'); closeModal(); App.render(); }
      catch (e) { toast(e.message); }
    };
    r.readAsText(f);
  });
}

function saveSettings() {
  const s = getSettings();
  s.apiKey = document.getElementById('set-key').value.trim();
  s.model = document.getElementById('set-model').value;
  s.timeFmt = document.querySelector('#set-timefmt button.on')?.dataset.v || '12';
  setSettings(s);
  const p = getProfile();
  if (p) {
    const g = document.getElementById('set-goal');
    if (g) {
      p.goal = g.value;
      p.template = document.getElementById('set-template').value;
      const w = Number(document.getElementById('set-weight').value);
      if (w > 50) p.weightKg = lbToKg(w);
      const d = Number(document.getElementById('set-days').value);
      if (d >= 1 && d <= 7) p.gymDays = d;
      setProfile(p);
    }
  }
  closeModal(); toast('Saved'); App.render();
}

/* ---------- global event handling ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  // segmented controls inside modals
  if (el.parentElement?.classList.contains('seg')) { /* handled below */ }

  switch (a) {
    /* nav */
    case 'go-tab': App.tab = el.dataset.tab; App.render(); break;
    case 'open-settings': openSettingsModal(); break;
    case 'save-settings': saveSettings(); break;
    case 'modal-backdrop': if (e.target === el) closeModal(); break;

    /* onboarding */
    case 'ob-next': {
      const step = Number(el.dataset.step);
      if (step === 1) {
        App.ob.age = Number(document.getElementById('ob-age').value) || 23;
        App.ob.weightLb = Number(document.getElementById('ob-weight').value);
        App.ob.ft = Number(document.getElementById('ob-ft').value) || 5;
        App.ob.inch = Number(document.getElementById('ob-in').value) || 0;
        if (!App.ob.weightLb || App.ob.weightLb < 60) { toast('Enter your weight'); return; }
        openOnboarding(2);
      } else if (step === 2) {
        App.ob.goal = document.getElementById('ob-goal').value;
        App.ob.activity = document.getElementById('ob-activity').value;
        openOnboarding(3);
      }
      break;
    }
    case 'ob-finish': {
      App.ob.template = document.getElementById('ob-template').value;
      setProfile(buildProfileFromOb());
      closeModal(); toast('Locked in. Welcome to Peak ⛰️');
      App.render();
      break;
    }

    /* food */
    case 'food-day': App.foodDay = shiftDay(App.foodDay, Number(el.dataset.dir)); App.render(); break;
    case 'open-scan': openScanModal(); break;
    case 'scan-pick': document.getElementById('scan-file').click(); break;
    case 'scan-run': runScan(); break;
    case 'scan-log': logScanItems(); break;
    case 'scan-again': App.scanResult = null; openScanModal(); break;
    case 'open-manual-food': openManualFood(); break;
    case 'manual-food-save': saveManualFood(); break;
    case 'del-food': removeFoodEntry(App.foodDay, el.dataset.id); App.render(); break;
    case 'readd-food': {
      const r = Store.get('recentFoods', [])[Number(el.dataset.idx)];
      if (r) { addFoodEntry(App.foodDay, { ...r, source: 'recent' }); toast('Logged'); App.render(); }
      break;
    }
    case 'del-recent': {
      const rec = Store.get('recentFoods', []);
      rec.splice(Number(el.dataset.idx), 1);
      Store.set('recentFoods', rec);
      App.render();
      break;
    }

    /* train */
    case 'start-workout': startWorkout(Number(el.dataset.idx)); break;
    case 'start-picked': startWorkout(Number(document.getElementById('day-picker').value)); break;
    case 'start-freestyle': startWorkout(0, true); break;
    case 'add-set': readSetInputs(); addSet(Number(el.dataset.xi)); break;
    case 'del-set': {
      readSetInputs();
      App.activeSession.exercises[el.dataset.xi].sets.splice(Number(el.dataset.si), 1);
      App.render(); break;
    }
    case 'add-exercise': readSetInputs(); openAddExercise(); break;
    case 'confirm-add-exercise': {
      const name = document.getElementById('ax-name').value.trim();
      if (!name) { toast('Type a name'); return; }
      App.activeSession.exercises.push({ name, target: '', sets: [] });
      closeModal(); App.render(); break;
    }
    case 'finish-workout': finishWorkout(); break;
    case 'discard-workout':
      if (confirm('Discard this workout?')) { App.activeSession = null; App.render(); }
      break;
    case 'view-workout': viewWorkoutModal(el.dataset.id); break;
    case 'open-cardio': openCardioModal(); break;
    case 'save-cardio': saveCardio(); break;
    case 'delete-workout':
      if (confirm('Delete this session permanently?')) { deleteWorkout(el.dataset.id); closeModal(); App.render(); }
      break;

    /* sleep */
    case 'open-sleep-log': openSleepLog(); break;
    case 'save-sleep': saveSleepEntry(); break;

    /* grocery */
    case 'g-add': groceryAdd(document.getElementById('g-new').value); break;
    case 'g-section': App.grocSection = el.dataset.v; App.render(); break;
    case 'g-staple': groceryAddFromSection(el.dataset.sec || 'staples', Number(el.dataset.idx)); break;
    case 'g-toggle': {
      if (e.target.closest('[data-action=g-del]')) break;
      const list = getGrocery();
      const it = list.find(i => i.id === el.dataset.id);
      if (it) { it.done = !it.done; setGrocery(list); App.render(); }
      break;
    }
    case 'g-del': {
      e.stopPropagation();
      setGrocery(getGrocery().filter(i => i.id !== el.dataset.id));
      App.render(); break;
    }
    case 'g-clear-done': setGrocery(getGrocery().filter(i => !i.done)); App.render(); break;

    /* today */
    case 'log-weight': {
      const lb = Number(document.getElementById('tw-weight').value);
      if (!lb || lb < 60) { toast('Enter a weight in lb'); return; }
      logWeight(lbToKg(lb));
      toast('Weight logged'); App.render(); break;
    }

    /* settings data */
    case 'export-data': {
      const blob = new Blob([Store.exportAll()], { type: 'application/json' });
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(blob);
      a2.download = 'peak-backup-' + todayKey() + '.json';
      a2.click();
      break;
    }
    case 'reset-app':
      if (confirm('Delete ALL Peak data on this device? Export a backup first if you want to keep it.')) {
        Object.keys(localStorage).filter(k => k.startsWith('forge:')).forEach(k => localStorage.removeItem(k));
        location.reload();
      }
      break;
  }
});

/* segmented controls (event delegation) */
document.addEventListener('click', e => {
  const btn = e.target.closest('.seg button');
  if (!btn) return;
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const segId = btn.parentElement.id;
  if (segId === 'ob-sex') App.ob.sex = btn.dataset.v;
  if (segId === 'ob-days') App.ob.gymDays = Number(btn.dataset.v);
});

/* tab bar */
document.getElementById('tabbar').addEventListener('click', e => {
  const b = e.target.closest('.tab');
  if (!b) return;
  App.tab = b.dataset.tab;
  if (App.tab === 'food') App.foodDay = todayKey();
  App.render();
});

/* enter key on grocery input */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'g-new') { groceryAdd(e.target.value); }
});

function shiftDay(key, dir) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dir);
  const nk = dateKey(dt);
  return nk > todayKey() ? todayKey() : nk;
}

App.render();
