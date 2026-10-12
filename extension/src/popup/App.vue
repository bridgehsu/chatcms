<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  activateModelProfile,
  checkBridgeHealth,
  deleteSession,
  ensureSession,
  fetchAgents,
  fetchModelProfiles,
  fetchPermissionModes,
  fetchSessionGroups,
  getSession,
  listSessions,
  pinSession,
  renameSession,
  sendChatStream,
  setActivePermissionMode,
  setSessionAgent,
  setSessionGroup,
  toPageKey,
  type AgentItem,
  type ChatAttachment,
  type ChatMessage,
  type ChatMode,
  type ModelProfileItem,
  type PageContext,
  type PermissionModeItem,
  type SessionGroupItem,
  type SessionSummary,
} from '../shared/bridge'
import {
  getActiveContentTab,
  isRestrictedUrl,
  peekActivePageDetailed,
} from '../shared/collect'
import MarkdownContent from '../components/MarkdownContent.vue'
import MentionPicker from '../components/MentionPicker.vue'
import ModuleSwitch from '../components/ModuleSwitch.vue'
import NavPanel from '../components/NavPanel.vue'
import PublishPanel from '../components/PublishPanel.vue'
import {
  APP_MODULE_KEY,
  type AppModule,
} from '../shared/publishDraft'

type BridgeStatus = 'connected' | 'disconnected' | 'checking'
/** chat：对话区；history：最近会话列表（同源桌面智能会话） */
type PanelView = 'chat' | 'history'

/** userScripts API：ready 或具体失败原因 */
const userScriptsStatus = ref<string>('checking')
/** User Scripts 不可用时是否 debugger 回退（默认开，防风控可关） */
const allowDebuggerFallback = ref(true)
const extensionId = ref('')
const lastScriptRuntime = ref<string | null>(null)

const CHAT_MODE_OPTIONS: { value: ChatMode; label: string }[] = [
  { value: 'ask', label: 'Ask' },
  { value: 'agent', label: 'Agent' },
  { value: 'search', label: 'Search' },
]

const CHAT_MODE_KEY = 'chatcms.chatMode'
const PREFERRED_AGENT_KEY = 'chatcms.preferredAgentId'
const PREFERRED_GROUP_KEY = 'chatcms.preferredGroupId'


/** 与桌面智能会话一致的新建标题（首条回复后自动摘要） */
const NEW_SESSION_TITLE = 'New Chat'

/** 会话模式：系统页 / 无标签时用的固定会话键 */
const SESSION_FALLBACK_KEY = 'extension:chat'

const bridgeStatus = ref<BridgeStatus>('checking')
const page = ref<PageContext | null>(null)
const sessionId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const input = ref('')
const sending = ref(false)
const streamingContent = ref('')
const errorMsg = ref('')
const listRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const loadingSession = ref(false)
const panelView = ref<PanelView>('chat')
const appModule = ref<AppModule>('chat')
const sessions = ref<SessionSummary[]>([])
const sessionsLoading = ref(false)
/** 对齐桌面 newSession：发首条前 force_new，避免复用 page 绑定 */
const forceNewSession = ref(false)
const sessionMenuId = ref<string | null>(null)
const editingSessionId = ref<string | null>(null)
const editTitleDraft = ref('')
const pendingDelete = ref<{ id: string; title: string } | null>(null)
const deletingSession = ref(false)
const permissionModes = ref<PermissionModeItem[]>([])
const activeModeId = ref('')
const modesLoading = ref(false)
const openSelect = ref<
  'mode' | 'chatMode' | 'model' | 'agent' | 'group' | null
>(null)
const agents = ref<AgentItem[]>([])
const agentsLoading = ref(false)
/** 当前会话已绑定的角色；null 表示未绑定 */
const sessionAgentId = ref<string | null>(null)
/** 新会话 / 未绑定会话时的首选角色；null = 自动选角 */
const preferredAgentId = ref<string | null>(null)
const sessionGroups = ref<SessionGroupItem[]>([])
const groupsLoading = ref(false)
/** 当前会话所属分组；null = 未分组或尚未绑定会话 */
const sessionGroupId = ref<string | null>(null)
/** 新建会话时的首选分组；null = 未分组 */
const preferredGroupId = ref<string | null>(null)
const chatMode = ref<ChatMode>('ask')
const modelProfiles = ref<ModelProfileItem[]>([])
const autoModel = ref(true)
const activeProfileId = ref<string | null>(null)
const modelLoading = ref(false)
const settingsOpen = ref(false)

const bridgeStatusLabel = computed(() => {
  if (bridgeStatus.value === 'connected') return '已连接'
  if (bridgeStatus.value === 'checking') return '检测中'
  return '未连接'
})

const bridgeStatusTitle = computed(() => {
  if (bridgeStatus.value === 'connected') return 'ChatCMS 桌面端已连接'
  if (bridgeStatus.value === 'checking') return '正在检测桌面端…'
  return '未连接 · 请启动 ChatCMS 桌面应用'
})

const attachments = ref<ChatAttachment[]>([])
const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionStart = ref(-1)

const canSend = computed(
  () =>
    bridgeStatus.value === 'connected' &&
    !sending.value &&
    (input.value.trim().length > 0 || attachments.value.length > 0),
)

const newChatLabel = computed(() => '发起新会话')

const activePermissionValue = computed(() => {
  const id = activeModeId.value
  if (id && permissionModes.value.some((m) => m.id === id)) return id
  return permissionModes.value[0]?.id ?? ''
})

const permissionModeLabel = computed(() => {
  const id = activePermissionValue.value
  return (
    permissionModes.value.find((m) => m.id === id)?.name ||
    (modesLoading.value ? '加载中…' : '无可用模式')
  )
})

const permissionModeTitle = computed(
  () =>
    permissionModes.value.find((m) => m.id === activePermissionValue.value)
      ?.description || '权限模式',
)

const chatModeLabel = computed(
  () =>
    CHAT_MODE_OPTIONS.find((o) => o.value === chatMode.value)?.label ?? 'Ask',
)

const showPermission = computed(() => chatMode.value === 'agent')

const modelLabel = computed(() => {
  if (autoModel.value) return 'Auto'
  const active = modelProfiles.value.find((p) => p.id === activeProfileId.value)
  if (!active) return '选择模型'
  return active.thinking ? `${active.name} · 思考` : active.name
})

const sessionBound = computed(() => !!sessionAgentId.value)

const activeAgentValue = computed(
  () => sessionAgentId.value ?? preferredAgentId.value,
)

const agentLabel = computed(() => {
  const id = activeAgentValue.value
  if (!id) return '自动选角'
  const a = agents.value.find((x) => x.id === id)
  return a?.name || '未知代理'
})

const agentTitle = computed(() => {
  const id = activeAgentValue.value
  if (!id) return '按意图或全局默认选角'
  const a = agents.value.find((x) => x.id === id)
  return a?.remark?.trim() || a?.slug || '会话代理'
})

/** 已有会话看 sessionGroupId；新会话 / 未落库前看 preferredGroupId */
const activeGroupValue = computed(() =>
  sessionId.value ? sessionGroupId.value : preferredGroupId.value,
)

const groupLabel = computed(() => {
  const id = activeGroupValue.value
  if (!id) return '未分组'
  return sessionGroups.value.find((g) => g.id === id)?.name || '未知分组'
})

const groupTitle = computed(() => {
  const id = activeGroupValue.value
  if (!id) return '新会话将归入「未分组」'
  const g = sessionGroups.value.find((x) => x.id === id)
  return g ? `会话分组：${g.name}` : '会话分组'
})

function syncSessionAgent(session: { agent_id?: string | null } | null | undefined) {
  sessionAgentId.value = session?.agent_id ?? null
}

function syncSessionGroup(session: { group_id?: string | null } | null | undefined) {
  sessionGroupId.value = session?.group_id ?? null
  if (session?.group_id) {
    preferredGroupId.value = session.group_id
  }
}

/** 发布「从会话导入」：最近一条助手正文（去掉页面上下文包装） */
const importableAssistantContent = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const m = messages.value[i]
    if (m.role === 'assistant' && m.content.trim()) {
      return m.content.trim()
    }
  }
  if (streamingContent.value.trim()) return streamingContent.value.trim()
  return ''
})

