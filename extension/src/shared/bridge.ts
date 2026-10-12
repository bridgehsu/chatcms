/** ChatCMS 本机桥（与桌面发布桥同端口） */
export const BRIDGE_BASE = 'http://127.0.0.1:17890'

export type BridgePlatform = {
  id: string
  code: string
  name: string
  kind: string
  inject_url: string
  home_url: string
  /** cn | intl */
  region?: string
  has_script: boolean
  script_version: number
  has_collect_script?: boolean
  collect_script_version?: number
}

export const MAX_PAGE_TEXT = 30_000

export type { PageMedia, PageMediaKind, PageMediaSource } from './pageMedia'

import type { PageMedia } from './pageMedia'

export interface PageContext {
  pageKey: string
  url: string
  title: string
  text: string
  capturedAt: number
  /** 页面媒体候选（仅 URL） */
  media?: PageMedia[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  created_at: number
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: number
  updated_at: number
  pinned?: boolean
  agent_id?: string | null
  group_id?: string | null
}

/** 与桌面会话分组同源 */
export interface SessionGroupItem {
  id: string
  name: string
  sort_order: number
}

/** 与桌面 AgentPicker 同源的启用代理列表 */
export interface AgentItem {
  id: string
  slug: string
  name: string
  remark: string
  enabled: boolean
  sort: number
}

/** 代理绑定的渠道脚本（运行 ≠ 发送） */
export interface AgentChannelScript {
  key: string
  role: 'read' | 'act' | string
  kind: 'collect' | 'publish' | string
  platform_id: string
  code: string
  label: string
  version: number
  match_url: string
}

export type ChatAttachmentKind = 'script' | 'skill' | 'mcp'

export interface ChatAttachment {
  kind: ChatAttachmentKind
  id: string
  label: string
  code?: string
}

export type MentionCatalogItem = {
  kind: ChatAttachmentKind
  id: string
  label: string
  description?: string
  code?: string
}

export type PageScriptJob = {
  id: string
  code: string
  input?: string | null
  session_id: string
  created: number
}

export async function fetchAgents(): Promise<AgentItem[]> {
  const res = await fetch(`${BRIDGE_BASE}/chat/agents`)
  if (!res.ok) {
    throw new Error((await res.text()) || `agents failed: ${res.status}`)
  }
  const data = (await res.json()) as AgentItem[]
  return Array.isArray(data) ? data : []
}

export async function fetchAgentScripts(
  agentId: string,
): Promise<AgentChannelScript[]> {
  const id = agentId.trim()
  if (!id) return []
  const res = await fetch(
    `${BRIDGE_BASE}/chat/agents/${encodeURIComponent(id)}/scripts`,
  )
  if (!res.ok) {
    throw new Error((await res.text()) || `agent scripts failed: ${res.status}`)
  }
  const data = (await res.json()) as AgentChannelScript[]
  return Array.isArray(data) ? data : []
}

export async function fetchChatSkills(): Promise<MentionCatalogItem[]> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/chat/skills`)
    if (!res.ok) return []
    const data = (await res.json()) as {
      id: string
      name: string
      description?: string
    }[]
    if (!Array.isArray(data)) return []
    return data.map((s) => ({
      kind: 'skill' as const,
      id: s.id || s.name,
      label: s.name || s.id,
      description: s.description,
    }))
  } catch {
    return []
  }
}

export async function fetchChatMcp(): Promise<MentionCatalogItem[]> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/chat/mcp`)
    if (!res.ok) return []
    const data = (await res.json()) as {
      id: string
      name: string
      description?: string
      enabled?: boolean
    }[]
    if (!Array.isArray(data)) return []
    return data
      .filter((m) => m.enabled !== false)
      .map((m) => ({
        kind: 'mcp' as const,
        id: m.id || m.name,
        label: m.name || m.id,
        description: m.description,
      }))
  } catch {
    return []
  }
}

export async function fetchMentionCatalog(
  agentId?: string | null,
): Promise<MentionCatalogItem[]> {
  const [skills, mcps, scripts] = await Promise.all([
    fetchChatSkills(),
    fetchChatMcp(),
    agentId?.trim()
      ? fetchAgentScripts(agentId).then((list) =>
          list.map(
            (s): MentionCatalogItem => ({
              kind: 'script',
              id: s.key || s.platform_id || s.code,
              label: s.label || s.code,
              description: s.code,
              code: s.code,
            }),
          ),
        )
      : Promise.resolve([] as MentionCatalogItem[]),
  ])
  return [...scripts, ...skills, ...mcps]
}

