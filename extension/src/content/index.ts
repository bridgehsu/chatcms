/** Content Script：正文采集（自定义渠道脚本失败时的回退路径） */

import { MAX_PAGE_TEXT, toPageKey, type PageContext } from '../shared/bridge'

function extractMainText(): string {
  const clone = document.body?.cloneNode(true) as HTMLElement | undefined
  if (!clone) return ''

  const removeSelectors = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'canvas',
    'nav',
    'footer',
    'header',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
  ]
  for (const sel of removeSelectors) {
    clone.querySelectorAll(sel).forEach((el) => el.remove())
  }

  const article =
    clone.querySelector('article') ||
    clone.querySelector('main') ||
    clone.querySelector('[role="main"]') ||
    clone

  let text = (article.innerText || article.textContent || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (text.length > MAX_PAGE_TEXT) {
    text = `${text.slice(0, MAX_PAGE_TEXT)}\n…(已截断)`
  }
  return text
}

function collectPage(): PageContext {
  const url = location.href
  return {
    pageKey: toPageKey(url),
    url,
    title: document.title || '',
    text: extractMainText(),
    capturedAt: Date.now(),
    media: [],
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'COLLECT_PAGE') {
    try {
      sendResponse({ ok: true, page: collectPage() })
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    return false
  }
  return false
})

export {}
