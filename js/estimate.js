/* ============================================================
   燃迹 EMBER · 本地估算引擎
   1) 食物照片：色谱特征 → 食物库匹配 → 分量估算
   2) 用户修正会写入「色谱记忆」，同类照片下次优先命中
   3) 运动：MET 代偿法 kcal = MET × 强度系数 × 体重(kg) × 小时
   （纯前端启发式估算，结果仅供参靠，均支持手动修正）
   ============================================================ */
'use strict';

/* ---------- 食物库（每份参考量） ---------- */
const FOOD_DB = [
  { id: 'veg-stir',    name: '清炒时蔬',     em: '🥬', serving: '1 份',   kcal: 130, p: 4,  c: 12, f: 8,  sig: { h: 110, s: .45, l: .32 }, mix: 'green' },
  { id: 'avo-salad',   name: '牛油果沙拉',   em: '🥑', serving: '1 碗',   kcal: 320, p: 8,  c: 18, f: 26, sig: { h: 95,  s: .42, l: .42 }, mix: 'green' },
  { id: 'chick-salad', name: '鸡肉藜麦沙拉', em: '🥗', serving: '1 碗',   kcal: 390, p: 32, c: 30, f: 15, sig: { h: 100, s: .38, l: .40 }, mix: 'multi' },
  { id: 'rice',        name: '白米饭',       em: '🍚', serving: '1 碗',   kcal: 290, p: 6,  c: 64, f: 1,  sig: { h: 45,  s: .08, l: .82 }, mix: 'white' },
  { id: 'congee',      name: '白粥',         em: '🥣', serving: '1 碗',   kcal: 180, p: 5,  c: 38, f: 1,  sig: { h: 42,  s: .06, l: .86 }, mix: 'white' },
  { id: 'noodle-beef', name: '番茄牛肉面',   em: '🍜', serving: '1 碗',   kcal: 560, p: 26, c: 74, f: 18, sig: { h: 18,  s: .62, l: .42 }, mix: 'red' },
  { id: 'noodle-soup', name: '清汤面',       em: '🍲', serving: '1 碗',   kcal: 380, p: 14, c: 60, f: 8,  sig: { h: 38,  s: .22, l: .62 }, mix: 'white' },
  { id: 'braise-pork', name: '红烧肉',       em: '🍖', serving: '1 份',   kcal: 640, p: 24, c: 18, f: 52, sig: { h: 14,  s: .58, l: .28 }, mix: 'brown' },
  { id: 'roast-chick', name: '烤鸡胸',       em: '🍗', serving: '1 块',   kcal: 280, p: 42, c: 4,  f: 10, sig: { h: 28,  s: .48, l: .42 }, mix: 'brown' },
  { id: 'steam-fish',  name: '清蒸鱼',       em: '🐟', serving: '1 条',   kcal: 230, p: 38, c: 4,  f: 8,  sig: { h: 40,  s: .18, l: .66 }, mix: 'white' },
  { id: 'tomato-egg',  name: '番茄炒蛋',     em: '🍅', serving: '1 份',   kcal: 310, p: 12, c: 16, f: 22, sig: { h: 24,  s: .66, l: .50 }, mix: 'red' },
  { id: 'shrimp-egg',  name: '滑蛋虾仁',     em: '🍤', serving: '1 份',   kcal: 340, p: 26, c: 8,  f: 22, sig: { h: 48,  s: .42, l: .68 }, mix: 'yellow' },
  { id: 'curry-rice',  name: '咖喱鸡饭',     em: '🍛', serving: '1 盘',   kcal: 590, p: 22, c: 76, f: 20, sig: { h: 38,  s: .60, l: .52 }, mix: 'yellow' },
  { id: 'mapo-tofu',   name: '麻婆豆腐',     em: '🥘', serving: '1 份',   kcal: 380, p: 18, c: 14, f: 26, sig: { h: 16,  s: .55, l: .36 }, mix: 'red' },
  { id: 'bread',       name: '全麦面包',     em: '🍞', serving: '2 片',   kcal: 240, p: 9,  c: 38, f: 5,  sig: { h: 30,  s: .35, l: .42 }, mix: 'brown' },
  { id: 'fried-egg',   name: '煎蛋',         em: '🍳', serving: '1 个',   kcal: 160, p: 9,  c: 2,  f: 13, sig: { h: 50,  s: .70, l: .62 }, mix: 'yellow' },
  { id: 'yogurt',      name: '酸奶水果碗',   em: '🍨', serving: '1 碗',   kcal: 260, p: 12, c: 34, f: 9,  sig: { h: 340, s: .25, l: .74 }, mix: 'white' },
  { id: 'banana',      name: '香蕉',         em: '🍌', serving: '1 根',   kcal: 105, p: 1,  c: 26, f: 1,  sig: { h: 55,  s: .55, l: .70 }, mix: 'yellow' },
  { id: 'apple',       name: '苹果',         em: '🍎', serving: '1 个',   kcal: 95,  p: 1,  c: 24, f: 1,  sig: { h: 8,   s: .58, l: .46 }, mix: 'red' },
  { id: 'hotpot',      name: '火锅',         em: '🍲', serving: '1 餐',   kcal: 850, p: 42, c: 48, f: 50, sig: { h: 10,  s: .68, l: .34 }, mix: 'red' },
  { id: 'mala',        name: '麻辣香锅',     em: '🌶️', serving: '1 份',   kcal: 780, p: 30, c: 52, f: 46, sig: { h: 12,  s: .60, l: .26 }, mix: 'red' },
  { id: 'sushi',       name: '寿司拼盘',     em: '🍣', serving: '1 份',   kcal: 450, p: 18, c: 68, f: 10, sig: { h: 40,  s: .25, l: .68 }, mix: 'multi' },
  { id: 'burger',      name: '汉堡套餐',     em: '🍔', serving: '1 份',   kcal: 680, p: 26, c: 62, f: 32, sig: { h: 26,  s: .50, l: .40 }, mix: 'multi' },
  { id: 'pizza',       name: '披萨',         em: '🍕', serving: '2 块',   kcal: 620, p: 24, c: 64, f: 28, sig: { h: 26,  s: .58, l: .48 }, mix: 'yellow' },
  { id: 'luosifen',    name: '螺蛳粉',       em: '🍜', serving: '1 碗',   kcal: 620, p: 18, c: 84, f: 22, sig: { h: 20,  s: .62, l: .38 }, mix: 'red' },
  { id: 'dumpling',    name: '饺子',         em: '🥟', serving: '10 个',  kcal: 480, p: 20, c: 62, f: 16, sig: { h: 44,  s: .16, l: .74 }, mix: 'white' },
  { id: 'corn',        name: '水煮玉米',     em: '🌽', serving: '1 根',   kcal: 180, p: 6,  c: 38, f: 3,  sig: { h: 50,  s: .58, l: .60 }, mix: 'yellow' },
  { id: 'sweet-pot',   name: '蒸红薯',       em: '🍠', serving: '1 个',   kcal: 220, p: 4,  c: 50, f: 1,  sig: { h: 24,  s: .48, l: .44 }, mix: 'brown' },
  { id: 'fried-rice',  name: '蛋炒饭',       em: '🍚', serving: '1 盘',   kcal: 520, p: 14, c: 68, f: 20, sig: { h: 46,  s: .44, l: .58 }, mix: 'yellow' },
  { id: 'pork-pepper', name: '青椒肉丝',     em: '🫑', serving: '1 份',   kcal: 420, p: 22, c: 16, f: 28, sig: { h: 90,  s: .42, l: .36 }, mix: 'multi' },
  { id: 'soy-milk',    name: '豆浆',         em: '🥛', serving: '1 杯',   kcal: 90,  p: 5,  c: 10, f: 4,  sig: { h: 42,  s: .14, l: .78 }, mix: 'white' },
  { id: 'latte',       name: '拿铁咖啡',     em: '☕', serving: '1 杯',   kcal: 180, p: 9,  c: 18, f: 8,  sig: { h: 28,  s: .30, l: .46 }, mix: 'brown' },
  { id: 'milk-tea',    name: '奶茶',         em: '🧋', serving: '1 杯',   kcal: 410, p: 6,  c: 58, f: 16, sig: { h: 30,  s: .38, l: .52 }, mix: 'brown' },
  { id: 'cake',        name: '蛋糕甜品',     em: '🍰', serving: '1 块',   kcal: 420, p: 6,  c: 52, f: 22, sig: { h: 335, s: .42, l: .70 }, mix: 'pink' },
  { id: 'boil-shrimp', name: '白灼虾',       em: '🦐', serving: '1 份',   kcal: 190, p: 38, c: 4,  f: 3,  sig: { h: 18,  s: .50, l: .62 }, mix: 'pink' },
  { id: 'veggie-soup', name: '蔬菜汤',       em: '🥣', serving: '1 碗',   kcal: 130, p: 5,  c: 16, f: 5,  sig: { h: 85,  s: .32, l: .50 }, mix: 'green' },
];

