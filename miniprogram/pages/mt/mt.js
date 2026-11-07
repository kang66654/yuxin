const app = getApp();
const api = require('../../utils/api.js');

Page({
  data: {
    statusBarHeight: 20,
    list: [],
    loading: true,
    // 出题
    showCreate: false,
    creating: false,
    themes: ['放下', '期待', '牵挂', '疲惫', '被理解', '开心小事'],
    theme: '放下',
    moods: ['平静', '期待', '焦虑', '开心'],
    mood: '平静',
    // 评分
    showScore: false,
    scoring: false,
    scoreId: '',
    scoreOptions: [],
    myAnswer: '',
    friendAnswer: '',
    friendReplied: false,
    scoreResult: null,
    // 好友答题模式
    friendMode: false,
    friendMatchId: '',
    friendQuestion: '',
    friendOptions: [],
    friendPick: '',
    friendSubmitting: false,
    friendDone: false,
    alreadyTaken: false,
  },

  onLoad(query) {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 20 });
    // 好友从分享卡片打开
    if (query.fromFriend === '1' && query.matchId) {
      this.setData({ friendMode: true, friendMatchId: query.matchId });
      this.loadFriendView(query.matchId);
    }
  },

  onShow() {
    if (!this.data.friendMode) this.loadList();
  },

  // 好友加载题目
  async loadFriendView(matchId) {
    this.setData({ loading: true });
    try {
      const res = await api.friendView(matchId);
      if (res.isCreator) {
        // 创建者本人打开自己的分享 → 回列表
        wx.showToast({ title: '这是你自己的题', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      if (res.alreadyTaken) {
        this.setData({ alreadyTaken: true, loading: false });
        return;
      }
      this.setData({
        friendQuestion: res.match.question,
        friendOptions: res.match.options || [],
        loading: false,
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  pickFriend(e) {
    this.setData({ friendPick: e.currentTarget.dataset.v });
  },

  async submitFriendAnswer() {
    if (!this.data.friendPick) {
      wx.showToast({ title: '请选一个答案', icon: 'none' });
      return;
    }
    if (this.data.friendSubmitting) return;
    this.setData({ friendSubmitting: true });
    try {
      await api.friendAnswer(this.data.friendMatchId, this.data.friendPick);
      this.setData({ friendDone: true, friendSubmitting: false });
      wx.showToast({ title: '已提交', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '提交失败', icon: 'none' });
      this.setData({ friendSubmitting: false });
    }
  },

  async loadList() {
    try {
      const data = await api.matchList();
      this.setData({ list: data, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  showCreateModal() { this.setData({ showCreate: true, theme: '放下', mood: '平静' }); },
  closeCreate() { this.setData({ showCreate: false }); },
  pickTheme(e) { this.setData({ theme: e.currentTarget.dataset.v }); },
  pickMood(e) { this.setData({ mood: e.currentTarget.dataset.v }); },

  async createMatch() {
    if (this.data.creating) return;
    this.setData({ creating: true });
    try {
      const res = await api.matchCreate(this.data.theme, this.data.mood);
      this.setData({ showCreate: false, creating: false });
      this.loadList();
      // 创建成功后直接弹出分享
      wx.showModal({
        title: '题目已生成',
        content: '分享给好友，让 TA 帮你选一下？',
        confirmText: '去分享',
        success: (r) => {
          if (r.confirm) {
            wx.showToast({ title: '点右上角转发', icon: 'none' });
          }
        },
      });
      // 保存最新创建的 id 供分享用
      if (res && res.id) this.setData({ lastCreatedId: res.id });
    } catch (e) {
      wx.showToast({ title: '创建失败', icon: 'none' });
      this.setData({ creating: false });
    }
  },

  // 分享给好友
  onShareAppMessage(e) {
    const matchId = e.target ? e.target.dataset.id : this.data.lastCreatedId;
    return {
      title: '谕心出了一道题，帮我选一下？',
      path: `/pages/mt/mt?fromFriend=1&matchId=${matchId}`,
    };
  },

  // 打开评分弹窗
  openScore(e) {
    const ds = e.currentTarget.dataset;
    // 从列表中找到这条记录，带入好友已答的答案
    const item = this.data.list.find((it) => it._id === ds.id);
    const friendAns = item ? (item.friendAnswer || '') : '';
    this.setData({
      showScore: true,
      scoreId: ds.id,
      scoreOptions: ds.options ? ds.options : (item ? item.options : []),
      myAnswer: '',
      friendAnswer: friendAns,
      friendReplied: !!friendAns,
      scoreResult: null,
    });
  },
  closeScore() { this.setData({ showScore: false, scoreResult: null }); },
  pickMy(e) { this.setData({ myAnswer: e.currentTarget.dataset.v }); },
  pickFriendScore(e) { this.setData({ friendAnswer: e.currentTarget.dataset.v }); },

  async submitScore() {
    if (!this.data.myAnswer || !this.data.friendAnswer) {
      wx.showToast({ title: '请选择双方答案', icon: 'none' });
      return;
    }
    if (this.data.scoring) return;
    this.setData({ scoring: true });
    try {
      const r = await api.matchScore(
        this.data.scoreId,
        this.data.myAnswer, this.data.mood,
        this.data.friendAnswer, '平静'
      );
      this.setData({ scoreResult: r, scoring: false });
      this.loadList();
    } catch (e) {
      wx.showToast({ title: '评分失败', icon: 'none' });
      this.setData({ scoring: false });
    }
  },

  goBack() { wx.navigateBack(); },
});
