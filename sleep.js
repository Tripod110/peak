/* Peak — Sleep tab: nightly log + score + trend */

function sleepDurationMin(bed, wake) {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

/* score 0-100: duration 60, quality 25, consistency 15 */
function sleepScore(key) {
  const s = getSleep();
  const e = s[key];
  if (!e) return null;
  const dur = e.durationMin;
  // 60 pts at 8h, linear from 4h; gentle penalty past 10h
  let durPts;
  if (dur >= 600) durPts = 50;
  else if (dur >= 480) durPts = 60;
  else durPts = Math.max(0, (dur - 240) / 240 * 60);
  const qualPts = ((e.quality || 3) - 1) / 4 * 25;
  /* Consistency = bedtime spread. Bounded to the two weeks before this night,
     because the variance of nights three weeks apart says nothing about a habit. */
  const keys = Object.keys(s)
    .filter(k => k <= key && daysBetween(k, key) <= 14)
    .sort().slice(-7);
  let consPts = 7.5;
  if (keys.length >= 3) {
    const mins = keys.map(k => {
      const [h, m] = s[k].bed.split(':').map(Number);
      let v = h * 60 + m;
      if (v < 12 * 60) v += 24 * 60; // treat after-midnight bedtimes as late
      return v;
    });
    const mean = mins.reduce((a, b) => a + b) / mins.length;
    const sd = Math.sqrt(mins.reduce((a, b) => a + (b - mean) ** 2, 0) / mins.length);
    consPts = sd <= 30 ? 15 : sd <= 60 ? 10 : sd <= 90 ? 5 : 0;
  }
  return Math.round(Math.min(100, durPts + qualPts + consPts));
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
    <b>Averaging ${fmtDur(wk.avgMin)} over ${wk.nights} nights — recovery is on point.</b> Keep the same bed/wake window.</div></div>`;
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
    <label>Night of</label>
    <input id="sl-date" type="date" value="${key}" max="${todayKey()}">
    <label>How rested do you feel? (<span id="sl-qval">${e.quality}</span>/5)</label>
    <input id="sl-quality" type="range" min="1" max="5" value="${e.quality}" style="padding:0">
    <button class="btn primary mt" data-action="save-sleep">Save</button>
  `);
  document.getElementById('sl-quality')?.addEventListener('input', ev => {
    document.getElementById('sl-qval').textContent = ev.target.value;
  });
}

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
