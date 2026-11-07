// 首页：壳层参数 + 云端今日签
const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    navRight: 8,
    dateText: '11月5日 · 星期四',
    luck: '128',
    levelText: '听风人 · 连续 7 天',
    dailySign: '',
    dailyYi: '',
    dailyJi: '',
    dailyLoading: true,
  },

  onLoad() {
    const g = app.globalData;
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const navRight = g.capsule && g.capsule.left ? Math.max(0, win.windowWidth - g.capsule.left + 8) : 16;
    const d = new Date();
    const dateText = `${d.getMonth() + 1}月${d.getDate()}日 · ${['日','一','二','三','四','五','六'][d.getDay()]}`;
    this.setData({
      statusBarHeight: g.statusBarHeight || 20,
      navRight,
      dateText,
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().sync(0);
    }
    this.loadDailySign();
  },

  async loadDailySign() {
    try {
      const s = await api.dailySign();
      this.setData({
        dailySign: s.sign,
        dailyYi: s.yi,
        dailyJi: s.ji,
        dailyLoading: false,
      });
    } catch (e) {
      this.setData({ dailyLoading: false });
    }
  },

  goAsk() {
    wx.switchTab({ url: '/pages/ask/ask' });
  },
  goTree() {
    wx.switchTab({ url: '/pages/tree/tree' });
  },
  goMt() {
    wx.navigateTo({ url: '/pages/mt/mt' });
  },
  openShare() {
    wx.navigateTo({ url: '/pages/share/share' });
  },
});
