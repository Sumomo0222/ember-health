/* ============================================================
   燃迹 EMBER · 手写 SVG 图表（零依赖）
   ============================================================ */
'use strict';

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
/* 圆弧 path */
function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}
function fmtNum(n) { return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n); }

/* ---------- 双弧进度环 ---------- */
function renderRing(el, opts) {
  const size = opts.size || 158;
  const sw = opts.stroke || 13;
  const c = size / 2;
  const rOut = c - sw / 2 - 1;
  const rIn = rOut - sw - 5;
  const NSvg = svgEl('svg', { viewBox: `0 0 ${size} ${size}` }, el);
  svgEl('circle', { cx: c, cy: c, r: rOut, fill: 'none', stroke: 'rgba(234,248,238,.07)', 'stroke-width': sw }, NSvg);
  svgEl('circle', { cx: c, cy: c, r: rIn, fill: 'none', stroke: 'rgba(234,248,238,.06)', 'stroke-width': 6 }, NSvg);
  const arcs = opts.arcs || [];
  arcs.forEach(a => {
    const pct = Math.max(0.004, Math.min(1, a.pct));
    const path = svgEl('path', {
      d: arcPath(c, c, a.inner ? rIn : rOut, 0.5, 359.5),
      fill: 'none', stroke: a.color, 'stroke-width': a.inner ? 6 : sw,
      'stroke-linecap': 'round',
    }, NSvg);
    const total = 2 * Math.PI * (a.inner ? rIn : rOut);
    path.setAttribute('stroke-dasharray', `${total * pct} ${total}`);
    path.setAttribute('transform', `rotate(0.5 ${c} ${c})`);
    path.style.opacity = 0;
    // rAF 淡入 + 定时兜底（渲染被节流时也能显示）
    requestAnimationFrame(() => { path.style.transition = 'opacity .5s'; path.style.opacity = 1; });
    setTimeout(() => { path.style.opacity = 1; }, 500);
  });
  return NSvg;
}

/* ---------- 环形图（营养分布） ---------- */
function renderDonut(el, opts) {
  const size = opts.size || 132;
  const sw = opts.stroke || 15;
  const c = size / 2, r = c - sw / 2 - 1;
  const s = svgEl('svg', { viewBox: `0 0 ${size} ${size}` }, el);
  svgEl('circle', { cx: c, cy: c, r, fill: 'none', stroke: 'rgba(234,248,238,.06)', 'stroke-width': sw }, s);
  const segs = (opts.segs || []).filter(x => x.v > 0);
  const total = segs.reduce((a, b) => a + b.v, 0) || 1;
  let ang = 0;
  segs.forEach(sg => {
    const sweep = sg.v / total * 358.2; // 留缝
    const path = svgEl('path', {
      d: arcPath(c, c, r, ang + 0.9, ang + Math.max(1.6, sweep)),
      fill: 'none', stroke: sg.color, 'stroke-width': sw, 'stroke-linecap': 'round',
    }, s);
    ang += sweep + 1.8;
  });
  return s;
}

/* ---------- 柱状图（摄入 vs 消耗，自动聚合） ---------- */
function renderBars(el, opts) {
  const W = opts.width || 340, H = opts.height || 150;
  const pad = { l: 4, r: 4, t: 10, b: 20 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' }, el);
  const series = opts.data || [];
  const n = series.length;
  if (!n) return s;
  const maxV = Math.max(opts.max || 0, ...series.map(d => Math.max(d.a, d.b)), 1) * 1.1;

  // 横向网格 + y 轴标签
  for (let i = 1; i <= 3; i++) {
    const y = pad.t + ih - ih * i / 3;
    svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'gridline' }, s);
    svgEl('text', { x: pad.l + 2, y: y - 3, class: 'ax' }, s).textContent = fmtNum(maxV * i / 3);
  }
  // 预算虚线
  if (opts.budget) {
    const y = pad.t + ih - ih * (opts.budget / maxV);
    if (y > pad.t) {
      svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'budget-line' }, s);
      svgEl('text', { x: W - pad.r - 2, y: y - 4, class: 'ax', 'text-anchor': 'end', fill: 'rgba(201,242,77,.8)' }, s).textContent = '预算 ' + fmtNum(opts.budget);
    }
  }
  const slot = iw / n;
  const bw = Math.min(16, slot * 0.32);
  series.forEach((d, i) => {
    const x = pad.l + slot * i + slot / 2;
    const ha = ih * (d.a / maxV), hb = ih * (d.b / maxV);
    const g = svgEl('g', {}, s);
    svgEl('rect', { x: x - bw - 1.5, y: pad.t + ih - ha, width: bw, height: Math.max(1.5, ha), rx: 3.5, fill: d.ac || 'var(--lime)' }, g);
    svgEl('rect', { x: x + 1.5, y: pad.t + ih - hb, width: bw, height: Math.max(1.5, hb), rx: 3.5, fill: d.bc || 'var(--coral)' }, g);
    // x 标签
    if (d.label) {
      const t = svgEl('text', { x, y: H - 6, class: 'ax', 'text-anchor': 'middle' }, g);
      t.textContent = d.label;
    }
    // 生长动画
    g.querySelectorAll('rect').forEach((rc, ri) => {
      const hh = rc.getAttribute('height');
      rc.setAttribute('height', 0);
      rc.style.transition = `height .6s ${0.02 * i + ri * 0.05}s cubic-bezier(.2,.7,.3,1)`;
      requestAnimationFrame(() => requestAnimationFrame(() => rc.setAttribute('height', hh)));
    });
  });
  return s;
}

