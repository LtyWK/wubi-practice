<script setup lang="ts">
import { useUiSettings, type ThemeMode } from '@/composables/useUiSettings'
import { playKeySound } from '@/audio/sound'

const { theme, soundOn, volume, hintsOn, setTheme, setSound, setVolume, setHints } =
  useUiSettings()

const THEME_OPTIONS: { value: ThemeMode; label: string; desc: string }[] = [
  { value: 'auto', label: '跟随系统', desc: '随操作系统的深浅色设置自动切换' },
  { value: 'light', label: '浅色', desc: '始终使用浅色主题' },
  { value: 'dark', label: '深色', desc: '始终使用深色主题' },
]

function onSoundChange(e: Event): void {
  setSound((e.target as HTMLInputElement).checked)
}

function onVolumeInput(e: Event): void {
  setVolume(Number((e.target as HTMLInputElement).value) / 100)
}

function testSound(): void {
  if (soundOn.value) playKeySound('ok', volume.value)
}

function onHintsChange(e: Event): void {
  setHints((e.target as HTMLInputElement).checked)
}
</script>

<template>
  <section class="appearance">
    <h1 class="appearance__title">外观与音效</h1>

    <section class="card">
      <h2 class="card__title">主题</h2>
      <ul class="themes">
        <li v-for="opt in THEME_OPTIONS" :key="opt.value">
          <button
            class="theme"
            :class="{ 'theme--active': theme === opt.value }"
            @click="setTheme(opt.value)"
          >
            <span class="theme__label">{{ opt.label }}</span>
            <span class="theme__desc">{{ opt.desc }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2 class="card__title">按键反馈</h2>
      <label class="check">
        <input type="checkbox" :checked="hintsOn" @change="onHintsChange" />
        按键高亮提示（下一步按键高亮 + 最近一次输入常亮）
      </label>
    </section>

    <section class="card">
      <h2 class="card__title">按键音效</h2>
      <label class="check">
        <input type="checkbox" :checked="soundOn" @change="onSoundChange" />
        开启（正确轻音、错误提示音更明显）
      </label>

      <div class="volume">
        <span class="volume__label">音量</span>
        <input
          class="volume__range"
          type="range"
          min="0"
          max="100"
          step="5"
          :value="Math.round(volume * 100)"
          :disabled="!soundOn"
          @input="onVolumeInput"
        />
        <span class="volume__value">{{ Math.round(volume * 100) }}%</span>
        <button class="btn" :disabled="!soundOn" @click="testSound">试听</button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.appearance {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.appearance__title {
  font-size: var(--font-xl);
}

.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.card__title {
  font-size: var(--font-md);
  margin-bottom: var(--space-3);
}

.themes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.theme {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.theme:hover {
  border-color: var(--color-primary);
}

.theme--active {
  border-color: var(--color-primary);
  background: var(--color-primary-weak);
}

.theme__label {
  font-weight: 600;
}

.theme__desc {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-sm);
}

.volume {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.volume__label {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.volume__range {
  flex: 1;
  max-width: 260px;
  accent-color: var(--color-primary);
}

.volume__value {
  width: 3.2em;
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.btn {
  padding: var(--space-1) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