export async function fetchScriptJobs(): Promise<PageScriptJob[]> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/chat/script-jobs`)
    if (!res.ok) return []
    const data = (await res.json()) as PageScriptJob[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function completeScriptJob(
  id: string,
  body: { ok: boolean; result?: string; error?: string },
): Promise<void> {
  await fetch(
    `${BRIDGE_BASE}/chat/script-jobs/${encodeURIComponent(id)}/result`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

/** 页面脚本不可直连本机（Chrome 私网拦截）；由扩展后台代调补全 */
export async function chatComplete(body: {
  content: string
  system_prompt?: string
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/chat/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: body.content,
        system_prompt: body.system_prompt,
      }),
    })
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean
      text?: string
      error?: string
    } | null
    if (!res.ok || !data || data.ok === false) {
      return {
        ok: false,
        error: String(data?.error || res.statusText || `HTTP ${res.status}`),
      }
    }
    const text = data.text != null ? String(data.text).trim() : ''
    if (!text) return { ok: false, error: '模型返回为空' }
    return { ok: true, text }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function fetchCollectScript(
  platform: string,
): Promise<{
  platform_id: string
  code: string
  kind: string
  script: string
  version: number
  match_url: string
} | null> {
  try {
    const res = await fetch(
      `${BRIDGE_BASE}/collect/script?platform=${encodeURIComponent(platform)}`,
    )
    if (!res.ok) return null
    return (await res.json()) as {
      platform_id: string
      code: string
      kind: string
      script: string
      version: number
      match_url: string
    }
  } catch {
    return null
  }
}

export async function setSessionAgent(
  sessionId: string,
  agentId: string,
): Promise<ChatSession> {
  const res = await fetch(
    `${BRIDGE_BASE}/chat/session/${encodeURIComponent(sessionId)}/agent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId }),
    },
  )
  if (!res.ok) {
    throw new Error((await res.text()) || `set session agent failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchSessionGroups(): Promise<SessionGroupItem[]> {
  const res = await fetch(`${BRIDGE_BASE}/chat/session-groups`)
  if (!res.ok) {
    throw new Error((await res.text()) || `session-groups failed: ${res.status}`)
  }
  const data = (await res.json()) as SessionGroupItem[]
  return Array.isArray(data) ? data : []
}

export async function setSessionGroup(
  sessionId: string,
  groupId: string | null,
): Promise<ChatSession | null> {
  const res = await fetch(
    `${BRIDGE_BASE}/chat/session/${encodeURIComponent(sessionId)}/group`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId }),
    },
  )
  if (res.status === 204) return null
  if (!res.ok) {
    throw new Error((await res.text()) || `set session group failed: ${res.status}`)
  }
  return res.json()
}

/** 与桌面 SessionSummary / session_list 同源 */
export interface SessionSummary {
  id: string
  title: string
  updated_at?: number
  updated?: number
  message_count: number
  pinned?: boolean
  agent_id?: string | null
  group_id?: string | null
}

export function toPageKey(url: string): string {
  try {
    const u = new URL(url)
    let path = u.pathname || '/'
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1)
    }
    return `${u.origin}${path}`
  } catch {
    return url.split('?')[0].split('#')[0].replace(/\/$/, '')
  }
}

export function buildSendContent(
  question: string,
  page: PageContext | null,
  includePage: boolean,
  opts?: { contextLabel?: string },
): string {
  const q = question.trim()
  if (!includePage || !page) return q
  const label = opts?.contextLabel?.trim() || '【页面上下文】'
  const head = `${label}
标题：${page.title || '(无标题)'}
URL：${page.url}`
  const body = page.text.trim()
  if (!body) {
    return `${head}

【用户问题】
${q}`
  }
  const text =
    body.length > MAX_PAGE_TEXT
      ? `${body.slice(0, MAX_PAGE_TEXT)}\n…(已截断)`
      : body
  return `${head}
正文：
${text}

【用户问题】
${q}`
}

export async function checkBridgeHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_BASE}/health`, { method: 'GET' })
    return res.ok && (await res.text()) === 'ok'
  } catch {
    return false
  }
}

