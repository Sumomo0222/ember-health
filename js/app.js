/* ============================================================
   燃迹 EMBER · 主应用
   ============================================================ */
'use strict';

let currentTab = 'today';
let trendsRange = 7;
let currentWeekIdx = 0; // 0 = 本周

/* ================= 工具 ================= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function greetWord() {
  const h = new Date().getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
function pct(a, b) { return b > 0 ? Math.min(1.15, a / b) : 0; }

/* ================= Toast / Modal ================= */
function toast(msg, em = '✨') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="em">${em}</span><span>${msg}</span>`;
  $('#layerToast').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2200);
}
function confirmModal({ title, msg, okText = '确定', danger = false }) {
  return new Promise(resolve => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <h3>${title}</h3><p>${msg}</p>
        <div class="acts">
          <button class="btn btn-ghost" data-r="0">取消</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-pri'}" data-r="1">${okText}</button>
        </div>
      </div>`;
    mask.addEventListener('click', e => {
      const r = e.target.dataset.r;
      if (r !== undefined || e.target === mask) { mask.remove(); resolve(r === '1'); }
    });
    $('#layerModal').appendChild(mask);
  });
}

/* ================= 底部弹层 ================= */
let sheetAlive = null;
function openSheet({ title, sub, html, onMount }) {
  closeSheet();
  const mask = document.createElement('div');
  mask.className = 'sheet-mask';
  mask.innerHTML = `
    <div class="sheet grabber">
      <div class="sheet-head">
        <div class="sheet-title">${title}${sub ? `<small>${sub}</small>` : ''}</div>
        <button class="sheet-x"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
      </div>
      <div class="sheet-body">${html}</div>
    </div>`;
  const close = () => { mask.remove(); sheetAlive = null; };
  mask.querySelector('.sheet-x').addEventListener('click', close);
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
  $('#layerSheet').appendChild(mask);
  sheetAlive = close;
  if (onMount) onMount(mask.querySelector('.sheet'), close);
  return close;
}
function closeSheet() { if (sheetAlive) sheetAlive(); }

/* ================= 路由 ================= */
let settleTimer = null;
function switchTab(tab) {
  currentTab = tab;
  // 入场动画结束后强制 settle，防止渲染被节流时内容停在透明态
  document.body.classList.remove('settle');
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => document.body.classList.add('settle'), 950);
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.view').forEach(v => v.classList.remove('active'));
  const view = $('#view-' + tab);
  view.classList.add('active');
  ({ today: renderToday, trends: renderTrends, report: renderReport, me: renderMe }[tab])();
  window.scrollTo({ top: 0 });
}
function rerender() {
  $('#streakNum').textContent = streak();
  switchTab(currentTab);
}

/* ================= 今日视图 ================= */
function renderToday() {
  const tk = todayKey();
  const t = dayTotals(tk);
  $('#dateLabel').textContent = 'TODAY';
  $('#greetText').innerHTML = `${greetWord()}<small>${fmtCN(tk)} · 一切记录都算数</small>`;
  $('#seedBanner').innerHTML = (state.meta.seeded && !state.meta.bannerDismissed)
    ? `<div class="card" style="padding:13px 16px;border-color:rgba(255,198,92,.3)">
         <div style="display:flex;gap:10px;align-items:center">
           <span style="font-size:18px">🧪</span>
           <div style="flex:1;font-size:12px;color:var(--ink2);line-height:1.6">
             <b style="color:var(--amber)">示例数据模式</b> · 看板预载了 35 天演示数据，去「我的 → 数据」清空后开始你的记录
           </div>
           <button id="seedDismiss" style="color:var(--ink3);font-size:16px;padding:4px">✕</button>
         </div></div>` : '';
  const dis = $('#seedDismiss');
  if (dis) dis.addEventListener('click', () => { state.meta.bannerDismissed = true; saveState(); rerender(); });

  const stack = $('#todayStack');
  stack.innerHTML = '';
  stack.appendChild(heroCard(tk, t));
  stack.appendChild(checkinCard(tk, t));
  stack.appendChild(macroCard(tk, t));
  stack.appendChild(goalCard(tk, t));
  stack.appendChild(recordsCard(tk));
  stack.appendChild(weekPreviewCard());
  stack.insertAdjacentHTML('beforeend', `<div class="foot-note">燃迹 EMBER · 数据仅保存在本机浏览器</div>`);
}

/* ---- 热量主卡 ---- */
function heroCard(tk, t) {
  const card = document.createElement('div');
  card.className = 'card hero';
  const budget = state.goals.kcalBudget;
  const net = t.net;
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title"><span class="dot"></span>今日能量</div>
      <div class="card-sub">预算 ${budget} kcal</div>
    </div>
    <div class="hero-grid">
      <div class="ring-wrap" id="heroRing">
        <div class="ring-center">
          <div class="big" id="heroNet">0</div>
          <div class="unit">NET · KCAL</div>
          <div class="cap">净摄入</div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hstat in">
          <div class="ico">🍽️</div>
          <div><div class="lbl">已摄入</div><div class="val" id="heroIn">0<small>kcal</small></div></div>
          <div class="tail">${t.foods} 项记录</div>
        </div>
        <div class="hstat out">
          <div class="ico">🔥</div>
          <div><div class="lbl">运动消耗</div><div class="val" id="heroOut">0<small>kcal</small></div></div>
          <div class="tail">${t.minutes} 分钟</div>
        </div>
        <div class="hstat net">
          <div class="ico">🎯</div>
          <div><div class="lbl">预算余量</div><div class="val" id="heroLeft">0<small>kcal</small></div></div>
          <div class="tail"></div>
        </div>
      </div>
    </div>
    <div class="hero-foot">
      <div class="mini-chip"><div class="k">CHECK-IN</div><div class="v">${t.checks}<small>/${t.checksAll} 打卡</small></div></div>
      <div class="mini-chip"><div class="k">PROTEIN</div><div class="v">${t.p}<small>g 蛋白质</small></div></div>
      <div class="mini-chip"><div class="k">STATUS</div><div class="v" id="heroStatus">—</div></div>
    </div>`;
  // 环形
  const wrap = card.querySelector('#heroRing');
  const ring = renderRing(wrap, {
    size: 158, stroke: 13,
    arcs: [
      { pct: pct(t.in, budget), color: 'var(--lime)' },
      { pct: pct(t.out, state.goals.burnGoal), color: 'var(--coral)', inner: true },
    ],
  });
  wrap.insertBefore(ring, wrap.firstChild);
  countUp(card.querySelector('#heroNet'), net, 800);
  const inEl = card.querySelector('#heroIn'); inEl.innerHTML = ''; countUp(inEl, t.in, 800, v => v + '<small>kcal</small>');
  const outEl = card.querySelector('#heroOut'); outEl.innerHTML = ''; countUp(outEl, t.out, 800, v => v + '<small>kcal</small>');
  const leftEl = card.querySelector('#heroLeft'); countUp(leftEl, budget - t.in, 800, v => (v > 0 ? v : '+' + (-v)) + '<small>kcal</small>');
  const st = card.querySelector('#heroStatus');
  if (t.foods === 0 && t.workouts === 0) st.innerHTML = '<small>待开始</small>';
  else if (t.in > budget) st.innerHTML = '<small style="color:var(--coral)">超预算</small>';
  else st.innerHTML = `<small style="color:var(--mint)">预算内</small>`;
  return card;
}

/* ---- 打卡卡 ---- */
function checkinCard(tk, t) {
  const card = document.createElement('div');
  card.className = 'card';
  const ratio = t.checksAll ? t.checks / t.checksAll : 0;
  const msgs = ['从一次打卡开始 💧', '节奏不错，继续 🌱', '过半了，状态在线 ⚡', '就差一点，冲 🚀', '全部完成，完美一天 🏆'];
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title"><span class="dot" style="background:var(--mint)"></span>每日打卡</div>
      <button class="link-btn" id="ckEdit">管理</button>
    </div>
    <div class="checkin-top">
      <div class="checkin-count"><b>${t.checks}</b><span>/${t.checksAll}</span></div>
      <div class="checkin-track">
        <div class="gbar"><i style="width:${ratio * 100}%;background:linear-gradient(90deg,var(--mint),var(--lime))"></i></div>
        <div class="checkin-msg">${msgs[Math.min(4, Math.floor(ratio * 5))]}</div>
      </div>
    </div>
    <div class="ck-grid">
      ${state.checkins.map(c => `
        <button class="ck ${state.days[tk]?.checkins[c.id] ? 'on' : ''}" data-ck="${c.id}">
          <span class="em">${c.em}</span>
          <span class="nm">${esc(c.label)}</span>
          <span class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M4 12.5l5.2 5L20 6.5"/></svg></span>
        </button>`).join('')}
    </div>`;
  card.querySelectorAll('[data-ck]').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleCheckin(tk, btn.dataset.ck);
      btn.classList.toggle('on');
      const now = dayTotals(tk);
      card.querySelector('.checkin-count').innerHTML = `<b>${now.checks}</b><span>/${now.checksAll}</span>`;
      card.querySelector('.gbar i').style.width = (now.checksAll ? now.checks / now.checksAll * 100 : 0) + '%';
      card.querySelector('.checkin-msg').textContent = msgs[Math.min(4, Math.floor(now.checks / Math.max(1, now.checksAll) * 5))];
      $('#streakNum').textContent = streak();
      toast(now.checks > t.checks ? '打卡成功' : '已取消打卡', now.checks > t.checks ? '✅' : '↩️');
    });
  });
  card.querySelector('#ckEdit').addEventListener('click', openCheckinManage);
  return card;
}

