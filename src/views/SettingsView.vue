<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSave } from '@/composables/useSave'

const { save, exportSave, importSave, resetAll } = useSave()

const message = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const summary = computed(() => ({
  passed: Object.values(save.value.progress.levels).filter((l) => l.passed).length,
  stages: save.value.progress.unlockedStages.length,
  mistakes: Object.keys(save.value.mistakes).length,
  chars: Object.keys(save.value.stats).length,
}))

function doExport(): void {
  const blob = new Blob([exportSave()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`
  a.href = url
  a.download = `wubi-save-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  message.value = '已导出存档文件'
}

function pickFile(): void {
  fileInput.value?.click()
}

function applyImport(text: string): void {
  if (!window.confirm('导入将覆盖当前进度、错题与统计，确定继续？')) return
  const result = importSave(text)
  message.value = result.ok ? '导入成功，正在刷新…' : (result.error ?? '导入失败')
  if (result.ok) {
    window.setTimeout(() => window.location.reload(), 600)
  }
}

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  applyImport(await file.text())
  input.value = ''
}

function doReset(): void {
  if (!window.confirm('确定清空全部进度、错题与统计？此操作不可恢复。')) return
  resetAll()
  message.value = '已重置全部数据'
}
</script>

<template>
  <section class="settings">
    <h1 class="settings__title">存档管理</h1>

    <section class="card">
      <h2 class="card__title">当前存档</h2>
      <ul class="summary">
        <li>已通关卡：{{ summary.passed }}</li>
        <li>已解锁阶段：{{ summary.stages }}</li>
        <li>错题记录：{{ summary.mistakes }} 字</li>
        <li>单字统计：{{ summary.chars }} 字</li>
      </ul>
    </section>

    <section class="card">
      <h2 class="card__title">导出</h2>
      <p class="card__desc">导出为 JSON 文件，可在其他浏览器或设备导入。</p>
      <button class="btn btn--primary" @click="doExport">导出存档</button>
    </section>

    <section class="card">
      <h2 class="card__title">导入</h2>
      <p class="card__desc">选择此前导出的 JSON 存档文件，导入将覆盖当前数据。</p>
      <input ref="fileInput" class="hidden" type="file" accept="application/json,.json" @change="onFile" />
      <button class="btn" @click="pickFile">选择文件导入</button>
    </section>

    <section class="card card--danger">
      <h2 class="card__title">重置</h2>
      <p class="card__desc">清空关卡进度、错题本与单字统计。</p>
      <button class="btn btn--danger" @click="doReset">清空全部数据</button>
    </section>

    <p v-if="message" class="message">{{ message }}</p>
  </section>
</template>

<style scoped>
.settings {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.settings__title {
  font-size: var(--font-xl);
}

.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.card--danger {
  border-color: #e3c3c3;
}

.card__title {
  font-size: var(--font-md);
  margin-bottom: var(--space-2);
}

.card__desc {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  margin-bottom: var(--space-3);
}

.summary {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.btn {
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.btn--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.btn--danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}

.hidden {
  display: none;
}

.message {
  text-align: center;
  color: var(--color-primary);
}
</style>
