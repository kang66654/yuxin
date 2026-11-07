const app = getApp();
const api = require('../../utils/api.js');
const condense = require('../../utils/condense.js');
const coinfx = require('../../utils/coinfx.js');

// 【调试开关】临时关闭前端次数拦截，调试完改回 false 即可恢复
const DEBUG_DISABLE_QUOTA = true;

/* 品字三钱舞台几何 —— 与 ask.wxss 的 .cx-stage / .cx-coin、
   utils/coinfx.js 的 COIN 三处保持同一套数值（单位 rpx，750 设计宽） */
const CX_D = 142;            // 币径
const CX_ORIGIN_TOP = 145.7; // 舞台顶 → 品字原点（dy = 0）
function cxSlot(dx, dy) {
  return {
    l: Math.round((375 + dx * CX_D - CX_D / 2) * 10) / 10,
    t: Math.round((CX_ORIGIN_TOP + dy * CX_D - CX_D / 2) * 10) / 10,
  };
}
// 待掷：1 上 2 下，三枚均为谕（背面）
const CX_HOME = [
  Object.assign({ pos: 'h0', face: '背' }, cxSlot(0, -0.526)),
  Object.assign({ pos: 'h1', face: '背' }, cxSlot(-0.829, 0.263)),
  Object.assign({ pos: 'h2', face: '背' }, cxSlot(0.829, 0.263)),
];
// 落定：2 上 1 下，下中为主币
const CX_LAND = [
  Object.assign({ pos: 'l0' }, cxSlot(-0.829, -0.263)),
  Object.assign({ pos: 'l1' }, cxSlot(0.829, -0.263)),
  Object.assign({ pos: 'l2', big: true }, cxSlot(0, 0.263)),
];

const COMBO_TAIL = {
  '三正无背': '方向已明',
  '两正一背': '大势已显',
  '两背一正': '先稳后行',
  '三背无正': '时机未到',
};

