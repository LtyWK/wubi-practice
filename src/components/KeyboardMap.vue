<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ZigenItem } from '@/types'
import { loadZigen } from '@/data/loader'

const props = withDefaults(
  defineProps<{
    /** 高亮键位 */
    highlight?: string
    /** 禁用态 */
    disabled?: boolean
  }>(),
  { highlight: '', disabled: false },
)

const items = ref<ZigenItem[]>([])

onMounted(async () => {
  items.value = await loadZigen()
})
</script>

<template>
  <div class="keyboard" :class="{ 'keyboard--disabled': props.disabled }">
    <div
      v-for="item in items"
      :key="item.key"
      class="key"
      :class="{ 'key--active': props.highlight === item.key }"
      :title="item.mnemonic"
    >
      <span class="key__name">{{ item.name }}</span>
      <span class="key__letter">{{ item.key.toUpperCase() }}</span>
      <span class="key__roots">{{ item.radicals.join(' ') }}</span>
    </div>
  </div>
</template>

<style scoped>
.keyboard {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-2);
  max-width: 640px;
  margin: 0 auto;
}

.keyboard--disabled {
  opacity: 0.6;
}

.key {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-key-bg);
  min-height: 72px;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.key--active {
  background: var(--color-key-active);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.key__name {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text);
}

.key__letter {
  font-size: var(--font-sm);
  color: var(--color-primary);
  font-weight: 600;
}

.key__roots {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  line-height: 1.3;
  text-align: center;
}
</style>
