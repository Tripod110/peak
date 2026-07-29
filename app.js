/* Peak — app shell, dashboard, onboarding, settings */

const APP_VERSION = 'v24';

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
  activeSession: null,
  scanImage: null,
  scanResult: null,
  grocSection: 'staples',
  trainView: 'home',
  todayView: 'home',
  foodView: 'home',
  rest: null,
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
    view.innerHTML = installBanner() + html;
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
  const wk = sessionsInDays(7);

  if (!logged && hour >= 10)
    return { ico: '📷', text: 'Nothing logged yet today — scan a meal and the rest of the day builds itself.', action: 'quick-scan' };
  if (slScore == null && hour < 15)
    return { ico: '☾', text: "Last night's sleep isn't logged. Ten seconds, and it explains everything else.", action: 'quick-sleep' };
  if (proteinLeft > 50 && hour >= 15)
    return { ico: '🥩', text: `${Math.round(proteinLeft)}g protein to go — this is the number that decides whether the training sticks.`, action: 'quick-food' };
  if (!trainedToday && wk < p.gymDays)
    return { ico: '🏋', text: `${wk} of ${p.gymDays} sessions this week — ${TEMPLATES[p.template].days[nextDayIndex()].name} is up next.`, action: 'quick-train' };
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
  const trainedToday = getWorkouts().some(s => s.date === tk);
  const todayScores = getWorkouts().filter(s => s.date === tk).map(s => s.score || 0);
  const focus = todayFocus(p, t, totals, slScore, trainedToday);

  const weekVals = [];
  for (let i = 6; i >= 0; i--) weekVals.push(dayTotals(todayKey(-i)).kcal);

  const ws = getWeights();
  const latestLb = ws.length ? Math.round(kgToLb(ws[ws.length - 1].kg) * 10) / 10 : null;
  const older = ws.filter(w => daysBetween(w.date, tk) >= 7);
  const wChange = (latestLb != null && older.length)
    ? Math.round((latestLb - kgToLb(older[older.length - 1].kg)) * 10) / 10 : null;

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
        <span class="gv">${latestLb != null ? latestLb : '—'}</span>
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
    ${todayNavRow('weight', '⚖', 'Body weight',
      latestLb != null ? `${latestLb} lb${wChange != null ? ` · ${wChange > 0 ? '+' : ''}${wChange} this week` : ''}` : 'not logged yet')}
    ${todayNavRow('streaks', '🔥', 'Consistency', streakSummary())}
  </div>`;
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
  const sleepAll = getSleep();
  let sleepSum = 0, nights = 0;
  for (let i = 0; i < 7; i++) {
    const k = todayKey(-i);
    if (sleepAll[k]) { nights++; sleepSum += sleepAll[k].durationMin; }
  }
  const weekSessions = getWorkouts().filter(s => { const d = daysBetween(s.date, todayKey()); return d >= 0 && d < 7; });
  const lifts = weekSessions.filter(s => !s.cardio);
  const scores = weekSessions.map(s => s.score).filter(v => typeof v === 'number');
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const avgKcal = foodDays ? Math.round(kcalSum / foodDays) : null;
  const avgProt = foodDays ? Math.round(protSum / foodDays) : null;
  const avgSleep = nights ? Math.round(sleepSum / nights) : null;

  const stats = { avgKcal, avgProt, avgSleep, nights, foodDays, lifts: lifts.length, sessions: weekSessions.length, avgScore };

  if (!foodDays && !nights && !weekSessions.length)
    return { ...stats, ico: '·', short: 'no data yet', tone: '', full: 'Nothing logged in the last 7 days — start anywhere.' };
  if (avgSleep != null && avgSleep < 420)
    return { ...stats, ico: '☾', short: 'sleep is low', tone: 'warn',
      full: `Sleep is your bottleneck at ${fmtDur(avgSleep)} a night. Pull bedtime 30 min earlier — it feeds every lift more than any program tweak.` };
  if (avgProt != null && avgProt < t.protein * 0.85)
    return { ...stats, ico: '🥩', short: 'protein is low', tone: 'warn',
      full: `Protein averaged ${avgProt}g against a ${t.protein}g target. Add one protein anchor a day — Grocery → Snacks has the cheap ones.` };
  if (lifts.length < p.gymDays - 1)
    return { ...stats, ico: '🏋', short: `${lifts.length} of ${p.gymDays} sessions`, tone: 'warn',
      full: `${lifts.length} of ${p.gymDays} planned sessions. Consistency outranks intensity — just get in the gym.` };
  if (avgScore != null && avgScore < 60)
    return { ...stats, ico: '▲', short: `scores averaging ${avgScore}`, tone: 'warn',
      full: `Session scores averaging ${avgScore}. Finish the prescribed sets — Train shows the exact target for each lift.` };
  return { ...stats, ico: '✓', short: 'on track', tone: 'good',
    full: `Everything's tracking. Repeat this week exactly and let progression do the work.` };
}