/* ---------- 图像特征提取 ---------- */
/* 返回 { hue(0-360 圆均值), sat, light, mix 比例 } */
function extractFeatures(img) {
  const N = 52;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  // cover 铺满
  const r = Math.max(N / img.width, N / img.height);
  const w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (N - w) / 2, (N - h) / 2, w, h);
  const data = ctx.getImageData(0, 0, N, N).data;

  let sx = 0, sy = 0, sSum = 0, lSum = 0, cnt = 0;
  const mixN = { green: 0, red: 0, yellow: 0, brown: 0, white: 0, pink: 0, multi: 0 };
  const hueBins = new Array(12).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i] / 255, g0 = data[i + 1] / 255, b0 = data[i + 2] / 255;
    const max = Math.max(r0, g0, b0), min = Math.min(r0, g0, b0);
    const l = (max + min) / 2;
    const d0 = max - min;
    let s = max === 0 ? 0 : d0 / (1 - Math.abs(2 * l - 1) || 1);
    let h = 0;
    if (d0 !== 0) {
      if (max === r0) h = 60 * (((g0 - b0) / d0 % 6 + 6) % 6);
      else if (max === g0) h = 60 * ((b0 - r0) / d0 + 2);
      else h = 60 * ((r0 - g0) / d0 + 4);
    }
    // 忽略接近黑的暗部与全白高光
    const weight = (l > 0.06 && l < 0.965) ? (0.25 + s * 1.4) * (1 - Math.abs(l - 0.5)) : 0.02;
    sx += Math.cos(h * Math.PI / 180) * weight;
    sy += Math.sin(h * Math.PI / 180) * weight;
    sSum += s * weight; lSum += l * weight; cnt += weight;
    hueBins[Math.floor(h / 30) % 12] += weight;
    // 色系归类
    if (l > 0.8 && s < 0.22) mixN.white++;
    else if (l < 0.3) mixN.brown++;
    else if (h >= 70 && h < 165) mixN.green++;
    else if ((h < 14 || h >= 345) && s > .35) mixN.red++;
    else if (h >= 325 && h < 345 && s > .18) mixN.pink++;
    else if (h >= 30 && h < 70) mixN.yellow++;
    else if (h >= 14 && h < 30) mixN.brown++;
    else mixN.multi++;
  }
  const px = N * N;
  const hue = (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
  // 色彩丰富度：主 bin 占比越低越丰富
  const total = hueBins.reduce((a, b) => a + b, 0) || 1;
  const dominant = Math.max(...hueBins) / total;
  const mixRatio = {};
  Object.keys(mixN).forEach(k => mixRatio[k] = mixN[k] / px);
  return {
    hue, sat: sSum / (cnt || 1), light: lSum / (cnt || 1),
    dominant, richness: 1 - dominant,
    mix: mixRatio, sigKey: Math.round(hue / 24) + '|' + Math.round((sSum / (cnt || 1)) * 4) + '|' + Math.round((lSum / (cnt || 1)) * 4),
    canvas: cv,
  };
}

