import {
  collectActivePageInExtension,
  getActiveContentTab,
  isRestrictedUrl,
  type CollectResult,
  type ScriptRunResult,
} from '../shared/collect'
import {
  MAX_PAGE_TEXT,
  chatComplete,
  completeScriptJob,
  fetchCollectScript,
  fetchScriptJobs,
  toPageKey,
  type PageContext,
  type PageScriptJob,
} from '../shared/bridge'
import {
  syncDataToPublishPayload,
} from '../shared/multipost/bridgeProtocol'
import {
  matchUrlOk,
  resolvePublishScript,
  type SyncImage,
  type SyncPayload,
} from '../shared/publishSync'

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[ChatCMS] sidePanel behavior error', err))

/** 健康检查轮询，供侧栏读取 */
const HEALTH_KEY = 'bridgeStatus'
const USER_SCRIPTS_KEY = 'userScriptsStatus'
/** User Scripts 不可用时是否允许 debugger（默认 true，侧栏可关） */
const AUTO_DEBUGGER_KEY = 'autoDebuggerScriptFallback'
const BRIDGE_HEALTH = 'http://127.0.0.1:17890/health'

function chromeMajorVersion(): number {
  const m = navigator.userAgent.match(/(?:Chrome|Chromium)\/(\d+)/)
  return m ? Number(m[1]) : 0
}

/** 开关未开时 userScripts 为 undefined；execute 需 Chrome ≥135 */
async function probeUserScripts(): Promise<{ ok: boolean; reason?: string }> {
  const ver = chromeMajorVersion()
  const extId = chrome.runtime.id
  const detailsUrl = `chrome://extensions/?id=${extId}`

  // Chrome 文档：用 try/catch 探测；≥138 未开开关时 API 为 undefined
  try {
    if (!chrome.userScripts) {
      return {
        ok: false,
        reason:
          ver >= 138
            ? `chrome.userScripts 未注入（Chrome ${ver}，扩展 ${extId}）。请打开 ${detailsUrl} → 开启「允许运行用户脚本」→ 回到扩展列表点「重新加载」（或侧栏「我已开启，重载扩展」）。若已开启仍如此：先关掉开关再打开，然后重载；或移除扩展后重新「加载已解压的扩展」指向最新 dist。`
            : ver > 0 && ver < 138
              ? `chrome.userScripts 未注入（Chrome ${ver}）。请到 chrome://extensions 打开右上角「开发者模式」，再重新加载本扩展（${extId}）。`
              : `chrome.userScripts 未注入（扩展 ${extId}）。请加载最新 dist，开启用户脚本开关后重新加载扩展。`,
      }
    }
    await chrome.userScripts.getScripts()
  } catch (e) {
    return {
      ok: false,
      reason: `用户脚本 API 不可用：${e instanceof Error ? e.message : String(e)}。请打开 ${detailsUrl} 开启「允许运行用户脚本」后重载扩展。`,
    }
  }
  if (typeof chrome.userScripts.execute !== 'function') {
    return {
      ok: false,
      reason: `当前 Chrome ${ver || '?'} 无 userScripts.execute（需要 ≥135）。请升级 Chrome。`,
    }
  }
  return { ok: true }
}

/** 动态渠道脚本只认 userScripts；debugger 不算「就绪」 */
async function probeScriptRuntime(): Promise<{ ok: boolean; reason?: string }> {
  return probeUserScripts()
}

/** 缺省开启；显式 false 才关闭（防风控用户可关） */
async function isDebuggerFallbackEnabled(): Promise<boolean> {
  try {
    const r = await chrome.storage.local.get([AUTO_DEBUGGER_KEY])
    return r[AUTO_DEBUGGER_KEY] !== false
  } catch {
    return true
  }
}

