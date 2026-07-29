/* Peak — volume milestone quips.
   When your weight-moved total crosses a new threshold, surface a real-world
   comparison. Every quip is drawn at random from the pool and never repeats
   until the whole pool has been used. */

const COMPARISONS = [
  { id: 'retriever', lb: 70, one: 'golden retriever', many: 'golden retrievers', emoji: '🐕' },
  { id: 'cement', lb: 94, one: 'bag of cement', many: 'bags of cement', emoji: '🧱' },
  { id: 'human', lb: 180, one: 'grown adult', many: 'grown adults', emoji: '🧍' },
  { id: 'washer', lb: 200, one: 'washing machine', many: 'washing machines', emoji: '🧺' },
  { id: 'panda', lb: 250, one: 'giant panda', many: 'giant pandas', emoji: '🐼' },
  { id: 'fridge', lb: 300, one: 'refrigerator', many: 'refrigerators', emoji: '🧊' },
  { id: 'gorilla', lb: 400, one: 'silverback gorilla', many: 'silverback gorillas', emoji: '🦍' },
  { id: 'moto', lb: 500, one: 'motorcycle', many: 'motorcycles', emoji: '🏍️' },
  { id: 'grizzly', lb: 600, one: 'grizzly bear', many: 'grizzly bears', emoji: '🐻' },
  { id: 'piano', lb: 900, one: 'grand piano', many: 'grand pianos', emoji: '🎹' },
  { id: 'polar', lb: 1000, one: 'polar bear', many: 'polar bears', emoji: '🐻‍❄️' },
  { id: 'horse', lb: 1100, one: 'horse', many: 'horses', emoji: '🐎' },
  { id: 'vending', lb: 1200, one: 'stocked vending machine', many: 'stocked vending machines', emoji: '🥤' },
  { id: 'cow', lb: 1400, one: 'dairy cow', many: 'dairy cows', emoji: '🐄' },
  { id: 'smart', lb: 1550, one: 'Smart car', many: 'Smart cars', emoji: '🚗' },
  { id: 'bison', lb: 2000, one: 'bison', many: 'bison', emoji: '🦬' },
  { id: 'bell', lb: 2080, one: 'Liberty Bell', many: 'Liberty Bells', emoji: '🔔' },
  { id: 'giraffe', lb: 2600, one: 'giraffe', many: 'giraffes', emoji: '🦒' },
  { id: 'walrus', lb: 2800, one: 'walrus', many: 'walruses', emoji: '🦭' },
  { id: 'civic', lb: 2900, one: 'Honda Civic', many: 'Honda Civics', emoji: '🚙' },
  { id: 'hippo', lb: 3500, one: 'hippo', many: 'hippos', emoji: '🦛' },
  { id: 'pickup', lb: 4700, one: 'pickup truck', many: 'pickup trucks', emoji: '🛻' },
  { id: 'rhino', lb: 5000, one: 'rhinoceros', many: 'rhinoceroses', emoji: '🦏' },
  { id: 'container', lb: 5100, one: 'empty shipping container', many: 'empty shipping containers', emoji: '📦' },
  { id: 'orca', lb: 12000, one: 'orca', many: 'orcas', emoji: '🐋' },
  { id: 'elephant', lb: 13000, one: 'African elephant', many: 'African elephants', emoji: '🐘' },
  { id: 'trex', lb: 16000, one: 'T-Rex', many: 'T-Rexes', emoji: '🦖' },
  { id: 'bus', lb: 24000, one: 'school bus', many: 'school buses', emoji: '🚌' },
  { id: 'firetruck', lb: 40000, one: 'fire truck', many: 'fire trucks', emoji: '🚒' },
  { id: 'tank', lb: 140000, one: 'M1 Abrams tank', many: 'M1 Abrams tanks', emoji: '🛡️' },
  { id: 'shuttle', lb: 172000, one: 'Space Shuttle orbiter', many: 'Space Shuttle orbiters', emoji: '🚀' },
  { id: 'bluewhale', lb: 300000, one: 'blue whale', many: 'blue whales', emoji: '🐳' },
  { id: 'jumbo', lb: 400000, one: 'empty Boeing 747', many: 'empty Boeing 747s', emoji: '✈️' },
  { id: 'loco', lb: 430000, one: 'locomotive', many: 'locomotives', emoji: '🚂' },
  { id: 'statue', lb: 450000, one: 'Statue of Liberty', many: 'Statues of Liberty', emoji: '🗽' },
  { id: 'eiffel', lb: 22000000, one: 'Eiffel Tower', many: 'Eiffel Towers', emoji: '🗼' }
];

