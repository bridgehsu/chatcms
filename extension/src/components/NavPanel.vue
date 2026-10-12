<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { BRIDGE_BASE } from '../shared/bridge'
import {
  FAVORITES_SECTION_ID,
  type MapLink,
  type MapNavView,
} from '../shared/mapNav'

const COLLAPSE_KEY = 'chatcms.mapNav.collapsed'

type FormMode = 'list' | 'add' | 'edit'

const favorites = ref<MapLink[]>([])
const sections = ref<
  {
    id: string
    title: string
    locked: boolean
    collapsed: boolean
    links: MapLink[]
  }[]
>([])
const loading = ref(false)
const error = ref('')
const hint = ref('')
const mode = ref<FormMode>('list')
const busy = ref(false)
const query = ref('')
const collapsed = reactive<Record<string, boolean>>({})

const formSectionId = ref(FAVORITES_SECTION_ID)
const editing = ref<{ sectionId: string; link: MapLink } | null>(null)
const form = ref({
  title: '',
  url: '',
  desc: '',
  mark: '',
})

const formTitle = computed(() =>
  mode.value === 'edit' ? '编辑入口' : '添加入口',
)

const sectionOptions = computed(() => [
  { id: FAVORITES_SECTION_ID, title: '常用工具' },
  ...sections.value.map((s) => ({
    id: s.id,
    title: s.locked ? `${s.title}（锁定）` : s.title,
  })),
])

const isEmpty = computed(
  () => favorites.value.length === 0 && sections.value.length === 0,
)

const queryNorm = computed(() => query.value.trim().toLowerCase())
const isSearching = computed(() => queryNorm.value.length > 0)

function matchLink(link: MapLink, q: string) {
  const hay = [link.title, link.desc, link.mark, link.url || '']
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

const filteredFavorites = computed(() => {
  const q = queryNorm.value
  if (!q) return favorites.value
  return favorites.value.filter((l) => matchLink(l, q))
})

const filteredSections = computed(() => {
  const q = queryNorm.value
  if (!q) return sections.value
  return sections.value
    .map((s) => ({
      ...s,
      links: s.links.filter((l) => matchLink(l, q)),
    }))
    .filter((s) => s.links.length > 0 || s.title.toLowerCase().includes(q))
})

const searchEmpty = computed(() => {
  if (!isSearching.value) return false
  return (
    filteredFavorites.value.length === 0 && filteredSections.value.length === 0
  )
})

const TONE_CLASS: Record<string, string> = {
  red: 'tone-red',
  teal: 'tone-teal',
  amber: 'tone-amber',
  blue: 'tone-blue',
  violet: 'tone-violet',
  slate: 'tone-slate',
}

function toneClass(tone?: string | null) {
  if (!tone) return 'tone-slate'
  return TONE_CLASS[tone] || 'tone-slate'
}

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, boolean>
    Object.assign(collapsed, parsed)
  } catch {
    /* ignore */
  }
}

function persistCollapsed() {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify({ ...collapsed }))
  } catch {
    /* ignore */
  }
}

function isCollapsed(id: string, fallback = false) {
  // 搜索时强制展开，便于看到命中项
  if (isSearching.value) return false
  return collapsed[id] ?? fallback
}

function clearQuery() {
  query.value = ''
}

function toggleSection(id: string, fallback = false) {
  collapsed[id] = !isCollapsed(id, fallback)
  persistCollapsed()
}

async function refresh() {
  loading.value = true
  error.value = ''
  hint.value = ''
  try {
    const res = await fetch(`${BRIDGE_BASE}/map`)
    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
    const data = (await res.json()) as MapNavView
    favorites.value = Array.isArray(data.favorites) ? data.favorites : []
    sections.value = Array.isArray(data.sections)
      ? data.sections.map((s) => ({
          id: s.id,
          title: s.title,
          locked: !!s.locked,
          collapsed: !!s.collapsed,
          links: Array.isArray(s.links) ? s.links : [],
        }))
      : []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    if (/Failed to fetch|NetworkError|Load failed/i.test(error.value)) {
      error.value = '无法连接桌面端，请先打开 ChatCMS'
    }
    favorites.value = []
    sections.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCollapsed()
  void refresh()
})

function openAdd(sectionId = FAVORITES_SECTION_ID) {
  editing.value = null
  formSectionId.value = sectionId
  form.value = { title: '', url: '', desc: '', mark: '' }
  hint.value = ''
  mode.value = 'add'
}

