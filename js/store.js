/* ============================================================
   燃迹 EMBER · 数据层
   localStorage 持久化 + 统计选择器 + 示例数据生成
   ============================================================ */
'use strict';

const EMBER = {};

/* ---------- 日期工具 ---------- */
const pad2 = n => String(n).padStart(2, '0');
function dkey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function keyToDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function todayKey() { return dkey(new Date()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; }
const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function fmtCN(k) { const d = keyToDate(k); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK_CN[d.getDay()]; }
function fmtShort(k) { const d = keyToDate(k); return (d.getMonth() + 1) + '/' + d.getDate(); }
function nowHM() { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

/* ---------- 默认配置 ---------- */
const DEFAULT_CHECKINS = [
  { id: 'water',   label: '喝水 2000ml',  em: '💧' },
  { id: 'bf',      label: '吃早餐',       em: '🍳' },
  { id: 'lunch',   label: '好好吃午饭',   em: '🍚' },
  { id: 'dinner',  label: '清淡晚餐',     em: '🥗' },
  { id: 'workout', label: '运动 30 分钟', em: '🏃' },
  { id: 'sleep',   label: '23:30 前入睡', em: '🌙' },
];

function blankState() {
  return {
    v: 1,
    profile: { name: '燃友', weight: 62, height: 170 },
    goals: { kcalBudget: 1900, burnGoal: 300, weeklyWorkouts: 4, weeklyCheckin: 80 },
    reminder: { enabled: false, time: '21:30', lastFired: null },
    checkins: DEFAULT_CHECKINS.map(c => ({ ...c })),
    corrections: { sigs: {}, freq: {} },
    days: {},
    meta: { seeded: false, bannerDismissed: false },
  };
}

/* ---------- 存取 ---------- */
const STORE_KEY = 'ember.health.v1';
let state = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) {
        // 补齐缺失字段（升级兼容）
        const base = blankState();
        state = Object.assign(base, s);
        state.profile = Object.assign(base.profile, s.profile || {});
        state.goals = Object.assign(base.goals, s.goals || {});
        state.reminder = Object.assign(base.reminder, s.reminder || {});
        state.corrections = Object.assign(base.corrections, s.corrections || {});
        state.meta = Object.assign(base.meta, s.meta || {});
        if (!Array.isArray(state.checkins) || !state.checkins.length) state.checkins = base.checkins;
        return;
      }
    }
  } catch (e) { console.warn('load failed', e); }
  state = blankState();
  seedDemo();
}

/* 带配额保护的保存：超出时从最旧记录开始丢弃照片 */
function saveState() {
  let dropFrom = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      const allPhotos = [];
      Object.keys(state.days).sort().forEach(k => {
        state.days[k].foods.forEach(f => { if (f.photo) allPhotos.push(f); });
        state.days[k].workouts.forEach(w => { if (w.photo) allPhotos.push(w); });
      });
      if (dropFrom >= allPhotos.length) {
        alert('存储空间不足，且已无可释放的照片缓存，请导出备份后清理数据。');
        return false;
      }
      allPhotos[dropFrom].photo = null;
      dropFrom++;
    }
  }
  return false;
}

/* ---------- 记录 CRUD ---------- */
function dayOf(k, create) {
  if (!state.days[k]) {
    if (!create) return null;
    state.days[k] = { checkins: {}, foods: [], workouts: [] };
  }
  return state.days[k];
}
function uid() { return Math.random().toString(36).slice(2, 9); }

function addFood(k, item) {
  const d = dayOf(k, true);
  item.id = uid(); item.t = nowHM();
  d.foods.push(item);
  saveState();
  return item;
}
function updateFood(k, id, patch) {
  const d = dayOf(k); if (!d) return;
  const f = d.foods.find(x => x.id === id);
  if (f) Object.assign(f, patch);
  saveState();
}
function deleteFood(k, id) {
  const d = dayOf(k); if (!d) return;
  d.foods = d.foods.filter(x => x.id !== id);
  saveState();
}
function addWorkout(k, item) {
  const d = dayOf(k, true);
  item.id = uid(); item.t = nowHM();
  d.workouts.push(item);
  saveState();
  return item;
}
function updateWorkout(k, id, patch) {
  const d = dayOf(k); if (!d) return;
  const w = d.workouts.find(x => x.id === id);
  if (w) Object.assign(w, patch);
  saveState();
}
function deleteWorkout(k, id) {
  const d = dayOf(k); if (!d) return;
  d.workouts = d.workouts.filter(x => x.id !== id);
  saveState();
}
function toggleCheckin(k, cid) {
  const d = dayOf(k, true);
  if (d.checkins[cid]) delete d.checkins[cid];
  else d.checkins[cid] = true;
  saveState();
}
function recordCorrection(sigKey, foodId) {
  state.corrections.sigs[sigKey] = foodId;
  state.corrections.freq[foodId] = (state.corrections.freq[foodId] || 0) + 1;
  saveState();
}