export async function ensureSession(
  pageKey: string,
  title?: string,
  groupId?: string | null,
): Promise<{ session_id: string; created: boolean }> {
  const res = await fetch(`${BRIDGE_BASE}/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page_key: pageKey,
      title: title || undefined,
      group_id: groupId || undefined,
    }),
  })
  if (!res.ok) {
    throw new Error(await res.text() || `ensureSession failed: ${res.status}`)
  }
  return res.json()
}

export async function resetSession(
  pageKey: string,
  title?: string,
  groupId?: string | null,
): Promise<{ session_id: string; created: boolean }> {
  const res = await fetch(`${BRIDGE_BASE}/chat/session/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page_key: pageKey,
      title: title || undefined,
      group_id: groupId || undefined,
    }),
  })
  if (!res.ok) {
    throw new Error(await res.text() || `resetSession failed: ${res.status}`)
  }
  return res.json()
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const res = await fetch(`${BRIDGE_BASE}/chat/session/${encodeURIComponent(sessionId)}`)
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(await res.text() || `getSession failed: ${res.status}`)
  }
  return res.json()
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${BRIDGE_BASE}/chat/sessions`)
  if (!res.ok) {
    throw new Error((await res.text()) || `listSessions failed: ${res.status}`)
  }
  return res.json()
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  const res = await fetch(
    `${BRIDGE_BASE}/chat/session/${encodeURIComponent(sessionId)}/rename`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
  )
  if (!res.ok) {
    throw new Error((await res.text()) || `renameSession failed: ${res.status}`)
  }
}

export async function pinSession(sessionId: string, pinned: boolean): Promise<void> {
  const res = await fetch(
    `${BRIDGE_BASE}/chat/session/${encodeURIComponent(sessionId)}/pin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    },
  )
  if (!res.ok) {
    throw new Error((await res.text()) || `pinSession failed: ${res.status}`)
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(
    `${BRIDGE_BASE}/chat/session/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 204) {
    throw new Error((await res.text()) || `deleteSession failed: ${res.status}`)
  }
}

export interface PermissionModeItem {
  id: string
  name: string
  description: string
  sort_order: number
}

export async function fetchPermissionModes(): Promise<{
  modes: PermissionModeItem[]
  active_mode_id: string
}> {
  const res = await fetch(`${BRIDGE_BASE}/chat/permission-modes`)
  if (!res.ok) {
    throw new Error((await res.text()) || `permission-modes failed: ${res.status}`)
  }
  return res.json()
}

export async function setActivePermissionMode(id: string): Promise<PermissionModeItem> {
  const res = await fetch(`${BRIDGE_BASE}/chat/permission-modes/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    throw new Error((await res.text()) || `set active mode failed: ${res.status}`)
  }
  return res.json()
}

export interface ModelConfigInfo {
  kind: string
  model: string
  base_url: string
  has_api_key: boolean
}

export async function fetchModelConfig(): Promise<ModelConfigInfo> {
  const res = await fetch(`${BRIDGE_BASE}/chat/model`)
  if (!res.ok) {
    throw new Error((await res.text()) || `get model failed: ${res.status}`)
  }
  return res.json()
}

export async function setModelConfig(args: {
  provider: string
  model: string
  baseUrl?: string
}): Promise<ModelConfigInfo> {
  const res = await fetch(`${BRIDGE_BASE}/chat/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: args.provider,
      model: args.model,
      base_url: args.baseUrl || undefined,
    }),
  })
  if (!res.ok) {
    throw new Error((await res.text()) || `set model failed: ${res.status}`)
  }
  return res.json()
}

/** 与桌面 ModelPicker 同源的模型档案（不含 api_key） */
export interface ModelProfileItem {
  id: string
  name: string
  model: string
  tier: string
  thinking: boolean
  enabled: boolean
}

export interface ModelProfilesInfo {
  profiles: ModelProfileItem[]
  active_profile_id: string | null
  auto_mode: boolean
}

export async function fetchModelProfiles(): Promise<ModelProfilesInfo> {
  const res = await fetch(`${BRIDGE_BASE}/chat/model-profiles`)
  if (!res.ok) {
    throw new Error((await res.text()) || `model-profiles failed: ${res.status}`)
  }
  return res.json()
}

/** id=null → Auto 模式 */
export async function activateModelProfile(
  id: string | null,
): Promise<ModelProfilesInfo> {
  const res = await fetch(`${BRIDGE_BASE}/chat/model-profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    throw new Error((await res.text()) || `activate model failed: ${res.status}`)
  }
  return res.json()
}

