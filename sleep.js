/* Peak — Sleep tab: nightly log + score + trend */

/* Every threshold in the app that means "a bad night", in one place. There
   used to be three: Train warned under 6h, the weekly verdict got severe at a
   7h average, and the training split banded at 7h/7h30 — so the app could call
   the same week fine, short and severe depending on which screen you were on.
   train.js reads this too; it loads first, but the reference is inside a
   function body, exactly like its existing call to sleepAvgDays. */
const SLEEP_BANDS = {
  severe: 360,   // 6h — Train eases off today's volume
  short: 420,    // 7h — the short side of the training split
  good: 450,     // 7h30 — the good side of it
  target: 480    // 8h — what the score and the trend line aim at
};
/* The 7h–7h30 gap is deliberate: the split compares two populations, and two
   populations that touch are one population. Sessions in the gap are counted
   as covered and excluded from both means — see renderSleepTrainingLink. */

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

/* ---------- your usual night ----------
   The log form opened on a hardcoded 23:30 → 07:00 on night one and on night
   three hundred, so every entry started by correcting two numbers that Peak
   could already have worked out. It has a fortnight of your actual times.

   Median, not mean: one 3am night should not drag the default that every
   subsequent night starts from. */
const USUAL_MIN_NIGHTS = 3;
const USUAL_WINDOW = 14;