function streakSummary() {
  const t = computeTargets(getProfile());
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
  for (let i = 13; i >= 0; i--) {
    const k = todayKey(-i);
    if (!foodForDay(k).length) continue;
    const d = dayTotals(k);
    const label = prettyDate(k).replace(/^\w+, /, '');
    kcalPts.push({ label, value: Math.round(d.kcal) });
    protPts.push({ label, value: Math.round(d.protein) });
  }
  if (kcalPts.length < 2) return emptyNote('Log two or more days and your trends appear here.');

  const avgK = Math.round(kcalPts.reduce((a, b) => a + b.value, 0) / kcalPts.length);
  const avgP = Math.round(protPts.reduce((a, b) => a + b.value, 0) / protPts.length);
  const hitDays = protPts.filter(x => x.value >= t.protein * 0.9).length;

  return `
  <div class="card">
    <h2>Calories <span class="h2-right">avg ${avgK.toLocaleString()} · target ${t.kcal.toLocaleString()}</span></h2>
    ${lineChart(kcalPts, { color: CHART.blue, goal: t.kcal, h: 130, yFmt: v => Math.round(v / 100) * 100 })}
    <div class="chart-note">Dashed line is your target. Tap a dot for the day.</div>
  </div>
  <div class="card">
    <h2>Protein <span class="h2-right">avg ${avgP}g · target ${t.protein}g</span></h2>
    ${lineChart(protPts, { color: CHART.orange, goal: t.protein, h: 130, unit: 'g', yFmt: v => Math.round(v) })}
    <div class="chart-note">${hitDays} of ${protPts.length} logged days hit at least 90% of target.</div>
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
    <div class="chart-note">Quality blends how whole your food was with how close you landed on protein.</div>
  </div>`;
}

