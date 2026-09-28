<script setup lang="ts">
const props = defineProps<{
  /** 速度（字/分 或 键/分） */
  speed: number
  /** 正确率 0-1 */
  accuracy: number
  /** 已完成数量 */
  done: number
  /** 总数量 */
  total: number
  /** 已用时（秒） */
  elapsedSec: number
  /** 超时次数 */
  timeouts: number
  /** 速度单位 */
  unit?: string
}>()

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}
</script>

<template>
  <div class="stats">
    <div class="stats__item">
      <span class="stats__label">速度</span>
      <span class="stats__value">{{ props.speed.toFixed(0) }}</span>
      <span class="stats__unit">{{ props.unit ?? '字/分' }}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">正确率</span>
      <span class="stats__value">{{ pct(props.accuracy) }}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">进度</span>
      <span class="stats__value">{{ props.done }}/{{ props.total }}</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">用时</span>
      <span class="stats__value">{{ props.elapsedSec.toFixed(0) }}</span>
      <span class="stats__unit">秒</span>
    </div>
    <div class="stats__item">
      <span class="stats__label">超时</span>
      <span class="stats__value" :class="{ 'stats__value--warn': props.timeouts > 0 }">
        {{ props.timeouts }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  justify-content: center;
  gap: var(--space-8);
  padding: var(--space-2) 0;
}

.stats__item {
  text-align: center;
  min-width: 64px;
}

.stats__label {
  display: block;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.stats__value {
  font-size: var(--font-xl);
  font-weight: 700;
}

.stats__value--warn {
  color: #b08a3e;
}

.stats__unit {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  margin-left: 2px;
}
</style>