/* ---- 营养卡 ---- */
function macroCard(tk, t) {
  const card = document.createElement('div');
  card.className = 'card';
  const P = t.p * 4, C = t.c * 4, F = t.f * 9;
  const kcalTotal = P + C + F;
  const budget = state.goals.kcalBudget;
  const tgt = { p: budget * 0.25 / 4, c: budget * 0.5 / 4, f: budget * 0.25 / 9 };
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title"><span class="dot" style="background:var(--amber)"></span>营养分布</div>
      <div class="card-sub">供能比 · 参考 25/50/25</div>
    </div>
    ${t.foods === 0 ? `
      <div class="empty">
        <span class="em">📸</span>
        <p>今天还没有饮食记录，拍一张照片，AI 帮你估算热量与营养成分</p>
        <button class="btn btn-pri btn-sm" id="macroCta">📷 拍照识餐</button>
      </div>` : `
      <div class="macro-grid">
        <div class="donut-wrap" id="macroDonut">
          <div class="donut-center">
            <div class="big">${t.in}</div>
            <div class="unit">KCAL</div>
          </div>
        </div>
        <div class="macro-rows">
          <div class="mrow">
            <div class="top"><span class="nm"><i style="background:var(--mint)"></i>蛋白质</span>
              <span class="gv"><b>${t.p}g</b> / ${Math.round(tgt.p)}g · ${kcalTotal ? Math.round(P / kcalTotal * 100) : 0}%</span></div>
            <div class="mbar"><i style="width:${Math.min(100, t.p / tgt.p * 100)}%;background:var(--mint)"></i></div>
          </div>
          <div class="mrow">
            <div class="top"><span class="nm"><i style="background:var(--amber)"></i>碳水</span>
              <span class="gv"><b>${t.c}g</b> / ${Math.round(tgt.c)}g · ${kcalTotal ? Math.round(C / kcalTotal * 100) : 0}%</span></div>
            <div class="mbar"><i style="width:${Math.min(100, t.c / tgt.c * 100)}%;background:var(--amber)"></i></div>
          </div>
          <div class="mrow">
            <div class="top"><span class="nm"><i style="background:var(--rose)"></i>脂肪</span>
              <span class="gv"><b>${t.f}g</b> / ${Math.round(tgt.f)}g · ${kcalTotal ? Math.round(F / kcalTotal * 100) : 0}%</span></div>
            <div class="mbar"><i style="width:${Math.min(100, t.f / tgt.f * 100)}%;background:var(--rose)"></i></div>
          </div>
        </div>
      </div>`}`;
  if (t.foods > 0) {
    const dw = card.querySelector('#macroDonut');
    const donut = renderDonut(dw, { size: 132, stroke: 15, segs: [
      { v: P, color: 'var(--mint)' }, { v: C, color: 'var(--amber)' }, { v: F, color: 'var(--rose)' },
    ] });
    dw.insertBefore(donut, dw.firstChild);
  }
  const cta = card.querySelector('#macroCta');
  if (cta) cta.addEventListener('click', () => $('#fileFood').click());
  return card;
}

/* ---- 目标进度卡 ---- */
function goalCard(tk, t) {
  const card = document.createElement('div');
  card.className = 'card';
  const ws = weekStats(mondayOf(new Date()));
  const g = state.goals;
  const wkPct = Math.min(100, ws.workouts / g.weeklyWorkouts * 100);
  const burnPct = Math.min(100, t.out / g.burnGoal * 100);
  const ckPct = Math.min(100, ws.checkRate / g.weeklyCheckin * 100);
  const bar = (v, color) => `<div class="gbar"><i style="width:${v}%;background:${color}"></i></div>`;
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title"><span class="dot" style="background:var(--coral)"></span>健身目标</div>
      <div class="card-sub">在「我的」中调整目标</div>
    </div>
    <div class="goal-row">
      <div class="goal-top"><span class="goal-nm">🔥 今日运动消耗</span>
        <span class="goal-vl">${t.out}<small> / ${g.burnGoal} kcal</small></span></div>
      ${bar(burnPct, 'linear-gradient(90deg,var(--coral),#FFA24E)')}
    </div>
    <div class="goal-row">
      <div class="goal-top"><span class="goal-nm">🏋️ 本周运动次数</span>
        <span class="goal-vl">${ws.workouts}<small> / ${g.weeklyWorkouts} 次 · ${ws.minutes} 分钟</small></span></div>
      ${bar(wkPct, 'linear-gradient(90deg,#A8D63B,var(--lime))')}
    </div>
    <div class="goal-row">
      <div class="goal-top"><span class="goal-nm">✅ 本周打卡率</span>
        <span class="goal-vl">${ws.checkRate}%<small> / 目标 ${g.weeklyCheckin}%</small></span></div>
      ${bar(ckPct, 'linear-gradient(90deg,#4EC98F,var(--mint))')}
    </div>`;
  return card;
}

/* ---- 今日记录卡 ---- */
function recordsCard(tk) {
  const card = document.createElement('div');
  card.className = 'card';
  const d = state.days[tk];
  const items = [];
  if (d) {
    d.foods.forEach(f => items.push({ kind: 'food', t: f.t, f }));
    d.workouts.forEach(w => items.push({ kind: 'workout', t: w.t, w }));
  }
  items.sort((a, b) => (a.t || '').localeCompare(b.t || ''));
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title"><span class="dot" style="background:var(--sky)"></span>今日记录</div>
      <button class="link-btn" id="recToTrends">历史趋势</button>
    </div>
    ${items.length === 0 ? `
      <div class="empty">
        <span class="em">🗒️</span>
        <p>还没有记录。点下方 <b style="color:var(--lime)">＋</b> 记一餐或一次运动，所有估算都可以手动修正</p>
      </div>` : `
      <div class="rec-list">
        ${items.map(it => it.kind === 'food'
          ? `<button class="rec kcal-in" data-ef="${it.f.id}">
              <span class="thumb">${it.f.photo ? `<img src="${it.f.photo}" alt="">` : (it.f.em || '🍽️')}</span>
              <span class="mid"><span class="nm">${esc(it.f.name)}</span>
                <span class="meta">${mealName(it.f.meal)} · ${it.f.t || ''}${it.f.ai ? ' <span class="tag ' + (it.f.fixed ? 'fix' : 'ai') + '">' + (it.f.fixed ? '已修正' : 'AI 估算') + '</span>' : ''}</span>
              </span>
              <span class="kcal">+${it.f.kcal}<small> kcal</small></span>
            </button>`
          : `<button class="rec kcal-out" data-ew="${it.w.id}">
              <span class="thumb">${it.w.photo ? `<img src="${it.w.photo}" alt="">` : (it.w.em || '🏋️')}</span>
              <span class="mid"><span class="nm">${esc(it.w.name)}</span>
                <span class="meta">${it.w.minutes} 分钟 · ${intensityName(it.w.intensity)} · ${it.w.t || ''}${it.w.photo ? ' <span class="tag ai">截图凭证</span>' : ''}</span>
              </span>
              <span class="kcal">−${it.w.kcal}<small> kcal</small></span>
            </button>`).join('')}
      </div>`}`;
  card.querySelector('#recToTrends').addEventListener('click', () => switchTab('trends'));
  card.querySelectorAll('[data-ef]').forEach(b => b.addEventListener('click', () => openEditFood(tk, b.dataset.ef)));
  card.querySelectorAll('[data-ew]').forEach(b => b.addEventListener('click', () => openEditWorkout(tk, b.dataset.ew)));
  return card;
}

/* ---- 上周报告速览 ---- */
function weekPreviewCard() {
  const weeks = weekList();
  const last = weeks[1].stats;
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-head">
      <div class="card-title"><span class="dot" style="background:var(--rose)"></span>上周速览</div>
      <button class="link-btn" id="prevToReport">查看完整周报</button>
    </div>
    <div class="trends-summary">
      <div class="tsum"><div class="v" style="color:var(--lime)">${last.inAvg}</div><div class="k">日均摄入 kcal</div></div>
      <div class="tsum"><div class="v" style="color:var(--coral)">${last.workouts}</div><div class="k">运动 ${last.minutes} 分钟</div></div>
      <div class="tsum"><div class="v" style="color:var(--mint)">${last.checkRate}%</div><div class="k">打卡率</div></div>
    </div>`;
  card.querySelector('#prevToReport').addEventListener('click', () => { currentWeekIdx = 1; switchTab('report'); });
  return card;
}

