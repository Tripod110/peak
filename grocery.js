/* Forge — Grocery tab: list + budget protein staples + deficit-aware suggestions */

const STAPLES = [
  { name: 'Chicken thighs (family pack)', protein: '~90g protein/lb', tag: 'cheapest meat protein' },
  { name: 'Eggs (dozen ×2)', protein: '6g each', tag: 'breakfast staple' },
  { name: 'Greek yogurt (big tub, plain)', protein: '~17g/serving', tag: 'snack / dessert base' },
  { name: 'Cottage cheese', protein: '~25g/cup', tag: 'pre-bed protein' },
  { name: 'Canned tuna / chicken (×4)', protein: '~20g/can', tag: 'shelf-stable' },
  { name: 'Ground turkey or 80/20 beef', protein: '~85g/lb', tag: 'batch-cook base' },
  { name: 'Frozen chicken breast (bag)', protein: '~26g/breast', tag: 'freezer backup' },
  { name: 'Milk (gallon)', protein: '8g/cup', tag: 'easy calories on lifting days' },
  { name: 'Rice (big bag)', protein: 'carb base', tag: 'pennies per serving' },
  { name: 'Oats (big canister)', protein: 'carb base + fiber', tag: 'breakfast' },
  { name: 'Beans / lentils (dry or canned)', protein: '~15g/cup', tag: 'fiber + protein' },
  { name: 'Frozen mixed vegetables', protein: 'micros + fiber', tag: 'no prep, never spoils' },
  { name: 'Bananas / apples', protein: 'quick carbs', tag: 'gym-bag fuel' },
  { name: 'Peanut butter', protein: '8g/2tbsp', tag: 'cheap calories' },
  { name: 'Whey protein (if budget allows)', protein: '~24g/scoop', tag: 'cost per 25g protein is hard to beat' }
];

function renderGrocery() {
  const list = getGrocery();
  const open = list.filter(i => !i.done);
  const done = list.filter(i => i.done);

  return `
  ${renderProteinNudge()}
  <div class="card">
    <h2>Shopping list <span class="h2-right">${open.length} to get</span></h2>
    <div class="row">
      <input id="g-new" class="grow" placeholder="Add item…" enterkeyhint="done">
      <button class="btn small primary" data-action="g-add">＋</button>
    </div>
    <div class="mt">
      ${list.length === 0 ? '<div class="muted center" style="padding:10px 0">List is empty — tap staples below to add.</div>' : ''}
      ${open.map(gItem).join('')}
      ${done.length ? `<div class="muted small" style="margin:10px 0 4px">In the cart</div>` + done.map(gItem).join('') : ''}
    </div>
    ${done.length ? `<button class="btn ghost mt" data-action="g-clear-done">Clear checked (${done.length})</button>` : ''}
  </div>

  <div class="card">
    <h2>Budget protein staples</h2>
    <div class="muted small" style="margin-bottom:10px">High protein per dollar. Tap to add to your list.</div>
    ${STAPLES.map((s, i) => `
      <button class="staple-chip" data-action="g-staple" data-idx="${i}">
        <span class="s-name">${esc(s.name)}</span>
        <span class="s-sub">${esc(s.protein)} · ${esc(s.tag)}</span>
      </button>`).join('')}
  </div>`;
}

function gItem(i) {
  return `
  <div class="g-item ${i.done ? 'done' : ''}" data-action="g-toggle" data-id="${i.id}">
    <div class="g-check">✓</div>
    <div class="g-name">${esc(i.name)}</div>
    <button class="x-btn" data-action="g-del" data-id="${i.id}">✕</button>
  </div>`;
}

/* If the trailing 7 days averaged well under protein target, nudge with staples */
function renderProteinNudge() {
  const p = getProfile();
  const t = computeTargets(p);
  let days = 0, sum = 0;
  for (let i = 1; i <= 7; i++) {
    const k = todayKey(-i);
    const items = foodForDay(k);
    if (items.length) { days++; sum += dayTotals(k).protein; }
  }
  if (days < 3) return '';
  const avg = sum / days;
  const gap = t.protein - avg;
  if (gap < 20) return '';
  return `<div class="alert"><span class="a-ico">🥩</span><div class="a-body">
    <b>You've averaged ${Math.round(avg)}g protein — ${Math.round(gap)}g under target.</b>
    Stock the cart accordingly: the staples below are the cheapest way to close that gap.</div></div>`;
}

function groceryAdd(name) {
  if (!name || !name.trim()) return;
  const list = getGrocery();
  if (list.some(i => i.name.toLowerCase() === name.trim().toLowerCase() && !i.done)) { toast('Already on the list'); return; }
  list.unshift({ id: 'g' + Math.random().toString(36).slice(2, 9), name: name.trim(), done: false });
  setGrocery(list);
  App.render();
}
