// BOSS 直聘 · 打招呼页采集（函数体，无入参）
// 约定返回：{ title, text, url } 或纯字符串
// 适用：www.zhipin.com / www.zhipin.com/web/chat/* 推荐/沟通页

function txt(el) {
  if (!el) return '';
  return String(el.innerText || el.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstText(selectors) {
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    var t = txt(el);
    if (t) return t;
  }
  return '';
}

function pickMany(selectors, limit) {
  limit = limit || 8;
  var out = [];
  var seen = {};
  for (var i = 0; i < selectors.length; i++) {
    var nodes = document.querySelectorAll(selectors[i]);
    for (var j = 0; j < nodes.length; j++) {
      var t = txt(nodes[j]);
      if (!t || t.length < 2 || seen[t]) continue;
      seen[t] = true;
      out.push(t);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function isBossHost() {
  try {
    return /(^|\.)zhipin\.com$/i.test(location.hostname);
  } catch (e) {
    return false;
  }
}

function collectChatMessages(limit) {
  limit = limit || 20;
  var sels = [
    '.chat-message-list .message-item',
    '.chat-conversation .message-item',
    '.chat-content .message-item',
    '[class*="message-item"]',
    '.chat-message',
  ];
  var lines = [];
  for (var i = 0; i < sels.length; i++) {
    var nodes = document.querySelectorAll(sels[i]);
    if (!nodes.length) continue;
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      var role = '对方';
      var cls = String(n.className || '');
      if (/item-myself|self|mine|is-me/i.test(cls)) role = '我';
      var body =
        txt(n.querySelector('.text, .msg-text, .message-text, pre, p')) ||
        txt(n);
      if (!body) continue;
      lines.push(role + '：' + body.replace(/\n+/g, ' '));
    }
    if (lines.length) break;
  }
  if (lines.length > limit) lines = lines.slice(-limit);
  return lines;
}

function collectCardSummary() {
  var name = firstText([
    '.geek-name',
    '.base-info .name',
    '.base-info-content .name',
    '.chat-user-info .name',
    '.user-name',
    '.geek-info .name',
    '[class*="geek-name"]',
    'h1.name',
  ]);
  var title = firstText([
    '.geek-info .job-name',
    '.base-info .job-title',
    '.expect-job',
    '.chat-user-info .position',
    '[class*="expect"] .job',
    '.label-text',
  ]);
  var company = firstText([
    '.company-name',
    '.base-info .company',
    '.chat-user-info .company',
    '[class*="company-name"]',
  ]);
  var salary = firstText([
    '.salary-num',
    '.salary',
    '[class*="salary"]',
  ]);
  var tags = pickMany(
    [
      '.geek-info .label-list .label',
      '.base-info .label',
      '.tag-list .tag',
      '[class*="label-list"] span',
    ],
    12,
  );
  var about = firstText([
    '.geek-desc',
    '.resume-content',
    '.geek-detail',
    '.chat-geek-resume',
    '[class*="resume"]',
    '.detail-content',
  ]);

  var parts = [];
  if (name) parts.push('姓名/昵称：' + name);
  if (title) parts.push('期望/职位：' + title);
  if (company) parts.push('公司：' + company);
  if (salary) parts.push('薪资：' + salary);
  if (tags.length) parts.push('标签：' + tags.join('、'));
  if (about) parts.push('简介/简历摘要：\n' + about.slice(0, 4000));
  return {
    name: name,
    title: title,
    summary: parts.join('\n'),
  };
}

function fallbackMainText() {
  var root =
    document.querySelector(
      '.chat-container, .chat-box, .recommend-list, .geek-detail, main, #main, .page-content',
    ) || document.body;
  var clone = root.cloneNode(true);
  var kill = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'nav',
    'footer',
    'header',
  ];
  for (var i = 0; i < kill.length; i++) {
    clone.querySelectorAll(kill[i]).forEach(function (el) {
      el.remove();
    });
  }
  return txt(clone).slice(0, 12000);
}

var url = location.href;
var pageTitle = document.title || '';
var hostOk = isBossHost();

var card = collectCardSummary();
var msgs = collectChatMessages(24);

var blocks = [];
blocks.push('【平台】BOSS直聘');
blocks.push('【页面】' + (pageTitle || url));
blocks.push('【URL】' + url);
if (!hostOk) {
  blocks.push('【提示】当前不是 zhipin.com，已尽量抽取可见正文，建议打开 BOSS 沟通/推荐页再采。');
}
if (card.summary) {
  blocks.push('【候选人/沟通对象】\n' + card.summary);
}
if (msgs.length) {
  blocks.push('【最近对话】\n' + msgs.join('\n'));
}
if (!card.summary && !msgs.length) {
  blocks.push('【页面正文】\n' + fallbackMainText());
}
blocks.push(
  '【任务提示】请基于以上信息起草一条得体的 BOSS「打招呼」开场白或下一条回复（简洁、真诚、点出匹配点，勿套话堆砌）。',
);

var titleBits = [];
if (card.name) titleBits.push(card.name);
if (card.title) titleBits.push(card.title);
var title =
  (titleBits.length ? titleBits.join(' · ') + ' · ' : '') + 'BOSS打招呼素材';

return {
  title: title,
  text: blocks.join('\n\n'),
  url: url,
};
