// utils/api.js — 谕心前端请求封装
// 统一调用云函数 yuxin，action 分发
function call(action, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'yuxin',
      data: { action, ...data },
      success: (res) => {
        if (res.result && res.result.ok) resolve(res.result.data);
        else reject(new Error(res.result?.msg || '请求失败'));
      },
      fail: (err) => reject(err),
    });
  });
}

module.exports = {
  // 首页数据
  home: () => call('home'),
  // 首页今日签
  dailySign: () => call('daily_sign'),
  // 问事三仪式
  drawQian: (question) => call('draw_qian', { question }),
  drawTarot: (question, slots) => call('draw_tarot', { question, slots }),
  drawCoin: (question, faces) => call('draw_coin', { question, faces }),
  // 树洞
  treePost: (mood, content) => call('treehole_post', { mood, content }),
  treeList: () => call('treehole_list'),
  treeDelete: (id) => call('treehole_delete', { id }),
  echoList: (id) => call('echo_list', { id }),
  // 收藏
  favAdd: (type, data) => call('fav_add', { type, data }),
  favList: (type) => call('fav_list', { type }),
  favDelete: (id) => call('fav_delete', { id }),
  // 互测
  matchCreate: (theme, mood, question) => call('match_create', { theme, mood, question }),
  matchScore: (matchId, answerA, moodA, answerB, moodB) =>
    call('match_score', { matchId, answerA, moodA, answerB, moodB }),
  matchList: () => call('match_list'),
  friendView: (matchId) => call('friend_view', { matchId }),
  friendAnswer: (matchId, answer) => call('friend_answer', { matchId, answer }),
  // 等级/好运值
  levelInfo: () => call('level_info'),
  // 仪式完成记录
  ritualComplete: (type) => call('ritual_complete', { type }),
  ritualAi: (params) => call('ritual_ai', params),
  ritualList: (type) => call('ritual_list', { type }),
  // 会员
  vipStatus: () => call('vip_status'),
  vipOrder: (plan) => call('vip_order', { plan }),
  // 用户资料
  userInit: () => call('user_init'),
  userUpdate: (profile) => call('user_update', profile),
  // 分享卡数据
  shareCard: (drawId) => call('share_card', { drawId }),
  // 小程序码
  qrcodeGet: (scene) => call('qrcode_get', { scene }),
  // 每日次数
  quotaCheck: () => call('quota_check'),
};