async function pingBridge() {
  const runtime = await probeScriptRuntime()
  try {
    const res = await fetch(BRIDGE_HEALTH)
    const ok = res.ok && (await res.text()) === 'ok'
    await chrome.storage.local.set({
      [HEALTH_KEY]: ok ? 'connected' : 'disconnected',
      [USER_SCRIPTS_KEY]: runtime.ok
        ? 'ready'
        : runtime.reason || 'unavailable',
    })
  } catch {
    await chrome.storage.local.set({
      [HEALTH_KEY]: 'disconnected',
      [USER_SCRIPTS_KEY]: runtime.ok
        ? 'ready'
        : runtime.reason || 'unavailable',
    })
  }
}

void pingBridge()
setInterval(() => {
  void pingBridge()
}, 4000)

/** 认领桌面 Agent 下发的页面脚本任务（@脚本 → run_page_script） */
const claimedScriptJobs = new Set<string>()

async function processScriptJobs() {
  let jobs: PageScriptJob[] = []
  try {
    jobs = await fetchScriptJobs()
  } catch {
    return
  }
  for (const job of jobs) {
    if (claimedScriptJobs.has(job.id)) continue
    claimedScriptJobs.add(job.id)
    void (async () => {
      try {
        const remote = await fetchCollectScript(job.code)
        if (!remote?.script?.trim()) {
          await completeScriptJob(job.id, {
            ok: false,
            error: `未拉到脚本 ${job.code}`,
          })
          return
        }
        const input = job.input?.trim() || ''
        const body = input
          ? `const __CHATCMS_INPUT__ = ${JSON.stringify(input)};\n${remote.script}`
          : remote.script
        const result = await runCollectScriptInExtension(body, job.code)
        if (!result.ok) {
          await completeScriptJob(job.id, {
            ok: false,
            error: result.message,
          })
          return
        }
        const text = [
          result.page?.title?.trim(),
          result.page?.text?.trim(),
        ]
          .filter(Boolean)
          .join('\n\n')
        await completeScriptJob(job.id, {
          ok: true,
          result: text || undefined,
        })
      } catch (e) {
        await completeScriptJob(job.id, {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        })
      } finally {
        claimedScriptJobs.delete(job.id)
      }
    })()
  }
}

setInterval(() => {
  void processScriptJobs()
}, 1500)

type PublishTabTarget = {
  id: string
  name: string
  injectUrl: string
}

type PublishTabResult = {
  id: string
  ok: boolean
  status: 'done' | 'no_script' | 'error'
  tabId?: number
  error?: string
  scriptFrom?: 'bridge' | 'builtin'
}

function waitTabComplete(tabId: number, timeoutMs = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('页面加载超时'))
    }, timeoutMs)

    function finish() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }

    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === 'complete') finish()
    }

    chrome.tabs.onUpdated.addListener(listener)
    void chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete') finish()
    })
  })
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeScriptCollectResult(
  raw: unknown,
  fallbackUrl: string,
): PageContext | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return null
    return {
      pageKey: toPageKey(fallbackUrl),
      url: fallbackUrl,
      title: '',
      text: text.slice(0, MAX_PAGE_TEXT),
      capturedAt: Date.now(),
    }
  }
  if (typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const text = String(o.text ?? o.content ?? o.body ?? '').trim()
  const title = String(o.title ?? '').trim()
  const url = String(o.url ?? fallbackUrl).trim() || fallbackUrl
  if (!text && !title) return null
  return {
    pageKey: toPageKey(url),
    url,
    title,
    text: text.slice(0, MAX_PAGE_TEXT),
    capturedAt: Date.now(),
  }
}