function toggleSelect(
  which: 'mode' | 'chatMode' | 'model' | 'agent' | 'group',
) {
  if (which === 'mode') {
    if (
      bridgeStatus.value !== 'connected' ||
      modesLoading.value ||
      !permissionModes.value.length
    ) {
      return
    }
  }
  if (which === 'chatMode') {
    if (sending.value) return
  }
  if (which === 'model') {
    if (bridgeStatus.value !== 'connected' || modelLoading.value) return
    if (openSelect.value !== 'model') void loadModelProfiles()
  }
  if (which === 'agent') {
    if (bridgeStatus.value !== 'connected' || agentsLoading.value || sending.value) return
    if (openSelect.value !== 'agent') void loadAgents()
  }
  if (which === 'group') {
    if (bridgeStatus.value !== 'connected' || groupsLoading.value || sending.value) return
    if (openSelect.value !== 'group') void loadSessionGroups()
  }
  openSelect.value = openSelect.value === which ? null : which
}

function selectChatMode(mode: ChatMode) {
  chatMode.value = mode
  openSelect.value = null
  void chrome.storage.local.set({ [CHAT_MODE_KEY]: mode })
}

async function selectPermissionMode(id: string) {
  openSelect.value = null
  if (!id || id === activeModeId.value) return
  try {
    await setActivePermissionMode(id)
    activeModeId.value = id
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
    await loadPermissionModes()
  }
}

async function loadModelProfiles() {
  if (bridgeStatus.value !== 'connected') return
  modelLoading.value = true
  try {
    const data = await fetchModelProfiles()
    modelProfiles.value = data.profiles || []
    autoModel.value = !!data.auto_mode || !data.active_profile_id
    activeProfileId.value = data.auto_mode ? null : data.active_profile_id
  } catch (e) {
    console.warn('[ChatCMS] load model profiles', e)
  } finally {
    modelLoading.value = false
  }
}

async function pickAutoModel() {
  openSelect.value = null
  modelLoading.value = true
  try {
    const data = await activateModelProfile(null)
    modelProfiles.value = data.profiles || []
    autoModel.value = true
    activeProfileId.value = null
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
    await loadModelProfiles()
  } finally {
    modelLoading.value = false
  }
}

async function pickModelProfile(id: string) {
  openSelect.value = null
  modelLoading.value = true
  try {
    const data = await activateModelProfile(id)
    modelProfiles.value = data.profiles || []
    autoModel.value = !!data.auto_mode
    activeProfileId.value = data.active_profile_id
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
    await loadModelProfiles()
  } finally {
    modelLoading.value = false
  }
}

async function loadAgents() {
  if (bridgeStatus.value !== 'connected') {
    agents.value = []
    return
  }
  agentsLoading.value = true
  try {
    agents.value = await fetchAgents()
  } catch (e) {
    console.warn('[ChatCMS] load agents', e)
  } finally {
    agentsLoading.value = false
  }
}

async function loadSessionGroups() {
  if (bridgeStatus.value !== 'connected') {
    sessionGroups.value = []
    return
  }
  groupsLoading.value = true
  try {
    sessionGroups.value = await fetchSessionGroups()
    if (
      preferredGroupId.value &&
      !sessionGroups.value.some((g) => g.id === preferredGroupId.value)
    ) {
      preferredGroupId.value = null
      await chrome.storage.local.remove(PREFERRED_GROUP_KEY)
    }
  } catch (e) {
    console.warn('[ChatCMS] load session groups', e)
  } finally {
    groupsLoading.value = false
  }
}

async function pickAutoAgent() {
  openSelect.value = null
  if (sessionBound.value) return
  preferredAgentId.value = null
  await chrome.storage.local.remove(PREFERRED_AGENT_KEY)
}

async function pickAgent(id: string) {
  openSelect.value = null
  if (!id || sending.value) return
  preferredAgentId.value = id
  await chrome.storage.local.set({ [PREFERRED_AGENT_KEY]: id })
  if (sessionId.value) {
    try {
      const session = await setSessionAgent(sessionId.value, id)
      syncSessionAgent(session)
    } catch (err) {
      errorMsg.value = err instanceof Error ? err.message : String(err)
      await loadAgents()
    }
  }
}

async function pickGroup(id: string | null) {
  openSelect.value = null
  if (sending.value) return
  preferredGroupId.value = id
  if (id) {
    await chrome.storage.local.set({ [PREFERRED_GROUP_KEY]: id })
  } else {
    await chrome.storage.local.remove(PREFERRED_GROUP_KEY)
  }
  if (sessionId.value) {
    try {
      const session = await setSessionGroup(sessionId.value, id)
      syncSessionGroup(session)
      if (!session) sessionGroupId.value = id
    } catch (err) {
      errorMsg.value = err instanceof Error ? err.message : String(err)
      await loadSessionGroups()
    }
  } else {
    sessionGroupId.value = id
  }
}

function onDocPointerDown(e: PointerEvent) {
  const t = e.target as HTMLElement | null
  if (!t?.closest?.('.ui-select')) {
    openSelect.value = null
  }
  if (!t?.closest?.('.session-item__toolbar') && !t?.closest?.('.session-item__menu')) {
    sessionMenuId.value = null
  }
}

function onDocKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  openSelect.value = null
  sessionMenuId.value = null
  if (settingsOpen.value) {
    settingsOpen.value = false
    return
  }
  if (editingSessionId.value) cancelRenameSession()
  if (pendingDelete.value && !deletingSession.value) pendingDelete.value = null
  if (panelView.value === 'history') closeHistory()
}

async function openSettings() {
  openSelect.value = null
  settingsOpen.value = true
  if (bridgeStatus.value === 'connected') {
    await loadPermissionModes()
  }
}

function closeSettings() {
  settingsOpen.value = false
}

async function pingDesktop() {
  await refreshHealth()
  if (bridgeStatus.value === 'connected') {
    await Promise.all([
      loadPermissionModes(),
      loadModelProfiles(),
      loadAgents(),
      loadSessionGroups(),
    ])
  }
}

watch(appModule, (m) => {
  void chrome.storage.local.set({ [APP_MODULE_KEY]: m })
  openSelect.value = null
  sessionMenuId.value = null
  settingsOpen.value = false
})

async function loadPermissionModes() {
  if (bridgeStatus.value !== 'connected') {
    permissionModes.value = []
    activeModeId.value = ''
    return
  }
  modesLoading.value = true
  try {
    const data = await fetchPermissionModes()
    permissionModes.value = [...(data.modes || [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    )
    let id = data.active_mode_id || ''
    if (!id || !permissionModes.value.some((m) => m.id === id)) {
      id = permissionModes.value[0]?.id ?? ''
      if (id) {
        await setActivePermissionMode(id).catch(() => undefined)
      }
    }
    activeModeId.value = id
  } catch (e) {
    console.warn('[ChatCMS] load permission modes', e)
  } finally {
    modesLoading.value = false
  }
}

async function scrollBottom() {
  await nextTick()
  const el = listRef.value
  if (el) el.scrollTop = el.scrollHeight
}

function autoResizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

/** 解析当前标签的会话绑定键（不依赖 content script） */
async function resolveBindingKey(): Promise<{ pageKey: string; title: string }> {
  try {
    const tab = await getActiveContentTab()
    if (tab?.url && !isRestrictedUrl(tab.url)) {
      return {
        pageKey: toPageKey(tab.url),
        title: NEW_SESSION_TITLE,
      }
    }
  } catch {
    /* ignore */
  }
  return { pageKey: SESSION_FALLBACK_KEY, title: NEW_SESSION_TITLE }
}

/** 静默 peek 当前标签 title + url（仅用于会话绑定，不抽正文） */
async function peekActivePage(): Promise<PageContext | null> {
  const result = await peekActivePageDetailed()
  return result.ok ? result.page : null
}

async function refreshHealth() {
  bridgeStatus.value = 'checking'
  const ok = await checkBridgeHealth()
  bridgeStatus.value = ok ? 'connected' : 'disconnected'
  try {
    const r = await chrome.storage.local.get([
      'userScriptsStatus',
      'autoDebuggerScriptFallback',
      'lastScriptRuntime',
    ])
    userScriptsStatus.value = String(r.userScriptsStatus || 'unavailable')
    allowDebuggerFallback.value = r.autoDebuggerScriptFallback !== false
    lastScriptRuntime.value =
      typeof r.lastScriptRuntime === 'string' ? r.lastScriptRuntime : null
  } catch {
    userScriptsStatus.value = 'unavailable'
    allowDebuggerFallback.value = true
  }
  extensionId.value = chrome.runtime?.id || ''
}

async function setDebuggerFallback(on: boolean) {
  allowDebuggerFallback.value = on
  try {
    await chrome.storage.local.set({ autoDebuggerScriptFallback: on })
  } catch {
    /* ignore */
  }
}

async function openExtensionDetails() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_DETAILS' })
    if (!res?.ok) {
      const url = `chrome://extensions/?id=${chrome.runtime.id}`
      await chrome.tabs.create({ url })
    }
  } catch {
    try {
      await chrome.tabs.create({
        url: `chrome://extensions/?id=${chrome.runtime.id}`,
      })
    } catch {
      /* ignore */
    }
  }
}