/* ---------- 统计选择器 ---------- */
function dayTotals(k) {
  const d = state.days[k];
  const t = { in: 0, out: 0, p: 0, c: 0, f: 0, foods: 0, workouts: 0, minutes: 0, checks: 0, checksAll: state.checkins.length };
  if (d) {
    d.foods.forEach(f => { t.in += f.kcal; t.p += f.p || 0; t.c += f.c || 0; t.f += f.f || 0; t.foods++; });
    d.workouts.forEach(w => { t.out += w.kcal; t.minutes += w.minutes; t.workouts++; });
    t.checks = Object.keys(d.checkins).length;
  }
  t.net = Math.round(t.in - t.out);
  t.p = Math.round(t.p); t.c = Math.round(t.c); t.f = Math.round(t.f);
  t.in = Math.round(t.in); t.out = Math.round(t.out);
  return t;
}

function streak() {
  let n = 0;
  let cur = new Date();
  const tk = todayKey();
  // 今天尚无内容则从昨天起算
  const t = dayTotals(tk);
  if (t.checks === 0 && t.foods === 0 && t.workouts === 0) cur = addDays(cur, -1);
  for (let i = 0; i < 400; i++) {
    const k = dkey(cur);
    const d = state.days[k];
    const has = d && (Object.keys(d.checkins).length > 0 || d.foods.length > 0 || d.workouts.length > 0);
    if (has) { n++; cur = addDays(cur, -1); } else break;
  }
  return n;
}

/* 周统计：weekStart 为周一 0 点 */
function weekStats(weekStart) {
  const days = [];
  let inSum = 0, inDays = 0, outSum = 0, workouts = 0, minutes = 0, checkSum = 0, checkMax = 0;
  for (let i = 0; i < 7; i++) {
    const k = dkey(addDays(weekStart, i));
    const t = dayTotals(k);
    days.push({ k, ...t });
    if (t.foods > 0) { inSum += t.in; inDays++; }
    outSum += t.out; workouts += t.workouts; minutes += t.minutes;
    const rate = t.checksAll ? t.checks / t.checksAll : 0;
    checkSum += rate; checkMax = Math.max(checkMax, rate);
    if (i > new Date().getDay() && dkey(weekStart) === dkey(mondayOf(new Date()))) { /* 未来日不计 */ }
  }
  const isCurrent = dkey(weekStart) === dkey(mondayOf(new Date()));
  const passed = isCurrent ? (new Date().getDay() + 6) % 7 + 1 : 7;
  const netSum = days.reduce((s, d) => s + (d.foods || d.workouts ? d.net : 0), 0);
  return {
    days,
    inAvg: inDays ? Math.round(inSum / inDays) : 0,
    outSum: Math.round(outSum),
    workouts, minutes,
    checkRate: Math.round((checkSum / passed) * 100),
    netSum: Math.round(netSum),
    best: days.filter(d => d.checksAll && d.checks === d.checksAll).map(d => d.k),
    isCurrent, passed,
  };
}

/* 周选择器列表：最近 8 周（含本周） */
function weekList() {
  const arr = [];
  let ws = mondayOf(new Date());
  for (let i = 0; i < 8; i++) {
    arr.push({ start: dkey(ws), end: dkey(addDays(ws, 6)), stats: weekStats(ws) });
    ws = addDays(ws, -7);
  }
  return arr;
}

/* 近 N 天序列（含今天） */
function rangeSeries(n) {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = dkey(addDays(new Date(), -i));
    arr.push({ k, ...dayTotals(k) });
  }
  return arr;
}