/** BOSS 类脚本：侧栏/桌面聚焦时 activeTab 可能不是职位页，优先最近访问的 zhipin 标签 */
async function resolveScriptTargetTab(
  scriptCode?: string,
): Promise<chrome.tabs.Tab | null> {
  const active = await getActiveContentTab()
  const code = (scriptCode || '').toUpperCase()
  const preferBoss =
    code.includes('BOSS') || code.includes('ZHIPIN') || code.includes('JD')

  if (preferBoss) {
    if (active?.id != null && active.url && /zhipin\.com/i.test(active.url)) {
      return active
    }
    try {
      const tabs = await chrome.tabs.query({
        url: ['*://*.zhipin.com/*', '*://zhipin.com/*'],
      })
      const usable = tabs
        .filter((t) => t.id != null && !isRestrictedUrl(t.url))
        // 换岗位后勿固定取第一个 job_detail（常为旧标签）
        .sort(
          (a, b) =>
            ((b as { lastAccessed?: number }).lastAccessed || 0) -
            ((a as { lastAccessed?: number }).lastAccessed || 0),
        )
      const jobDetail = usable.find((t) => t.url && /job_detail/i.test(t.url))
      if (jobDetail) return jobDetail
      if (usable[0]) return usable[0]
    } catch {
      /* ignore */
    }
  }
  return active
}

/** 在当前页执行渠道脚本；不静默回退内置采集（无素材也算成功） */
async function runCollectScriptInExtension(
  scriptBody: string,
  scriptCode?: string,
): Promise<ScriptRunResult> {
  if (!scriptBody.trim()) {
    return {
      ok: false,
      reason: 'inject_failed',
      message: '脚本内容为空',
    }
  }

  const tab = await resolveScriptTargetTab(scriptCode)
  if (!tab?.id) {
    return {
      ok: false,
      reason: 'no_tab',
      message: '未找到可运行的网页标签，请先打开一个普通网站',
    }
  }
  if (isRestrictedUrl(tab.url)) {
    return {
      ok: false,
      reason: 'restricted',
      message: '当前是系统或受限页面，无法运行脚本',
    }
  }
  const tabUrl = tab.url || ''
  try {
    const wire = await executePageScriptDynamic(tab.id, scriptBody)
    if (typeof wire !== 'string' || !wire.trim()) {
      return {
        ok: false,
        reason: 'inject_failed',
        message: `脚本无返回值（tab=${tabUrl.slice(0, 120) || 'unknown'}）。请确认前景标签是 BOSS 详情页，并重新加载扩展后重试。`,
      }
    }

    let raw: unknown
    try {
      raw = JSON.parse(wire)
    } catch {
      return {
        ok: false,
        reason: 'inject_failed',
        message: '脚本返回值不是合法 JSON',
      }
    }

    // 分片取回 sessionStorage 中的大结果
    if (
      raw &&
      typeof raw === 'object' &&
      (raw as { __storage_key?: string }).__storage_key
    ) {
      const stub = raw as { __storage_key: string; __len?: number }
      const loaded = await readScriptResultFromStorage(
        tab.id,
        stub.__storage_key,
        stub.__len || 0,
      )
      if (!loaded.ok) {
        return { ok: false, reason: 'inject_failed', message: loaded.error }
      }
      raw = loaded.raw
    }

    if (raw && typeof raw === 'object' && 'ok' in (raw as object)) {
      const r = raw as { ok?: boolean; error?: string; message?: string }
      if (r.ok === false) {
        return {
          ok: false,
          reason: 'inject_failed',
          message: r.error || r.message || '脚本返回失败',
        }
      }
    }

    const resolved = await resolveScriptAiComplete(raw)
    if (!resolved.ok) {
      return {
        ok: false,
        reason: 'inject_failed',
        message: resolved.error,
      }
    }
    const page = normalizeScriptCollectResult(resolved.raw, tabUrl)
    if (!page || (!page.text?.trim() && !page.title?.trim())) {
      return {
        ok: false,
        reason: 'inject_failed',
        message: `脚本执行成功但未采到正文（tab=${tabUrl.slice(0, 120) || 'unknown'}）。`,
      }
    }
    return { ok: true, page }
  } catch (e) {
    console.warn('[ChatCMS] script run failed', e)
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      reason: 'inject_failed',
      message: `脚本运行失败：${msg}`,
    }
  }
}

/** MV3：动态渠道脚本主路径 = chrome.userScripts（USER_SCRIPT 世界） */
let userScriptWorldReady = false

