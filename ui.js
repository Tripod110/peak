/* Peak — shared UI builders.
 *
 * Loads second, right after store.js and before every tab file, because these
 * are consumed by five of them. The three near-identical copies of `navRow`
 * this file replaces are what happens when shared markup lives in app.js —
 * the script that loads LAST, so nothing else can call into it at load time.
 *
 * THE LOAD-ORDER RULE: everything here may *reference* esc, icon, toast,
 * announce, App, CHART and the Store getters inside a function body, because
 * those resolve when the function runs and by then every script has loaded.
 * Nothing here may *evaluate* them at module scope. Only const tables and
 * function declarations at the top level of this file.
 *
 * THE ESCAPING RULE (D-17): a field whose name ends in `Html` is markup the
 * caller built and is responsible for; every other field is plain text and is
 * escaped here. "Everything is escaped unless the name says otherwise" is
 * greppable — "escaped unless we're sure it's safe" is what rots.
 */

/* ---------- icons ----------
   No icon font, no network: inline paths that take the text colour, so every
   theme gets them for free. */
const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  more: '<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5h9l1-12.5M9.5 7V4.5h5V7"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  dumbbell: '<path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  egg: '<path d="M12 3.5c3.3 0 6 4.4 6 8.6 0 3.9-2.7 6.4-6 6.4s-6-2.5-6-6.4c0-4.2 2.7-8.6 6-8.6z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  /* v40 */
  camera: '<path d="M4.5 8h3l1.5-2.5h6L16.5 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/>',
  cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3 4.5h2.5l2.2 10.5h10.6L20.5 8.5H6.8"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  flame: '<path d="M12 3.5s4.5 3.8 4.5 8.2A4.5 4.5 0 0 1 12 20.5a4.5 4.5 0 0 1-4.5-4.8C7.5 12 10 10.5 10 8c1.2.8 2 2 2 2s.4-4 0-6.5z"/>',
  scale: '<path d="M4 8h16M12 4.5V8M7 8l-3 6a3.2 3.2 0 0 0 6 0zM17 8l-3 6a3.2 3.2 0 0 0 6 0z"/>',
  chart: '<path d="M4 19.5h16M7 16V10M12 16V5.5M17 16v-8"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5"/>',
  reorder: '<path d="M4.5 8h15M4.5 12h15M4.5 16h15"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>'
};
function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

function emptyNote(t) { return `<div class="card"><div class="muted small">${esc(t)}</div></div>`; }

/* ---------- Explore nav rows ----------
   One builder for every tab. `view` may be null for a row whose action carries
   no data-view (a cross-tab jump). The icon slot stays emoji — that is what
   Today, Train and Food already render, and icon() SVG is for tiles, heroes,
   sheet items and buttons. Picking one per slot stops every release turning
   into an icon-churn diff. */
function navRow(action, view, ico, label, value, tone) {
  const color = tone === 'warn' ? 'var(--warning)' : tone === 'good' ? CHART.good : 'var(--muted)';
  return `
  <button class="nav-row" data-action="${action}"${view ? ` data-view="${view}"` : ''}>
    <span class="nr-ico" aria-hidden="true">${ico}</span>
    <span class="nr-label">${esc(label)}</span>
    <span class="nr-value" style="color:${color}">${esc(value)}</span>
    <span class="nr-chev" aria-hidden="true">›</span>
  </button>`;
}

/* ---------- the hero card ----------
   Every tab's home screen opens with one card that answers "what now?" — see
   DECISIONS.md D-19. Structure only; each tab decides what goes in it.

   o = { id, state:'live'|'done'|'', eyebrow, eyebrowHtml, eyebrowIcon, eyebrowTone:'good'|'live',
         title, meta, metaHtml, bodyHtml,
         actions:[{label, icon, action, data:{}, cls, disabled}] } */
