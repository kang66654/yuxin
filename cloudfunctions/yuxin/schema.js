// schema.js — 第二道闸：校验模型返回并归一化为前端签文结构
// 缺必填字段 → 抛错触发本地兜底；超长 → 安全截断

function clip(str, max) {
  let s = String(str == null ? '' : str).trim();
  if (s.length > max) s = s.slice(0, max);
  return s;
}

function assertFields(obj, fields) {
  fields.forEach((f) => {
    if (!obj || obj[f] == null || String(obj[f]).trim() === '') {
      throw new Error('AI_MISSING_FIELD:' + f);
    }
  });
}

// ===== 抽签 =====
const QIAN_KINDS = [
  { kind: '山重', seal: '谕' },
  { kind: '星途', seal: '星' },
  { kind: '静水', seal: '谕' },
  { kind: '新芽', seal: '谕' },
  { kind: '风过', seal: '风' },
  { kind: '月归', seal: '月' },
];
function normalizeQian(obj) {
  assertFields(obj, ['sign', 'read', 'yi', 'ji']);
  const k = QIAN_KINDS[Math.floor(Math.random() * QIAN_KINDS.length)];
  return {
    title: '神谕签 · ' + k.kind,
    line: clip(obj.sign, 20),
    read: clip(obj.read, 80),
    good: clip(obj.yi, 8),
    bad: clip(obj.ji, 8),
    seal: k.seal,
    source: 'ai',
  };
}

// ===== 翻牌：模型只补 word，牌名/符号/正逆位以前端 slots 为准 =====
function normalizeTarot(obj, slots) {
  assertFields(obj, ['cards', 'read', 'yi', 'ji']);
  if (!Array.isArray(obj.cards) || obj.cards.length < 3) throw new Error('AI_TAROT_CARDS');
  const aiBySlot = {};
  obj.cards.forEach((c) => {
    if (c && c.slot) aiBySlot[c.slot] = c;
  });
  const cards = slots.map((s) => {
    const ai = aiBySlot[s.slot] || {};
    return {
      slot: s.slot,
      name: s.name,
      sym: s.sym,
      ori: s.ori,
      word: clip(ai.word, 6) || (s.ori === '逆位' ? '暂被挡住' : '心有微光'),
    };
  });
  return {
    title: '塔罗三张 · 圣三角',
    cards,
    line: cards.map((c) => c.name + '·' + c.ori).join(' → '),
    read: clip(obj.read, 100),
    good: clip(obj.yi, 8),
    bad: clip(obj.ji, 8),
    seal: '星',
    source: 'ai',
  };
}

// ===== 铜钱 =====
function normalizeCoin(obj, faces, combo) {
  assertFields(obj, ['read', 'yi', 'ji']);
  return {
    title: '神谕签 · 铜钱卦',
    combo,
    line: combo,
    read: clip(obj.read, 80),
    good: clip(obj.yi, 8),
    bad: clip(obj.ji, 8),
    seal: '钱',
    faces: faces.join(' '),
    source: 'ai',
  };
}

// ===== 首页今日签 =====
function normalizeDaily(obj) {
  assertFields(obj, ['sign', 'yi', 'ji']);
  return {
    sign: clip(obj.sign, 18),
    yi: clip(obj.yi, 8),
    ji: clip(obj.ji, 8),
    source: 'ai',
  };
}

// ===== 树洞夜色回响 =====
function normalizeEcho(obj) {
  assertFields(obj, ['echo']);
  return {
    echo: clip(obj.echo, 60),
    tip: clip(obj.tip, 30),
    source: 'ai',
  };
}

// ===== 互测出题 =====
function normalizeMatchQuestion(obj) {
  assertFields(obj, ['question', 'options']);
  if (!Array.isArray(obj.options) || obj.options.length < 3) throw new Error('AI_MATCH_OPTIONS');
  return {
    question: clip(obj.question, 22),
    options: obj.options.slice(0, 3).map((o) => clip(o, 6)),
    source: 'ai',
  };
}

// ===== 互测评分 =====
function normalizeMatchScore(obj) {
  assertFields(obj, ['score', 'read']);
  let score = parseInt(obj.score, 10);
  if (isNaN(score)) throw new Error('AI_MATCH_SCORE');
  score = Math.max(20, Math.min(98, score));
  return {
    score,
    read: clip(obj.read, 80),
    tip: clip(obj.tip, 20),
    source: 'ai',
  };
}

// ===== 焚香 =====
function normalizeIncense(obj) {
  assertFields(obj, ['sign', 'read', 'yi', 'ji']);
  return {
    sign: clip(obj.sign, 18),
    sub: clip(obj.sub, 16),
    read: clip(obj.read, 100),
    yi: clip(obj.yi, 8),
    ji: clip(obj.ji, 8),
    source: 'ai',
  };
}

// ===== 观星 =====
function normalizeStargaze(obj) {
  assertFields(obj, ['line', 'read', 'yi', 'ji']);
  return {
    line: clip(obj.line, 18),
    sky: clip(obj.sky, 20),
    read: clip(obj.read, 100),
    yi: clip(obj.yi, 8),
    ji: clip(obj.ji, 8),
    source: 'ai',
  };
}

module.exports = {
  normalizeQian, normalizeTarot, normalizeCoin,
  normalizeDaily, normalizeEcho, normalizeMatchQuestion, normalizeMatchScore,
  normalizeIncense, normalizeStargaze,
};