function buildPageScriptRunnerCode(scriptBody: string): string {
  // JSON.stringify 嵌入源码，避免转义问题
  return `
(async () => {
  const src = ${JSON.stringify(scriptBody)};
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  try {
    const fn = new AsyncFunction(src);
    const result = await fn();
    if (result === undefined) {
      return JSON.stringify({
        ok: false,
        error: '脚本未 return 任何值',
        href: String(location.href || ''),
        text_len: String((document.body && document.body.innerText) || '').length,
      });
    }
    let encoded = '';
    try {
      encoded = JSON.stringify(result);
    } catch (serErr) {
      return JSON.stringify({
        ok: false,
        error: '脚本返回值无法 JSON 序列化：' + (serErr && serErr.message ? serErr.message : String(serErr)),
      });
    }
    if (encoded.length > 24000) {
      const key = '__chatcms_script_result_v1__';
      try {
        sessionStorage.setItem(key, encoded);
      } catch (e) {
        return JSON.stringify({
          ok: false,
          error: '脚本结果过大且无法写入 sessionStorage（' + encoded.length + ' 字符）',
        });
      }
      return JSON.stringify({ ok: true, __storage_key: key, __len: encoded.length });
    }
    return encoded;
  } catch (e) {
    return JSON.stringify({
      ok: false,
      error: e && e.message ? e.message : String(e),
      href: String(location.href || ''),
    });
  }
})()`
}

async function ensureUserScriptWorld(): Promise<void> {
  if (userScriptWorldReady) {
    if (chrome.userScripts && typeof chrome.userScripts.execute === 'function') {
      return
    }
    userScriptWorldReady = false
  }

  const probe = await probeUserScripts()
  if (!probe.ok) {
    throw new Error(probe.reason || '用户脚本不可用')
  }

  try {
    await chrome.userScripts.configureWorld({
      messaging: true,
      csp: "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; object-src 'none'",
    })
  } catch (e) {
    console.warn('[ChatCMS] configureWorld with csp failed, retry plain', e)
    await chrome.userScripts.configureWorld({ messaging: true })
  }
  userScriptWorldReady = true
  console.info('[ChatCMS] userScripts ready', `chrome=${chromeMajorVersion()}`)
}

async function executePageScriptViaUserScripts(
  tabId: number,
  scriptBody: string,
): Promise<string> {
  await ensureUserScriptWorld()
  const code = `${buildPageScriptRunnerCode(scriptBody)};`
  const results = await chrome.userScripts.execute({
    target: { tabId },
    world: 'USER_SCRIPT',
    injectImmediately: true,
    js: [{ code }],
  })
  const first = results?.[0] as { result?: unknown; error?: string } | undefined
  if (first?.error) {
    throw new Error(first.error)
  }
  const wire = first?.result
  if (typeof wire !== 'string') {
    throw new Error('userScripts 未返回字符串结果')
  }
  return wire
}

