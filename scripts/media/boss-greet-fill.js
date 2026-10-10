// BOSS 直聘 · 打招呼填入（函数体，入参 data = SyncPayload）
// data: { title, content, images, isAutoPublish, platform }
// 在沟通页把 content 写入输入框（默认不自动点发送，避免误触）

function waitForElement(selector, timeout) {
  timeout = timeout === undefined ? 12000 : timeout;
  return new Promise(function (resolve, reject) {
    var element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    var observer = new MutationObserver(function () {
      var el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () {
      observer.disconnect();
      reject(new Error('未找到输入框：' + selector));
    }, timeout);
  });
}

function setNativeValue(el, value) {
  var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  var setter = Object.getOwnPropertyDescriptor(proto, 'value');
  if (setter && setter.set) setter.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function setContentEditable(el, value) {
  el.focus();
  el.textContent = value;
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function findInput() {
  var selectors = [
    'textarea.chat-input',
    'textarea.input-area',
    '#chat-input',
    '.chat-input textarea',
    '.chat-conversation textarea',
    '.boss-chat-editor textarea',
    '.chat-editor textarea',
    'div.chat-input[contenteditable="true"]',
    'div[contenteditable="true"].input-area',
    '[class*="chat-input"] textarea',
    '[class*="message-input"] textarea',
    'textarea[placeholder*="招呼"]',
    'textarea[placeholder*="沟通"]',
    'textarea[placeholder*="说点"]',
    'textarea',
  ];
  for (var i = 0; i < selectors.length; i++) {
    try {
      var el = await waitForElement(selectors[i], 2500);
      if (el) return el;
    } catch (e) {
      /* try next */
    }
  }
  throw new Error('未找到 BOSS 聊天输入框，请先打开沟通页并点开一位候选人');
}

var content = String((data && (data.content || data.title)) || '').trim();
if (!content) {
  return { ok: false, error: '没有可填入的打招呼文案' };
}

if (!/(^|\.)zhipin\.com$/i.test(location.hostname)) {
  return {
    ok: false,
    error: '当前不是 BOSS 直聘页面，请打开 https://www.zhipin.com/web/chat/index',
  };
}

var input = await findInput();
input.scrollIntoView({ block: 'center', behavior: 'smooth' });
if (input.getAttribute('contenteditable') === 'true' || input.isContentEditable) {
  setContentEditable(input, content);
} else {
  setNativeValue(input, content);
}
input.focus();

// 仅当明确要求自动发布时才点发送
if (data && data.isAutoPublish) {
  var sendBtn =
    document.querySelector('button.send-message, .btn-send, .chat-op .btn, button[class*="send"]') ||
    Array.prototype.find.call(document.querySelectorAll('button'), function (b) {
      return /发送|打招呼/.test(String(b.innerText || ''));
    });
  if (sendBtn) sendBtn.click();
}

return { ok: true };
