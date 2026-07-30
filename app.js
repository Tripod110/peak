/* Peak — app shell, dashboard, onboarding, settings */

const APP_VERSION = 'v29';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/* Shown only when running in a browser tab: the browser's own bottom bar eats
   screen space that the installed app gets back. */
function installBanner() {
  if (isStandalone() || Store.get('installDismissed', false)) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const how = ios
    ? 'tap <b>Share</b> (the square with the arrow) → <b>Add to Home Screen</b>'
    : 'tap the <b>⋮ menu</b> → <b>Add to Home screen</b> / <b>Install app</b>';
  return `<div class="alert" style="border-left-color:var(--blue)"><span class="a-ico">📲</span><div class="a-body">
    <b>You're in the browser — the bottom of your screen belongs to its toolbar.</b>
    Install Peak to get true fullscreen: ${how}, then open it from your home screen.
    <div><button class="btn small ghost" data-action="dismiss-install" style="margin-top:6px">Dismiss</button></div></div></div>`;
}

/* ---------- backup nudge ----------
   Everything lives in localStorage, so a cleared browser or an iOS storage
   eviction takes the whole training history with it. storage.persist() reduces
   that risk but does not remove it, and the only real insurance is a file the
   user actually holds. So: once there is history worth losing, ask — then get
   out of the way for a month. Never on day one, never twice in a week. */

const BACKUP_MIN_FOOD_DAYS = 10;
const BACKUP_MIN_WORKOUTS = 6;
const BACKUP_STALE_DAYS = 30;
const BACKUP_SNOOZE_DAYS = 7;

/* how much history exists, and therefore how much a wipe would cost */
function historyWeight() {
  let foodDays = 0;
  for (let i = 0; i < 90; i++) if (foodForDay(todayKey(-i)).length) foodDays++;
  return { foodDays, workouts: getWorkouts().length };
}

function backupState() {
  const last = Store.get('lastBackupAt', null);
  const snoozed = Store.get('backupSnoozeUntil', null);
  const h = historyWeight();
  const worthLosing = h.foodDays >= BACKUP_MIN_FOOD_DAYS || h.workouts >= BACKUP_MIN_WORKOUTS;
  const staleDays = last ? daysBetween(last, todayKey()) : null;
  const due = worthLosing && (last === null || staleDays >= BACKUP_STALE_DAYS);
  const quiet = snoozed && snoozed > todayKey();
  return { ...h, last, staleDays, due, show: due && !quiet };
}

function backupBanner() {
  const b = backupState();
  if (!b.show) return '';
  const what = [
    b.workouts ? `${b.workouts} session${b.workouts !== 1 ? 's' : ''}` : null,
    b.foodDays ? `${b.foodDays} logged day${b.foodDays !== 1 ? 's' : ''}` : null
  ].filter(Boolean).join(' and ');
  const why = b.last
    ? `Your last backup was ${b.staleDays} days ago.`
    : `You've never exported a backup.`;
  return `<div class="alert" style="border-left-color:var(--warning)"><span class="a-ico">💾</span><div class="a-body">
    <b>Back up your ${what}.</b>
    ${why} Peak keeps everything on this device — clearing your browser data, or iOS reclaiming
    storage, would erase it. The export is one tap and one small file.
    <div class="row" style="margin-top:8px;gap:8px">
      <button class="btn small primary" data-action="export-data">⬇ Export now</button>
      <button class="btn small ghost" data-action="snooze-backup">Not now</button>
    </div></div></div>`;
}

/* The document scrolls naturally (edge-to-edge flow layout). After the keyboard
   closes, snap back to the top so a mobile keyboard can't leave the page panned. */
function snapViewport() {
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; // keyboard still open
  window.scrollTo(0, 0);
}
document.addEventListener('focusout', () => setTimeout(snapViewport, 60));

/* 1s tick: repaint the rest bar and session clock in place — never a full
   re-render, or the user would lose focus mid-typing. */
setInterval(() => {
  if (App.rest) paintRest();
  const s = App.activeSession;
  if (s && s.startedAt) {
    const el = document.getElementById('sess-timer');
    if (el) el.textContent = fmtClock(Math.floor((Date.now() - s.startedAt) / 1000));
  }
}, 1000);

const App = {
  tab: 'today',
  foodDay: todayKey(),
  sleepDay: todayKey(),
  activeSession: null,
  scanImage: null,
  scanResult: null,
  grocSection: 'staples',
  trainView: 'home',
  todayView: 'home',
  foodView: 'home',
  rest: null,
  undo: null,
  ob: {},

  render() {
    const view = document.getElementById('view');
    // the document is the scroll container now; keep the reading position when
    // re-rendering the same tab, jump to top only when switching tabs
    const keepScroll = App._renderedTab === App.tab ? (window.scrollY || 0) : 0;
    document.getElementById('header-date').textContent =
      new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === App.tab));
    const p = getProfile();
    if (!p) { view.innerHTML = ''; openOnboarding(); return; }
    let html = '';
    switch (App.tab) {
      case 'today': html = renderToday(); break;
      case 'food': html = renderFood(); break;
      case 'train': html = renderTrain(); break;
      case 'sleep': html = renderSleep(); break;
      case 'grocery': html = renderGrocery(); break;
    }
    // the backup nudge only ever appears on Today, so it can't interrupt logging
    view.innerHTML = installBanner() + (App.tab === 'today' && App.todayView === 'home' ? backupBanner() : '') + html;
    window.scrollTo(0, keepScroll);
    App._renderedTab = App.tab;
  }
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Today: status dashboard + drill-ins ----------
   Home answers "where do I stand right now, and what should I do next?".
   Trends and history live one tap deeper. */

function navHeader(title, sub, backAction) {
  return `
  <div class="sub-head">
    <button class="back-btn" data-action="${backAction}" aria-label="Back">‹</button>
    <div class="grow">
      <div class="sub-title">${esc(title)}</div>
      ${sub ? `<div class="muted small">${esc(sub)}</div>` : ''}
    </div>
  </div>`;
}

const TODAY_SUBVIEWS = {
  week: { title: 'This week', sub: 'your last 7 days, and the one thing to fix' },
  nutrition: { title: 'Nutrition trends', sub: 'calories and protein over 14 days' },
  weight: { title: 'Body weight', sub: 'the trend that tells you if it is working' },
  streaks: { title: 'Consistency', sub: 'the habit underneath the results' }
};

function renderToday() {
  const view = App.todayView || 'home';
  return view === 'home' ? renderTodayHome() : renderTodaySub(view);
}

function renderTodaySub(view) {
  const meta = TODAY_SUBVIEWS[view] || { title: '', sub: '' };
  let body = '';
  switch (view) {
    case 'week': body = renderWeeklyReview() || emptyNote('Log a few days and your weekly review appears here.'); break;
    case 'nutrition': body = renderNutritionTrends(); break;
    case 'weight': body = renderWeightDetail(); break;
    case 'streaks': body = renderStreakDetail(); break;
  }
  return navHeader(meta.title, meta.sub, 'today-back') + body;
}

/* the single most useful thing to do right now — time-aware, one line */
function todayFocus(p, t, totals, slScore, trainedToday) {
  const hour = new Date().getHours();
  const logged = foodForDay(todayKey()).length;
  const proteinLeft = Math.max(0, t.protein - totals.protein);
  const kcalLeft = t.kcal - totals.kcal;
  const wk = sessionsInDays(7, true);   // lifting sessions only — a walk is not a gym day

  if (!logged && hour >= 10)
    return { ico: '📷', text: 'Nothing logged yet today — scan a meal and the rest of the day builds itself.', action: 'quick-scan' };
  if (slScore == null && hour < 15)
    return { ico: '☾', text: "Last night's sleep isn't logged. Ten seconds, and it explains everything else.", action: 'quick-sleep' };
  if (proteinLeft > 50 && hour >= 15)
    return { ico: '🥩', text: `${Math.round(proteinLeft)}g protein to go — this is the number that decides whether the training sticks.`, action: 'quick-food' };
  if (!trainedToday && wk < p.gymDays)
    return { ico: '🏋', text: `${wk} of ${p.gymDays} lifting sessions this week — ${TEMPLATES[p.template].days[nextDayIndex()].name} is up next.`, action: 'quick-train' };
  if (kcalLeft < -250)
    return { ico: '⚠', text: `${Math.abs(Math.round(kcalLeft))} kcal over target. Not a problem on its own — just keep tomorrow tight.` };
  if (proteinLeft > 25)
    return { ico: '🥩', text: `${Math.round(proteinLeft)}g protein left to hit today's target.`, action: 'quick-food' };
  const stalled = detectPlateaus();
  if (stalled.length)
    return { ico: '⚠', text: `${stalled[0].name} has stalled — Train has the fix ready.`, action: 'quick-train' };
  if (!logged)
    return { ico: '☀', text: 'Fresh day. Log breakfast when you get to it.', action: 'quick-scan' };
  return { ico: '✓', text: 'On track today — calories and protein both landing where they should.' };
}

