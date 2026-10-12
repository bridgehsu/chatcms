<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  fetchMentionCatalog,
  type ChatAttachment,
  type ChatAttachmentKind,
  type MentionCatalogItem,
} from '../shared/bridge'

const props = defineProps<{
  open: boolean
  query: string
  agentId?: string | null
  excludeKeys?: string[]
}>()

const emit = defineEmits<{
  pick: [item: ChatAttachment]
  close: []
}>()

const options = ref<MentionCatalogItem[]>([])
const loading = ref(false)
const active = ref(0)

const kindTitle: Record<ChatAttachmentKind, string> = {
  script: '脚本',
  skill: '技能',
  mcp: '工具',
}

const filtered = computed(() => {
  const q = props.query.trim().toLowerCase()
  const exclude = new Set(props.excludeKeys || [])
  return options.value.filter((o) => {
    const key = `${o.kind}:${o.id}`
    if (exclude.has(key)) return false
    if (!q) return true
    return (
      o.label.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      (o.code?.toLowerCase().includes(q) ?? false) ||
      (o.description?.toLowerCase().includes(q) ?? false)
    )
  })
})

watch(
  () => [props.open, props.agentId] as const,
  async ([open]) => {
    if (!open) return
    loading.value = true
    try {
      options.value = await fetchMentionCatalog(props.agentId)
      active.value = 0
    } catch {
      options.value = []
    } finally {
      loading.value = false
    }
  },
)

watch(
  () => props.query,
  () => {
    active.value = 0
  },
)

function pick(item: MentionCatalogItem) {
  emit('pick', {
    kind: item.kind,
    id: item.id,
    label: item.label,
    code: item.code,
  })
}

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  const list = filtered.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!list.length) return
    active.value = (active.value + 1) % list.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!list.length) return
    active.value = (active.value - 1 + list.length) % list.length
  } else if (e.key === 'Enter') {
    const hit = list[active.value]
    if (hit) {
      e.preventDefault()
      e.stopPropagation()
      pick(hit)
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => window.removeEventListener('keydown', onKey, true))

const groups: ChatAttachmentKind[] = ['script', 'skill', 'mcp']
</script>

<template>
  <div v-if="open" class="mention-picker" role="listbox" aria-label="@ 引用">
    <div v-if="loading" class="mention-picker__empty">加载中…</div>
    <div v-else-if="!filtered.length" class="mention-picker__empty">
      无匹配的脚本 / 技能 / MCP
    </div>
    <template v-else>
      <div
        v-for="kind in groups"
        :key="kind"
        class="mention-picker__group"
      >
        <template v-if="filtered.some((o) => o.kind === kind)">
          <div class="mention-picker__group-title">{{ kindTitle[kind] }}</div>
          <button
            v-for="opt in filtered.filter((o) => o.kind === kind)"
            :key="`${opt.kind}:${opt.id}`"
            type="button"
            class="mention-picker__item"
            :class="{ 'is-active': filtered.indexOf(opt) === active }"
            role="option"
            @mouseenter="active = filtered.indexOf(opt)"
            @click="pick(opt)"
          >
            <span
              class="mention-picker__badge"
              :class="`mention-picker__badge--${opt.kind}`"
            >
              {{ kindTitle[opt.kind] === '工具' ? 'MCP' : kindTitle[opt.kind] }}
            </span>
            <span class="mention-picker__body">
              <span class="mention-picker__label">{{ opt.label }}</span>
              <span v-if="opt.description" class="mention-picker__desc">{{
                opt.description
              }}</span>
            </span>
          </button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mention-picker {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 40;
  max-height: 240px;
  overflow: auto;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-2);
  box-shadow: var(--shadow-md);
}

.mention-picker__group + .mention-picker__group {
  margin-top: 4px;
}

.mention-picker__group-title {
  padding: 4px 8px 6px;
  font-size: 11px;
  font-weight: 650;
  color: var(--text-dim);
}

.mention-picker__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.mention-picker__item:hover,
.mention-picker__item.is-active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-1));
}

.mention-picker__badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 650;
}

.mention-picker__badge--script {
  background: color-mix(in srgb, #0d9488 18%, transparent);
  color: #0f766e;
}

.mention-picker__badge--skill {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}

.mention-picker__badge--mcp {
  background: color-mix(in srgb, #d97706 18%, transparent);
  color: #b45309;
}

.mention-picker__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mention-picker__label {
  font-size: 13px;
  font-weight: 600;
}

.mention-picker__desc {
  font-size: 11.5px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-picker__empty {
  padding: 12px 8px;
  font-size: 12.5px;
  color: var(--text-dim);
  text-align: center;
}
</style>
