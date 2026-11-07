// ai.js — DeepSeek 官方 API 直连（OpenAI 兼容），在云函数内调用
// 安全：API Key 只存在于云函数（服务端），绝不能写进小程序前端
// 可选环境变量：
//   DEEPSEEK_API_KEY   DeepSeek 密钥（推荐在控制台配置，未配置时用下面默认值）
//   DEEPSEEK_BASE_URL  接口地址，默认 https://api.deepseek.com
//   AI_MODEL           模型名，默认 deepseek-flash（V4.1 Flash，更快更省）
//   AI_ENABLED         设为 false 可关闭大模型、强制走本地语料
const https = require('https');

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-flash';

// 单次 AI 调用硬超时：12s，失败由调用方 try/catch 走本地兜底
const AI_TIMEOUT = 12000;

// 只读环境变量：在云函数控制台配置 DEEPSEEK_API_KEY；未配置时 isConfigured() 为 false，自动走本地词库兜底
const API_KEY = process.env.DEEPSEEK_API_KEY || '';

function getConfig() {
  return {
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    baseUrl: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL,
    enabled: process.env.AI_ENABLED !== 'false',
  };
}

function isConfigured() {
  return getConfig().enabled && !!API_KEY;
}

// 发起一次 HTTPS POST，返回解析后的响应 JSON
function postChatCompletions(payload, timeout) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const target = new URL(getConfig().baseUrl + '/chat/completions');
    const req = https.request({
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('DEEPSEEK_HTTP_' + res.statusCode + ' ' + data.slice(0, 200)));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('DEEPSEEK_BAD_JSON'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error('AI_TIMEOUT_' + timeout + 'ms'));
    });
    req.write(body);
    req.end();
  });
}

// 非流式生成，返回模型文本（单次尝试，不做内部重试，避免耗时翻倍）
async function chat(systemPrompt, userPrompt, opts) {
  const cfg = getConfig();
  const o = opts || {};
  const payload = {
    model: cfg.model,
    temperature: o.temperature || 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    // 前缀硬盘缓存由 DeepSeek 自动命中（系统提示重复），降低首 token 延迟
    stream: false,
  };

  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_TIMEOUT_' + AI_TIMEOUT + 'ms')), AI_TIMEOUT);
  });
  try {
    const resp = await Promise.race([
      postChatCompletions(payload, AI_TIMEOUT),
      guard,
    ]);
    const text = resp
      && resp.choices
      && resp.choices[0]
      && resp.choices[0].message
      && resp.choices[0].message.content;
    if (!text) throw new Error('AI_EMPTY_CONTENT');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// 从模型文本中提取 JSON（兼容 ```json 代码块包裹）
function extractJSON(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s > -1 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

// 单次调用 + 提取；失败由调用方 try/catch 走本地兜底
async function chatJSON(systemPrompt, userPrompt, opts) {
  const content = await chat(systemPrompt, userPrompt, opts || {});
  return extractJSON(content);
}

module.exports = { getConfig, isConfigured, chatJSON, extractJSON };
