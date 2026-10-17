<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 总组数 */
    total: number
    /** 已通关组数 */
    done: number
    /** 当前组索引（0-based） */
    current: number
    /** 每组最佳速度（字/分） */
    bests?: number[]
    /** 是否允许点击已解锁组回打 */
    clickable?: boolean
  }>(),
  {
    bests: () => [],
    clickable: false,
  },
)

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const indexes = computed(() =>
  Array.from({ length: Math.max(0, Math.floor(props.total)) }, (_, i) => i),
)

function isCurrent(index: number): boolean {
  return index === props.current
}

function isPassed(index: number): boolean {
  return index < props.done && !isCurrent(index)
}

function canSelect(index: number): boolean {
  return props.clickable && (index < props.done || isCurrent(index))
}

function cellTitle(index: number): string {
  const base = `第 ${index + 1} 组`
  const best = props.bests[index]
  if (typeof best === 'number' && Number.isFinite(best)) {
    return `${base} · 最佳 ${best.toFixed(1)} 字/分`
  }
  return base
}

function onSelect(index: number): void {
  if (!canSelect(index)) return
  emit('select', index)
}
</script>

<template>
  <div class="tp">
    <div class="tp__head">
      <span class="tp__summary">进度 {{ props.done }}/{{ props.total }} 组</span>
      <span v-if="props.clickable" class="tp__hint">点击已通关组可重打</span>
    </div>

    <div class="tp__grid">
      <button
        v-for="index in indexes"
        :key="index"
        type="button"
        class="tp__cell"
        :class="{
          'tp__cell--passed': isPassed(index),
          'tp__cell--current': isCurrent(index),
          'tp__cell--locked': index >= props.done && !isCurrent(index),
          'tp__cell--clickable': canSelect(index),
        }"
        :title="cellTitle(index)"
        :tabindex="canSelect(index) ? 0 : -1"
        :aria-disabled="!canSelect(index)"
        @click="onSelect(index)"
      >
        {{ index + 1 }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tp {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tp__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px var(--space-3);
}

.tp__summary {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.tp__hint {
  font-size: var(--font-sm);
  color: var(--color-primary);
}

.tp__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tp__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-key-bg);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-variant-numeric: tabular-nums;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s,
    transform 0.15s;
}

/* 已通关 */
.tp__cell--passed {
  border-color: var(--color-success);
  background: var(--color-success-weak);
  color: var(--color-success);
  font-weight: 600;
}

/* 当前组：高亮 + 呼吸 */
.tp__cell--current {
  border-color: var(--color-primary);
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-weight: 700;
  animation: tp-breathe 1.6s ease-in-out infinite;
}

/* 未解锁 */
.tp__cell--locked {
  border-style: dashed;
  color: var(--color-locked);
  opacity: 0.75;
}

.tp__cell[aria-disabled='true'] {
  cursor: default;
}

.tp__cell--clickable {
  cursor: pointer;
}

.tp__cell--clickable:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-1px);
}

@keyframes tp-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.25);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.12);
  }
}

@media (max-width: 640px) {
  .tp__grid {
    gap: 4px;
  }

  .tp__cell {
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
  }
}
</style>
