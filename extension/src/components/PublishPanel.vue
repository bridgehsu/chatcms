<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { PlatformRunState } from '../shared/platforms'
import type { PublishKind } from '../shared/platforms'
import {
  createContentNote,
  fetchContentNotes,
  fetchFactoryImages,
  fetchFactoryVideos,
  uploadToFactory,
  type BridgeMediaItem,
  type BridgeNote,
  type BridgeNoteGroup,
} from '../shared/publishContent'
import {
  DEFAULT_PUBLISH_DRAFT,
  defaultPlatformIdsForKind,
  loadPublishDraft,
  savePublishDraft,
  type PublishDraft,
  type PublishType,
} from '../shared/publishDraft'
import {
  loadPublishPlatforms,
  type PublishPlatformView,
} from '../shared/publishSync'

const props = defineProps<{
  importableContent: string
}>()

/** 各类型默认展示的常用平台（其余收进「更多」） */
const PREFERRED_IDS: Record<PublishKind, string[]> = {
  dynamic: [
    'DYNAMIC_REDNOTE',
    'DYNAMIC_DOUYIN',
    'DYNAMIC_WEIBO',
    'DYNAMIC_BILIBILI',
    'DYNAMIC_WEIXINCHANNEL',
    'DYNAMIC_ZHIHU',
    'DYNAMIC_KUAISHOU',
  ],
  video: [
    'VIDEO_REDNOTE',
    'VIDEO_DOUYIN',
    'VIDEO_BILIBILI',
    'VIDEO_WEIXINCHANNEL',
    'VIDEO_KUAISHOU',
    'VIDEO_ZHIHU',
  ],
  article: [
    'ARTICLE_WEIXIN',
    'ARTICLE_ZHIHU',
    'ARTICLE_JUEJIN',
    'ARTICLE_CSDN',
    'ARTICLE_TOUTIAO',
    'ARTICLE_JIANSHU',
  ],
  podcast: [
    'PODCAST_XIMALAYA',
    'PODCAST_XIAOYUZHOU',
    'PODCAST_QQMUSIC',
    'PODCAST_NETEASE',
  ],
}

const TYPE_TABS: { value: PublishType; title: string }[] = [
  { value: 'dynamic', title: '动态' },
  { value: 'video', title: '视频' },
  { value: 'podcast', title: '播客' },
  { value: 'article', title: '文章' },
]

type PublishOutcome = {
  filled: number
  opened: number
  failed: number
  /** null = 来自内容管理，无需入库；true/false = 手输入库结果 */
  savedToContent: boolean | null
  saveError?: string
  message: string
}

const draft = ref<PublishDraft>(DEFAULT_PUBLISH_DRAFT())
const ready = ref(false)
const phase = ref<'edit' | 'running' | 'done'>('edit')
const hint = ref('')
const outcome = ref<PublishOutcome | null>(null)
const runStates = ref<Record<string, PlatformRunState>>({})
const bodyRef = ref<HTMLTextAreaElement | null>(null)
const platforms = ref<PublishPlatformView[]>([])
const bridgeOk = ref(false)

const notes = ref<BridgeNote[]>([])
const noteGroups = ref<BridgeNoteGroup[]>([])
const notesLoading = ref(false)
const noteQuery = ref('')
/** all | ungrouped | 具体 group_id */
const noteGroupFilter = ref<string>('all')

const showMediaPicker = ref(false)
const mediaTab = ref<'image' | 'video'>('image')
const factoryImages = ref<BridgeMediaItem[]>([])
const factoryVideos = ref<BridgeMediaItem[]>([])
const mediaLoading = ref(false)
const uploading = ref(false)
const showAllPlatforms = ref(false)

const imageInputRef = ref<HTMLInputElement | null>(null)
const videoInputRef = ref<HTMLInputElement | null>(null)

/** 未选笔记且非手输 → 浏览笔记列表 */
const isBrowseNotes = computed(
  () =>
    draft.value.contentSource === 'note' &&
    !draft.value.noteId &&
    phase.value !== 'running',
)

const sortedGroups = computed(() =>
  [...noteGroups.value].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'zh'),
  ),
)

const ungroupedCount = computed(
  () => notes.value.filter((n) => !n.group_id).length,
)

const groupChips = computed(() => {
  const chips: { id: string; label: string; count: number }[] = [
    { id: 'all', label: '全部', count: notes.value.length },
  ]
  if (ungroupedCount.value > 0 || sortedGroups.value.length > 0) {
    chips.push({ id: 'ungrouped', label: '未分组', count: ungroupedCount.value })
  }
  for (const g of sortedGroups.value) {
    const count = notes.value.filter((n) => n.group_id === g.id).length
    chips.push({ id: g.id, label: g.name, count })
  }
  return chips
})

const groupNameById = computed(() => {
  const map = new Map<string, string>()
  for (const g of noteGroups.value) map.set(g.id, g.name)
  return map
})

function noteGroupLabel(n: BridgeNote): string {
  if (!n.group_id) return '未分组'
  return groupNameById.value.get(n.group_id) || '未分组'
}

const filteredNotes = computed(() => {
  const q = noteQuery.value.trim().toLowerCase()
  const filter = noteGroupFilter.value
  let list = notes.value
  if (filter === 'ungrouped') {
    list = list.filter((n) => !n.group_id)
  } else if (filter !== 'all') {
    list = list.filter((n) => n.group_id === filter)
  }
  if (q) {
    list = list.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        noteGroupLabel(n).toLowerCase().includes(q),
    )
  }
  return [...list]
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    .slice(0, 50)
})

