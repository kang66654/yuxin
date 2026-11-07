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
      const data = await api.favList('sign');
      this.setData({ list: data, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async delItem(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.favDelete(id);
      this.loadList();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  goBack() { wx.navigateBack(); },
});