function reloadExtension() {
  void chrome.runtime.sendMessage({ type: 'RELOAD_EXTENSION' }).catch(() => {
    chrome.runtime.reload()
  })
}

async function loadForPage(p: PageContext) {
  loadingSession.value = true
  errorMsg.value = ''
  try {
    const { session_id } = await ensureSession(
      p.pageKey,
      NEW_SESSION_TITLE,
      preferredGroupId.value,
    )
    sessionId.value = session_id
    const session = await getSession(session_id)
    syncSessionAgent(session)
    syncSessionGroup(session)
    messages.value = (session?.messages || []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    )
    await scrollBottom()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingSession.value = false
  }
}

async function loadSessionByKey(pageKey: string, title?: string) {
  if (bridgeStatus.value !== 'connected') return
  loadingSession.value = true
  try {
    const { session_id } = await ensureSession(
      pageKey,
      title,
      preferredGroupId.value,
    )
    sessionId.value = session_id
    const session = await getSession(session_id)
    syncSessionAgent(session)
    syncSessionGroup(session)
    messages.value = (session?.messages || []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    )
    await scrollBottom()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingSession.value = false
  }
}

async function initPage() {
  // 静默 peek：能关联当前页则按 pageKey 绑会话，否则走侧栏 fallback
  const soft = await peekActivePage()
  page.value = soft

  if (bridgeStatus.value !== 'connected') return

  if (soft) {
    await loadForPage(soft)
  } else {
    const { pageKey, title } = await resolveBindingKey()
    await loadSessionByKey(pageKey, title)
  }
}

async function onNewChat() {
  if (sending.value) return
  errorMsg.value = ''
  sessionMenuId.value = null
  editingSessionId.value = null
  pendingDelete.value = null
  // 对齐桌面智能会话：清空当前对话，首条消息再创建（force_new）
  sessionId.value = null
  sessionAgentId.value = null
  sessionGroupId.value = preferredGroupId.value
  messages.value = []
  streamingContent.value = ''
  forceNewSession.value = true
  panelView.value = 'chat'
  await nextTick()
  textareaRef.value?.focus()
}

const ATTACH_FILLER = '请根据我引用的内容处理'

function stripAttachFiller(raw: string) {
  let t = raw.trim()
  if (t === ATTACH_FILLER) return ''
  if (t.endsWith(ATTACH_FILLER)) {
    t = t.slice(0, -ATTACH_FILLER.length).trim()
  }
  if (t.includes(ATTACH_FILLER)) {
    t = t.split(ATTACH_FILLER).join(' ').replace(/\s+/g, ' ').trim()
  }
  return t
}

function displaySessionTitle(raw: string) {
  const t = stripAttachFiller(raw)
  if (!t || t === 'New Chat' || t === '网页会话' || t === '侧栏会话') {
    return '新会话'
  }
  return t
}

function groupNameOf(groupId: string | null | undefined) {
  if (!groupId) return '未分组'
  return sessionGroups.value.find((g) => g.id === groupId)?.name || '未分组'
}

async function loadSessionList() {
  if (bridgeStatus.value !== 'connected') {
    sessions.value = []
    return
  }
  sessionsLoading.value = true
  try {
    sessions.value = await listSessions()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    sessionsLoading.value = false
  }
}

async function openHistory() {
  openSelect.value = null
  sessionMenuId.value = null
  panelView.value = 'history'
  await loadSessionList()
}

function closeHistory() {
  sessionMenuId.value = null
  editingSessionId.value = null
  panelView.value = 'chat'
}

async function selectHistorySession(id: string) {
  if (sending.value || editingSessionId.value === id) return
  sessionMenuId.value = null
  loadingSession.value = true
  errorMsg.value = ''
  try {
    const session = await getSession(id)
    if (!session) {
      errorMsg.value = '会话不存在或已删除'
      await loadSessionList()
      return
    }
    sessionId.value = session.id
    forceNewSession.value = false
    syncSessionAgent(session)
    syncSessionGroup(session)
    messages.value = session.messages.filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    )
    panelView.value = 'chat'
    await scrollBottom()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingSession.value = false
  }
}

function toggleSessionMenu(id: string) {
  if (editingSessionId.value) return
  sessionMenuId.value = sessionMenuId.value === id ? null : id
}

function startRenameSession(id: string, title: string) {
  sessionMenuId.value = null
  editingSessionId.value = id
  editTitleDraft.value = displaySessionTitle(title)
}

function cancelRenameSession() {
  editingSessionId.value = null
  editTitleDraft.value = ''
}

async function commitRenameSession() {
  const id = editingSessionId.value
  if (!id) return
  const next = editTitleDraft.value.trim()
  const current = sessions.value.find((s) => s.id === id)
  editingSessionId.value = null
  editTitleDraft.value = ''
  if (!next || !current || next === current.title) return
  try {
    await renameSession(id, next)
    await loadSessionList()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  }
}

async function togglePinSession(id: string, pinned: boolean) {
  sessionMenuId.value = null
  try {
    await pinSession(id, !pinned)
    await loadSessionList()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  }
}

function requestDeleteSession(id: string, title: string) {
  sessionMenuId.value = null
  pendingDelete.value = { id, title: displaySessionTitle(title) }
}

async function confirmDeleteSession() {
  if (!pendingDelete.value) return
  deletingSession.value = true
  const { id } = pendingDelete.value
  try {
    await deleteSession(id)
    if (sessionId.value === id) {
      sessionId.value = null
      sessionAgentId.value = null
      messages.value = []
      forceNewSession.value = true
    }
    pendingDelete.value = null
    await loadSessionList()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    deletingSession.value = false
  }
}

function formatSessionTime(ts: number) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

const emptyHint = computed(() =>
  input.value.trim()
    ? '编辑后 Enter 发送'
    : '输入 @ 可引用脚本 / 技能 / MCP',
)

const composerPlaceholder = computed(() => {
  if (chatMode.value === 'ask') return '提问或 @脚本 / 技能 / MCP…'
  if (chatMode.value === 'search') return '检索知识库，或 @ 引用…'
  return '描述任务，输入 @ 引用脚本 / 技能 / MCP…'
})

function displayUserContent(content: string) {
  const marker = '【用户问题】'
  const idx = content.indexOf(marker)
  const body = idx >= 0 ? content.slice(idx + marker.length).trim() : content
  return stripAttachFiller(body) || body.trim()
}

function closeMention() {
  mentionOpen.value = false
  mentionQuery.value = ''
  mentionStart.value = -1
}

function syncMentionFromValue(value: string, caret: number) {
  const before = value.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at < 0) {
    closeMention()
    return
  }
  if (at > 0 && !/\s/.test(before[at - 1] ?? ' ')) {
    closeMention()
    return
  }
  const frag = before.slice(at + 1)
  if (/\s/.test(frag)) {
    closeMention()
    return
  }
  mentionOpen.value = true
  mentionQuery.value = frag
  mentionStart.value = at
}