const preferredSet = computed(() => new Set(PREFERRED_IDS[draft.value.type] || []))

const slimPlatforms = computed(() => {
  const selected = new Set(draft.value.platformIds)
  return platforms.value.filter(
    (p) =>
      preferredSet.value.has(p.id) ||
      p.hasScript ||
      selected.has(p.id),
  )
})

const extraPlatforms = computed(() => {
  const slimIds = new Set(slimPlatforms.value.map((p) => p.id))
  return platforms.value.filter((p) => !slimIds.has(p.id))
})

const visiblePlatforms = computed(() =>
  showAllPlatforms.value
    ? [...slimPlatforms.value, ...extraPlatforms.value]
    : slimPlatforms.value,
)

const selectedPlatformChips = computed(() => {
  const map = new Map(platforms.value.map((p) => [p.id, p.name]))
  return draft.value.platformIds
    .map((id) => map.get(id) || id)
    .filter(Boolean)
})

const mediaBarLabel = computed(() => {
  if (draft.value.type === 'video') {
    return draft.value.videoUrls.length
      ? `素材 · 视频 ${draft.value.videoUrls.length}`
      : '选择素材'
  }
  const n = draft.value.imageUrls.length
  return n ? `素材 · 图 ${n}` : '选择素材'
})

const needsImages = computed(() =>
  draft.value.platformIds.some((id) => id === 'DYNAMIC_REDNOTE'),
)

const needsVideos = computed(() => draft.value.type === 'video')

const canSubmit = computed(() => {
  const hasBody =
    draft.value.body.trim().length > 0 || draft.value.title.trim().length > 0
  if (isBrowseNotes.value) return false
  return (
    hasBody &&
    draft.value.platformIds.length > 0 &&
    phase.value !== 'running' &&
    (!needsImages.value || draft.value.imageUrls.length > 0) &&
    (!needsVideos.value || draft.value.videoUrls.length > 0)
  )
})

const canImport = computed(
  () => props.importableContent.trim().length > 0 && phase.value !== 'running',
)

const contentBanner = computed(() => {
  if (draft.value.contentSource === 'manual') {
    return '填表成功后写入内容管理'
  }
  if (draft.value.noteId) {
    return draft.value.noteTitle || '未命名'
  }
  return ''
})

const hasSelectedMedia = computed(
  () => draft.value.imageUrls.length > 0 || draft.value.videoUrls.length > 0,
)

watch(
  draft,
  (d) => {
    if (!ready.value) return
    void savePublishDraft(d)
  },
  { deep: true },
)

async function refreshPlatforms(kind: PublishKind) {
  const loaded = await loadPublishPlatforms(kind)
  platforms.value = loaded.platforms
  bridgeOk.value = loaded.bridgeOk
  const allowed = new Set(platforms.value.map((p) => p.id))
  draft.value.platformIds = draft.value.platformIds.filter((id) => allowed.has(id))
  if (!draft.value.platformIds.length) {
    draft.value.platformIds = defaultPlatformIdsForKind(kind).filter((id) =>
      allowed.has(id),
    )
  }
  showAllPlatforms.value = false
}

async function loadNotes() {
  notesLoading.value = true
  try {
    const bundle = await fetchContentNotes()
    notes.value = bundle.notes
    noteGroups.value = bundle.groups
    // 当前筛选的分组若已不存在，回退到全部
    if (
      noteGroupFilter.value !== 'all' &&
      noteGroupFilter.value !== 'ungrouped' &&
      !bundle.groups.some((g) => g.id === noteGroupFilter.value)
    ) {
      noteGroupFilter.value = 'all'
    }
    bridgeOk.value = true
  } catch (e) {
    hint.value = e instanceof Error ? e.message : String(e)
    bridgeOk.value = false
  } finally {
    notesLoading.value = false
  }
}

onMounted(async () => {
  draft.value = await loadPublishDraft()
  // 进页默认走内容管理浏览；若本地草稿已是手输且有正文则保留
  if (
    draft.value.contentSource === 'manual' &&
    (draft.value.title.trim() || draft.value.body.trim())
  ) {
    /* keep manual draft */
  } else if (!draft.value.noteId) {
    draft.value.contentSource = 'note'
  }
  await refreshPlatforms(draft.value.type)
  await loadNotes()
  ready.value = true
})

async function selectType(t: PublishType) {
  if (phase.value === 'running') return
  if (draft.value.type === t) return
  draft.value.type = t
  runStates.value = {}
  outcome.value = null
  hint.value = ''
  await refreshPlatforms(t)
}

function startBlankWrite() {
  if (phase.value === 'running') return
  draft.value.contentSource = 'manual'
  draft.value.noteId = null
  draft.value.noteTitle = ''
  draft.value.title = ''
  draft.value.body = ''
  outcome.value = null
  hint.value = ''
  void bodyRef.value?.focus()
}

function selectNote(n: BridgeNote) {
  draft.value.noteId = n.id
  draft.value.noteTitle = n.title || '未命名'
  draft.value.title = n.title || ''
  draft.value.body = n.content || ''
  draft.value.contentSource = 'note'
  outcome.value = null
  hint.value = ''
  void bodyRef.value?.focus()
}

function backToNotes() {
  if (phase.value === 'running') return
  draft.value.contentSource = 'note'
  draft.value.noteId = null
  draft.value.noteTitle = ''
  draft.value.title = ''
  draft.value.body = ''
  outcome.value = null
  phase.value = 'edit'
  runStates.value = {}
  showMediaPicker.value = false
  void loadNotes()
}

