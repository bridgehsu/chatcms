// BOSS 直聘 · 职位详情采页 + AI 整理 JD（函数体，无入参）
// 禁止页内 fetch(127.0.0.1)。只返回精简对象 + ai_complete（正文只带一份，避免 executeScript 克隆失败丢结果）。
// 适用：www.zhipin.com/job_detail/*

var MAX_TEXT = 8000;

function txt(el) {
  if (!el) return '';
  return String(el.innerText || el.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isBossHost() {
  try {
    return /(^|\.)zhipin\.com$/i.test(location.hostname);
  } catch (e) {
    return false;
  }
}

function pickJobRoot() {
  var sels = [
    '.job-detail',
    '.job-box',
    '.job-detail-box',
    '.job-detail-body',
    '.job-sec',
    '#main',
    'main',
    '[class*="job-detail"]',
    '.page-job-wrapper',
    '.job-banner',
  ];
  for (var i = 0; i < sels.length; i++) {
    var el = document.querySelector(sels[i]);
    if (el && txt(el).length > 80) return el;
  }
  return document.body || document.documentElement;
}

function collectPageText() {
  var root = pickJobRoot();
  var text = txt(root);
  if (text.length < 40) {
    text = txt(document.body) || txt(document.documentElement);
  }
  if (text.length > MAX_TEXT) {
    text = text.slice(0, MAX_TEXT) + '\n\n…(正文已截断)…';
  }
  return text;
}

var url = location.href;
var pageTitle = document.title || '';
var hostOk = isBossHost();
var pageText = collectPageText();

if (!pageText || pageText.length < 20) {
  return {
    ok: false,
    error:
      '未采到职位正文（长度 ' +
      (pageText ? pageText.length : 0) +
      '）。请确认前景标签是 BOSS 职位详情页，且页面已加载完成。',
  };
}

var docBlocks = [];
docBlocks.push('【平台】BOSS直聘');
docBlocks.push('【页面】' + (pageTitle || url));
docBlocks.push('【URL】' + url);
if (!hostOk) {
  docBlocks.push('【提示】当前域名不是 zhipin.com，请在 BOSS 职位详情页再执行。');
}
if (!/job_detail/i.test(url) && hostOk) {
  docBlocks.push(
    '【提示】URL 不像职位详情页（job_detail）。仍将基于当前页内容整理。',
  );
}
docBlocks.push('【页面正文】\n' + pageText);
docBlocks.push(
  [
    '【AI任务】',
    '请解析以上页面文档，整理当前职位的 JD 信息。',
    '请用中文输出，结构尽量包含：',
    '1. 职位名称',
    '2. 薪资 / 城市 / 经验 / 学历（有则写）',
    '3. 公司名称',
    '4. 岗位职责',
    '5. 任职要求',
    '6. 其他亮点或福利',
    '页面中找不到的字段写「未找到」，不要编造。',
  ].join('\n'),
);

var systemPrompt =
  '你是招聘信息整理助手。严格按用户消息中的【AI任务】执行；' +
  '只依据【页面正文】；找不到写「未找到」，不要编造。' +
  '直接输出整理后的中文结果，不要重复粘贴原始页面全文。';

// 正文只放在 ai_complete 里一份，避免返回值过大被 Chrome 丢弃
return {
  title: (pageTitle ? pageTitle + ' · ' : '') + 'BOSS职位JD',
  url: url,
  ai_complete: {
    content: docBlocks.join('\n\n'),
    system_prompt: systemPrompt,
  },
};