function renderTodayHome() {
  const p = getProfile();
  const t = computeTargets(p);
  const tk = todayKey();
  const totals = dayTotals(tk);
  const slScore = sleepScore(tk);
  const trainedToday = getWorkouts().some(s => s.date === tk && !s.cardio);
  const todayScores = getWorkouts().filter(s => s.date === tk).map(s => s.score || 0);
  const focus = todayFocus(p, t, totals, slScore, trainedToday);

  const weekVals = [];
  for (let i = 6; i >= 0; i--) weekVals.push(dayTotals(todayKey(-i)).kcal);

  const ws = getWeights();
  const latest = ws.length ? ws[ws.length - 1] : null;
  const latestDisp = latest ? Math.round(toW(latest.kg) * 10) / 10 : null;
  const older = ws.filter(w => daysBetween(w.date, tk) >= 7);
  const wChange = (latest && older.length)
    ? Math.round((toW(latest.kg) - toW(older[older.length - 1].kg)) * 10) / 10 : null;

  const proteinPct = Math.round(totals.protein / t.protein * 100);
  const slColor = slScore == null ? CHART.muted : slScore >= 75 ? CHART.good : slScore >= 50 ? CHART.warning : CHART.critical;
  const weak = weeklyWeakLink(p, t);

  return `
  <div class="card">
    <div class="row">
      <div>${ringChart(totals.kcal, t.kcal, { size: 116, color: CHART.blue, unit: 'kcal' })}</div>
      <div class="grow">
        ${macroBar('Protein', totals.protein, t.protein, CHART.blue)}
        ${macroBar('Carbs', totals.carbs, t.carbs, CHART.orange)}
        ${macroBar('Fat', totals.fat, t.fat, CHART.aqua)}
      </div>
    </div>
    <div class="focus mt">
      <span class="fc-ico">${focus.ico}</span>
      <span class="fc-text">${esc(focus.text)}</span>
      ${focus.action ? `<button class="btn small primary" data-action="${focus.action}">Go</button>` : ''}
    </div>
  </div>

  <div class="card">
    <h2>Quick log</h2>
    <div class="qa-grid">
      <button class="qa" data-action="quick-scan"><span class="qa-i">📷</span>Scan</button>
      <button class="qa" data-action="quick-food"><span class="qa-i">＋</span>Food</button>
      <button class="qa" data-action="quick-train"><span class="qa-i">🏋</span>Train</button>
      <button class="qa" data-action="quick-sleep"><span class="qa-i">☾</span>Sleep</button>
      <button class="qa" data-action="quick-weight"><span class="qa-i">⚖</span>Weight</button>
    </div>
  </div>

  <div class="card">
    <div class="glance">
      <button class="gl" data-action="quick-train">
        <span class="gv" style="color:${trainedToday ? CHART.good : 'var(--ink)'}">${trainedToday ? (todayScores.length ? Math.max(...todayScores) : '✓') : '—'}</span>
        <span class="gl-l">${trainedToday ? 'session score' : 'not trained'}</span></button>
      <button class="gl" data-action="quick-sleep">
        <span class="gv" style="color:${slColor}">${slScore != null ? slScore : '—'}</span>
        <span class="gl-l">sleep score</span></button>
      <button class="gl" data-action="today-nav" data-view="nutrition">
        <span class="gv">${totals.kcal > 0 ? proteinPct + '%' : '—'}</span>
        <span class="gl-l">protein today</span></button>
      <button class="gl" data-action="today-nav" data-view="weight">
        <span class="gv">${latestDisp != null ? latestDisp : '—'}</span>
        <span class="gl-l">body weight</span></button>
    </div>
    <div class="spread mt">
      <span class="muted small">Target ${t.kcal.toLocaleString()} kcal · ${GOAL_LABEL[p.goal]}</span>
      <span>${weekBars(weekVals, t.kcal, { w: 104, h: 24 })}</span>
    </div>
  </div>

  <div class="card">
    <h2>Explore</h2>
    ${todayNavRow('week', '📈', 'This week', weak.short, weak.tone)}
    ${todayNavRow('nutrition', '🍽', 'Nutrition trends', '14-day averages')}
    ${todayNavRow('weight', '⚖', 'Body weight', weightNavValue(p, latestDisp, wChange))}
    ${todayNavRow('streaks', '🔥', 'Consistency', streakSummary())}
  </div>`;
}

function weightNavValue(p, latestDisp, wChange) {
  if (latestDisp == null) return 'not logged yet';
  const u = wUnit();
  if (p.goalWeightKg) {
    const left = Math.round(Math.abs(toW(p.goalWeightKg) - latestDisp) * 10) / 10;
    if (left <= 0.5) return `${latestDisp} ${u} · at goal`;
    return `${latestDisp} ${u} · ${left} ${u} to goal`;
  }
  return `${latestDisp} ${u}${wChange != null ? ` · ${wChange > 0 ? '+' : ''}${wChange} this week` : ''}`;
}

function todayNavRow(view, ico, label, value, tone) {
  const color = tone === 'warn' ? 'var(--warning)' : tone === 'good' ? CHART.good : 'var(--muted)';
  return `
  <button class="nav-row" data-action="today-nav" data-view="${view}">
    <span class="nr-ico">${ico}</span>
    <span class="nr-label">${esc(label)}</span>
    <span class="nr-value" style="color:${color}">${esc(value)}</span>
    <span class="nr-chev">›</span>
  </button>`;
}

/* ---------- shared weakest-link analysis ----------
   One source of truth for "what should he fix this week" — the Today nav row
   shows the short form, the weekly review shows the full sentence. */