/** 不依赖「允许用户脚本」开关；会短暂显示「扩展正在调试此浏览器」条 */
async function executePageScriptViaDebugger(
  tabId: number,
  scriptBody: string,
): Promise<string> {
  if (typeof chrome.debugger?.attach !== 'function') {
    throw new Error('当前浏览器不支持 chrome.debugger')
  }
  const debuggee: chrome.debugger.Debuggee = { tabId }
  let attached = false
  try {
    try {
      await chrome.debugger.attach(debuggee, '1.3')
      attached = true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/already attached|Another debugger/i.test(msg)) {
        throw new Error(
          '无法附加调试器：请先关闭该标签页的开发者工具 (F12)，再重试 @脚本',
        )
      }
      throw e
    }

    const expression = buildPageScriptRunnerCode(scriptBody)
    const evaluated = (await chrome.debugger.sendCommand(
      debuggee,
      'Runtime.evaluate',
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
    )) as {
      result?: { type?: string; value?: unknown; description?: string }
      exceptionDetails?: { text?: string; exception?: { description?: string } }
    }

    if (evaluated.exceptionDetails) {
      const ex = evaluated.exceptionDetails
      throw new Error(
        ex.exception?.description || ex.text || 'Debugger 执行脚本异常',
      )
    }
    const value = evaluated.result?.value
    if (typeof value !== 'string') {
      throw new Error(
        `Debugger 未返回字符串（type=${evaluated.result?.type || '?'}）`,
      )
    }
    return value
  } finally {
    if (attached) {
      try {
        await chrome.debugger.detach(debuggee)
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * 动态渠道脚本：优先 userScripts；不可用且允许回退时用 debugger。
 * 防风控：开启「允许运行用户脚本」后走 USER_SCRIPT，不再附着调试器。
 */
async function executePageScriptDynamic(
  tabId: number,
  scriptBody: string,
): Promise<string> {
  const us = await probeUserScripts()
  if (us.ok) {
    await chrome.storage.local.set({ lastScriptRuntime: 'userScripts' })
    return executePageScriptViaUserScripts(tabId, scriptBody)
  }

  if (
    (await isDebuggerFallbackEnabled()) &&
    typeof chrome.debugger?.attach === 'function'
  ) {
    console.warn(
      '[ChatCMS] userScripts unavailable → debugger fallback',
      us.reason,
    )
    await chrome.storage.local.set({ lastScriptRuntime: 'debugger' })
    return executePageScriptViaDebugger(tabId, scriptBody)
  }

  throw new Error(
    (us.reason || '用户脚本不可用') +
      ' 请打开扩展侧栏设置：点「打开扩展详情」开启「允许运行用户脚本」后「重载扩展」；' +
      '或勾选「User Scripts 不可用时用调试执行」。',
  )
}

async function readScriptResultFromStorage(
  tabId: number,
  key: string,
  totalLen: number,
): Promise<{ ok: true; raw: unknown } | { ok: false; error: string }> {
  const chunkSize = 8000
  let encoded = ''
  const len = totalLen > 0 ? totalLen : 200_000
  for (let offset = 0; offset < len; offset += chunkSize) {
    const part = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: (k: string, start: number, n: number) => {
        const s = sessionStorage.getItem(k) || ''
        return s.slice(start, start + n)
      },
      args: [key, offset, chunkSize],
    })
    const chunk = part?.[0]?.result
    if (typeof chunk !== 'string' || !chunk) break
    encoded += chunk
    if (chunk.length < chunkSize) break
  }
  // 清理
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: (k: string) => {
        sessionStorage.removeItem(k)
      },
      args: [key],
    })
  } catch {
    /* ignore */
  }
  if (!encoded) {
    return { ok: false, error: '无法从页面 sessionStorage 取回脚本结果' }
  }
  try {
    return { ok: true, raw: JSON.parse(encoded) }
  } catch {
    return { ok: false, error: 'sessionStorage 中的脚本结果不是合法 JSON' }
  }
}

async function resolveScriptAiComplete(
  raw: unknown,
): Promise<{ ok: true; raw: unknown } | { ok: false; error: string }> {
  if (!raw || typeof raw !== 'object') return { ok: true, raw }
  const o = raw as Record<string, unknown>
  const ai = o.ai_complete
  if (!ai || typeof ai !== 'object') return { ok: true, raw }
  const req = ai as Record<string, unknown>
  const content = String(req.content ?? '').trim()
  if (!content) {
    return { ok: false, error: 'ai_complete.content 为空（可能采页失败或返回值被截断）' }
  }
  const system_prompt =
    req.system_prompt != null ? String(req.system_prompt) : undefined
  console.info(
    '[ChatCMS] script ai_complete',
    `content_len=${content.length}`,
    `title=${String(o.title ?? '').slice(0, 80)}`,
  )
  const out = await chatComplete({ content, system_prompt })
  if (!out.ok) {
    return { ok: false, error: `AI 调用失败：${out.error}` }
  }
  return {
    ok: true,
    raw: {
      title: o.title,
      url: o.url,
      text: out.text,
    },
  }
}