function onPickMention(att: ChatAttachment) {
  if (!attachments.value.some((a) => a.kind === att.kind && a.id === att.id)) {
    attachments.value = [...attachments.value, att]
  }
  if (mentionStart.value >= 0) {
    const before = input.value.slice(0, mentionStart.value)
    const after = input.value.slice(
      mentionStart.value + 1 + mentionQuery.value.length,
    )
    input.value = `${before}${after}`
  }
  closeMention()
  void nextTick(() => {
    autoResizeTextarea()
    textareaRef.value?.focus()
  })
}

function removeAttachment(att: ChatAttachment) {
  attachments.value = attachments.value.filter(
    (a) => !(a.kind === att.kind && a.id === att.id),
  )
}

async function onSend() {
  const question = input.value.trim()
  if (!canSend.value) return

  const atts = [...attachments.value]
  // 仅有 @ 附件时只发「@标签」，后端按「只 @ → 直接执行」
  const content =
    atts.length > 0
      ? [atts.map((a) => `@${a.label}`).join(' '), question].filter(Boolean).join(' ')
      : question

  const binding =
    page.value != null
      ? { pageKey: page.value.pageKey, title: page.value.title || undefined }
      : await resolveBindingKey()

  const useForceNew = forceNewSession.value
  // 新会话：不走 ensureSession（否则会复用 page 旧绑定）；交给 send force_new
  if (!sessionId.value && !useForceNew && bridgeStatus.value === 'connected') {
    try {
      const { session_id } = await ensureSession(
        binding.pageKey,
        binding.title,
        preferredGroupId.value,
      )
      sessionId.value = session_id
    } catch (e) {
      errorMsg.value = e instanceof Error ? e.message : String(e)
      return
    }
  }

  input.value = ''
  attachments.value = []
  closeMention()
  await nextTick()
  autoResizeTextarea()
  sending.value = true
  streamingContent.value = ''
  errorMsg.value = ''

  const optimistic: ChatMessage = {
    id: `local-${Date.now()}`,
    role: 'user',
    content,
    created_at: Math.floor(Date.now() / 1000),
  }
  messages.value = [...messages.value, optimistic]
  await scrollBottom()

  try {
    await sendChatStream(
      {
        content,
        sessionId: useForceNew ? null : sessionId.value,
        pageKey: binding.pageKey,
        forceNew: useForceNew,
        chatMode: chatMode.value,
        agentId: activeAgentValue.value,
        // force_new 时服务端新建会话，带上当前聚焦分组
        groupId: useForceNew ? preferredGroupId.value : undefined,
        attachments: atts.length ? atts : undefined,
      },
      {
        onChunk: (delta, done) => {
          if (delta) streamingContent.value += delta
          void scrollBottom()
          void done
        },
        onDone: async (sid) => {
          forceNewSession.value = false
          if (sid) sessionId.value = sid
          const session = await getSession(sid || sessionId.value || '')
          if (session) {
            syncSessionAgent(session)
            syncSessionGroup(session)
            messages.value = session.messages.filter(
              (m) => m.role === 'user' || m.role === 'assistant',
            )
          } else if (streamingContent.value) {
            messages.value = [
              ...messages.value,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: streamingContent.value,
                created_at: Math.floor(Date.now() / 1000),
              },
            ]
          }
          streamingContent.value = ''
          await scrollBottom()
        },
        onError: (msg) => {
          errorMsg.value = msg
          streamingContent.value = ''
        },
      },
    )
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    sending.value = false
    await scrollBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (mentionOpen.value && e.key === 'Enter' && !e.shiftKey) {
    // MentionPicker 捕获阶段处理选中；此处阻止发送
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void onSend()
  }
}

function onComposerInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  input.value = el.value
  syncMentionFromValue(el.value, el.selectionStart ?? el.value.length)
}

const onStorage = (changes: Record<string, chrome.storage.StorageChange>) => {
  if (changes.bridgeStatus) {
    const v = changes.bridgeStatus.newValue as BridgeStatus
    if (v === 'connected' || v === 'disconnected') {
      bridgeStatus.value = v
    }
  }
}

watch(bridgeStatus, async (s, prev) => {
  if (s === 'connected') {
    await Promise.all([
      loadPermissionModes(),
      loadModelProfiles(),
      loadAgents(),
      loadSessionGroups(),
    ])
    if (prev !== 'connected') {
      if (page.value) {
        await loadForPage(page.value)
      } else {
        const { pageKey, title } = await resolveBindingKey()
        await loadSessionByKey(pageKey, title)
      }
    }
  }
})

watch(input, () => autoResizeTextarea())