export type ChatMode = 'ask' | 'agent' | 'search'

export type StreamHandlers = {
  onChunk: (delta: string, done: boolean) => void
  onDone: (sessionId: string) => void
  onError: (message: string) => void
}

/** POST /chat/send，解析 SSE（stream-chunk / done / error） */
export async function sendChatStream(
  args: {
    content: string
    sessionId?: string | null
    pageKey?: string | null
    forceNew?: boolean
    chatMode?: ChatMode
    /** 本轮首选代理；会话已绑定角色时桌面侧会沿用绑定 */
    agentId?: string | null
    /** 新建会话时写入的分组 */
    groupId?: string | null
    /** @ 引用：脚本 / Skill / MCP */
    attachments?: ChatAttachment[] | null
  },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BRIDGE_BASE}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      content: args.content,
      session_id: args.sessionId || undefined,
      page_key: args.pageKey || undefined,
      force_new: args.forceNew || undefined,
      chat_mode: args.chatMode || undefined,
      agent_id: args.agentId || undefined,
      group_id: args.groupId || undefined,
      attachments: args.attachments?.length ? args.attachments : undefined,
    }),
    signal,
  })

  if (!res.ok) {
    throw new Error((await res.text()) || `send failed: ${res.status}`)
  }
  if (!res.body) {
    throw new Error('响应无 body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

  const flush = () => {
    if (!dataLines.length) {
      eventName = 'message'
      return
    }
    const data = dataLines.join('\n')
    dataLines = []
    const name = eventName
    eventName = 'message'

    if (name === 'stream-chunk') {
      try {
        const chunk = JSON.parse(data) as {
          session_id: string
          delta: string
          done: boolean
        }
        handlers.onChunk(chunk.delta || '', chunk.done)
      } catch {
        /* ignore */
      }
    } else if (name === 'done') {
      try {
        const payload = JSON.parse(data) as { session_id: string }
        handlers.onDone(payload.session_id)
      } catch {
        handlers.onDone('')
      }
    } else if (name === 'error') {
      try {
        const payload = JSON.parse(data) as { message: string }
        handlers.onError(payload.message || '未知错误')
      } catch {
        handlers.onError(data || '未知错误')
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() ?? ''
    for (const line of parts) {
      if (line === '') {
        flush()
        continue
      }
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
  }
  flush()
}

export interface MediaImportItem {
  kind: 'image' | 'video'
  url: string
  page_url?: string
  title?: string
  client_id?: string
  /** 扩展已下载的文件，避免桌面侧防盗链失败 */
  data_base64?: string
  content_type?: string
}

export interface MediaImportResult {
  ok: boolean
  client_id?: string
  kind?: string
  id?: string
  error?: string
}

/** 经 background 拉取媒体字节（扩展不受页面 CORS 限制） */
export async function fetchMediaBytes(
  url: string,
  pageUrl?: string,
  kind: 'image' | 'video' = 'image',
): Promise<{ data_base64: string; content_type: string }> {
  const res = (await chrome.runtime.sendMessage({
    type: 'FETCH_MEDIA_BYTES',
    payload: { url, pageUrl, kind },
  })) as
    | { ok: true; data_base64: string; content_type: string }
    | { ok: false; error: string }
    | undefined
  if (!res || !('ok' in res)) {
    throw new Error('拉取媒体无响应')
  }
  if (!res.ok) {
    throw new Error(res.error || '拉取媒体失败')
  }
  return { data_base64: res.data_base64, content_type: res.content_type }
}

/** POST /media/import — 写入图片/视频库（优先带 data_base64） */
export async function importMedia(
  items: MediaImportItem[],
): Promise<MediaImportResult[]> {
  const res = await fetch(`${BRIDGE_BASE}/media/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    throw new Error((await res.text()) || `importMedia failed: ${res.status}`)
  }
  const data = (await res.json()) as { results: MediaImportResult[] }
  return data.results || []
}