function togglePlatform(id: string) {
  if (phase.value === 'running') return
  const set = new Set(draft.value.platformIds)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  draft.value.platformIds = [...set]
}

function platformStatus(id: string): PlatformRunState['status'] {
  return runStates.value[id]?.status ?? 'idle'
}

function statusLabel(id: string) {
  const s = platformStatus(id)
  if (s === 'queued') return '排队'
  if (s === 'opening') return '打开中'
  if (s === 'filling') return '填表中'
  if (s === 'done') return '已填表'
  if (s === 'no_script') return '已开页'
  if (s === 'error') return runStates.value[id]?.error || '失败'
  return ''
}

function platformMeta(p: PublishPlatformView) {
  if (p.id === 'DYNAMIC_REDNOTE') return '自动'
  if (p.hasScript) return p.scriptVersion > 0 ? `v${p.scriptVersion}` : '脚本'
  return '开页'
}

function importFromSession() {
  const text = props.importableContent.trim()
  if (!text) return
  draft.value.contentSource = 'manual'
  draft.value.noteId = null
  draft.value.noteTitle = ''
  draft.value.body = text
  outcome.value = null
  hint.value = ''
  void bodyRef.value?.focus()
}

async function openMediaPicker() {
  showMediaPicker.value = true
  mediaTab.value = draft.value.type === 'video' ? 'video' : 'image'
  await loadMediaTab(mediaTab.value)
}

async function loadMediaTab(tab: 'image' | 'video') {
  mediaTab.value = tab
  mediaLoading.value = true
  try {
    if (tab === 'image') {
      factoryImages.value = await fetchFactoryImages()
    } else {
      factoryVideos.value = await fetchFactoryVideos()
    }
  } catch (e) {
    hint.value = e instanceof Error ? e.message : String(e)
  } finally {
    mediaLoading.value = false
  }
}

function toggleFactoryImage(item: BridgeMediaItem) {
  if (draft.value.imageIds.includes(item.id) || draft.value.imageUrls.includes(item.url)) {
    draft.value.imageIds = draft.value.imageIds.filter((id) => id !== item.id)
    draft.value.imageUrls = draft.value.imageUrls.filter((u) => u !== item.url)
  } else {
    draft.value.imageIds = [...draft.value.imageIds, item.id]
    draft.value.imageUrls = [...draft.value.imageUrls, item.url]
  }
}

function toggleFactoryVideo(item: BridgeMediaItem) {
  if (draft.value.videoIds.includes(item.id) || draft.value.videoUrls.includes(item.url)) {
    draft.value.videoIds = draft.value.videoIds.filter((id) => id !== item.id)
    draft.value.videoUrls = draft.value.videoUrls.filter((u) => u !== item.url)
  } else {
    draft.value.videoIds = [...draft.value.videoIds, item.id]
    draft.value.videoUrls = [...draft.value.videoUrls, item.url]
  }
}

function removeImageAt(i: number) {
  const url = draft.value.imageUrls[i]
  draft.value.imageUrls = draft.value.imageUrls.filter((_, idx) => idx !== i)
  const id = draft.value.imageIds.find((x) => url.includes(x))
  if (id) draft.value.imageIds = draft.value.imageIds.filter((x) => x !== id)
}

function removeVideoAt(i: number) {
  const url = draft.value.videoUrls[i]
  draft.value.videoUrls = draft.value.videoUrls.filter((_, idx) => idx !== i)
  const id = draft.value.videoIds.find((x) => url.includes(x))
  if (id) draft.value.videoIds = draft.value.videoIds.filter((x) => x !== id)
}

function triggerUpload() {
  if (mediaTab.value === 'image') imageInputRef.value?.click()
  else videoInputRef.value?.click()
}

async function onLocalFiles(kind: 'image' | 'video', ev: Event) {
  const input = ev.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  uploading.value = true
  try {
    for (const file of files.slice(0, 8)) {
      const item = await uploadToFactory(file, kind)
      if (kind === 'image') {
        if (!draft.value.imageIds.includes(item.id)) {
          draft.value.imageIds = [...draft.value.imageIds, item.id]
          draft.value.imageUrls = [...draft.value.imageUrls, item.url]
        }
      } else if (!draft.value.videoIds.includes(item.id)) {
        draft.value.videoIds = [...draft.value.videoIds, item.id]
        draft.value.videoUrls = [...draft.value.videoUrls, item.url]
      }
    }
    await loadMediaTab(kind)
    hint.value = `已上传并入库${kind === 'image' ? '图片' : '视频'}工厂`
  } catch (e) {
    hint.value = e instanceof Error ? e.message : String(e)
  } finally {
    uploading.value = false
  }
}

async function saveManualToContent(): Promise<void> {
  const title =
    draft.value.title.trim() ||
    draft.value.body.trim().slice(0, 40) ||
    '未命名发布'
  const content = [draft.value.title.trim(), draft.value.body.trim()]
    .filter(Boolean)
    .join('\n\n')
  const note = await createContentNote({ title, content })
  draft.value.noteId = note.id
  draft.value.noteTitle = note.title
}