/**
 * 小红书：写入 payload → 注入 public/inject/fill-rednote.js（避免 Vite 打包 func 在页面失效）
 * 其它平台：桥脚本字符串 + ISOLATED
 */
async function injectPublishScript(
  tabId: number,
  payload: SyncPayload,
  resolved: { source: string; from: 'bridge' | 'builtin' },
): Promise<void> {
  if (payload.platform === 'DYNAMIC_REDNOTE') {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (p: SyncPayload) => {
        ;(window as unknown as { __CHATCMS_SYNC__: SyncPayload; __CHATCMS_RESULT__: null }).__CHATCMS_SYNC__ =
          p
        ;(
          window as unknown as { __CHATCMS_RESULT__: null }
        ).__CHATCMS_RESULT__ = null
      },
      args: [payload],
    })

    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['inject/fill-rednote.js'],
    })

    // 脚本内是 async IIFE，轮询结果
    const deadline = Date.now() + 60000
    let result: { ok?: boolean; error?: string } | null | undefined
    while (Date.now() < deadline) {
      const polled = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () =>
          (window as unknown as { __CHATCMS_RESULT__?: { ok?: boolean; error?: string } })
            .__CHATCMS_RESULT__ ?? null,
      })
      result = polled?.[0]?.result as { ok?: boolean; error?: string } | null
      if (result) break
      await sleep(400)
    }

    await chrome.storage.local.set({
      lastPublishDebug: {
        at: Date.now(),
        platform: 'DYNAMIC_REDNOTE',
        result: result ?? { ok: false, error: '填表超时无结果' },
      },
    })

    if (!result?.ok) {
      throw new Error(result?.error || '小红书填表失败（超时或无返回）')
    }
    return
  }

  const injected = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: (data: SyncPayload, scriptSource: string) => {
      const AsyncFunction = Object.getPrototypeOf(async function () {})
        .constructor as new (
        ...args: string[]
      ) => (...args: unknown[]) => Promise<unknown>
      const run = new AsyncFunction('data', scriptSource)
      return run(data)
    },
    args: [payload, resolved.source],
  })
  const result = injected?.[0]?.result
  if (result && typeof result === 'object' && 'ok' in (result as object)) {
    const r = result as { ok?: boolean; error?: string }
    if (r.ok === false) throw new Error(r.error || '脚本返回失败')
  }
}

async function prepareImages(urls: string[]): Promise<SyncImage[]> {
  const out: SyncImage[] = []
  const errors: string[] = []
  const MAX_DATA_URL = 1_500_000
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    try {
      const { data_base64, content_type } = await fetchMediaBytes(url, undefined, 'image')
      const type = content_type.startsWith('image/') ? content_type : 'image/jpeg'
      const ext = type.includes('png')
        ? 'png'
        : type.includes('webp')
          ? 'webp'
          : type.includes('gif')
            ? 'gif'
            : 'jpg'
      const dataUrl = `data:${type};base64,${data_base64}`
      // 过大 data URL 可能导致 executeScript 传参失败，回退原始 https
      if (dataUrl.length > MAX_DATA_URL && /^https?:/i.test(url)) {
        out.push({ name: `image-${i + 1}.${ext}`, url, type })
      } else {
        out.push({ name: `image-${i + 1}.${ext}`, url: dataUrl, type })
      }
    } catch (e) {
      errors.push(`${url}: ${e instanceof Error ? e.message : String(e)}`)
      if (/^https?:/i.test(url)) {
        out.push({ name: `image-${i + 1}.jpg`, url, type: 'image/jpeg' })
      }
    }
  }
  if (!out.length && urls.length) {
    throw new Error(
      `配图全部下载失败（扩展需能直链拉取）。${errors[0] || ''}`,
    )
  }
  return out
}

