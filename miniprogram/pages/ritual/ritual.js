const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    view: 'lib',                 // lib | incense | star
    incenseStep: 'start',        // start | anim | result
    incenseLeft: '2:47',
    incenseWish: '关于那件一直拖着的事，其实我心里有答案，只是想被确认。',
    incenseMood: '平静',
    incenseResult: null,
    starStep: 'start',
    starMood: 'glow',
    starMoodName: '微光',
    starCustomMood: '',
    starResult: null,
    starLoading: false,
    starMoods: [
      { k: 'glow', name: '微光', n: '天鹅座 · 6 星' },
      { k: 'wind', name: '起风', n: '仙后座 · 5 星' },
      { k: 'clear', name: '星晴', n: '猎户座 · 7 星' },
      { k: 'lost', name: '迷航', n: '北斗七星 · 7 星' },
      { k: 'full', name: '圆满', n: '天琴座 · 5 星' },
    ],
  },

  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 }); },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().sync(3);
  },

  openRit(e) { this.setData({ view: e.currentTarget.dataset.k }); },
  closeView() { this.setData({ view: 'lib' }); },

  onWishInput(e) { this.setData({ incenseWish: e.detail.value }); },

  // 焚香：动画 2400ms 后调 AI 出烟纹签
  incenseStart() {
    this.setData({ incenseStep: 'anim' });
    this._t = setTimeout(() => this.fetchIncense(), 2400);
  },
  async fetchIncense() {
    try {
      const r = await api.ritualAi({
        type: 'incense',
        wish: this.data.incenseWish,
        mood: this.data.incenseMood,
      });
      this.setData({ incenseStep: 'result', incenseResult: r });
    } catch (e) {
      // 兜底也由云函数返回，极少走到这里；仍切到结果态
      this.setData({ incenseStep: 'result' });
    }
  },
  incenseReset() {
    clearTimeout(this._t);
    this.setData({ incenseStep: 'start', incenseResult: null });
  },

  pickStarMood(e) {
    const m = e.currentTarget.dataset;
    this.setData({ starMood: m.k, starMoodName: m.n, starCustomMood: '' });
  },
  onStarCustomInput(e) {
    this.setData({ starCustomMood: e.detail.value });
  },
  confirmStarCustom() {
    const v = (this.data.starCustomMood || '').trim();
    if (!v) return;
    this.setData({ starMood: 'custom', starMoodName: v });
    wx.showToast({ title: '心情已记下', icon: 'none' });
  },
  // 观星：动画 1600ms 后调 AI 出星语签
  starStart() {
    this.setData({ starStep: 'anim', starLoading: true });
    this._t = setTimeout(() => this.fetchStar(), 1600);
  },
  async fetchStar() {
    const moodCfg = this.data.starMoods.find((m) => m.k === this.data.starMood) || this.data.starMoods[0];
    try {
      const r = await api.ritualAi({
        type: 'stargaze',
        moodPick: moodCfg.name,
        constellation: moodCfg.n,
      });
      this.setData({ starStep: 'result', starResult: r, starLoading: false });
    } catch (e) {
      this.setData({ starStep: 'result', starLoading: false });
    }
  },
  starReset() {
    clearTimeout(this._t);
    this.setData({ starStep: 'start', starResult: null });
  },

  onUnload() { clearTimeout(this._t); },
});