async function startPublish() {
  if (!canSubmit.value) {
    if (isBrowseNotes.value) {
      hint.value = '请先选择一篇笔记，或点「空白手写」'
    } else if (!draft.value.body.trim() && !draft.value.title.trim()) {
      hint.value = '请填写标题或正文'
    } else if (!draft.value.platformIds.length) {
      hint.value = '请至少选择一个平台'
    } else if (needsImages.value && !draft.value.imageUrls.length) {
      hint.value = '小红书图文需要配图'
      void openMediaPicker()
    } else if (needsVideos.value && !draft.value.videoUrls.length) {
      hint.value = '视频类型需要选择视频'
      void openMediaPicker()
    }
    return
  }

  const ids = [...draft.value.platformIds]
  const selected = platforms.value
    .filter((p) => ids.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, injectUrl: p.injectUrl }))

  const next: Record<string, PlatformRunState> = {}
  for (const id of ids) next[id] = { id, status: 'queued' }
  runStates.value = next
  phase.value = 'running'
  outcome.value = null
  hint.value = ''
  showMediaPicker.value = false

  try {
    await navigator.clipboard.writeText(
      draft.value.body.trim() || draft.value.title.trim(),
    )
  } catch {
    /* ignore */
  }

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'OPEN_PUBLISH_TABS',
      payload: {
        content: draft.value.body.trim(),
        title: draft.value.title.trim(),
        imageUrls: [...draft.value.imageUrls],
        isAutoPublish: false,
        platforms: selected,
      },
    })

    if (!res?.ok) throw new Error(res?.error || '发布失败')

    const results = (res.results || []) as {
      id: string
      ok: boolean
      status?: 'done' | 'no_script' | 'error'
      tabId?: number
      error?: string
    }[]

    for (const r of results) {
      runStates.value[r.id] = {
        id: r.id,
        status: r.status || (r.ok ? 'done' : 'error'),
        tabId: r.tabId,
        error: r.error,
      }
    }

    const failed = results.filter((r) => !r.ok).length
    const filled = results.filter((r) => r.status === 'done').length
    const opened = results.filter((r) => r.status === 'no_script').length
    const errMsg = results.find((r) => !r.ok)?.error
    let message = ''
    if (failed > 0 && filled + opened === 0) {
      message = errMsg || '全部失败'
    } else if (failed > 0) {
      message = `已填表 ${filled} · 开页 ${opened} · 失败 ${failed}`
    } else if (opened > 0 && filled === 0) {
      message = `已打开 ${opened} 个平台页，请手动确认`
    } else {
      message = `已填表 ${filled} 个平台，请到创作者页确认发布`
    }

    const anyOk = results.some((r) => r.ok)
    let savedToContent: boolean | null = null
    let saveError: string | undefined
    if (draft.value.contentSource === 'manual' && anyOk) {
      // 手输：成功开页/填表后入库；已有 noteId（再次填表）则跳过
      if (draft.value.noteId) {
        savedToContent = true
      } else {
        try {
          await saveManualToContent()
          savedToContent = true
        } catch (e) {
          savedToContent = false
          saveError = e instanceof Error ? e.message : String(e)
        }
      }
    }

    outcome.value = {
      filled,
      opened,
      failed,
      savedToContent,
      saveError,
      message,
    }
    phase.value = 'done'
  } catch (e) {
    phase.value = 'edit'
    hint.value = e instanceof Error ? e.message : String(e)
    for (const id of ids) {
      if (runStates.value[id]?.status === 'queued') {
        runStates.value[id] = { id, status: 'error', error: '未执行' }
      }
    }
  }
}