/* ---------- 示例数据（确定性随机，相对今天生成） ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const DEMO_FOODS = [
  { name: '燕麦酸奶碗', em: '🥣', meal: 'breakfast', kcal: 320, p: 14, c: 42, f: 10 },
  { name: '全麦面包 + 煎蛋', em: '🍞', meal: 'breakfast', kcal: 380, p: 18, c: 38, f: 16 },
  { name: '豆浆 + 茶叶蛋', em: '🥚', meal: 'breakfast', kcal: 260, p: 15, c: 18, f: 12 },
  { name: '鸡胸藜麦沙拉', em: '🥗', meal: 'lunch', kcal: 460, p: 38, c: 36, f: 18 },
  { name: '番茄牛肉面', em: '🍜', meal: 'lunch', kcal: 620, p: 28, c: 78, f: 20 },
  { name: '白灼虾 + 杂粮饭', em: '🍤', meal: 'lunch', kcal: 520, p: 34, c: 58, f: 12 },
  { name: '清炒时蔬 + 米饭', em: '🥬', meal: 'dinner', kcal: 420, p: 10, c: 62, f: 12 },
  { name: '香煎三文鱼', em: '🐟', meal: 'dinner', kcal: 480, p: 34, c: 12, f: 30 },
  { name: '清汤面 + 卤蛋', em: '🍲', meal: 'dinner', kcal: 390, p: 16, c: 56, f: 10 },
  { name: '苹果', em: '🍎', meal: 'snack', kcal: 95, p: 1, c: 22, f: 1 },
  { name: '无糖拿铁', em: '☕', meal: 'snack', kcal: 140, p: 8, c: 12, f: 6 },
  { name: '酸奶', em: '🥛', meal: 'snack', kcal: 120, p: 8, c: 14, f: 4 },
  { name: '麻辣香锅', em: '🌶️', meal: 'dinner', kcal: 780, p: 30, c: 66, f: 42 },
];
const DEMO_EX = [
  { type: 'run',    name: '跑步', em: '🏃', minutes: 35, kcal: 340, intensity: 'mid' },
  { type: 'walk',   name: '晚间快走', em: '🚶', minutes: 40, kcal: 180, intensity: 'low' },
  { type: 'gym',    name: '力量训练', em: '🏋️', minutes: 50, kcal: 260, intensity: 'mid' },
  { type: 'hiit',   name: 'HIIT', em: '🔥', minutes: 20, kcal: 230, intensity: 'high' },
  { type: 'cycle',  name: '骑行', em: '🚴', minutes: 60, kcal: 380, intensity: 'mid' },
  { type: 'yoga',   name: '瑜伽拉伸', em: '🧘', minutes: 30, kcal: 90, intensity: 'low' },
  { type: 'swim',   name: '游泳', em: '🏊', minutes: 45, kcal: 380, intensity: 'high' },
];

function seedDemo() {
  const rnd = mulberry32(20261125);
  const today = new Date();
  for (let i = 34; i >= 0; i--) {
    const day = addDays(today, -i);
    const k = dkey(day);
    const d = { checkins: {}, foods: [], workouts: [] };
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    // 打卡：完成度随日期越近越好
    const base = 0.45 + (34 - i) / 34 * 0.3 + (weekend ? 0.12 : 0) + rnd() * 0.2;
    state.checkins.forEach(c => { if (rnd() < base) d.checkins[c.id] = true; });
    // 饮食
    const meals = [['breakfast', 2], ['lunch', 2], ['dinner', 2], ['snack', 1]];
    meals.forEach(([meal, pool]) => {
      if (rnd() < (meal === 'snack' ? 0.55 : 0.9)) {
        const poolItems = DEMO_FOODS.filter(f => f.meal === meal);
        const f = poolItems[Math.floor(rnd() * poolItems.length)];
        const jitter = 0.85 + rnd() * 0.3;
        d.foods.push({
          id: uid(), t: '12:30', name: f.name, meal,
          kcal: Math.round(f.kcal * jitter), p: Math.round(f.p * jitter),
          c: Math.round(f.c * jitter), f: Math.round(f.f * jitter),
          photo: null, ai: rnd() < 0.5, portion: 1,
        });
      }
    });
    // 运动：每周 3-5 次
    const dow = day.getDay();
    const doEx = rnd() < (dow === 1 || dow === 3 || dow === 5 || dow === 6 ? 0.8 : 0.35);
    if (doEx) {
      const w = DEMO_EX[Math.floor(rnd() * DEMO_EX.length)];
      d.workouts.push({
        id: uid(), t: '19:00', type: w.type, name: w.name, em: w.em,
        minutes: w.minutes + Math.round(rnd() * 10), kcal: Math.round(w.kcal * (0.9 + rnd() * 0.25)),
        intensity: w.intensity, photo: null, ai: false,
      });
    }
    state.days[k] = d;
  }
  state.meta.seeded = true;
  saveState();
}
