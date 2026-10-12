import { MAX_PAGE_TEXT, toPageKey, type PageContext } from './bridge'

export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url.startsWith('chrome-search://') ||
    url.startsWith('view-source:')
  )
}

/** 侧栏聚焦时 currentWindow 可能不准，多重回退取当前网页标签 */
export async function getActiveContentTab(): Promise<chrome.tabs.Tab | null> {
  const tries: chrome.tabs.QueryInfo[] = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
  ]
  for (const q of tries) {
    try {
      const tabs = await chrome.tabs.query(q)
      const tab = tabs.find((t) => t.id != null && !isRestrictedUrl(t.url))
      if (tab?.id != null) return tab
    } catch {
      /* continue */
    }
  }
  try {
    const win = await chrome.windows.getLastFocused({ populate: true })
    const tab = win.tabs?.find((t) => t.active && t.id != null && !isRestrictedUrl(t.url))
    if (tab?.id != null) return tab
    const any = win.tabs?.find((t) => t.id != null && !isRestrictedUrl(t.url))
    if (any?.id != null) return any
  } catch {
    /* ignore */
  }
  return null
}

export type CollectResult =
  | { ok: true; page: PageContext }
  | { ok: false; reason: 'no_tab' | 'restricted' | 'inject_failed'; message: string }

/** 渠道脚本运行结果：有素材才带 page，无返回也算成功 */
export type ScriptRunResult =
  | { ok: true; page: PageContext | null }
  | {
      ok: false
      reason: 'no_tab' | 'restricted' | 'inject_failed' | 'timeout'
      message: string
    }

/** 侧栏等待脚本结果的默认超时（ms） */
export const SCRIPT_RUN_TIMEOUT_MS = 60_000

/**
 * 轻量读取当前标签：仅 title + url，不注入、不抽正文。
 * 用于会话按页面静默绑定。
 */
export async function peekActivePageMeta(): Promise<CollectResult> {
  const tab = await getActiveContentTab()
  if (!tab?.id) {
    try {
      const [raw] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      })
      if (raw && isRestrictedUrl(raw.url)) {
        return {
          ok: false,
          reason: 'restricted',
          message: '当前是系统或受限页面，无法关联网页',
        }
      }
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      reason: 'no_tab',
      message: '未找到可关联的网页标签，请先打开一个普通网站',
    }
  }

  if (isRestrictedUrl(tab.url)) {
    return {
      ok: false,
      reason: 'restricted',
      message: '当前是系统或受限页面，无法关联网页',
    }
  }

  const url = tab.url || ''
  return {
    ok: true,
    page: {
      pageKey: toPageKey(url),
      url,
      title: tab.title || '',
      text: '',
      capturedAt: Date.now(),
      media: [],
    },
  }
}

/**
 * 在页面上下文中执行全文采集（供自定义渠道脚本失败回退 / executeScript）。
 * 必须自包含，不可引用外部闭包。
 */
