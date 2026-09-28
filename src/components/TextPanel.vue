<script setup lang="ts">
import type { TextCharState } from '@/types'

const props = withDefaults(
  defineProps<{
    /** 待显示字符序列及状态 */
    items: { char: string; state: TextCharState }[]
    /** 批次信息（单字/字根） */
    batch?: { index: number; total: number }
    /** 面板标题（文章名等） */
    title?: string
  }>(),
  { title: '', batch: undefined },
)
</script>

<template>
  <div class="text-panel">
    <div v-if="props.title || props.batch" class="text-panel__head">
      <span class="text-panel__title">{{ props.title }}</span>
      <span v-if="props.batch" class="text-panel__batch">
        第 {{ props.batch.index }}/{{ props.batch.total }} 批
      </span>
    </div>
    <p class="text-panel__text">
      <template v-for="(item, i) in props.items" :key="i">
        <br v-if="item.char === '\n'" />
        <span v-else class="tp-char" :class="`tp-char--${item.state}`">
          {{ item.char }}
        </span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.text-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5) var(--space-6);
  box-shadow: var(--shadow-sm);
}

.text-panel__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-3);
}

.text-panel__title {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.text-panel__batch {
  color: var(--color-primary);
  font-size: var(--font-sm);
  font-weight: 600;
}

.text-panel__text {
  font-size: var(--font-xl);
  line-height: 2;
  word-break: break-all;
}

.tp-char {
  transition: color 0.12s;
}

.tp-char--pending {
  color: var(--text-pending);
}

.tp-char--active {
  color: var(--color-text);
  font-weight: 700;
  background: var(--text-active-bg);
  border-radius: var(--radius-sm);
  padding: 0 2px;
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.tp-char--done-clean {
  color: var(--text-done);
}

.tp-char--done-wrong {
  color: var(--text-wrong);
  text-decoration: underline wavy var(--text-wrong);
  text-underline-offset: 6px;
}

.tp-char--skip {
  color: var(--text-skip);
}
</style>
