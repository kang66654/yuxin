const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    list: [],
    loading: true,
  },

  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 }); },
  onShow() { this.loadList(); },

  async loadList() {
    try {
      const data = await api.ritualList();
      const list = (data || []).map((it) => {
        const d = new Date(it.createdAt);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        it._date = `${m}-${day} ${h}:${min}`;
        return it;
      });
      this.setData({ list, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goBack() { wx.navigateBack(); },
});