function formatNoteTime(ms: number) {
  if (!ms) return ''
  const d = new Date(ms)
  const now = Date.now()
  const diff = now - ms
  if (diff < 86_400_000) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function resetPhase() {
  phase.value = 'edit'
  runStates.value = {}
  outcome.value = null
  hint.value = ''
}
</script>

<template>
  <section class="publish" aria-label="发布">
    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      multiple
      hidden
      @change="onLocalFiles('image', $event)"
    />
    <input
      ref="videoInputRef"
      type="file"
      accept="video/*"
      multiple
      hidden
      @change="onLocalFiles('video', $event)"
    />

    <div class="publish__scroll">
      <header class="publish-top">
        <div class="type-seg" role="tablist" aria-label="内容类型">
          <button
            v-for="opt in TYPE_TABS"
            :key="opt.value"
            type="button"
            class="type-seg__btn"
            :class="{ 'is-active': draft.type === opt.value }"
            :title="opt.title"
            :aria-label="opt.title"
            :disabled="phase === 'running'"
            @click="selectType(opt.value)"
          >
            {{ opt.title }}
          </button>
        </div>
      </header>

      <!-- 成功态 -->
      <div
        v-if="outcome && phase === 'done'"
        class="result-bar"
        :class="{
          'result-bar--ok': outcome.failed === 0,
          'result-bar--warn': outcome.failed > 0 && outcome.filled + outcome.opened > 0,
          'result-bar--err': outcome.failed > 0 && outcome.filled + outcome.opened === 0,
        }"
      >
        <div class="result-bar__row">
          <span class="result-bar__dot" aria-hidden="true" />
          <div class="result-bar__body">
            <div class="result-bar__title">{{ outcome.message }}</div>
            <div class="result-bar__meta">
              <span class="stat">填表 {{ outcome.filled }}</span>
              <span class="stat">开页 {{ outcome.opened }}</span>
              <span v-if="outcome.failed" class="stat stat--bad">失败 {{ outcome.failed }}</span>
            </div>
            <div v-if="outcome.savedToContent === true" class="result-bar__save is-ok">
              已写入内容管理
            </div>
            <div v-else-if="outcome.savedToContent === false" class="result-bar__save is-err">
              写入内容管理失败{{ outcome.saveError ? `：${outcome.saveError}` : '' }}
            </div>
            <div v-else-if="draft.contentSource === 'note'" class="result-bar__save">
              内容来自内容管理，未另存
            </div>
          </div>
        </div>
      </div>

      <!-- 浏览：笔记列表 -->
      <template v-if="isBrowseNotes">
        <div class="browse-card">
          <div class="browse-head">
            <div>
              <div class="browse-head__title">内容管理</div>
              <div class="browse-head__sub">选择一篇笔记开始发布</div>
            </div>
            <button
              type="button"
              class="btn-accent-ghost"
              :disabled="phase === 'running'"
              @click="startBlankWrite"
            >
              空白手写
            </button>
          </div>
          <div class="search-wrap">
            <svg class="search-wrap__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                fill="currentColor"
                d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              />
            </svg>
            <input
              v-model="noteQuery"
              class="search"
              type="search"
              placeholder="搜索笔记标题或正文…"
              :disabled="notesLoading"
            />
          </div>
          <div
            v-if="groupChips.length > 1"
            class="group-chips"
            role="tablist"
            aria-label="笔记分组"
          >
            <button
              v-for="chip in groupChips"
              :key="chip.id"
              type="button"
              role="tab"
              class="group-chip"
              :class="{ 'is-active': noteGroupFilter === chip.id }"
              :aria-selected="noteGroupFilter === chip.id"
              :disabled="notesLoading"
              @click="noteGroupFilter = chip.id"
            >
              <span class="group-chip__label">{{ chip.label }}</span>
              <span class="group-chip__count">{{ chip.count }}</span>
            </button>
          </div>
        </div>
        <p v-if="notesLoading" class="empty">加载中…</p>
        <p v-else-if="!bridgeOk" class="empty empty--warn">桌面未连接，无法读取内容管理</p>
        <p v-else-if="!filteredNotes.length" class="empty">
          {{
            noteQuery.trim() || noteGroupFilter !== 'all'
              ? '该筛选下暂无笔记'
              : '暂无笔记 · 可点「空白手写」开始'
          }}
        </p>
        <div v-else class="note-list">
          <button
            v-for="n in filteredNotes"
            :key="n.id"
            type="button"
            class="note-item"
            @click="selectNote(n)"
          >
            <span class="note-item__icon" aria-hidden="true">{{ n.icon || '📄' }}</span>
            <span class="note-item__main">
              <span class="note-item__top">
                <span class="note-item__title">{{ n.title || '未命名' }}</span>
                <span class="note-item__time">{{ formatNoteTime(n.updated_at) }}</span>
              </span>
              <span class="note-item__meta">
                <span class="note-item__group">{{ noteGroupLabel(n) }}</span>
                <span class="note-item__preview">{{ n.content.slice(0, 64) || '（无正文）' }}</span>
              </span>
            </span>
          </button>
        </div>
      </template>

      <!-- 编辑工作区 -->
      <template v-else>
        <div class="content-banner">
          <span
            class="content-banner__badge"
            :class="draft.contentSource === 'manual' ? 'is-manual' : 'is-note'"
          >
            {{ draft.contentSource === 'manual' ? '手写' : '笔记' }}
          </span>
          <span class="content-banner__text">{{ contentBanner }}</span>
          <button
            type="button"
            class="btn-text"
            :disabled="phase === 'running'"
            @click="backToNotes"
          >
            重选
          </button>
        </div>

        <div class="editor-shell">
          <input
            v-model="draft.title"
            class="editor-title"
            type="text"
            maxlength="80"
            placeholder="标题（可选）"
            :disabled="phase === 'running'"
          />
          <div class="editor-shell__rule" aria-hidden="true" />
          <textarea
            ref="bodyRef"
            v-model="draft.body"
            class="editor-body"
            rows="6"
            placeholder="正文…"
            :disabled="phase === 'running'"
          />
        </div>

        <!-- 统一素材入口 -->
        <button
          type="button"
          class="media-entry"
          :class="{ 'has-media': hasSelectedMedia }"
          :disabled="phase === 'running' || uploading"
          @click="openMediaPicker"
        >
          <span class="media-entry__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
              />
            </svg>
          </span>
          <span class="media-entry__copy">
            <span class="media-entry__label">{{ mediaBarLabel }}</span>
            <span class="media-entry__hint">工厂选择 · 上传入库</span>
          </span>
          <span class="media-entry__chev" aria-hidden="true">›</span>
        </button>

        <div v-if="draft.imageUrls.length" class="selected-row">
          <div class="media-grid media-grid--sm">
            <div
              v-for="(url, i) in draft.imageUrls"
              :key="url + i"
              class="media-thumb is-selected"
            >
              <img :src="url" alt="" />
              <button type="button" class="media-thumb__x" @click="removeImageAt(i)">
                ×
              </button>
            </div>
          </div>
        </div>
        <div v-if="draft.videoUrls.length" class="selected-row">
          <div
            v-for="(url, i) in draft.videoUrls"
            :key="url + i"
            class="chip"
          >
            <span>{{ url.split('/').pop() }}</span>
            <button type="button" class="btn-text" @click="removeVideoAt(i)">移除</button>
          </div>
        </div>

        <!-- 平台精简列表 -->
        <div class="section">
          <div class="section__head">
            <span class="section__label">发布平台</span>
            <span class="section__meta">已选 {{ draft.platformIds.length }}</span>
          </div>
          <div v-if="selectedPlatformChips.length" class="chips">
            <span v-for="name in selectedPlatformChips" :key="name" class="chip chip--static">
              {{ name }}
            </span>
          </div>
          <div class="platform-grid">
            <button
              v-for="p in visiblePlatforms"
              :key="p.id"
              type="button"
              class="platform-item"
              :class="{
                'is-selected': draft.platformIds.includes(p.id),
                [`is-${platformStatus(p.id)}`]: platformStatus(p.id) !== 'idle',
              }"
              :disabled="phase === 'running'"
              @click="togglePlatform(p.id)"
            >
              <span class="platform-item__check" aria-hidden="true">
                {{ draft.platformIds.includes(p.id) ? '✓' : '' }}
              </span>
              <span class="platform-item__copy">
                <span class="platform-name">{{ p.name }}</span>
                <span class="platform-status">{{
                  statusLabel(p.id) || platformMeta(p)
                }}</span>
              </span>
            </button>
          </div>
          <button
            v-if="extraPlatforms.length"
            type="button"
            class="more-btn"
            :disabled="phase === 'running'"
            @click="showAllPlatforms = !showAllPlatforms"
          >
            {{
              showAllPlatforms
                ? '收起更多平台'
                : `更多平台（${extraPlatforms.length}）`
            }}
          </button>
        </div>
      </template>

      <p v-if="hint" class="hint">{{ hint }}</p>
    </div>

    <footer class="publish__footer">
      <button
        type="button"
        class="btn-ghost"
        :disabled="!canImport || showMediaPicker"
        @click="importFromSession"
      >
        从会话导入
      </button>
      <button
        v-if="phase === 'done'"
        type="button"
        class="btn-primary"
        :disabled="showMediaPicker"
        @click="resetPhase"
      >
        再次填表
      </button>
      <button
        v-else
        type="button"
        class="btn-primary"
        :disabled="!canSubmit || showMediaPicker"
        @click="startPublish"
      >
        {{ phase === 'running' ? '填表中…' : '开始填表' }}
      </button>
    </footer>

    <!-- 素材选择：全幅浮层，避免挤在编辑区小框里 -->
    <div
      v-if="showMediaPicker"
      class="media-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="选择素材"
    >
      <button
        type="button"
        class="media-sheet__backdrop"
        aria-label="关闭"
        @click="showMediaPicker = false"
      />
      <div class="media-sheet__panel">
        <div class="media-sheet__grab" aria-hidden="true" />
        <div class="picker-panel__head">
          <div class="seg">
            <button
              type="button"
              class="seg__btn"
              :class="{ 'is-active': mediaTab === 'image' }"
              @click="loadMediaTab('image')"
            >
              图片工厂
            </button>
            <button
              type="button"
              class="seg__btn"
              :class="{ 'is-active': mediaTab === 'video' }"
              @click="loadMediaTab('video')"
            >
              视频工厂
            </button>
          </div>
          <button type="button" class="btn-text" @click="showMediaPicker = false">
            关闭
          </button>
        </div>
        <button
          type="button"
          class="upload-row"
          :disabled="uploading"
          @click="triggerUpload"
        >
          {{ uploading ? '上传中…' : `＋ 上传到${mediaTab === 'image' ? '图片' : '视频'}工厂` }}
        </button>
        <div class="media-sheet__body">
          <p v-if="mediaLoading" class="empty">加载中…</p>
          <div v-else-if="mediaTab === 'image'" class="media-grid media-grid--picker">
            <button
              v-for="img in factoryImages"
              :key="img.id"
              type="button"
              class="media-thumb"
              :class="{
                'is-selected':
                  draft.imageIds.includes(img.id) || draft.imageUrls.includes(img.url),
              }"
              :title="img.title"
              @click="toggleFactoryImage(img)"
            >
              <img :src="img.url" :alt="img.title" loading="lazy" />
              <span
                v-if="draft.imageIds.includes(img.id) || draft.imageUrls.includes(img.url)"
                class="media-thumb__check"
              >✓</span>
            </button>
            <p v-if="!factoryImages.length" class="empty">暂无图片，可先上传</p>
          </div>
          <div v-else class="video-picker-list">
            <button
              v-for="vid in factoryVideos"
              :key="vid.id"
              type="button"
              class="video-picker-item"
              :class="{
                'is-active':
                  draft.videoIds.includes(vid.id) || draft.videoUrls.includes(vid.url),
              }"
              @click="toggleFactoryVideo(vid)"
            >
              <span class="video-picker-item__icon" aria-hidden="true">▶</span>
              <span class="video-picker-item__main">
                <span class="video-picker-item__title">{{ vid.title }}</span>
                <span class="video-picker-item__id">{{ vid.id }}</span>
              </span>
              <span
                v-if="draft.videoIds.includes(vid.id) || draft.videoUrls.includes(vid.url)"
                class="video-picker-item__check"
              >✓</span>
            </button>
            <p v-if="!factoryVideos.length" class="empty">暂无视频，可先上传</p>
          </div>
        </div>
        <div class="media-sheet__footer">
          <span class="media-sheet__count">
            已选图 {{ draft.imageUrls.length }} · 视频 {{ draft.videoUrls.length }}
          </span>
          <button type="button" class="btn-primary btn-primary--sm" @click="showMediaPicker = false">
            完成
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.publish {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 90% 40% at 50% -10%, rgba(255, 92, 92, 0.05), transparent 55%),
    transparent;
}

