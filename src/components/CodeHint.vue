<script setup lang="ts">
import { computed } from 'vue'
import type { HintItem } from '@/schemes/base'
import { useUiSettings } from '@/composables/useUiSettings'

const props = defineProps<{
  char: string
  code: string
  items: HintItem[]
  /** 已接受的输入 */
  input: string
  /** 待显示的简码提示（按层级升序，如 ["x","xc","xca"]） */
  shorts?: string[]
  /** 是否展示简码规则说明（一级/二级/三级打法） */
  guide?: boolean
}>()

const codeChars = computed(() => props.code.split(''))
const { codeHintOn, setCodeHint } = useUiSettings()

function shortName(len: number): string {
  if (len === 1) return '一级简码'
  if (len === 2) return '二级简码'
  if (len === 3) return '三级简码'
  return `${len} 级简码`
}
</script>

<template>
  <div class="hint-card">
    <div class="hint-card__head">
      <span class="hint-card__title">拆字提示</span>
      <button
        class="hint-card__toggle"
        :class="{ 'hint-card__toggle--off': !codeHintOn }"
        @click="setCodeHint(!codeHintOn)"
      >
        {{ codeHintOn ? '隐藏' : '显示' }}
      </button>
    </div>
    <div v-show="codeHintOn" class="hint-card__body">
      <div class="hint__line">
        <span class="hint__char">{{ props.char }}</span>
        <template v-if="props.items.length">
          <span class="hint__arrow">→</span>
          <span class="hint__roots">
            （<template v-for="(it, i) in props.items" :key="i"><span
              v-if="i > 0"
              class="hint__root-sep"
            > + </span><span class="hint__root">{{ it.text }}</span></template>）
          </span>
        </template>
        <span class="hint__arrow">→</span>
        <span class="hint__code">
          <span
            v-for="(c, i) in codeChars"
            :key="i"
            class="hint__code-char"
            :class="{ 'hint__code-char--typed': i < props.input.length }"
          >
            {{ c.toUpperCase() }}
          </span>
        </span>
      </div>
      <div v-if="props.shorts && props.shorts.length > 0" class="hint__shorts">
        <p v-if="props.guide" class="hint__short-guide">
          一级简码：打 1 个键 + 空格，共 25 个最常用字。<br />
          二级简码：打 2 个键 + 空格。<br />
          三级简码：打 3 个键 + 空格。
        </p>
        <div v-for="(short, i) in props.shorts" :key="i" class="hint__short-item">
          {{ shortName(short.length) }}：<span class="hint__short-key">{{
            short.toUpperCase()
          }}</span>
          + 空格
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-3);
  box-shadow: var(--shadow-sm);
}

.hint-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.hint-card__title {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-weight: 600;
}

.hint-card__toggle {
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.hint-card__toggle:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.hint-card__toggle--off {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.hint-card__body {
  text-align: center;
  margin-top: var(--space-1);
}

.hint__line {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: var(--font-lg);
  flex-wrap: wrap;
  justify-content: center;
}

.hint__char {
  font-weight: 600;
}

.hint__arrow {
  color: var(--color-text-muted);
}

.hint__code-char {
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.05em;
}

.hint__code-char--typed {
  color: var(--color-success);
}

.hint__roots {
  color: var(--color-text-muted);
  font-size: var(--font-base);
}

/* 简码提示（一级简码关 / 二级简码关显示） */
.hint__shorts {
  margin-top: var(--space-1);
  font-size: var(--font-sm);
  color: var(--color-primary);
}

.hint__short-guide {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: 0.8em;
  line-height: 1.7;
}

.hint__short-item + .hint__short-item {
  margin-top: 2px;
}

.hint__short-key {
  display: inline-block;
  min-width: 1.4em;
  padding: 0 6px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary-weak);
  font-weight: 700;
  letter-spacing: 0.05em;
}

/* 字根加粗（字体为单字重轮廓字体，浏览器合成加粗） */
.hint__root {
  color: var(--color-text);
  font-weight: 700;
}

.hint__root-sep {
  color: var(--color-text-muted);
}
</style>
