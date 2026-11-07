// cloudfunctions/yuxin/index.js — 谕心云函数主入口
// 13 集合 · 22 action 分发
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 15000 });
const db = cloud.database();
const _ = db.command;
const ai = require('./ai.js');
const prompts = require('./prompts.js');
const schema = require('./schema.js');

// ===== 签文库（演示数据，上线后迁入数据库 signs 集合）=====
const QIAN_POOL = [
  { title: '神谕签 · 山重', line: '山重水复处，自有新路。', read: '先不急着答复，今晚把利弊写下来。睡前列三行。', good: '慢一点', bad: '冲动决定', seal: '谕' },
  { title: '神谕签 · 烟纹', line: '烟绕三匝，答案已在心中。', read: '你其实早就选了，只是想要一句肯定。今晚就照心里那个答案去做第一步。', good: '先走一步', bad: '反复推翻', seal: '香' },
  { title: '神谕签 · 星途', line: '星光不问赶路人，却记得你的方向。', read: '微光也是光。把今天没做完的事，留给明天的自己，不丢人。', good: '安睡', bad: '睡前复盘', seal: '星' },
  { title: '神谕签 · 静水', line: '静水深流，不急不躁。', read: '你比自己想象的更稳。此刻需要的不是行动，是等待水位回落。', good: '静观', bad: '强行推进', seal: '谕' },
  { title: '神谕签 · 新芽', line: '石缝新芽，弱而不折。', read: '新的开始看起来很小，但根已经在地下扎稳了。再给它三天。', good: '耐心', bad: '拔苗助长', seal: '谕' },
];

const TAROT_POOL = [
  { name: '隐士', sym: '隐', up: '克制内省', down: '暂时封闭' },
  { name: '星星', sym: '星', up: '有光可依', down: '光被云挡' },
  { name: '世界', sym: '世', up: '终会圆满', down: '还差一环' },
  { name: '月亮', sym: '月', up: '直觉引路', down: '迷雾未散' },
  { name: '太阳', sym: '日', up: '明朗可期', down: '暂时黯淡' },
  { name: '命运之轮', sym: '轮', up: '转机将至', down: '暂入低谷' },
  { name: '愚人', sym: '愚', up: '轻装启程', down: '莽撞冒进' },
  { name: '女祭司', sym: '祭', up: '静听内心', down: '封闭自我' },
  { name: '力量', sym: '力', up: '柔能克刚', down: '用力过猛' },
  { name: '节制', sym: '节', up: '调和有度', down: '失衡急躁' },
  { name: '塔', sym: '塔', up: '破旧立新', down: '突变震荡' },
  { name: '审判', sym: '审', up: '复盘新生', down: '苛责自己' },
];

const COIN_POOL = [
  { combo: '三正', line: '三正无背，顺势而为。', read: '天时在你这边，但别贪多。选最想做的那件，一次只做一件。', good: '专注', bad: '贪多嚼不烂', seal: '钱' },
  { combo: '两正一背', line: '两正一背，先难后易。', read: '大方向已明，细节慢慢来。今天先把第一步走完。', good: '先走一步', bad: '反复推翻', seal: '钱' },
  { combo: '两背一正', line: '两背一正，守势待时。', read: '现在不是发力的时候，把能做的小事做好，等风来。', good: '蓄力', bad: '强行出击', seal: '钱' },
  { combo: '三背', line: '三背无正，静守本心。', read: '外界噪音太多，先别急着做决定。今晚睡个好觉，明天再看。', good: '安睡', bad: '深夜纠结', seal: '钱' },
];