.publish__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.publish-top {
  display: flex;
  align-items: center;
}

.type-seg {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  width: 100%;
  padding: 3px;
  border-radius: 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  gap: 2px;
}

.type-seg__btn {
  height: 32px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  font-family: inherit;
  transition:
    background 160ms var(--ease-out),
    color 160ms var(--ease-out),
    box-shadow 160ms var(--ease-out);
}

.type-seg__btn:hover:not(:disabled):not(.is-active) {
  color: var(--text);
  background: color-mix(in srgb, var(--bg-3) 70%, transparent);
}

.type-seg__btn.is-active {
  background: color-mix(in srgb, var(--bg-3) 75%, var(--accent) 12%);
  color: var(--text);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent);
}

.type-seg__btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.result-bar {
  padding: 12px 12px 12px 10px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  animation: pub-in 220ms var(--ease-out);
}

.result-bar__row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.result-bar__dot {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-dim);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-dim) 18%, transparent);
}

.result-bar--ok .result-bar__dot {
  background: var(--ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 22%, transparent);
}

.result-bar--warn .result-bar__dot {
  background: var(--warn);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 22%, transparent);
}

.result-bar--err .result-bar__dot {
  background: var(--danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 22%, transparent);
}

.result-bar--ok {
  border-color: color-mix(in srgb, var(--ok) 35%, var(--border));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ok) 10%, var(--bg-2)),
    var(--bg-2)
  );
}