/* ================= 趋势视图 ================= */
function renderTrends() {
  const n = trendsRange;
  $('#rangeChips').innerHTML = [7, 30, 90].map(v =>
    `<button class="chip ${v === n ? 'on' : ''}" data-range="${v}">${v} 天</button>`).join('');
  $$('#rangeChips .chip').forEach(c => c.addEventListener('click', () => { trendsRange = +c.dataset.range; renderTrends(); }));

  const series = rangeSeries(n);
  const stack = $('#trendsStack');
  stack.innerHTML = '';

  // 汇总块
  const daysLogged = series.filter(s => s.foods > 0 || s.workouts > 0).length;
  const inAvg = Math.round(series.filter(s => s.foods > 0).reduce((a, s) => a + s.in, 0) / Math.max(1, series.filter(s => s.foods > 0).length));
  const outSum = series.reduce((a, s) => a + s.out, 0);
  const ckRate = Math.round(series.reduce((a, s) => a + (s.checksAll ? s.checks / s.checksAll : 0), 0) / n * 100);
  const sumCard = document.createElement('div');
  sumCard.className = 'card';
  sumCard.innerHTML = `
    <div class="card-head"><div class="card-title"><span class="dot"></span>近 ${n} 天总览</div>
    <div class="card-sub">${daysLogged} 天有记录</div></div>
    <div class="trends-summary">
      <div class="tsum"><div class="v" style="color:var(--lime)">${inAvg}</div><div class="k">日均摄入 kcal</div></div>
      <div class="tsum"><div class="v" style="color:var(--coral)">${outSum}</div><div class="k">累计消耗 kcal</div></div>
      <div class="tsum"><div class="v" style="color:var(--mint)">${ckRate}%</div><div class="k">平均打卡率</div></div>
    </div>
    <div class="chart-block">
      <div class="chart-title"><span class="t">摄入 vs 运动消耗</span>
        <span class="lg"><span><i style="background:var(--lime)"></i>摄入</span><span><i style="background:var(--coral)"></i>消耗</span></span></div>
      <div id="chBars"></div>
      <div class="chart-note">${n > 16 ? '长周期自动按区间聚合为均值' : '绿色虚线为每日热量预算'}</div>
    </div>`;
  stack.appendChild(sumCard);
  renderBars(sumCard.querySelector('#chBars'), {
    data: aggregate(series, n).map(b => ({ a: b.in, b: b.out, label: b.label })),
    budget: n <= 16 ? state.goals.kcalBudget : 0,
    max: state.goals.kcalBudget, width: 360, height: 150,
  });

  // 运动分钟 + 打卡率
  const chCard = document.createElement('div');
  chCard.className = 'card';
  chCard.innerHTML = `
    <div class="chart-block">
      <div class="chart-title"><span class="t">运动分钟</span><span class="lg"><span><i style="background:var(--coral)"></i>目标 ${state.goals.burnGoal >= 60 ? 30 : 30} 分钟/日 参考</span></span></div>
      <div id="chMove"></div>
    </div>
    <div class="chart-block" style="margin-top:14px">
      <div class="chart-title"><span class="t">打卡完成率</span><span class="lg"><span><i style="background:var(--mint)"></i>每日完成 %</span></span></div>
      <div id="chCk"></div>
    </div>`;
  stack.appendChild(chCard);
  const mvAgg = aggregate(series, n);
  renderLine(chCard.querySelector('#chMove'), {
    data: mvAgg.map(b => ({ v: b.minutes, label: b.label })), color: 'var(--coral)', width: 360, height: 120,
  });
  renderLine(chCard.querySelector('#chCk'), {
    data: mvAgg.map(b => ({ v: b.ck, label: b.label })), color: 'var(--mint)', width: 360, height: 120, max: 100,
  });

  // 营养均值
  const pAvg = Math.round(series.reduce((a, s) => a + s.p, 0) / n);
  const cAvg = Math.round(series.reduce((a, s) => a + s.c, 0) / n);
  const fAvg = Math.round(series.reduce((a, s) => a + s.f, 0) / n);
  const macroCard2 = document.createElement('div');
  macroCard2.className = 'card';
  macroCard2.innerHTML = `
    <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--amber)"></span>营养日均</div>
    <div class="card-sub">蛋白质 / 碳水 / 脂肪</div></div>
    <div id="chStack" style="margin-bottom:12px"></div>
    <div class="trends-summary">
      <div class="tsum"><div class="v" style="color:var(--mint)">${pAvg}<small style="font-size:11px;color:var(--ink3)">g</small></div><div class="k">蛋白质 · ${Math.round(pAvg * 4)} kcal</div></div>
      <div class="tsum"><div class="v" style="color:var(--amber)">${cAvg}<small style="font-size:11px;color:var(--ink3)">g</small></div><div class="k">碳水 · ${Math.round(cAvg * 4)} kcal</div></div>
      <div class="tsum"><div class="v" style="color:var(--rose)">${fAvg}<small style="font-size:11px;color:var(--ink3)">g</small></div><div class="k">脂肪 · ${Math.round(fAvg * 9)} kcal</div></div>
    </div>`;
  stack.appendChild(macroCard2);
  renderStack(macroCard2.querySelector('#chStack'), { segs: [
    { v: pAvg * 4, color: 'var(--mint)' }, { v: cAvg * 4, color: 'var(--amber)' }, { v: fAvg * 9, color: 'var(--rose)' },
  ], width: 360, height: 26 });

  // 热力格（近28天）
  const heatCard = document.createElement('div');
  heatCard.className = 'card';
  heatCard.innerHTML = `
    <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--lime)"></span>近 28 天热力</div>
    <div class="card-sub">点按任意日期回看/修改记录</div></div>
    <div class="heat-grid" id="heatGrid"></div>
    <div class="heat-legend">少
      <i style="background:rgba(234,248,238,.045)"></i><i style="background:rgba(201,242,77,.1)"></i>
      <i style="background:rgba(201,242,77,.22)"></i><i style="background:rgba(201,242,77,.38)"></i>
      <i style="background:rgba(201,242,77,.6)"></i> 多</div>`;
  stack.appendChild(heatCard);
  const grid = heatCard.querySelector('#heatGrid');
  const days28 = rangeSeries(28);
  // 让列对齐星期：前面补空白到周一开始
  const firstDow = (keyToDate(days28[0].k).getDay() + 6) % 7;
  for (let i = 0; i < firstDow; i++) grid.insertAdjacentHTML('beforeend', '<div></div>');
  days28.forEach(d => {
    const score = heatScore(d);
    const cell = document.createElement('button');
    cell.className = 'heat-cell lv' + score + (d.k === todayKey() ? ' today' : '');
    cell.innerHTML = `<b>${keyToDate(d.k).getDate()}</b>`;
    cell.title = fmtCN(d.k);
    cell.addEventListener('click', () => openDaySheet(d.k));
    grid.appendChild(cell);
  });
}

/* 长周期聚合 */
function aggregate(series, n) {
  if (n <= 7) return series.map(s => ({ in: s.in, out: s.out, minutes: s.minutes, ck: s.checksAll ? Math.round(s.checks / s.checksAll * 100) : 0, label: WEEK_CN[keyToDate(s.k).getDay()].slice(1) }));
  const bucket = n === 30 ? 3 : 7;
  const out = [];
  for (let i = 0; i < series.length; i += bucket) {
    const chunk = series.slice(i, i + bucket);
    if (!chunk.length) break;
    const logged = chunk.filter(s => s.foods > 0);
    out.push({
      in: Math.round(logged.reduce((a, s) => a + s.in, 0) / Math.max(1, logged.length)),
      out: Math.round(chunk.reduce((a, s) => a + s.out, 0) / chunk.length),
      minutes: Math.round(chunk.reduce((a, s) => a + s.minutes, 0) / chunk.length),
      ck: Math.round(chunk.reduce((a, s) => a + (s.checksAll ? s.checks / s.checksAll : 0), 0) / chunk.length * 100),
      label: (n === 30 ? fmtShort(chunk[0].k) : 'W' + (Math.floor(i / 7) + 1)),
    });
  }
  return out;
}
function heatScore(d) {
  const g = state.goals;
  const s = (d.checksAll ? d.checks / d.checksAll : 0) * 0.45
    + Math.min(1, (d.foods > 0 ? 1 : 0)) * 0.25
    + Math.min(1, d.minutes / 30) * 0.3;
  return s <= 0 ? 0 : s < 0.3 ? 1 : s < 0.55 ? 2 : s < 0.8 ? 3 : 4;
}