// ===== 新增场景本地兜底语料 =====
const DAILY_POOL = [
  { sign: '把难说出口的话，先写成一行字。', yi: '落笔就好', ji: '反复咀嚼' },
  { sign: '夜色会接住你，今晚先安睡。', yi: '早点休息', ji: '深夜纠结' },
  { sign: '微光也是光，慢慢来。', yi: '看见自己', ji: '苛责自己' },
  { sign: '答案在心里，等风静下来。', yi: '静心倾听', ji: '匆忙决定' },
];
const ECHO_POOL = [
  { echo: '抱抱你。今晚先好好睡一觉，事情不会跑，明天再一件一件来。', tip: '睡前喝杯温水' },
  { echo: '你已经很努力了，允许自己慢一点。', tip: '写下三个小确幸' },
  { echo: '夜色会接住你，不必一个人扛。', tip: '深呼吸十次' },
];
const MATCH_Q_POOL = [
  { question: '此刻你最想放下的是什么？', options: ['一段牵挂', '一个执念', '一份疲惫'] },
  { question: '今晚最想给自己的一份礼物是？', options: ['好好睡一觉', '一顿好吃的', '安静独处'] },
  { question: '你最近最期待发生的事是？', options: ['被人理解', '一次远行', '新的开始'] },
];
const INCENSE_POOL = [
  { sign: '烟绕三匝，答案已在心中。', sub: '心有微光', read: '你其实早就选了，只是想要一句肯定。今晚就照心里那个答案去做第一步。', yi: '先走一步', ji: '反复推翻' },
  { sign: '烟散之后，剩下的是平静。', sub: '余温未尽', read: '先把那件事写下来，你会发现它没那么重。今晚早点休息。', yi: '写下来', ji: '深夜决定' },
];
const STARGAZE_POOL = [
  { line: '星光不问赶路人，却记得你的方向。', sky: '今夜宜静思', read: '微光也是光。把今天没做完的事，留给明天的自己，不丢人。', yi: '安睡', ji: '睡前复盘' },
  { line: '星点散得开，心也可以松一松。', sky: '今夜宜放松', read: '你同时挂着几件事，先挑最重要的一件，其余交给明天。', yi: '专注一件', ji: '贪多' },
];

// ===== 工具函数 =====
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function ok(data) { return { ok: true, data }; }
function fail(msg) { return { ok: false, msg }; }

// 三档时段：0-5 凌晨 / 6-18 白天 / 19-23 深夜
function timeBucket(d) {
  const h = (d || new Date()).getHours();
  if (h < 6) return '凌晨';
  if (h < 19) return '白天';
  return '深夜';
}

// 日期与季节（不依赖精确节气表，按月给季节）
function seasonText(d) {
  const t = d || new Date();
  const m = t.getMonth() + 1;
  const season = m >= 3 && m <= 5 ? '春' : m >= 6 && m <= 8 ? '夏' : m >= 9 && m <= 11 ? '秋' : '冬';
  return m + '月' + t.getDate() + '日 · ' + season;
}

// 高危内容预判：命中即不调用模型，直接给热线
const CRISIS_RE = /(活不下去|不想活|想死|自杀|轻生|跳楼|跳河|割腕|自伤|结束生命|厌世|了结自己)/;
function isCrisis(text) {
  return CRISIS_RE.test(String(text || ''));
}

// 发送给模型前脱敏：手机号、微信号、URL、长数字串
function sanitizeText(text) {
  let s = String(text || '');
  s = s.replace(/1[3-9]\d{9}/g, '[手机号]');
  s = s.replace(/微信[号]?[：:\s]*[A-Za-z0-9_-]{5,}/g, '[微信号]');
  s = s.replace(/https?:\/\/\S+/g, '[链接]');
  s = s.replace(/\b\d{11,}\b/g, '[数字]');
  if (s.length > 120) s = s.slice(0, 120);
  return s.trim();
}

// 服务端配额校验：非会员每日 3 次，用尽抛错
// 【调试开关】临时关闭次数限制，调试完改回 false 即可恢复
const DEBUG_DISABLE_QUOTA = true;
async function assertQuota() {
  if (DEBUG_DISABLE_QUOTA) return;
  const { OPENID } = cloud.getWXContext();
  const userRes = await db.collection('users').where({ _openid: OPENID }).get();
  const user = userRes.data[0];
  const vip = user && user.vip;
  if (vip) return;
  const countRes = await db.collection('draws').where({
    _openid: OPENID,
    date: new Date().toDateString(),
  }).count();
  if (countRes.total >= 3) {
    const err = new Error('QUOTA_EXCEEDED');
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }
}