export function collectPageInDocument(): {
  pageKey: string
  url: string
  title: string
  text: string
  capturedAt: number
  media: Array<{
    id: string
    kind: 'image' | 'video'
    url: string
    poster?: string
    alt?: string
    source: 'og' | 'article-img' | 'video'
    preferred?: boolean
  }>
} {
  const MAX = 30_000
  const clone = document.body?.cloneNode(true) as HTMLElement | undefined
  let text = ''
  if (clone) {
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
    text = (article.innerText || article.textContent || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (text.length > MAX) {
      text = `${text.slice(0, MAX)}\n…(已截断)`
    }
  }
  const url = location.href
  let pageKey = url
  try {
    const u = new URL(url)
    let path = u.pathname || '/'
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    pageKey = `${u.origin}${path}`
  } catch {
    pageKey = url.split('?')[0].split('#')[0].replace(/\/$/, '')
  }

  return {
    pageKey,
    url,
    title: document.title || '',
    text,
    capturedAt: Date.now(),
    media: [],
  }
}

/** 在 background / 具备 scripting 的上下文中执行完整采集 */
export async function collectActivePageInExtension(): Promise<CollectResult> {
  const tab = await getActiveContentTab()
  if (!tab?.id) {
    try {
      const [raw] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      })
      if (raw && isRestrictedUrl(raw.url)) {
        return {
          ok: false,
          reason: 'restricted',
          message: '当前是系统或受限页面，无法读取网页内容',
        }
      }
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      reason: 'no_tab',
      message: '未找到可采集的网页标签，请先打开一个普通网站',
    }
  }

  if (isRestrictedUrl(tab.url)) {
    return {
      ok: false,
      reason: 'restricted',
      message: '当前是系统或受限页面，无法读取网页内容',
    }
  }

  // 1) 已有 content script
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_PAGE' })
    if (res?.ok && res.page) {
      return { ok: true, page: res.page as PageContext }
    }
  } catch {
    /* 扩展重载后旧标签未注入 */
  }

  // 2) 仅 background 保证有 chrome.scripting
  if (!chrome.scripting?.executeScript) {
    return {
      ok: false,
      reason: 'inject_failed',
      message: '采集能力未就绪，请到扩展管理页重新加载 ChatCMS 后，再刷新网页重试',
    }
  }

  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectPageInDocument,
    })
    const page = injected?.[0]?.result as PageContext | undefined
    if (page?.url) {
      return {
        ok: true,
        page: {
          ...page,
          pageKey: page.pageKey || toPageKey(page.url),
          text: page.text?.slice(0, MAX_PAGE_TEXT) ?? '',
        },
      }
    }
  } catch (e) {
    return {
      ok: false,
      reason: 'inject_failed',
      message:
        e instanceof Error
          ? `采集失败：${e.message}。请刷新该网页后重试`
          : '采集失败，请刷新该网页后重试',
    }
  }

  return {
    ok: false,
    reason: 'inject_failed',
    message: '采集失败，请刷新该网页后重试',
  }
}

/**
 * 侧栏：默认只读 title + url（不经 background 注入）。
 */
export async function peekActivePageDetailed(): Promise<CollectResult> {
  return peekActivePageMeta()
}

/**
 * 侧栏调用全文采集（经 background；自定义脚本失败回退用）
 */
export async function collectActivePageDetailed(): Promise<CollectResult> {
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'COLLECT_ACTIVE_PAGE',
    })) as CollectResult | undefined
    if (res && typeof res === 'object' && 'ok' in res) {
      return res
    }
    return {
      ok: false,
      reason: 'inject_failed',
      message: '采集无响应，请重新加载扩展后重试',
    }
  } catch (e) {
    return {
      ok: false,
      reason: 'inject_failed',
      message:
        e instanceof Error
          ? `采集失败：${e.message}`
          : '采集失败，请重新加载扩展后重试',
    }
  }
}

/**
 * 运行渠道脚本（函数体）。
 * 约定返回：string | { title?, text?, content?, url? } | { ok: false, error? }
 * 无有效素材时 ok=true 且 page=null（不写输入框）。
 */
export async function runCollectScriptDetailed(
  scriptBody?: string | null,
  timeoutMs: number = SCRIPT_RUN_TIMEOUT_MS,
): Promise<ScriptRunResult> {
  const body = scriptBody?.trim() || ''
  if (!body) {
    return {
      ok: false,
      reason: 'inject_failed',
      message: '脚本内容为空，请到桌面「插件脚本」检查入口文件',
    }
  }

  const run = (async (): Promise<ScriptRunResult> => {
    try {
      const res = (await chrome.runtime.sendMessage({
        type: 'RUN_COLLECT_SCRIPT',
        payload: { script: body },
      })) as ScriptRunResult | undefined
      if (res && typeof res === 'object' && 'ok' in res) {
        return res
      }
      return {
        ok: false,
        reason: 'inject_failed',
        message: '脚本运行无响应，请重新加载扩展后重试',
      }
    } catch (e) {
      return {
        ok: false,
        reason: 'inject_failed',
        message:
          e instanceof Error
            ? `脚本运行失败：${e.message}`
            : '脚本运行失败，请重新加载扩展后重试',
      }
    }
  })()

  if (!timeoutMs || timeoutMs <= 0) return run

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      run,
      new Promise<ScriptRunResult>((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              ok: false,
              reason: 'timeout',
              message: `运行超时（>${Math.round(timeoutMs / 1000)}s），请检查页面或脚本后重试`,
            }),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