.result-bar--warn {
  border-color: color-mix(in srgb, var(--warn) 35%, var(--border));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--warn) 8%, var(--bg-2)),
    var(--bg-2)
  );
}

.result-bar--err {
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--danger) 8%, var(--bg-2)),
    var(--bg-2)
  );
}

.result-bar__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.result-bar__title {
  font-size: 13px;
  font-weight: 650;
  color: var(--text);
  line-height: 1.35;
}

.result-bar__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.stat {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-3) 80%, transparent);
  border: 1px solid var(--border);
}

.stat--bad {
  color: var(--danger-text);
  border-color: color-mix(in srgb, var(--danger) 35%, var(--border));
}

.result-bar__save {
  font-size: 12px;
  color: var(--text-dim);
}

.result-bar__save.is-ok {
  color: var(--ok);
  font-weight: 600;
}

.result-bar__save.is-err {
  color: var(--danger-text);
}

.browse-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: linear-gradient(
    160deg,
    color-mix(in srgb, var(--accent) 7%, var(--bg-2)),
    var(--bg-2) 55%
  );
}

.browse-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.browse-head__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.01em;
}

.browse-head__sub {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--text-dim);
}

.btn-accent-ghost {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: color-mix(in srgb, var(--accent) 85%, #fff);
  font-size: 12px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 140ms var(--ease-out), border-color 140ms var(--ease-out);
}

.btn-accent-ghost:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.btn-accent-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-wrap__icon {
  position: absolute;
  left: 10px;
  color: var(--text-dim);
  pointer-events: none;
}

.search {
  width: 100%;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-1) 55%, var(--bg-3));
  color: var(--text);
  padding: 0 10px 0 30px;
  font-size: 12.5px;
  font-family: inherit;
  transition: border-color 140ms var(--ease-out);
}

.search::placeholder {
  color: color-mix(in srgb, var(--text-dim) 85%, transparent);
}

.search:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}

.group-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 1px 1px 2px;
  margin: 0 -2px;
  scrollbar-width: thin;
}

.group-chips::-webkit-scrollbar {
  height: 3px;
}

.group-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-1) 40%, var(--bg-3));
  color: var(--text-dim);
  font-size: 11.5px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 140ms var(--ease-out),
    border-color 140ms var(--ease-out),
    color 140ms var(--ease-out);
}

.group-chip:hover:not(:disabled):not(.is-active) {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

.group-chip.is-active {
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-3));
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
}

.group-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.group-chip__count {
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg-1) 50%, transparent);
  color: var(--text-dim);
}

.group-chip.is-active .group-chip__count {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: color-mix(in srgb, var(--accent) 90%, #fff);
}

.note-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 140ms var(--ease-out),
    background 140ms var(--ease-out),
    transform 140ms var(--ease-out);
}

.note-item:hover,
.note-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  background: color-mix(in srgb, var(--accent) 7%, var(--bg-3));
}

.note-item:active {
  transform: scale(0.992);
}

.note-item--compact {
  padding: 9px 10px;
}

.note-item__icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 15px;
  background: color-mix(in srgb, var(--bg-3) 80%, var(--accent) 8%);
  border: 1px solid var(--border);
}

.note-item__main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.note-item__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.note-item__title {
  font-size: 13px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-item__time {
  font-size: 10.5px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.note-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.note-item__group {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 650;
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--text-dim);
  background: color-mix(in srgb, var(--bg-3) 85%, transparent);
  border: 1px solid var(--border);
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-item__preview {
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.content-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
}

.content-banner__badge {
  flex-shrink: 0;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
}

.content-banner__badge.is-note {
  color: color-mix(in srgb, var(--accent) 90%, #fff);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.content-banner__badge.is-manual {
  color: #93c5fd;
  background: color-mix(in srgb, #3b82f6 14%, transparent);
  border: 1px solid color-mix(in srgb, #3b82f6 28%, transparent);
}

.content-banner__text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-shell {
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 0;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 3%, transparent);
}

.editor-title {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 15px;
  font-weight: 650;
  font-family: inherit;
  padding: 2px 0 10px;
}

.editor-shell__rule {
  height: 1px;
  background: var(--border);
  margin: 0 0 10px;
}

.editor-body {
  width: 100%;
  min-height: 100px;
  border: none;
  outline: none;
  resize: vertical;
  background: transparent;
  color: var(--text);
  font-size: 13.5px;
  line-height: 1.6;
  font-family: inherit;
}

.editor-title::placeholder,
.editor-body::placeholder {
  color: color-mix(in srgb, var(--text-dim) 80%, transparent);
  font-weight: 400;
}

.media-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px dashed color-mix(in srgb, var(--accent) 32%, var(--border));
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--accent) 9%, var(--bg-2)),
    var(--bg-2)
  );
  color: var(--text);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 140ms var(--ease-out),
    background 140ms var(--ease-out),
    transform 140ms var(--ease-out);
}