function weeklyWeakLink(p, t) {
  let kcalSum = 0, protSum = 0, foodDays = 0;
  for (let i = 0; i < 7; i++) {
    const k = todayKey(-i);
    if (foodForDay(k).length) { foodDays++; const d = dayTotals(k); kcalSum += d.kcal; protSum += d.protein; }
  }
  const sl = sleepAvgDays(7);
  const weekSessions = getWorkouts().filter(s => { const d = daysBetween(s.date, todayKey()); return d >= 0 && d < 7; });
  const lifts = weekSessions.filter(s => !s.cardio);
  const scores = weekSessions.map(s => s.score).filter(v => typeof v === 'number');
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const avgKcal = foodDays ? Math.round(kcalSum / foodDays) : null;
  const avgProt = foodDays ? Math.round(protSum / foodDays) : null;

  const stats = {
    avgKcal, avgProt, avgSleep: sl.avgMin, nights: sl.nights, foodDays,
    lifts: lifts.length, cardio: weekSessions.length - lifts.length,
    sessions: weekSessions.length, avgScore
  };

  if (!foodDays && !sl.nights && !weekSessions.length)
    return { ...stats, key: 'none', ico: '·', short: 'no data yet', tone: '', full: 'Nothing logged in the last 7 days — start anywhere.' };

  /* Candidates are ranked by how far off they actually are, and each has to clear
     a deadband first. The old first-match chain called a 6h58m average a
     bottleneck and a 7h01m average fine, so the week's headline advice flipped
     on two minutes of noise. */
  const cands = [];
  if (sl.avgMin != null && sl.nights >= 4) {
    const sev = (480 - sl.avgMin) / 480;
    if (sev > 0.10) cands.push({ key: 'sleep', sev, ico: '☾', short: 'sleep is low',
      full: `Sleep is your bottleneck at ${fmtDur(sl.avgMin)} a night across ${sl.nights} nights. Pull bedtime 30 min earlier — it feeds every lift more than any program tweak.` });
  } else if (sl.nights > 0 && sl.nights < 4) {
    cands.push({ key: 'sleepdata', sev: 0.12, ico: '☾', short: `only ${sl.nights} nights logged`,
      full: `Only ${sl.nights} of 7 nights logged, so sleep can't be assessed — and it's the cheapest signal here. Backfill the gaps on the Sleep tab.` });
  }
  if (avgProt != null && foodDays >= 3) {
    const sev = (t.protein - avgProt) / t.protein;
    if (sev > 0.12) cands.push({ key: 'protein', sev, ico: '🥩', short: 'protein is low',
      full: `Protein averaged ${avgProt}g against a ${t.protein}g target. Add one protein anchor a day — Grocery → Snacks has the cheap ones.` });
  }
  {
    const sev = (p.gymDays - lifts.length) / p.gymDays;
    if (sev > 0.20) cands.push({ key: 'sessions', sev, ico: '🏋', short: `${lifts.length} of ${p.gymDays} sessions`,
      full: `${lifts.length} of ${p.gymDays} planned lifting sessions${stats.cardio ? ` (cardio doesn't count toward these)` : ''}. Consistency outranks intensity — just get in the gym.` });
  }
  if (avgScore != null) {
    const sev = (70 - avgScore) / 70;
    if (sev > 0.14) cands.push({ key: 'score', sev, ico: '▲', short: `scores averaging ${avgScore}`,
      full: `Session scores averaging ${avgScore}. Finish the prescribed sets — Train shows the exact target for each lift.` });
  }

  if (!cands.length)
    return { ...stats, key: 'ok', ico: '✓', short: 'on track', tone: 'good',
      full: `Everything's tracking. Repeat this week exactly and let progression do the work.` };

  cands.sort((a, b) => b.sev - a.sev);
  // hysteresis: hold the previous verdict unless something is clearly worse
  const prev = Store.get('weakLink', null);
  let pick = cands[0];
  if (prev && prev.key !== pick.key) {
    const held = cands.find(c => c.key === prev.key);
    if (held && pick.sev - held.sev < 0.05) pick = held;
  }
  if (!prev || prev.key !== pick.key) Store.set('weakLink', { key: pick.key });
  return { ...stats, ...pick, tone: 'warn' };
}

function streakSummary() {
  let logStreak = 0;
  for (let i = 0; i < 90; i++) {
    const logged = foodForDay(todayKey(-i)).length > 0;
    if (i === 0 && !logged) continue;
    if (logged) logStreak++; else break;
  }
  if (!logStreak) return 'start a streak today';
  return `${logStreak} day${logStreak !== 1 ? 's' : ''} logged in a row`;
}

/* ---------- Today subview: nutrition trends ---------- */
function renderNutritionTrends() {
  const p = getProfile(), t = computeTargets(p);
  const kcalPts = [], protPts = [];
  let fibSum = 0, fibDays = 0;
  for (let i = 13; i >= 0; i--) {
    const k = todayKey(-i);
    if (!foodForDay(k).length) continue;
    const d = dayTotals(k);
    const label = prettyDate(k).replace(/^\w+, /, '');
    // x is the real day offset, so a three-day gap reads three days wide
    kcalPts.push({ label, value: Math.round(d.kcal), x: 13 - i });
    protPts.push({ label, value: Math.round(d.protein), x: 13 - i });
    fibSum += d.fiber; fibDays++;
  }
  if (kcalPts.length < 2) return emptyNote('Log two or more days and your trends appear here.');

  const avgK = Math.round(kcalPts.reduce((a, b) => a + b.value, 0) / kcalPts.length);
  const avgP = Math.round(protPts.reduce((a, b) => a + b.value, 0) / protPts.length);
  const avgF = fibDays ? Math.round(fibSum / fibDays) : 0;
  const hitDays = protPts.filter(x => x.value >= t.protein * 0.9).length;

  return `
  <div class="card">
    <h2>Calories <span class="h2-right">avg ${avgK.toLocaleString()} · target ${t.kcal.toLocaleString()}</span></h2>
    ${lineChart(kcalPts, { color: CHART.blue, goal: t.kcal, h: 130 })}
    <div class="chart-note">Dashed line is your target. Tap a dot for the day.</div>
  </div>
  <div class="card">
    <h2>Protein <span class="h2-right">avg ${avgP}g · target ${t.protein}g</span></h2>
    ${lineChart(protPts, { color: CHART.orange, goal: t.protein, h: 130, unit: 'g' })}
    <div class="chart-note">${hitDays} of ${protPts.length} logged days hit at least 90% of target.</div>
  </div>
  <div class="card">
    <h2>Fiber <span class="h2-right">avg ${avgF}g · target ${t.fiber}g</span></h2>
    <div class="muted small">${avgF >= t.fiber ? 'On target — good for digestion, satiety and staying full on a cut.'
      : `About ${t.fiber - avgF}g short a day. Beans, oats, berries and frozen veg close this cheaply.`}</div>
  </div>
  <div class="card">
    <h2>Day quality</h2>
    ${(() => {
      const rows = [];
      for (let i = 0; i < 14; i++) {
        const k = todayKey(-i);
        const sc = nutritionScore(k);
        if (sc == null) continue;
        rows.push(`
        <div class="list-item">
          <div class="li-main">
            <div class="li-title">${prettyDate(k)}</div>
            <div class="li-sub">${Math.round(dayTotals(k).kcal)} kcal · ${Math.round(dayTotals(k).protein)}g protein</div>
          </div>
          <span class="pill ${sc >= 70 ? 'good' : sc >= 45 ? 'warn' : 'crit'}">${sc}</span>
        </div>`);
      }
      return rows.length ? rows.join('') : '<div class="muted small">No scored days yet.</div>';
    })()}
    <div class="chart-note">Protein adherence (45) + calorie accuracy (25) + food quality (30, only for items you or the scanner rated).</div>
  </div>`;
}

/* ---------- Today subview: body weight ---------- */
function renderWeightDetail() {
  const p = getProfile();
  const ws = getWeights();
  const u = wUnit();
  const recent = ws.slice(-30);
  const firstDate = recent.length ? recent[0].date : null;
  const pts = recent.map(w => ({
    label: prettyDate(w.date).replace(/^\w+, /, ''),
    value: Math.round(toW(w.kg) * 10) / 10,
    x: daysBetween(firstDate, w.date)
  }));
  const first = pts.length ? pts[0].value : null;
  const last = pts.length ? pts[pts.length - 1].value : null;
  const change = (first != null && pts.length >= 2) ? Math.round((last - first) * 10) / 10 : null;
  // trailing 7-day average vs the 7 before it — smooths daily water noise
  const avgOf = (from, to) => {
    const sel = ws.filter(w => { const d = daysBetween(w.date, todayKey()); return d >= from && d < to; });
    return sel.length ? toW(sel.reduce((a, b) => a + b.kg, 0) / sel.length) : null;
  };
  const recentAvg = avgOf(0, 7), prior = avgOf(7, 14);
  const weekly = (recentAvg != null && prior != null) ? Math.round((recentAvg - prior) * 10) / 10 : null;

  return `
  <div class="card">
    <button class="btn primary" data-action="quick-weight">⚖ Log a weigh-in</button>
    <div class="chart-note center">Missed a morning? The date is editable, so you can backfill it.</div>
  </div>
  ${renderGoalWeight(p, last, weekly)}
  <div class="card">
    <h2>Trend <span class="h2-right">${pts.length} entr${pts.length === 1 ? 'y' : 'ies'}</span></h2>
    ${pts.length >= 2 ? lineChart(pts, { color: CHART.blue, h: 140, unit: ' ' + u,
        goal: p.goalWeightKg ? Math.round(toW(p.goalWeightKg) * 10) / 10 : null })
      : `<div class="muted small">Log at least two weigh-ins to see a trend.</div>`}
    ${weekly != null ? `
      <div class="spread mt" style="border-top:1px solid var(--grid);padding-top:10px">
        <span class="muted small">7-day average vs the week before</span>
        <b style="color:${goalDirectionColor(p, weekly)}">${weekly > 0 ? '+' : ''}${weekly} ${u}</b>
      </div>` : ''}
    ${change != null ? `<div class="chart-note">${change > 0 ? 'Up' : change < 0 ? 'Down' : 'Flat'} ${Math.abs(change)} ${u} across these ${pts.length} entries.</div>` : ''}
    ${weekly != null ? `<div class="chart-note">${weeklyWeightVerdict(p, weekly)}</div>` : ''}
  </div>
  ${ws.length ? `
  <div class="card">
    <h2>Recent weigh-ins</h2>
    ${ws.slice(-10).reverse().map(w => `
      <div class="list-item">
        <div class="li-main"><div class="li-title">${prettyDate(w.date)}</div></div>
        <div class="li-val">${Math.round(toW(w.kg) * 10) / 10}<span class="unit"> ${u}</span></div>
        <button class="x-btn" data-action="del-weight" data-key="${w.date}" aria-label="Delete weigh-in">✕</button>
      </div>`).join('')}
  </div>` : ''}`;
}

/* A cut without a finish line is just an open-ended diet — "X to go" is the
   number that sustains adherence. */
function renderGoalWeight(p, lastDisp, weekly) {
  const u = wUnit();
  if (!p.goalWeightKg) {
    return `<div class="card">
      <div class="spread">
        <div><b>No goal weight set</b><div class="muted small">Gives you a finish line and an ETA.</div></div>
        <button class="btn small" data-action="open-settings">Set one</button>
      </div>
    </div>`;
  }
  const goal = Math.round(toW(p.goalWeightKg) * 10) / 10;
  if (lastDisp == null) return '';
  const remaining = Math.round((goal - lastDisp) * 10) / 10;
  const done = Math.abs(remaining) <= 0.5;
  let eta = '';
  if (!done && weekly != null && Math.abs(weekly) >= 0.15 && Math.sign(weekly) === Math.sign(remaining)) {
    const weeks = Math.max(1, Math.round(Math.abs(remaining / weekly)));
    eta = `About ${weeks} week${weeks !== 1 ? 's' : ''} at your current rate.`;
  } else if (!done && weekly != null) {
    eta = 'Your current rate is not moving you toward it — adjust calories or give it another week of data.';
  }
  return `
  <div class="card">
    <div class="spread">
      <div>
        <div class="hero-num" style="font-size:26px;color:${done ? CHART.good : 'var(--ink)'}">
          ${done ? 'At goal 🎉' : `${Math.abs(remaining)} ${u}`}</div>
        <div class="muted small">${done ? `Goal ${goal} ${u}` : `${remaining < 0 ? 'to lose' : 'to gain'} · goal ${goal} ${u}`}</div>
      </div>
      <div class="muted small center" style="max-width:150px;line-height:1.45">${esc(eta)}</div>
    </div>
  </div>`;
}

function goalDirectionColor(p, weekly) {
  const cutting = p.goal === 'cut' || p.goal === 'slowcut';
  if (cutting) return weekly < 0 ? CHART.good : 'var(--warning)';
  if (p.goal === 'bulk') return weekly > 0 ? CHART.good : 'var(--warning)';
  return Math.abs(weekly) < 0.7 ? CHART.good : 'var(--warning)';
}
function weeklyWeightVerdict(p, weekly) {
  // thresholds are in the user's unit, so scale the lb-derived bands for kg
  const k = isMetric() ? 0.4536 : 1;
  const cutting = p.goal === 'cut' || p.goal === 'slowcut';
  if (cutting) {
    if (weekly < -2 * k) return 'That is faster than ideal — dropping much more than 1% of body weight a week costs muscle. Consider eating a little more.';
    if (weekly < -0.4 * k) return 'Good rate for a cut. Hold this and keep protein high.';
    if (weekly <= 0.3 * k) return 'Roughly flat. If this holds for another week, trim calories slightly.';
    return 'Trending up while cutting — check portions and logging honesty before changing the target.';
  }
  if (p.goal === 'bulk') {
    if (weekly > 1.2 * k) return 'Gaining quickly — some of that will be fat. Ease the surplus a bit.';
    if (weekly > 0.2 * k) return 'Solid lean-gain rate.';
    return 'Not gaining yet. Add roughly 150–200 kcal a day and reassess next week.';
  }
  return Math.abs(weekly) < 0.7 * k
    ? 'Holding steady, which is exactly right for a recomp — let the lifts tell the story.'
    : 'Drifting for a recomp. Nudge calories back toward maintenance.';
}

/* ---------- Today subview: consistency ---------- */
function renderStreakDetail() {
  const p = getProfile(), t = computeTargets(p);
  let logStreak = 0, protStreak = 0;
  for (let i = 0; i < 90; i++) {
    const logged = foodForDay(todayKey(-i)).length > 0;
    if (i === 0 && !logged) continue;
    if (logged) logStreak++; else break;
  }
  for (let i = 0; i < 90; i++) {
    const hit = dayTotals(todayKey(-i)).protein >= t.protein * 0.9;
    if (i === 0 && !hit) continue;
    if (hit) protStreak++; else break;
  }
  let loggedDays = 0, sleepDays = 0;
  const sleepAll = getSleep();
  for (let i = 0; i < 30; i++) {
    if (foodForDay(todayKey(-i)).length) loggedDays++;
    if (sleepAll[todayKey(-i)]) sleepDays++;
  }
  const lifts30 = sessionsInDays(30, true);
  const cardio30 = sessionsInDays(30) - lifts30;

  return `
  <div class="card">
    <div class="grid-4">
      <div class="stat"><div class="sv">${logStreak}</div><div class="sl">day streak</div></div>
      <div class="stat"><div class="sv">${protStreak}</div><div class="sl">protein streak</div></div>
      <div class="stat"><div class="sv">${loggedDays}</div><div class="sl">logged / 30</div></div>
      <div class="stat"><div class="sv">${sleepDays}</div><div class="sl">sleep / 30</div></div>
    </div>
  </div>
  <div class="card">
    <h2>Training calendar <span class="h2-right">last 5 weeks</span></h2>
    ${trainingCalendar(35)}
    <div class="cal-legend">
      <span><i style="background:var(--orange)"></i>lift</span>
      <span><i style="background:var(--blue)"></i>cardio</span>
      <span><i style="background:var(--surface-2)"></i>rest</span>
    </div>
    <div class="chart-note">${lifts30} lifting sessions in the last 30 days against a plan of ${p.gymDays} a week, plus ${cardio30} cardio.</div>
  </div>
  <div class="card">
    <h2>Why this matters</h2>
    <div class="muted small" style="line-height:1.6">Adherence beats optimisation. A merely decent plan followed 90% of the time outperforms a perfect one followed half the time — which is why these counts sit here at all. The streak is not the point; noticing when it breaks is.</div>
  </div>`;
}

function renderWeeklyReview() {
  const p = getProfile();
  const t = computeTargets(p);
  const weak = weeklyWeakLink(p, t);
  if (weak.foodDays < 2 && !weak.nights && !weak.sessions) return '';

  const ws = getWeights().filter(w => daysBetween(w.date, todayKey()) <= 7);
  const wChange = ws.length >= 2 ? Math.round((toW(ws[ws.length - 1].kg) - toW(ws[0].kg)) * 10) / 10 : null;
  const u = wUnit();

  const tile = (val, sub) => `<div><div class="hero-num" style="font-size:20px">${val}</div><div class="muted small">${sub}</div></div>`;
  return `
  <div class="card">
    <h2>Rolling 7 days <span class="h2-right">${weak.foodDays}/7 days logged</span></h2>
    <div class="grid-2">
      ${tile(weak.avgKcal ? weak.avgKcal.toLocaleString() : '—', `avg kcal · target ${t.kcal.toLocaleString()}`)}
      ${tile(weak.avgProt != null ? weak.avgProt + 'g' : '—', `avg protein · target ${t.protein}g`)}
      ${tile(weak.avgSleep ? fmtDur(weak.avgSleep) : '—', `avg sleep · ${weak.nights} night${weak.nights !== 1 ? 's' : ''}`)}
      ${tile(`${weak.lifts}/${p.gymDays}`, weak.avgScore != null ? `lifts · avg score ${weak.avgScore}` : 'lifting sessions')}
    </div>
    ${weak.cardio ? `<div class="muted small mt">Plus ${weak.cardio} cardio session${weak.cardio > 1 ? 's' : ''}, counted separately.</div>` : ''}
    ${wChange != null ? `<div class="muted small mt">Body weight ${wChange > 0 ? '+' : ''}${wChange} ${u} over the week</div>` : ''}
    <div class="alert mt mb0" style="border-left-color:var(--blue)">
      <span class="a-ico">${weak.ico}</span><div class="a-body">${esc(weak.full)}</div>
    </div>
  </div>`;
}

/* Copy a whole previous day's food onto the day on screen — the fastest way to
   log a repeat day of eating, which for most people is most days. */
function openRepeatDayModal() {
  const opts = [];
  for (let i = 1; i <= 14; i++) {
    const k = todayKey(-i);
    const items = foodForDay(k);
    if (!items.length || k === App.foodDay) continue;
    const d = dayTotals(k);
    opts.push(`<option value="${k}">${prettyDate(k)} — ${Math.round(d.kcal)} kcal, ${Math.round(d.protein)}g protein (${items.length} items)</option>`);
  }
  if (!opts.length) { toast('No other logged days to copy yet'); return; }
  openModal(`
    <h3>Repeat a day</h3>
    <div class="modal-sub">Copies every item from that day onto ${App.foodDay === todayKey() ? 'today' : prettyDate(App.foodDay)}, keeping each meal at its original time.</div>
    <label>Which day?</label>
    <select id="rp-day">${opts.join('')}</select>
    <button class="btn primary mt" data-action="confirm-repeat-day">Copy those meals</button>
  `);
}
function confirmRepeatDay() {
  const from = document.getElementById('rp-day').value;
  const items = foodForDay(from);
  if (!items.length) { toast('Nothing to copy'); return; }
  items.forEach(e => addFoodEntry(App.foodDay, {
    name: e.name, portion: e.portion, kcal: e.kcal, protein: e.protein,
    carbs: e.carbs, fat: e.fat, fiber: e.fiber || 0,
    quality: typeof e.quality === 'number' ? e.quality : null,
    time: e.time,                 // keep the meal's own clock time, not "now"
    source: 'repeat'
  }));
  closeModal();
  toast(`Copied ${items.length} item${items.length !== 1 ? 's' : ''}`);
  App.render();
}

function openWeightModal() {
  const ws = getWeights();
  const u = wUnit();
  const last = ws.length ? Math.round(toW(ws[ws.length - 1].kg) * 10) / 10 : '';
  openModal(`
    <h3>Log body weight</h3>
    <div class="modal-sub">${ws.length ? `Last entry ${last} ${u} on ${prettyDate(ws[ws.length - 1].date)}.` : 'First weigh-in — this starts your trend.'}</div>
    <div class="grid-2">
      <div><label>Weight (${u})</label><input id="wm-weight" type="number" inputmode="decimal" value="" placeholder="${last || (isMetric() ? 'e.g. 79' : 'e.g. 174')}"></div>
      <div><label>Date</label><input id="wm-date" type="date" value="${todayKey()}" max="${todayKey()}"></div>
    </div>
    <button class="btn primary mt" data-action="save-weight">Save</button>
    <div class="chart-note center">Weigh in at the same time of day — first thing, after the bathroom, is the most consistent.</div>
  `);
  setTimeout(() => document.getElementById('wm-weight')?.focus(), 60);
}
function saveWeightModal() {
  const v = Number(document.getElementById('wm-weight').value);
  const kg = fromW(v);
  if (!v || kg < 27 || kg > 318) { toast(`Enter a weight in ${wUnit()}`); return; }
  const date = document.getElementById('wm-date').value || todayKey();
  if (date > todayKey()) { toast("Can't log a future date"); return; }
  logWeight(kg, date);
  closeModal(); toast('Weight logged'); App.render();
}

/* ---------- modal & toast ---------- */
function openModal(html, opts = {}) {
  const root = document.getElementById('modal-root');
  // onboarding passes dismissible:false — tapping the backdrop there used to
  // leave a completely blank screen with no way back in
  const attr = opts.dismissible === false ? '' : ' data-action="modal-backdrop"';
  root.innerHTML = `<div class="modal-backdrop"${attr}><div class="modal">${html}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function toast(msg, action) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.appendChild(document.createTextNode(msg));
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = action.label;
    b.dataset.action = action.action;
    el.appendChild(b);
  }
  root.appendChild(el);
  setTimeout(() => el.remove(), action ? 6000 : 2600);
}

/* ---------- onboarding ---------- */
function openOnboarding(step = 1) {
  const ob = App.ob;
  const metric = ob.units === 'metric';
  const dots = [1, 2, 3].map(i => `<span class="${i <= step ? 'on' : ''}"></span>`).join('');
  if (step === 1) {
    openModal(`
      <div class="ob-step-dots">${dots}</div>
      <h3>Welcome to Peak ⛰️</h3>
      <div class="modal-sub">Peak watches every lift and tells you the moment one stops progressing — then deloads it and walks you back up. First, 30 seconds of setup to calibrate your calorie &amp; protein targets. Everything here stays editable in Settings.</div>
      <label>Units</label>
      <div class="seg" id="ob-units">
        <button data-v="imperial" class="${metric ? '' : 'on'}">lb / ft</button>
        <button data-v="metric" class="${metric ? 'on' : ''}">kg / cm</button>
      </div>
      <label>Sex (for the metabolism formula)</label>
      <div class="seg" id="ob-sex">
        <button data-v="male" class="${ob.sex !== 'female' ? 'on' : ''}">Male</button>
        <button data-v="female" class="${ob.sex === 'female' ? 'on' : ''}">Female</button>
      </div>
      <div class="grid-2">
        <div><label>Age</label><input id="ob-age" type="number" inputmode="numeric" value="${ob.age || ''}" placeholder="e.g. 27"></div>
        <div><label>Weight (${metric ? 'kg' : 'lb'})</label><input id="ob-weight" type="number" inputmode="decimal" value="${ob.weight || ''}" placeholder="${metric ? 'e.g. 78' : 'e.g. 170'}"></div>
        ${metric
          ? `<div class="grid-2-span"><label>Height (cm)</label><input id="ob-cm" type="number" inputmode="numeric" value="${ob.cm || ''}" placeholder="e.g. 178"></div>`
          : `<div><label>Height (ft)</label><input id="ob-ft" type="number" inputmode="numeric" value="${ob.ft || ''}" placeholder="5"></div>
             <div><label>Height (in)</label><input id="ob-in" type="number" inputmode="numeric" value="${ob.inch ?? ''}" placeholder="10"></div>`}
      </div>
      <button class="btn primary mt" data-action="ob-next" data-step="1">Continue</button>
    `, { dismissible: false });
  } else if (step === 2) {
    openModal(`
      <div class="ob-step-dots">${dots}</div>
      <h3>Goal & activity</h3>
      <button class="back-link" data-action="ob-back" data-step="1">‹ Back</button>
      <label>Primary goal right now</label>
      <select id="ob-goal">
        ${Object.entries({ cut: 'Fat loss (−20% calories, high protein)', slowcut: 'Slow cut (−10%, easier to stick to)',
          recomp: 'Recomp (maintenance, high protein)', bulk: 'Lean bulk (+10%)' }).map(([k, v]) =>
          `<option value="${k}" ${ob.goal === k || (!ob.goal && k === 'slowcut') ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <label>Goal weight (${metric ? 'kg' : 'lb'}, optional)</label>
      <input id="ob-goalw" type="number" inputmode="decimal" value="${ob.goalW || ''}" placeholder="leave blank to skip">
      <label>Activity outside the gym</label>
      <select id="ob-activity">
        ${Object.entries(ACTIVITY_LABEL).map(([k, v]) =>
          `<option value="${k}" ${ob.activity === k || (!ob.activity && k === 'light') ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <label>Gym days per week</label>
      <div class="seg" id="ob-days">
        ${[3, 4, 5, 6].map(d => `<button data-v="${d}" class="${(ob.gymDays || 5) === d ? 'on' : ''}">${d}</button>`).join('')}
      </div>
      <button class="btn primary mt" data-action="ob-next" data-step="2">Continue</button>
    `, { dismissible: false });
  } else {
    const days = ob.gymDays || 5;
    ob.template = ob.template || TEMPLATE_FOR_DAYS[days];
    const p = buildProfileFromOb();
    const t = computeTargets(p);
    openModal(`
      <div class="ob-step-dots">${dots}</div>
      <h3>Your plan</h3>
      <button class="back-link" data-action="ob-back" data-step="2">‹ Back</button>
      <div class="modal-sub">Based on your stats — all of it stays editable in Settings, including age, height and activity.</div>
      <div class="grid-2">
        <div class="card mb0 center"><div class="hero-num" style="font-size:26px">${t.kcal.toLocaleString()}</div><div class="muted small">kcal / day</div></div>
        <div class="card mb0 center"><div class="hero-num" style="font-size:26px">${t.protein}g</div><div class="muted small">protein / day</div></div>
      </div>
      <label>Training split (${days} days/week)</label>
      <select id="ob-template">
        ${Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}" ${k === ob.template ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select>
      <button class="btn accent mt" data-action="ob-finish">Start the climb ⛰️</button>
    `, { dismissible: false });
  }
}

function readObStep1() {
  const ob = App.ob;
  const metric = ob.units === 'metric';
  ob.age = Number(document.getElementById('ob-age').value) || 0;
  ob.weight = Number(document.getElementById('ob-weight').value) || 0;
  if (metric) ob.cm = Number(document.getElementById('ob-cm').value) || 0;
  else { ob.ft = Number(document.getElementById('ob-ft').value) || 0; ob.inch = Number(document.getElementById('ob-in').value) || 0; }
  if (!ob.age || ob.age < 13 || ob.age > 100) return 'Enter your age';
  if (!ob.weight) return 'Enter your weight';
  const kg = metric ? ob.weight : lbToKg(ob.weight);
  if (kg < 27 || kg > 318) return 'That weight looks off — check it';
  const cm = metric ? ob.cm : (ob.ft * 12 + ob.inch) * 2.54;
  if (!cm || cm < 120 || cm > 230) return 'Enter your height';
  return null;
}

function buildProfileFromOb() {
  const ob = App.ob;
  const metric = ob.units === 'metric';
  const heightCm = metric ? (ob.cm || 178) : Math.round(((ob.ft || 5) * 12 + (ob.inch ?? 10)) * 2.54);
  return {
    sex: ob.sex || 'male',
    age: ob.age || 27,
    weightKg: metric ? (ob.weight || 78) : lbToKg(ob.weight || 170),
    heightCm,
    goalWeightKg: ob.goalW ? (metric ? Number(ob.goalW) : lbToKg(Number(ob.goalW))) : null,
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
  const metric = s.units === 'metric';
  const u = metric ? 'kg' : 'lb';
  const ht = p ? cmToFtIn(p.heightCm) : { ft: 5, inch: 10 };
  const bk = backupState();
  openModal(`
    <h3>Settings</h3>
    <div class="modal-sub">${p ? `${GOAL_LABEL[p.goal]} · ${t.kcal.toLocaleString()} kcal · ${t.protein}g protein · ${TEMPLATES[p.template].name}` : ''}</div>

    <label>Units</label>
    <div class="seg" id="set-units">
      <button data-v="imperial" class="${metric ? '' : 'on'}">lb / ft</button>
      <button data-v="metric" class="${metric ? 'on' : ''}">kg / cm</button>
    </div>
    <div class="chart-note">Everything is stored metric, so switching back and forth never changes your data.</div>

    <label>Google Gemini API key (for AI meal scanning — free)</label>
    <div class="key-row">
      <input id="set-key" type="password" value="${esc(s.apiKey)}" placeholder="AIza…" autocomplete="off">
    </div>
    <div class="chart-note">Free: aistudio.google.com/apikey → sign in with Google → Create API key. Stored only on this device.</div>

    <label>Scan model</label>
    <select id="set-model">
      <option value="gemini-2.5-flash" ${s.model === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash — best quality (free)</option>
      <option value="gemini-2.5-flash-lite" ${s.model === 'gemini-2.5-flash-lite' ? 'selected' : ''}>Gemini 2.5 Flash-Lite — more scans/day (free)</option>
    </select>

    <div class="grid-2">
      <div><label>Default rest (seconds)</label><input id="set-rest" type="number" inputmode="numeric" value="${s.restSec}"></div>
      <div><label>Barbell weight (${u})</label><input id="set-bar" type="number" inputmode="decimal" value="${Math.round(toW(s.barKg) * 10) / 10}"></div>
    </div>
    <div class="chart-note">Rest scales per lift: compounds get 1.5×, isolations 0.6×.</div>

    <label>Time format</label>
    <div class="seg" id="set-timefmt">
      <button data-v="12" class="${s.timeFmt !== '24' ? 'on' : ''}">12-hour</button>
      <button data-v="24" class="${s.timeFmt === '24' ? 'on' : ''}">24-hour</button>
    </div>

    <details class="adv" open>
      <summary>You & your goal</summary>
      <label>Sex (for the metabolism formula)</label>
      <div class="seg" id="set-sex">
        <button data-v="male" class="${p?.sex !== 'female' ? 'on' : ''}">Male</button>
        <button data-v="female" class="${p?.sex === 'female' ? 'on' : ''}">Female</button>
      </div>
      <div class="grid-2">
        <div><label>Age</label><input id="set-age" type="number" inputmode="numeric" value="${p?.age ?? ''}"></div>
        <div><label>Weight (${u})</label><input id="set-weight" type="number" inputmode="decimal" value="${p ? Math.round(toW(p.weightKg) * 10) / 10 : ''}"></div>
        ${metric
          ? `<div class="grid-2-span"><label>Height (cm)</label><input id="set-cm" type="number" inputmode="numeric" value="${p?.heightCm ?? ''}"></div>`
          : `<div><label>Height (ft)</label><input id="set-ft" type="number" inputmode="numeric" value="${ht.ft}"></div>
             <div><label>Height (in)</label><input id="set-in" type="number" inputmode="numeric" value="${ht.inch}"></div>`}
      </div>
      <label>Activity outside the gym</label>
      <select id="set-activity">
        ${Object.entries(ACTIVITY_LABEL).map(([k, v]) => `<option value="${k}" ${p?.activity === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <div class="chart-note">This is the biggest single lever on your calorie target — sedentary to physical job is a 40%+ swing. Change it if you picked wrong.</div>
      <label>Goal</label>
      <select id="set-goal">
        ${Object.entries(GOAL_LABEL).map(([k, v]) => `<option value="${k}" ${p?.goal === k ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
      <div class="grid-2">
        <div><label>Goal weight (${u}, optional)</label><input id="set-goalw" type="number" inputmode="decimal" value="${p?.goalWeightKg ? Math.round(toW(p.goalWeightKg) * 10) / 10 : ''}" placeholder="blank = none"></div>
        <div><label>Gym days/week</label><input id="set-days" type="number" inputmode="numeric" value="${p?.gymDays || 5}"></div>
      </div>
      <label>Training split</label>
      <select id="set-template">
        ${Object.entries(TEMPLATES).map(([k, v]) => `<option value="${k}" ${p?.template === k ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select>
    </details>

    <details class="adv" ${bk.due ? 'open' : ''}>
      <summary>Backup & data${bk.due ? ' <span class="pill warn">due</span>' : ''}</summary>
      <div class="spread" style="margin-top:8px">
        <span class="muted small">Last backup</span>
        <b class="small" style="color:${bk.last ? (bk.staleDays >= BACKUP_STALE_DAYS ? 'var(--warning)' : CHART.good) : 'var(--warning)'}">
          ${bk.last ? `${prettyDate(bk.last)}${bk.staleDays > 0 ? ` · ${bk.staleDays}d ago` : ' · today'}` : 'never'}</b>
      </div>
      <button class="btn mt" data-action="export-data">⬇ Export data (JSON)</button>
      <label class="btn mt" style="display:flex">⬆ Import backup<input id="import-file" type="file" accept=".json" style="display:none"></label>
      <div class="chart-note">Importing replaces everything on this device with the contents of the backup.</div>
      <button class="btn ghost danger mt" data-action="reset-app">Reset everything</button>
      <div class="chart-note">Peak stores everything on this device only. Clearing your browser data erases your history — export a backup now and then.</div>
    </details>

    <details class="adv">
      <summary>Feedback &amp; bugs</summary>
      <div class="chart-note">Peak is early and built by one person. If something is broken, confusing, or missing, telling me is the fastest way to get it fixed.</div>
      <a class="btn mt" style="text-decoration:none;color:inherit"
         href="https://github.com/tripod110/peak/issues/new" target="_blank" rel="noopener">💬 Report a bug or request a feature</a>
      ${scanStatsNote()}
    </details>

    <button class="btn primary mt" data-action="save-settings">Save</button>
    <div class="chart-note center mt">Peak ${APP_VERSION} · ${isStandalone() ? 'installed app' : 'browser tab'} · viewport ${window.innerHeight}px${screen.height ? ' of ' + screen.height + 'px screen' : ''}</div>
  `);
  document.getElementById('import-file')?.addEventListener('change', ev => {
    const f = ev.target.files[0];
    if (!f) return;
    if (!confirm(`Restore "${f.name}"?\n\nThis REPLACES all Peak data on this device. Export a backup first if you might want the current data back.`)) {
      ev.target.value = '';
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      try {
        Store.importAll(r.result);
        App.activeSession = null; App.rest = null; paintRest();
        toast('Backup restored'); closeModal(); App.render();
      } catch (e) { toast(e.message); }
    };
    r.readAsText(f);
  });
}

function saveSettings() {
  const s = getSettings();
  const prevUnits = s.units;
  s.units = document.querySelector('#set-units button.on')?.dataset.v || 'imperial';
  s.apiKey = document.getElementById('set-key').value.trim();
  s.model = document.getElementById('set-model').value;
  s.timeFmt = document.querySelector('#set-timefmt button.on')?.dataset.v || '12';
  const rest = Number(document.getElementById('set-rest')?.value);
  if (rest >= 15 && rest <= 600) s.restSec = rest;
  // the bar field was shown in the units that were active when the modal opened
  const barIn = Number(document.getElementById('set-bar')?.value);
  if (barIn > 0) {
    const barKg = prevUnits === 'metric' ? barIn : lbToKg(barIn);
    if (barKg > 0 && barKg <= 50) s.barKg = barKg;
  }
  setSettings(s);

  const p = getProfile();
  if (p) {
    const metric = prevUnits === 'metric';
    p.sex = document.querySelector('#set-sex button.on')?.dataset.v || p.sex;
    const age = Number(document.getElementById('set-age').value);
    if (age >= 13 && age <= 100) p.age = age;
    const w = Number(document.getElementById('set-weight').value);
    const wKg = metric ? w : lbToKg(w);
    if (wKg >= 27 && wKg <= 318) p.weightKg = wKg;
    if (metric) {
      const cm = Number(document.getElementById('set-cm').value);
      if (cm >= 120 && cm <= 230) p.heightCm = cm;
    } else {
      const ft = Number(document.getElementById('set-ft').value);
      const inch = Number(document.getElementById('set-in').value) || 0;
      const cm = Math.round((ft * 12 + inch) * 2.54);
      if (cm >= 120 && cm <= 230) p.heightCm = cm;
    }
    p.activity = document.getElementById('set-activity').value || p.activity;
    p.goal = document.getElementById('set-goal').value;
    p.template = document.getElementById('set-template').value;
    const gw = Number(document.getElementById('set-goalw').value);
    p.goalWeightKg = gw > 0 ? (metric ? gw : lbToKg(gw)) : null;
    const d = Number(document.getElementById('set-days').value);
    if (d >= 1 && d <= 7) p.gymDays = d;
    setProfile(p);
  }
  closeModal(); toast('Saved'); App.render();
}

/* ---------- global event handling ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  switch (a) {
    /* nav */
    case 'go-tab': readSetInputs(); App.tab = el.dataset.tab; if (App.tab === 'train') App.trainView = 'home'; App.render(); break;
    case 'open-settings': openSettingsModal(); break;
    case 'dismiss-install': Store.set('installDismissed', true); App.render(); break;
    case 'save-settings': saveSettings(); break;
    case 'modal-backdrop': if (e.target === el) closeModal(); break;
    case 'undo-last': undoLast(); break;

    /* onboarding */
    case 'ob-next': {
      const step = Number(el.dataset.step);
      if (step === 1) {
        const err = readObStep1();
        if (err) { toast(err); return; }
        openOnboarding(2);
      } else if (step === 2) {
        App.ob.goal = document.getElementById('ob-goal').value;
        App.ob.activity = document.getElementById('ob-activity').value;
        App.ob.goalW = document.getElementById('ob-goalw').value.trim();
        openOnboarding(3);
      }
      break;
    }
    case 'ob-back': openOnboarding(Number(el.dataset.step)); break;
    case 'ob-finish': {
      App.ob.template = document.getElementById('ob-template').value;
      const st = getSettings();
      st.units = App.ob.units || 'imperial';
      setSettings(st);
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
    case 'edit-food': openManualFood(findFoodEntry(App.foodDay, el.dataset.id)); break;
    case 'manual-food-save': saveManualFood(el.dataset.id); break;
    case 'del-food': {
      const entry = findFoodEntry(App.foodDay, el.dataset.id);
      if (!entry) break;
      App.undo = { kind: 'food', key: App.foodDay, entry };
      removeFoodEntry(App.foodDay, el.dataset.id);
      App.render();
      toast(`Removed ${entry.name}`, { label: 'Undo', action: 'undo-last' });
      break;
    }
    case 'readd-food': {
      const r = Store.get('recentFoods', [])[Number(el.dataset.idx)];
      if (r) {
        addFoodEntry(App.foodDay, {
          name: r.name, kcal: r.kcal, protein: r.protein, carbs: r.carbs,
          fat: r.fat, fiber: r.fiber || 0, quality: typeof r.quality === 'number' ? r.quality : null,
          source: 'recent'
        });
        toast('Logged'); App.render();
      }
      break;
    }
    case 'del-recent': {
      const rec = Store.get('recentFoods', []);
      rec.splice(Number(el.dataset.idx), 1);
      Store.set('recentFoods', rec);
      App.render();
      break;
    }
    case 'food-nav': App.foodView = el.dataset.view; App._renderedTab = null; App.render(); break;
    case 'food-back': App.foodView = 'home'; App._renderedTab = null; App.render(); break;
    case 'open-day': App.foodDay = el.dataset.key; App.foodView = 'home'; App._renderedTab = null; App.render(); break;
    case 'goto-nutrition': App.tab = 'today'; App.todayView = 'nutrition'; App._renderedTab = null; App.render(); break;
    case 'repeat-last': openRepeatDayModal(); break;
    case 'confirm-repeat-day': confirmRepeatDay(); break;

    /* today */
    case 'today-nav': App.todayView = el.dataset.view; App._renderedTab = null; App.render(); break;
    case 'today-back': App.todayView = 'home'; App._renderedTab = null; App.render(); break;
    case 'quick-scan': App.tab = 'food'; App.foodDay = todayKey(); App.render(); openScanModal(); break;
    case 'quick-food': App.tab = 'food'; App.foodDay = todayKey(); App.render(); openManualFood(); break;
    case 'quick-train': App.tab = 'train'; App.trainView = 'home'; App.render(); break;
    case 'quick-sleep': App.tab = 'sleep'; App.sleepDay = todayKey(); App.render(); openSleepLog(); break;
    case 'quick-weight': openWeightModal(); break;
    case 'save-weight': saveWeightModal(); break;
    case 'del-weight':
      if (confirm('Delete this weigh-in?')) { removeWeight(el.dataset.key); App.render(); }
      break;

    /* train */
    case 'train-nav': App.trainView = el.dataset.view; App._renderedTab = null; App.render(); break;
    case 'train-back': App.trainView = 'home'; App._renderedTab = null; App.render(); break;
    case 'start-workout': startWorkout(Number(el.dataset.idx)); break;
    case 'start-picked': startWorkout(Number(document.getElementById('day-picker').value)); break;
    case 'start-freestyle': startWorkout(0, true); break;
    case 'add-set': readSetInputs(); addSet(Number(el.dataset.xi)); break;
    case 'add-warmup': readSetInputs(); addWarmup(Number(el.dataset.xi)); break;
    case 'set-done': toggleSetDone(Number(el.dataset.xi), Number(el.dataset.si)); break;
    case 'set-type': cycleSetType(Number(el.dataset.xi), Number(el.dataset.si)); break;
    case 'rest-add': if (App.rest) { App.rest.endsAt += 30000; App.rest.total += 30; App.rest.beeped = false; persistSession(); paintRest(); } break;
    case 'rest-skip': App.rest = null; persistSession(); paintRest(); break;
    case 'del-set': deleteSet(Number(el.dataset.xi), Number(el.dataset.si)); break;
    case 'del-exercise': deleteExercise(Number(el.dataset.xi)); break;
    case 'add-exercise': readSetInputs(); openAddExercise(); break;
    case 'confirm-add-exercise': {
      const name = document.getElementById('ax-name').value.trim();
      if (!name) { toast('Type a name'); return; }
      const target = findTargetFor(name);
      App.activeSession.exercises.push({
        name, target,
        sets: target ? plannedSetsFor(name, target) : []
      });
      persistSession();
      closeModal(); App.render(); break;
    }
    case 'finish-workout': finishWorkout(); break;
    case 'discard-workout':
      if (confirm('Discard this workout? Every set you logged in it will be lost.')) {
        App.activeSession = null; App.rest = null; App.undo = null;
        clearPersistedSession(); paintRest(); App.render();
      }
      break;
    case 'view-workout': viewWorkoutModal(el.dataset.id); break;
    case 'open-cardio': openCardioModal(); break;
    case 'save-cardio': saveCardio(); break;
    case 'delete-workout':
      if (confirm('Delete this session permanently?')) { deleteWorkout(el.dataset.id); closeModal(); App.render(); }
      break;
    case 'tag-muscle': openTagMuscleModal(el.dataset.name); break;
    case 'save-muscle-tag': saveMuscleTag(el.dataset.name); break;

    /* sleep */
    case 'open-sleep-log': openSleepLog(); break;
    case 'save-sleep': saveSleepEntry(); break;
    case 'sleep-day': App.sleepDay = shiftDay(App.sleepDay, Number(el.dataset.dir)); App.render(); break;
    case 'open-night': App.sleepDay = el.dataset.key; App.render(); openSleepLog(); break;
    case 'del-sleep':
      if (confirm('Delete this night?')) { removeSleepEntry(el.dataset.key); App.render(); }
      break;

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

    /* settings data */
    case 'export-data': {
      const blob = new Blob([Store.exportAll()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = url;
      a2.download = 'peak-backup-' + todayKey() + '.json';
      a2.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      // remember it, so the nudge can stand down for a month
      Store.set('lastBackupAt', todayKey());
      Store.remove('backupSnoozeUntil');
      toast('Backup saved to your downloads');
      App.render();
      break;
    }
    case 'snooze-backup':
      Store.set('backupSnoozeUntil', todayKey(BACKUP_SNOOZE_DAYS));
      App.render();
      break;
    case 'reset-app':
      if (confirm('Delete ALL Peak data on this device? Export a backup first if you want to keep it.')) {
        Store.wipeAll();
        location.reload();
      }
      break;
  }
});

/* segmented controls (event delegation) */
document.addEventListener('click', e => {
  const btn = e.target.closest('.seg button, .mus-grid button');
  if (!btn) return;
  const multi = btn.parentElement.classList.contains('mus-grid');
  if (multi) { btn.classList.toggle('on'); return; }
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const segId = btn.parentElement.id;
  if (segId === 'ob-sex') App.ob.sex = btn.dataset.v;
  if (segId === 'ob-days') App.ob.gymDays = Number(btn.dataset.v);
  if (segId === 'ob-units') { App.ob.units = btn.dataset.v; openOnboarding(1); }
  if (segId === 'set-units') {
    // re-open so every field re-labels in the newly chosen unit
    const s = getSettings(); s.units = btn.dataset.v; setSettings(s);
    openSettingsModal();
  }
});

/* tab bar */
document.getElementById('tabbar').addEventListener('click', e => {
  const b = e.target.closest('.tab');
  if (!b) return;
  // commit anything typed into the active session before the view is rebuilt —
  // leaving this out silently reverted in-progress set entries
  readSetInputs();
  if (App.activeSession) persistSession();
  App.tab = b.dataset.tab;
  if (App.tab === 'food') { App.foodDay = todayKey(); App.foodView = 'home'; }
  if (App.tab === 'train') App.trainView = 'home';
  if (App.tab === 'today') App.todayView = 'home';
  if (App.tab === 'sleep') App.sleepDay = todayKey();
  App.render();
});

/* enter key on grocery input */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'g-new') { groceryAdd(e.target.value); }
});

function shiftDay(key, dir) {
  const nk = shiftKey(key, dir);
  return nk > todayKey() ? todayKey() : nk;
}

/* Average tokens per scan, so real usage can replace the estimates behind the
   hosted-key plan in ROADMAP.md. Hidden until there's something to report. */
function scanStatsNote() {
  const st = Store.get('scanStats', null);
  if (!st?.scans) return '';
  const per = n => Math.round(n / st.scans);
  return `<div class="chart-note">Scan usage on this device: ${st.scans} scan${st.scans > 1 ? 's' : ''} ·
    ~${per(st.in)} in / ${per(st.out)} out tokens each${st.thoughts ? ` · ${per(st.thoughts)} thinking` : ''} ·
    ${esc(st.model || '?')}</div>`;
}

/* ---------- boot ---------- */

/* Ask the browser to exempt our localStorage from eviction. Everything Peak knows
   lives there, and the default policy will bin it — iOS Safari clears storage for
   sites unused for ~7 days, and "clear browsing data" takes it anywhere. Granted
   automatically for installed PWAs on most engines; a no-op where unsupported.
   Not a guarantee, which is why the backup nudge below exists too. */
function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  navigator.storage.persisted()
    .then(already => already || navigator.storage.persist())
    .catch(() => {});
}

/* Nag for a JSON export once there is history worth losing. Deliberately quiet:
   only past 10 sessions, only every 30 days, and never on a user's first run. */
const BACKUP_NAG_DAYS = 30;
function maybeNudgeBackup() {
  const sessions = getWorkouts().length;
  if (sessions < 10) return;
  const last = Store.get('lastBackupPrompt', null);
  if (last && daysBetween(last, todayKey()) < BACKUP_NAG_DAYS) return;
  Store.set('lastBackupPrompt', todayKey());
  setTimeout(() => {
    toast(`${sessions} sessions logged — worth a backup`, { label: 'Export', action: 'export-data' });
  }, 2500);
}

(function boot() {
  requestPersistentStorage();
  if (getProfile()) {
    const s = restoreSession();
    if (s) App.tab = 'train';
    App.render();
    paintRest();
    if (s) {
      toast(s.date === todayKey()
        ? `Picked your ${s.dayName} session back up`
        : `Restored your unfinished ${s.dayName} from ${prettyDate(s.date)}`);
    } else {
      maybeNudgeBackup(); // never on top of a session-restore toast
    }
  } else {
    App.render();
  }
})();