function minutesOf(hhmm, wrapBefore) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  let v = h * 60 + m;
  if (wrapBefore && v < wrapBefore) v += 1440;   // after midnight is "late", not "early"
  return v;
}
function timeOf(min) {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
function median(nums) {
  const a = nums.slice().sort((x, y) => x - y);
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}

function usualNight() {
  const s = getSleep();
  /* A fortnight of nights, not the last fourteen entries. Slicing by count
     meant a stretch of unlogged weeks let a night from three months ago
     pre-fill tonight's form — the same bug the v27 changelog records fixing in
     sleepAvgDays, still living here. Same filter sleepConsistency uses. */
  const today = todayKey();
  const keys = Object.keys(s)
    .filter(k => k <= today && daysBetween(k, today) <= USUAL_WINDOW)
    .sort();
  if (keys.length < USUAL_MIN_NIGHTS) {
    return { bed: '23:30', wake: '07:00', quality: 3, learned: false, nights: keys.length };
  }
  return {
    bed: timeOf(median(keys.map(k => minutesOf(s[k].bed, 720)))),
    wake: timeOf(median(keys.map(k => minutesOf(s[k].wake, 0)))),
    quality: Math.round(median(keys.map(k => s[k].quality || 3))),
    learned: true, nights: keys.length
  };
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

function sleepTrainingLink() {
  const sleep = getSleep();
  const good = [], short = [];
  /* Sessions with a logged night attached, banded or not. Reporting only the
     banded ones told a lifter who sleeps 7h10 every night that "0 sessions so
     far have a logged night attached", which was false and unfixable — they
     were logging everything. */
  let covered = 0;
  getWorkouts().forEach(s => {
    if (s.cardio || s.score == null) return;
    // the night before the session is keyed to the session date itself: Peak
    // logs "last night" against today, which is the night that fuelled today
    const night = sleep[s.date];
    if (!night) return;
    covered++;
    if (night.durationMin >= SLEEP_BANDS.good) good.push(s.score);
    else if (night.durationMin <= SLEEP_BANDS.short) short.push(s.score);
  });
  if (good.length < SLEEP_LINK_MIN || short.length < SLEEP_LINK_MIN) {
    return { ready: false, good: good.length, short: short.length, covered };
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
    if (!l.covered) return '';
    const mid = l.covered - l.good - l.short;
    return `<div class="card">
      <h2>Sleep vs training</h2>
      <div class="muted small">Peak is collecting this: it compares your session scores after a good night against after a short one.
      ${l.covered} lifting session${l.covered === 1 ? '' : 's'} so far have a logged night attached —
      ${l.good} after 7h30+, ${l.short} after under 7h, and it needs ${SLEEP_LINK_MIN} of each before the comparison means anything.
      ${mid > 0 ? `The other ${mid} fell between 7h and 7h30, which is deliberately left out: two groups that touch are one group.` : ''}</div>
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

/* Sleep was five stacked cards competing for one screen: the log form, a
   14-day chart, a verdict, the training split and fourteen night rows. Home is
   the night in front of you and how the week is going; everything that is a
   record rather than a decision is one tap deeper. See DECISIONS.md D-19. */
const SLEEP_SUBVIEWS = {
  nights: { title: 'Last 14 nights', sub: 'tap any night to log or edit it' },
  trend: { title: 'Hours slept', sub: '14 days against an 8-hour target' },
  training: { title: 'Sleep vs training', sub: 'your session scores, split by the night before' },
  consistency: { title: 'Bed & wake times', sub: 'the habit that moves your body clock' }
};

function renderSleep() {
  return App.sleepView === 'home' ? renderSleepHome() : renderSleepSub(App.sleepView);
}

function renderSleepSub(view) {
  const meta = SLEEP_SUBVIEWS[view];
  if (!meta) { App.sleepView = 'home'; return renderSleepHome(); }
  let body = '';
  switch (view) {
    case 'nights': body = renderRecentNights(); break;
    case 'trend': body = renderSleepTrend(); break;
    case 'training': body = renderSleepTrainingLink() || emptyNote('Log a few sessions with the night before them and this compares your scores.'); break;
    case 'consistency': body = renderConsistencyDetail(); break;
  }
  return navHeader(meta.title, meta.sub, 'sleep-back') + body;
}

/* The earliest night worth paging back to. Without a floor the ‹ arrow walked
   backwards forever through empty dates, with no way home but leaving the tab. */
function earliestNightKey() {
  const keys = Object.keys(getSleep()).sort();
  return keys.length ? keys[0] : todayKey(-30);
}

function renderSleepHome() {
  const key = App.sleepDay || todayKey();
  const wk = sleepAvgDays(7);
  const score = sleepScore(key);
  const c = sleepConsistency(todayKey());
  const logged14 = Object.keys(getSleep()).filter(k => k <= todayKey() && daysBetween(k, todayKey()) < 14).length;

  return `
  ${renderSleepHero(key)}

  ${tileStrip([
    tile({
      action: 'sleep-nav', data: { view: 'trend' }, ico: 'chart', label: '7-day',
      ...(wk.avgMin
        ? { valueHtml: `${Math.floor(wk.avgMin / 60)}<small>h </small>${String(wk.avgMin % 60).padStart(2, '0')}<small>m</small>`,
            sub: `${wk.nights} of 7 nights`,
            ariaLabel: `Seven-day average ${fmtDur(wk.avgMin)} across ${wk.nights} nights. Open the trend` }
        : { empty: true, value: 'No nights', sub: 'log one to start', ariaLabel: 'No nights logged this week. Open the trend' })
    }),
    tile({
      action: 'sleep-nav', data: { view: 'nights' }, ico: 'moon', label: 'Score',
      ...(score != null
        ? { value: score, unit: '/ 100', sub: key === todayKey() ? 'last night' : 'this night',
            ariaLabel: `Sleep score ${score} out of 100. Open the last 14 nights` }
        : { empty: true, value: 'Not logged', sub: `${logged14} of 14 nights`, ariaLabel: 'This night is not logged. Open the last 14 nights' })
    }),
    tile({
      action: 'sleep-nav', data: { view: 'consistency' }, ico: 'clock', label: 'Timing',
      ...(c.bedSd == null
        ? { empty: true, value: 'Collecting', sub: `${c.nights} of 3 nights`, ariaLabel: 'Not enough nights to judge regularity yet. Open bed and wake times' }
        : { value: `±${Math.max(c.bedSd, c.wakeSd)}`, unit: 'min',
            sub: c.wakeSd > c.bedSd ? 'wake time' : 'bedtime',
            ariaLabel: `Your ${c.wakeSd > c.bedSd ? 'wake time' : 'bedtime'} varies by about ${Math.max(c.bedSd, c.wakeSd)} minutes. Open bed and wake times` })
    })
  ])}

  ${renderSleepInsight(wk)}

  <div class="card">
    <h2>Explore</h2>
    ${navRow('sleep-nav', 'nights', icon('moon'), 'Last 14 nights', `${logged14} logged`)}
    ${navRow('sleep-nav', 'trend', icon('chart'), 'Hours slept', weekOverWeek(wk))}
    ${navRow('sleep-nav', 'training', icon('dumbbell'), 'Sleep vs training', sleepLinkNavValue())}
    ${navRow('sleep-nav', 'consistency', icon('clock'), 'Bed & wake times', usualWindowNavValue())}
  </div>`;
}

/* The tiles carry this week's average and the ± spread; Explore rows say what
   they can't — the change on last week, and the window you usually keep. */
function weekOverWeek(wk) {
  if (wk.avgMin == null) return 'needs a night or two';
  const s = getSleep();
  let sum = 0, n = 0;
  for (let i = 7; i < 14; i++) { const e = s[todayKey(-i)]; if (e) { n++; sum += e.durationMin; } }
  if (!n) return 'no nights last week';
  const d = wk.avgMin - Math.round(sum / n);
  return Math.abs(d) < 5 ? 'same as last week' : `${d > 0 ? '+' : '−'}${fmtDur(Math.abs(d))} vs last week`;
}
function usualWindowNavValue() {
  const u = usualNight();
  return u.learned ? `~${fmtTime(u.bed)}–${fmtTime(u.wake)}` : 'learning your times';
}

function sleepLinkNavValue() {
  const l = sleepTrainingLink();
  if (l.ready) return `${l.delta > 0 ? '+' : ''}${l.delta} points after a full night`;
  return l.covered ? `${l.covered} session${l.covered === 1 ? '' : 's'} so far` : 'needs sessions and nights';
}

/* The night in front of you: what it was, or the cheapest way to log it. */
function renderSleepHero(key) {
  const entry = getSleep()[key];
  const isToday = key === todayKey();
  const atFloor = key <= earliestNightKey();
  /* The night stepper IS the hero's top line: which night you are looking at
     and how to change it are the same question. */
  const nav = `
    <div class="day-nav">
      <button class="dn-btn" data-action="sleep-day" data-dir="-1" ${atFloor ? 'disabled' : ''} aria-label="Previous night">‹</button>
      <div class="dn-label"><b>${isToday ? 'Last night' : esc(prettyDate(key))}</b></div>
      <button class="dn-btn" data-action="sleep-day" data-dir="1" ${isToday ? 'disabled' : ''} aria-label="Next night">›</button>
    </div>
    ${isToday ? '' : '<div class="center"><button class="link-btn" data-action="sleep-today">Back to last night</button></div>'}`;

  if (entry) {
    return heroCard({
      id: 'sleep-hero', state: 'done',
      eyebrowHtml: nav,
      title: fmtDur(entry.durationMin),
      meta: `${fmtTime(entry.bed)} → ${fmtTime(entry.wake)} · ${SLEEP_QUALITY[entry.quality] || 'OK'}`,
      actions: [
        { label: 'Edit this night', icon: 'sliders', action: 'open-sleep-log' },
        { label: 'Delete', icon: 'trash', action: 'del-sleep', data: { key }, cls: 'ghost danger' }
      ]
    });
  }

  const u = usualNight();
  const mins = sleepDurationMin(u.bed, nowTime());
  const plausible = mins >= IMUP_MIN && mins <= IMUP_MAX;
  if (isToday && u.learned && plausible) {
    return heroCard({
      id: 'sleep-hero', eyebrowHtml: nav, title: 'How did you sleep?',
      meta: `Not logged yet. Wake time from the clock, bedtime from your usual ${fmtTime(u.bed)} — one more tap for how you slept.`,
      actions: [
        { label: `I'm up — ${fmtDur(mins)} since ${fmtTime(u.bed)}`, icon: 'sun', action: 'sleep-imup', cls: 'accent big' },
        { label: 'Enter times myself', action: 'open-sleep-log', cls: 'ghost' }
      ]
    });
  }
  return heroCard({
    id: 'sleep-hero', eyebrowHtml: nav,
    title: isToday ? 'How did you sleep?' : 'Not logged',
    meta: u.learned
      ? 'Pre-filled with your usual times — nudge whatever was different.'
      : `After ${USUAL_MIN_NIGHTS} nights Peak learns your usual times and pre-fills them, so this becomes two taps.`,
    actions: [{ label: isToday ? 'Log this night' : `Log ${prettyDate(key)}`, icon: 'moon', action: 'open-sleep-log', cls: 'accent big' }]
  });
}

