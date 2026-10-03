<script setup lang="ts">
import type { KeyFeedback, ZigenItem } from '@/types'

const props = withDefaults(
  defineProps<{
    /** 下一步应按键（字母或空格 " "） */
    highlight?: string
    /** 瞬时反馈（闪一下） */
    feedback?: KeyFeedback | null
    /** 常亮状态（最近一次输入结果） */
    sticky?: KeyFeedback | null
    /** 键位 → 字根表条目（含键盘布局，由当前方案提供） */
    zigen?: Record<string, ZigenItem>
    /** 禁用态 */
    disabled?: boolean
  }>(),
  {
    highlight: '',
    feedback: null,
    sticky: null,
    zigen: undefined,
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'press', key: string): void
}>()

/** 点按按键（触控 / 鼠标统一走 pointerdown） */
function onPress(key: string): void {
  if (props.disabled) return
  emit('press', key)
}

/** QWERTY 三行（配合真实键盘） */
const ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

/** 五区归属：1 横 2 竖 3 撇 4 捺 5 折；z 无 */
const AREA: Record<string, number> = {
  g: 1, f: 1, d: 1, s: 1, a: 1,
  h: 2, j: 2, k: 2, l: 2, m: 2,
  t: 3, r: 3, e: 3, w: 3, q: 3,
  y: 4, u: 4, i: 4, o: 4, p: 4,
  n: 5, b: 5, v: 5, c: 5, x: 5,
}

function keyClass(key: string): Record<string, boolean> {
  const f = props.feedback
  const s = props.sticky
  const area = AREA[key]
  return {
    'vk__key--hint': props.highlight === key,
    'vk__key--sticky-ok': s?.key === key && s.type === 'ok',
    'vk__key--sticky-bad': s?.key === key && s.type === 'bad',
    'vk__key--flash-ok': f?.key === key && f.type === 'ok',
    'vk__key--flash-bad': f?.key === key && f.type === 'bad',
    'vk__key--flash-timeout': f?.key === key && f.type === 'timeout',
    'vk__key--muted': !area,
    [`vk__key--area-${area ?? 0}`]: true,
  }
}

/** 取键位的布局格子（补齐到 size²） */
function cellsOf(key: string): (ZigenItem['layout']['cells'][number])[] {
  const z = props.zigen?.[key]
  if (!z) return []
  const total = z.layout.size * z.layout.size
  const cells = z.layout.cells.slice(0, total)
  while (cells.length < total) cells.push(null)
  return cells
}

function sizeOf(key: string): number {
  return props.zigen?.[key]?.layout.size ?? 5
}
</script>

<template>
  <div class="vk" :class="{ 'vk--disabled': props.disabled }">
    <div v-for="(row, ri) in ROWS" :key="ri" class="vk__row">
      <span
        v-for="key in row"
        :key="key"
        class="vk__key"
        :class="keyClass(key)"
        role="button"
        :aria-label="`${key.toUpperCase()} 键`"
        @pointerdown.prevent="onPress(key)"
      >
        <!-- 字根矩阵 -->
        <span
          class="vk__grid"
          :data-size="sizeOf(key)"
          :style="{ gridTemplateColumns: `repeat(${sizeOf(key)}, 1fr)` }"
        >
          <span
            v-for="(cell, i) in cellsOf(key)"
            :key="i"
            class="vk__cell"
            :class="{
              'vk__cell--bold': cell?.bold,
              'vk__cell--red': cell?.mark === 'red',
              'vk__cell--green': cell?.mark === 'green',
            }"
          >
            <span v-if="cell" class="vk__root">{{ cell.cp }}</span>
          </span>
        </span>
        <!-- 底部信息条：字母 + 一级简码 -->
        <span class="vk__foot">
          <span class="vk__letter">{{ key.toUpperCase() }}</span>
          <span class="vk__short">{{ props.zigen?.[key]?.short1 ?? '' }}</span>
        </span>
      </span>
    </div>
    <div class="vk__row">
      <span
        class="vk__key vk__key--space"
        :class="keyClass(' ')"
        role="button"
        aria-label="空格键"
        @pointerdown.prevent="onPress(' ')"
      >空 格</span>
    </div>
  </div>
</template>

<style scoped>
.vk {
  --vk-gap: 7px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  align-items: center;
  user-select: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5) var(--space-5);
  box-shadow: var(--shadow-sm);
  overflow-x: auto;
}

.vk--disabled {
  opacity: 0.5;
}

.vk__row {
  display: flex;
  gap: var(--vk-gap);
  justify-content: center;
  width: 100%;
}