Page({
  data: {
    statusBarHeight: 20,
    remaining: 3,
    limit: 3,
    question: '',
    rit: 'qian',
    result: null,
    shaking: false,
    condensing: false,
    fxFading: false,
    qianHover: false,
    pickedStick: 0,
    pickedNum: '',
    stickText: '',
    tarotCards: [],
    tarotFlipping: false,
    // 铜钱：品字舞台 + 掷钱过场
    coinSlots: CX_HOME,
    coinFx: false,
    coinFxFading: false,
    coinPhase: 1,
    coinPhaseName: '聚气起势',
    coinCombo: '',
  },

  onLoad() {
    const g = app.globalData;
    this.setData({ statusBarHeight: g.statusBarHeight || 20 });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().sync(1);
    this.loadQuota();
  },

  async loadQuota() {
    try {
      const q = await api.quotaCheck();
      this.setData({ remaining: q.remaining, limit: q.limit });
    } catch (e) {
      // 云函数不可用时保持默认，不阻塞
    }
  },

  onQuestionInput(e) {
    this.setData({ question: e.detail.value });
  },

  handleDrawError(e) {
    if (e && (e.message === 'QUOTA_EXCEEDED' || e.code === 'QUOTA_EXCEEDED')) {
      wx.showToast({ title: '今日次数已用完，明天再来', icon: 'none' });
      this.setData({ remaining: 0 });
    } else {
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    }
    this.loadQuota();
  },

  // 塔罗本地兜底：云函数超时/失败时，直接用已抽到的牌面拼一段解读，保证有结果可看
  localTarot(cards) {
    const WORDS = {
      '隐士': ['克制内省', '暂时封闭'],
      '星星': ['有光可依', '光被云挡'],
      '世界': ['终会圆满', '还差一环'],
      '月亮': ['直觉引路', '迷雾未散'],
      '太阳': ['明朗可期', '暂时黯淡'],
      '命运之轮': ['转机将至', '暂入低谷'],
      '愚人': ['轻装启程', '莽撞冒进'],
      '女祭司': ['静听内心', '封闭自我'],
      '力量': ['柔能克刚', '用力过猛'],
      '节制': ['调和有度', '失衡急躁'],
      '塔': ['破旧立新', '突变震荡'],
      '审判': ['复盘新生', '苛责自己'],
    };
    const list = cards || [];
    const wordOf = (c) => {
      const w = WORDS[c.name] || ['心有微光', '暂被挡住'];
      return c.ori === '逆位' ? w[1] : w[0];
    };
    const parts = [];
    if (list[0]) parts.push('过去' + wordOf(list[0]));
    if (list[1]) parts.push('现在' + wordOf(list[1]));
    if (list[2]) parts.push('未来' + wordOf(list[2]));
    return {
      cards: list,
      line: list.map((x) => x.name + '·' + x.ori).join(' → '),
      read: parts.join('，') + '。不必急着定，今晚先让答案在心里沉淀。',
      good: '慢一点',
      bad: '冲动决定',
      seal: '星',
      source: 'local',
    };
  },

  // 铜钱本地兜底：云函数超时/失败时，用已掷出的正反面拼一段解读，保证有结果可看
  localCoin(faces, combo) {
    const READS = {
      '三正无背': '三枚皆正，方向已明，可顺势而行，不必再反复犹豫。',
      '两正一背': '两正一背，大势已显，只需在细节处多留一步。',
      '两背一正': '两背一正，如偏侧而行，先稳住脚步再缓缓推进。',
      '三背无正': '三枚皆背，时机未到，宜先沉淀，不必急于此刻。',
    };
    return {
      combo,
      line: combo,
      read: READS[combo] || '心绪未定，先让答案在心里沉淀。',
      good: '静听慢移',
      bad: '盲从急冲',
      seal: '钱',
      faces: (faces || []).join(' '),
      source: 'local',
    };
  },

  pickRit(e) {
    if (this._busy) return;
    clearTimeout(this._ft);
    this._stopFx();
    this._stopCoinFx();
    this.setData({ rit: e.currentTarget.dataset.rit, result: null, qianHover: false, shaking: false, condensing: false, fxFading: false, pickedStick: 0, stickText: '', tarotCards: [], tarotFlipping: false, coinSlots: CX_HOME, coinFx: false, coinFxFading: false, coinPhase: 1, coinPhaseName: '聚气起势', coinCombo: '' });
  },

  async drawRit() {
    if (this._busy || this.data.result) return;
    // 用尽拦截（调试开关开启时跳过）
    if (!DEBUG_DISABLE_QUOTA && this.data.remaining <= 0) {
      wx.showToast({ title: '今日次数已用完，明天再来', icon: 'none' });
      return;
    }
    this._busy = true;
    const rit = this.data.rit;
    const q = (this.data.question || '').trim();

    if (rit === 'qian') {
      const nums = ['一','二','三','四','五','六','七'];
      const pickedStick = Math.floor(Math.random() * 7) + 1;
      this._pickedNum = nums[pickedStick - 1];
      this._fxReady = false;
      this._apiRes = null;
      this._apiErr = null;
      this._stickText = '心安即归';
      this.setData({ condensing: true, fxFading: false, shaking: false, qianHover: false });

      // 启动 6.5s 光聚凝签过场
      wx.nextTick(() => {
        wx.createSelectorQuery().in(this)
          .select('#condense')
          .fields({ node: true, size: true })
          .exec((res) => {
            if (!res[0] || !res[0].node) {
              this._fxReady = true;
              this._tryShowQian();
              return;
            }
            this._fx = condense.play(res[0].node, {
              width: res[0].width,
              height: res[0].height,
              text: '心神归位',
              onFinish: () => {
                this._fxReady = true;
                this._tryShowQian();
              },
            });
          });
      });

      // 云函数并行（过场约 6.5s，足够返回）
      (async () => {
        try {
          const res = await api.drawQian(q);
          this.loadQuota();
          // 四字签文库：夜色神谕风格，每次随机取一句
          const pool = [
            '心安即归','守心待明','前路有光','静水流深','柔而不折',
            '月照归人','风过留声','星落枕边','夜尽天明','心念自知','慢即是快',
            '灯在身后','莫问归期','春在枝梢','海阔天空','一念放下','万般自在',
            '心如止水','行则将至','功不唐捐','来日方长','且听风吟','静待花开',
            '心有归处','路在脚下','晨光亮起','山高水长','舍得之间','梦会成真',
          ];
          const stickText = pool[Math.floor(Math.random() * pool.length)];
          this._stickText = stickText;
          this._apiRes = res;
          if (this._fx) this._fx.setText(stickText);
        } catch (e) {
          this._apiErr = e;
        }
        this._tryShowQian();
      })();
    } else if (rit === 'tarot') {
      const TAROT_POOL = [
        { name: '隐士', sym: '隐' },
        { name: '星星', sym: '星' },
        { name: '世界', sym: '世' },
        { name: '月亮', sym: '月' },
        { name: '太阳', sym: '日' },
        { name: '命运之轮', sym: '轮' },
        { name: '愚人', sym: '愚' },
        { name: '女祭司', sym: '祭' },
        { name: '力量', sym: '力' },
        { name: '节制', sym: '节' },
        { name: '塔', sym: '塔' },
        { name: '审判', sym: '审' },
      ];
      const slots = ['past', 'now', 'future'];
      // 从 12 张牌中随机抽 3 张不重复
      const pool = [...TAROT_POOL];
      const tarotCards = [];
      for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const card = pool.splice(idx, 1)[0];
        // 30% 概率逆位
        const isReversed = Math.random() < 0.3;
        tarotCards.push({
          ...card,
          slot: slots[i],
          ori: isReversed ? '逆位' : '正位',
        });
      }
      // 点击立即翻牌（抽牌结果本地已确定），给即时反馈
      this.setData({ tarotCards, tarotFlipping: true });

      // 不再弹“正在解读…”遮罩：牌翻开本身就是反馈。
      // 8s 内没等到云函数，直接用本地牌面文案出结果，避免干等到 30s 才看到“网络异常”
      let settled = false;
      const showLocal = () => {
        if (settled) return;
        settled = true;
        clearTimeout(this._ft);
        this.setData({ result: this.localTarot(tarotCards) });
        this._busy = false;
      };
      this._ft = setTimeout(showLocal, 8000);
      try {
        const res = await api.drawTarot(q, tarotCards);
        if (settled) return; // 本地结果已展示，忽略迟到的云函数返回
        settled = true;
        clearTimeout(this._ft);
        this.loadQuota();
        // 翻牌动画已在等待期间播放，结果卡稍延迟出现以衔接
        this._t = setTimeout(() => {
          this.setData({ result: res });
          this._busy = false;
        }, 500);
      } catch (e) {
        // 云函数超时/报错也照常出牌面解读，不再提示“网络异常”
        showLocal();
        this.loadQuota();
      }
    } else {
      // ===== 铜钱：前端先定三枚正反面，再走 Canvas 四段式掷钱过场 =====
      const facePool = ['正', '背'];
      const raw = [0, 1, 2].map(() => facePool[Math.floor(Math.random() * 2)]);
      const zhengCount = raw.filter((f) => f === '正').length;
      const comboName = zhengCount === 3 ? '三正无背'
        : zhengCount === 2 ? '两正一背'
          : zhengCount === 1 ? '两背一正' : '三背无正';

      this._faces = this._landFaces(raw);   // 落定顺序：上左 / 上右 / 下中
      this._combo = comboName;
      this._comboText = comboName + ' · ' + (COMBO_TAIL[comboName] || '落定知意');
      this._coinDone = false;
      this._coinRes = null;

      this.setData({
        coinFx: true,
        coinFxFading: false,
        coinPhase: 1,
        coinPhaseName: '聚气起势',
        coinCombo: '',
        coinSlots: CX_HOME,
      });

      wx.nextTick(() => this._startCoinFx());

      // 云函数并行（过场约 2.9s，正常足够返回）
      try {
        const res = await api.drawCoin(q, raw);
        this.loadQuota();
        if (res.line) res.line = res.line.replace(/^[^，,]+/, comboName);
        this._coinRes = res;
        if (this._coinDone) this._applyCoinResult();
      } catch (e) {
        if (this._coinDone) this._applyCoinResult();
        this.loadQuota();
      }
    }
  },

  // 背（谕）尽量放到底部主位，其余按原顺序占上排；不改正/背计数
  _landFaces(raw) {
    const arr = raw.slice();
    const bi = arr.indexOf('背');
    if (bi >= 0 && bi !== arr.length - 1) { arr.splice(bi, 1); arr.push('背'); }
    return arr;
  },

  _landSlots() {
    const faces = this._faces || ['正', '正', '正'];
    return CX_LAND.map((s, i) => Object.assign({}, s, { face: faces[i] }));
  },

  _startCoinFx() {
    const q = wx.createSelectorQuery().in(this);
    q.select('#coinfx').fields({ node: true, size: true });
    q.select('#coinStage').boundingClientRect();
    q.exec((res) => {
      const cv = res && res[0];
      const rect = res && res[1];
      if (!cv || !cv.node || !rect) { this._coinFallback(); return; }
      const scale = rect.width / 750; // 1rpx = scale px
      this._cfx = coinfx.play(cv.node, {
        width: cv.width,
        height: cv.height,
        ox: rect.left + rect.width / 2,
        oy: rect.top + CX_ORIGIN_TOP * scale,
        faces: this._faces,
        onPhase: (idx, name) => this.setData({ coinPhase: idx, coinPhaseName: name }),
        onFinish: () => this._onCoinFxEnd(),
      });
    });
  },

  _coinFallback() {
    this._coinDone = true;
    this._cfx = null;
    this.setData({ coinFx: false, coinFxFading: false, coinCombo: this._comboText, coinSlots: this._landSlots() });
    this._maybeCoinResult();
  },

  _onCoinFxEnd() {
    this._coinDone = true;
    this._cfx = null;
    // 画布先淡出 240ms，再把落定的钱交接给页面，避免硬切
    this.setData({ coinFxFading: true });
    this._t = setTimeout(() => {
      this.setData({
        coinFx: false,
        coinFxFading: false,
        coinCombo: this._comboText,
        coinSlots: this._landSlots(),
      });
      this._maybeCoinResult();
    }, 240);
  },

  _maybeCoinResult() {
    if (this._coinRes) { this._applyCoinResult(); return; }
    // 落定后最多再等 1.4s，拿不到云函数就用本地文案，不让人干等
    this._t = setTimeout(() => this._applyCoinResult(), 1400);
  },

  _applyCoinResult() {
    if (this.data.result) return;
    const res = this._coinRes || this.localCoin(this._faces, this._combo);
    this.setData({ result: res });
    this._busy = false;
  },

  _stopCoinFx() {
    if (this._cfx) { try { this._cfx.stop(); } catch (e) {} }
    this._cfx = null;
  },

  // 过场结束后汇合：等过场与云函数都就绪再出结果
  _tryShowQian() {
    if (!this._fxReady) return;
    if (this._apiErr) {
      this._stopFx();
      this.setData({ condensing: false, fxFading: false });
      this.handleDrawError(this._apiErr);
      this._busy = false;
      return;
    }
    if (!this._apiRes) {
      this._t = setTimeout(() => this._tryShowQian(), 300);
      return;
    }
    this._stopFx();
    // 画布先淡出 240ms，再把结果签交接给页面，避免硬切
    this.setData({ fxFading: true });
    this._t = setTimeout(() => {
      this.setData({
        condensing: false,
        fxFading: false,
        result: this._apiRes,
        stickText: this._stickText,
        pickedNum: this._pickedNum,
      });
      this._busy = false;
    }, 240);
  },

  onFxSkip() {
    if (this._fx) this._fx.skip();
    if (this._cfx) this._cfx.skip();
  },

  _stopFx() {
    if (this._fx) { try { this._fx.stop(); } catch (e) {} }
    this._fx = null;
  },

  resetAsk() {
    clearTimeout(this._t); clearTimeout(this._t1); clearTimeout(this._ft);
    this._stopFx();
    this._stopCoinFx();
    this.setData({ result: null, qianHover: false, shaking: false, condensing: false, fxFading: false, pickedStick: 0, stickText: '', tarotCards: [], tarotFlipping: false, coinSlots: CX_HOME, coinFx: false, coinFxFading: false, coinPhase: 1, coinPhaseName: '聚气起势', coinCombo: '' });
    this._busy = false;
  },

  // ===== 光聚凝签：Canvas 2D 粒子汇聚 =====
  startCondense() {
    wx.createSelectorQuery().in(this)
      .select('#condense')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = win.pixelRatio || 2;
        const W = res[0].width;
        const H = res[0].height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        this._condCanvas = canvas;
        this._condCtx = ctx;
        this._cw = W;
        this._ch = H;

        // 预渲染金色光粒 sprite（避免每粒子 shadowBlur）
        let sprite = null;
        try {
          const off = wx.createOffscreenCanvas({ type: '2d', width: 32, height: 32 });
          const oc = off.getContext('2d');
          const g = oc.createRadialGradient(16, 16, 0, 16, 16, 16);
          g.addColorStop(0, 'rgba(255,238,196,1)');
          g.addColorStop(0.35, 'rgba(238,205,130,0.85)');
          g.addColorStop(1, 'rgba(212,175,106,0)');
          oc.fillStyle = g;
          oc.fillRect(0, 0, 32, 32);
          sprite = off;
        } catch (e) {}
        this._sprite = sprite;

        // 目标点：屏幕中轴偏上的竖签区域
        const cx = W / 2;
        const cy = H * 0.40;
        const stickW = 42, stickH = 240;
        const N = 140;
        this._particles = [];
        for (let i = 0; i < N; i++) {
          const tx = cx + (Math.random() - 0.5) * stickW;
          const ty = cy - stickH / 2 + Math.random() * stickH;
          const ang = Math.random() * Math.PI * 2;
          const R = Math.max(W, H) * (0.5 + Math.random() * 0.2);
          this._particles.push({
            sx: cx + Math.cos(ang) * R,
            sy: cy + Math.sin(ang) * R,
            tx, ty,
            delay: Math.random() * 0.25,
            dur: 0.65 + Math.random() * 0.35,
            size: 2.5 + Math.random() * 3,
            phase: Math.random() * Math.PI * 2,
          });
        }
        this._condT0 = Date.now();
        this._condAnim = canvas.requestAnimationFrame(() => this._condFrame());
      });
  },

  _condFrame() {
    const ctx = this._condCtx;
    if (!ctx) return;
    const W = this._cw, H = this._ch;
    const t = (Date.now() - this._condT0) / 1000;
    const DUR = 1.4;
    const p = Math.min(t / DUR, 1);

    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.40;

    // 中心辉光随汇聚增强
    if (p > 0.45) {
      const gp = (p - 0.45) / 0.55;
      const gr = 110 * gp;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      g.addColorStop(0, 'rgba(216,180,106,' + (0.28 * gp).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(216,180,106,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // 粒子
    for (let i = 0; i < this._particles.length; i++) {
      const pt = this._particles[i];
      const lp = Math.min(Math.max((p - pt.delay) / pt.dur, 0), 1);
      const e = 1 - Math.pow(1 - lp, 3);
      let x = pt.sx + (pt.tx - pt.sx) * e;
      let y = pt.sy + (pt.ty - pt.sy) * e;
      const dx = pt.tx - pt.sx, dy = pt.ty - pt.sy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const swirl = Math.sin(lp * Math.PI * 3 + pt.phase) * (1 - e) * 18;
      x += (-dy / dist) * swirl;
      y += (dx / dist) * swirl;
      const tw = 0.55 + 0.45 * Math.sin(t * 6 + pt.phase);
      const r = pt.size * (0.6 + 0.5 * e);
      ctx.globalAlpha = tw * (0.35 + 0.65 * e);
      if (this._sprite) {
        ctx.drawImage(this._sprite, x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = 'rgba(238,205,130,0.9)';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (p < 1) {
      this._condAnim = this._condCanvas.requestAnimationFrame(() => this._condFrame());
    }
  },

  _stopCondense() {
    if (this._condAnim && this._condCanvas) {
      try { this._condCanvas.cancelAnimationFrame(this._condAnim); } catch (e) {}
    }
    this._condAnim = null;
    this._condCanvas = null;
    this._particles = [];
  },

  async onFav() {
    try {
      await api.favAdd('sign', this.data.result);
      wx.showToast({ title: '已收藏', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '收藏失败', icon: 'none' });
    }
  },
  onShare() {
    if (!this.data.result) return;
    wx.setStorageSync('shareData', {
      rit: this.data.rit,
      result: this.data.result,
      stickText: this.data.stickText || ''
    });
    wx.navigateTo({ url: '/pages/share/share' });
  },

  onUnload() { clearTimeout(this._t); clearTimeout(this._t1); clearTimeout(this._ft); this._stopFx(); this._stopCoinFx(); },
});