/* The chart, plus the same fourteen numbers as text. The dots carry an SVG
   <title>, which is a hover tooltip and nothing at all on a phone — the note
   under the chart used to promise "tap a dot for details" to people who had no
   way to do it. */
function renderSleepTrend() {
  const s = getSleep();
  const points = [];
  const rows = [];
  for (let i = 13; i >= 0; i--) {
    const k = todayKey(-i);
    if (!s[k]) continue;
    points.push({ label: prettyDate(k).replace(/^\w+, /, ''), value: Math.round(s[k].durationMin / 6) / 10, x: 13 - i });
    rows.unshift({ k, e: s[k] });
  }
  const wk = sleepAvgDays(7);
  return `
  <div class="card">
    <h2>Hours slept${wk.avgMin ? ` <span class="h2-right">7-day avg ${fmtDur(wk.avgMin)}</span>` : ''}</h2>
    ${lineChart(points, { color: CHART.violet, goal: 8, unit: 'h', ySuffix: 'h' })}
    <div class="chart-note">Dashed line = ${SLEEP_BANDS.target / 60}h target. ${points.length} of the last 14 nights logged.</div>
  </div>
  <div class="card">
    <h2>Night by night</h2>
    ${rows.length ? rows.map(({ k, e }) => `
      <div class="list-item">
        <div class="li-main">
          <div class="li-title">${esc(prettyDate(k))}</div>
          <div class="li-sub">${esc(fmtTime(e.bed))} → ${esc(fmtTime(e.wake))}</div>
        </div>
        <div class="li-val">${esc(fmtDur(e.durationMin))}</div>
      </div>`).join('')
    : '<div class="muted small">Nothing logged in the last fortnight.</div>'}
  </div>`;
}

