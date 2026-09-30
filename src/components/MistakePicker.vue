<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MistakeOption } from '@/types'

const props = defineProps<{
  options: MistakeOption[]
}>()

const emit = defineEmits<{
  (e: 'update:selected', ids: string[]): void
}>()

const selected = ref<string[]>([])

watch(
  () => props.options,
  (opts) => {
    // 默认全部勾选
    selected.value = opts.map((o) => o.id)
    emit('update:selected', [...selected.value])
  },
  { immediate: true },
)

const allChecked = computed(
  () => props.options.length > 0 && selected.value.length === props.options.length,
)

function toggle(id: string): void {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(id)
  emit('update:selected', [...selected.value])
}

function selectAll(): void {
  selected.value = allChecked.value ? [] : props.options.map((o) => o.id)
  emit('update:selected', [...selected.value])
}
</script>

<template>
  <div class="picker">
    <div class="picker__head">
      <label class="picker__all">
        <input type="checkbox" :checked="allChecked" @change="selectAll" />
        全选
      </label>
      <span class="picker__count">共 {{ options.length }} 项</span>
    </div>
    <ul class="picker__list">
      <li v-for="opt in options" :key="opt.id" class="picker__item">
        <label>
          <input
            type="checkbox"
            :checked="selected.includes(opt.id)"
            @change="toggle(opt.id)"
          />
          <span class="picker__main">{{ opt.main }}</span>
          <span class="picker__detail">{{ opt.detail }}</span>
        </label>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.picker {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  max-height: 240px;
  overflow: auto;
}

.picker__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-key-bg);
  position: sticky;
  top: 0;
}

.picker__count {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.picker__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.picker__item {
  border-bottom: 1px solid var(--color-border);
}

.picker__item:last-child {
  border-bottom: none;
}

.picker__item label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
}

.picker__main {
  font-weight: 600;
  min-width: 2em;
}

.picker__detail {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}
</style>
