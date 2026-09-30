<script setup lang="ts">
import type { KeyFeedback } from '@/types'

const props = withDefaults(
  defineProps<{
    /** 下一步应按键（字母或空格 " "） */
    highlight?: string
    /** 瞬时反馈（闪一下） */
    feedback?: KeyFeedback | null
    /** 常亮状态（最近一次输入结果） */
    sticky?: KeyFeedback | null
    /** 键位 → 键名字根（左上角） */
    names?: Record<string, string>
    /** 键位 → 主体字形（≤15，3×5 排列） */
    roots?: Record<string, string[]>
    /** 键位 → 一级简码（右上角） */
    short1?: Record<string, string>
    /** 禁用态 */
    disabled?: boolean
  }>(),
  {
    highlight: '',
    feedback: null,
    sticky: null,
    names: undefined,
    roots: undefined,
    short1: undefined,
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
        <!-- 顶部一行：左上键名字根 · 中间字母 · 右上简码 -->
        <span class="vk__letter">{{ key.toUpperCase() }}</span>
        <span class="vk__name">{{ props.names?.[key] ?? '' }}</span>
        <span v-if="props.short1?.[key]" class="vk__short">{{ props.short1[key] }}</span>
        <!-- 主体：3 行 × 5 列其他字根 -->
        <span class="vk__roots">
          <span v-for="(root, i) in props.roots?.[key] ?? []" :key="i" class="vk__root">
            {{ root }}
          </span>
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
  --vk-gap: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.vk__key {
  position: relative;
  flex: 0 0 auto;
  /* 10 列自适应铺满，桌面不超过 84px */
  width: calc((100% - 9 * var(--vk-gap)) / 10);
  max-width: 84px;
  aspect-ratio: 84 / 88;
  display: flex;
  flex-direction: column;
  padding: 4px 5px 2px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-key-bg);
  color: var(--color-text);
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  cursor: pointer;
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

/* 五区用边框色区分（低饱和） */
.vk__key--area-1 {
  border-color: var(--area-1);
}
.vk__key--area-2 {
  border-color: var(--area-2);
}
.vk__key--area-3 {
  border-color: var(--area-3);
}
.vk__key--area-4 {
  border-color: var(--area-4);
}
.vk__key--area-5 {
  border-color: var(--area-5);
}

/* 顶部一行：键名（左） · 字母（中） · 简码（右） */
.vk__letter {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1;
}

.vk__name {
  position: absolute;
  top: 6px;
  left: 7px;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.1;
}

.vk__short {
  position: absolute;
  top: 6px;
  right: 7px;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-primary);
}

/* 主体：3 行 × 5 列（紧凑排列） */
.vk__roots {
  margin-top: 17px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-auto-rows: 1fr;
  align-items: center;
  justify-items: center;
  width: 100%;
  flex: 1;
}

.vk__root {
  font-size: 0.625rem;
  line-height: 1.2;
  color: var(--color-text-muted);
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
    background: var(--color-key-bg);
  }
}

@keyframes vk-flash-bad {
  0% {
    background: var(--flash-bad);
  }
  100% {
    background: var(--color-key-bg);
  }
}

@keyframes vk-flash-timeout {
  0% {
    background: var(--flash-timeout);
  }
  100% {
    background: var(--color-key-bg);
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
  height: 46px;
  align-items: center;
  justify-content: center;
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0;
}

/* 窄屏：精简主体字根，按键自适应铺满，避免溢出 */
@media (max-width: 640px) {
  .vk {
    --vk-gap: 4px;
    gap: 4px;
    padding: var(--space-2);
    border-radius: var(--radius-md);
  }

  .vk__key {
    height: 40px;
    aspect-ratio: auto;
    padding: 2px 3px;
    border-width: 1.5px;
    border-radius: var(--radius-sm);
  }

  .vk__roots {
    display: none;
  }

  .vk__letter {
    top: auto;
    bottom: 3px;
    font-size: 0.8125rem;
  }

  .vk__name {
    top: 3px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.6875rem;
  }

  .vk__short {
    top: 3px;
    right: 3px;
    font-size: 0.5625rem;
  }

  .vk__key--space {
    width: 90%;
    height: 34px;
  }
}

/* 极窄屏：再隐藏一级简码，只留字母 + 键名 */
@media (max-width: 400px) {
  .vk__short {
    display: none;
  }
}
</style>
