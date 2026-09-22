/* Peak — inline SVG charts (dark theme, reference palette) */
const CHART = {
  blue: '#3987e5', orange: '#d95926', aqua: '#199e70', violet: '#9085e9',
  good: '#0ca30c', warning: '#fab219', critical: '#d03b3b',
  ink: '#ffffff', ink2: '#c3c2b7', muted: '#898781',
  grid: '#2c2c2a', baseline: '#383835', track: '#242422'
};

/* Progress ring. value/target; center shows remaining (or over). */
function ringChart(value, target, { size = 132, color = CHART.blue, label = 'left', unit = '' } = {}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = value > target;
  const arcColor = over ? CHART.critical : color;
  const remaining = Math.abs(Math.round(target - value));
  const centerTop = remaining.toLocaleString();
  const centerSub = over ? unit + ' over' : unit + ' ' + label;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img"
       aria-label="${Math.round(value)} of ${target} ${unit}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${CHART.track}" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${arcColor}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"
      transform="rotate(-90 ${size/2} ${size/2})" style="transition: stroke-dashoffset .5s ease"/>
    <text x="50%" y="47%" text-anchor="middle" fill="${CHART.ink}" font-size="${size*0.2}" font-weight="800">${centerTop}</text>
    <text x="50%" y="62%" text-anchor="middle" fill="${over ? CHART.critical : CHART.muted}" font-size="${size*0.085}">${centerSub}</text>
  </svg>`;
}

/* Sparkline: 2px line, latest-point dot + direct label. markers: array of indexes to flag (e.g. PRs). */
function sparkline(values, { w = 150, h = 40, color = CHART.blue, markers = [], fmt = v => Math.round(v), goal = null } = {}) {
  if (!values || values.length < 2) return `<span class="muted small">not enough data yet</span>`;
  const pad = 4, padR = 34;
  let min = Math.min(...values), max = Math.max(...values);
  if (goal != null) { min = Math.min(min, goal); max = Math.max(max, goal); }
  if (max === min) { max += 1; min -= 1; }
  const x = i => pad + i * (w - pad - padR) / (values.length - 1);
  const y = v => pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const li = values.length - 1;
  const goalLine = goal != null
    ? `<line x1="${pad}" x2="${w - padR + 8}" y1="${y(goal)}" y2="${y(goal)}" stroke="${CHART.baseline}" stroke-width="1" stroke-dasharray="3 3"/>` : '';
  const marks = markers.filter(i => i >= 0 && i < values.length && i !== li).map(i =>
    `<circle cx="${x(i)}" cy="${y(values[i])}" r="3" fill="${CHART.good}" stroke="var(--surface)" stroke-width="1.5"><title>PR</title></circle>`).join('');
  return `
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="trend ending at ${fmt(values[li])}">
    ${goalLine}
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${marks}
    <circle cx="${x(li)}" cy="${y(values[li])}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="1.5"/>
    <text x="${x(li) + 7}" y="${Math.min(Math.max(y(values[li]) + 4, 11), h - 2)}" fill="${CHART.ink2}" font-size="11" font-weight="600">${fmt(values[li])}</text>
  </svg>`;
}

/* Enough decimals that the three gridline labels are actually distinct — a stable
   weight week spans well under a pound and used to print "174 / 174 / 174". */
function axisDecimals(span) {
  const step = span / 4;
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

/* Line chart with dots + hairline grid, for sleep / weight / nutrition trends.
   points: [{label, value, x}] where x is an optional day offset. When x is
   present the horizontal axis is a real date scale, so a three-day logging gap
   reads as three days wide instead of being silently compressed to one step;
   segments that span a gap are dashed. */
function lineChart(points, { w = 320, h = 130, color = CHART.violet, goal = null, unit = '', yFmt = null, ySuffix = '' } = {}) {
  if (!points || points.length < 2) return `<div class="muted small center" style="padding:18px 0">Log a few more days to see your trend.</div>`;
  const padL = 34, padR = 12, padT = 12, padB = 20;
  const vals = points.map(p => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (goal != null) { min = Math.min(min, goal); max = Math.max(max, goal); }
  const span = (max - min) || 1;
  min -= span * 0.12; max += span * 0.12;
  const dec = axisDecimals(max - min);
  const fmtY = yFmt || (v => v.toFixed(dec) + ySuffix);

  const xs = points.map((p, i) => (p.x != null ? p.x : i));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const xSpan = (xMax - xMin) || 1;
  const X = i => padL + (xs[i] - xMin) / xSpan * (w - padL - padR);
  const Y = v => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);

  // grid: 3 hairlines
  let grid = '';
  for (let g = 0; g < 3; g++) {
    const gv = min + (max - min) * (g + 1) / 4;
    grid += `<line x1="${padL}" x2="${w - padR}" y1="${Y(gv)}" y2="${Y(gv)}" stroke="${CHART.grid}" stroke-width="1"/>
             <text x="${padL - 5}" y="${Y(gv) + 3.5}" text-anchor="end" fill="${CHART.muted}" font-size="10">${fmtY(gv)}</text>`;
  }
  const goalLine = goal != null
    ? `<line x1="${padL}" x2="${w - padR}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="${CHART.baseline}" stroke-width="1.5" stroke-dasharray="4 4"/>` : '';

  // one <line> per segment so gaps can be styled differently from logged runs
  let segs = '';
  for (let i = 1; i < points.length; i++) {
    const gap = xs[i] - xs[i - 1] > 1.5;
    segs += `<line x1="${X(i-1).toFixed(1)}" y1="${Y(points[i-1].value).toFixed(1)}"
      x2="${X(i).toFixed(1)}" y2="${Y(points[i].value).toFixed(1)}"
      stroke="${color}" stroke-width="2" stroke-linecap="round"
      ${gap ? `stroke-dasharray="3 3" opacity="0.55"` : ''}/>`;
  }
  const dots = points.map((p, i) =>
    `<circle cx="${X(i)}" cy="${Y(p.value)}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="1.5">
       <title>${esc(p.label)}: ${fmtY(p.value)}${unit}</title>
     </circle>`).join('');
  const first = points[0], last = points[points.length - 1];
  const gapCount = points.filter((p, i) => i > 0 && xs[i] - xs[i - 1] > 1.5).length;
  return `
  <svg width="100%" viewBox="0 0 ${w} ${h}" role="img" aria-label="trend from ${fmtY(first.value)} to ${fmtY(last.value)}${unit}">
    ${grid}${goalLine}${segs}${dots}
    <text x="${padL}" y="${h - 6}" fill="${CHART.muted}" font-size="10">${esc(first.label)}</text>
    <text x="${w - padR}" y="${h - 6}" text-anchor="end" fill="${CHART.muted}" font-size="10">${esc(last.label)}</text>
  </svg>
  ${gapCount ? `<div class="chart-note">Dashed stretches are days with nothing logged.</div>` : ''}`;
}