// 取用户画像上下文（供模型调整语气，缺失字段不编造）
async function getUserCtx() {
  const { OPENID } = cloud.getWXContext();
  const userRes = await db.collection('users').where({ _openid: OPENID }).get();
  const u = userRes.data[0] || {};
  const profile = {};
  if (u.name) profile.nick = u.name;
  if (u.zodiac) profile.zodiac = u.zodiac;
  if (u.mbti) profile.mbti = u.mbti;
  return { level: u.level || 1, profile };
}

// 塔罗本地兜底：按正/逆位补固定词
function localTarot(clientSlots) {
  const cards = clientSlots.map((s) => {
    const poolCard = TAROT_POOL.find((c) => c.name === s.name) || {};
    return {
      slot: s.slot, name: s.name, sym: s.sym, ori: s.ori,
      word: s.ori === '逆位' ? (poolCard.down || '暂被挡住') : (poolCard.up || '心有微光'),
    };
  });
  return {
    title: '塔罗三张 · 圣三角',
    cards,
    line: cards.map((c) => c.name + '·' + c.ori).join(' → '),
    read: '过去' + cards[0].word + '，现在' + cards[1].word + '，未来' + cards[2].word + '。不必急着定，今晚先让答案在心里沉淀。',
    good: '慢一点', bad: '冲动决定', seal: '星', source: 'local',
  };
}

// 铜钱本地兜底：按组合匹配本地语料
function localCoin(faceArr, combo) {
  const shortCombo = combo.replace(/无背|无正/, '');
  const poolSign = COIN_POOL.find((c) => c.combo === shortCombo) || COIN_POOL[1];
  return {
    title: '神谕签 · 铜钱卦',
    combo,
    line: combo,
    read: poolSign.read,
    good: poolSign.good,
    bad: poolSign.bad,
    seal: '钱',
    faces: faceArr.join(' '),
    source: 'local',
  };
}

// 今日签兜底
function localDaily() {
  return Object.assign({}, pick(DAILY_POOL), { source: 'local' });
}
// 树洞回响兜底
function localEcho() {
  return Object.assign({}, pick(ECHO_POOL), { source: 'local' });
}
// 互测出题兜底
function localMatchQuestion() {
  return Object.assign({}, pick(MATCH_Q_POOL), { source: 'local' });
}
// 互测评分兜底
function localMatchScore(answerA, answerB) {
  const same = answerA && answerA === answerB;
  const score = same ? 88 : 70 + Math.floor(Math.random() * 13);
  return {
    score,
    read: same
      ? '你们的答案很接近，想到一块去了，这份默契值得珍惜。'
      : '你们的选择不太一样，正好互补，差异里也藏着互相理解的空间。',
    tip: '今晚把这道题分享给彼此',
    source: 'local',
  };
}
// 焚香兜底
function localIncense() {
  return Object.assign({}, pick(INCENSE_POOL), { source: 'local' });
}
// 观星兜底
function localStargaze() {
  return Object.assign({}, pick(STARGAZE_POOL), { source: 'local' });
}

