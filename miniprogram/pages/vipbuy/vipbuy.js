const app = getApp();
Page({
  data: { statusBarHeight: 20 },
  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 }); },
  goBack() { wx.navigateBack(); },
  toast(e) { wx.showToast({ title: e.currentTarget.dataset.t || '演示中', icon: 'none' }); }
});
