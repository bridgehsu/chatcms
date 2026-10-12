<script setup lang="ts">
import type { AppModule } from '../shared/publishDraft'

defineProps<{
  modelValue: AppModule
}>()

const emit = defineEmits<{
  'update:modelValue': [AppModule]
}>()

const options: { value: AppModule; label: string }[] = [
  { value: 'chat', label: '对话' },
  { value: 'nav', label: '导航' },
  { value: 'publish', label: '发布' },
]
</script>

<template>
  <div class="module-switch" role="tablist" aria-label="功能模块">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      class="module-switch__item"
      :class="{ 'is-active': modelValue === opt.value }"
      :aria-selected="modelValue === opt.value"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.module-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  flex-shrink: 0;
  min-width: 0;
}

.module-switch__item {
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 140ms var(--ease-out),
    color 140ms var(--ease-out);
}

.module-switch__item:hover {
  color: var(--text);
}

.module-switch__item.is-active {
  background: var(--bg-3);
  color: var(--text);
}
</style>