function openEdit(sectionId: string, link: MapLink) {
  editing.value = { sectionId, link }
  formSectionId.value = sectionId
  form.value = {
    title: link.title,
    url: link.url || '',
    desc: link.desc || '',
    mark: link.mark || '',
  }
  hint.value = ''
  mode.value = 'edit'
}

function cancelForm() {
  mode.value = 'list'
  editing.value = null
  hint.value = ''
}

async function saveForm() {
  const title = form.value.title.trim()
  if (!title) {
    hint.value = '请填写名称'
    return
  }
  busy.value = true
  hint.value = ''
  try {
    const isEdit = mode.value === 'edit' && editing.value
    const sectionId = isEdit
      ? editing.value!.sectionId
      : formSectionId.value
    const endpoint = isEdit
      ? `${BRIDGE_BASE}/map/links/${encodeURIComponent(editing.value!.link.id)}`
      : `${BRIDGE_BASE}/map/links`
    const res = await fetch(endpoint, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_id: sectionId,
        title,
        desc: form.value.desc.trim(),
        mark: form.value.mark.trim(),
        url: form.value.url.trim() || null,
      }),
    })
    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
    mode.value = 'list'
    editing.value = null
    await refresh()
    hint.value = isEdit ? '已保存' : '已添加'
  } catch (e) {
    hint.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function removeLink(sectionId: string, link: MapLink) {
  if (!confirm(`删除「${link.title}」？`)) return
  busy.value = true
  try {
    const qs = new URLSearchParams({ section_id: sectionId })
    const res = await fetch(
      `${BRIDGE_BASE}/map/links/${encodeURIComponent(link.id)}?${qs}`,
      { method: 'DELETE' },
    )
    if (!res.ok && res.status !== 204) {
      throw new Error((await res.text()) || `HTTP ${res.status}`)
    }
    if (editing.value?.link.id === link.id) cancelForm()
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function openableUrl(url?: string | null): string | null {
  const u = (url || '').trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  return null
}

async function openLink(link: MapLink) {
  const url = openableUrl(link.url)
  if (!url) {
    hint.value = link.url?.startsWith('#/')
      ? '该入口仅桌面端可用'
      : '该入口没有可打开的网页链接'
    return
  }
  try {
    await chrome.tabs.create({ url, active: true })
  } catch (e) {
    hint.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <section class="nav" aria-label="导航">
    <!-- Tab 已标明模块；此处只放搜索与操作 -->
    <header v-if="mode === 'list'" class="nav__toolbar">
      <div class="nav__search">
        <input
          v-model="query"
          class="nav__search-input"
          type="search"
          placeholder="搜索工具、网站…"
          autocomplete="off"
          aria-label="搜索导航"
          :disabled="isEmpty && !loading"
        />
        <button
          v-if="query"
          type="button"
          class="nav__search-clear"
          aria-label="清除"
          @click="clearQuery"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        class="btn btn--ghost"
        :disabled="loading"
        title="刷新"
        @click="refresh"
      >
        刷新
      </button>
      <button type="button" class="btn btn--primary" @click="openAdd()">
        添加
      </button>
    </header>
    <header v-else class="nav__toolbar nav__toolbar--form">
      <button type="button" class="btn btn--ghost" :disabled="busy" @click="cancelForm">
        返回
      </button>
      <span class="nav__toolbar-label">{{ formTitle }}</span>
    </header>

    <div class="nav__body">
      <div v-if="error" class="nav__banner nav__banner--err">{{ error }}</div>
      <div v-else-if="hint && mode === 'list'" class="nav__banner nav__banner--ok">
        {{ hint }}
      </div>

      <template v-if="mode === 'list'">
        <div v-if="loading" class="nav__state">加载中…</div>
        <div v-else-if="isEmpty" class="nav__state">
          <strong>暂无数据</strong>
          <span>请先在桌面打开「业务地图」，或点击右上角添加</span>
        </div>
        <div v-else-if="searchEmpty" class="nav__state">
          <strong>无匹配结果</strong>
          <span>试试其他关键词</span>
        </div>

        <template v-else>
          <!-- 常用工具：磁贴网格 -->
          <section v-if="filteredFavorites.length || !isSearching" class="block">
            <div class="block__head">
              <h2 class="block__label">常用工具</h2>
              <span v-if="isSearching" class="block__count">{{ filteredFavorites.length }}</span>
              <button
                type="button"
                class="block__action"
                @click="openAdd(FAVORITES_SECTION_ID)"
              >
                +
              </button>
            </div>
            <div v-if="!filteredFavorites.length" class="block__empty">
              {{ isSearching ? '无匹配工具' : '暂无常用工具' }}
            </div>
            <div v-else class="tiles">
              <div v-for="link in filteredFavorites" :key="link.id" class="tile">
                <button
                  type="button"
                  class="tile__hit"
                  :title="link.desc || link.title"
                  @click="openLink(link)"
                >
                  <span class="tile__mark" :class="toneClass(link.tone)">
                    {{ link.mark || '·' }}
                  </span>
                  <span class="tile__name">{{ link.title }}</span>
                </button>
                <div class="tile__menu">
                  <button type="button" @click="openEdit(FAVORITES_SECTION_ID, link)">
                    编辑
                  </button>
                  <button
                    type="button"
                    class="is-danger"
                    :disabled="busy"
                    @click="removeLink(FAVORITES_SECTION_ID, link)"
                  >
                    删
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- 分类 -->
          <section
            v-for="sec in filteredSections"
            :key="sec.id"
            class="block"
            :class="{ 'is-collapsed': isCollapsed(sec.id, sec.collapsed) }"
          >
            <div class="block__head block__head--folder">
              <button
                type="button"
                class="block__toggle"
                :aria-expanded="!isCollapsed(sec.id, sec.collapsed)"
                @click="toggleSection(sec.id, sec.collapsed)"
              >
                <span class="block__chev" aria-hidden="true">
                  {{ isCollapsed(sec.id, sec.collapsed) ? '▸' : '▾' }}
                </span>
                <h2 class="block__label">{{ sec.title }}</h2>
                <span v-if="sec.locked" class="block__lock" title="桌面已锁定">锁</span>
                <span class="block__count">{{ sec.links.length }}</span>
              </button>
              <button
                type="button"
                class="block__action"
                title="添加网站"
                @click="openAdd(sec.id)"
              >
                +
              </button>
            </div>

            <div v-show="!isCollapsed(sec.id, sec.collapsed)" class="block__list">
              <div v-if="!sec.links.length" class="block__empty">暂无网站</div>
              <div v-else class="tiles">
                <div v-for="link in sec.links" :key="link.id" class="tile">
                  <button
                    type="button"
                    class="tile__hit"
                    :title="link.desc || link.title"
                    @click="openLink(link)"
                  >
                    <span class="tile__mark" :class="toneClass(link.tone)">
                      {{ link.mark || '·' }}
                    </span>
                    <span class="tile__name">{{ link.title }}</span>
                  </button>
                  <div class="tile__menu">
                    <button type="button" @click="openEdit(sec.id, link)">编辑</button>
                    <button
                      type="button"
                      class="is-danger"
                      :disabled="busy"
                      @click="removeLink(sec.id, link)"
                    >
                      删
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </template>
      </template>

      <form v-else class="form" @submit.prevent="saveForm">
        <label v-if="mode === 'add'" class="field">
          <span class="field__label">归属</span>
          <select v-model="formSectionId" class="field__control">
            <option v-for="opt in sectionOptions" :key="opt.id" :value="opt.id">
              {{ opt.title }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">名称</span>
          <input
            v-model="form.title"
            class="field__control"
            type="text"
            placeholder="如：小红书创作者中心"
            required
          />
        </label>
        <label class="field">
          <span class="field__label">链接</span>
          <input
            v-model="form.url"
            class="field__control"
            type="url"
            placeholder="https://…（可选）"
          />
        </label>
        <label class="field">
          <span class="field__label">描述</span>
          <input
            v-model="form.desc"
            class="field__control"
            type="text"
            placeholder="可选"
          />
        </label>
        <label class="field">
          <span class="field__label">角标</span>
          <input
            v-model="form.mark"
            class="field__control"
            type="text"
            maxlength="2"
            placeholder="1–2 字，默认标题首字"
          />
        </label>
        <p v-if="hint" class="nav__banner nav__banner--err">{{ hint }}</p>
        <div class="form__footer">
          <button type="button" class="btn btn--ghost" :disabled="busy" @click="cancelForm">
            取消
          </button>
          <button type="submit" class="btn btn--primary" :disabled="busy">
            {{ busy ? '保存中…' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg);
}

/* ── Toolbar（无模块标题，仅操作） ───────────────────── */
.nav__toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: transparent;
}

.nav__toolbar--form {
  gap: 10px;
}

.nav__toolbar-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.nav__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.nav__search {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.nav__search-input {
  width: 100%;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text);
  padding: 0 28px 0 10px;
  font-size: 12.5px;
  font-family: inherit;
}

.nav__search-input::placeholder {
  color: var(--text-dim);
}

.nav__search-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
}

.nav__search-input:disabled {
  opacity: 0.55;
}

.nav__search-clear {
  position: absolute;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.nav__search-clear:hover {
  color: var(--text);
  background: var(--bg-3);
}

.nav__banner {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.45;
}

.nav__banner--err {
  color: #ff8e8e;
  background: color-mix(in srgb, #ef4444 12%, transparent);
}

.nav__banner--ok {
  color: #86efac;
  background: color-mix(in srgb, #22c55e 12%, transparent);
}

.nav__state {
  padding: 40px 16px;
  text-align: center;
  color: var(--text-dim);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav__state strong {
  color: var(--text);
  font-weight: 600;
}

/* ── Block / section ─────────────────────────────────── */
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block__head {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 2px;
}

.block__head--folder {
  position: sticky;
  top: 0;
  z-index: 2;
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(8px);
  margin: 0 -2px;
  padding: 2px;
  border-radius: 6px;
}

.block__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 4px 4px;
  border-radius: 6px;
  text-align: left;
}

.block__toggle:hover {
  background: var(--bg-3);
}

.block__chev {
  width: 12px;
  font-size: 10px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.block__label {
  margin: 0;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block__lock {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 4px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.block__count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.block__action {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.block__action:hover {
  background: var(--bg-3);
  color: var(--text);
}

.block__empty {
  padding: 10px 8px;
  font-size: 12px;
  color: var(--text-dim);
}

.block__list {
  display: flex;
  flex-direction: column;
}

/* ── Favorites tiles (3-col grid) ─────────────────────── */
.tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.tile {
  position: relative;
  border-radius: 10px;
  background: var(--bg-2);
  border: 1px solid transparent;
  transition: border-color 120ms ease, background 120ms ease;
}

.tile:hover {
  border-color: var(--border);
  background: var(--bg-3);
}

.tile__hit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 6px 8px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.tile__mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
}

.tile__name {
  width: 100%;
  font-size: 11px;
  font-weight: 550;
  color: var(--text);
  text-align: center;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.tile__menu {
  position: absolute;
  top: 4px;
  right: 4px;
  display: none;
  gap: 2px;
}

.tile:hover .tile__menu,
.tile:focus-within .tile__menu {
  display: flex;
}

.tile__menu button {
  border: none;
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  padding: 2px 5px;
  cursor: pointer;
  backdrop-filter: blur(6px);
}

.tile__menu button:hover {
  color: var(--text);
  background: var(--bg);
}

.tile__menu .is-danger {
  color: #ff8e8e;
}

/* ── Tone marks ──────────────────────────────────────── */
.tone-red {
  background: color-mix(in srgb, #ff5c5c 22%, var(--bg));
  color: #ff8e8e;
}
.tone-teal {
  background: color-mix(in srgb, #14b8a6 22%, var(--bg));
  color: #5eead4;
}
.tone-amber {
  background: color-mix(in srgb, #f59e0b 22%, var(--bg));
  color: #fbbf24;
}
.tone-blue {
  background: color-mix(in srgb, #3b82f6 22%, var(--bg));
  color: #93c5fd;
}
.tone-violet {
  background: color-mix(in srgb, #a855f7 22%, var(--bg));
  color: #d8b4fe;
}
.tone-slate {
  background: var(--bg-3);
  color: var(--text-dim);
}

/* ── Form ────────────────────────────────────────────── */
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 0.02em;
}

.field__control {
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  color: var(--text);
  padding: 0 10px;
  font-size: 13px;
  font-family: inherit;
}

.field__control:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}

.form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid var(--border);
}

.btn--ghost {
  background: transparent;
  color: var(--text-dim);
}

.btn--ghost:hover {
  color: var(--text);
  background: var(--bg-3);
}

.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn--primary:hover {
  background: var(--accent-hover);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 320px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
