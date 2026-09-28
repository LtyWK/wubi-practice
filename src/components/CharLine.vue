<script setup lang="ts">
import type { CharState } from '@/engine/judge'

const props = defineProps<{
  items: { char: string; state: CharState }[]
  /** 当前字是否处于错误反馈 */
  error?: boolean
}>()
</script>

<template>
  <div class="charline">
    <span
      v-for="(item, i) in props.items"
      :key="i"
      class="charline__char"
      :class="[
        `charline__char--${item.state}`,
        { 'charline__char--error': props.error && item.state === 'active' },
      ]"
    >
      {{ item.char }}
    </span>
  </div>
</template>

<style scoped>
.charline {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}

.charline__char {
  width: 2.5rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  font-size: var(--font-lg);
  border-radius: var(--radius-sm);
  background: var(--color-key-bg);
}

.charline__char--pending {
  color: var(--color-text-muted);
}

.charline__char--active {
  color: var(--color-primary);
  background: var(--color-primary-weak);
  outline: 2px solid var(--color-primary);
}

.charline__char--done {
  color: #fff;
  background: var(--color-success);
}

.charline__char--error {
  color: #fff;
  background: var(--color-danger);
  outline-color: var(--color-danger);
}
</style>
