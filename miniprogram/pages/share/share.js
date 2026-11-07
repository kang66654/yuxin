const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    isVip: false,
    rit: 'qian',
    // 卡片内容（动态填充）
    line1: '山重水复处，',
    line2: '自有新路。',
    good: '慢一点',
    bad: '冲动',
    read: '',
    name: '听风人',
    date: '',
    no: '',
    seal: '谕',
    title: '谕心 · 夜签',
    qrCode: ''
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    this.loadData();
    this.refreshVip();
    this.loadQr();
  },

  async loadQr() {
    try {
      const res = await api.qrcodeGet('from=share');
      if (res && res.image) this.setData({ qrCode: res.image });
    } catch (e) { /* 开发版无小程序码，保持占位 */ }
  },

  loadData() {
    const d = wx.getStorageSync('shareData') || {};
    const r = d.result || {};
    const rit = d.rit || 'qian';

    // 大标题签句：按标点拆成两行
    let big = (r.line || r.read || '心安即归处。').trim();
    let line1 = big, line2 = '';
    const m = big.match(/^([^，。；]+[，。；])(.*)$/);
    if (m) { line1 = m[1]; line2 = m[2]; }

    // 落款日期
    const now = new Date();
    const date = `${now.getMonth() + 1}月${now.getDate()}日`;

    // 昵称
    const user = app.globalData.user || {};
    const name = user.name || '听风人';

    // 会员编号：用好运值生成一个伪编号
    const luck = user.luck || 7;
    const no = 'No.' + String(luck).padStart(4, '0');

    const title = rit === 'qian' ? '谕心 · 夜签'
               : rit === 'tarot' ? '谕心 · 塔罗'
               : '谕心 · 铜钱';

    this.setData({
      rit,
      line1, line2,
      read: r.read || '',
      good: r.good || '慢一点',
      bad: r.bad || '冲动',
      name, date, no,
      title
    });
  },

  async refreshVip() {
    // 先读本地缓存的会员态，再用云端刷新
    const user = app.globalData.user || {};
    let vip = !!(app.globalData.member || user.vip || user.vipExpire);
    this.setData({ isVip: vip });
    try {
      const res = await api.vipStatus();
      const cloudVip = !!(res && res.vip);
      app.globalData.member = cloudVip;
      this.setData({ isVip: cloudVip });
    } catch (e) { /* 保持本地判断 */ }
  },

  saveCard() {
    wx.showLoading({ title: '正在生成…', mask: true });
    this.drawCard().then(() => {
      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvasId: 'saveCanvas',
          success: (res) => resolve(res.tempFilePath),
          fail: reject,
        }, this);
      });
    }).then((tempPath) => {
      return new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: tempPath,
          success: resolve,
          fail: reject,
        });
      });
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已保存到相册', icon: 'success' });
    }).catch((err) => {
      wx.hideLoading();
      if (err.errMsg && err.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中允许保存图片到相册',
          confirmText: '去设置',
          success: (res) => { if (res.confirm) wx.openSetting(); },
        });
      } else {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    });
  },

  drawCard() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#saveCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res[0] || !res[0].node) return reject('canvas not found');
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const W = 600, H = 900;
        canvas.width = W;
        canvas.height = H;
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        // 背景
        ctx.fillStyle = '#0B0C1E';
        ctx.fillRect(0, 0, W, H);

        // 外卡边框
        ctx.strokeStyle = '#E8C98A';
        ctx.lineWidth = 2;
        this.roundRect(ctx, 20, 20, W - 40, H - 40, 20);
        ctx.stroke();

        // 标题
        ctx.fillStyle = '#E8C98A';
        ctx.font = 'bold 22px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('✦ ' + this.data.title + ' ✦', W / 2, 65);

        // 纸面区域
        const px = 50, py = 90, pw = W - 100, ph = H - 180;
        ctx.fillStyle = '#F2EBD8';
        this.roundRect(ctx, px, py, pw, ph, 12);
        ctx.fill();

        // 水印「谕」
        ctx.fillStyle = 'rgba(180,141,74,0.1)';
        ctx.font = 'bold 100px "Songti SC", serif';
        ctx.textAlign = 'right';
        ctx.fillText('谕', px + pw - 30, py + ph / 2 + 30);

        // 主签文
        ctx.fillStyle = '#2A2018';
        ctx.font = 'bold 36px "Songti SC", serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.data.line1, px + 35, py + 70);
        if (this.data.line2) {
          ctx.fillText(this.data.line2, px + 35, py + 118);
        }

        // 解读
        if (this.data.read) {
          ctx.fillStyle = '#5A5040';
          ctx.font = '16px sans-serif';
          this.wrapText(ctx, this.data.read, px + 35, py + 160, pw - 70, 24);
        }

        // 宜忌
        let yjY = py + ph - 80;
        ctx.font = '14px "Songti SC", serif';
        // 宜
        ctx.fillStyle = '#5e7a5c';
        this.roundRect(ctx, px + 35, yjY - 18, 30, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('宜', px + 50, yjY - 1);
        ctx.fillStyle = '#5e7a5c';
        ctx.textAlign = 'left';
        ctx.fillText(this.data.good, px + 75, yjY - 1);
        // 忌
        ctx.fillStyle = '#a8452e';
        this.roundRect(ctx, px + 200, yjY - 18, 30, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('忌', px + 215, yjY - 1);
        ctx.fillStyle = '#a8452e';
        ctx.textAlign = 'left';
        ctx.fillText(this.data.bad, px + 240, yjY - 1);

        // 落款
        ctx.fillStyle = '#8A7A60';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('—— ' + this.data.name + ' · ' + this.data.date, px + pw - 35, py + ph - 30);

        // 印章
        ctx.fillStyle = '#a8452e';
        this.roundRect(ctx, px + pw - 65, py + ph - 65, 38, 38, 4);
        ctx.fill();
        ctx.fillStyle = '#F5F1E8';
        ctx.font = 'bold 20px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('谕', px + pw - 46, py + ph - 38);

        resolve();
      });
    });
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = '';
    for (let i = 0; i < text.length; i++) {
      const test = line + text[i];
      if (ctx.measureText(test).width > maxWidth) {
        ctx.fillText(line, x, y);
        line = text[i];
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
  },

  onSecond() {
    if (this.data.isVip) {
      wx.showToast({ title: '分享给好友（演示）', icon: 'none' });
    } else {
      wx.navigateBack();
    }
  }
});