/* The consistency note used to hang off the "your sleep is on point" branch of
   the weekly verdict, so the person whose wake time swings by two hours — the
   one it is written for — could never reach it. */
function renderConsistencyDetail() {
  const c = sleepConsistency(todayKey());
  if (c.bedSd == null) {
    return emptyNote(`Regularity needs at least ${3 - c.nights} more night${3 - c.nights === 1 ? '' : 's'} before it says anything. It is worth 15 of the 100 points.`);
  }
  return `
  <div class="card">
    <h2>Across your last ${c.nights} nights</h2>
    <div class="grid-2">
      <div class="stat"><div class="sv">±${esc(c.bedSd)}<span class="unit"> min</span></div><div class="sl">bedtime swing</div></div>
      <div class="stat"><div class="sv">±${esc(c.wakeSd)}<span class="unit"> min</span></div><div class="sl">wake-time swing</div></div>
    </div>
    <div class="chart-note">Worth ${esc(Math.round(c.points * 10) / 10)} of the 15 consistency points in your sleep score. Under ±30 min scores full marks; over ±90 scores none.</div>
  </div>
  ${renderConsistencyNote()}`;
}

/* "I just woke up" only means anything if the clock agrees. Tapped at 6pm it
   would offer a 19-hour night from this morning's usual bedtime — so the button
   is shown only when now-minus-your-usual-bedtime is a duration a person could
   actually have slept. Outside that window the hero offers the ordinary form. */
const IMUP_MIN = 180, IMUP_MAX = 840;   // 3h – 14h