/* ---- 历史某日弹层 ---- */
function openDaySheet(k) {
  const t = dayTotals(k);
  const d = state.days[k];
  const foodHtml = d && d.foods.length ? d.foods.map(f => `
    <button class="rec kcal-in" data-ef="${f.id}">
      <span class="thumb">${f.photo ? `<img src="${f.photo}">` : (f.em || '🍽️')}</span>
      <span class="mid"><span class="nm">${esc(f.name)}</span><span class="meta">${mealName(f.meal)} · ${f.t || ''}</span></span>
      <span class="kcal">+${f.kcal}<small></small></span>
    </button>`).join('') : `<div class="empty" style="padding:14px"><p style="font-size:12px">无饮食记录</p></div>`;
  const exHtml = d && d.workouts.length ? d.workouts.map(w => `
    <button class="rec kcal-out" data-ew="${w.id}">
      <span class="thumb">${w.photo ? `<img src="${w.photo}">` : (w.em || '🏋️')}</span>
      <span class="mid"><span class="nm">${esc(w.name)}</span><span class="meta">${w.minutes} 分钟 · ${w.t || ''}</span></span>
      <span class="kcal">−${w.kcal}<small></small></span>
    </button>`).join('') : `<div class="empty" style="padding:14px"><p style="font-size:12px">无运动记录</p></div>`;
  openSheet({
    title: fmtCN(k),
    sub: `摄入 ${t.in} kcal · 消耗 ${t.out} kcal · 打卡 ${t.checks}/${t.checksAll}`,
    html: `
      <div class="f-label">饮食</div><div class="rec-list" style="margin-bottom:16px">${foodHtml}</div>
      <div class="f-label">运动</div><div class="rec-list">${exHtml}</div>
      <button class="btn btn-ghost btn-block" style="margin-top:18px" id="dayClose">关闭</button>`,
    onMount: (el, close) => {
      el.querySelector('#dayClose').addEventListener('click', close);
      el.querySelectorAll('[data-ef]').forEach(b => b.addEventListener('click', () => { close(); openEditFood(k, b.dataset.ef); }));
      el.querySelectorAll('[data-ew]').forEach(b => b.addEventListener('click', () => { close(); openEditWorkout(k, b.dataset.ew); }));
    },
  });
}

/* ================= 周报视图 ================= */
function renderReport() {
  const weeks = weekList();
  const idx = Math.min(currentWeekIdx, weeks.length - 1);
  currentWeekIdx = idx;
  const w = weeks[idx];
  const st = w.stats;
  $('#weekChips').innerHTML = weeks.map((x, i) => {
    let lbl = i === 0 ? '本周' : i === 1 ? '上周' : (x.start.slice(5).replace('-', '/') + '周');
    return `<button class="chip ${i === idx ? 'on' : ''}" data-wk="${i}">${lbl}</button>`;
  }).join('');
  $$('#weekChips .chip').forEach(c => c.addEventListener('click', () => { currentWeekIdx = +c.dataset.wk; renderReport(); }));

  const prev = weeks[idx + 1] ? weeks[idx + 1].stats : null;
  const g = state.goals;
  const score = Math.round(
    Math.min(100, st.checkRate) * 0.35 +
    Math.min(100, st.workouts / Math.max(1, g.weeklyWorkouts) * 100) * 0.4 +
    Math.min(100, st.days.filter(d => d.foods > 0).length / Math.max(1, st.passed) * 100) * 0.25
  );
  const grade = score >= 85 ? ['A', '出色的自律一周 🏆', 'var(--lime)'] :
    score >= 70 ? ['B', '稳健推进的一周 💪', 'var(--mint)'] :
    score >= 50 ? ['C', '节奏还在建立中 🌱', 'var(--amber)'] :
    ['D', '新的一周重新出发 🌤️', 'var(--coral)'];
  const delta = (cur, pv, inv) => {
    if (!pv || (pv === 0 && cur === 0)) return '<div class="d flat">— 上周无数据</div>';
    const diff = cur - pv;
    if (Math.abs(diff) < 0.5) return '<div class="d flat">与上周持平</div>';
    const bad = inv ? diff > 0 : diff < 0;
    return `<div class="d ${bad ? 'down' : 'up'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(Math.round(diff * 10) / 10)} vs 上周</div>`;
  };

  const stack = $('#reportStack');
  stack.innerHTML = '';
  const hero = document.createElement('div');
  hero.className = 'card';
  hero.innerHTML = `
    <div class="card-head"><div class="card-title"><span class="dot"></span>${w.isCurrent ? '本周进行中' : fmtCN(w.start) + ' ～ ' + fmtShort(w.end)}</div>
      <div class="card-sub">${st.passed} 天记录窗口</div></div>
    <div class="rp-hero">
      <div class="rp-score" id="rpRing">
        <div class="c"><div class="v" style="color:${grade[2]}">${score}</div><div class="k">SCORE</div></div>
      </div>
      <div class="rp-side">
        <div class="grade" style="color:${grade[2]}">${grade[0]} · ${grade[1]}</div>
        <div class="desc">综合打卡、运动达成与饮食记录完整度计算。${w.isCurrent ? '本周数据实时更新中，周日晚结算。' : '该报告已自动归档。'}</div>
      </div>
    </div>
    <div class="rp-stats">
      <div class="rp-stat"><div class="k">✅ 打卡率</div><div class="v">${st.checkRate}<small>%</small></div>${delta(st.checkRate, prev ? prev.checkRate : null)}</div>
      <div class="rp-stat"><div class="k">🏋️ 运动</div><div class="v">${st.workouts}<small>次 · ${st.minutes}分</small></div>${delta(st.workouts, prev ? prev.workouts : null)}</div>
      <div class="rp-stat"><div class="k">🍽️ 日均摄入</div><div class="v">${st.inAvg}<small>kcal</small></div>${delta(st.inAvg, prev ? prev.inAvg : null, true)}</div>
      <div class="rp-stat"><div class="k">🔥 消耗合计</div><div class="v">${st.outSum}<small>kcal</small></div>${delta(st.outSum, prev ? prev.outSum : null)}</div>
    </div>`;
  stack.appendChild(hero);
  const ring = renderRing(hero.querySelector('#rpRing'), { size: 104, stroke: 10, arcs: [{ pct: score / 100, color: grade[2] }] });
  hero.querySelector('#rpRing').insertBefore(ring, hero.querySelector('#rpRing').firstChild);

  // 营养 + 净热量 + 洞察
  const pK = st.days.reduce((a, d) => a + d.p, 0) * 4;
  const cK = st.days.reduce((a, d) => a + d.c, 0) * 4;
  const fK = st.days.reduce((a, d) => a + d.f, 0) * 4;
  const detail = document.createElement('div');
  detail.className = 'card';
  const insights = buildInsights(st, prev, { pK, cK, fK });
  detail.innerHTML = `
    <div class="card-head"><div class="card-title"><span class="dot" style="background:var(--mint)"></span>营养与洞察</div>
      <div class="card-sub">周累计净热量 ${(st.netSum >= 0 ? '+' : '') + st.netSum} kcal</div></div>
    <div id="rpStack" style="margin-bottom:6px"></div>
    <div style="display:flex;gap:12px;font-size:11px;color:var(--ink3);margin-bottom:16px">
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:3px;background:var(--mint);margin-right:5px"></i>蛋白质 ${Math.round(pK / Math.max(1, pK + cK + fK) * 100)}%</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:3px;background:var(--amber);margin-right:5px"></i>碳水 ${Math.round(cK / Math.max(1, pK + cK + fK) * 100)}%</span>
      <span><i style="display:inline-block;width:8px;height:8px;border-radius:3px;background:var(--rose);margin-right:5px"></i>脂肪 ${Math.round(fK / Math.max(1, pK + cK + fK) * 100)}%</span>
    </div>
    <div class="rp-insight">
      ${insights.map(i => `<div class="insight"><span class="em">${i.em}</span><span>${i.txt}</span></div>`).join('')}
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:16px" id="rpCopy">📋 复制报告文本</button>`;
  stack.appendChild(detail);
  renderStack(detail.querySelector('#rpStack'), { segs: [{ v: pK, color: 'var(--mint)' }, { v: cK, color: 'var(--amber)' }, { v: fK, color: 'var(--rose)' }], width: 360, height: 24 });
  detail.querySelector('#rpCopy').addEventListener('click', () => {
    const txt = buildReportText(w, st, score, grade);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
      () => toast('报告已复制到剪贴板', '📋'),
      () => {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove(); toast('报告已复制', '📋');
      });
  });
  stack.insertAdjacentHTML('beforeend', `<div class="foot-note">每周一 00:00 自动生成上周完整报告</div>`);
}

