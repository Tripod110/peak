/* Forge — Sleep tab: nightly log + score + trend */

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
  // consistency: std-dev of bedtime over trailing 7 entries
  const keys = Object.keys(s).filter(k => k <= key).sort().slice(-7);
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

function renderSleep() {
  const s = getSleep();
  const tk = todayKey();
  const today = s[tk];
  const score = sleepScore(tk);

  // last 14 days trend (hours)
  const points = [];
  for (let i = 13; i >= 0; i--) {
    const k = todayKey(-i);
    if (s[k]) points.push({ label: prettyDate(k).replace(/^\w+, /, ''), value: Math.round(s[k].durationMin / 6) / 10 });
  }
  const keys7 = Object.keys(s).sort().slice(-7);
  const avg7 = keys7.length ? Math.round(keys7.reduce((a, k) => a + s[k].durationMin, 0) / keys7.length) : null;

  const scoreColor = score == null ? CHART.muted : score >= 75 ? CHART.good : score >= 50 ? CHART.warning : CHART.critical;

  return `
  <div class="card">
    <h2>Last night</h2>
    ${today ? `
      <div class="spread">
        <div>
          <div class="hero-num">${fmtDur(today.durationMin)}</div>
          <div class="muted small">${fmtTime(today.bed)} → ${fmtTime(today.wake)} · quality ${today.quality}/5</div>
        </div>
        <div class="center">
          <div class="hero-num" style="color:${scoreColor}">${score}</div>
          <div class="muted small">sleep score</div>
        </div>
      </div>
      <button class="btn mt" data-action="open-sleep-log">Edit</button>`
    : `
      <div class="muted">Not logged yet.</div>
      <button class="btn primary mt" data-action="open-sleep-log">☾ Log last night</button>`}
  </div>

  <div class="card">
    <h2>Hours slept — last 14 days ${avg7 ? `<span class="h2-right">7-day avg ${fmtDur(avg7)}</span>` : ''}</h2>
    ${lineChart(points, { color: CHART.violet, goal: 8, unit: 'h', yFmt: v => (Math.round(v * 10) / 10) + 'h' })}
    <div class="chart-note">Dashed line = 8h target. Tap a dot for details.</div>
  </div>

  ${renderSleepInsight(avg7)}`;
}

function renderSleepInsight(avg7) {
  if (avg7 == null) return '';
  const deficit = 480 - avg7;
  if (deficit >= 60) {
    return `<div class="alert crit"><span class="a-ico">☾</span><div class="a-body">
      <b>You're averaging ${fmtDur(avg7)} — about ${Math.round(deficit / 60 * 10) / 10}h short per night.</b>
      Sleep is where muscle is actually built. Under 7h, strength progress and recovery measurably drop —
      this is the most likely thing feeding your plateau. Try pulling bedtime 30 min earlier this week.</div></div>`;
  }
  if (deficit >= 15) {
    return `<div class="alert"><span class="a-ico">☾</span><div class="a-body">
      <b>Close: averaging ${fmtDur(avg7)}.</b> Another ~${Math.round(deficit)} min a night gets you to 8h. Consistent bedtime is the easiest lever.</div></div>`;
  }
  return `<div class="alert good"><span class="a-ico">✓</span><div class="a-body">
    <b>Averaging ${fmtDur(avg7)} — recovery is on point.</b> Keep the same bed/wake window.</div></div>`;
}

function openSleepLog() {
  const s = getSleep();
  const e = s[todayKey()] || { bed: '23:30', wake: '07:00', quality: 3 };
  openModal(`
    <h3>Log last night</h3>
    <div class="grid-2">
      <div><label>Bed time</label><input id="sl-bed" type="time" value="${e.bed}"></div>
      <div><label>Wake time</label><input id="sl-wake" type="time" value="${e.wake}"></div>
    </div>
    <label>How rested do you feel? (<span id="sl-qval">${e.quality}</span>/5)</label>
    <input id="sl-quality" type="range" min="1" max="5" value="${e.quality}" style="padding:0"
      oninput="document.getElementById('sl-qval').textContent=this.value">
    <button class="btn primary mt" data-action="save-sleep">Save</button>
  `);
}

function saveSleepEntry() {
  const bed = document.getElementById('sl-bed').value;
  const wake = document.getElementById('sl-wake').value;
  if (!bed || !wake) { toast('Set both times'); return; }
  const quality = Number(document.getElementById('sl-quality').value);
  setSleepEntry(todayKey(), { bed, wake, quality, durationMin: sleepDurationMin(bed, wake) });
  closeModal(); toast('Sleep logged'); App.render();
}