/* Coverage-aware: a verdict off two logged nights is not a verdict. */
function renderSleepInsight(wk) {
  if (wk.avgMin == null) {
    return `<div class="alert"><span class="a-ico">☾</span><div class="a-body">
      <b>Nothing logged this week.</b> Ten seconds a morning is enough — sleep explains more of your training than any other number here.</div></div>`;
  }
  if (wk.nights < 4) {
    return `<div class="alert"><span class="a-ico">☾</span><div class="a-body">
      <b>Only ${wk.nights} of the last 7 nights logged.</b>
      That's too thin to read a trend from — log a few more and this turns into real feedback. You can backfill missed nights with the ‹ arrow above.</div></div>`;
  }
  const deficit = SLEEP_BANDS.target - wk.avgMin;
  if (deficit >= 60) {
    return `<div class="alert crit"><span class="a-ico">☾</span><div class="a-body">
      <b>About ${Math.round(deficit / 60 * 10) / 10}h a night short of 8h across ${wk.nights} nights.</b>
      Sleep is where muscle is actually built. Under 7h, strength progress and recovery measurably drop —
      this is the most likely thing feeding your plateau. Try pulling bedtime 30 min earlier this week.</div></div>`;
  }
  if (deficit >= 20) {
    return `<div class="alert"><span class="a-ico">☾</span><div class="a-body">
      <b>Close: ~${Math.round(deficit)} min a night short of 8h over ${wk.nights} nights.</b> Consistent bedtime is the easiest lever.</div></div>`;
  }
  return `<div class="alert good"><span class="a-ico">✓</span><div class="a-body">
    <b>Recovery is on point across ${wk.nights} nights.</b> Keep the same bed/wake window.</div></div>`
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
    return `<div class="chart-note center">Your ${worst} times are the steady end across ${c.nights} nights — worth protecting.</div>`;
  }
  const label = worst === 'wake' ? 'wake-up time' : 'bedtime';
  return `<div class="alert" style="border-left-color:var(--blue)"><span class="a-ico">⏰</span><div class="a-body">
    <b>Your ${label} is the one that swings.</b>
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
      <button class="list-item li-tap" data-action="open-night" data-key="${k}"
        aria-label="${i === 0 ? 'Last night' : esc(prettyDate(k))}: ${e ? `${esc(fmtDur(e.durationMin))}, score ${esc(sc)}. Edit it` : 'not logged. Log it'}">
        <div class="li-main">
          <div class="li-title">${i === 0 ? 'Last night' : esc(prettyDate(k))}</div>
          <div class="li-sub">${e ? `${esc(fmtTime(e.bed))} → ${esc(fmtTime(e.wake))} · quality ${esc(e.quality)}/5` : 'not logged'}</div>
        </div>
        ${e ? `<div class="li-val">${esc(fmtDur(e.durationMin))}</div>
               <span class="pill ${sc >= 75 ? 'good' : sc >= 50 ? 'warn' : 'crit'}">${esc(sc)}</span>`
            : '<span class="pill">＋</span>'}
        <span class="nr-chev" aria-hidden="true">›</span>
      </button>`);
  }
  return `
  <div class="card">
    <h2>Last 14 nights</h2>
    ${rows.join('')}
    <div class="chart-note">Tap any night to log or edit it.</div>
  </div>`;
}