function buildInsights(st, prev, macro) {
  const g = state.goals;
  const list = [];
  const perfect = st.best.length;
  if (perfect) list.push({ em: '🏆', txt: `有 <b>${perfect} 天</b>完成全部打卡${st.best.length ? '（' + st.best.map(k => fmtShort(k)).join('、') + '）' : ''}，状态拉满。` });
  if (prev) {
    if (st.workouts > prev.workouts) list.push({ em: '📈', txt: `本周运动 <b>${st.workouts} 次</b>，比上周多 ${st.workouts - prev.workouts} 次，进步看得见。` });
    else if (st.workouts < prev.workouts && prev.workouts > 0) list.push({ em: '📉', txt: `运动比上周少了 <b>${prev.workouts - st.workouts} 次</b>，下周安排回固定时段试试。` });
  }
  if (st.inAvg > g.kcalBudget * 1.08) list.push({ em: '⚠️', txt: `日均摄入 <b>${st.inAvg} kcal</b> 高于预算 ${g.kcalBudget}，可优先调整晚餐份量。` });
  else if (st.inAvg > 0 && st.inAvg < g.kcalBudget * 0.72) list.push({ em: '🥗', txt: `摄入偏低（日均 <b>${st.inAvg} kcal</b>），注意别把代谢饿慢了。` });
  else if (st.inAvg > 0) list.push({ em: '🎯', txt: `日均摄入 <b>${st.inAvg} kcal</b>，稳稳控制在预算带内，很专业。` });
  const pShare = macro.pK + macro.cK + macro.fK > 0 ? macro.pK / (macro.pK + macro.cK + macro.fK) : 0;
  if (pShare && pShare < 0.16) list.push({ em: '🥚', txt: `蛋白质供能占比 <b>${Math.round(pShare * 100)}%</b> 偏低，加一份鸡蛋、鱼虾或豆制品。` });
  else if (pShare >= 0.2) list.push({ em: '💪', txt: `蛋白质供能占比 <b>${Math.round(pShare * 100)}%</b>，对增肌减脂都很友好。` });
  if (st.netSum !== 0) list.push({ em: '⚖️', txt: `本周净热量 <b>${st.netSum >= 0 ? '+' : ''}${st.netSum} kcal</b>，约对应 ${Math.abs(st.netSum / 7700).toFixed(2)} kg ${st.netSum > 0 ? '盈余' : '缺口'}。` });
  if (!list.length) list.push({ em: '🌤️', txt: '这周记录还很少，先从每天一次打卡开始，报告会越来越有意思。' });
  return list.slice(0, 4);
}
function buildReportText(w, st, score, grade) {
  return [
    `🔥 燃迹 EMBER · 周报（${w.start} ~ ${w.end}）`,
    `综合评分：${score} / 100（${grade[0]}）`,
    `打卡率：${st.checkRate}%`,
    `运动：${st.workouts} 次 · ${st.minutes} 分钟 · 消耗 ${st.outSum} kcal`,
    `日均摄入：${st.inAvg} kcal（预算 ${state.goals.kcalBudget}）`,
    `净热量：${st.netSum >= 0 ? '+' : ''}${st.netSum} kcal`,
    `打卡完美日：${st.best.length ? st.best.map(k => fmtShort(k)).join('、') : '无'}`,
  ].join('\n');
}

/* ================= 添加流程 ================= */
function bindFab() {
  $('#fab').addEventListener('click', () => {
    openSheet({
      title: '添加记录',
      sub: '所有 AI 估算结果都支持手动修正',
      html: `
        <div class="f-grid">
          <button class="btn btn-pri btn-block" data-add="photo" style="padding:15px">📸 拍照识餐 · 估算热量与营养</button>
          <button class="btn btn-ghost btn-block" data-add="food" style="padding:15px">✍️ 手动记录饮食</button>
          <button class="btn btn-ghost btn-block" data-add="ex" style="padding:15px">🏋️ 记录运动 · MET 自动计算</button>
          <button class="btn btn-ghost btn-block" data-add="shot" style="padding:15px">🖼️ 上传运动截图作为凭证</button>
        </div>
        <div class="learn-note" style="margin-top:14px">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>
          食物估算在本机完成：色谱特征匹配 + 你的修正记忆，不上传任何照片
        </div>`,
      onMount: (el, close) => {
        el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
          const a = b.dataset.add; close();
          if (a === 'photo') $('#fileFood').click();
          else if (a === 'food') openFoodManual();
          else if (a === 'ex') openWorkoutForm({});
          else if (a === 'shot') $('#fileWorkout').click();
        }));
      },
    });
  });
}

/* ---- 拍照识餐 ---- */
let photoState = null;
async function onFoodPhoto(file) {
  if (!file) return;
  toast('正在读取照片…', '📸');
  try {
    const thumb = await compressImage(file, 480, 0.62);
    const img = await loadImage(thumb);
    const features = extractFeatures(img);
    const est = estimateFood(features);
    photoState = { thumb, features, est, selIdx: est.candidates.findIndex(c => c.memo || true) === 0 ? 0 : 0 };
    openFoodEstimate();
  } catch (e) {
    console.error(e);
    toast('照片读取失败，试试手动记录', '⚠️');
  }
}

function openFoodEstimate() {
  const ps = photoState;
  const est = ps.est;
  openSheet({
    title: 'AI 识餐结果',
    sub: '本地色谱估算 · 点按选择并修正',
    html: `
      <div class="photo-slot" style="margin-bottom:14px;border-style:solid;border-color:var(--line);padding:10px">
        <img src="${ps.thumb}" alt="餐食照片">
      </div>
      <div class="ai-card">
        <div class="ai-head"><span class="em">🤖</span><span class="t" id="aiStatus">色谱分析中…</span><span class="conf" id="aiConf" style="display:none"></span></div>
        <div class="ai-foods" id="aiFoods" style="opacity:.35;pointer-events:none">
          ${est.candidates.map((c, i) => `
            <button class="ai-food ${i === 0 ? 'sel' : ''}" data-i="${i}">
              <span class="em">${c.db.em}</span>
              <span><span class="nm">${c.db.name}${c.memo ? ' <span class="tag fix">记忆命中</span>' : ''}</span>
              <span class="sub">每${c.db.serving} · P ${c.db.p} / C ${c.db.c} / F ${c.db.f} g</span></span>
              <span class="kc">${c.db.kcal}<small> kcal</small></span>
            </button>`).join('')}
        </div>
        <div class="learn-note">
          <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/><path d="M16 3l4 4-4 4"/></svg>
          你的修正会被记住：下次遇到同色系照片会优先命中你选的食物
        </div>
      </div>
      <div class="f-grid" style="margin-top:16px">
        <div><div class="f-label">餐次</div>
          <div class="seg lime" id="mealSeg">${mealSegHtml(est.meal)}</div></div>
        <div><div class="f-label">分量</div>
          <div class="seg" id="portionSeg">${PORTIONS.map((p, i) => `<button data-p="${p.v}" class="${i === 1 ? 'on' : ''}">${p.em} ${p.label}</button>`).join('')}</div></div>
        <div class="f-row">
          <div><div class="f-label">食物名称</div><input class="f-input" id="fName"></div>
          <div><div class="f-label">热量 kcal <span class="hint">可修正</span></div><input class="f-input" id="fKcal" type="number" inputmode="numeric"></div>
        </div>
        <div class="f-row3">
          <div><div class="f-label">蛋白 g</div><input class="f-input" id="fP" type="number" inputmode="decimal"></div>
          <div><div class="f-label">碳水 g</div><input class="f-input" id="fC" type="number" inputmode="decimal"></div>
          <div><div class="f-label">脂肪 g</div><input class="f-input" id="fF" type="number" inputmode="decimal"></div>
        </div>
        <button class="btn btn-pri btn-block" id="fSave" style="padding:15px">保存到今天 · ${fmtCN(todayKey())}</button>
      </div>`,
    onMount: (el, close) => {
      let sel = 0, portion = 1, oldPortion = 1, meal = est.meal, manualK = false;
      const foodsEl = el.querySelector('#aiFoods');
      const confEl = el.querySelector('#aiConf');
      // 模拟分析动效后解锁
      setTimeout(() => {
        el.querySelector('#aiStatus').textContent = '识别完成 · 请确认';
        confEl.style.display = '';
        confEl.textContent = '置信度 ' + ({ high: '高', mid: '中', low: '低' }[est.confidence]);
        foodsEl.style.transition = 'opacity .4s'; foodsEl.style.opacity = 1; foodsEl.style.pointerEvents = '';
        applySel();
      }, 620);
      function base() { return est.candidates[sel].db; }
      function applySel() {
        const b = base();
        el.querySelector('#fName').value = b.name;
        if (!manualK) {
          el.querySelector('#fKcal').value = Math.round(b.kcal * portion);
          el.querySelector('#fP').value = Math.round(b.p * portion);
          el.querySelector('#fC').value = Math.round(b.c * portion);
          el.querySelector('#fF').value = Math.round(b.f * portion);
        }
      }
      foodsEl.querySelectorAll('[data-i]').forEach(btn => btn.addEventListener('click', () => {
        foodsEl.querySelectorAll('.ai-food').forEach(x => x.classList.remove('sel'));
        btn.classList.add('sel');
        const prevSel = sel; sel = +btn.dataset.i; manualK = false; applySel();
        // 修正学习：与初始推荐不同 → 写入色谱记忆
        if (sel !== 0 || prevSel !== 0) { /* keep simple */ }
        photoState.userPicked = sel;
      }));
      el.querySelector('#portionSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#portionSeg').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        const newP = +b.dataset.p;
        if (manualK && oldPortion > 0) {
          // 已手动修正：按分量比例缩放，不覆盖用户的数值
          const ratio = newP / oldPortion;
          ['fKcal', 'fP', 'fC', 'fF'].forEach(id => {
            const inp = el.querySelector('#' + id);
            if (inp.value) inp.value = Math.round((+inp.value || 0) * ratio);
          });
        } else applySel();
        portion = newP; oldPortion = newP;
      }));
      el.querySelector('#mealSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#mealSeg').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); meal = b.dataset.m;
      }));
      ['fKcal', 'fP', 'fC', 'fF'].forEach(id => el.querySelector('#' + id).addEventListener('input', () => { manualK = true; }));
      el.querySelector('#fSave').addEventListener('click', () => {
        const name = el.querySelector('#fName').value.trim() || base().name;
        const kcal = Math.max(1, Math.round(+el.querySelector('#fKcal').value || base().kcal));
        const auto = Math.round(base().kcal * portion);
        const fixed = Math.abs(kcal - auto) > Math.max(6, auto * 0.08);
        const chosenId = base().id;
        if (photoState.userPicked > 0) recordCorrection(ps.features.sigKey, chosenId);
        else recordCorrection(ps.features.sigKey, chosenId); // 强化频率
        addFood(todayKey(), {
          name, meal, kcal,
          p: Math.round(+el.querySelector('#fP').value || 0),
          c: Math.round(+el.querySelector('#fC').value || 0),
          f: Math.round(+el.querySelector('#fF').value || 0),
          photo: ps.thumb, ai: true, fixed, portion, em: base().em,
        });
        close();
        toast(fixed ? '已保存（含手动修正）' : '识餐记录已保存', fixed ? '🛠️' : '✅');
        rerender();
      });
    },
  });
}
function mealSegHtml(sel) {
  const M = [['breakfast', '早餐 🌅'], ['lunch', '午餐 ☀️'], ['dinner', '晚餐 🌆'], ['snack', '加餐 🍵']];
  return M.map(([v, l]) => `<button data-m="${v}" class="${sel === v ? 'on' : ''}">${l}</button>`).join('');
}
function mealName(m) { return { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[m] || '餐饮'; }
function intensityName(i) { return { low: '低强度', mid: '中强度', high: '高强度' }[i] || '中强度'; }

/* ---- 手动记饮食 ---- */
function openFoodManual() {
  openSheet({
    title: '手动记录饮食',
    sub: '营养成分可留空',
    html: `
      <div class="f-grid">
        <div><div class="f-label">食物名称</div><input class="f-input" id="mName" placeholder="如：鸡胸肉沙拉"></div>
        <div><div class="f-label">餐次</div><div class="seg lime" id="mMeal">${mealSegHtml('lunch')}</div></div>
        <div class="f-row">
          <div><div class="f-label">热量 kcal</div><input class="f-input" id="mKcal" type="number" inputmode="numeric" placeholder="380"></div>
          <div><div class="f-label">份量说明</div><input class="f-input" id="mNote" placeholder="1 碗 / 200g（可选）"></div>
        </div>
        <div class="f-row3">
          <div><div class="f-label">蛋白 g</div><input class="f-input" id="mP" type="number" inputmode="decimal"></div>
          <div><div class="f-label">碳水 g</div><input class="f-input" id="mC" type="number" inputmode="decimal"></div>
          <div><div class="f-label">脂肪 g</div><input class="f-input" id="mF" type="number" inputmode="decimal"></div>
        </div>
        <button class="btn btn-pri btn-block" id="mSave" style="padding:15px">保存记录</button>
      </div>`,
    onMount: (el, close) => {
      let meal = 'lunch';
      el.querySelector('#mMeal').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#mMeal').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); meal = b.dataset.m;
      }));
      el.querySelector('#mSave').addEventListener('click', () => {
        const name = el.querySelector('#mName').value.trim();
        const kcal = Math.round(+el.querySelector('#mKcal').value || 0);
        if (!name || !kcal) { toast('名称和热量都要填哦', '✍️'); return; }
        addFood(todayKey(), {
          name, meal, kcal, em: '🍽️',
          p: Math.round(+el.querySelector('#mP').value || 0),
          c: Math.round(+el.querySelector('#mC').value || 0),
          f: Math.round(+el.querySelector('#mF').value || 0),
          photo: null, ai: false, note: el.querySelector('#mNote').value.trim(),
        });
        close(); toast('饮食已记录', '✅'); rerender();
      });
    },
  });
}