.media-entry:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
  transform: translateY(-1px);
}

.media-entry.has-media {
  border-style: solid;
}

.media-entry__icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: color-mix(in srgb, var(--accent) 88%, #fff);
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-3));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
}

.media-entry__copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.media-entry__label {
  font-size: 13px;
  font-weight: 650;
}

.media-entry__hint {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-dim);
}

.media-entry__chev {
  color: var(--text-dim);
  font-size: 18px;
  line-height: 1;
}

.media-entry:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.picker-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.media-sheet {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  animation: pub-in 180ms var(--ease-out);
}

.media-sheet__backdrop {
  position: absolute;
  inset: 0;
  border: none;
  padding: 0;
  margin: 0;
  background: rgba(8, 10, 14, 0.55);
  cursor: pointer;
}

.media-sheet__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: min(78%, 560px);
  min-height: 360px;
  max-height: calc(100% - 28px);
  padding: 8px 12px 12px;
  border-radius: 16px 16px 0 0;
  border: 1px solid var(--border);
  border-bottom: none;
  background: var(--bg-2);
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.35);
}

.media-sheet__grab {
  width: 36px;
  height: 4px;
  margin: 2px auto 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-dim) 45%, transparent);
  flex-shrink: 0;
}

.media-sheet__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 0 4px;
}

.media-sheet__footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.media-sheet__count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
}

.btn-primary--sm {
  min-width: 88px;
  height: 34px;
  font-size: 12.5px;
  box-shadow: none;
}

.seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 9px;
  background: var(--bg-3);
  border: 1px solid var(--border);
}

.seg__btn {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
}

.seg__btn.is-active {
  background: color-mix(in srgb, var(--bg-2) 70%, var(--accent) 10%);
  color: var(--text);
}

.upload-row {
  flex-shrink: 0;
  height: 36px;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  color: color-mix(in srgb, var(--accent) 80%, var(--text));
  font-size: 12.5px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition: background 140ms var(--ease-out);
}

.upload-row:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.upload-row:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.media-grid--picker {
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.media-grid--sm {
  grid-template-columns: repeat(4, 1fr);
}

.media-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  padding: 0;
  background: var(--bg-3);
  cursor: pointer;
  transition: border-color 140ms var(--ease-out), transform 140ms var(--ease-out);
}

.media-grid--picker .media-thumb {
  min-height: 120px;
}

.media-thumb:hover {
  transform: scale(1.015);
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-thumb.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
}

.media-thumb__check {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.media-thumb__x {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.video-picker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.video-picker-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 140ms var(--ease-out), background 140ms var(--ease-out);
}

.video-picker-item:hover,
.video-picker-item.is-active {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-3));
}

.video-picker-item__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-dim);
  background: var(--bg-2);
  border: 1px solid var(--border);
}

.video-picker-item.is-active .video-picker-item__icon {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.video-picker-item__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.video-picker-item__title {
  font-size: 13.5px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-picker-item__id {
  font-size: 11px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-picker-item__check {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
}

.selected-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 2px;
}

.section__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.section__meta {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-dim);
}

.chip--static {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-2));
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
  color: var(--text);
  font-weight: 600;
}

.platform-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.platform-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 140ms var(--ease-out),
    background 140ms var(--ease-out);
}

.platform-item:hover:not(:disabled) {
  background: var(--bg-3);
}

.platform-item.is-selected {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  background: color-mix(in srgb, var(--accent) 9%, var(--bg-3));
}

.platform-item.is-done {
  border-color: color-mix(in srgb, var(--ok) 42%, var(--border));
}

.platform-item.is-error {
  border-color: color-mix(in srgb, var(--danger) 42%, var(--border));
}

.platform-item__check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: transparent;
  background: var(--bg-3);
  border: 1px solid var(--border);
}

.platform-item.is-selected .platform-item__check {
  color: #fff;
  background: var(--accent);
  border-color: var(--accent);
}

.platform-item__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.platform-name {
  font-size: 12.5px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-status {
  font-size: 10.5px;
  color: var(--text-dim);
}

.platform-item.is-done .platform-status {
  color: var(--ok);
}

.platform-item.is-error .platform-status {
  color: var(--danger-text);
}

.more-btn {
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition: color 140ms var(--ease-out), background 140ms var(--ease-out);
}

.more-btn:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-3);
}

.empty {
  margin: 0;
  padding: 16px 8px;
  font-size: 12.5px;
  color: var(--text-dim);
  text-align: center;
}

.empty--warn {
  color: var(--warn);
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-dim);
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--bg-2);
  border: 1px solid var(--border);
}

.publish__footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 14px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-1) 88%, var(--bg-2));
  backdrop-filter: blur(8px);
}

.btn-ghost,
.btn-text {
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: color 140ms var(--ease-out), background 140ms var(--ease-out);
}

.btn-text {
  padding: 4px 6px;
  font-size: 12px;
  flex-shrink: 0;
}

.btn-ghost:hover:not(:disabled),
.btn-text:hover:not(:disabled) {
  color: var(--text);
  background: var(--bg-3);
}

.btn-ghost:disabled,
.btn-text:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  min-width: 112px;
  height: 38px;
  padding: 0 16px;
  border: none;
  border-radius: 11px;
  background: linear-gradient(180deg, var(--accent-hover), var(--accent));
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 28%, transparent);
  transition: filter 140ms var(--ease-out), transform 140ms var(--ease-out);
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
  filter: none;
}

@keyframes pub-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
