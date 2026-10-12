<script setup lang="ts">
import { computed, ref } from 'vue'
import { renderMarkdown } from '../shared/markdown'

const props = defineProps<{
  content: string
  streaming?: boolean
}>()

const html = computed(() => renderMarkdown(props.content || ''))
const copiedKey = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  const btn = target?.closest?.('[data-md-copy]') as HTMLButtonElement | null
  if (!btn) return
  e.preventDefault()
  const block = btn.closest('.md-code')
  const code = block?.querySelector('pre code')?.textContent ?? ''
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    const key = String(Date.now())
    copiedKey.value = key
    btn.textContent = '已复制'
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      if (copiedKey.value === key) {
        btn.textContent = '复制'
        copiedKey.value = null
      }
    }, 1600)
  } catch (err) {
    console.error(err)
  }
}
</script>

<template>
  <div
    class="md-content"
    :class="{ 'is-streaming': streaming }"
    @click="onClick"
  >
    <p v-if="!content.trim()" class="md-content__placeholder">思考中…</p>
    <div v-else class="md-content__body" v-html="html" />
    <span v-if="streaming" class="md-cursor" aria-hidden="true" />
  </div>
</template>

<style scoped>
.md-content {
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  --surface-code: #141820;
  --surface-code-fg: #e6e8ee;

  position: relative;
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text);
  word-break: break-word;
  overflow-wrap: anywhere;
  width: 100%;
  min-width: 0;
}

.md-content__body {
  min-width: 0;
}

.md-content__placeholder {
  margin: 0;
  color: var(--text-dim);
}

.md-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--accent);
  animation: md-blink 1s step-end infinite;
}

@keyframes md-blink {
  50% {
    opacity: 0;
  }
}

.md-content :deep(.md-content__plain) {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

.md-content :deep(> .md-content__body > *:first-child) {
  margin-top: 0;
}

.md-content :deep(> .md-content__body > *:last-child) {
  margin-bottom: 0;
}

.md-content :deep(p) {
  margin: 0 0 0.85em;
}

.md-content :deep(h1),
.md-content :deep(h2),
.md-content :deep(h3),
.md-content :deep(h4) {
  margin: 1.1em 0 0.45em;
  font-weight: 650;
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--text);
}

.md-content :deep(h1) {
  font-size: 1.3em;
}
.md-content :deep(h2) {
  font-size: 1.18em;
}
.md-content :deep(h3),
.md-content :deep(h4) {
  font-size: 1.05em;
}

.md-content :deep(ul),
.md-content :deep(ol) {
  margin: 0 0 0.85em;
  padding-left: 1.35em;
}

.md-content :deep(li) {
  margin: 0.25em 0;
}

.md-content :deep(li > ul),
.md-content :deep(li > ol) {
  margin: 0.2em 0 0.35em;
}

.md-content :deep(blockquote) {
  margin: 0 0 0.85em;
  padding: 0.15em 0 0.15em 0.9em;
  border-left: 3px solid color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--text-dim);
}

.md-content :deep(hr) {
  margin: 1.1em 0;
  border: none;
  border-top: 1px solid var(--border);
}

.md-content :deep(a) {
  color: color-mix(in srgb, var(--accent) 75%, #60a5fa);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.md-content :deep(a:hover) {
  color: var(--accent);
}

.md-content :deep(.md-inline-code) {
  font-family: var(--mono);
  font-size: 0.88em;
  padding: 0.12em 0.4em;
  border-radius: 5px;
  background: color-mix(in srgb, var(--bg-3) 85%, #1a1f2a);
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  color: var(--text);
}

.md-content :deep(.md-code) {
  margin: 0.75em 0 1em;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-code);
  overflow: hidden;
}

.md-content :deep(.md-code__bar) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-2) 70%, var(--surface-code));
}

.md-content :deep(.md-code__lang) {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.md-content :deep(.md-code__copy) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.md-content :deep(.md-code__copy:hover) {
  color: var(--text);
  background: color-mix(in srgb, var(--bg-3) 70%, transparent);
}

.md-content :deep(.md-code__pre) {
  margin: 0;
  padding: 12px 14px;
  overflow-x: auto;
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--surface-code-fg);
}

.md-content :deep(.md-code__pre code) {
  font-family: inherit;
  font-size: inherit;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  white-space: pre;
}

.md-content :deep(.md-table-wrap) {
  width: 100%;
  overflow-x: auto;
  margin: 0.75em 0 1em;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.md-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.md-content :deep(th),
.md-content :deep(td) {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.md-content :deep(th) {
  font-weight: 650;
  background: color-mix(in srgb, var(--bg-3) 55%, transparent);
}

.md-content :deep(tr:last-child td) {
  border-bottom: none;
}

.md-content :deep(strong) {
  font-weight: 650;
}

.md-content :deep(em) {
  font-style: italic;
}
</style>
