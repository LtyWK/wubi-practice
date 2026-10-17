<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type HeatmapMode = 'count' | 'percent'

interface HeatKey {
  /** KeyboardEvent.code */
  code: string
  /** 键帽主标 */
  label: string
}

const props = withDefaults(
  defineProps<{
    /** 物理键频，key 为 KeyboardEvent.code（如 KeyA / Digit1 / Space / Backspace） */
    freq: Record<string, number>
    /** 初始展示模式 */
    mode?: HeatmapMode
    /** 紧凑尺寸（关卡内实时展示） */
    compact?: boolean
  }>(),
  {
    mode: 'count',
    compact: false,
  },
)

const mode = ref<HeatmapMode>(props.mode)

// 外部初始模式变化时同步（组件内点击仍可自行切换）
watch(
  () => props.mode,
  (value) => {
    mode.value = value
  },
)

const NUMBER_ROW: HeatKey[] = Array.from({ length: 10 }, (_, i) => {
  const digit = (i + 1) % 10
  return { code: `Digit${digit}`, label: String(digit) }
})

const LETTER_ROWS: HeatKey[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
].map((row) => row.map((letter) => ({ code: `Key${letter}`, label: letter })))

const BOTTOM_KEYS: HeatKey[] = [
  { code: 'Space', label: '空格' },
  { code: 'Backspace', label: '退格' },
]

const ALL_KEYS: HeatKey[] = [...NUMBER_ROW, ...LETTER_ROWS.flat(), ...BOTTOM_KEYS]

/** 有任意一个物理键记录即视为有数据 */
const hasData = computed(() => Object.keys(props.freq).length > 0)

function countOf(code: string): number {
  const n = props.freq[code]
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0
}

/** 总击键数（包含布局之外的按键记录） */
const total = computed(() =>
  Object.values(props.freq).reduce((sum, n) => sum + (Number.isFinite(n) ? Math.max(0, n) : 0), 0),
)

const maxCount = computed(() => {
  let max = 0
  for (const n of Object.values(props.freq)) {
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
})

const topKey = computed<HeatKey | null>(() => {
  let best: HeatKey | null = null
  let bestCount = 0
  for (const key of ALL_KEYS) {
    const count = countOf(key.code)
    if (count > bestCount) {
      best = key
      bestCount = count
    }
  }
  return best
})

function fmtCount(n: number): string {
  return String(Math.round(n))
}

function fmtPercent(n: number): string {
  if (total.value <= 0) return '0.0%'
  return `${((n / total.value) * 100).toFixed(1)}%`
}

function valueText(code: string): string {
  const count = countOf(code)
  return mode.value === 'count' ? fmtCount(count) : fmtPercent(count)
}

/** 色阶：按当前最大次数归一，次数越多蓝色越深 */
function keyStyle(key: HeatKey): Record<string, string> {
  const count = countOf(key.code)
  if (count <= 0 || maxCount.value <= 0) {
    return { background: 'rgba(148, 163, 184, 0.1)' }
  }
  const ratio = count / maxCount.value
  const alpha = 0.12 + ratio * 0.6
  return { background: `rgba(37, 99, 235, ${alpha.toFixed(3)})` }
}

function keyTitle(key: HeatKey): string {
  const count = countOf(key.code)
  const name =
    key.code === 'Space' ? '空格键' : key.code === 'Backspace' ? '退格键' : `${key.label} 键`
  return `${name}：${fmtCount(count)} 次（${fmtPercent(count)}）`
}

function toggleMode(): void {
  mode.value = mode.value === 'count' ? 'percent' : 'count'
}
</script>

<template>
  <div
    class="hm"
    :class="{ 'hm--compact': props.compact }"
    role="button"
    tabindex="0"
    :aria-label="`键频热力图，当前显示${mode === 'count' ? '次数' : '占比'}，点击切换`"
    @click="toggleMode"
    @keydown.enter.prevent="toggleMode"
    @keydown.space.prevent="toggleMode"
  >
    <p v-if="!hasData" class="hm__empty">暂无键频数据</p>

    <template v-else>
      <div class="hm__summary">
        <span>总击键 {{ fmtCount(total) }}</span>
        <span class="hm__dot">·</span>
        <span v-if="topKey"
          >最高键 {{ topKey.label }}（{{ fmtCount(countOf(topKey.code)) }} 次）</span
        >
        <span v-else>最高键 —</span>
        <span class="hm__dot">·</span>
        <span class="hm__tip">点击切换数值/占比</span>
      </div>

      <div class="hm__keyboard">
        <div class="hm__row">
          <span
            v-for="key in NUMBER_ROW"
            :key="key.code"
            class="hm__key"
            :class="{ 'hm__key--zero': countOf(key.code) === 0 }"
            :style="keyStyle(key)"
            :data-code="key.code"
            :title="keyTitle(key)"
          >
            <span class="hm__key-label">{{ key.label }}</span>
            <span class="hm__key-value">{{ valueText(key.code) }}</span>
          </span>
        </div>

        <div
          v-for="(row, ri) in LETTER_ROWS"
          :key="ri"
          class="hm__row"
          :class="{ 'hm__row--offset': ri === 2 }"
        >
          <span
            v-for="key in row"
            :key="key.code"
            class="hm__key"
            :class="{ 'hm__key--zero': countOf(key.code) === 0 }"
            :style="keyStyle(key)"
            :data-code="key.code"
            :title="keyTitle(key)"
          >
            <span class="hm__key-label">{{ key.label }}</span>
            <span class="hm__key-value">{{ valueText(key.code) }}</span>
          </span>
        </div>

        <div class="hm__row hm__row--bottom">
          <span
            v-for="key in BOTTOM_KEYS"
            :key="key.code"
            class="hm__key"
            :class="[
              key.code === 'Space' ? 'hm__key--space' : 'hm__key--backspace',
              { 'hm__key--zero': countOf(key.code) === 0 },
            ]"
            :style="keyStyle(key)"
            :data-code="key.code"
            :title="keyTitle(key)"
          >
            <span class="hm__key-label">{{ key.label }}</span>
            <span class="hm__key-value">{{ valueText(key.code) }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hm {
  --hm-gap: 5px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
}

.hm:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.hm__empty {
  padding: var(--space-3);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.hm__summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px 6px;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.hm__dot {
  opacity: 0.6;
}

.hm__tip {
  color: var(--color-primary);
}

.hm__keyboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hm-gap);
  overflow-x: auto;
  padding: 1px;
}