/* ---------- Today subview: body weight ---------- */
function renderWeightDetail() {
  const p = getProfile();
  const ws = getWeights();
  const pts = ws.slice(-30).map(w => ({ label: prettyDate(w.date).replace(/^\w+, /, ''), value: Math.round(kgToLb(w.kg) * 10) / 10 }));
  const first = pts.length ? pts[0].value : null;
  const last = pts.length ? pts[pts.length - 1].value : null;
  const change = (first != null && pts.length >= 2) ? Math.round((last - first) * 10) / 10 : null;
  // trailing 7-day average vs the 7 before it — smooths daily water noise
  const avgOf = (from, to) => {
    const sel = ws.filter(w => { const d = daysBetween(w.date, todayKey()); return d >= from && d < to; });
    return sel.length ? kgToLb(sel.reduce((a, b) => a + b.kg, 0) / sel.length) : null;
  };
  const recent = avgOf(0, 7), prior = avgOf(7, 14);
  const weekly = (recent != null && prior != null) ? Math.round((recent - prior) * 10) / 10 : null;

  return `
  <div class="card">
    <div class="row">
      <input id="tw-weight" type="number" inputmode="decimal" placeholder="Today's weight (lb)" class="grow">
      <button class="btn small primary" data-action="log-weight">Log</button>
    </div>
  </div>
  <div class="card">
    <h2>Trend <span class="h2-right">${pts.length} entr${pts.length === 1 ? 'y' : 'ies'}</span></h2>
    ${pts.length >= 2 ? lineChart(pts, { color: CHART.blue, h: 140, unit: ' lb', yFmt: v => Math.round(v) })
      : '<div class="muted small">Log at least two weigh-ins to see a trend.</div>'}
    ${weekly != null ? `
      <div class="spread mt" style="border-top:1px solid var(--grid);padding-top:10px">
        <span class="muted small">7-day average vs the week before</span>
        <b style="color:${goalDirectionColor(p, weekly)}">${weekly > 0 ? '+' : ''}${weekly} lb</b>
      </div>` : ''}
    ${change != null ? `<div class="chart-note">${change > 0 ? 'Up' : change < 0 ? 'Down' : 'Flat'} ${Math.abs(change)} lb across these ${pts.length} entries.</div>` : ''}
    ${weekly != null ? `<div class="chart-note">${weeklyWeightVerdict(p, weekly)}</div>` : ''}
  </div>
  ${ws.length ? `
  <div class="card">
    <h2>Recent weigh-ins</h2>
    ${ws.slice(-10).reverse().map(w => `
      <div class="list-item">
        <div class="li-main"><div class="li-title">${prettyDate(w.date)}</div></div>
        <div class="li-val">${Math.round(kgToLb(w.kg) * 10) / 10}<span class="unit"> lb</span></div>
      </div>`).join('')}
  </div>` : ''}`;
}
function goalDirectionColor(p, weekly) {
  const cutting = p.goal === 'cut' || p.goal === 'slowcut';
  if (cutting) return weekly < 0 ? CHART.good : 'var(--warning)';
  if (p.goal === 'bulk') return weekly > 0 ? CHART.good : 'var(--warning)';
  return Math.abs(weekly) < 0.7 ? CHART.good : 'var(--warning)';
}
function weeklyWeightVerdict(p, weekly) {
  const cutting = p.goal === 'cut' || p.goal === 'slowcut';
  if (cutting) {
    if (weekly < -2) return 'That is faster than ideal — dropping much more than 1% of body weight a week costs muscle. Consider eating a little more.';
    if (weekly < -0.4) return 'Good rate for a cut. Hold this and keep protein high.';
    if (weekly <= 0.3) return 'Roughly flat. If this holds for another week, trim calories slightly.';
    return 'Trending up while cutting — check portions and logging honesty before changing the target.';
  }
  if (p.goal === 'bulk') {
    if (weekly > 1.2) return 'Gaining quickly — some of that will be fat. Ease the surplus a bit.';
    if (weekly > 0.2) return 'Solid lean-gain rate.';
    return 'Not gaining yet. Add roughly 150–200 kcal a day and reassess next week.';
  }
  return Math.abs(weekly) < 0.7
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
  const sessions30 = sessionsInDays(30);

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
    <div class="chart-note">${sessions30} sessions in the last 30 days against a plan of ${p.gymDays} a week.</div>
  </div>
  <div class="card">
    <h2>Why this matters</h2>
    <div class="muted small" style="line-height:1.6">Adherence beats optimisation. A merely decent plan followed 90% of the time outperforms a perfect one followed half the time — which is why these counts sit here at all. The streak is not the point; noticing when it breaks is.</div>
  </div>`;
}

function renderWeeklyReview() {
  const p = getProfile();
  const t = computeTargets(p);

  let kcalSum = 0, protSum = 0, foodDays = 0;
  for (let i = 0; i < 7; i++) {
    const k = todayKey(-i);
    if (foodForDay(k).length) { foodDays++; const d = dayTotals(k); kcalSum += d.kcal; protSum += d.protein; }
  }
  const sleepAll = getSleep();
  let sleepSum = 0, nights = 0;
  for (let i = 0; i < 7; i++) {
    const k = todayKey(-i);
    if (sleepAll[k]) { nights++; sleepSum += sleepAll[k].durationMin; }
  }
  const weekSessions = getWorkouts().filter(s => {
    const d = daysBetween(s.date, todayKey());
    return d >= 0 && d < 7;
  });
  const lifts = weekSessions.filter(s => !s.cardio);
  const scores = weekSessions.map(s => s.score).filter(v => typeof v === 'number');
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  if (foodDays < 2 && !nights && !weekSessions.length) return '';

  const avgKcal = foodDays ? Math.round(kcalSum / foodDays) : null;
  const avgProt = foodDays ? Math.round(protSum / foodDays) : null;
  const avgSleep = nights ? Math.round(sleepSum / nights) : null;
  const ws = getWeights().filter(w => daysBetween(w.date, todayKey()) <= 7);
  const wChange = ws.length >= 2 ? Math.round((kgToLb(ws[ws.length - 1].kg) - kgToLb(ws[0].kg)) * 10) / 10 : null;

  const weak = weeklyWeakLink(p, t);
  const ico = weak.ico, rec = weak.full;

  const tile = (val, sub) => `<div><div class="hero-num" style="font-size:20px">${val}</div><div class="muted small">${sub}</div></div>`;
  return `
  <div class="card">
    <h2>This week <span class="h2-right">rolling 7 days</span></h2>
    <div class="grid-2">
      ${tile(avgKcal ? avgKcal.toLocaleString() : '—', `avg kcal · target ${t.kcal.toLocaleString()}`)}
      ${tile(avgProt != null ? avgProt + 'g' : '—', `avg protein · target ${t.protein}g`)}
      ${tile(avgSleep ? fmtDur(avgSleep) : '—', `avg sleep · ${nights} night${nights !== 1 ? 's' : ''}`)}
      ${tile(lifts.length + (weekSessions.length > lifts.length ? ` +${weekSessions.length - lifts.length}` : ''),
        avgScore != null ? `sessions · avg score ${avgScore}` : `of ${p.gymDays} planned sessions`)}
    </div>
    ${wChange != null ? `<div class="muted small mt">Body weight ${wChange > 0 ? '+' : ''}${wChange} lb over the week</div>` : ''}
    <div class="alert mt mb0" style="border-left-color:var(--blue)">
      <span class="a-ico">${ico}</span><div class="a-body">${esc(rec)}</div>
    </div>
  </div>`;
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



/* Copy a whole previous day's food onto the day on screen — the fastest way to
   log a repeat day of eating, which for most people is most days. */
function openRepeatDayModal() {
  const opts = [];
  for (let i = 1; i <= 14; i++) {
    const k = todayKey(-i);
    const items = foodForDay(k);
    if (!items.length || k === App.foodDay) continue;
    const d = dayTotals(k);
    opts.push(`<option value="${k}">${prettyDate(k)} \u2014 ${Math.round(d.kcal)} kcal, ${Math.round(d.protein)}g protein (${items.length} items)</option>`);
  }
  if (!opts.length) { toast('No other logged days to copy yet'); return; }
  openModal(`
    <h3>Repeat a day</h3>
    <div class="modal-sub">Copies every item from that day onto ${App.foodDay === todayKey() ? 'today' : prettyDate(App.foodDay)}.</div>
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
    carbs: e.carbs, fat: e.fat, fiber: e.fiber || 0, quality: e.quality ?? 5, source: 'repeat'
  }));
  closeModal();
  toast(`Copied ${items.length} item${items.length !== 1 ? 's' : ''}`);
  App.render();
}

