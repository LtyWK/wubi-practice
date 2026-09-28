<script setup lang="ts">
import { ref, watch } from 'vue'
import type { MistakeOption } from '@/types'
import MistakePicker from './MistakePicker.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title: string
    stats: { speed: number; accuracy: number; elapsedSec: number }
    passed: boolean
    requirement: { speed: number; accuracy: number }
    options: MistakeOption[]
    /** 是否展示达标信息（自由模式隐藏） */
    showPass?: boolean
  }>(),
  { showPass: true },
)

const emit = defineEmits<{
  (e: 'practice', ids: string[]): void
  (e: 'close'): void
}>()

const selected = ref<string[]>([])

watch(
  () => props.visible,
  (v) => {
    if (v) selected.value = []
  },
)

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function onPractice(): void {
  if (selected.value.length > 0) emit('practice', [...selected.value])
}
</script>

<template>
  <div v-if="visible" class="modal">
    <div class="modal__panel">
      <h2 class="modal__title">{{ title }}</h2>
      <p
        v-if="props.showPass"
        class="modal__result"
        :class="passed ? 'modal__result--pass' : 'modal__result--fail'"
      >
        {{ passed ? '达标' : '未达标，可再练一次' }}
      </p>

      <dl class="modal__stats">
        <div><dt>速度</dt><dd>{{ stats.speed.toFixed(0) }} 字/分</dd></div>
        <div><dt>正确率</dt><dd>{{ pct(stats.accuracy) }}</dd></div>
        <div><dt>用时</dt><dd>{{ stats.elapsedSec.toFixed(1) }} 秒</dd></div>
      </dl>
      <p v-if="props.showPass" class="modal__req">
        达标要求：≥ {{ requirement.speed }} 字/分 · ≥ {{ pct(requirement.accuracy) }}
      </p>

      <template v-if="options.length > 0">
        <h3 class="modal__sub">错误清单</h3>
        <MistakePicker :options="options" @update:selected="(ids) => (selected = ids)" />
      </template>

      <div class="modal__actions">
        <button
          class="btn btn--primary"
          :disabled="options.length === 0 || selected.length === 0"
          @click="onPractice"
        >
          加练所选（{{ selected.length }}）
        </button>
        <button class="btn" @click="emit('close')">返回关卡</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  background: var(--dark-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 20;
}

.modal__panel {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
  width: min(560px, 100%);
  max-height: 90vh;
  overflow: auto;
}

.modal__title {
  font-size: var(--font-lg);
  margin-bottom: var(--space-2);
}

.modal__result {
  font-size: var(--font-md);
  font-weight: 600;
  margin-bottom: var(--space-4);
}

.modal__result--pass {
  color: var(--color-success);
}

.modal__result--fail {
  color: var(--color-danger);
}

.modal__stats {
  display: flex;
  gap: var(--space-6);
  margin: 0 0 var(--space-2);
}

.modal__stats dt {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.modal__stats dd {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 600;
}

.modal__req {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  margin-bottom: var(--space-4);
}

.modal__sub {
  font-size: var(--font-base);
  margin-bottom: var(--space-2);
}

.modal__actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.btn {
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.btn--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