/* ---- 运动表单（手动 / 截图） ---- */
function openWorkoutForm({ photo = null, dayKey = null } = {}) {
  const k = dayKey || todayKey();
  const preset = photo ? guessWorkout(photo) : { type: 'run', intensity: 'mid', minutes: 30 };
  openSheet({
    title: photo ? '运动截图记录' : '记录运动',
    sub: photo ? '截图已作为凭证 · 请核对数据' : 'MET 代偿法自动计算消耗',
    html: `
      ${photo ? `<div class="photo-slot" style="margin-bottom:14px;border-style:solid;border-color:var(--line);padding:10px"><img src="${photo}"></div>` : ''}
      <div class="f-grid">
        <div><div class="f-label">运动类型</div>
          <div class="seg" id="wType" style="flex-wrap:wrap;grid-auto-flow:row;grid-template-columns:repeat(4,1fr)">
            ${EX_DB.map((x, i) => `<button data-x="${x.id}" data-i="${i}" class="${x.id === preset.type ? 'on' : ''}">${x.em} ${x.name}</button>`).join('')}
          </div></div>
        <div><div class="f-label">时长（分钟）</div><input class="f-input" id="wMin" type="number" inputmode="numeric" value="${preset.minutes}"></div>
        <div><div class="f-label">强度</div>
          <div class="seg" id="wInt">${INTENSITY.map(x => `<button data-in="${x.id}" class="${x.id === preset.intensity ? 'on' : ''}">${x.label}</button>`).join('')}</div></div>
        <div><div class="f-label">消耗 kcal <span class="hint" id="wAuto">MET 自动计算</span></div>
          <input class="f-input" id="wKcal" type="number" inputmode="numeric"></div>
        <button class="btn btn-pri btn-block" id="wSave" style="padding:15px">保存运动记录 · ${fmtCN(k)}</button>
      </div>`,
    onMount: (el, close) => {
      let type = EX_DB.find(x => x.id === preset.type) || EX_DB[0];
      let intensity = preset.intensity, manualK = false;
      const kcalInput = el.querySelector('#wKcal');
      const recompute = () => { if (!manualK) kcalInput.value = calcBurn(type.met, intensity, +el.querySelector('#wMin').value || 0); };
      recompute();
      el.querySelector('#wType').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#wType').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); type = EX_DB[+b.dataset.i]; recompute();
      }));
      el.querySelector('#wInt').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#wInt').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); intensity = b.dataset.in; recompute();
      }));
      el.querySelector('#wMin').addEventListener('input', recompute);
      kcalInput.addEventListener('input', () => {
        manualK = true;
        el.querySelector('#wAuto').textContent = '已手动修正';
      });
      el.querySelector('#wSave').addEventListener('click', () => {
        const minutes = Math.max(1, Math.round(+el.querySelector('#wMin').value || 1));
        const kcal = Math.max(1, Math.round(+kcalInput.value || 1));
        addWorkout(k, {
          type: type.id, name: type.name, em: type.em, minutes, intensity, kcal,
          photo, ai: !!photo, fixed: manualK,
        });
        close();
        toast(manualK ? '已保存（含手动修正）' : '运动已记录', '🔥');
        rerender();
      });
    },
  });
}

/* ---- 编辑饮食记录 ---- */
function openEditFood(k, id) {
  const f = (state.days[k]?.foods || []).find(x => x.id === id);
  if (!f) return;
  openSheet({
    title: '修正记录',
    sub: `${fmtCN(k)} · ${mealName(f.meal)}`,
    html: `
      ${f.photo ? `<div class="photo-slot" style="margin-bottom:14px;border-style:solid;border-color:var(--line);padding:10px"><img src="${f.photo}"></div>` : ''}
      <div class="f-grid">
        <div><div class="f-label">食物名称</div><input class="f-input" id="eName" value="${esc(f.name)}"></div>
        <div><div class="f-label">餐次</div><div class="seg lime" id="eMeal">${mealSegHtml(f.meal)}</div></div>
        <div><div class="f-label">热量 kcal</div><input class="f-input" id="eKcal" type="number" inputmode="numeric" value="${f.kcal}"></div>
        <div class="f-row3">
          <div><div class="f-label">蛋白 g</div><input class="f-input" id="eP" type="number" value="${f.p || ''}"></div>
          <div><div class="f-label">碳水 g</div><input class="f-input" id="eC" type="number" value="${f.c || ''}"></div>
          <div><div class="f-label">脂肪 g</div><input class="f-input" id="eF" type="number" value="${f.f || ''}"></div>
        </div>
        <button class="btn btn-pri btn-block" id="eSave" style="padding:15px">保存修正</button>
        <button class="btn btn-danger btn-block" id="eDel">删除这条记录</button>
      </div>`,
    onMount: (el, close) => {
      let meal = f.meal;
      el.querySelector('#eMeal').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#eMeal').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); meal = b.dataset.m;
      }));
      el.querySelector('#eSave').addEventListener('click', () => {
        updateFood(k, id, {
          name: el.querySelector('#eName').value.trim() || f.name, meal,
          kcal: Math.max(1, Math.round(+el.querySelector('#eKcal').value || f.kcal)),
          p: Math.round(+el.querySelector('#eP').value || 0),
          c: Math.round(+el.querySelector('#eC').value || 0),
          f: Math.round(+el.querySelector('#eF').value || 0),
          fixed: true,
        });
        close(); toast('修正已保存', '🛠️'); rerender();
      });
      el.querySelector('#eDel').addEventListener('click', async () => {
        if (await confirmModal({ title: '删除记录？', msg: '将删除这条饮食记录，不可恢复。', okText: '删除', danger: true })) {
          deleteFood(k, id); close(); toast('已删除', '🗑️'); rerender();
        }
      });
    },
  });
}

