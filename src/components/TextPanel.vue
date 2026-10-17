<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { PanelItem, TextCharState } from '@/types'
import { useUiSettings } from '@/composables/useUiSettings'

const props = withDefaults(
  defineProps<{
    /** 待显示项序列（全量展示，容器内滚动；含脚本关的提示行与换行） */
    items: PanelItem[]
    /** 面板标题（文章名 / 关卡名） */
    title?: string
    /** 布局：flow = 按容器宽度自动换行（文章/脚本关）；grid = 每行 20 个、每 10 个一组（随机字/字根关） */
    layout?: 'flow' | 'grid'
  }>(),
  { title: '', layout: 'flow' },
)

const { align, setAlign } = useUiSettings()
const box = ref<HTMLElement | null>(null)

/** 网格布局单元：字符 + 在 items 中的下标（供自动滚动定位） */
interface GridCell {
  char: string
  state: TextCharState
  index: number
}

/** 网格布局：每 20 个一行，行内每 10 个一组（两组中间空开） */
const gridRows = computed<GridCell[][][]>(() => {
  const cells: GridCell[] = []
  props.items.forEach((item, index) => {
    if (item.kind === 'char') cells.push({ char: item.char, state: item.state, index })
  })
  const rows: GridCell[][][] = []
  for (let i = 0; i < cells.length; i += 20) {
    const slice = cells.slice(i, i + 20)
    const groups: GridCell[][] = []
    for (let j = 0; j < slice.length; j += 10) groups.push(slice.slice(j, j + 10))
    rows.push(groups)
  }
  return rows
})

/** 当前字进入可视区时自动滚动 */
watch(
  () => props.items.findIndex((item) => item.kind === 'char' && item.state === 'active'),
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
      <span v-if="props.layout === 'flow'" class="text-panel__align">
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
      <div v-if="props.layout === 'grid'" class="tp-grid">
        <div v-for="(row, ri) in gridRows" :key="ri" class="tp-grid__row">
          <div v-for="(group, gi) in row" :key="gi" class="tp-grid__group">
            <span
              v-for="cell in group"
              :key="cell.index"
              class="tp-char"
              :data-index="cell.index"
              :class="`tp-char--${cell.state}`"
            >{{ cell.char }}</span>
          </div>
        </div>
      </div>
      <p
        v-else
        class="text-panel__text"
        :class="align === 'center' ? 'text-panel__text--center' : 'text-panel__text--left'"
      >
        <template v-for="(item, i) in props.items" :key="i">
          <br v-if="item.kind === 'br'" />
          <span v-else-if="item.kind === 'hint'" class="tp-hint">{{ item.text }}</span>
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
  min-height: 26px;
  margin-bottom: var(--space-1);
}

.text-panel__title {
  color: var(--color-text);
  font-size: var(--font-base);
  font-weight: 600;
  text-align: center;
  white-space: normal; /* 标题过长时自动换行 */
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
  max-height: 20vh;
  min-height: 72px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.text-panel__text {
  font-size: 1.375rem;
  line-height: 2;
  letter-spacing: 0.15em;
  white-space: normal;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.text-panel__text--center {
  text-align: center;
}

.text-panel__text--left {
  text-align: left;
}

/* 随机字/字根关网格：每行 20 个（两组各 10 个，中间空开），整体居中 */
.tp-grid {
  font-size: 1.375rem;
  line-height: 2;
  overflow-x: auto;
}

.tp-grid__row {
  display: flex;
  justify-content: center;
  /* 窄屏放不下一行 20 个时保持整行宽度，改为横向滚动 */
  min-width: max-content;
}

.tp-grid__group {
  display: grid;
  grid-template-columns: repeat(10, 1.5em);
  justify-items: center;
  align-items: center;
}

.tp-grid__row > .tp-grid__group + .tp-grid__group {
  margin-left: 2.5em;
}

/* 窄屏：缩小字号与格宽，避免一行 20 个溢出 */
@media (max-width: 840px) {
  .tp-grid {
    font-size: 1.15rem;
  }
}

/* 手机：两组改为竖排，每行只显示一组（10 个） */
@media (max-width: 700px) {
  .tp-grid {
    font-size: 1rem;
  }

  .tp-grid__row {
    flex-direction: column;
    align-items: center;
  }

  .tp-grid__group {
    grid-template-columns: repeat(10, 1.45em);
  }

  .tp-grid__row > .tp-grid__group + .tp-grid__group {
    margin-left: 0;
  }
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

/* 提示行：不参与训练，小字、灰色、斜体、整行 */
.tp-hint {
  display: block;
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.8em;
  font-style: italic;
  letter-spacing: 0.05em;
  line-height: 1.8;
  opacity: 0.85;
}
</style>
