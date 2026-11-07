const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    moods: ['低落','焦虑','疲惫','平静','开心','烦躁','迷茫','孤独','委屈','紧张','轻松','期待'],
    mood: '低落',
    showCustom: false,
    customText: '',
    moodText: '今天好累，事情一件接一件，感觉自己撑不住了。',
    echo: false,
    echoText: '',
    echoTip: '',
    isCrisis: false,
    sending: false,
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().sync(2);
  },

  chipPick(e) { this.setData({ mood: e.currentTarget.dataset.m }); },
  onCustomInput(e) { this.setData({ customText: e.detail.value }); },
  addCustom() {
    const t = (this.data.customText || '').trim();
    if (!t) return;
    this.setData({ mood: t, customText: '' });
  },
  onMoodInput(e) { this.setData({ moodText: e.detail.value }); },

  async sendEcho() {
    if (this.data.sending) return;
    this.setData({ sending: true });
    try {
      const content = (this.data.moodText || '').trim();
      if (!content) {
        wx.showToast({ title: '写点什么再送出吧', icon: 'none' });
        this.setData({ sending: false });
        return;
      }
      const res = await api.treePost(this.data.mood, content);
      this.setData({
        echo: true,
        sending: false,
        moodText: '',
        echoText: res.echo || '',
        echoTip: res.tip || '',
        isCrisis: !!res.crisis,
      });
    } catch (e) {
      wx.showToast({ title: '送出失败，请重试', icon: 'none' });
      this.setData({ sending: false });
    }
  },
  closeEcho() { this.setData({ echo: false, isCrisis: false }); },
});
