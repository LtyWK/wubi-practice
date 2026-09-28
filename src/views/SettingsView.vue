<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSave } from '@/composables/useSave'
import { useLevels } from '@/composables/useLevels'
import { useUiSettings, type ThemeMode } from '@/composables/useUiSettings'

const { save, exportSave, importSave, resetAll } = useSave()
const { unlockAll } = useLevels()
const { theme, soundOn, setTheme, setSound } = useUiSettings()

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

function onSoundChange(e: Event): void {
  setSound((e.target as HTMLInputElement).checked)
}

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

function doUnlockAll(): void {
  unlockAll()
  message.value = '已解锁全部阶段'
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
      <h2 class="card__title">外观与音效</h2>
      <div class="row">
        <span class="row__label">主题</span>
        <span class="theme">
          <button
            v-for="opt in THEME_OPTIONS"
            :key="opt.value"
            class="theme__btn"
            :class="{ 'theme__btn--active': theme === opt.value }"
            @click="setTheme(opt.value)"
          >
            {{ opt.label }}
          </button>
        </span>
      </div>
      <div class="row">
        <span class="row__label">按键音效</span>
        <label class="check">
          <input type="checkbox" :checked="soundOn" @change="onSoundChange" />
          开启（小音量，错误提示更明显）
        </label>
      </div>
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

    <section class="card">
      <h2 class="card__title">解锁</h2>
      <p class="card__desc">一键解锁全部阶段（不影响已有成绩与错题）。</p>
      <button class="btn" @click="doUnlockAll">解锁全部关卡</button>
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
  border-color: var(--color-danger-border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
}

.row__label {
  flex: none;
  width: 5em;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.theme {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.theme__btn {
  padding: var(--space-1) var(--space-3);
  border: none;
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.theme__btn + .theme__btn {
  border-left: 1px solid var(--color-border);
}

.theme__btn--active {
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-weight: 600;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-sm);
  color: var(--color-text);
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
