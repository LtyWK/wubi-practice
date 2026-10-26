<script setup lang="ts">
import { computed } from 'vue'

type ResultRank = 'S' | 'A' | 'B' | 'C'

interface Metric {
  label: string
  value: string
  unit?: string
  note?: string
}

const props = withDefaults(
  defineProps<{
    /** 结算标题 */
    title: string
    /** 速度（字/分） */
    speed: number
    /** 正确率 0-1 */
    accuracy: number
    /** 用时（毫秒） */
    elapsedMs: number
    /** 击键速度（键/秒，物理按键口径），传值时展示 */
    keystrokes?: number
    /** 段位 */
    rank?: ResultRank
    /** 达标状态（未传则不显示达标徽章） */
    passed?: boolean
    /** 达标线说明 */
    passLabel?: string
    /** 错误记录（目标字 + 错误输入） */
    errors?: { char: string; input: string }[]
    /** 下一组按钮文案（未传则不显示） */
    nextLabel?: string
    /** 是否显示（父组件也可直接用 v-if） */
    show?: boolean
  }>(),
  {
    keystrokes: undefined,
    rank: undefined,
    passed: undefined,
    passLabel: undefined,
    errors: () => [],
    nextLabel: undefined,
    show: true,
  },
)

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'next'): void
  (e: 'close'): void
}>()

const metrics = computed<Metric[]>(() => {
  const list: Metric[] = [
    { label: '速度', value: props.speed.toFixed(0), unit: '字/分' },
    { label: '正确率', value: `${Math.round(props.accuracy * 100)}%` },
    { label: '用时', value: (props.elapsedMs / 1000).toFixed(1), unit: '秒' },
  ]
  if (props.keystrokes !== undefined) {
    list.push({ label: '击键', value: props.keystrokes.toFixed(1), unit: '键/秒' })
  }
  return list
})

const rankClass = computed(() => (props.rank ? `result__rank--${props.rank.toLowerCase()}` : ''))

const shownErrors = computed(() => props.errors.slice(0, 20))

const restErrors = computed(() => Math.max(0, props.errors.length - 20))
</script>

<template>
  <section v-if="props.show" class="result">
    <header class="result__head">
      <div class="result__heading">
        <div class="result__title-row">
          <h2 class="result__title">{{ props.title }}</h2>
          <span
            v-if="props.passed !== undefined"
            class="result__pass"
            :class="props.passed ? 'result__pass--ok' : 'result__pass--fail'"
          >
            {{ props.passed ? '达标' : '未达标' }}
          </span>
        </div>
        <p v-if="props.passLabel" class="result__pass-label">{{ props.passLabel }}</p>
      </div>
      <span v-if="props.rank" class="result__rank" :class="rankClass">{{ props.rank }}</span>
    </header>

    <dl class="result__metrics">
      <div v-for="metric in metrics" :key="metric.label" class="result__metric">
        <dt class="result__metric-label">{{ metric.label }}</dt>
        <dd class="result__metric-value">
          {{ metric.value }}
          <span v-if="metric.unit" class="result__metric-unit">{{ metric.unit }}</span>
          <span v-if="metric.note" class="result__metric-note">{{ metric.note }}</span>
        </dd>
      </div>
    </dl>

    <section v-if="props.errors.length > 0" class="result__section">
      <h3 class="result__subtitle">
        错误字
        <span class="result__count">{{ props.errors.length }}</span>
      </h3>
      <ul class="result__error-list">
        <li
          v-for="(err, i) in shownErrors"
          :key="`${err.char}-${i}`"
          class="result__error-item"
          :title="`目标字：${err.char} · 错误输入：${err.input || '（空）'}`"
        >
          <span class="result__error-char">{{ err.char }}</span>
          <span class="result__error-arrow">→</span>
          <span class="result__error-input">{{ err.input || '（空）' }}</span>
        </li>
      </ul>
      <p v-if="restErrors > 0" class="result__more">另有 {{ restErrors }} 条未显示</p>
    </section>

    <div class="result__actions">
      <button type="button" class="btn" @click="emit('retry')">重试</button>
      <button v-if="props.nextLabel" type="button" class="btn btn--primary" @click="emit('next')">
        {{ props.nextLabel }}
      </button>
      <button type="button" class="btn btn--ghost" @click="emit('close')">关闭</button>
    </div>
  </section>
</template>

<style scoped>
.result {
  width: min(760px, 100%);
  margin: 0 auto;
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.result__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.result__heading {
  min-width: 0;
}

.result__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.result__title {
  font-size: var(--font-lg);
}

.result__pass {
  padding: 1px 10px;
  border-radius: 999px;
  font-size: var(--font-sm);
  font-weight: 600;
}

.result__pass--ok {
  background: var(--color-success-weak);
  color: var(--color-success);
}

.result__pass--fail {
  background: var(--color-danger-weak);
  color: var(--color-danger);
}

.result__pass-label {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

/* 段位圆章：S 金 / A 银 / B 铜 / C 灰 */
.result__rank {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.45);
  font-size: 1.625rem;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
  box-shadow: var(--shadow-sm);
}

.result__rank--s {
  background: linear-gradient(145deg, #fbe6a2 0%, #e6b53c 55%, #b8860b 100%);
  color: #5a3f00;
}

.result__rank--a {
  background: linear-gradient(145deg, #f5f7fa 0%, #c6ccd6 55%, #8f98a6 100%);
  color: #363c46;
}

.result__rank--b {
  background: linear-gradient(145deg, #f0c9a8 0%, #c8895a 55%, #8f5427 100%);
  color: #45230d;
}

.result__rank--c {
  background: linear-gradient(145deg, #e2e5ea 0%, #b3b9c3 55%, #8a909b 100%);
  color: #333942;
}

.result__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  gap: var(--space-3);
  margin: 0 0 var(--space-5);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-key-bg);
}

.result__metric {
  text-align: center;
  min-width: 0;
}

.result__metric-label {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.result__metric-value {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.result__metric-unit {
  margin-left: 2px;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-weight: 400;
}

.result__metric-note {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.result__section + .result__section {
  margin-top: var(--space-5);
}

.result__subtitle {
  margin-bottom: var(--space-2);
  font-size: var(--font-base);
}

.result__count {
  margin-left: 2px;
  color: var(--color-danger);
  font-size: var(--font-sm);
}

.result__error-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-height: 190px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.result__error-item {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 3px 9px;
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-sm);
  background: var(--color-danger-weak);
  font-size: var(--font-sm);
}

.result__error-char {
  font-size: var(--font-base);
  font-weight: 700;
  color: var(--color-text);
}

.result__error-arrow {
  color: var(--color-text-muted);
}

.result__error-input {
  color: var(--color-danger);
  font-family: ui-monospace, Consolas, monospace;
  word-break: break-all;
}

.result__more {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.result__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  transition:
    border-color 0.15s,
    background 0.15s,
    color 0.15s;
}

.btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn--primary:hover {
  color: var(--color-on-primary);
  filter: brightness(1.06);
}

.btn--ghost {
  color: var(--color-text-muted);
}

@media (max-width: 640px) {
  .result {
    padding: var(--space-4);
  }

  .result__head {
    margin-bottom: var(--space-4);
  }

  .result__rank {
    width: 48px;
    height: 48px;
    font-size: 1.375rem;
  }

  .result__metrics {
    grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .result__actions .btn {
    flex: 1 1 auto;
  }
}
</style>
