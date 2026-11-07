// app.js —— 谕心：全局壳层参数 + 云开发初始化
App({
  globalData: {
    env: '', // TODO: 填入你的云环境 ID（云开发控制台 → 设置 → 环境 ID）
    statusBarHeight: 20,
    navBarHeight: 44,
    capsule: { top: 0, right: 0, width: 87, height: 32 },
    safeBottom: 0,
    member: false,        // 会员态由 me / 云函数回填
    dateText: '11月5日 · 星期四',   // 首页日期，A6 接 home action 后由云端下发
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({ env: this.globalData.env, traceUser: true });
    }
    this.measureShell();
    this.initUser();
  },

  async initUser() {
    try {
      const api = require('./utils/api.js');
      const user = await api.userInit();
      this.globalData.user = user;
      this.globalData.dateText = this.buildDateText();
    } catch (e) {
      console.warn('[yuxin] user init failed, using defaults:', e);
    }
  },

  buildDateText() {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日 · ${['日','一','二','三','四','五','六'][d.getDay()]}`;
  },

  // 状态栏 / 胶囊 / 安全区：唯一物理不可能零差处（清单 NT-03、NT-04）
  measureShell() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const statusBarHeight = win.statusBarHeight || 20;
    let navBarHeight = 44;
    let cap = { top: statusBarHeight + 8, right: win.windowWidth - 4, width: 87, height: 32 };
    if (capsule && capsule.height) {
      navBarHeight = (capsule.top - statusBarHeight) * 2 + capsule.height;
      cap = capsule;
    }
    Object.assign(this.globalData, {
      statusBarHeight,
      navBarHeight,
      capsule: cap,
      safeBottom: win.safeArea ? Math.max(0, win.screenHeight - win.safeArea.bottom) : 0,
      windowWidth: win.windowWidth,
      windowHeight: win.windowHeight,
    });
  },
});
