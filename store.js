/* Peak — data layer (localStorage; keys keep the legacy "forge:" prefix so existing data survives the rename) */
const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('forge:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, val) {
    localStorage.setItem('forge:' + key, JSON.stringify(val));
  },
  remove(key) { localStorage.removeItem('forge:' + key); },

  exportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('forge:')) out[k] = localStorage.getItem(k);
    }
    return JSON.stringify({ app: 'peak', version: 1, exported: new Date().toISOString(), data: out }, null, 2);
  },
  importAll(json) {
    const parsed = JSON.parse(json);
    if (!parsed || (parsed.app !== 'peak' && parsed.app !== 'forge') || !parsed.data) throw new Error('Not a Peak backup file');
    Object.entries(parsed.data).forEach(([k, v]) => localStorage.setItem(k, v));
  }
};

/* ---------- dates ---------- */
function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateKey(d);
}
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function daysBetween(k1, k2) {
  return Math.round((new Date(k2) - new Date(k1)) / 86400000);
}
/* display a stored "HH:MM" (24h) per the user's time-format setting */
function fmtTime(hhmm) {
  if (!hhmm) return '';
  if (getSettings().timeFmt === '24') return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/* ---------- profile & targets ---------- */
function getProfile() { return Store.get('profile', null); }
function setProfile(p) { Store.set('profile', p); }
function getSettings() {
  const s = Store.get('settings', {});
  return { apiKey: '', model: 'claude-opus-4-8', timeFmt: '12', ...s };
}
function setSettings(s) { Store.set('settings', s); }

const ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
const GOAL_ADJ = { cut: 0.80, slowcut: 0.90, recomp: 1.0, bulk: 1.10 };
const GOAL_LABEL = { cut: 'Fat loss', slowcut: 'Slow cut', recomp: 'Recomp', bulk: 'Lean bulk' };

function computeTargets(p) {
  // Mifflin-St Jeor
  const w = p.weightKg, h = p.heightCm, a = p.age;
  const bmr = p.sex === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;
  const tdee = bmr * (ACTIVITY_MULT[p.activity] || 1.55);
  let kcal = Math.round(tdee * (GOAL_ADJ[p.goal] ?? 0.85) / 10) * 10;
  const floor = p.sex === 'male' ? 1500 : 1200;
  kcal = Math.max(kcal, floor);
  // protein: higher on a cut to protect muscle
  const proteinPerKg = (p.goal === 'cut' || p.goal === 'slowcut') ? 2.2 : 1.8;
  const protein = Math.round(w * proteinPerKg);
  const fat = Math.round(Math.max(w * 0.8, kcal * 0.20 / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, tdee: Math.round(tdee), bmr: Math.round(bmr) };
}

/* units */
function kgToLb(kg) { return kg * 2.20462; }
function lbToKg(lb) { return lb / 2.20462; }
function cmToFtIn(cm) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  return { ft, inch: Math.round(totalIn - ft * 12) };
}

/* ---------- food log ---------- */
function getFoodLog() { return Store.get('food', {}); }
function foodForDay(key) { return getFoodLog()[key] || []; }
function addFoodEntry(key, entry) {
  const log = getFoodLog();
  if (!log[key]) log[key] = [];
  entry.id = 'f' + Math.random().toString(36).slice(2, 9);
  entry.time = new Date().toTimeString().slice(0, 5);
  log[key].push(entry);
  Store.set('food', log);
  rememberRecentFood(entry);
  return entry;
}
function removeFoodEntry(key, id) {
  const log = getFoodLog();
  log[key] = (log[key] || []).filter(e => e.id !== id);
  Store.set('food', log);
}
function dayTotals(key) {
  return foodForDay(key).reduce((t, e) => ({
    kcal: t.kcal + (e.kcal || 0), protein: t.protein + (e.protein || 0),
    carbs: t.carbs + (e.carbs || 0), fat: t.fat + (e.fat || 0),
    fiber: t.fiber + (e.fiber || 0)
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}
function rememberRecentFood(entry) {
  let rec = Store.get('recentFoods', []);
  rec = rec.filter(r => r.name.toLowerCase() !== entry.name.toLowerCase());
  rec.unshift({ name: entry.name, kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber || 0, quality: entry.quality ?? 5 });
  Store.set('recentFoods', rec.slice(0, 20));
}

/* nutrition quality score for a day: 0-100 */
function nutritionScore(key) {
  const items = foodForDay(key);
  if (!items.length) return null;
  const totals = dayTotals(key);
  const t = computeTargets(getProfile());
  // calorie-weighted average of item quality (0-10 -> 0-70)
  let wsum = 0, qsum = 0;
  items.forEach(i => { const w = Math.max(i.kcal || 0, 1); wsum += w; qsum += w * (i.quality ?? 5); });
  const qualityPts = (qsum / wsum) * 7;
  // protein adherence (0-30)
  const proteinPts = Math.min(totals.protein / t.protein, 1) * 30;
  return Math.round(Math.min(100, qualityPts + proteinPts));
}

/* ---------- body weight ---------- */
function getWeights() { return Store.get('weights', []); }
function logWeight(kg) {
  let ws = getWeights().filter(w => w.date !== todayKey());
  ws.push({ date: todayKey(), kg });
  ws.sort((a, b) => a.date < b.date ? -1 : 1);
  Store.set('weights', ws);
  const p = getProfile();
  if (p) { p.weightKg = kg; setProfile(p); }
}

/* ---------- workouts ---------- */
function getWorkouts() { return Store.get('workouts', []); }
function saveWorkout(session) {
  const all = getWorkouts();
  const idx = all.findIndex(s => s.id === session.id);
  if (idx >= 0) all[idx] = session; else all.push(session);
  Store.set('workouts', all);
}
function deleteWorkout(id) {
  Store.set('workouts', getWorkouts().filter(s => s.id !== id));
}

/* ---------- sleep ---------- */
function getSleep() { return Store.get('sleep', {}); }
function setSleepEntry(key, entry) {
  const s = getSleep();
  s[key] = entry;
  Store.set('sleep', s);
}

/* ---------- grocery ---------- */
function getGrocery() { return Store.get('grocery', []); }
function setGrocery(list) { Store.set('grocery', list); }