const LIFETIME_TIERS = [10e3, 25e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2e6, 5e6, 10e6];
const WEEK_TIERS = [5e3, 10e3, 25e3, 50e3, 75e3, 100e3, 150e3];

function highestTierPassed(lb, tiers) {
  let t = 0;
  tiers.forEach(x => { if (lb >= x) t = x; });
  return t;
}

/* Monday-anchored week id, so the weekly tier resets each week */
function weekAnchor() {
  const d = new Date();
  const back = (d.getDay() + 6) % 7;   // 0 = Monday
  return todayKey(-back);
}

function fmtCount(n) {
  if (n >= 10) return Math.round(n).toLocaleString();
  return String(Math.round(n * 10) / 10);
}

/* pick an unused comparison that lands on a satisfying multiple */
function pickComparison(lb, used) {
  const fits = c => { const r = lb / c.lb; return r >= 2 && r <= 400; };
  let pool = COMPARISONS.filter(c => fits(c) && !used.includes(c.id));
  if (!pool.length) {                       // pool exhausted → start a fresh cycle
    used.length = 0;
    pool = COMPARISONS.filter(fits);
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* Called while rendering the volume card. Fires at most one new quip per
   threshold crossing and keeps showing it until the next one.
   Takes kg (the storage unit); the comparison table is in lb, so tiers and
   ratios are computed in lb while the headline number is shown in whichever
   unit the user has chosen. */
function volumeQuip(lifeKg, weekKg) {
  const st = Store.get('quips', { used: [], lifeTier: 0, weekTier: 0, weekOf: '', current: null });
  if (!Array.isArray(st.used)) st.used = [];

  const anchor = weekAnchor();
  if (st.weekOf !== anchor) { st.weekOf = anchor; st.weekTier = 0; }

  const lifeLb = kgToLb(lifeKg), weekLb = kgToLb(weekKg);
  const lt = highestTierPassed(lifeLb, LIFETIME_TIERS);
  const wt = highestTierPassed(weekLb, WEEK_TIERS);

  let fired = null;
  if (lt > (st.lifeTier || 0)) { fired = { scope: 'all-time', lb: lifeLb, kg: lifeKg }; st.lifeTier = lt; }
  else if (wt > (st.weekTier || 0)) { fired = { scope: 'this week', lb: weekLb, kg: weekKg }; st.weekTier = wt; }

  if (fired) {
    const pick = pickComparison(fired.lb, st.used);
    if (pick) {
      st.used.push(pick.id);
      // Store the DATA, not the rendered sentence. A baked-in string keeps saying
      // "lb" forever after the user switches to kg.
      st.current = { scope: fired.scope, kg: fired.kg, lb: fired.lb, pickId: pick.id, fresh: true };
    }
  }

  Store.set('quips', st);
  return st.current ? { ...st.current, text: quipText(st.current) } : null;
}

/* render a stored quip in whichever unit is active right now */
function quipText(cur) {
  if (!cur) return '';
  if (cur.text) return cur.text;                     // pre-v25 quips were pre-rendered
  const pick = COMPARISONS.find(c => c.id === cur.pickId);
  if (!pick) return '';
  const n = cur.lb / pick.lb;
  return `You've moved ${fmtWt(cur.kg)} ${wUnit()} ${cur.scope} — about ${fmtCount(n)} ${n >= 1.95 ? pick.many : pick.one} ${pick.emoji}`;
}

/* mark the current quip as seen so it stops pulsing after one view */
function settleQuip() {
  const st = Store.get('quips', null);
  if (st && st.current && st.current.fresh) { st.current.fresh = false; Store.set('quips', st); }
}

/* Migrate a pre-v25 pre-rendered quip so it re-renders in the active unit. */
(function migrateQuips() {
  const st = Store.get('quips', null);
  if (st && st.current && st.current.text && st.current.pickId == null) {
    st.current = null;      // it will re-fire on the next tier crossing
    Store.set('quips', st);
  }
})();
