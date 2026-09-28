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
    /** 键位 → 全部字根（含键名字根，键名在最前） */
    roots?: Record<string, string[]>
    /** 禁用态 */
    disabled?: boolean
  }>(),
  { highlight: '', feedback: null, sticky: null, roots: undefined, disabled: false },
)

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
  <div class="vk" :class="{ 'vk--disabled': props.disabled }" aria-hidden="true">
    <div v-for="(row, ri) in ROWS" :key="ri" class="vk__row">
      <span v-for="key in row" :key="key" class="vk__key" :class="keyClass(key)">
        <span class="vk__letter">{{ key.toUpperCase() }}</span>
        <span class="vk__roots">
          <span v-for="(root, i) in props.roots?.[key] ?? []" :key="i" class="vk__root">
            {{ root }}
          </span>
        </span>
      </span>
    </div>
    <div class="vk__row">
      <span class="vk__key vk__key--space" :class="keyClass(' ')">空 格</span>
    </div>
  </div>
</template>

<style scoped>
.vk {
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
  gap: 8px;
  justify-content: center;
}

.vk__key {
  position: relative;
  width: 84px;
  height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 12px 4px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-key-bg);
  color: var(--color-text);
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

/* 五区顶栏色（低饱和） */
.vk__key::before {
  content: '';
  position: absolute;
  inset: 3px 6px auto 6px;
  height: 3px;
  border-radius: 2px;
  background: transparent;
}

.vk__key--area-1::before {
  background: #a8c3a0;
}
.vk__key--area-2::before {
  background: #a0b8cd;
}
.vk__key--area-3::before {
  background: #cdb8a0;
}
.vk__key--area-4::before {
  background: #c3a8bd;
}
.vk__key--area-5::before {
  background: #b1b0c9;
}

.vk__letter {
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 4px;
}

.vk__roots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1px 5px;
  max-width: 78px;
}

.vk__root {
  font-size: 0.6875rem;
  line-height: 1.25;
  color: var(--color-text-muted);
}

.vk__key--hint {
  background: var(--key-hint, #cfe0f3);
  border-color: var(--color-primary);
  animation: vk-breathe 1.2s ease-in-out infinite;
}

.vk__key--hint .vk__root {
  color: #3b5f8a;
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
  border-color: #9cc9ae;
  color: #3f7a58;
}

.vk__key--sticky-ok .vk__root {
  color: #5e8f74;
}

.vk__key--sticky-bad {
  background: var(--color-danger-weak);
  border-color: #d3a1a1;
  color: #a05555;
}

.vk__key--sticky-bad .vk__root {
  color: #a86a6a;
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
    background: #b7dcc4;
  }
  100% {
    background: var(--color-key-bg);
  }
}

@keyframes vk-flash-bad {
  0% {
    background: #e8bcbc;
  }
  100% {
    background: var(--color-key-bg);
  }
}

@keyframes vk-flash-timeout {
  0% {
    background: #ecd9a6;
  }
  100% {
    background: var(--color-key-bg);
  }
}

.vk__key--muted {
  background: #fafafa;
}

.vk__key--space {
  width: 460px;
  max-width: 60vw;
  height: 52px;
  justify-content: center;
  font-size: var(--font-base);
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0;
}
</style>