/* ---------- 匹配 + 学习记忆 ---------- */
function hueDist(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

function estimateFood(features) {
  // 1) 色谱记忆命中（来自用户历史修正）
  const memoId = state.corrections.sigs[features.sigKey];
  const freqB = state.corrections.freq;
  const scored = FOOD_DB.map(f => {
    let s = 0;
    s += hueDist(features.hue, f.sig.h) * 0.028;                 // 色相距离
    s += Math.abs(features.sat - f.sig.s) * 1.15;                // 饱和度差
    s += Math.abs(features.light - f.sig.l) * 1.35;              // 明度差
    s += (1 - (features.mix[f.mix] || 0)) * 0.55;                // 色系占比
    if (f.mix === 'multi') s += (features.richness - 0.45) * 0.5; // 丰富度
    s -= (freqB[f.id] || 0) * 0.045;                             // 常吃偏好
    return { f, s };
  }).sort((a, b) => a.s - b.s);

  let top = scored.slice(0, 3);
  if (memoId) {
    const memo = FOOD_DB.find(f => f.id === memoId);
    if (memo) top = [{ f: memo, s: -1, memo: true }, ...top.filter(x => x.f.id !== memoId)].slice(0, 3);
  }
  // 置信度：距离越小越高
  const best = top[0];
  let conf = best.s <= 0 ? 0.86 : Math.max(0.35, 0.88 - best.s * 1.5);
  const level = conf > 0.72 ? 'high' : conf > 0.5 ? 'mid' : 'low';

  // 按时间猜餐次
  const h = new Date().getHours();
  const meal = h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 17 ? 'snack' : h < 21 ? 'dinner' : 'snack';

  return {
    meal,
    confidence: level,
    candidates: top.map(x => ({
      db: x.f, memo: !!x.memo,
      score: x.s,
    })),
  };
}

/* 分量乘数 */
const PORTIONS = [
  { v: 0.75, label: '小份', em: '🤏' },
  { v: 1, label: '标准份', em: '🍽️' },
  { v: 1.35, label: '大份', em: '🍱' },
];

/* ---------- 运动库（MET 值） ---------- */
const EX_DB = [
  { id: 'walk',   name: '步行 / 快走', em: '🚶', met: 4.3 },
  { id: 'run',    name: '跑步',        em: '🏃', met: 9.8 },
  { id: 'cycle',  name: '骑行',        em: '🚴', met: 7.5 },
  { id: 'swim',   name: '游泳',        em: '🏊', met: 8.3 },
  { id: 'gym',    name: '力量训练',    em: '🏋️', met: 6.0 },
  { id: 'hiit',   name: 'HIIT 间歇',   em: '🔥', met: 10.0 },
  { id: 'yoga',   name: '瑜伽 / 拉伸', em: '🧘', met: 3.0 },
  { id: 'rope',   name: '跳绳',        em: '🪢', met: 11.0 },
  { id: 'ball',   name: '球类运动',    em: '🏸', met: 6.5 },
  { id: 'hike',   name: '登山 / 徒步', em: '⛰️', met: 6.3 },
  { id: 'dance',  name: '舞蹈',        em: '💃', met: 5.5 },
  { id: 'ellip',  name: '椭圆机',      em: '🌀', met: 5.0 },
  { id: 'row',    name: '划船机',      em: '🚣', met: 7.0 },
  { id: 'stretch',name: '轻活动 / 散步', em: '🌙', met: 2.5 },
];
const INTENSITY = [
  { id: 'low',  label: '低强度', k: 0.82 },
  { id: 'mid',  label: '中强度', k: 1.0 },
  { id: 'high', label: '高强度', k: 1.22 },
];

function calcBurn(met, intensityId, minutes) {
  const k = (INTENSITY.find(i => i.id === intensityId) || INTENSITY[1]).k;
  const w = state.profile.weight || 60;
  return Math.round(met * k * w * (minutes / 60));
}

/* 根据时长微调建议（截图上传场景给个初值） */
function guessWorkout(screenshot) {
  return {
    type: 'run', intensity: 'mid', minutes: 30,
    kcal: calcBurn(9.8, 'mid', 30),
  };
}

/* ---------- 图片压缩（记录缩略图 480px） ---------- */
function compressImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, maxSide / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * r);
      cv.height = Math.round(img.height * r);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', quality));
    };
    img.onerror = e => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/* 加载 dataURL/url 为 Image（估算用） */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