function heroCard(o) {
  const dot = o.eyebrowTone === 'live' ? '<span class="live-dot" aria-hidden="true"></span> ' : '';
  /* eyebrowHtml replaces the eyebrow line outright, for a hero whose top row is
     a control rather than a label — a date stepper, say. */
  const eyebrow = o.eyebrowHtml || (o.eyebrow || o.eyebrowIcon ? `
    <div class="eyebrow${o.eyebrowTone === 'good' ? ' good' : ''}">${dot}${o.eyebrowIcon ? icon(o.eyebrowIcon) + ' ' : ''}${esc(o.eyebrow || '')}</div>` : '');
  return `
  <section class="card hero-card${o.state ? ' ' + o.state : ''}"${o.id ? ` aria-labelledby="${o.id}-title"` : ''}>
    ${eyebrow}
    <h2 class="hero-title"${o.id ? ` id="${o.id}-title"` : ''}>${esc(o.title)}</h2>
    ${o.meta ? `<div class="hero-meta">${esc(o.meta)}</div>` : ''}
    ${o.metaHtml || ''}
    ${o.bodyHtml || ''}
    ${(o.actions || []).map(a => heroAction(a)).join('')}
  </section>`;
}
function heroAction(a) {
  const data = Object.entries(a.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `
    <button class="btn ${a.cls || ''} mt" data-action="${a.action}"${data}${a.disabled ? ' disabled' : ''}>${a.icon ? icon(a.icon) + ' ' : ''}${esc(a.label)}</button>`;
}

/* [{v, l}] — the number and what it counts. */
function heroStats(items) {
  return `
    <div class="hero-stats">
      ${items.filter(Boolean).map(i => `<div><span class="hs-v">${esc(i.v)}</span><span class="hs-l">${esc(i.l)}</span></div>`).join('')}
    </div>`;
}

/* [{n, vHtml}] — a name and its already-built value markup (a prescription, a
   duration). `more` is how many rows were left off the end. */
function heroList(rows, more) {
  return `
    <ul class="hero-list">
      ${rows.map(r => `<li><span class="hl-n">${esc(r.n)}</span><span class="hl-v">${r.vHtml}</span></li>`).join('')}
      ${more > 0 ? `<li class="hl-more">+ ${more} more</li>` : ''}
    </ul>`;
}

function progressBar(done, total, label) {
  const pct = total ? Math.round(done / total * 100) : 0;
  return `<div class="wk-bar" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0"
    aria-valuemax="${esc(total)}" aria-valuenow="${esc(done)}"><span style="width:${pct}%"></span></div>`;
}

/* ---------- stat tiles ----------
   The three-up glance strip under the hero. Every tile is a real button that
   goes somewhere; a tile you cannot tap is a card, not a tile.

   o = { action, data:{}, ico, label, value, unit, valueHtml, sub, pct, ariaLabel, empty } */
function tile(o) {
  const data = Object.entries(o.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const value = o.empty
    ? `<span class="tile-v tile-empty">${esc(o.value)}</span>`
    : `<span class="tile-v">${o.valueHtml || esc(o.value)}${o.unit ? `<small> ${esc(o.unit)}</small>` : ''}</span>`;
  return `
    <button class="tile" data-action="${o.action}"${data}${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ''}>
      <span class="tile-l">${o.ico ? icon(o.ico) + ' ' : ''}${esc(o.label)}</span>
      ${value}
      ${o.sub ? `<span class="tile-s">${esc(o.sub)}</span>` : ''}
      ${o.pct != null ? `<span class="tile-bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, o.pct))}%"></span></span>` : ''}
    </button>`;
}
function tileStrip(tiles) { return `<div class="stat-tiles">${tiles.filter(Boolean).join('')}</div>`; }

/* ---------- sheets ----------
   Re-render an OPEN sheet in place. .modal is max-height:88dvh with its own
   scroll, so rebuilding it through openModal() jumps back to the top and drops
   focus — which is why "Move down" used to have to close the sheet to work.
   Keeping scrollTop and focus is what lets a sheet be operated repeatedly. */
function refreshModal(html) {
  const dlg = document.querySelector('#modal-root .modal');
  if (!dlg) return openModal(html);
  const top = dlg.scrollTop;
  const sel = dlg.contains(document.activeElement) ? focusSelector(document.activeElement) : null;
  openModal(html);
  const next = document.querySelector('#modal-root .modal');
  if (!next) return;
  next.scrollTop = top;
  if (sel) next.querySelector(sel)?.focus({ preventScroll: true });
}

/* ---------- undo ----------
   Destroying something offers Undo; it does not ask first (D-20). A confirm()
   makes you answer for an action you have not seen the result of, and it is
   the same three taps whether you meant it or not — an undo costs one tap only
   when you were wrong.

   A registry rather than a switch because the restore for a kind belongs next
   to the code that deleted it, and there are seven kinds across four files.
   One slot: the newest destruction is the one you can take back. */
const UNDO_HANDLERS = Object.create(null);
function registerUndo(kind, fn) { UNDO_HANDLERS[kind] = fn; }

function destructive(kind, data, message) {
  App.undo = { kind, ...data };
  toast(message, { label: 'Undo', action: 'undo-last' });
}

function undoLast() {
  const u = App.undo;
  if (!u) return;
  App.undo = null;
  UNDO_HANDLERS[u.kind]?.(u);
  if (App.activeSession) persistSession();
  App.render();
}