/* ---- 编辑运动记录 ---- */
function openEditWorkout(k, id) {
  const w = (state.days[k]?.workouts || []).find(x => x.id === id);
  if (!w) return;
  openSheet({
    title: '修正运动记录',
    sub: `${fmtCN(k)} · ${w.name}`,
    html: `
      ${w.photo ? `<div class="photo-slot" style="margin-bottom:14px;border-style:solid;border-color:var(--line);padding:10px"><img src="${w.photo}"></div>` : ''}
      <div class="f-grid">
        <div><div class="f-label">运动类型</div>
          <div class="seg" id="xType" style="flex-wrap:wrap;grid-auto-flow:row;grid-template-columns:repeat(4,1fr)">
            ${EX_DB.map((x, i) => `<button data-x="${x.id}" data-i="${i}" class="${x.id === w.type ? 'on' : ''}">${x.em} ${x.name}</button>`).join('')}
          </div></div>
        <div><div class="f-label">时长（分钟）</div><input class="f-input" id="xMin" type="number" value="${w.minutes}"></div>
        <div><div class="f-label">强度</div>
          <div class="seg" id="xInt">${INTENSITY.map(x => `<button data-in="${x.id}" class="${x.id === w.intensity ? 'on' : ''}">${x.label}</button>`).join('')}</div></div>
        <div><div class="f-label">消耗 kcal</div><input class="f-input" id="xKcal" type="number" value="${w.kcal}"></div>
        <button class="btn btn-pri btn-block" id="xSave" style="padding:15px">保存修正</button>
        <button class="btn btn-danger btn-block" id="xDel">删除这条记录</button>
      </div>`,
    onMount: (el, close) => {
      let type = EX_DB.find(x => x.id === w.type) || EX_DB[0];
      let intensity = w.intensity, manualK = false;
      const recompute = () => { if (!manualK) el.querySelector('#xKcal').value = calcBurn(type.met, intensity, +el.querySelector('#xMin').value || 0); };
      el.querySelector('#xType').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#xType').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); type = EX_DB[+b.dataset.i]; recompute();
      }));
      el.querySelector('#xInt').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        el.querySelector('#xInt').querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); intensity = b.dataset.in; recompute();
      }));
      el.querySelector('#xMin').addEventListener('input', recompute);
      el.querySelector('#xKcal').addEventListener('input', () => { manualK = true; });
      el.querySelector('#xSave').addEventListener('click', () => {
        updateWorkout(k, id, {
          type: type.id, name: type.name, em: type.em,
          minutes: Math.max(1, Math.round(+el.querySelector('#xMin').value || w.minutes)),
          intensity,
          kcal: Math.max(1, Math.round(+el.querySelector('#xKcal').value || w.kcal)),
          fixed: true,
        });
        close(); toast('修正已保存', '🛠️'); rerender();
      });
      el.querySelector('#xDel').addEventListener('click', async () => {
        if (await confirmModal({ title: '删除记录？', msg: '将删除这条运动记录，不可恢复。', okText: '删除', danger: true })) {
          deleteWorkout(k, id); close(); toast('已删除', '🗑️'); rerender();
        }
      });
    },
  });
}

/* ================= 打卡项目管理 ================= */
function openCheckinManage() {
  openSheet({
    title: '管理打卡项',
    sub: '至少保留 3 项 · 自定义你的习惯',
    html: `
      <div id="ckList">
        ${state.checkins.map(c => `
          <div class="ck-edit-row">
            <span class="em">${c.em}</span><span class="nm">${esc(c.label)}</span>
            <button class="del" data-del="${c.id}"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/></svg></button>
          </div>`).join('')}
      </div>
      <div class="ck-add">
        <input class="f-input em-input" id="ckEm" value="⭐" maxlength="4">
        <input class="f-input" id="ckNm" placeholder="新打卡项名称">
        <button class="btn btn-pri btn-sm" id="ckAddBtn">添加</button>
      </div>`,
    onMount: (el, close) => {
      el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
        if (state.checkins.length <= 3) { toast('至少保留 3 个打卡项', '🚫'); return; }
        state.checkins = state.checkins.filter(c => c.id !== b.dataset.del);
        saveState(); close(); toast('已移除打卡项', '🗑️'); rerender();
      }));
      el.querySelector('#ckAddBtn').addEventListener('click', () => {
        const nm = el.querySelector('#ckNm').value.trim();
        if (!nm) { toast('先给打卡项起个名字', '✏️'); return; }
        state.checkins.push({ id: 'ck_' + uid(), label: nm, em: el.querySelector('#ckEm').value.trim() || '⭐' });
        saveState(); close(); toast('打卡项已添加', '⭐'); rerender();
      });
    },
  });
}

/* ================= 我的视图 ================= */
function renderMe() {
  const stack = $('#meStack');
  const r = state.reminder;
  stack.innerHTML = '';

  const p = document.createElement('div');
  p.className = 'card';
  p.innerHTML = `
    <div class="me-profile">
      <div class="me-ava">🔥</div>
      <div style="flex:1">
        <div class="me-name" id="meName">${esc(state.profile.name)}</div>
        <div class="me-sub">${state.profile.weight} kg · 连续记录 <b style="color:var(--coral)">${streak()}</b> 天</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="editProfile">编辑资料</button>
    </div>`;
  stack.appendChild(p);
  p.querySelector('#editProfile').addEventListener('click', openProfileSheet);

  const g = document.createElement('div');
  g.className = 'card me-group';
  g.innerHTML = `
    <div class="card-head" style="margin-bottom:4px"><div class="card-title"><span class="dot"></span>目标与提醒</div></div>
    <button class="me-row" id="rowGoals">
      <span class="em lime">🎯</span>
      <span class="tt"><span class="t">目标设置</span><span class="s">预算 · 消耗 · 每周目标</span></span>
      <span class="tail">${state.goals.kcalBudget} kcal ›</span>
    </button>
    <button class="me-row" id="rowCheckins">
      <span class="em mint">✅</span>
      <span class="tt"><span class="t">打卡项管理</span><span class="s">${state.checkins.length} 个每日习惯</span></span>
      <span class="tail">›</span>
    </button>
    <div class="me-row" style="cursor:default">
      <span class="em coral">⏰</span>
      <span class="tt"><span class="t">每日打卡提醒</span><span class="s" id="remStatus">${remStatusText()}</span></span>
      <span class="tail"><input type="time" class="f-input" id="remTime" value="${r.time}" style="width:104px;padding:8px 10px"></span>
      <span class="tail"><span class="switch ${r.enabled ? 'on' : ''}" id="remSwitch"></span></span>
    </div>
    <div class="data-note" style="margin-top:10px">网页提醒需要本页面保持打开（可加入主屏幕后台挂起）。授权通知后，到点会推送系统通知；未授权时则以站内横幅提醒。想让<b>页面没打开时也响</b>？点下方「同步到系统日历」，交给手机系统日历推送。</div>
    <div style="display:flex;gap:9px;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" id="remTest">发送测试提醒</button>
      <button class="btn btn-ghost btn-sm" id="remIcs">📅 同步到系统日历</button>
    </div>`;
  stack.appendChild(g);
  g.querySelector('#rowGoals').addEventListener('click', openGoalsSheet);
  g.querySelector('#rowCheckins').addEventListener('click', openCheckinManage);
  const sw = g.querySelector('#remSwitch');
  sw.addEventListener('click', async () => {
    if (r.enabled) { r.enabled = false; saveState(); sw.classList.remove('on'); g.querySelector('#remStatus').textContent = remStatusText(); toast('已关闭提醒', '💤'); return; }
    let granted = 'unsupported';
    if ('Notification' in window) {
      try { granted = await Notification.requestPermission(); } catch (e) { granted = 'denied'; }
    }
    r.enabled = true; saveState(); sw.classList.add('on');
    g.querySelector('#remStatus').textContent = remStatusText();
    toast(`每日 ${r.time} 提醒已开启`, '⏰');
  });
  g.querySelector('#remTime').addEventListener('change', e => {
    r.time = e.target.value || r.time; saveState();
    toast(`提醒时间改为 ${r.time}`, '⏰');
  });
  g.querySelector('#remTest').addEventListener('click', () => fireReminder(true));
  g.querySelector('#remIcs').addEventListener('click', exportIcs);

  const d = document.createElement('div');
  d.className = 'card me-group';
  d.innerHTML = `
    <div class="card-head" style="margin-bottom:4px"><div class="card-title"><span class="dot" style="background:var(--sky)"></span>数据</div></div>
    <button class="me-row" id="rowExport">
      <span class="em sky">📦</span>
      <span class="tt"><span class="t">导出备份</span><span class="s">下载 JSON 数据文件</span></span>
      <span class="tail">›</span>
    </button>
    <button class="me-row" id="rowImport">
      <span class="em amber">📥</span>
      <span class="tt"><span class="t">导入备份</span><span class="s">从 JSON 文件恢复</span></span>
      <span class="tail">›</span>
    </button>
    <button class="me-row" id="rowSeed">
      <span class="em rose">🧪</span>
      <span class="tt"><span class="t">载入示例数据</span><span class="s">35 天演示，用于体验看板</span></span>
      <span class="tail">›</span>
    </button>
    <button class="me-row" id="rowClear">
      <span class="em coral">🗑️</span>
      <span class="tt"><span class="t">清空全部数据</span><span class="s">从今天开始真实记录</span></span>
      <span class="tail">›</span>
    </button>
    <div class="data-note" style="margin-top:10px">所有数据保存在<b>本机浏览器 localStorage</b>，照片压缩为缩略图后一并存储，不上传服务器；清浏览器数据会丢失记录，记得定期导出备份。</div>`;
  stack.appendChild(d);
  d.querySelector('#rowExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ember-backup-' + todayKey().replace(/-/g, '') + '.json';
    a.click(); URL.revokeObjectURL(a.href);
    toast('备份已下载', '📦');
  });
  d.querySelector('#rowImport').addEventListener('click', () => $('#fileImport').click());
  d.querySelector('#rowSeed').addEventListener('click', async () => {
    if (await confirmModal({ title: '载入示例数据？', msg: '将覆盖当前所有记录，预载 35 天演示数据。', okText: '载入' })) {
      state = blankState(); seedDemo(); state.meta.seeded = true; state.meta.bannerDismissed = false; saveState();
      toast('示例数据已载入', '🧪'); rerender();
    }
  });
  d.querySelector('#rowClear').addEventListener('click', async () => {
    if (await confirmModal({ title: '清空全部数据？', msg: '所有打卡、饮食、运动记录将被删除且不可恢复（建议先导出备份）。', okText: '清空', danger: true })) {
      state = blankState(); saveState();
      toast('已清空，从今天开始 💪', '🌱'); rerender();
    }
  });

  stack.insertAdjacentHTML('beforeend', `
    <div class="card" style="padding:16px">
      <div class="foot-note" style="padding:0">燃迹 EMBER v1.0<br>拍照估算在本机完成 · 修正越多越懂你</div>
    </div>`);
}
function remStatusText() {
  const r = state.reminder;
  if (!r.enabled) return '已关闭';
  if (!('Notification' in window)) return `${r.time} · 站内提醒`;
  return `${r.time} · ${Notification.permission === 'granted' ? '系统通知' : Notification.permission === 'denied' ? '通知被拒 · 站内提醒' : '站内提醒'}`;
}

