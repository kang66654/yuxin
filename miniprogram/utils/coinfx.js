// utils/coinfx.js —「掷钱问路」铜钱动画（纯 Canvas 2D，零图片素材）
// 时间轴 ≈2.9s：聚气起势 → 腾空翻飞 → 凝空悬停（侧缘定格）→ 落定成卦
// 用法：const fx = require('../../utils/coinfx.js');
//       const ctrl = fx.play(canvasNode, {
//         width, height, ox, oy,          // ox/oy = 品字中心（待掷舞台原点）屏幕坐标
//         faces: ['正','背','正'],         // 落定顺序：上左 / 上右 / 下中
//         onPhase(idx, name), onFinish(),
//       });
//       跳过：ctrl.skip()
// 几何基准与 pages/ask/ask.wxss 的 .cx-coin / .cx-slot 一一对应，改尺寸时两边同步。

function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
function easeOutBack(x) { const c = 1.05; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }

/**
 * 铜钱几何规格 —— 唯一真源。
 * 数值取自 ask.wxss：币径 142rpx / 750rpx，品字间距按设计稿（402 基准）归一。
 */
const COIN = {
  screenRatio: 142 / 750, // 币径 / 屏宽
  edgeRatio: 0.22,        // 侧缘厚度 / 币径
  ringRatio: 0.72,        // 内虚线圈直径 / 币径
  holeRatio: 0.27,        // 方孔边长 / 币径
  // 待掷：品字（1 上 2 下），单位 = 币径
  home: [
    { dx: 0, dy: -0.526 },
    { dx: -0.829, dy: 0.263 },
    { dx: 0.829, dy: 0.263 },
  ],
  // 落定：品字（2 上 1 下）
  land: [
    { dx: -0.829, dy: -0.263 },
    { dx: 0.829, dy: -0.263 },
    { dx: 0, dy: 0.263 },
  ],
};

// 时间轴（秒）
const T = {
  gather: 0.42,   // 01 聚气起势结束 / 起跳
  apex: 1.15,     // 02 腾空翻飞结束：三币同高定格
  hover: 1.62,    // 03 凝空悬停结束 / 开始下落
  land: 2.30,     // 04 落定成卦：全部落地
  end: 2.86,      // 动画收尾
};

const PHASES = [
  { t: 0, name: '聚气起势' },
  { t: T.gather, name: '腾空翻飞' },
  { t: T.apex, name: '凝空悬停' },
  { t: T.hover, name: '落定成卦' },
];

const SERIF = '"Songti SC","Source Han Serif SC","SimSun",serif';

