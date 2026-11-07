// custom-tab-bar —— 复刻原型 .pnav nav5（DOM 结构、文案、金线标记一致）
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/home', text: '首页', icon: 'home' },
      { pagePath: '/pages/ask/ask', text: '问事', icon: 'ask' },
      { pagePath: '/pages/tree/tree', text: '树洞', icon: 'tree' },
      { pagePath: '/pages/ritual/ritual', text: '仪式', icon: 'ritual' },
      { pagePath: '/pages/me/me', text: '我的', icon: 'me' },
    ],
  },

  methods: {
    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      if (idx === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    },

    // 页面 onShow 调用：同步高亮项（custom tabBar 不会自动同步）
    sync(index) {
      if (index !== this.data.selected) this.setData({ selected: index });
    },
  },
});
