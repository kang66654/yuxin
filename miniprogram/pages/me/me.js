const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    treeCount: 0,
    matchCount: 0,
    favCount: 0,
    ritualCount: 0,
  },

  onLoad() { this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 }); },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().sync(4);
    this.loadCounts();
  },

  async loadCounts() {
    try {
      const [trees, matches, favs, rituals] = await Promise.all([
        api.treeList(),
        api.matchList(),
        api.favList('sign'),
        api.ritualList(),
      ]);
      this.setData({
        treeCount: trees.length,
        matchCount: matches.length,
        favCount: favs.length,
        ritualCount: rituals.length,
      });
    } catch (e) {
      // 云函数未部署时静默降级，保持 0
    }
  },

  onEdit() { wx.navigateTo({ url: '/pages/intro/intro' }); },
  onList(e) {
    const k = e.currentTarget.dataset.k;
    const map = { records: '/pages/records/records', mt: '/pages/mt/mt', fav: '/pages/fav/fav', ritual: '/pages/ritrec/ritrec' };
    if (map[k]) wx.navigateTo({ url: map[k] });
    else wx.showToast({ title: k + ' 待接云库', icon: 'none' });
  },
  onVip() { wx.navigateTo({ url: '/pages/vipbuy/vipbuy' }); },
});
