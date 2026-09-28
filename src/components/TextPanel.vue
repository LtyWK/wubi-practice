<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { TextCharState } from '@/types'
import { useUiSettings } from '@/composables/useUiSettings'

const props = withDefaults(
  defineProps<{
    /** 待显示字符序列及状态（全量展示，容器内滚动） */
    items: { char: string; state: TextCharState }[]
    /** 面板标题（文章名 / 关卡名） */
    title?: string
  }>(),
  { title: '' },
)

const { align, setAlign } = useUiSettings()
const box = ref<HTMLElement | null>(null)

/** 当前字进入可视区时自动滚动 */
watch(
  () => props.items.findIndex((item) => item.state === 'active'),
  async (index) => {
    if (index < 0) return
    await nextTick()
    const el = box.value?.querySelector<HTMLElement>(`.tp-char[data-index="${index}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  },
)
</script>

<template>
  <div class="text-panel">
    <div class="text-panel__head">
      <span class="text-panel__title">{{ props.title }}</span>
      <span class="text-panel__align">
        <button
          class="align-btn"
          :class="{ 'align-btn--active': align === 'center' }"
          @click="setAlign('center')"
        >
          居中
        </button>
        <button
          class="align-btn"
          :class="{ 'align-btn--active': align === 'left' }"
          @click="setAlign('left')"
        >
          左对齐
        </button>
      </span>
    </div>
    <div ref="box" class="text-panel__box">
      <p
        class="text-panel__text"
        :class="align === 'center' ? 'text-panel__text--center' : 'text-panel__text--left'"
      >
        <template v-for="(item, i) in props.items" :key="i">
          <br v-if="item.char === '\n'" />
          <span
            v-else
            class="tp-char"
            :data-index="i"
            :class="`tp-char--${item.state}`"
          >{{ item.char }}</span>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.text-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-6) var(--space-5);
  box-shadow: var(--shadow-sm);
}

.text-panel__head {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 30px;
  margin-bottom: var(--space-2);
}

.text-panel__title {
  color: var(--color-text);
  font-size: var(--font-base);
  font-weight: 600;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.text-panel__align {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.align-btn {
  padding: 2px 10px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  cursor: pointer;
}

.align-btn + .align-btn {
  border-left: 1px solid var(--color-border);
}

.align-btn--active {
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-weight: 600;
}

.text-panel__box {
  max-height: 24vh;
  min-height: 84px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.text-panel__text {
  font-size: 1.375rem;
  line-height: 2.8;
  letter-spacing: 0.15em;
  word-break: break-all;
}

.text-panel__text--center {
  text-align: center;
}

.text-panel__text--left {
  text-align: left;
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