onMounted(async () => {
  chrome.storage.onChanged.addListener(onStorage)
  document.addEventListener('pointerdown', onDocPointerDown)
  window.addEventListener('keydown', onDocKeydown)
  const stored = await chrome.storage.local.get([
    'bridgeStatus',
    APP_MODULE_KEY,
    CHAT_MODE_KEY,
    PREFERRED_AGENT_KEY,
    PREFERRED_GROUP_KEY,
  ])
  if (stored.bridgeStatus === 'connected' || stored.bridgeStatus === 'disconnected') {
    bridgeStatus.value = stored.bridgeStatus
  }
  const storedMode = stored[CHAT_MODE_KEY]
  if (storedMode === 'ask' || storedMode === 'agent' || storedMode === 'search') {
    chatMode.value = storedMode
  }
  const storedAgent = stored[PREFERRED_AGENT_KEY]
  if (typeof storedAgent === 'string' && storedAgent.trim()) {
    preferredAgentId.value = storedAgent.trim()
  }
  const storedGroup = stored[PREFERRED_GROUP_KEY]
  if (typeof storedGroup === 'string' && storedGroup.trim()) {
    preferredGroupId.value = storedGroup.trim()
    sessionGroupId.value = storedGroup.trim()
  }
  if (
    stored[APP_MODULE_KEY] === 'chat' ||
    stored[APP_MODULE_KEY] === 'nav' ||
    stored[APP_MODULE_KEY] === 'publish'
  ) {
    appModule.value = stored[APP_MODULE_KEY]
  } else if (stored[APP_MODULE_KEY] === 'collect') {
    // 顶层「采集」模块已下线，旧偏好回退到对话
    appModule.value = 'chat'
    void chrome.storage.local.set({ [APP_MODULE_KEY]: 'chat' })
  }
  await refreshHealth()
  if (bridgeStatus.value === 'connected') {
    await Promise.all([
      loadPermissionModes(),
      loadModelProfiles(),
      loadAgents(),
      loadSessionGroups(),
    ])
  }
  await initPage()
  autoResizeTextarea()
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(onStorage)
  document.removeEventListener('pointerdown', onDocPointerDown)
  window.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div class="root">
    <div class="panel">
      <!-- 单行壳：模块 Tab + 连接/设置（Ask/模型/权限在对话顶栏） -->
      <header class="app-chrome">
        <ModuleSwitch v-model="appModule" class="app-chrome__tabs" />
        <div class="app-chrome__right">
          <button
            type="button"
            class="conn-status"
            :title="bridgeStatusTitle"
            @click="pingDesktop"
          >
            <span
              class="dot"
              :class="{
                'dot--on': bridgeStatus === 'connected',
                'dot--off': bridgeStatus !== 'connected',
                'dot--checking': bridgeStatus === 'checking',
              }"
            />
            <span class="conn-status__text">{{ bridgeStatusLabel }}</span>
          </button>
          <span
            v-if="userScriptsStatus !== 'ready' && userScriptsStatus !== 'checking'"
            class="conn-status conn-status--warn"
            :title="userScriptsStatus"
          >
            <span class="dot dot--off" />
            <span class="conn-status__text">脚本未就绪</span>
          </span>
          <button
            type="button"
            class="btn-icon"
            :class="{ 'is-active': settingsOpen }"
            title="设置"
            aria-label="设置"
            @click="settingsOpen ? closeSettings() : openSettings()"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <path
                d="M19.4 13a7.8 7.8 0 0 0 .05-2l2.05-1.6-2-3.46-2.45.8a7.6 7.6 0 0 0-1.73-1L15 3h-6l-.32 2.74a7.6 7.6 0 0 0-1.73 1l-2.45-.8-2 3.46L4.55 11a7.8 7.8 0 0 0 0 2l-2.05 1.6 2 3.46 2.45-.8a7.6 7.6 0 0 0 1.73 1L9 21h6l.32-2.74a7.6 7.6 0 0 0 1.73-1l2.45.8 2-3.46L19.4 13Z"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <!-- 全局设置面板 -->
      <section v-if="settingsOpen" class="settings-pane" aria-label="设置">
        <div class="settings-pane__header">
          <h2 class="settings-pane__title">设置</h2>
          <button type="button" class="btn-icon" aria-label="关闭设置" @click="closeSettings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="settings-pane__body">
          <div class="settings-block">
            <div class="settings-block__label">桌面端连接</div>
            <div class="settings-card">
              <div class="settings-card__row">
                <span
                  class="dot"
                  :class="{
                    'dot--on': bridgeStatus === 'connected',
                    'dot--off': bridgeStatus !== 'connected',
                    'dot--checking': bridgeStatus === 'checking',
                  }"
                />
                <span>{{ bridgeStatusTitle }}</span>
              </div>
              <button type="button" class="btn-ghost settings-card__action" @click="pingDesktop">
                重新检测
              </button>
            </div>
            <p class="settings-help">
              对话模式、模型与权限也可在对话顶栏切换（对齐桌面智能会话）。发布填表可不依赖桌面；素材入库需桌面在线。
            </p>
          </div>

          <div class="settings-block">
            <div class="settings-block__label">渠道脚本（User Scripts）</div>
            <div class="settings-card">
              <div class="settings-card__row">
                <span
                  class="dot"
                  :class="{
                    'dot--on': userScriptsStatus === 'ready',
                    'dot--off': userScriptsStatus !== 'ready' && userScriptsStatus !== 'checking',
                    'dot--checking': userScriptsStatus === 'checking',
                  }"
                />
                <span>
                  {{
                    userScriptsStatus === 'ready'
                      ? '用户脚本已就绪 · @脚本走此通道'
                      : userScriptsStatus === 'checking'
                        ? '检测中…'
                        : '未就绪 · 请按下方按钮开启'
                  }}
                </span>
              </div>
              <div
                v-if="userScriptsStatus !== 'ready' && userScriptsStatus !== 'checking'"
                style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px"
              >
                <button type="button" class="btn-ghost settings-card__action" @click="openExtensionDetails">
                  1. 打开扩展详情
                </button>
                <button type="button" class="btn-ghost settings-card__action" @click="reloadExtension">
                  2. 我已开启，重载扩展
                </button>
              </div>
            </div>
            <p class="settings-help" :title="userScriptsStatus">
              在详情页打开「允许运行用户脚本」（Allow User Scripts），再点「重载扩展」。
              脚本仍由桌面下发，无需打包。
              <template v-if="extensionId">
                <br />扩展 ID：{{ extensionId }}
              </template>
              <template v-if="lastScriptRuntime">
                <br />最近一次执行：{{
                  lastScriptRuntime === 'userScripts' ? 'User Scripts' : '调试执行 (debugger)'
                }}
              </template>
              <template v-if="userScriptsStatus !== 'ready' && userScriptsStatus !== 'checking'">
                <br />原因：{{ userScriptsStatus }}
              </template>
            </p>
            <label class="settings-card__row" style="margin-top: 8px; cursor: pointer; gap: 8px">
              <input
                type="checkbox"
                :checked="allowDebuggerFallback"
                @change="setDebuggerFallback(($event.target as HTMLInputElement).checked)"
              />
              <span>User Scripts 不可用时用调试执行（默认开，可先跑通 @脚本）</span>
            </label>
            <p class="settings-help">
              开启用户脚本后会优先走 User Scripts，不再附着调试器。调试回退可能增加风控风险，长期请打开上方开关。
            </p>
          </div>

          <div class="settings-block">
            <div class="settings-block__label">权限模式</div>
            <p class="settings-help" style="margin-top: 0">
              Agent 模式下在对话顶栏选择；此处为快捷入口。
            </p>
            <div
              class="ui-select ui-select--block"
              :class="{
                'is-open': openSelect === 'mode',
                'is-disabled':
                  bridgeStatus !== 'connected' ||
                  modesLoading ||
                  !permissionModes.length,
              }"
            >
              <button
                type="button"
                class="ui-select__trigger"
                aria-label="权限模式"
                :aria-expanded="openSelect === 'mode'"
                aria-haspopup="listbox"
                :title="permissionModeTitle"
                :disabled="
                  bridgeStatus !== 'connected' ||
                  modesLoading ||
                  !permissionModes.length
                "
                @click="toggleSelect('mode')"
              >
                <span class="ui-select__value">{{ permissionModeLabel }}</span>
                <span class="ui-select__chevron" aria-hidden="true" />
              </button>
              <ul v-if="openSelect === 'mode'" class="ui-select__menu" role="listbox">
                <li
                  v-for="m in permissionModes"
                  :key="m.id"
                  role="option"
                  :aria-selected="m.id === activePermissionValue"
                >
                  <button
                    type="button"
                    class="ui-select__option"
                    :class="{ 'is-active': m.id === activePermissionValue }"
                    :title="m.description"
                    @click="selectPermissionMode(m.id)"
                  >
                    {{ m.name }}
                  </button>
                </li>
              </ul>
            </div>
            <p class="settings-help">{{ permissionModeTitle }}</p>
          </div>
        </div>
      </section>

      <NavPanel v-else-if="appModule === 'nav'" />

      <PublishPanel
        v-else-if="appModule === 'publish'"
        :importable-content="importableAssistantContent"
      />

      <template v-else>
      <header class="top">
        <div class="chat-controls">
          <div
            class="ui-select ui-select--agent"
            :class="{
              'is-open': openSelect === 'agent',
              'is-disabled': bridgeStatus !== 'connected' || agentsLoading || sending,
            }"
          >
            <button
              type="button"
              class="ui-select__trigger"
              aria-label="选择角色"
              :aria-expanded="openSelect === 'agent'"
              aria-haspopup="listbox"
              :title="agentTitle"
              :disabled="bridgeStatus !== 'connected' || agentsLoading || sending"
              @click="toggleSelect('agent')"
            >
              <span class="ui-select__value">{{ agentLabel }}</span>
              <span class="ui-select__chevron" aria-hidden="true" />
            </button>
            <ul v-if="openSelect === 'agent'" class="ui-select__menu" role="listbox">
              <li v-if="!sessionBound" role="option" :aria-selected="!activeAgentValue">
                <button
                  type="button"
                  class="ui-select__option"
                  :class="{ 'is-active': !activeAgentValue }"
                  @click="pickAutoAgent"
                >
                  自动选角
                </button>
              </li>
              <li
                v-for="a in agents"
                :key="a.id"
                role="option"
                :aria-selected="activeAgentValue === a.id"
              >
                <button
                  type="button"
                  class="ui-select__option"
                  :class="{ 'is-active': activeAgentValue === a.id }"
                  :title="a.remark || a.slug"
                  @click="pickAgent(a.id)"
                >
                  {{ a.name }}
                </button>
              </li>
              <li v-if="!agents.length" class="ui-select__empty">
                暂无启用代理，请到桌面「代理管理」添加
              </li>
            </ul>
          </div>

          <div
            class="ui-select ui-select--mode"
            :class="{ 'is-open': openSelect === 'chatMode' }"
          >
            <button
              type="button"
              class="ui-select__trigger"
              aria-label="选择会话模式"
              :aria-expanded="openSelect === 'chatMode'"
              aria-haspopup="listbox"
              :disabled="sending"
              @click="toggleSelect('chatMode')"
            >
              <span class="ui-select__value">{{ chatModeLabel }}</span>
              <span class="ui-select__chevron" aria-hidden="true" />
            </button>
            <ul v-if="openSelect === 'chatMode'" class="ui-select__menu" role="listbox">
              <li
                v-for="opt in CHAT_MODE_OPTIONS"
                :key="opt.value"
                role="option"
                :aria-selected="opt.value === chatMode"
              >
                <button
                  type="button"
                  class="ui-select__option"
                  :class="{ 'is-active': opt.value === chatMode }"
                  @click="selectChatMode(opt.value)"
                >
                  {{ opt.label }}
                </button>
              </li>
            </ul>
          </div>

          <div
            class="ui-select ui-select--group"
            :class="{
              'is-open': openSelect === 'group',
              'is-disabled': bridgeStatus !== 'connected' || groupsLoading || sending,
            }"
          >
            <button
              type="button"
              class="ui-select__trigger"
              aria-label="选择会话分组"
              :aria-expanded="openSelect === 'group'"
              aria-haspopup="listbox"
              :title="groupTitle"
              :disabled="bridgeStatus !== 'connected' || groupsLoading || sending"
              @click="toggleSelect('group')"
            >
              <span class="ui-select__value">{{ groupLabel }}</span>
              <span class="ui-select__chevron" aria-hidden="true" />
            </button>
            <ul v-if="openSelect === 'group'" class="ui-select__menu" role="listbox">
              <li role="option" :aria-selected="!activeGroupValue">
                <button
                  type="button"
                  class="ui-select__option"
                  :class="{ 'is-active': !activeGroupValue }"
                  @click="pickGroup(null)"
                >
                  未分组
                </button>
              </li>
              <li
                v-for="g in sessionGroups"
                :key="g.id"
                role="option"
                :aria-selected="activeGroupValue === g.id"
              >
                <button
                  type="button"
                  class="ui-select__option"
                  :class="{ 'is-active': activeGroupValue === g.id }"
                  @click="pickGroup(g.id)"
                >
                  {{ g.name }}
                </button>
              </li>
              <li v-if="!sessionGroups.length" class="ui-select__empty">
                暂无自定义分组，可到桌面智能会话创建
              </li>
            </ul>
          </div>

          <div
            v-if="showPermission"
            class="ui-select ui-select--perm"
            :class="{
              'is-open': openSelect === 'mode',
              'is-disabled':
                bridgeStatus !== 'connected' ||
                modesLoading ||
                !permissionModes.length,
            }"
          >
            <button
              type="button"
              class="ui-select__trigger"
              aria-label="选择权限模式"
              :aria-expanded="openSelect === 'mode'"
              aria-haspopup="listbox"
              :title="permissionModeTitle"
              :disabled="
                bridgeStatus !== 'connected' ||
                modesLoading ||
                !permissionModes.length
              "
              @click="toggleSelect('mode')"
            >
              <span class="ui-select__value">{{ permissionModeLabel }}</span>
              <span class="ui-select__chevron" aria-hidden="true" />
            </button>
            <ul v-if="openSelect === 'mode'" class="ui-select__menu" role="listbox">
              <li
                v-for="m in permissionModes"
                :key="m.id"
                role="option"
                :aria-selected="m.id === activePermissionValue"
              >
                <button
                  type="button"
                  class="ui-select__option"
                  :class="{ 'is-active': m.id === activePermissionValue }"
                  :title="m.description"
                  @click="selectPermissionMode(m.id)"
                >
                  {{ m.name }}
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div class="actions">
          <button
            type="button"
            class="btn-icon"
            :class="{ 'is-active': panelView === 'history' }"
            :disabled="bridgeStatus !== 'connected'"
            title="最近会话"
            aria-label="最近会话"
            @click="panelView === 'history' ? closeHistory() : openHistory()"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h10"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            class="btn-icon"
            :disabled="sending"
            :title="newChatLabel"
            :aria-label="newChatLabel"
            @click="onNewChat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <!-- 历史会话：与桌面智能会话 session_list 同源 -->
      <section v-if="panelView === 'history'" class="history-pane" aria-label="最近会话">
        <div class="history-pane__header">
          <button type="button" class="btn-new-session" :disabled="sending" @click="onNewChat">
            <span class="btn-new-session__icon" aria-hidden="true">+</span>
            发起新会话
          </button>
        </div>
        <div class="history-pane__label">最近会话</div>
        <div v-if="sessionsLoading" class="history-empty">加载中…</div>
        <div v-else-if="!sessions.length" class="history-empty">
          暂无会话
          <span class="history-empty__hint">点击上方按钮开始</span>
        </div>
        <nav v-else class="session-list">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            :class="{
              'is-active': s.id === sessionId,
              'is-editing': editingSessionId === s.id,
              'is-menu-open': sessionMenuId === s.id,
              'is-pinned': s.pinned,
            }"
          >
            <template v-if="editingSessionId === s.id">
              <input
                class="session-item__input"
                :value="editTitleDraft"
                maxlength="80"
                aria-label="编辑会话标题"
                @input="editTitleDraft = ($event.target as HTMLInputElement).value"
                @keydown.enter.prevent="commitRenameSession"
                @keydown.esc.prevent="cancelRenameSession"
                @blur="commitRenameSession"
              />
            </template>
            <template v-else>
              <button
                type="button"
                class="session-item__main"
                @click="selectHistorySession(s.id)"
              >
                <span class="session-title">
                  <span
                    v-if="s.pinned"
                    class="session-title__pin"
                    aria-label="已置顶"
                    title="已置顶"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M16 4v6.5l2.5 2.5V14h-5v6l-1 1-1-1v-6H6.5v-1L9 10.5V4h7zm-1 1H10v5.8l-2.2 2.2h8.4L14 10.8V5z" />
                    </svg>
                  </span>
                  <span class="session-title__text">{{ displaySessionTitle(s.title) }}</span>
                </span>
                <span class="session-meta">
                  <span
                    class="session-meta__group"
                    :class="{ 'is-ungrouped': !s.group_id }"
                    :title="s.group_id ? '会话分组' : '未分组'"
                  >{{ groupNameOf(s.group_id) }}</span>
                  <span class="session-meta__count">{{ s.message_count }} 条</span>
                  <span v-if="s.updated_at || s.updated" class="session-meta__time">{{
                    formatSessionTime(s.updated_at || s.updated || 0)
                  }}</span>
                </span>
              </button>
              <div class="session-item__toolbar">
                <button
                  type="button"
                  class="session-item__more"
                  :aria-expanded="sessionMenuId === s.id"
                  aria-haspopup="menu"
                  title="更多"
                  @click.stop="toggleSessionMenu(s.id)"
                >
                  ⋯
                </button>
                <div
                  v-if="sessionMenuId === s.id"
                  class="session-item__menu"
                  role="menu"
                >
                  <button
                    type="button"
                    class="session-item__menu-item"
                    role="menuitem"
                    @click="togglePinSession(s.id, !!s.pinned)"
                  >
                    {{ s.pinned ? '取消置顶' : '置顶' }}
                  </button>
                  <button
                    type="button"
                    class="session-item__menu-item"
                    role="menuitem"
                    @click="startRenameSession(s.id, s.title)"
                  >
                    重命名
                  </button>
                  <div class="session-item__menu-sep" role="separator" />
                  <button
                    type="button"
                    class="session-item__menu-item is-danger"
                    role="menuitem"
                    @click="requestDeleteSession(s.id, s.title)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </template>
          </div>
        </nav>
      </section>

      <div v-show="panelView === 'chat'" class="chat-main">
        <div ref="listRef" class="messages">
        <div class="messages__inner">
          <div v-if="loadingSession" class="empty-state">
            <div class="spinner" />
            <p class="empty-state__hint">加载会话…</p>
          </div>

          <div v-else-if="!messages.length && !streamingContent && !sending" class="empty-state">
            <div class="empty-state__mark" aria-hidden="true" />
            <p class="empty-state__title">有什么可以帮你的？</p>
            <p class="empty-state__hint">{{ emptyHint }}</p>
          </div>

          <template v-else>
            <article
              v-for="m in messages"
              :key="m.id"
              class="message"
              :class="m.role === 'user' ? 'message--user' : 'message--assistant'"
            >
              <div
                v-if="m.role === 'user'"
                class="message-body message-body--bubble"
              >
                {{ displayUserContent(m.content) }}
              </div>
              <div v-else class="message-body message-body--assistant">
                <MarkdownContent :content="m.content" />
              </div>
            </article>

            <article
              v-if="sending || streamingContent"
              class="message message--assistant message--streaming"
            >
              <div v-if="!streamingContent" class="typing" aria-label="正在回复">
                <span /><span /><span />
              </div>
              <div v-else class="message-body message-body--assistant">
                <MarkdownContent :content="streamingContent" streaming />
              </div>
            </article>
          </template>
        </div>
        </div>
      </div>

      <button
        v-if="errorMsg"
        type="button"
        class="error"
        title="点击关闭"
        @click="errorMsg = ''"
      >
        {{ errorMsg }}
      </button>
      <!-- 对齐 ChatCMS 智能会话：底部卡片式输入 + 右下角发送 -->
      <div v-show="panelView === 'chat'" class="input-bar">
        <div class="composer">
          <div v-if="attachments.length" class="composer__chips">
            <button
              v-for="a in attachments"
              :key="`${a.kind}:${a.id}`"
              type="button"
              class="composer__chip"
              :class="`composer__chip--${a.kind}`"
              title="点击移除"
              @click="removeAttachment(a)"
            >
              <span class="composer__chip-kind">{{
                a.kind === 'script' ? '脚本' : a.kind === 'skill' ? '技能' : 'MCP'
              }}</span>
              {{ a.label }}
              <span class="composer__chip-x" aria-hidden>×</span>
            </button>
          </div>
          <div class="composer__body">
            <div class="composer__input-wrap">
              <MentionPicker
                :open="mentionOpen"
                :query="mentionQuery"
                :agent-id="activeAgentValue"
                :exclude-keys="attachments.map((a) => `${a.kind}:${a.id}`)"
                @pick="onPickMention"
                @close="closeMention"
              />
              <textarea
                ref="textareaRef"
                class="input-textarea"
                :value="input"
                rows="1"
                :placeholder="composerPlaceholder"
                :disabled="bridgeStatus !== 'connected' || sending"
                @input="onComposerInput"
                @click="
                  syncMentionFromValue(
                    input,
                    ($event.target as HTMLTextAreaElement).selectionStart ?? 0,
                  )
                "
                @keydown="onKeydown"
              />
            </div>
            <button
              type="button"
              class="btn-send"
              :disabled="!canSend"
              aria-label="发送"
              @click="onSend"
            >
              <span v-if="sending" class="btn-send__dots">…</span>
              <svg
                v-else
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
          <div
            class="composer__footer"
            :class="{
              'composer__footer--open': openSelect === 'model',
            }"
          >
            <div class="composer__tools">
              <div
                class="ui-select ui-select--up ui-select--model"
                :class="{ 'is-open': openSelect === 'model' }"
              >
                <button
                  type="button"
                  class="ui-select__trigger"
                  aria-label="选择模型"
                  :aria-expanded="openSelect === 'model'"
                  aria-haspopup="listbox"
                  :disabled="bridgeStatus !== 'connected' || modelLoading"
                  @click="toggleSelect('model')"
                >
                  <span class="ui-select__value">{{ modelLabel }}</span>
                  <span class="ui-select__chevron" aria-hidden="true" />
                </button>
                <ul v-if="openSelect === 'model'" class="ui-select__menu" role="listbox">
                  <li role="option" :aria-selected="autoModel">
                    <button
                      type="button"
                      class="ui-select__option"
                      :class="{ 'is-active': autoModel }"
                      @click="pickAutoModel"
                    >
                      Auto
                    </button>
                  </li>
                  <li
                    v-for="p in modelProfiles"
                    :key="p.id"
                    role="option"
                    :aria-selected="!autoModel && p.id === activeProfileId"
                  >
                    <button
                      type="button"
                      class="ui-select__option"
                      :class="{ 'is-active': !autoModel && p.id === activeProfileId }"
                      @click="pickModelProfile(p.id)"
                    >
                      {{ p.name }}{{ p.thinking ? ' · 思考' : '' }}
                    </button>
                  </li>
                  <li v-if="!modelProfiles.length" class="ui-select__empty">
                    暂无配置，请到桌面「模型」页添加
                  </li>
                </ul>
              </div>
            </div>
            <span class="composer__hint">Enter 发送</span>
          </div>
        </div>
      </div>
      </template>

      <div v-if="pendingDelete" class="dialog-mask" @click.self="!deletingSession && (pendingDelete = null)">
        <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title">
          <h2 id="del-title" class="dialog__title">删除会话？</h2>
          <p class="dialog__body">
            将永久删除「{{ pendingDelete.title }}」，此操作与桌面智能会话同步，无法撤销。
          </p>
          <div class="dialog__actions">
            <button
              type="button"
              class="btn-ghost"
              :disabled="deletingSession"
              @click="pendingDelete = null"
            >
              取消
            </button>
            <button
              type="button"
              class="btn-danger"
              :disabled="deletingSession"
              @click="confirmDeleteSession"
            >
              {{ deletingSession ? '删除中…' : '删除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ChatCMS 深色主题 token（与桌面端 tokens.css 对齐） */
.root {
  --bg-1: #0e1015;
  --bg-2: #191c24;
  --bg-3: #1f2330;
  --border: #2e3040;
  --text: #d4d4d8;
  --text-dim: #8b8b94;
  --accent: #ff5c5c;
  --accent-hover: #ff7070;
  --ok: #22c55e;
  --danger: #ef4444;
  --danger-text: #ff8e8e;
  --warn: #f59e0b;
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.28);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  position: relative;
  flex: 1;
  height: 100%;
  width: 100%;
  min-height: 0;
  font-family: var(--font-body);
  color: var(--text);
  background: var(--bg-1);
}

.panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 92, 92, 0.06), transparent),
    var(--bg-1);
  color: var(--text);
}