/* ---- 资料编辑 ---- */
function openProfileSheet() {
  openSheet({
    title: '编辑资料',
    sub: '体重用于运动消耗计算',
    html: `
      <div class="f-grid">
        <div><div class="f-label">昵称</div><input class="f-input" id="pName" value="${esc(state.profile.name)}"></div>
        <div class="f-row">
          <div><div class="f-label">体重 kg</div><input class="f-input" id="pWeight" type="number" inputmode="decimal" value="${state.profile.weight}"></div>
          <div><div class="f-label">身高 cm</div><input class="f-input" id="pHeight" type="number" inputmode="numeric" value="${state.profile.height}"></div>
        </div>
        <button class="btn btn-pri btn-block" id="pSave" style="padding:15px">保存</button>
      </div>`,
    onMount: (el, close) => {
      el.querySelector('#pSave').addEventListener('click', () => {
        state.profile.name = el.querySelector('#pName').value.trim() || state.profile.name;
        state.profile.weight = Math.max(25, +el.querySelector('#pWeight').value || state.profile.weight);
        state.profile.height = Math.max(90, +el.querySelector('#pHeight').value || state.profile.height);
        saveState(); close(); toast('资料已更新', '✅'); rerender();
      });
    },
  });
}

/* ---- 目标编辑 ---- */
function openGoalsSheet() {
  const g = state.goals;
  openSheet({
    title: '目标设置',
    sub: '看板上的进度条都以此为准',
    html: `
      <div class="f-grid">
        <div class="f-row">
          <div><div class="f-label">每日热量预算 kcal</div><input class="f-input" id="gBudget" type="number" value="${g.kcalBudget}"></div>
          <div><div class="f-label">每日运动消耗目标</div><input class="f-input" id="gBurn" type="number" value="${g.burnGoal}"></div>
        </div>
        <div class="f-row">
          <div><div class="f-label">每周运动次数</div><input class="f-input" id="gWeekly" type="number" value="${g.weeklyWorkouts}"></div>
          <div><div class="f-label">每周打卡率目标 %</div><input class="f-input" id="gCk" type="number" value="${g.weeklyCheckin}"></div>
        </div>
        <div class="data-note">常见参考：减脂期预算 ≈ 日常消耗 − 300~500 kcal；增肌期 ≈ 日常消耗 + 200~300 kcal。</div>
        <button class="btn btn-pri btn-block" id="gSave" style="padding:15px">保存目标</button>
      </div>`,
    onMount: (el, close) => {
      el.querySelector('#gSave').addEventListener('click', () => {
        g.kcalBudget = Math.max(800, Math.round(+el.querySelector('#gBudget').value || g.kcalBudget));
        g.burnGoal = Math.max(50, Math.round(+el.querySelector('#gBurn').value || g.burnGoal));
        g.weeklyWorkouts = Math.max(1, Math.round(+el.querySelector('#gWeekly').value || g.weeklyWorkouts));
        g.weeklyCheckin = Math.min(100, Math.max(30, Math.round(+el.querySelector('#gCk').value || g.weeklyCheckin)));
        saveState(); close(); toast('目标已更新', '🎯'); rerender();
      });
    },
  });
}

/* ================= 提醒调度 ================= */
function fireReminder(test = false) {
  const today = todayKey();
  if (!test) {
    if (state.reminder.lastFired === today) return;
    state.reminder.lastFired = today;
    saveState();
  }
  const body = `今日打卡 ${dayTotals(today).checks}/${dayTotals(today).checksAll} · 该记录一下今天的饮食和运动啦 💪`;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('燃迹 EMBER · 打卡时间到 ⏰', { body, icon: 'assets/icon-192.png', tag: 'ember-reminder' });
      n.onclick = () => { window.focus(); switchTab('today'); };
    } catch (e) { /* 忽略 */ }
  }
  toast('⏰ 打卡时间到！今天记录了吗', '🔔');
}
/* ---- 同步提醒到系统日历（.ics，页面未打开也能收到系统推送） ---- */
function exportIcs() {
  const [hh, mm] = (state.reminder.time || '21:30').split(':').map(Number);
  const start = new Date();
  start.setHours(hh, mm, 0, 0);
  if (start <= new Date()) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 15 * 60000);
  const fmt = d => d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())
    + 'T' + pad2(d.getHours()) + pad2(d.getMinutes()) + '00';
  // 浮动本地时间（不带 Z），导入后跟随手机时区；逗号需按 RFC 5545 转义
  const desc = '打开燃迹 EMBER 完成今日打卡\\, 记录饮食与运动 https://sumomo0222.github.io/ember-health/';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ember Health//Checkin Reminder//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:ember-checkin-daily@ember-health',
    'DTSTAMP:' + fmt(new Date()),
    'DTSTART:' + fmt(start),
    'DTEND:' + fmt(end),
    'RRULE:FREQ=DAILY',
    'SUMMARY:燃迹打卡 ⏰',
    'DESCRIPTION:' + desc,
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:燃迹打卡提醒',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ember-checkin-reminder.ics';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('日历文件已下载，打开它选择"添加到日历"', '📅');
}
function reminderTick() {
  if (!state.reminder.enabled) return;
  const cur = nowHM();
  if (cur === state.reminder.time && state.reminder.lastFired !== todayKey()) fireReminder();
}
setInterval(reminderTick, 15000);

/* ================= 文件入口 ================= */
function bindFiles() {
  $('#fileFood').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) onFoodPhoto(f);
  });
  $('#fileWorkout').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const photo = await compressImage(f, 560, 0.62);
      openWorkoutForm({ photo });
    } catch (err) { toast('截图读取失败', '⚠️'); }
  });
  $('#fileImport').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.v !== 1 || typeof data.days !== 'object') throw new Error('bad');
      if (await confirmModal({ title: '导入备份？', msg: '将覆盖当前全部数据。', okText: '导入' })) {
        state = Object.assign(blankState(), data);
        saveState(); toast('备份已导入', '📥'); rerender();
      }
    } catch (err) { toast('文件格式不正确', '⚠️'); }
  });
}

/* ================= 启动 ================= */
function init() {
  loadState();
  $('#streakNum').textContent = streak();
  $$('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#btnSettings').addEventListener('click', () => switchTab('me'));
  $('#streakPill').addEventListener('click', () => switchTab('trends'));
  bindFab();
  bindFiles();
  switchTab('today');
}
init();