/* `prefill` lets the "I'm up" button hand in a wake time from the clock */
function openSleepLog(prefill) {
  const key = App.sleepDay || todayKey();
  const s = getSleep();
  const u = usualNight();
  const e = s[key] || { bed: u.bed, wake: u.wake, quality: u.quality };
  if (prefill) Object.assign(e, prefill);
  const editing = !!s[key];

  openModal(`
    <h3>${editing ? 'Edit' : 'Log'} ${key === todayKey() ? 'last night' : prettyDate(key)}</h3>
    ${!editing && u.learned ? `<div class="modal-sub">Pre-filled from your usual night across ${u.nights} logged nights. Nudge anything that's off.</div>` : ''}

    ${timeField('bed', 'Went to bed', e.bed)}
    ${timeField('wake', 'Woke up', e.wake)}

    <div class="sl-dur-line" aria-live="polite">That's <b id="sl-dur">${fmtDur(sleepDurationMin(e.bed, e.wake))}</b> in bed</div>

    <label id="sl-q-label">How rested do you feel?</label>
    <div class="q-grid" id="sl-quality" role="radiogroup" aria-labelledby="sl-q-label">
      ${[1, 2, 3, 4, 5].map(q => `
        <button type="button" data-q="${q}" role="radio" aria-checked="${q === e.quality}"
          aria-label="${esc(SLEEP_QUALITY[q])}, ${q} of 5" class="${q === e.quality ? 'on' : ''}">
          <span class="q-face" aria-hidden="true">${SLEEP_FACE[q]}</span>
          <span class="q-lab">${esc(SLEEP_QUALITY[q])}</span>
        </button>`).join('')}
    </div>
    <div class="chart-note">A quarter of the score. "Slept 8 hours and still feel awful" is information — log it honestly rather than rounding up.</div>

    <button class="btn primary mt" data-action="save-sleep">Save</button>
    <details class="adv">
      <summary>Logging a different night</summary>
      <input id="sl-date" type="date" value="${key}" max="${todayKey()}">
    </details>
  `);
  wireSleepModal();
}

/* A time you nudge rather than a wheel you spin. The OS time picker is fine for
   setting an alarm once and miserable for the "actually it was more like
   quarter past" correction that is the only edit most mornings need. */
function timeField(id, label, value) {
  return `
    <label>${label}</label>
    <div class="time-row">
      <button type="button" class="t-nudge" data-nudge="${id}" data-min="-30">−30</button>
      <button type="button" class="t-nudge" data-nudge="${id}" data-min="-15">−15</button>
      <input id="sl-${id}" type="time" value="${esc(normTime(value))}" aria-label="${esc(label)}">
      <button type="button" class="t-nudge" data-nudge="${id}" data-min="15">+15</button>
      <button type="button" class="t-nudge" data-nudge="${id}" data-min="30">+30</button>
    </div>`;
}

function wireSleepModal() {
  const bed = document.getElementById('sl-bed'), wake = document.getElementById('sl-wake');
  const showDur = () => {
    const el = document.getElementById('sl-dur');
    if (el && bed.value && wake.value) el.textContent = fmtDur(sleepDurationMin(bed.value, wake.value));
  };
  [bed, wake].forEach(i => i?.addEventListener('input', showDur));

  document.querySelectorAll('[data-nudge]').forEach(btn => btn.addEventListener('click', () => {
    const field = document.getElementById('sl-' + btn.dataset.nudge);
    if (!field) return;
    field.value = timeOf(minutesOf(field.value || '00:00') + Number(btn.dataset.min));
    showDur();
  }));

  document.querySelectorAll('#sl-quality button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#sl-quality button').forEach(b => {
      b.classList.remove('on');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('on');
    btn.setAttribute('aria-checked', 'true');
  }));
}

/* A bare 3/5 means nothing a month later; the words are the scale. */
const SLEEP_QUALITY = { 1: 'Wrecked', 2: 'Groggy', 3: 'OK', 4: 'Good', 5: 'Rested' };
const SLEEP_FACE = { 1: '😵', 2: '😪', 3: '😐', 4: '🙂', 5: '😃' };

/* One tap from the Sleep tab: the clock supplies the wake time, your history
   supplies the bedtime, and the only thing left to answer is how you feel. */
function logImUp() {
  App.sleepDay = todayKey();
  openSleepLog({ wake: nowTime() });
}

function saveSleepEntry() {
  const bed = document.getElementById('sl-bed').value;
  const wake = document.getElementById('sl-wake').value;
  if (!bed || !wake) { toast('Set both times'); return; }
  const date = document.getElementById('sl-date').value || App.sleepDay || todayKey();
  if (date > todayKey()) { toast("Can't log a night in the future"); return; }
  const quality = Number(document.querySelector('#sl-quality button.on')?.dataset.q) || 3;
  const durationMin = sleepDurationMin(bed, wake);
  setSleepEntry(date, { bed, wake, quality, durationMin });
  App.sleepDay = date;
  closeModal();
  toast(`${fmtDur(durationMin)} logged · score ${sleepScore(date)}`);
  announce(`${fmtDur(durationMin)} logged for ${date === todayKey() ? 'last night' : prettyDate(date)}, score ${sleepScore(date)}`);
  App.render();
}

/* Restore for a deleted night — undoLast() in ui.js dispatches here. */
registerUndo('sleep', u => setSleepEntry(u.key, u.entry));