.app-chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 4px 8px 4px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-1);
  position: relative;
  z-index: 40;
}

.app-chrome__tabs {
  flex: 1;
  min-width: 0;
}

.app-chrome__right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.conn-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 96px;
  height: 28px;
  padding: 0 6px 0 5px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-family: inherit;
}

.conn-status:hover {
  background: var(--bg-3);
  color: var(--text);
}

.conn-status--warn {
  max-width: 110px;
  color: #b45309;
  cursor: help;
}

.conn-status__text {
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 6px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--bg-2) 55%, transparent);
  position: relative;
  z-index: 30;
  overflow: visible;
}

.top:has(.ui-select.is-open) {
  z-index: 50;
}

.chat-controls {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
  flex: 1;
  flex-wrap: nowrap;
  overflow: visible;
}

.chat-controls .ui-select {
  max-width: 108px;
  min-width: 68px;
  flex: 0 1 auto;
}

.chat-controls .ui-select--agent {
  max-width: 128px;
  min-width: 76px;
}

.chat-controls .ui-select--group {
  max-width: 100px;
  min-width: 64px;
}

.chat-controls .ui-select--perm {
  max-width: 108px;
}

.ui-select__empty {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-dim);
  list-style: none;
}

.settings-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.settings-pane__title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.settings-pane__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-block__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.settings-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-2);
}