/* ---------- 折线 / 面积图 ---------- */
function renderLine(el, opts) {
  const W = opts.width || 340, H = opts.height || 130;
  const pad = { l: 4, r: 4, t: 12, b: 20 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' }, el);
  const pts = opts.data || [];
  const n = pts.length;
  if (!n) return s;
  const maxV = Math.max(opts.max || 0, ...pts.map(p => p.v), 1) * 1.15;
  const minV = 0;
  const X = i => pad.l + (n === 1 ? iw / 2 : iw * i / (n - 1));
  const Y = v => pad.t + ih - ih * (v - minV) / (maxV - minV || 1);

  for (let i = 1; i <= 2; i++) {
    const y = pad.t + ih - ih * i / 2.2;
    svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'gridline' }, s);
  }
  // 目标线
  if (opts.target) {
    const y = Y(opts.target);
    svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'budget-line', stroke: 'rgba(255,126,90,.45)' }, s);
  }
  // 面积渐变
  const defs = svgEl('defs', {}, s);
  const grad = svgEl('linearGradient', { id: 'lg-' + Math.random().toString(36).slice(2, 7), x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': opts.color, 'stop-opacity': .28 }, grad);
  svgEl('stop', { offset: '100%', 'stop-color': opts.color, 'stop-opacity': 0 }, grad);
  const gid = grad.getAttribute('id');

  const lineD = pts.map((p, i) => (i ? 'L' : 'M') + X(i) + ' ' + Y(p.v)).join(' ');
  svgEl('path', { d: lineD + ` L ${X(n - 1)} ${pad.t + ih} L ${X(0)} ${pad.t + ih} Z`, fill: `url(#${gid})`, stroke: 'none' }, s);
  const line = svgEl('path', { d: lineD, fill: 'none', stroke: opts.color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
  // 描线动画
  try {
    const len = line.getTotalLength();
    line.setAttribute('stroke-dasharray', len);
    line.setAttribute('stroke-dashoffset', len);
    line.style.transition = 'stroke-dashoffset .9s cubic-bezier(.3,.6,.3,1)';
    requestAnimationFrame(() => requestAnimationFrame(() => line.setAttribute('stroke-dashoffset', 0)));
  } catch (e) { }
  pts.forEach((p, i) => {
    if (n > 40 && i % 5) return;
    svgEl('circle', { cx: X(i), cy: Y(p.v), r: n > 40 ? 1.6 : 2.6, fill: opts.color, opacity: p.v > 0 ? .9 : .25 }, s);
  });
  // x 标签：首/中/尾
  [0, Math.floor((n - 1) / 2), n - 1].forEach(i => {
    if (pts[i] && pts[i].label)
      svgEl('text', { x: X(i), y: H - 5, class: 'ax', 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }, s).textContent = pts[i].label;
  });
  return s;
}

/* ---------- 水平堆叠条（营养供能比） ---------- */
function renderStack(el, opts) {
  const W = opts.width || 340, H = opts.height || 26;
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' }, el);
  const segs = (opts.segs || []).filter(x => x.v > 0);
  const total = segs.reduce((a, b) => a + b.v, 0) || 1;
  let x = 0;
  segs.forEach((sg, i) => {
    const w = Math.max(2, W * sg.v / total);
    svgEl('rect', { x, y: 3, width: w - 2, height: H - 6, rx: 5, fill: sg.color }, s);
    x += w;
  });
  return s;
}

/* ---------- 数字滚动 ---------- */
function countUp(el, to, dur, fmt) {
  const apply = v => { if (fmt) el.innerHTML = fmt(v); else el.textContent = v; };
  let done = false;
  const finish = () => { if (!done) { done = true; apply(to); } };
  const t0 = performance.now();
  const step = t => {
    if (done) return;
    const p = Math.min(1, (t - t0) / (dur || 700));
    const e = 1 - Math.pow(1 - p, 3);
    apply(Math.round(to * e));
    if (p < 1) requestAnimationFrame(step);
    else finish();
  };
  requestAnimationFrame(step);
  setTimeout(finish, (dur || 700) + 400); // 节流环境兜底
}
