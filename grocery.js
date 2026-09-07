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
  yours: { label: 'Your usuals', data: [], blurb: 'Built from what you actually log. Tap to add.' },
  staples: { label: 'Staples', data: STAPLES, blurb: 'High protein per dollar. Tap to add to your list.' },
  snacks: { label: 'Snacks', data: SNACKS, blurb: 'Quick grabs that keep protein up between meals. Tap to add.' },
  meals: { label: 'Easy meals', data: EASY_MEALS, blurb: 'Tap a meal to add all its ingredients to your list.' }
};

/* ---------- what you actually eat ----------
   Peak has been recording every logged food with a running count since v1 and
   the grocery tab ignored all of it, offering the same fifteen generic staples
   to someone who has logged the same six things for three months. `recentFoods`
   is the honest answer to "what does this person buy", so use it. */
function yourUsuals(limit) {
  const onList = new Set(getGrocery().filter(i => !i.done).map(i => foodKey(i.name)));
  return Store.get('recentFoods', [])
    .filter(f => (f.count || 1) >= 2)                 // logged twice = a habit, not a one-off
    .filter(f => !onList.has(foodKey(f.name)))
    .slice(0, limit || 18)
    .map(f => ({
      name: f.name,
      protein: f.protein ? `${Math.round(f.protein)}g protein` : `${Math.round(f.kcal || 0)} kcal`,
      tag: `logged ${f.count}×${f.lastAt ? ' · last ' + shortWhen(f.lastAt) : ''}`
    }));
}
function shortWhen(key) {
  const d = daysBetween(key, todayKey());
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d}d ago` : d < 14 ? 'last week' : `${Math.round(d / 7)}w ago`;
}

/* ---------- aisles ----------
   A flat list is fine at six items and useless at thirty — you end up walking
   the shop twice. Grouping is inferred, never asked for. */
const AISLES = [
  /* "frozen" first on purpose: frozen broccoli is bought in the freezer aisle,
     not with the fresh veg, and the produce pattern would otherwise claim it */
  { id: 'frozen', label: '🧊 Frozen', re: /\bfrozen\b|ice cream|freezer/i },
  { id: 'produce', label: '🥦 Produce', re: /lettuce|spinach|kale|broccoli|carrot|onion|potato|tomato|pepper|cucumber|banana|apple|berry|berries|orange|avocado|salad|greens|fruit|vegetable|veg\b|mushroom|garlic|lemon|lime|zucchini|asparagus|celery/i },
  { id: 'meat', label: '🥩 Meat & fish', re: /chicken|beef|turkey|pork|steak|mince|ground |bacon|sausage|salmon|tuna|shrimp|prawn|fish|lamb|jerky|deli|ham\b/i },
  { id: 'dairy', label: '🥛 Dairy & eggs', re: /milk|yogurt|yoghurt|cheese|butter|cream|egg|cottage|kefir|skyr/i },
  { id: 'pantry', label: '🥫 Pantry', re: /rice|oat|pasta|bread|tortilla|flour|sugar|bean|lentil|canned|can of|sauce|marinara|salsa|oil|vinegar|spice|seasoning|honey|granola|cereal|peanut butter|nut butter|jam|stock|broth|noodle|quinoa|couscous|cracker|popcorn|chips/i },
  { id: 'supps', label: '💊 Supplements', re: /whey|protein powder|creatine|vitamin|supplement|protein bar|shake mix/i },
  { id: 'other', label: '🛒 Other', re: /.*/ }
];
function aisleFor(name) {
  return (AISLES.find(a => a.re.test(name)) || AISLES[AISLES.length - 1]).id;
}
function groupByAisle(items) {
  const groups = new Map();
  items.forEach(i => {
    const a = i.aisle || aisleFor(i.name);
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a).push(i);
  });
  // keep AISLES order, which is roughly how a shop is laid out
  return AISLES.filter(a => groups.has(a.id)).map(a => ({ ...a, items: groups.get(a.id) }));
}

function renderGrocery() {
  const list = getGrocery();
  const open = list.filter(i => !i.done);
  const done = list.filter(i => i.done);
  const section = GROC_SECTIONS[App.grocSection] ? App.grocSection : 'staples';
  const data = sectionData(section);
  // aisles only earn their keep once the list is long enough to walk
  const grouped = open.length >= 6 ? groupByAisle(open) : null;

  return `
  ${renderProteinNudge()}
  ${renderRestockNudge()}
  <div class="card">
    <h2>Shopping list <span class="h2-right">${open.length} to get</span></h2>
    <div class="row">
      <input id="g-new" class="grow" placeholder="Add item…  (try “eggs ×2”)" enterkeyhint="done">
      <button class="btn small primary" data-action="g-add">＋</button>
    </div>
    <div class="mt">
      ${list.length === 0 ? '<div class="muted center" style="padding:10px 0">List is empty — tap something below to add it.</div>' : ''}
      ${grouped
        ? grouped.map(g => `
          <div class="aisle">${g.label} <span class="aisle-n">${g.items.length}</span></div>
          ${g.items.map(gItem).join('')}`).join('')
        : open.map(gItem).join('')}
      ${done.length ? `<div class="aisle">✓ In the cart <span class="aisle-n">${done.length}</span></div>` + done.map(gItem).join('') : ''}
    </div>
    ${done.length ? `<button class="btn ghost mt" data-action="g-clear-done">Clear checked (${done.length})</button>` : ''}
    ${grouped ? '<div class="chart-note">Grouped by aisle so you only walk the shop once. Tap an item to check it off, ＋/− to change how many.</div>' : ''}
  </div>

  <div class="card">
    <h2>Quick adds</h2>
    <div class="seg" style="margin-bottom:10px">
      ${Object.entries(GROC_SECTIONS).map(([k, s]) =>
        `<button data-action="g-section" data-v="${k}" class="${section === k ? 'on' : ''}">${s.label}</button>`).join('')}
    </div>
    <div class="muted small" style="margin-bottom:10px">${GROC_SECTIONS[section].blurb}</div>
    ${data.length ? data.map((s, i) => `
      <button class="staple-chip" data-action="g-staple" data-sec="${section}" data-idx="${i}">
        <span class="s-name">${esc(s.name)}</span>
        <span class="s-sub">${esc(s.protein)} · ${esc(s.tag)}${s.items ? ' · ' + s.items.length + ' items' : ''}</span>
      </button>`).join('')
    : `<div class="muted small">${section === 'yours'
        ? 'Nothing yet — once you have logged the same food twice it shows up here, so your shopping list builds itself out of what you actually eat.'
        : 'Nothing here.'}</div>`}
  </div>`;
}

/* "Your usuals" is computed, the rest are constants */
function sectionData(section) {
  return section === 'yours' ? yourUsuals() : GROC_SECTIONS[section].data;
}

/* ---------- restock nudge ----------
   A staple you log every few days and haven't bought in longer than that is
   about to run out. Only fires on things with enough history to have a rhythm. */
function renderRestockNudge() {
  const onList = new Set(getGrocery().filter(i => !i.done).map(i => foodKey(i.name)));
  const due = Store.get('recentFoods', [])
    .filter(f => (f.count || 0) >= 4 && f.lastAt && !onList.has(foodKey(f.name)))
    .map(f => ({ name: f.name, gap: daysBetween(f.lastAt, todayKey()) }))
    .filter(f => f.gap >= 5 && f.gap <= 21)
    .slice(0, 3);
  if (!due.length) return '';
  return `<div class="alert" style="border-left-color:var(--blue)"><span class="a-ico">🔁</span><div class="a-body">
    <b>Ran out of something?</b>
    You log ${due.map(d => esc(d.name)).join(', ')} regularly, but ${due.length > 1 ? 'none of them have' : "it hasn't"} appeared in
    ${due.length > 1 ? `${Math.min(...due.map(d => d.gap))}+ days` : `${due[0].gap} days`}.
    <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
      ${due.map(d => `<button class="btn small" data-action="g-add-name" data-name="${esc(d.name)}">＋ ${esc(d.name)}</button>`).join('')}
    </div></div></div>`;
}

/* add one entry, or a meal's whole ingredient list */
function groceryAddFromSection(sec, idx) {
  const item = sectionData(sec)[idx];
  if (!item) return;
  if (item.items) {
    const list = getGrocery();
    let n = 0;
    item.items.forEach(name => {
      if (list.some(i => i.name.toLowerCase() === name.toLowerCase() && !i.done)) return;
      list.unshift({ id: 'g' + Math.random().toString(36).slice(2, 9), name, qty: 1, done: false, aisle: aisleFor(name) });
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
  const q = i.qty || 1;
  return `
  <div class="g-item ${i.done ? 'done' : ''}">
    <button class="g-tap" data-action="g-toggle" data-id="${i.id}" aria-label="${i.done ? 'Uncheck' : 'Check off'} ${esc(i.name)}">
      <span class="g-check">✓</span>
      <span class="g-name">${esc(i.name)}${q > 1 ? ` <span class="g-qty">×${q}</span>` : ''} ${dietaryBadgesHtml(i.name)}</span>
    </button>
    <button class="g-step" data-action="g-qty" data-id="${i.id}" data-d="-1" aria-label="One fewer ${esc(i.name)}">−</button>
    <button class="g-step" data-action="g-qty" data-id="${i.id}" data-d="1" aria-label="One more ${esc(i.name)}">＋</button>
    <button class="x-btn" data-action="g-del" data-id="${i.id}" aria-label="Delete ${esc(i.name)}">✕</button>
  </div>`;
}

/* "eggs ×2" / "eggs x2" / "2 eggs" all mean the same thing at the shop */
function parseQty(raw) {
  let name = String(raw || '').trim();
  let qty = 1;
  let m = /^(\d+)\s*[x×]\s*(.+)$/i.exec(name) || /^(\d+)\s+(.+)$/.exec(name);
  if (m) { qty = Number(m[1]); name = m[2]; }
  else {
    m = /^(.+?)\s*[x×]\s*(\d+)$/i.exec(name);
    if (m) { name = m[1]; qty = Number(m[2]); }
  }
  return { name: name.trim(), qty: Math.min(Math.max(qty, 1), 99) };
}

function groceryQty(id, delta) {
  const list = getGrocery();
  const it = list.find(i => i.id === id);
  if (!it) return;
  const next = (it.qty || 1) + delta;
  if (next < 1) { setGrocery(list.filter(i => i.id !== id)); toast(`${it.name} removed`); }
  else { it.qty = next; setGrocery(list); }
  App.render();
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

/* Adding something already on the list bumps its quantity instead of refusing.
   "Already on the list" was technically true and practically useless — you
   wanted two of them. */
function groceryAdd(raw) {
  const { name, qty } = parseQty(raw);
  if (!name) return;
  const list = getGrocery();
  const existing = list.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.done);
  const warns = dietaryWarnings(name);
  const flag = warns.length ? ` — ${warns[0].tier === 1 ? '⚠ allergy flag' : 'flagged'}: ${warns.map(w => w.label).join(', ')}` : '';
  if (existing) {
    existing.qty = (existing.qty || 1) + qty;
    setGrocery(list);
    toast(`${name} ×${existing.qty}${flag}`);
  } else {
    list.unshift({ id: 'g' + Math.random().toString(36).slice(2, 9), name, qty, done: false, aisle: aisleFor(name) });
    setGrocery(list);
    if (flag) toast(`${name}${flag}`);
  }
  App.render();
}