.hm__row {
  display: flex;
  justify-content: center;
  gap: var(--hm-gap);
  width: 100%;
}

/* z–m 行左偏半个键宽，贴合真实键盘的错位排布 */
.hm__row--offset {
  transform: translateX(calc(-0.5 * (100% - 9 * var(--hm-gap)) / 10));
}

.hm__key {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: calc((100% - 9 * var(--hm-gap)) / 10);
  max-width: 58px;
  aspect-ratio: 1.1 / 1;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  overflow: hidden;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.hm__key--zero {
  border-style: dashed;
}

.hm__key-label {
  font-size: var(--font-sm);
  font-weight: 700;
  line-height: 1;
}

.hm__key-value {
  font-size: 0.6875rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}

.hm__row--bottom {
  margin-top: 1px;
}

.hm__key--space,
.hm__key--backspace {
  flex-direction: row;
  gap: 6px;
  aspect-ratio: auto;
  height: 34px;
}

.hm__key--space {
  flex: 1 1 auto;
  width: auto;
  max-width: 300px;
}

.hm__key--backspace {
  width: calc((100% - 9 * var(--hm-gap)) / 10);
  max-width: 72px;
}

/* 紧凑尺寸（关卡内实时展示） */
.hm--compact {
  --hm-gap: 3px;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-md);
}

.hm--compact .hm__summary {
  font-size: 0.75rem;
}

.hm--compact .hm__key {
  max-width: 42px;
  aspect-ratio: 1 / 1;
  border-radius: 3px;
}

.hm--compact .hm__key-label {
  font-size: 0.6875rem;
}

.hm--compact .hm__key-value {
  font-size: 0.5625rem;
}

.hm--compact .hm__key--space,
.hm--compact .hm__key--backspace {
  height: 24px;
}

.hm--compact .hm__key--space {
  max-width: 220px;
}

.hm--compact .hm__key--backspace {
  max-width: 52px;
}

@media (max-width: 640px) {
  .hm {
    --hm-gap: 3px;
    padding: var(--space-2);
  }

  .hm__key {
    max-width: 40px;
    border-radius: 3px;
  }

  .hm__key-label {
    font-size: 0.6875rem;
  }

  .hm__key-value {
    font-size: 0.5625rem;
  }

  .hm__key--space,
  .hm__key--backspace {
    height: 26px;
  }
}
</style>