function openWeightModal() {
  const ws = getWeights();
  const last = ws.length ? Math.round(kgToLb(ws[ws.length - 1].kg) * 10) / 10 : '';
  openModal(`
    <h3>Log body weight</h3>
    <div class="modal-sub">${ws.length ? `Last entry ${last} lb on ${prettyDate(ws[ws.length - 1].date)}.` : 'First weigh-in \u2014 this starts your trend.'}</div>
    <label>Weight (lb)</label>
    <input id="wm-weight" type="number" inputmode="decimal" value="" placeholder="${last || 'e.g. 174'}">
    <button class="btn primary mt" data-action="save-weight">Save</button>
    <div class="chart-note center">Weigh in at the same time of day \u2014 first thing, after the bathroom, is the most consistent.</div>
  `);
  setTimeout(() => document.getElementById('wm-weight')?.focus(), 60);
}
function saveWeightModal() {
  const lb = Number(document.getElementById('wm-weight').value);
  if (!lb || lb < 60 || lb > 700) { toast('Enter a weight in lb'); return; }
  logWeight(lbToKg(lb));
  closeModal(); toast('Weight logged'); App.render();
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

    <div class="grid-2">
      <div><label>Default rest (seconds)</label><input id="set-rest" type="number" value="${s.restSec}"></div>
      <div><label>Barbell weight (lb)</label><input id="set-bar" type="number" value="${s.barLb}"></div>
    </div>
    <div class="chart-note">Rest scales per lift: compounds get 1.5×, isolations 0.6×.</div>

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
    <div class="chart-note center mt">Peak ${APP_VERSION} · ${isStandalone() ? 'installed app' : 'browser tab'} · viewport ${window.innerHeight}px${screen.height ? ' of ' + screen.height + 'px screen' : ''}</div>
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
  const rest = Number(document.getElementById('set-rest')?.value);
  if (rest >= 15 && rest <= 600) s.restSec = rest;
  const bar = Number(document.getElementById('set-bar')?.value);
  if (bar >= 0 && bar <= 100) s.barLb = bar;
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
    case 'go-tab': App.tab = el.dataset.tab; if (App.tab === 'train') App.trainView = 'home'; App.render(); break;
    case 'open-settings': openSettingsModal(); break;
    case 'dismiss-install': Store.set('installDismissed', true); App.render(); break;
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
    case 'food-nav': App.foodView = el.dataset.view; App._renderedTab = null; App.render(); break;
    case 'food-back': App.foodView = 'home'; App._renderedTab = null; App.render(); break;
    case 'open-day': App.foodDay = el.dataset.key; App.foodView = 'home'; App._renderedTab = null; App.render(); break;
    case 'goto-nutrition': App.tab = 'today'; App.todayView = 'nutrition'; App._renderedTab = null; App.render(); break;
    case 'repeat-last': openRepeatDayModal(); break;
    case 'confirm-repeat-day': confirmRepeatDay(); break;
    case 'today-nav': App.todayView = el.dataset.view; App._renderedTab = null; App.render(); break;
    case 'today-back': App.todayView = 'home'; App._renderedTab = null; App.render(); break;
    case 'quick-scan': App.tab = 'food'; App.foodDay = todayKey(); App.render(); openScanModal(); break;
    case 'quick-food': App.tab = 'food'; App.foodDay = todayKey(); App.render(); openManualFood(); break;
    case 'quick-train': App.tab = 'train'; App.trainView = 'home'; App.render(); break;
    case 'quick-sleep': App.tab = 'sleep'; App.render(); openSleepLog(); break;
    case 'quick-weight': openWeightModal(); break;
    case 'save-weight': saveWeightModal(); break;
    case 'train-nav': App.trainView = el.dataset.view; App._renderedTab = null; App.render(); break;
    case 'train-back': App.trainView = 'home'; App._renderedTab = null; App.render(); break;
    case 'start-workout': startWorkout(Number(el.dataset.idx)); break;
    case 'start-picked': startWorkout(Number(document.getElementById('day-picker').value)); break;
    case 'start-freestyle': startWorkout(0, true); break;
    case 'add-set': readSetInputs(); addSet(Number(el.dataset.xi)); break;
    case 'add-warmup': readSetInputs(); addWarmup(Number(el.dataset.xi)); break;
    case 'set-done': toggleSetDone(Number(el.dataset.xi), Number(el.dataset.si)); break;
    case 'set-type': cycleSetType(Number(el.dataset.xi), Number(el.dataset.si)); break;
    case 'rest-add': if (App.rest) { App.rest.endsAt += 30000; App.rest.total += 30; App.rest.beeped = false; paintRest(); } break;
    case 'rest-skip': App.rest = null; paintRest(); break;
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
      if (confirm('Discard this workout?')) { App.activeSession = null; App.rest = null; paintRest(); App.render(); }
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
  if (App.tab === 'food') { App.foodDay = todayKey(); App.foodView = 'home'; }
  if (App.tab === 'train') App.trainView = 'home';
  if (App.tab === 'today') App.todayView = 'home';
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