/* Lift outlook: logged est. max, the trend projected to a goal, and an honest
   range. One series, so no legend — the heading names it. The only dashed line
   is the projection (dashes mean "not happened yet"); the grid and the goal
   are solid hairlines. Colours are theme variables, so it works in all five.
   `o` is liftOutlook()'s result; values are kg of est. max. */
function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function outlookChart(o, { w = 320, h = 160 } = {}) {
  if (!o.points.length) return '';
  const u = wUnit();
  const disp = kg => toW(kg);
  const pts = o.points.map(p => ({ x: p.x, y: disp(p.y), date: p.date }));
  const goal = o.goalE1rm != null ? disp(o.goalE1rm) : null;
  const ok = o.status === 'ok';
  const nowY = ok ? disp(o.now) : pts[pts.length - 1].y;
  const fastD = ok ? daysBetween(todayKey(), o.etaEarly) : 0;
  const slowD = ok && o.etaLate ? daysBetween(todayKey(), o.etaLate) : null;
  const xEnd = ok ? Math.max(o.days, Math.min(slowD ?? o.days * 1.5, o.days * 2)) * 1.05 : 0;

  const padL = 40, padR = 14, padT = 18, padB = 24;
  const xMin = Math.min(...pts.map(p => p.x)), xMax = Math.max(xEnd, 1);
  const ys = pts.map(p => p.y).concat(goal != null ? [goal] : [], [nowY]);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  const span = (yMax - yMin) || 10;
  yMin -= span * 0.15; yMax += span * 0.15;
  const X = x => padL + (x - xMin) / ((xMax - xMin) || 1) * (w - padL - padR);
  const Y = v => padT + (1 - (v - yMin) / (yMax - yMin)) * (h - padT - padB);
  const f = v => v.toFixed(1);

  let grid = '';
  for (let g = 1; g <= 3; g++) {
    const gv = yMin + (yMax - yMin) * g / 4;
    grid += `<line x1="${padL}" x2="${w - padR}" y1="${f(Y(gv))}" y2="${f(Y(gv))}" stroke="var(--grid)" stroke-width="1"/>
      <text x="${padL - 6}" y="${f(Y(gv) + 3.5)}" text-anchor="end" fill="var(--muted)" font-size="10">${Math.round(gv)}</text>`;
  }
  const goalLine = goal != null ? `
    <line x1="${padL}" x2="${w - padR}" y1="${f(Y(goal))}" y2="${f(Y(goal))}" stroke="var(--muted)" stroke-width="1"/>
    <text x="${padL + 4}" y="${f(Y(goal) - 5)}" fill="var(--muted)" font-size="10">Goal ${esc(fmtGoal(o.goal))}</text>` : '';

  let proj = '';
  if (ok) {
    // range: the fan between the fast and slow quartile slopes, as a faint wash
    const slowEndX = slowD != null ? Math.min(slowD, xMax) : xMax;
    const slowEndY = slowD != null && slowD <= xMax ? goal : nowY + (goal - nowY) * (xMax / (slowD ?? xMax * 4));
    proj = `
    <polygon points="${f(X(0))},${f(Y(nowY))} ${f(X(fastD))},${f(Y(goal))} ${f(X(slowEndX))},${f(Y(slowEndY))}"
      fill="var(--blue)" opacity="0.12"/>
    <line x1="${f(X(0))}" y1="${f(Y(nowY))}" x2="${f(X(o.days))}" y2="${f(Y(goal))}"
      stroke="var(--blue)" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>
    <circle cx="${f(X(o.days))}" cy="${f(Y(goal))}" r="4.5" fill="var(--blue)" stroke="var(--surface)" stroke-width="2"/>
    <text x="${f(Math.min(X(o.days), w - padR))}" y="${f(Y(goal) - 9)}" text-anchor="${X(o.days) > w - 60 ? 'end' : 'middle'}"
      fill="var(--ink)" font-size="11" font-weight="700">~${esc(shortDate(o.eta))}</text>`;
  }

  const line = pts.length > 1
    ? `<polyline points="${pts.map(p => `${f(X(p.x))},${f(Y(p.y))}`).join(' ')}" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : '';
  const dots = pts.map(p => `
    <g><circle cx="${f(X(p.x))}" cy="${f(Y(p.y))}" r="4" fill="var(--blue)" stroke="var(--surface)" stroke-width="2"/>
    <circle cx="${f(X(p.x))}" cy="${f(Y(p.y))}" r="12" fill="transparent"><title>${esc(shortDate(p.date))}: est. max ${Math.round(p.y)} ${u}</title></circle></g>`).join('');

  const todayTick = xMax > 0 ? `
    <line x1="${f(X(0))}" x2="${f(X(0))}" y1="${padT}" y2="${h - padB}" stroke="var(--grid)" stroke-width="1"/>
    <text x="${f(X(0))}" y="${h - 8}" text-anchor="middle" fill="var(--muted)" font-size="10">Today</text>` : '';
  const aria = ok
    ? `Estimated max ${Math.round(nowY)} ${u}, projected to reach the goal around ${shortDate(o.eta)}`
    : `Estimated max over the last ${pts.length} sessions, latest ${Math.round(nowY)} ${u}`;
  return `
  <svg width="100%" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">
    <text x="4" y="11" fill="var(--muted)" font-size="10">est. max, ${u}</text>
    ${grid}${goalLine}${todayTick}${proj}${line}${dots}
    <text x="${padL}" y="${h - 8}" fill="var(--muted)" font-size="10">${esc(shortDate(pts[0].date))}</text>
  </svg>
  <details class="chart-table"><summary>Show the numbers</summary>
    <table><tr><th>Session</th><th>Est. max</th></tr>
    ${pts.map(p => `<tr><td>${esc(shortDate(p.date))}</td><td>${Math.round(p.y)} ${u}</td></tr>`).join('')}
    ${ok ? `<tr><td>Projected</td><td>goal ~${esc(shortDate(o.eta))} (${esc(shortDate(o.etaEarly))}–${o.etaLate ? esc(shortDate(o.etaLate)) : 'later'})</td></tr>` : ''}
    </table>
  </details>`;
}
function fmtGoal(g) { return g ? `${Math.round(toW(g.kg) * 10) / 10}×${g.reps}` : ''; }

/* Small horizontal macro bar (HTML) */
function macroBar(name, value, target, color, unit = 'g') {
  const pct = target > 0 ? Math.min(value / target * 100, 100) : 0;
  return `
  <div class="macro-row">
    <div class="macro-head">
      <span class="name"><span class="swatch" style="background:${color}"></span>${esc(name)}</span>
      <span class="val">${Math.round(value)} / ${target}${unit}</span>
    </div>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
}

/* Weekly bar strip: 7 tiny bars vs target (calories per day) */
function weekBars(values, target, { w = 150, h = 40, color = CHART.blue } = {}) {
  const bw = Math.floor((w - 6 * 2) / 7);
  const max = Math.max(...values, target) * 1.1 || 1;
  let bars = '';
  for (let i = 0; i < 7; i++) {
    const v = values[i] || 0;
    const bh = Math.max(Math.round(v / max * (h - 4)), v > 0 ? 3 : 1);
    const over = target > 0 && v > target;
    bars += `<rect x="${i * (bw + 2)}" y="${h - bh}" width="${bw}" height="${bh}" rx="2"
      fill="${v === 0 ? CHART.track : over ? CHART.critical : color}"><title>${Math.round(v)} kcal</title></rect>`;
  }
  const ty = target > 0 ? h - Math.round(target / max * (h - 4)) : null;
  const tline = ty != null ? `<line x1="0" x2="${w}" y1="${ty}" y2="${ty}" stroke="${CHART.baseline}" stroke-width="1" stroke-dasharray="3 3"/>` : '';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="calories last 7 days">${tline}${bars}</svg>`;
}