/* 键帽：加高，上方字根矩阵 + 下方信息条 */
.vk__key {
  position: relative;
  flex: 0 0 auto;
  width: calc((100% - 9 * var(--vk-gap)) / 10);
  max-width: 92px;
  aspect-ratio: 1 / 1.18;
  display: flex;
  flex-direction: column;
  padding: 4px 4px 2px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: linear-gradient(var(--keycap-top), var(--keycap-bottom));
  color: var(--color-text);
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  cursor: pointer;
  overflow: hidden;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.vk--disabled .vk__key {
  cursor: not-allowed;
}

.vk:not(.vk--disabled) .vk__key:active {
  transform: scale(0.96);
}

/* 五区边框色 */
.vk__key--area-1 { border-color: var(--area-1); }
.vk__key--area-2 { border-color: var(--area-2); }
.vk__key--area-3 { border-color: var(--area-3); }
.vk__key--area-4 { border-color: var(--area-4); }
.vk__key--area-5 { border-color: var(--area-5); }

/* 字根矩阵 */
.vk__grid {
  flex: 1;
  display: grid;
  gap: 1px;
  align-content: stretch;
  min-height: 0;
  container-type: inline-size;
}

.vk__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  border-radius: 3px;
}

.vk__root {
  font-family: 'WubiRoots', 'WubiRoots98', sans-serif;
  line-height: 1;
  color: var(--color-text);
}

/* 字号随矩阵列数自适应（容器查询，旧浏览器回退固定值） */
.vk__grid[data-size='4'] .vk__root {
  font-size: 0.6875rem;
  font-size: 13.5cqw;
}
.vk__grid[data-size='5'] .vk__root {
  font-size: 0.5rem;
  font-size: 10.5cqw;
}

/* 键名格加粗（单线字体用描边） */
.vk__cell--bold .vk__root {
  font-weight: 700;
  -webkit-text-stroke: 0.6px currentColor;
}

/* 红 / 绿标记：仅字形着色，不加方块背景 */
.vk__cell--red .vk__root {
  color: var(--root-mark-red);
}
.vk__cell--green .vk__root {
  color: var(--root-mark-green);
}

/* 底部信息条 */
.vk__foot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
  padding-top: 2px;
  border-top: 1px solid var(--color-border);
  min-height: 14px;
}

.vk__letter {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1;
}

.vk__short {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

/* 下一步高亮：呼吸 */
.vk__key--hint {
  background: var(--key-hint, #cfe0f3);
  border-color: var(--color-primary);
  animation: vk-breathe 1.2s ease-in-out infinite;
}

.vk__key--hint .vk__root,
.vk__key--hint .vk__letter {
  color: var(--key-hint-text);
}

@keyframes vk-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.25);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12);
  }
}

/* 常亮：最近一次输入结果 */
.vk__key--sticky-ok {
  background: var(--color-success-weak);
  border-color: var(--sticky-ok-border);
  color: var(--key-ok-text);
}

.vk__key--sticky-ok .vk__root,
.vk__key--sticky-ok .vk__letter {
  color: var(--key-ok-root);
}

.vk__key--sticky-ok .vk__short {
  color: var(--key-ok-text);
}

.vk__key--sticky-bad {
  background: var(--color-danger-weak);
  border-color: var(--sticky-bad-border);
  color: var(--key-bad-text);
}

.vk__key--sticky-bad .vk__root,
.vk__key--sticky-bad .vk__letter {
  color: var(--key-bad-root);
}

.vk__key--sticky-bad .vk__short {
  color: var(--key-bad-text);
}

/* 瞬时闪烁 */
.vk__key--flash-ok {
  animation: vk-flash-ok 0.35s ease-out;
}
.vk__key--flash-bad {
  animation: vk-flash-bad 0.35s ease-out;
}
.vk__key--flash-timeout {
  animation: vk-flash-timeout 0.45s ease-out;
}

@keyframes vk-flash-ok {
  0% {
    background: var(--flash-ok);
  }
  100% {
    background: linear-gradient(var(--keycap-top), var(--keycap-bottom));
  }
}

@keyframes vk-flash-bad {
  0% {
    background: var(--flash-bad);
  }
  100% {
    background: linear-gradient(var(--keycap-top), var(--keycap-bottom));
  }
}

@keyframes vk-flash-timeout {
  0% {
    background: var(--flash-timeout);
  }
  100% {
    background: linear-gradient(var(--keycap-top), var(--keycap-bottom));
  }
}

.vk__key--muted {
  background: var(--key-muted-bg);
}

.vk__key--space {
  flex: 0 0 auto;
  width: min(460px, 100%);
  max-width: 100%;
  aspect-ratio: auto;
  height: 44px;
  align-items: center;
  justify-content: center;
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0;
}

/* 窄屏：保留字根矩阵 + 字母 + 一级简码，压缩间距 */
@media (max-width: 640px) {
  .vk {
    --vk-gap: 3px;
    gap: 3px;
    padding: var(--space-2);
    border-radius: var(--radius-md);
  }

  .vk__key {
    padding: 2px 2px 1px;
    border-width: 1px;
    border-radius: var(--radius-sm);
    aspect-ratio: 1 / 1.12;
  }

  .vk__grid[data-size='4'] .vk__root {
    font-size: 12cqw;
  }
  .vk__grid[data-size='5'] .vk__root {
    font-size: 9.5cqw;
  }

  .vk__letter {
    font-size: 0.5rem;
  }
  .vk__short {
    font-size: 0.5625rem;
  }

  .vk__key--space {
    width: 90%;
    height: 32px;
  }
}
</style>
