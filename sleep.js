/* Peak — Sleep tab: nightly log + score + trend */

function sleepDurationMin(bed, wake) {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

/* score 0-100: duration 60, quality 25, consistency 15 (bed 8 / wake 7) */
function sleepScore(key) {
  const s = getSleep();
  const e = s[key];
  if (!e) return null;
  const durPts = sleepDurationPoints(e.durationMin);
  const qualPts = ((e.quality || 3) - 1) / 4 * 25;
  const cons = sleepConsistency(key);
  return Math.round(Math.min(100, durPts + qualPts + cons.points));
}

/* The old curve had two cliffs in it: 479 min scored 59.75, 480 scored a flat
   60 all the way to 599, and 600 dropped straight back to 50. Sleeping ten
   minutes longer could cost you ten points. Now it ramps 4h→8h, holds through
   the 8–9h window where nothing is wrong, and tapers gently past 9h instead of
   falling off a step. */
function sleepDurationPoints(dur) {
  if (dur <= 240) return 0;
  if (dur < 480) return (dur - 240) / 240 * 60;          // 4h → 8h
  if (dur <= 540) return 60;                              // 8h → 9h: full marks
  return Math.max(42, 60 - (dur - 540) / 60 * 6);         // gentle taper past 9h
}

/* Consistency is *when*, not how long — and it is two habits, not one. Bedtime
   drift is the one people notice; wake-time drift is the one that actually
   moves the body clock, which is why a 15-point bedtime-only score rated a
   lifter who woke at 6 on weekdays and 11 at weekends as perfectly consistent. */
function sleepConsistency(key) {
  const s = getSleep();
  const keys = Object.keys(s)
    .filter(k => k <= key && daysBetween(k, key) <= 14)
    .sort().slice(-7);
  if (keys.length < 3) return { points: 7.5, bedSd: null, wakeSd: null, nights: keys.length };
  const spread = (field, wrapBefore) => {
    const mins = keys.map(k => {
      const [h, m] = (s[k][field] || '00:00').split(':').map(Number);
      let v = h * 60 + m;
      if (wrapBefore && v < wrapBefore) v += 24 * 60;
      return v;
    });
    const mean = mins.reduce((a, b) => a + b) / mins.length;
    return Math.sqrt(mins.reduce((a, b) => a + (b - mean) ** 2, 0) / mins.length);
  };
  // bedtimes after midnight are "late", not "early the next morning"
  const bedSd = spread('bed', 12 * 60);
  const wakeSd = spread('wake', 0);
  const band = (sd, max) => sd <= 30 ? max : sd <= 60 ? max * 0.66 : sd <= 90 ? max * 0.33 : 0;
  return {
    points: band(bedSd, 8) + band(wakeSd, 7),
    bedSd: Math.round(bedSd), wakeSd: Math.round(wakeSd), nights: keys.length
  };
}

function fmtDur(min) {
  return Math.floor(min / 60) + 'h ' + String(min % 60).padStart(2, '0') + 'm';
}

/* Average over the last N CALENDAR days, with the coverage that produced it.
   Averaging "the last 7 entries" reported 8h 26m for a week that actually
   averaged 5h, because it silently reached back three weeks for nights to use. */
function sleepAvgDays(days) {
  const s = getSleep();
  let sum = 0, nights = 0;
  for (let i = 0; i < days; i++) {
    const e = s[todayKey(-i)];
    if (e) { nights++; sum += e.durationMin; }
  }
  return { avgMin: nights ? Math.round(sum / nights) : null, nights, days };
}

/* ---------- what sleep is doing to your training ----------
   Peak's whole pitch is that sleep feeds the lift — the plateau alert even says
   so — and until now the Sleep tab never once showed the connection in the
   user's own numbers. This is that, computed from what they already logged: the
   session score of every lifting day, split by how they slept the night before.

   Deliberately careful about what it claims. It is a split of observed means on
   a handful of sessions, not a controlled result, so it needs real coverage
   before it says anything and it never says "caused". */
const SLEEP_LINK_MIN = 4;        // sessions needed on EACH side before splitting
const SLEEP_GOOD_MIN = 450;      // 7h30
const SLEEP_SHORT_MAX = 420;     // 7h

function sleepTrainingLink() {
  const sleep = getSleep();
  const good = [], short = [];
  getWorkouts().forEach(s => {
    if (s.cardio || s.score == null) return;
    // the night before the session is keyed to the session date itself: Peak
    // logs "last night" against today, which is the night that fuelled today
    const night = sleep[s.date];
    if (!night) return;
    if (night.durationMin >= SLEEP_GOOD_MIN) good.push(s.score);
    else if (night.durationMin <= SLEEP_SHORT_MAX) short.push(s.score);
  });
  if (good.length < SLEEP_LINK_MIN || short.length < SLEEP_LINK_MIN) {
    return { ready: false, good: good.length, short: short.length };
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const g = mean(good), sh = mean(short);
  return {
    ready: true, goodN: good.length, shortN: short.length,
    goodAvg: Math.round(g), shortAvg: Math.round(sh), delta: Math.round(g - sh)
  };
}

function renderSleepTrainingLink() {
  const l = sleepTrainingLink();
  if (!l.ready) {
    const total = l.good + l.short;
    if (total < 2) return '';
    return `<div class="card">
      <h2>Sleep vs training</h2>
      <div class="muted small">Peak is collecting this: it compares your session scores after a good night against after a short one. ${total} lifting session${total === 1 ? '' : 's'} so far have a logged night attached — it needs ${SLEEP_LINK_MIN} of each before the comparison means anything.</div>
    </div>`;
  }
  const better = l.delta > 0;
  const color = better ? CHART.good : l.delta < 0 ? CHART.warning : CHART.muted;
  return `
  <div class="card">
    <h2>Sleep vs training <span class="h2-right">your sessions, your nights</span></h2>
    <div class="grid-2">
      <div class="stat"><div class="sv" style="color:${CHART.good}">${l.goodAvg}</div>
        <div class="sl">after 7h30+<br>${l.goodN} sessions</div></div>
      <div class="stat"><div class="sv" style="color:${CHART.warning}">${l.shortAvg}</div>
        <div class="sl">after under 7h<br>${l.shortN} sessions</div></div>
    </div>
    <div class="focus mt">
      <span class="fc-ico">${better ? '📈' : '📉'}</span>
      <span class="fc-text">${better
        ? `Your sessions score <b style="color:${color}">${l.delta} points higher</b> on average after a full night. That is your own data, not a study.`
        : l.delta === 0
          ? 'No measurable difference in your session scores either way — unusual, and worth more nights before reading anything into it.'
          : `Your short-sleep sessions actually score <b style="color:${color}">${Math.abs(l.delta)} higher</b>. Sample sizes this small swing easily; keep logging.`}</span>
    </div>
    <div class="chart-note">Session score is intensity vs your bests, sets vs plan, and PRs. This compares averages across ${l.goodN + l.shortN} sessions — a pattern in your log, not proof of cause.</div>
  </div>`;
}

/* Rolling shortfall against 8h. Only counts nights you logged, and says how
   many — a "debt" computed over unlogged nights is fiction. */
function sleepDebt(days) {
  const s = getSleep();
  let debt = 0, nights = 0;
  for (let i = 0; i < days; i++) {
    const e = s[todayKey(-i)];
    if (!e) continue;
    nights++;
    debt += 480 - e.durationMin;
  }
  return { debt, nights };
}

function renderSleep() {
  const s = getSleep();
  const key = App.sleepDay || todayKey();
  const isToday = key === todayKey();
  const entry = s[key];
  const score = sleepScore(key);
  const wk = sleepAvgDays(7);

  // last 14 days trend (hours), positioned on a real date axis
  const points = [];
  for (let i = 13; i >= 0; i--) {
    const k = todayKey(-i);
    if (s[k]) points.push({ label: prettyDate(k).replace(/^\w+, /, ''), value: Math.round(s[k].durationMin / 6) / 10, x: 13 - i });
  }

  const scoreColor = score == null ? CHART.muted : score >= 75 ? CHART.good : score >= 50 ? CHART.warning : CHART.critical;
  const logged14 = points.length;

  return `
  <div class="card">
    <div class="day-nav">
      <button class="dn-btn" data-action="sleep-day" data-dir="-1" aria-label="Previous night">‹</button>
      <div class="dn-label"><b>${isToday ? 'Last night' : prettyDate(key)}</b></div>
      <button class="dn-btn" data-action="sleep-day" data-dir="1" ${isToday ? 'disabled' : ''} aria-label="Next night">›</button>
    </div>
    ${entry ? `
      <div class="spread mt">
        <div>
          <div class="hero-num">${fmtDur(entry.durationMin)}</div>
          <div class="muted small">${fmtTime(entry.bed)} → ${fmtTime(entry.wake)} · quality ${entry.quality}/5</div>
        </div>
        <div class="center">
          <div class="hero-num" style="color:${scoreColor}">${score}</div>
          <div class="muted small">sleep score</div>
        </div>
      </div>
      <div class="grid-2 mt">
        <button class="btn" data-action="open-sleep-log">Edit</button>
        <button class="btn ghost danger" data-action="del-sleep" data-key="${key}">Delete</button>
      </div>`
    : `
      <div class="muted mt">Not logged${isToday ? ' yet' : ` for ${prettyDate(key)}`}.</div>
      <button class="btn primary mt" data-action="open-sleep-log">☾ Log this night</button>
      ${isToday ? '' : '<div class="chart-note center">Missed a night? Log it here — the averages need it.</div>'}`}
  </div>

  <div class="card">
    <h2>Hours slept — last 14 days
      ${wk.avgMin ? `<span class="h2-right">7-day avg ${fmtDur(wk.avgMin)} · ${wk.nights}/7 nights</span>` : ''}</h2>
    ${lineChart(points, { color: CHART.violet, goal: 8, unit: 'h', ySuffix: 'h' })}
    <div class="chart-note">Dashed line = 8h target. ${logged14} of the last 14 nights logged. Tap a dot for details.</div>
  </div>

  ${renderSleepInsight(wk)}
  ${renderSleepTrainingLink()}
  ${renderRecentNights()}`;
}

/* Coverage-aware: a verdict off two logged nights is not a verdict. */
function renderSleepInsight(wk) {
  if (wk.avgMin == null) {
    return `<div class="alert"><span class="a-ico">☾</span><div class="a-body">
      <b>Nothing logged this week.</b> Ten seconds a morning is enough — sleep explains more of your training than any other number here.</div></div>`;
  }
  if (wk.nights < 4) {
    return `<div class="alert"><span class="a-ico">☾</span><div class="a-body">
      <b>Only ${wk.nights} of the last 7 nights logged (averaging ${fmtDur(wk.avgMin)}).</b>
      That's too thin to read a trend from — log a few more and this turns into real feedback. You can backfill missed nights with the ‹ arrow above.</div></div>`;
  }
  const deficit = 480 - wk.avgMin;
  if (deficit >= 60) {
    return `<div class="alert crit"><span class="a-ico">☾</span><div class="a-body">
      <b>You're averaging ${fmtDur(wk.avgMin)} across ${wk.nights} nights — about ${Math.round(deficit / 60 * 10) / 10}h short.</b>
      Sleep is where muscle is actually built. Under 7h, strength progress and recovery measurably drop —
      this is the most likely thing feeding your plateau. Try pulling bedtime 30 min earlier this week.</div></div>`;
  }
  if (deficit >= 20) {
    return `<div class="alert"><span class="a-ico">☾</span><div class="a-body">
      <b>Close: averaging ${fmtDur(wk.avgMin)} over ${wk.nights} nights.</b> Another ~${Math.round(deficit)} min a night gets you to 8h. Consistent bedtime is the easiest lever.</div></div>`;
  }
  return `<div class="alert good"><span class="a-ico">✓</span><div class="a-body">
    <b>Averaging ${fmtDur(wk.avgMin)} over ${wk.nights} nights — recovery is on point.</b> Keep the same bed/wake window.</div></div>`
    + renderConsistencyNote();
}

/* Consistency is 15 of the 100 points and used to be invisible — you could lose
   all of them and never learn why. Names the worse of the two habits, with the
   number that produced the verdict. */
function renderConsistencyNote() {
  const c = sleepConsistency(todayKey());
  if (c.bedSd == null) return '';
  const worst = c.wakeSd > c.bedSd ? 'wake' : 'bed';
  const sd = worst === 'wake' ? c.wakeSd : c.bedSd;
  if (sd <= 30) {
    return `<div class="chart-note center">Your ${worst} times land within ±${sd} min across ${c.nights} nights — that's the consistent end, and it's worth protecting.</div>`;
  }
  const label = worst === 'wake' ? 'wake-up time' : 'bedtime';
  return `<div class="alert" style="border-left-color:var(--blue)"><span class="a-ico">⏰</span><div class="a-body">
    <b>Your ${label} swings about ±${sd} minutes.</b>
    Duration is only part of it — an irregular ${label} shifts your body clock and costs you
    ${sd > 90 ? 'all' : 'part'} of the consistency portion of your score.
    ${worst === 'wake'
      ? 'Wake time is the easier of the two to hold steady, and it drags bedtime along with it.'
      : 'Anchoring bedtime to a 30-minute window is usually enough.'}</div></div>`;
}

/* the last two weeks, so a gap is visible and fixable in one tap */
function renderRecentNights() {
  const s = getSleep();
  const rows = [];
  for (let i = 0; i < 14; i++) {
    const k = todayKey(-i);
    const e = s[k];
    const sc = e ? sleepScore(k) : null;
    rows.push(`
      <div class="list-item" data-action="open-night" data-key="${k}" style="cursor:pointer">
        <div class="li-main">
          <div class="li-title">${i === 0 ? 'Last night' : prettyDate(k)}</div>
          <div class="li-sub">${e ? `${fmtTime(e.bed)} → ${fmtTime(e.wake)} · quality ${e.quality}/5` : 'not logged'}</div>
        </div>
        ${e ? `<div class="li-val">${fmtDur(e.durationMin)}</div>
               <span class="pill ${sc >= 75 ? 'good' : sc >= 50 ? 'warn' : 'crit'}">${sc}</span>`
            : '<span class="pill">＋</span>'}
        <span class="nr-chev">›</span>
      </div>`);
  }
  return `
  <div class="card">
    <h2>Last 14 nights</h2>
    ${rows.join('')}
    <div class="chart-note">Tap any night to log or edit it.</div>
  </div>`;
}

function openSleepLog() {
  const key = App.sleepDay || todayKey();
  const s = getSleep();
  const e = s[key] || { bed: '23:30', wake: '07:00', quality: 3 };
  openModal(`
    <h3>${s[key] ? 'Edit' : 'Log'} ${key === todayKey() ? 'last night' : prettyDate(key)}</h3>
    <div class="grid-2">
      <div><label>Bed time</label><input id="sl-bed" type="time" value="${e.bed}"></div>
      <div><label>Wake time</label><input id="sl-wake" type="time" value="${e.wake}"></div>
    </div>
    <div class="chart-note center">That's <b id="sl-dur">${fmtDur(sleepDurationMin(e.bed, e.wake))}</b> in bed — check it before saving, it's the biggest part of the score.</div>
    <label>Night of</label>
    <input id="sl-date" type="date" value="${key}" max="${todayKey()}">
    <label>How rested do you feel? <span id="sl-qval">${esc(SLEEP_QUALITY[e.quality] || '')}</span></label>
    <input id="sl-quality" type="range" min="1" max="5" value="${e.quality}" style="padding:0">
    <div class="range-ends"><span>Wrecked</span><span>Fully rested</span></div>
    <div class="chart-note">This is a quarter of the score. "Slept 8 hours and still feel awful" is information — log it honestly rather than rounding up.</div>
    <button class="btn primary mt" data-action="save-sleep">Save</button>
  `);
  document.getElementById('sl-quality')?.addEventListener('input', ev => {
    document.getElementById('sl-qval').textContent = SLEEP_QUALITY[ev.target.value] || '';
  });
  const bed = document.getElementById('sl-bed'), wake = document.getElementById('sl-wake');
  const showDur = () => {
    const el = document.getElementById('sl-dur');
    if (el && bed.value && wake.value) el.textContent = fmtDur(sleepDurationMin(bed.value, wake.value));
  };
  bed?.addEventListener('input', showDur);
  wake?.addEventListener('input', showDur);
}

/* A bare 3/5 means nothing a month later; the words are the scale. */
const SLEEP_QUALITY = { 1: '1 · Wrecked', 2: '2 · Groggy', 3: '3 · OK', 4: '4 · Good', 5: '5 · Fully rested' };

function saveSleepEntry() {
  const bed = document.getElementById('sl-bed').value;
  const wake = document.getElementById('sl-wake').value;
  if (!bed || !wake) { toast('Set both times'); return; }
  const date = document.getElementById('sl-date').value || todayKey();
  if (date > todayKey()) { toast("Can't log a night in the future"); return; }
  const quality = Number(document.getElementById('sl-quality').value);
  setSleepEntry(date, { bed, wake, quality, durationMin: sleepDurationMin(bed, wake) });
  App.sleepDay = date;
  closeModal(); toast('Sleep logged'); App.render();
}