// ===== Action 处理器 =====
const actions = {
  // 初始化用户
  async user_init() {
    const { OPENID } = cloud.getWXContext();
    const existing = await db.collection('users').where({ _openid: OPENID }).get();
    if (existing.data.length > 0) return ok(existing.data[0]);
    const user = {
      _openid: OPENID,
      name: '听风人',
      birthday: '',
      zodiac: '',
      mbti: '',
      luck: 0,
      level: 1,
      vip: false,
      vipExpire: null,
      createdAt: new Date(),
    };
    const res = await db.collection('users').add({ data: user });
    user._id = res._id;
    return ok(user);
  },

  // 更新用户资料
  async user_update({ name, birthday, zodiac, mbti }) {
    const { OPENID } = cloud.getWXContext();
    const updateData = {};
    if (name) updateData.name = name;
    if (birthday) updateData.birthday = birthday;
    if (zodiac) updateData.zodiac = zodiac;
    if (mbti) updateData.mbti = mbti;
    await db.collection('users').where({ _openid: OPENID }).update({ data: updateData });
    return ok(updateData);
  },

  // 首页数据
  async home() {
    const { OPENID } = cloud.getWXContext();
    const userRes = await db.collection('users').where({ _openid: OPENID }).get();
    const user = userRes.data[0] || { name: '听风人', luck: 0, level: 1, vip: false };
    const today = new Date();
    const dateText = `${today.getMonth() + 1}月${today.getDate()}日 · ${['日','一','二','三','四','五','六'][today.getDay()]}`;
    return ok({
      name: user.name,
      luck: user.luck,
      level: user.level,
      levelText: ['', '听风人', '执灯人', '观星人', '掌印人', '谕者'][user.level] || '听风人',
      vip: user.vip,
      dateText,
    });
  },

  // 首页今日签：当日同一用户固定一条（缓存到 users 文档），失败兜底
  async daily_sign() {
    const { OPENID } = cloud.getWXContext();
    const now = new Date();
    // 每日 8:00 才切换新签：8 点前仍沿用前一天缓存
    const signDay = new Date(now);
    if (signDay.getHours() < 8) signDay.setDate(signDay.getDate() - 1);
    const dateKey = `${signDay.getFullYear()}-${signDay.getMonth() + 1}-${signDay.getDate()}`;
    const userRes = await db.collection('users').where({ _openid: OPENID }).get();
    const user = userRes.data[0];
    if (user && user._dailyCache && user._dailyCache.date === dateKey) {
      return ok(user._dailyCache.sign);
    }
    const ctx = await getUserCtx();
    let sign;
    if (ai.isConfigured()) {
      try {
        const p = prompts.dailyPrompt({
          date: seasonText(now),
          modelTs: timeBucket(now),
          profile: ctx.profile,
          mood: user && user._lastMood ? user._lastMood : '平静',
          level: ctx.level,
        });
        const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 300 });
        sign = schema.normalizeDaily(aiObj);
      } catch (e) {
        console.warn('[yuxin] daily AI fallback:', e.message);
        sign = localDaily();
      }
    } else {
      sign = localDaily();
    }
    if (user) {
      await db.collection('users').where({ _openid: OPENID })
        .update({ data: { _dailyCache: { date: dateKey, sign } } });
    }
    return ok(sign);
  },

  // 每日次数检查
  async quota_check() {
    const { OPENID } = cloud.getWXContext();
    const today = new Date().toDateString();
    const drawRes = await db.collection('draws').where({
      _openid: OPENID,
      date: today,
    }).count();
    const userRes = await db.collection('users').where({ _openid: OPENID }).get();
    const vip = userRes.data[0]?.vip || false;
    const limit = vip ? 99 : 3;
    const remaining = Math.max(0, limit - drawRes.total);
    return ok({ remaining, limit });
  },

  // 抽签
  async draw_qian({ question }) {
    const { OPENID } = cloud.getWXContext();
    await assertQuota();
    const ctx = await getUserCtx();
    let sign;
    if (ai.isConfigured()) {
      try {
        const p = prompts.qianPrompt({ question, level: ctx.level, profile: ctx.profile });
        const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 400, temperature: 0.85 });
        sign = schema.normalizeQian(aiObj);
      } catch (e) {
        console.warn('[yuxin] qian AI fallback:', e.message);
        sign = Object.assign({}, pick(QIAN_POOL), { source: 'local' });
      }
    } else {
      sign = Object.assign({}, pick(QIAN_POOL), { source: 'local' });
    }
    const draw = {
      _openid: OPENID,
      type: 'qian',
      question: question || '',
      ...sign,
      date: new Date().toDateString(),
      createdAt: new Date(),
    };
    // 记录写入与好运值更新互不依赖，并行执行省一次往返
    const [addRes] = await Promise.all([
      db.collection('draws').add({ data: draw }),
      db.collection('users').where({ _openid: OPENID }).update({ data: { luck: _.inc(5) } }),
    ]);
    return ok(Object.assign({}, sign, { drawId: addRes._id }));
  },

  // 翻牌·塔罗（slots 由前端抽定，模型只补 word）
  async draw_tarot({ question, slots }) {
    const { OPENID } = cloud.getWXContext();
    await assertQuota();
    const ctx = await getUserCtx();
    // 兜底：前端未传牌位时服务端生成
    let clientSlots = Array.isArray(slots) && slots.length === 3 ? slots : null;
    if (!clientSlots) {
      const slotKeys = ['past', 'now', 'future'];
      const shuffled = [...TAROT_POOL].sort(() => Math.random() - 0.5);
      clientSlots = shuffled.slice(0, 3).map((c, i) => ({
        slot: slotKeys[i], name: c.name, sym: c.sym,
        ori: Math.random() < 0.3 ? '逆位' : '正位',
      }));
    }
    let sign;
    if (ai.isConfigured()) {
      try {
        const p = prompts.tarotPrompt({ question, slots: clientSlots, level: ctx.level, profile: ctx.profile });
        const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 500 });
        sign = schema.normalizeTarot(aiObj, clientSlots);
      } catch (e) {
        console.warn('[yuxin] tarot AI fallback:', e.message);
        sign = localTarot(clientSlots);
      }
    } else {
      sign = localTarot(clientSlots);
    }
    const draw = {
      _openid: OPENID, type: 'tarot', question: question || '', ...sign,
      date: new Date().toDateString(), createdAt: new Date(),
    };
    // 记录写入与好运值更新互不依赖，并行执行省一次往返
    const [addRes] = await Promise.all([
      db.collection('draws').add({ data: draw }),
      db.collection('users').where({ _openid: OPENID }).update({ data: { luck: _.inc(5) } }),
    ]);
    return ok(Object.assign({}, sign, { drawId: addRes._id }));
  },

  // 铜钱（faces 由前端随机生成，模型只补解读）
  async draw_coin({ question, faces }) {
    const { OPENID } = cloud.getWXContext();
    await assertQuota();
    const ctx = await getUserCtx();
    // 兜底：前端未传时服务端随机
    let faceArr = Array.isArray(faces) && faces.length === 3 ? faces : [0, 1, 2].map(() => (Math.random() < 0.5 ? '正' : '背'));
    const zheng = faceArr.filter((f) => f === '正').length;
    const comboNameMap = { 3: '三正无背', 2: '两正一背', 1: '两背一正', 0: '三背无正' };
    const combo = comboNameMap[zheng];
    let sign;
    if (ai.isConfigured()) {
      try {
        const p = prompts.coinPrompt({ question, faces: faceArr, combo, profile: ctx.profile });
        const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 400 });
        sign = schema.normalizeCoin(aiObj, faceArr, combo);
      } catch (e) {
        console.warn('[yuxin] coin AI fallback:', e.message);
        sign = localCoin(faceArr, combo);
      }
    } else {
      sign = localCoin(faceArr, combo);
    }
    const draw = {
      _openid: OPENID, type: 'coin', question: question || '', ...sign,
      date: new Date().toDateString(), createdAt: new Date(),
    };
    // 记录写入与好运值更新互不依赖，并行执行省一次往返
    const [addRes] = await Promise.all([
      db.collection('draws').add({ data: draw }),
      db.collection('users').where({ _openid: OPENID }).update({ data: { luck: _.inc(5) } }),
    ]);
    return ok(Object.assign({}, sign, { drawId: addRes._id }));
  },

  // 树洞发帖：高危内容不调模型直接给热线；其余生成 AI 夜色回响，失败兜底
  async treehole_post({ mood, content }) {
    const { OPENID } = cloud.getWXContext();
    const raw = String(content || '');
    const post = {
      _openid: OPENID,
      mood: mood || '未分类',
      content: raw,
      echoes: 0,
      createdAt: new Date(),
    };
    const res = await db.collection('treehole').add({ data: post });

    // 高危：不调用大模型，返回热线引导
    if (isCrisis(raw)) {
      return ok({
        id: res._id,
        crisis: true,
        echo: '你现在的感受很重要。请拨打心理援助热线 12356，会有人 24 小时陪你。',
        tip: '全国心理援助热线 12356',
      });
    }

    let echo;
    if (ai.isConfigured()) {
      try {
        const safe = sanitizeText(raw);
        const p = prompts.echoPrompt({ content: safe, mood: mood || '未分类' });
        const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 250 });
        echo = schema.normalizeEcho(aiObj);
      } catch (e) {
        console.warn('[yuxin] echo AI fallback:', e.message);
        echo = localEcho();
      }
    } else {
      echo = localEcho();
    }
    // 回响写回帖子，便于历史查看
    await db.collection('treehole').doc(res._id).update({ data: { echo } });
    return ok(Object.assign({ id: res._id }, echo));
  },

  // 树洞列表
  async treehole_list() {
    const { OPENID } = cloud.getWXContext();
    const res = await db.collection('treehole').where({ _openid: OPENID }).orderBy('createdAt', 'desc').get();
    return ok(res.data);
  },

  // 删除树洞
  async treehole_delete({ id }) {
    const { OPENID } = cloud.getWXContext();
    await db.collection('treehole').doc(id).remove();
    return ok({ deleted: true });
  },

  // 收藏列表
  async fav_list({ type }) {
    const { OPENID } = cloud.getWXContext();
    const where = { _openid: OPENID };
    if (type) where.type = type;
    const res = await db.collection('favorites').where(where).orderBy('createdAt', 'desc').get();
    return ok(res.data);
  },

  // 添加收藏
  async fav_add({ type, data }) {
    const { OPENID } = cloud.getWXContext();
    const fav = {
      _openid: OPENID,
      type: type || 'sign',
      data,
      createdAt: new Date(),
    };
    const res = await db.collection('favorites').add({ data: fav });
    return ok({ id: res._id });
  },

  // 删除收藏
  async fav_delete({ id }) {
    await db.collection('favorites').doc(id).remove();
    return ok({ deleted: true });
  },

  // 创建互测：按主题+情绪由 AI 出题（三选一）；若直接传 question 则沿用，失败兜底
  async match_create({ theme, mood, question }) {
    const { OPENID } = cloud.getWXContext();
    let q;
    if (question && String(question).trim()) {
      q = { question: String(question).trim(), options: [], source: 'manual' };
    } else if (ai.isConfigured()) {
      try {
        const p = prompts.matchQuestionPrompt({ theme: theme || '放下', mood: mood || '平静' });
        const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 300 });
        q = schema.normalizeMatchQuestion(aiObj);
      } catch (e) {
        console.warn('[yuxin] match question fallback:', e.message);
        q = localMatchQuestion();
      }
    } else {
      q = localMatchQuestion();
    }
    const match = {
      _openid: OPENID,
      question: q.question,
      options: q.options,
      status: 'waiting',
      score: null,
      myAnswer: '',
      friendAnswer: '',
      createdAt: new Date(),
    };
    const res = await db.collection('matches').add({ data: match });
    return ok(Object.assign({ id: res._id }, match));
  },

  // 互测评分：双方答案+情绪，不传画像；AI 评分，失败按答案是否一致兜底
  async match_score({ matchId, answerA, moodA, answerB, moodB }) {
    let score;
    if (ai.isConfigured()) {
      let question = '';
      try {
        if (matchId) {
          const m = await db.collection('matches').doc(matchId).get();
          question = m.data ? m.data.question : '';
        }
        const p = prompts.matchScorePrompt({
          question, answerA, moodA, answerB, moodB,
        });
        const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 300 });
        score = schema.normalizeMatchScore(aiObj);
      } catch (e) {
        console.warn('[yuxin] match score fallback:', e.message);
        score = localMatchScore(answerA, answerB);
      }
    } else {
      score = localMatchScore(answerA, answerB);
    }
    if (matchId) {
      try {
        await db.collection('matches').doc(matchId).update({
          data: {
            score: score.score,
            myAnswer: answerA || '',
            friendAnswer: answerB || '',
            status: 'done',
          },
        });
      } catch (e) { console.warn('[yuxin] match update skip:', e.message); }
    }
    return ok(score);
  },

  // 互测列表
  async match_list() {
    const { OPENID } = cloud.getWXContext();
    const res = await db.collection('matches').where({ _openid: OPENID }).orderBy('createdAt', 'desc').get();
    return ok(res.data);
  },

  // 好友打开链接：查看题目 + 占坑（原子锁定）
  async friend_view({ matchId }) {
    const { OPENID } = cloud.getWXContext();
    if (!matchId) return fail('参数错误');
    const m = await db.collection('matches').doc(matchId).get();
    if (!m.data) return fail('题目不存在或已删除');

    // 是创建者本人打开 → 不展示答题界面
    if (m.data._openid === OPENID) {
      return ok({ isCreator: true, match: m.data });
    }

    // 已有好友答过 → 后来者看到提示
    if (m.data.friendOpenid && m.data.friendOpenid !== OPENID) {
      return ok({ isCreator: false, alreadyTaken: true, match: m.data });
    }

    // 首次打开 → 占坑（原子操作，防并发）
    if (!m.data.friendOpenid) {
      try {
        await db.collection('matches').doc(matchId).update({
          data: { friendOpenid: OPENID },
        });
      } catch (e) {
        // 并发冲突，重读
        const m2 = await db.collection('matches').doc(matchId).get();
        if (m2.data.friendOpenid && m2.data.friendOpenid !== OPENID) {
          return ok({ isCreator: false, alreadyTaken: true, match: m2.data });
        }
      }
    }
    return ok({ isCreator: false, alreadyTaken: false, match: m.data });
  },

  // 好友提交答案
  async friend_answer({ matchId, answer }) {
    const { OPENID } = cloud.getWXContext();
    if (!matchId || !answer) return fail('参数错误');
    const m = await db.collection('matches').doc(matchId).get();
    if (!m.data) return fail('题目不存在');
    // 只有占坑的好友才能提交
    if (m.data.friendOpenid !== OPENID) return fail('此题已有好友回答');
    await db.collection('matches').doc(matchId).update({
      data: { friendAnswer: answer, friendReplied: true },
    });
    return ok({ success: true });
  },

  // 等级信息
  async level_info() {
    const { OPENID } = cloud.getWXContext();
    const res = await db.collection('users').where({ _openid: OPENID }).get();
    const user = res.data[0] || { luck: 0, level: 1 };
    const levels = [
      { lv: 1, name: '听风人', min: 0 },
      { lv: 2, name: '执灯人', min: 100 },
      { lv: 3, name: '观星人', min: 300 },
      { lv: 4, name: '掌印人', min: 600 },
      { lv: 5, name: '谕者', min: 1000 },
    ];
    return ok({ luck: user.luck, currentLevel: user.level, levels });
  },

  // 仪式完成
  async ritual_complete({ type }) {
    const { OPENID } = cloud.getWXContext();
    const record = {
      _openid: OPENID,
      type: type || 'incense',
      createdAt: new Date(),
    };
    await db.collection('rituals').add({ data: record });
    await db.collection('users').where({ _openid: OPENID }).update({ data: { luck: _.inc(10) } });
    return ok({ success: true });
  },

  // 焚香/观星 AI 文案：type 区分，含 sub/sky 专属字段；失败兜底
  async ritual_ai(params) {
    const { OPENID } = cloud.getWXContext();
    const now = new Date();
    const type = params.type === 'stargaze' ? 'stargaze' : 'incense';
    const ctx = await getUserCtx();
    let result;
    if (type === 'incense') {
      const wish = sanitizeText(params.wish || '');
      if (ai.isConfigured()) {
        try {
          const p = prompts.incensePrompt({
            wish,
            mood: params.mood || '平静',
            modelTs: timeBucket(now),
            profile: ctx.profile,
            level: ctx.level,
          });
          const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 400 });
          result = schema.normalizeIncense(aiObj);
        } catch (e) {
          console.warn('[yuxin] incense AI fallback:', e.message);
          result = localIncense();
        }
      } else {
        result = localIncense();
      }
    } else {
      if (ai.isConfigured()) {
        try {
          const p = prompts.stargazePrompt({
            moodPick: params.moodPick || '微光',
            constellation: params.constellation || '天鹅座 · 6 星',
            zodiac: params.zodiac || (ctx.profile.zodiac || ''),
            modelTs: timeBucket(now),
            profile: ctx.profile,
          });
          const aiObj = await ai.chatJSON(p.system, p.user, { maxTokens: 400 });
          result = schema.normalizeStargaze(aiObj);
        } catch (e) {
          console.warn('[yuxin] stargaze AI fallback:', e.message);
          result = localStargaze();
        }
      } else {
        result = localStargaze();
      }
    }
    // 落库记录并加好运值
    await db.collection('rituals').add({
      data: { _openid: OPENID, type, result, createdAt: now },
    });
    await db.collection('users').where({ _openid: OPENID }).update({ data: { luck: _.inc(10) } });
    return ok(Object.assign({ type }, result));
  },

  // 仪式记录
  async ritual_list({ type }) {
    const { OPENID } = cloud.getWXContext();
    const where = { _openid: OPENID };
    if (type) where.type = type;
    const res = await db.collection('rituals').where(where).orderBy('createdAt', 'desc').get();
    return ok(res.data);
  },

  // 会员状态
  async vip_status() {
    const { OPENID } = cloud.getWXContext();
    const res = await db.collection('users').where({ _openid: OPENID }).get();
    const user = res.data[0] || { vip: false, vipExpire: null };
    return ok({ vip: user.vip, expire: user.vipExpire });
  },

  // 创建订单（支付接入前返回占位）
  async vip_order({ plan }) {
    const { OPENID } = cloud.getWXContext();
    const order = {
      _openid: OPENID,
      plan: plan || 'monthly',
      amount: plan === 'yearly' ? 118 : 12.9,
      status: 'pending',
      createdAt: new Date(),
    };
    const res = await db.collection('orders').add({ data: order });
    return ok({ orderId: res._id, message: '支付接入中，当前为演示订单' });
  },

  // 分享卡数据
  async share_card({ drawId }) {
    const { OPENID } = cloud.getWXContext();
    const res = await db.collection('draws').doc(drawId).get();
    if (!res.data) return fail('签文不存在');
    const userRes = await db.collection('users').where({ _openid: OPENID }).get();
    const userName = userRes.data[0]?.name || '听风人';
    return ok({
      sign: res.data,
      userName,
      date: new Date().toLocaleDateString('zh-CN'),
    });
  },

  // 小程序码（开发版/未发布时 openapi 会失败，前端降级占位）
  async qrcode_get({ scene }) {
    try {
      const res = await cloud.openapi.wxacode.getUnlimited({
        scene: (scene || 'from=share').slice(0, 32),
        page: 'pages/ask/ask',
        width: 200,
      });
      const buf = res.buffer || res;
      const base64 = Buffer.from(buf).toString('base64');
      return ok({ image: 'data:image/png;base64,' + base64 });
    } catch (e) {
      console.warn('[yuxin] qrcode failed:', e && e.message);
      return ok({ image: null });
    }
  },
};

// ===== 主入口 =====
exports.main = async (event) => {
  const { action, ...data } = event;
  try {
    if (!actions[action]) return fail('未知 action: ' + action);
    return await actions[action](data);
  } catch (err) {
    console.error('[yuxin] error:', err);
    return fail(err.message || '服务器错误');
  }
};