.settings-card__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12.5px;
  color: var(--text);
}

.settings-card__action {
  flex-shrink: 0;
}

.settings-help {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-dim);
}

.ui-select--block {
  width: 100%;
  max-width: none;
}

.ui-select--block .ui-select__trigger {
  width: 100%;
}

.actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-text {
  font-size: 12px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition:
    background 140ms var(--ease-out),
    color 140ms var(--ease-out),
    border-color 140ms var(--ease-out);
}

.btn-icon:hover:not(:disabled) {
  background: var(--bg-3);
  color: var(--text);
}

.btn-icon.is-active {
  background: var(--bg-3);
  color: var(--text);
  border-color: var(--border);
}

.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.history-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-pane__header {
  padding: 12px 12px 8px;
  flex-shrink: 0;
}

.btn-new-session {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed color-mix(in srgb, var(--border) 80%, var(--text-dim));
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-2) 80%, transparent);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 140ms var(--ease-out),
    border-color 140ms var(--ease-out);
}

.btn-new-session:hover:not(:disabled) {
  background: var(--bg-3);
  border-color: var(--text-dim);
}

.btn-new-session:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-new-session__icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
}

.history-pane__label {
  padding: 4px 16px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
  flex-shrink: 0;
}

.history-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-dim);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-empty__hint {
  font-size: 12px;
  opacity: 0.8;
}

