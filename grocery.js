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

const SNACKS = [
  { name: 'Protein bars (box)', protein: '~20g each', tag: 'gym-bag staple' },
  { name: 'Beef jerky', protein: '~10g/oz', tag: 'no fridge needed' },
  { name: 'String cheese', protein: '7g each', tag: 'grab & go' },
  { name: 'Tuna packets', protein: '~17g each', tag: 'no can opener' },
  { name: 'Cottage cheese cups', protein: '~19g each', tag: 'pre-bed protein' },
  { name: 'Greek yogurt cups', protein: '~15g each', tag: 'dessert swap' },
  { name: 'Eggs for hard-boiling', protein: '6g each', tag: 'prep a batch Sunday' },
  { name: 'Rice cakes + peanut butter', protein: 'quick carbs + fat', tag: 'pre-workout' },
  { name: 'Chocolate milk', protein: '8g/cup', tag: 'post-workout classic' },
  { name: 'Popcorn kernels', protein: 'high volume, low cal', tag: 'cutting-friendly' },
  { name: 'Trail mix', protein: 'calorie dense', tag: 'for hungrier days' },
  { name: 'Whey + banana + milk (shake)', protein: '~35g', tag: 'fastest meal there is' }
];

const EASY_MEALS = [
  { name: 'Rotisserie chicken bowls', protein: '~40g/bowl', tag: 'zero cooking', items: ['Rotisserie chicken', 'Microwave rice packets', 'Frozen stir-fry vegetables', 'Teriyaki or hot sauce'] },
  { name: 'Tuna wraps', protein: '~25g/wrap', tag: '5 minutes flat', items: ['Canned tuna (×4)', 'Tortillas', 'Mayo', 'Baby spinach'] },
  { name: 'Egg & cheese burritos', protein: '~22g each', tag: 'make a batch, freeze', items: ['Eggs (dozen)', 'Tortillas', 'Shredded cheese', 'Salsa'] },
  { name: 'Ground turkey pasta', protein: '~40g/serving', tag: 'one pot, 20 min', items: ['Ground turkey', 'Pasta', 'Marinara jar', 'Parmesan'] },
  { name: 'Sheet-pan chicken & potatoes', protein: '~45g/serving', tag: 'oven does the work', items: ['Chicken thighs (family pack)', 'Baby potatoes', 'Frozen broccoli', 'Olive oil'] },
  { name: 'Overnight oats', protein: '~30g w/ whey', tag: 'breakfast done the night before', items: ['Oats (big canister)', 'Whey protein', 'Milk', 'Peanut butter', 'Bananas'] },
  { name: '15-minute chili', protein: '~35g/bowl', tag: 'cheap, freezes great', items: ['Ground 80/20 beef', 'Canned beans', 'Canned diced tomatoes', 'Chili seasoning'] },
  { name: 'Turkey sandwiches', protein: '~25g each', tag: 'lunch autopilot', items: ['Deli turkey', 'Bread', 'Cheese slices', 'Mustard'] },
  { name: 'Chicken quesadillas', protein: '~35g each', tag: 'leftover rotisserie use', items: ['Tortillas', 'Shredded cheese', 'Rotisserie chicken', 'Salsa'] },
  { name: 'Yogurt power bowl', protein: '~25g/bowl', tag: 'no-cook breakfast', items: ['Greek yogurt (big tub, plain)', 'Granola', 'Frozen berries', 'Honey'] }
];

const GROC_SECTIONS = {
  staples: { label: 'Staples', data: STAPLES, blurb: 'High protein per dollar. Tap to add to your list.' },
  snacks: { label: 'Snacks', data: SNACKS, blurb: 'Quick grabs that keep protein up between meals. Tap to add.' },
  meals: { label: 'Easy meals', data: EASY_MEALS, blurb: 'Tap a meal to add all its ingredients to your list.' }
};

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
    <h2>Quick adds</h2>
    <div class="seg" style="margin-bottom:10px">
      ${Object.entries(GROC_SECTIONS).map(([k, s]) =>
        `<button data-action="g-section" data-v="${k}" class="${App.grocSection === k ? 'on' : ''}">${s.label}</button>`).join('')}
    </div>
    <div class="muted small" style="margin-bottom:10px">${GROC_SECTIONS[App.grocSection].blurb}</div>
    ${GROC_SECTIONS[App.grocSection].data.map((s, i) => `
      <button class="staple-chip" data-action="g-staple" data-sec="${App.grocSection}" data-idx="${i}">
        <span class="s-name">${esc(s.name)}</span>
        <span class="s-sub">${esc(s.protein)} · ${esc(s.tag)}${s.items ? ' · ' + s.items.length + ' items' : ''}</span>
      </button>`).join('')}
  </div>`;
}

/* add one entry, or a meal's whole ingredient list */
function groceryAddFromSection(sec, idx) {
  const item = GROC_SECTIONS[sec].data[idx];
  if (!item) return;
  if (item.items) {
    const list = getGrocery();
    let n = 0;
    item.items.forEach(name => {
      if (list.some(i => i.name.toLowerCase() === name.toLowerCase() && !i.done)) return;
      list.unshift({ id: 'g' + Math.random().toString(36).slice(2, 9), name, done: false });
      n++;
    });
    setGrocery(list);
    toast(n ? `Added ${n} ingredients for ${item.name}` : 'Already on the list');
    App.render();
  } else {
    groceryAdd(item.name);
  }
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
