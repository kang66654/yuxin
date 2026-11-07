// utils/condense.js —「光聚凝签」抽签过场（纯 Canvas 2D，零图片素材）
// 时间轴 6.5s：签筒登场 → 摇签 → 爆光 → 星涡凝聚 → 显签 → 金环收官
// 用法：const fx = require('../../utils/condense.js');
//       const ctrl = fx.play(canvasNode, { width, height, text:'守心待明', onFinish(){} });
//       跳过：ctrl.skip()
// 设计基准：Ardot 画布《谕心-问事签改版》动效帧 01–04

function easeInOut(x) { return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

/**
 * 签筒几何规格 —— 唯一真源。
 * 全部数值来自 pages/ask/ask.wxss 的 .new-tube（单位 rpx，以筒身宽 224 归一），
 * 页面与动画都按这份规格绘制，改尺寸时两边必须同步。
 */
const TUBE = {
  screenRatio: 224 / 750, // 筒身宽 / 屏宽（页面 750rpx 设计宽下的 224rpx）
  ratio: 321 / 224,       // 筒身高 / 筒身宽
  rTop: 10 / 224,         // 顶部圆角 / 宽（近直角，避免木桶肩）
  rBottom: 30 / 224,      // 底部圆角 / 宽
  mouthRx: 118 / 224,     // 筒口椭圆 rx / 宽（236rpx 口径，比筒身略外翻）
  mouthRy: 30 / 224,      // 筒口椭圆 ry / 宽（加深透视，签根藏进内腔）
  bandTop: 48 / 321,      // 红漆带顶 / 筒高
  bandH: 56 / 321,        // 红漆带高 / 筒高
  stickW: 16 / 224,       // 签支宽 / 筒宽
  stickBase: 12 / 321,    // 签根低于筒口中心 / 筒高
  tagW: 56 / 224,         // 谕字签牌宽 / 筒宽
  tagH: 78 / 224,         // 谕字签牌高 / 筒宽
  tagX: 71 / 224,         // 签牌左边相对筒身中心 / 筒宽（牌面压住筒身右缘）
  tagY: 104 / 321,        // 签牌顶低于筒口中心 / 筒高
  stringX: 106 / 224,     // 红绳起点相对筒身中心 / 筒宽（口沿右侧）
  stringY: 10 / 321,      // 红绳起点低于筒口中心 / 筒高
};

// 签支：9 支扇形，长度相对筒高、横向相对筒宽、角度为弧度
// 根部收紧在 ±56rpx（藏在筒口内），向两边张开 ±15°，高低交错
const STICKS = [
  // dx（以筒宽为 1）、长度（以筒高为 1）、倾角
  { dx: -0.250, len: 0.639, rot: -0.262, name: '一' },
  { dx: -0.188, len: 0.732, rot: -0.192, name: '二' },
  { dx: -0.125, len: 0.608, rot: -0.131, name: '三' },
  { dx: -0.063, len: 0.779, rot: -0.061, name: '四' },
  { dx: 0.000, len: 0.685, rot: 0.000, name: '五' },
  { dx: 0.063, len: 0.794, rot: 0.061, name: '六' },
  { dx: 0.125, len: 0.623, rot: 0.131, name: '七' },
  { dx: 0.188, len: 0.748, rot: 0.192, name: '八' },
  { dx: 0.250, len: 0.654, rot: 0.262, name: '九' },
];

/**
 * 把签筒整幅（签支 + 筒身 + 口沿 + 谕字签牌）预渲染到离屏 canvas。
 * 局部坐标：筒口中心为 (0,0)，筒身向下延伸 h，签支向上最大 0.7h。
 */
function renderStaticTube(octx, w, h, dpr) {
  octx.save();
  octx.scale(dpr, dpr);
  octx.translate(w * 0.75, h * 0.78); // 局部原点落在筒口中心

  // 落地投影
  const sh = octx.createRadialGradient(0, h + 6, 2, 0, h + 6, w * 0.72);
  sh.addColorStop(0, 'rgba(0,0,0,0.50)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  octx.fillStyle = sh;
  octx.beginPath();
  octx.ellipse(0, h + 6, w * 0.72, w * 0.16, 0, 0, Math.PI * 2);
  octx.fill();

  // ---- 签支（先画，筒身与口沿压住签根）----
  octx.save();
  for (let i = 0; i < STICKS.length; i++) {
    const s = STICKS[i];
    const sw = w * TUBE.stickW;
    const sl = h * s.len;
    octx.save();
    octx.translate(w * s.dx, h * TUBE.stickBase);
    octx.rotate(s.rot);
    const sg = octx.createLinearGradient(-sw / 2, 0, sw / 2, 0);
    sg.addColorStop(0, '#8b6428');
    sg.addColorStop(0.35, '#d3a961');
    sg.addColorStop(0.55, '#eed69a');
    sg.addColorStop(0.8, '#bd9350');
    sg.addColorStop(1, '#7d5822');
    octx.fillStyle = sg;
    octx.beginPath();
    octx.moveTo(-sw / 2, 0);
    octx.lineTo(-sw / 2, -sl + sw * 0.5);
    octx.quadraticCurveTo(-sw / 2, -sl, 0, -sl);
    octx.quadraticCurveTo(sw / 2, -sl, sw / 2, -sl + sw * 0.5);
    octx.lineTo(sw / 2, 0);
    octx.closePath();
    octx.fill();
    // 签头高光
    octx.fillStyle = 'rgba(245,227,174,0.75)';
    octx.beginPath();
    octx.ellipse(0, -sl + sw * 0.22, sw * 0.42, sw * 0.18, 0, 0, Math.PI * 2);
    octx.fill();
    // 千字文序号
    octx.fillStyle = 'rgba(74,50,18,0.92)';
    octx.font = `${Math.round(sw * 1.25)}px "Songti SC", serif`;
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText(s.name, 0, -sl + sw * 2.1);
    octx.restore();
  }
  octx.restore();

  // ---- 筒口内腔 ----
  const mouthRx = w * TUBE.mouthRx, mouthRy = w * TUBE.mouthRy;
  const mg = octx.createRadialGradient(0, -mouthRy * 0.2, 2, 0, 0, mouthRx);
  mg.addColorStop(0, '#3d2a10');
  mg.addColorStop(0.55, '#1b1105');
  mg.addColorStop(1, '#06040a');
  octx.fillStyle = mg;
  octx.beginPath();
  octx.ellipse(0, 0, mouthRx, mouthRy, 0, 0, Math.PI * 2);
  octx.fill();

  // ---- 筒身：横向渐变模拟圆柱面 ----
  const bodyW = w, bodyH = h;
  const rt = w * TUBE.rTop, rb = w * TUBE.rBottom;
  const bg = octx.createLinearGradient(-bodyW / 2, 0, bodyW / 2, 0);
  bg.addColorStop(0, '#2b1d08');
  bg.addColorStop(0.14, '#6b4b1b');
  bg.addColorStop(0.34, '#b78c45');
  bg.addColorStop(0.50, '#e3c07d');
  bg.addColorStop(0.66, '#c9a259');
  bg.addColorStop(0.84, '#7d5b25');
  bg.addColorStop(1, '#261a07');
  const bodyPath = () => {
    octx.beginPath();
    octx.moveTo(-bodyW / 2 + rt, 0);
    octx.lineTo(bodyW / 2 - rt, 0);
    octx.quadraticCurveTo(bodyW / 2, 0, bodyW / 2, rt);
    octx.lineTo(bodyW / 2, bodyH - rb);
    octx.quadraticCurveTo(bodyW / 2, bodyH, bodyW / 2 - rb, bodyH);
    octx.lineTo(-bodyW / 2 + rb, bodyH);
    octx.quadraticCurveTo(-bodyW / 2, bodyH, -bodyW / 2, bodyH - rb);
    octx.lineTo(-bodyW / 2, rt);
    octx.quadraticCurveTo(-bodyW / 2, 0, -bodyW / 2 + rt, 0);
    octx.closePath();
  };
  octx.save();
  bodyPath();
  octx.fillStyle = bg;
  octx.fill();
  octx.clip();

  // 竹片拼缝（暗线 + 右侧亮线）
  for (let i = 1; i <= 5; i++) {
    const sx = -bodyW / 2 + bodyW * i / 5.6;
    octx.strokeStyle = 'rgba(28,18,6,0.55)';
    octx.lineWidth = 1.6;
    octx.beginPath(); octx.moveTo(sx, 0); octx.lineTo(sx, bodyH); octx.stroke();
    octx.strokeStyle = 'rgba(238,214,154,0.16)';
    octx.lineWidth = 1;
    octx.beginPath(); octx.moveTo(sx + 2, 0); octx.lineTo(sx + 2, bodyH); octx.stroke();
  }
  // 左侧竖向高光
  const hl = octx.createLinearGradient(-bodyW / 2, 0, -bodyW * 0.14, 0);
  hl.addColorStop(0, 'rgba(255,246,220,0.16)');
  hl.addColorStop(1, 'rgba(255,246,220,0)');
  octx.fillStyle = hl;
  octx.fillRect(-bodyW / 2, 0, bodyW * 0.36, bodyH);

  // 底部渐暗
  const dk = octx.createLinearGradient(0, bodyH * 0.72, 0, bodyH);
  dk.addColorStop(0, 'rgba(0,0,0,0)');
  dk.addColorStop(1, 'rgba(0,0,0,0.36)');
  octx.fillStyle = dk;
  octx.fillRect(-bodyW / 2, bodyH * 0.72, bodyW, bodyH * 0.28);

  // 红漆箍带（筒身上部 15%–32%，与页面 .nt-band 的 48rpx / 56rpx 一致）
  const by = bodyH * TUBE.bandTop, bh = bodyH * TUBE.bandH;
  const rg = octx.createLinearGradient(-bodyW / 2, by, bodyW / 2, by);
  rg.addColorStop(0, '#43120a');
  rg.addColorStop(0.25, '#8d2414');
  rg.addColorStop(0.5, '#c0392b');
  rg.addColorStop(0.75, '#a52a1b');
  rg.addColorStop(1, '#6d1a0e');
  octx.fillStyle = rg;
  octx.fillRect(-bodyW / 2, by, bodyW, bh);
  octx.strokeStyle = 'rgba(232,201,138,0.85)';
  octx.lineWidth = 1.2;
  octx.beginPath(); octx.moveTo(-bodyW / 2, by); octx.lineTo(bodyW / 2, by); octx.stroke();
  octx.beginPath(); octx.moveTo(-bodyW / 2, by + bh); octx.lineTo(bodyW / 2, by + bh); octx.stroke();
  octx.restore();

  // ---- 口沿：整圈金环 + 前半弧加粗压住签根 ----
  octx.strokeStyle = 'rgba(201,162,89,0.9)';
  octx.lineWidth = 1.6;
  octx.beginPath();
  octx.ellipse(0, 0, mouthRx, mouthRy, 0, 0, Math.PI * 2);
  octx.stroke();
  octx.strokeStyle = '#eed69a';
  octx.lineWidth = 2.6;
  octx.beginPath();
  octx.ellipse(0, 0, mouthRx, mouthRy, 0, 0.12 * Math.PI, 0.88 * Math.PI);
  octx.stroke();

  // ---- 红绳 + 「谕」字签牌 ----
  const tagW = w * TUBE.tagW, tagH = w * TUBE.tagH;
  const tagX = w * TUBE.tagX, tagY = h * TUBE.tagY;
  const knotX = tagX + tagW * 0.5;
  const stringX = w * TUBE.stringX, stringY = h * TUBE.stringY;
  octx.strokeStyle = '#b03a2e';
  octx.lineWidth = 2;
  octx.beginPath();
  octx.moveTo(stringX, stringY);
  octx.quadraticCurveTo(stringX - w * 0.02, (stringY + tagY) / 2, knotX, tagY);
  octx.stroke();
  octx.fillStyle = '#c0392b';
  octx.beginPath(); octx.arc(knotX, tagY, 2.6, 0, Math.PI * 2); octx.fill();
  const tg = octx.createLinearGradient(tagX, tagY, tagX, tagY + tagH);
  tg.addColorStop(0, '#fbf6e8');
  tg.addColorStop(1, '#ded0a6');
  octx.fillStyle = tg;
  octx.beginPath();
  if (octx.roundRect) octx.roundRect(tagX, tagY, tagW, tagH, 4);
  else octx.rect(tagX, tagY, tagW, tagH);
  octx.fill();
  octx.strokeStyle = 'rgba(180,155,98,0.9)';
  octx.lineWidth = 1;
  octx.stroke();
  octx.fillStyle = '#7a2a1a';
  octx.font = `${Math.round(tagH * 0.52)}px "Kaiti SC", "KaiTi", serif`;
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillText('谕', tagX + tagW / 2, tagY + tagH * 0.52);

  octx.restore();
}

function play(canvas, opts) {
  opts = opts || {};
  let TEXT = (opts.text || '心安即归').split('');
  const ctx = canvas.getContext('2d');
  const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const dpr = Math.min(win.pixelRatio || 2, 2);
  const W = opts.width, H = opts.height;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const DUR = 6.5;
  let finished = false;
  let rafId = null;
  const start = Date.now();
  let particleAccum = 0;
  let lastTs = Date.now();

  // 舞台基准：筒口位置与 ask 页面签筒保持一致（页面签筒筒口 ≈ 47%H）
  const MOUTH_Y = H * 0.47;
  const VORTEX_Y = H * 0.46;

  // 星空（设计稿里是稀疏小星点，不是满天繁星）
  const stars = [];
  for (let i = 0; i < 26; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.88,
      r: Math.random() * 0.9 + 0.3,
      ph: Math.random() * Math.PI * 2,
      sp: 0.5 + Math.random() * 1.2,
    });
  }

  // 预渲染签筒（宽 = 屏宽 × TUBE.screenRatio，高按 TUBE.ratio，与页面签筒完全同形）
  const tubeW = Math.min(W * TUBE.screenRatio, 150);
  const tubeH = tubeW * TUBE.ratio;
  const imgW = tubeW * 2.0, imgH = tubeH * 1.9;
  let tubeCanvas = null;
  try {
    tubeCanvas = wx.createOffscreenCanvas({
      type: '2d',
      width: Math.ceil(imgW * dpr),
      height: Math.ceil(imgH * dpr),
    });
    renderStaticTube(tubeCanvas.getContext('2d'), tubeW, tubeH, dpr);
  } catch (e) {
    tubeCanvas = null;
  }

  // 粒子
  const particles = [];
  const MAX_P = 280;
  const TRAIL = 6;

  function emit(mx, my) {
    if (particles.length >= MAX_P) return;
    particles.push({
      x: mx + (Math.random() - 0.5) * tubeW * 0.42,
      y: my,
      life: 0,
      maxLife: 1.5 + Math.random() * 1.5,
      size: 1.4 + Math.random() * 2.4,
      trail: [],
    });
  }

  function drawBackground(t) {
    const a = clamp(t / 0.35, 0, 1); // 与页面夜空交叉溶解
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d1e3c');
    g.addColorStop(0.45, '#12132b');
    g.addColorStop(1, '#0a0b1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 顶部月晕
    const mg = ctx.createRadialGradient(W / 2, -H * 0.12, 10, W / 2, -H * 0.12, W * 0.9);
    mg.addColorStop(0, 'rgba(110,100,196,0.16)');
    mg.addColorStop(1, 'rgba(110,100,196,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, W, H * 0.55);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const al = 0.25 + 0.45 * Math.abs(Math.sin(t * s.sp + s.ph));
      ctx.fillStyle = `rgba(200,206,240,${al.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSignBody(t) {
    const sp = clamp((t - 2.4) / 1.0, 0, 1);
    const sc = easeInOut(sp);
    if (sc <= 0) return;
    const morph = t < 3.4 ? 0 : clamp((t - 3.4) / 0.9, 0, 1);
    const sw = W * 0.10 * sc;
    const sh = H * 0.33 * sc;
    const cx = W / 2, cy = VORTEX_Y;

    ctx.save();
    ctx.translate(cx, cy);

    const path = () => {
      const hw = sw / 2, hh = sh / 2;
      ctx.beginPath();
      ctx.moveTo(0, -hh);
      ctx.lineTo(hw, -hh + sw * 0.55);
      ctx.lineTo(hw, hh - sw * 0.75);
      ctx.lineTo(0, hh);
      ctx.lineTo(-hw, hh - sw * 0.75);
      ctx.lineTo(-hw, -hh + sw * 0.55);
      ctx.closePath();
    };

    // 水晶层
    if (morph < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - morph;
      path();
      ctx.fillStyle = 'rgba(225,238,255,0.28)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.82)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(200,225,255,0.85)';
      ctx.shadowBlur = 30;
      ctx.stroke();
      ctx.restore();
    }
    // 竹木层
    if (morph > 0) {
      ctx.save();
      ctx.globalAlpha = morph;
      path();
      const wg = ctx.createLinearGradient(-sw / 2, 0, sw / 2, 0);
      wg.addColorStop(0, '#5c3d1a');
      wg.addColorStop(0.28, '#6d4a22');
      wg.addColorStop(0.5, '#e0b878');
      wg.addColorStop(0.74, '#c69c5e');
      wg.addColorStop(1, '#5c3d1a');
      ctx.fillStyle = wg;
      ctx.shadowColor = 'rgba(255,210,130,0.65)';
      ctx.shadowBlur = 22;
      ctx.fill();
      ctx.shadowBlur = 0;
      // 木纹
      ctx.strokeStyle = 'rgba(80,50,20,0.28)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const lx = -sw * 0.18 + i * sw * 0.36;
        ctx.beginPath();
        ctx.moveTo(lx, -sh / 2 + 18);
        ctx.bezierCurveTo(lx + 3, -sh / 4, lx - 3, sh / 4, lx, sh / 2 - 24);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 星屑绕签
    if (sp > 0.5) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const ang = t * 1.1 + i * 0.35;
        const rr = sw * 1.15 + Math.sin(i * 3.3) * 4;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr * 1.5;
        const al = 0.25 + 0.35 * Math.sin(t * 3.6 + i);
        if (al <= 0) continue;
        ctx.fillStyle = `rgba(255,230,170,${al.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 竖排签文逐字点亮
    if (t >= 3.95) {
      const charH = sh / (TEXT.length + 1.6);
      const fontPx = Math.min(charH * 0.62, W * 0.058);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < TEXT.length; i++) {
        const ct = t - 3.95 - i * 0.14;
        if (ct < 0) continue;
        const e = easeOut(clamp(ct / 0.25, 0, 1));
        const cyChar = -sh / 2 + charH * (i + 1.25);
        ctx.save();
        ctx.translate(0, cyChar);
        ctx.scale(0.72 + 0.28 * e, 0.72 + 0.28 * e);
        ctx.globalAlpha = e;
        ctx.fillStyle = '#ffd98a';
        ctx.shadowColor = 'rgba(255,217,138,0.85)';
        ctx.shadowBlur = 12;
        ctx.font = `bold ${Math.round(fontPx)}px "Songti SC", serif`;
        ctx.fillText(TEXT[i], 0, 0);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawGoldRing(cy, rp, k) {
    const alpha = Math.sin(Math.PI * rp) * 0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,217,138,${alpha.toFixed(3)})`;
    ctx.lineWidth = k === 0 ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.ellipse(W / 2, cy, W * (k === 0 ? 0.10 : 0.118), W * 0.026, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function frame() {
    const now = Date.now();
    const t = (now - start) / 1000;
    const dt = Math.min((now - lastTs) / 1000, 0.05);
    lastTs = now;

    drawBackground(t);

    const cx = W / 2;
    let tubeDy = 0, tubeRot = 0, tubeScale = 1, tubeAlpha = 1;

    // 登场：与页面签筒同位置淡入，轻微上浮
    if (t < 0.45) tubeDy = 40 * (1 - easeInOut(t / 0.45));
    tubeAlpha = clamp(t / 0.28, 0, 1);
    // 呼吸
    if (t > 0.3 && t < 1.02) tubeDy += Math.sin(t * 1.7) * 2.4;
    // 摇签
    if (t >= 0.42 && t < 1.02) tubeRot = Math.sin(t * 15.5) * 0.052;
    // 爆光回弹
    if (t >= 1.02) tubeDy -= 10 * Math.exp(-15 * (t - 1.02));
    // 下沉离场
    if (t >= 1.25) {
      const st = clamp((t - 1.25) / 2.6, 0, 1);
      tubeDy += Math.pow(easeOut(st), 1.3) * H * 1.28;
      tubeScale = 1 - 0.18 * easeOut(st);
      if (st > 0.44) tubeAlpha *= 1 - (st - 0.44) / 0.56;
    }

    const mouthY = MOUTH_Y + tubeDy;

    // ---- 画签筒 ----
    if (tubeCanvas && tubeAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = tubeAlpha;
      ctx.translate(cx, mouthY);
      ctx.rotate(tubeRot);
      ctx.scale(tubeScale, tubeScale);
      // 筒口金晕（呼吸 + 爆光暴涨）
      const breath = 0.16 + 0.10 * Math.sin(t * 2.5);
      const bulge = (t >= 1.02 && t < 1.6) ? (1 - (t - 1.02) / 0.58) : 0;
      const hg = ctx.createRadialGradient(0, 0, 2, 0, 0, tubeW * (0.62 + bulge * 0.9));
      hg.addColorStop(0, `rgba(255,214,140,${(breath + bulge * 0.45).toFixed(3)})`);
      hg.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(-tubeW, -tubeW, tubeW * 2, tubeW * 2);
      ctx.drawImage(tubeCanvas, -imgW * 0.375, -imgH * 0.4105, imgW, imgH);
      ctx.restore();
    }
    // 说明：离屏图局部原点在 (0.75w, 0.78h)，因此偏移量 = -0.375w / -0.4105h 让筒口对准原点

    // ---- 爆光扩散光环 ----
    if (t >= 1.02 && t < 1.57) {
      const bp = (t - 1.02) / 0.55;
      const rx = tubeW * (0.55 + 1.85 * easeOut(bp));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,220,150,${(0.62 * (1 - bp)).toFixed(3)})`;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, rx, rx * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,242,204,${(0.4 * (1 - bp)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, rx * 0.72, rx * 0.23, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ---- 粒子发射 ----
    if (t >= 1.02 && t < 3.85) {
      const rate = t < 1.6 ? 120 : 55;
      particleAccum += rate * dt;
      while (particleAccum >= 1) {
        emit(cx, mouthY);
        particleAccum -= 1;
      }
    }

    // ---- 粒子更新：向心收缩 + 切向加速（星系涡流）----
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
      const prog = clamp(p.life / p.maxLife, 0, 1);
      const dx = p.x - cx, dy = p.y - VORTEX_Y;
      const r = Math.sqrt(dx * dx + dy * dy) || 1;
      // 角速度随半径反比：越靠近中心转得越快，形成星系旋臂
      const ang = Math.atan2(dy, dx) + (0.9 + 9 / (r + 26)) * dt * 2.2;
      // 半径向心收缩
      const targetR = r * Math.pow(1 - 0.88 * prog, 1.1) + 2;
      // 出生初期先向上喷泉，再被涡流捕获
      const lift = Math.max(0, 1 - prog / 0.22) * (tubeH * 0.30);
      p.x = cx + Math.cos(ang) * targetR;
      p.y = VORTEX_Y - lift + Math.sin(ang) * targetR * 1.28;
      p.trail.push(p.x, p.y);
      if (p.trail.length > TRAIL * 2) p.trail.splice(0, 2);
    }

    // ---- 画粒子（lighter 叠加 + 折线拖尾）----
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fade = t >= 5.5 ? clamp(1 - (t - 5.5) / 1.0, 0, 1) : 1;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = fade * (0.35 + 0.65 * (1 - p.life / p.maxLife));
      if (p.trail.length > 3) {
        ctx.strokeStyle = `rgba(255,210,140,${(a * 0.32).toFixed(3)})`;
        ctx.lineWidth = p.size * 0.42;
        ctx.beginPath();
        ctx.moveTo(p.trail[0], p.trail[1]);
        for (let j = 2; j < p.trail.length; j += 2) ctx.lineTo(p.trail[j], p.trail[j + 1]);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,225,160,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.66, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ---- 签体 / 金环 / 中心金晕 ----
    drawSignBody(t);

    if (t >= 4.75) {
      for (let k = 0; k < 2; k++) {
        const rt = t - 4.75 - k * 0.34;
        if (rt < 0 || rt > 1.2) continue;
        const rp = rt / 1.2;
        drawGoldRing(VORTEX_Y - H * 0.17 + rp * H * 0.34, rp, k);
      }
    }
    if (t >= 5.5) {
      const br = 0.10 + 0.06 * Math.sin(t * 2.5);
      const cg = ctx.createRadialGradient(cx, VORTEX_Y, 5, cx, VORTEX_Y, W * 0.32);
      cg.addColorStop(0, `rgba(255,210,140,${br.toFixed(3)})`);
      cg.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);
    }

    if (t < DUR) {
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
    setText: (s) => { TEXT = (s || '心安即归').split(''); },
  };
}

module.exports = { play, renderStaticTube, TUBE };