/** 对齐 MultiPost：开 Tab → 等加载 → 拉脚本 → executeScript */
async function publishToPlatforms(
  platforms: PublishTabTarget[],
  draft: { title: string; content: string; imageUrls: string[]; isAutoPublish?: boolean },
): Promise<PublishTabResult[]> {
  const images = await prepareImages(draft.imageUrls || [])
  const results: PublishTabResult[] = []

  for (const p of platforms) {
    let tabId: number | undefined
    try {
      const tab = await chrome.tabs.create({
        url: p.injectUrl,
        active: results.length === 0,
      })
      tabId = tab.id
      if (tabId == null) throw new Error('无法创建标签页')

      await waitTabComplete(tabId)
      // 创作者 SPA 首屏较慢；小红书图文再多等一会
      await sleep(p.id === 'DYNAMIC_REDNOTE' ? 4000 : 2500)

      const resolved = await resolvePublishScript(p.id)
      if (!resolved) {
        results.push({
          id: p.id,
          ok: true,
          status: 'no_script',
          tabId,
          error: '无填表脚本，请手动粘贴',
        })
        await sleep(350)
        continue
      }

      const tabInfo = await chrome.tabs.get(tabId)
      if (!matchUrlOk(tabInfo.url, resolved.matchUrl)) {
        throw new Error(
          `页面 URL 与 match_url 不匹配（可能未登录或跳转登录页）: ${tabInfo.url || ''}`,
        )
      }

      if (!draft.imageUrls?.length && p.id === 'DYNAMIC_REDNOTE') {
        throw new Error('小红书图文至少需要 1 个配图 URL')
      }
      if (p.id === 'DYNAMIC_REDNOTE' && images.length === 0) {
        throw new Error('配图下载失败，请换一张可直链访问的图片 URL')
      }

      const payload: SyncPayload = {
        title: draft.title.trim(),
        content: draft.content.trim(),
        images,
        isAutoPublish: !!draft.isAutoPublish,
        platform: p.id,
      }

      await injectPublishScript(tabId, payload, resolved)
      results.push({
        id: p.id,
        ok: true,
        status: 'done',
        tabId,
        scriptFrom: resolved.from,
      })
    } catch (e) {
      results.push({
        id: p.id,
        ok: false,
        status: 'error',
        tabId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
    await sleep(350)
  }
  return results
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function fetchMediaBytes(
  url: string,
  pageUrl?: string,
  kind: 'image' | 'video' = 'image',
): Promise<{ data_base64: string; content_type: string }> {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    throw new Error('不支持 data/blob 地址')
  }
  const headers: Record<string, string> = {
    Accept:
      kind === 'video'
        ? 'video/*,*/*;q=0.8'
        : 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  }
  if (pageUrl) {
    headers.Referer = pageUrl
    try {
      headers.Origin = new URL(pageUrl).origin
    } catch {
      /* ignore */
    }
  }
  const res = await fetch(url, { method: 'GET', headers, credentials: 'omit' })
  if (!res.ok) {
    throw new Error(`下载失败 (${res.status})`)
  }
  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim()
  if (/text\/html|application\/json/i.test(contentType)) {
    throw new Error('返回的不是媒体文件（可能被防盗链拦截）')
  }
  const buf = new Uint8Array(await res.arrayBuffer())
  if (!buf.length) throw new Error('内容为空')
  if (kind === 'image' && !looksLikeImage(buf) && !contentType.startsWith('image/')) {
    throw new Error('内容不是有效图片')
  }
  return {
    data_base64: bytesToBase64(buf),
    content_type: contentType || 'application/octet-stream',
  }
}

function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return true
  }
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return true
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true
  }
  return false
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'PING_BRIDGE') {
    void pingBridge().then(() => {
      chrome.storage.local.get(
        [HEALTH_KEY, USER_SCRIPTS_KEY, 'lastScriptRuntime'],
        (r) => {
          sendResponse({
            status: r[HEALTH_KEY] ?? 'disconnected',
            userScripts: r[USER_SCRIPTS_KEY] ?? 'unavailable',
            lastScriptRuntime: r.lastScriptRuntime ?? null,
            extensionId: chrome.runtime.id,
          })
        },
      )
    })
    return true
  }

  if (message?.type === 'OPEN_EXTENSION_DETAILS') {
    const url = `chrome://extensions/?id=${chrome.runtime.id}`
    void chrome.tabs.create({ url }).then(
      () => sendResponse({ ok: true, url }),
      (e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          url,
        }),
    )
    return true
  }

  if (message?.type === 'RELOAD_EXTENSION') {
    sendResponse({ ok: true })
    // 稍延迟让 sendResponse 发出
    setTimeout(() => chrome.runtime.reload(), 80)
    return true
  }

  if (message?.type === 'COLLECT_ACTIVE_PAGE') {
    void collectActivePageInExtension()
      .then((result: CollectResult) => sendResponse(result))
      .catch((e) =>
        sendResponse({
          ok: false,
          reason: 'inject_failed',
          message: e instanceof Error ? e.message : String(e),
        } satisfies CollectResult),
      )
    return true
  }

  if (message?.type === 'RUN_COLLECT_SCRIPT') {
    const script = String(message.payload?.script || '').trim()
    void runCollectScriptInExtension(script)
      .then((result: ScriptRunResult) => sendResponse(result))
      .catch((e) =>
        sendResponse({
          ok: false,
          reason: 'inject_failed',
          message: e instanceof Error ? e.message : String(e),
        } satisfies ScriptRunResult),
      )
    return true
  }

  if (message?.type === 'FETCH_MEDIA_BYTES') {
    const url = String(message.payload?.url || '')
    const pageUrl = message.payload?.pageUrl
      ? String(message.payload.pageUrl)
      : undefined
    const kind =
      message.payload?.kind === 'video' ? ('video' as const) : ('image' as const)
    void fetchMediaBytes(url, pageUrl, kind)
      .then((data) => sendResponse({ ok: true, ...data }))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }),
      )
    return true
  }

  if (message?.type === 'OPEN_PUBLISH_TABS') {
    const platforms = (message.payload?.platforms || []) as PublishTabTarget[]
    if (!Array.isArray(platforms) || !platforms.length) {
      sendResponse({ ok: false, error: '未选择平台' })
      return false
    }
    /** 开页 + 注入填表脚本（对齐 MultiPost） */
    const imageUrls = Array.isArray(message.payload?.imageUrls)
      ? (message.payload.imageUrls as unknown[])
          .map((u) => String(u).trim())
          .filter(Boolean)
      : []
    void publishToPlatforms(platforms, {
      title: String(message.payload?.title || ''),
      content: String(message.payload?.content || ''),
      imageUrls,
      isAutoPublish: !!message.payload?.isAutoPublish,
    })
      .then((results) => sendResponse({ ok: true, results }))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }),
      )
    return true
  }

  /** 桌面桥页 Multipost：立刻 ACK，后台开页填表（避免 15s 超时） */
  if (message?.type === 'MULTIPOST_PUBLISH') {
    let mapped: ReturnType<typeof syncDataToPublishPayload>
    try {
      mapped = syncDataToPublishPayload(message.syncData)
    } catch (e) {
      sendResponse({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      })
      return false
    }

    // 立刻 ACK，填表在后台跑（桥页超时窗口较短）
    sendResponse({ ok: true })

    const windowId = sender.tab?.windowId
    if (windowId != null) {
      void chrome.sidePanel.open({ windowId }).catch(() => {
        /* 侧栏打不开也不阻断填表 */
      })
    }

    void publishToPlatforms(mapped.platforms, {
      title: mapped.title,
      content: mapped.content,
      imageUrls: mapped.imageUrls,
      isAutoPublish: mapped.isAutoPublish,
    })
      .then((results) =>
        chrome.storage.local.set({
          lastMultipostPublish: {
            at: Date.now(),
            results,
            title: mapped.title,
          },
        }),
      )
      .catch((e) =>
        chrome.storage.local.set({
          lastMultipostPublish: {
            at: Date.now(),
            error: e instanceof Error ? e.message : String(e),
          },
        }),
      )

    return false
  }

  return false
})

export {}