.session-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 8px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-item {
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: 10px;
  min-height: 52px;
}

.session-item:hover,
.session-item.is-menu-open {
  background: var(--bg-2);
}

.session-item.is-active {
  background: var(--bg-3);
}

.session-item.is-editing {
  background: var(--bg-3);
  padding: 6px 8px;
}

.session-item__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 8px 10px 10px;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.session-title {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.session-title__pin {
  flex-shrink: 0;
  color: var(--accent);
  display: inline-flex;
}

.session-title__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.35;
  color: var(--text);
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-dim);
  width: 100%;
  min-width: 0;
}

.session-meta__group {
  flex-shrink: 1;
  min-width: 0;
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-1));
  color: color-mix(in srgb, var(--accent) 75%, var(--text));
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.session-meta__group.is-ungrouped {
  border-color: var(--border);
  background: var(--bg-1);
  color: var(--text-dim);
  font-weight: 500;
}

.session-meta__count {
  flex-shrink: 0;
  opacity: 0.85;
}

.session-meta__time {
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

.session-item__toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding-right: 4px;
  position: relative;
}

.session-item__more {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  opacity: 0;
  transition: opacity 120ms var(--ease-out), background 120ms var(--ease-out);
}

.session-item:hover .session-item__more,
.session-item.is-menu-open .session-item__more {
  opacity: 1;
}

.session-item__more:hover {
  background: var(--bg-1);
  color: var(--text);
}

.session-item__menu {
  position: absolute;
  top: 100%;
  right: 4px;
  z-index: 40;
  min-width: 132px;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-item__menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.session-item__menu-item:hover {
  background: var(--bg-3);
}

.session-item__menu-item.is-danger {
  color: var(--danger-text);
}

.session-item__menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--border);
}

.session-item__input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-1);
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.session-item__input:focus {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
}

.dialog-mask {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.55);
}

.dialog {
  width: min(100%, 320px);
  padding: 18px 16px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  box-shadow: var(--shadow-md);
}

.dialog__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 650;
}

.dialog__body {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-dim);
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-danger {
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--danger);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-ghost {
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
}

.btn-ghost:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-3);
}

.btn-ghost:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--on {
  background: var(--ok);
  box-shadow: 0 0 6px color-mix(in srgb, var(--ok) 60%, transparent);
}

.dot--off {
  background: #555;
}

.dot--checking {
  background: var(--accent);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.4;
  }
}

.messages {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scroll-behavior: smooth;
  padding: 12px 0 4px;
}

.chat-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-main .messages {
  flex: 1 1 auto;
  min-height: 0;
}

.messages__inner {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 16px 20px;
  box-sizing: border-box;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex: 1;
  min-height: 220px;
  text-align: center;
  padding: 28px 16px;
  animation: message-in 220ms var(--ease-out);
}

.empty-state__mark {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  margin-bottom: 4px;
  background:
    radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 55%),
    linear-gradient(145deg, var(--bg-3), var(--bg-2));
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
}

.empty-state__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
  line-height: 1.3;
}

.empty-state__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  max-width: 280px;
  color: var(--text-dim);
}

.empty-state__cta {
  margin-top: 6px;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 12.5px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
}

.empty-state__cta:hover {
  background: var(--accent-hover);
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message {
  width: 100%;
  animation: message-in 160ms var(--ease-out);
}

.message--user {
  display: flex;
  justify-content: flex-end;
}

.message--assistant {
  display: flex;
  justify-content: flex-start;
}

.message-body {
  max-width: 100%;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.message-body--bubble {
  max-width: min(88%, 420px);
  padding: 10px 14px;
  border-radius: 18px 18px 6px 18px;
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-3));
  color: var(--text);
  white-space: pre-wrap;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset;
}

.message-body--assistant {
  width: 100%;
  min-width: 0;
  padding: 2px 2px 0;
}

.message--streaming .message-body--assistant {
  min-height: 1.65em;
}

.typing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 4px;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-dim);
  opacity: 0.55;
  animation: typing-bounce 1.1s ease-in-out infinite;
}

.typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-3px);
    opacity: 0.95;
  }
}

.error {
  display: block;
  width: calc(100% - 28px);
  margin: 0 14px 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-2));
  color: var(--danger-text);
  font-size: 12.5px;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
  animation: message-in 160ms var(--ease-out);
}

.error:hover {
  border-color: color-mix(in srgb, var(--danger) 50%, var(--border));
}

/* ── Composer（对齐 ChatCMS / 行业常见底部输入卡） ── */
.input-bar {
  flex-shrink: 0;
  margin-top: auto;
  padding: 6px 12px 12px;
  overflow: visible;
  background: linear-gradient(
    180deg,
    transparent 0%,
    color-mix(in srgb, var(--bg-1) 70%, transparent) 28%,
    var(--bg-1) 100%
  );
}

.composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 10px 12px 8px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  box-shadow: var(--shadow-md);
  overflow: visible;
  transition:
    border-color 140ms var(--ease-out),
    box-shadow 140ms var(--ease-out);
}

.composer:focus-within {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow:
    var(--shadow-md),
    0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.composer__body {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.composer__input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.composer__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 2px 2px;
}

.composer__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px 0 4px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-1);
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.composer__chip-kind {
  padding: 2px 5px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 650;
}

.composer__chip--script .composer__chip-kind {
  background: color-mix(in srgb, #0d9488 18%, transparent);
  color: #0f766e;
}

.composer__chip--skill .composer__chip-kind {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}

.composer__chip--mcp .composer__chip-kind {
  background: color-mix(in srgb, #d97706 18%, transparent);
  color: #b45309;
}

.composer__chip-x {
  opacity: 0.45;
  font-size: 14px;
}

.input-textarea {
  width: 100%;
  min-height: 24px;
  max-height: 160px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  padding: 8px 0;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.45;
  resize: none;
  overflow-y: auto;
}

.input-textarea::placeholder {
  color: color-mix(in srgb, var(--text-dim) 85%, transparent);
}

.input-textarea:disabled {
  opacity: 0.5;
}

.btn-send {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition:
    background 140ms var(--ease-out),
    transform 140ms var(--ease-out),
    opacity 140ms var(--ease-out);
}

.btn-send:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.btn-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.btn-send__dots {
  font-size: 16px;
  line-height: 1;
}

.composer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
  padding-top: 4px;
  position: relative;
  z-index: 21;
}

.composer__footer--open {
  z-index: 40;
}

.composer__tools {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
}

.ui-select {
  position: relative;
  width: fit-content;
  max-width: 96px;
}

.composer__tools .ui-select--model {
  max-width: 120px;
  min-width: 72px;
}

.ui-select--mode {
  max-width: 112px;
}

.ui-select.is-open {
  z-index: 41;
}

.ui-select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  min-height: 28px;
  max-width: 100%;
  padding: 0 8px 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-1);
  color: var(--text-dim);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.ui-select__trigger:hover:not(:disabled),
.ui-select.is-open .ui-select__trigger {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--bg-3) 70%, var(--bg-1));
}

.ui-select__trigger:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ui-select__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.ui-select__chevron {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  background: no-repeat center / contain
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b8b94' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  transition: transform 140ms var(--ease-out);
}

.ui-select.is-open .ui-select__chevron {
  transform: rotate(180deg);
}

.ui-select__menu {
  position: absolute;
  left: 0;
  right: auto;
  z-index: 50;
  min-width: 100%;
  width: max-content;
  max-width: 168px;
  margin: 0;
  padding: 4px;
  list-style: none;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  box-shadow: var(--shadow-md);
  /* 顶部工具栏默认向下 */
  top: calc(100% + 6px);
  bottom: auto;
}

.ui-select__menu--end {
  left: auto;
  right: 0;
}

/* 底部会话框下拉统一向上展开 */
.ui-select--up .ui-select__menu {
  top: auto;
  bottom: calc(100% + 6px);
}

.ui-select__option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.ui-select__option:hover {
  background: var(--bg-3);
}

.ui-select__option.is-active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.composer__hint {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-dim);
  user-select: none;
  white-space: nowrap;
  opacity: 0.85;
}
</style>