function play(canvas, opts) {
  opts = opts || {};
  const ctx = canvas.getContext('2d');
  const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const dpr = Math.min(win.pixelRatio || 2, 2);
  const W = opts.width;
  const H = opts.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const d = W * COIN.screenRatio;   // 币径（px）
  const r = d / 2;
  const ox = typeof opts.ox === 'number' ? opts.ox : W / 2;
  const oy = typeof opts.oy === 'number' ? opts.oy : H * 0.46;
  const faces = opts.faces && opts.faces.length === 3 ? opts.faces : ['背', '背', '背'];

  let finished = false;
  let rafId = null;
  const start = Date.now();
  let phaseIdx = -1;

  // 星点（与页面夜空同密度）
  const stars = [];
  for (let i = 0; i < 30; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.9,
      r: Math.random() * 0.9 + 0.3,
      ph: Math.random() * Math.PI * 2,
      sp: 0.5 + Math.random() * 1.2,
    });
  }

  // 三枚币的运动参数（凝空时统一悬停在同一高度，与设计帧 03 一致）
  const APEX_Y = oy - d * 1.12;
  const coins = [0, 1, 2].map((i) => {
    const hx = ox + COIN.home[i].dx * d;
    const hy = oy + COIN.home[i].dy * d;
    const lx = ox + COIN.land[i].dx * d;
    const ly = oy + COIN.land[i].dy * d;
    // 上升结束正好停在侧缘（90°），凝空时是薄椭圆侧影 —— 与设计帧一致
    const spin = Math.PI / 2 + Math.PI * 4;
    return {
      i,
      face: faces[i],
      hx, hy, lx, ly,
      launch: T.gather + i * 0.055,
      apexH: hy - APEX_Y,
      drift: (i === 1 ? -1 : i === 2 ? 1 : 0) * d * 0.18,
      spin,
      fallDur: 0.26 + ((hy - APEX_Y) / d) * 0.10,
      rot: [-5, 7, -9][i] * Math.PI / 180,      // 待掷时的轻微歪斜
      landRot: [-3, 5, -6][i] * Math.PI / 180,  // 落定后的歪斜
      landed: false,
      apexX: 0, apexY: 0,
    };
  });
  coins.forEach((c) => {
    c.apexX = c.hx + c.drift;
    c.apexY = APEX_Y;
  });

  const dust = [];
  const rings = [];
  let emitAcc = 0;

  function addDust(x, y, size, life, vx, vy, tint) {
    if (dust.length > 190) return;
    dust.push({ x, y, vx: vx || 0, vy: vy || 0, size, life: 0, maxLife: life, tint: tint || 0 });
  }

  function spawnImpact(cx, cy) {
    rings.push({ x: cx, y: cy, life: 0, maxLife: 0.62, w: d * 0.55, h: d * 0.22 });
    rings.push({ x: cx, y: cy, life: -0.1, maxLife: 0.78, w: d * 0.8, h: d * 0.3 });
    for (let k = 0; k < 9; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 46;
      addDust(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.3,
        1.4 + Math.random() * 2.0, 0.42 + Math.random() * 0.3,
        Math.cos(a) * sp, Math.sin(a) * sp * 0.45, 1);
    }
  }

  // ---------- 背景 ----------
  function drawBackground(t) {
    const a = clamp(t / 0.32, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d1e3c');
    g.addColorStop(0.45, '#12132b');
    g.addColorStop(1, '#0a0b1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const mg = ctx.createRadialGradient(W / 2, -H * 0.12, 10, W / 2, -H * 0.12, W * 0.9);
    mg.addColorStop(0, 'rgba(110,100,196,0.16)');
    mg.addColorStop(1, 'rgba(110,100,196,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, W, H * 0.55);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const al = 0.25 + 0.4 * Math.abs(Math.sin(t * s.sp + s.ph));
      ctx.fillStyle = 'rgba(200,206,240,' + al.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 背景虚线圈 + 地光 ----------
  function drawStage(t) {
    // 地光强度：聚气渐亮 → 飞行收敛 → 落地回弹 → 收尾回落
    let heat;
    if (t < T.gather) heat = easeOut(t / T.gather);
    else if (t < T.hover) heat = 1 - 0.55 * easeOut(clamp((t - T.gather) / 0.35, 0, 1));
    else if (t < T.land + 0.1) heat = 0.45 + 0.45 * easeOut(clamp((t - T.hover) / 0.3, 0, 1));
    else heat = 0.9 - 0.5 * easeOut(clamp((t - T.land - 0.1) / 0.9, 0, 1));
    ctx.save();
    ctx.translate(ox, oy);

    // 外虚线圈（与页面 .cx-ring 同尺寸：440rpx / 750rpx 屏宽）
    const rr = W * 0.293;
    ctx.strokeStyle = 'rgba(232,201,138,' + (0.14 + 0.10 * heat).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 9]);
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,201,138,0.09)';
    ctx.beginPath();
    ctx.arc(0, 0, rr - 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 地光（椭圆，托住三钱）
    const fg = ctx.createRadialGradient(0, d * 0.5, 5, 0, d * 0.5, d * 1.6);
    fg.addColorStop(0, 'rgba(232,201,138,' + (0.13 + 0.15 * heat).toFixed(3) + ')');
    fg.addColorStop(1, 'rgba(232,201,138,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(0, d * 0.5, d * 1.6, d * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 单枚币 ----------
  function drawCoin(c, x, y, sy, rot, glow) {
    const face = c.face;
    if (sy <= 0.075) {
      // 侧缘：薄椭圆，像立起来的硬币
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot * 0.35);
      const th = r * COIN.edgeRatio;
      const eg = ctx.createLinearGradient(0, -th, 0, th);
      eg.addColorStop(0, '#F4DFAC');
      eg.addColorStop(0.45, '#C9A259');
      eg.addColorStop(1, '#74531F');
      ctx.beginPath();
      ctx.ellipse(0, 0, r, th, 0, 0, Math.PI * 2);
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.lineWidth = Math.max(0.8, r * 0.028);
      ctx.strokeStyle = 'rgba(255,246,220,.5)';
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1, sy);

    if (glow) {
      const gg = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.1);
      gg.addColorStop(0, 'rgba(255,225,160,' + (0.24 * glow).toFixed(3) + ')');
      gg.addColorStop(1, 'rgba(255,225,160,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 落地投影
    const sh = ctx.createRadialGradient(0, r * 0.92, 2, 0, r * 0.92, r * 1.1);
    sh.addColorStop(0, 'rgba(0,0,0,.45)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.92, r * 1.1, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 币身
    const bg = ctx.createRadialGradient(-r * 0.36, -r * 0.44, r * 0.06, 0, 0, r * 1.06);
    bg.addColorStop(0, '#F9ECBF');
    bg.addColorStop(0.26, '#E8CD8B');
    bg.addColorStop(0.56, '#C9A259');
    bg.addColorStop(0.82, '#8A6530');
    bg.addColorStop(1, '#6B4C22');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // 币缘双圈
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = 'rgba(255,246,220,.30)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.958, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.strokeStyle = 'rgba(92,64,24,.42)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.895, 0, Math.PI * 2);
    ctx.stroke();

    // 内虚线圈
    ctx.setLineDash([r * 0.10, r * 0.09]);
    ctx.lineWidth = Math.max(0.8, r * 0.022);
    ctx.strokeStyle = 'rgba(90,62,20,.48)';
    ctx.beginPath();
    ctx.arc(0, 0, r * COIN.ringRatio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 字面
    ctx.fillStyle = '#5C3D14';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (face === '背') {
      ctx.font = '700 ' + (r * 0.80).toFixed(1) + 'px ' + SERIF;
      ctx.fillText('谕', 0, r * 0.03);
    } else {
      const hs = r * COIN.holeRatio;
      ctx.fillStyle = '#4E3616';
      ctx.fillRect(-hs / 2, -hs / 2, hs, hs);
      ctx.strokeStyle = 'rgba(255,246,220,.25)';
      ctx.lineWidth = Math.max(0.6, r * 0.02);
      ctx.strokeRect(-hs / 2, -hs / 2, hs, hs);
      ctx.fillStyle = '#5C3D14';
      ctx.font = '700 ' + (r * 0.30).toFixed(1) + 'px ' + SERIF;
      ctx.fillText('谕', 0, -r * 0.545);
      ctx.fillText('心', r * 0.545, 0);
      ctx.fillText('通', 0, r * 0.545);
      ctx.fillText('宝', -r * 0.545, 0);
    }
    ctx.restore();
  }

  // ---------- 粒子 ----------
  function drawDust(dt) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.life += dt;
      if (p.life >= p.maxLife) { dust.splice(i, 1); continue; }
      const k = p.life / p.maxLife;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.tint ? 30 : -22) * dt;
      const a = (1 - k) * (p.tint ? 0.75 : 0.85);
      ctx.fillStyle = 'rgba(255,229,168,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - k * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRings(dt) {
    ctx.save();
    for (let i = rings.length - 1; i >= 0; i--) {
      const g = rings[i];
      g.life += dt;
      if (g.life >= g.maxLife) { rings.splice(i, 1); continue; }
      if (g.life < 0) continue;
      const k = g.life / g.maxLife;
      const w = g.w * (0.6 + k * 1.9);
      const h = g.h * (0.6 + k * 1.9);
      ctx.strokeStyle = 'rgba(255,217,138,' + (0.85 * (1 - k)).toFixed(3) + ')';
      ctx.lineWidth = 2 * (1 - k * 0.4);
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- 主循环 ----------
  let lastTs = Date.now();

  function frame() {
    const now = Date.now();
    const t = (now - start) / 1000;
    const dt = Math.min((now - lastTs) / 1000, 0.05);
    lastTs = now;

    ctx.clearRect(0, 0, W, H);
    drawBackground(t);
    drawStage(t);

    // 阶段回调
    let idx = 0;
    for (let i = 0; i < PHASES.length; i++) if (t >= PHASES[i].t) idx = i;
    if (idx !== phaseIdx) {
      phaseIdx = idx;
      opts.onPhase && opts.onPhase(idx + 1, PHASES[idx].name);
    }

    // 聚气：光尘上浮
    if (t < T.gather) {
      emitAcc += dt;
      while (emitAcc > 0.045) {
        emitAcc -= 0.045;
        const c = coins[Math.floor(Math.random() * 3)];
        addDust(c.hx + (Math.random() - 0.5) * d * 0.9, c.hy + d * 0.35 + Math.random() * d * 0.2,
          1.2 + Math.random() * 1.8, 0.5 + Math.random() * 0.35,
          (Math.random() - 0.5) * 10, -26 - Math.random() * 26, 0);
      }
    }

    // 拖尾（飞行中）
    if (t > T.gather && t < T.hover) {
      emitAcc += dt;
      while (emitAcc > 0.05) {
        emitAcc -= 0.05;
        const c = coins[Math.floor(Math.random() * 3)];
        const px = c.px, py = c.py;
        if (typeof px === 'number') {
          addDust(px + (Math.random() - 0.5) * d * 0.5, py + (Math.random() - 0.5) * d * 0.4,
            1.1 + Math.random() * 1.6, 0.36 + Math.random() * 0.22, 0, -8, 0);
        }
      }
    }

    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      let x, y, sy, rot, glow = 0;

      if (t < c.launch) {
        // 蓄力下沉 → 起跳前
        const q = clamp(t / T.gather, 0, 1);
        x = c.hx;
        y = c.hy + d * 0.085 * easeOut(q);
        sy = 1;
        rot = c.rot;
        glow = q * 0.35;
      } else if (t < T.apex) {
        // 腾空：抛物线上升 + 翻面，落点正好侧缘
        const u = clamp((t - c.launch) / (T.apex - c.launch), 0, 1);
        const eu = easeOut(u);
        x = c.hx + c.drift * eu;
        y = c.hy + d * 0.085 - (c.hy + d * 0.085 - c.apexY) * Math.sin(eu * Math.PI / 2);
        rot = c.rot + Math.sin(u * Math.PI) * 0.12;
        sy = Math.abs(Math.cos(c.spin * eu));
        glow = 0.5;
      } else if (t < T.hover) {
        // 凝空：侧缘定格 + 轻微上下呼吸
        const bob = Math.sin((t - T.apex) * 6) * d * 0.012;
        x = c.apexX;
        y = c.apexY + bob;
        rot = c.rot;
        sy = 0.06;
        glow = 0.55;
      } else {
        // 落定：从定格高度坠下，回弹后归位
        const v = clamp((t - T.hover) / c.fallDur, 0, 1);
        const ey = easeOutBack(v);
        x = c.apexX + (c.lx - c.apexX) * easeOut(v);
        y = c.apexY + (c.ly - c.apexY) * ey;
        const delta = c.face === '正' ? -Math.PI / 2 : Math.PI / 2;
        sy = Math.abs(Math.cos(c.spin + delta * easeOut(v)));
        rot = c.rot + (c.landRot - c.rot) * easeOut(v);
        glow = 1 - clamp((t - T.land) / 0.7, 0, 1);
        if (!c.landed && v >= 1) {
          c.landed = true;
          spawnImpact(c.lx, c.ly);
        }
        if (v >= 1) { x = c.lx; y = c.ly; sy = 1; rot = c.landRot; }
      }

      c.px = x;
      c.py = y;
      drawCoin(c, x, y, sy, rot, glow);
    }

    drawDust(dt);
    drawRings(dt);

    // 收尾金光
    if (t > T.land) {
      const k = clamp((t - T.land) / 0.5, 0, 1);
      const bg = ctx.createRadialGradient(ox, oy + d * 0.3, 5, ox, oy + d * 0.3, W * 0.6);
      bg.addColorStop(0, 'rgba(255,214,140,' + (0.13 * (1 - k * 0.6)).toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    if (t < T.end) {
      rafId = canvas.requestAnimationFrame(frame);
    } else {
      finish();
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (rafId) { try { canvas.cancelAnimationFrame(rafId); } catch (e) {} }
    opts.onFinish && opts.onFinish();
  }

  rafId = canvas.requestAnimationFrame(frame);

  return {
    skip: finish,
    stop: finish,
  };
}

module.exports = { play, COIN };
