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
      const data = await api.treeList();
      this.setData({ list: data, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async delItem(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.treeDelete(id);
      this.loadList();
      wx.showToast({ title: '已删除', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  clearAll() {
    wx.showModal({
      title: '清空全部记录',
      content: '确定要删除所有树洞记录吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          for (const item of this.data.list) {
            await api.treeDelete(item._id);
          }
          this.loadList();
        } catch (e) {
          wx.showToast({ title: '清空失败', icon: 'none' });
        }
      },
    });
  },

  goBack() { wx.navigateBack(); },
});
