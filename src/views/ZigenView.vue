<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import KeyboardMap from '@/components/KeyboardMap.vue'
import ResultModal from '@/components/ResultModal.vue'
import { LEVELS, getLevel } from '@/data/levels'
import { calcKeyStats } from '@/engine/stats'
import { useProgress } from '@/composables/useProgress'
import type { MistakeOption } from '@/types'

const route = useRoute()
const router = useRouter()
const { isUnlocked, unlock, recordBest } = useProgress()

const level = computed(() => getLevel(String(route.params.id)))

const queue = ref<string[]>([])
const index = ref(0)
const correctKeys = ref(0)
const totalKeys = ref(0)
const errors = ref<Record<string, number>>({})
const startAt = ref(0)
const now = ref(Date.now())
const started = ref(false)
const finished = ref(false)
const showResult = ref(false)
const feedback = ref<'ok' | 'bad' | ''>('')

const currentKey = computed(() => queue.value[index.value] ?? '')
const stats = computed(() =>
  calcKeyStats(correctKeys.value, totalKeys.value, startAt.value, now.value),
)
const options = computed<MistakeOption[]>(() =>
  Object.entries(errors.value).map(([key, count]) => ({
    id: key,
    main: key.toUpperCase(),
    detail: `错误 ${count} 次`,
  })),
)
const passed = computed(() => {
  const req = level.value?.require
  if (!req) return false
  return stats.value.speed >= req.speed && stats.value.accuracy >= req.accuracy
})

let tickTimer: number | undefined
let fbTimer: number | undefined

function buildQueue(keys: string[]): void {
  const lv = level.value
  if (!lv) return
  const arr: string[] = []
  for (let i = 0; i < lv.length; i += 1) {
    arr.push(keys[Math.floor(Math.random() * keys.length)])
  }
  queue.value = arr
}

function resetSession(keys: string[]): void {
  index.value = 0
  correctKeys.value = 0
  totalKeys.value = 0
  errors.value = {}
  startAt.value = 0
  now.value = Date.now()
  started.value = false
  finished.value = false
  showResult.value = false
  feedback.value = ''
  buildQueue(keys)
}

function flash(kind: 'ok' | 'bad'): void {
  feedback.value = kind
  if (fbTimer) window.clearTimeout(fbTimer)
  fbTimer = window.setTimeout(() => {
    feedback.value = ''
  }, 180)
}

function finish(): void {
  finished.value = true
  now.value = Date.now()
  showResult.value = true
  const lv = level.value
  if (lv && passed.value) {
    recordBest(lv.id, stats.value.speed, stats.value.accuracy)
    const i = LEVELS.findIndex((l) => l.id === lv.id)
    if (i >= 0 && i < LEVELS.length - 1) unlock(LEVELS[i + 1].id)
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (finished.value) return
  const key = e.key.toLowerCase()
  if (!/^[a-z]$/.test(key)) return
  if (!started.value) {
    started.value = true
    startAt.value = Date.now()
  }
  totalKeys.value += 1
  if (key === currentKey.value) {
    correctKeys.value += 1
    flash('ok')
    index.value += 1
    if (index.value >= queue.value.length) finish()
  } else {
    errors.value[key] = (errors.value[key] ?? 0) + 1
    flash('bad')
  }
}

function onPractice(ids: string[]): void {
  const keys: string[] = []
  for (const key of ids) {
    for (let i = 0; i < 3; i += 1) keys.push(key)
  }
  keys.sort(() => Math.random() - 0.5)
  resetSession(keys)
}

function closeResult(): void {
  router.push('/')
}

onMounted(() => {
  const lv = level.value
  if (!lv || lv.type !== 'zigen' || !isUnlocked(lv.id)) {
    router.replace('/')
    return
  }
  resetSession(lv.pool)
  window.addEventListener('keydown', onKeydown)
  tickTimer = window.setInterval(() => {
    if (started.value && !finished.value) now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (tickTimer) window.clearInterval(tickTimer)
  if (fbTimer) window.clearTimeout(fbTimer)
})
</script>

<template>
  <section class="zigen">
    <div class="stats">
      <div class="stat">
        <span class="stat__label">速度</span>
        <span class="stat__value">{{ stats.speed.toFixed(0) }}</span>
        <span class="stat__unit">键/分</span>
      </div>
      <div class="stat">
        <span class="stat__label">正确率</span>
        <span class="stat__value">{{ Math.round(stats.accuracy * 100) }}%</span>
      </div>
      <div class="stat">
        <span class="stat__label">进度</span>
        <span class="stat__value">{{ Math.min(index + 1, queue.length) }}/{{ queue.length }}</span>
      </div>
    </div>

    <p
      class="prompt"
      :class="{
        'prompt--ok': feedback === 'ok',
        'prompt--bad': feedback === 'bad',
      }"
    >
      按下「{{ currentKey.toUpperCase() }}」所在的键位
    </p>

    <KeyboardMap :highlight="currentKey" />

    <ResultModal
      :visible="showResult"
      :title="level?.title ?? '字根练习'"
      :stats="stats"
      :passed="passed"
      :requirement="level?.require ?? { speed: 0, accuracy: 0 }"
      :options="options"
      @practice="onPractice"
      @close="closeResult"
    />
  </section>
</template>

<style scoped>
.zigen {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.stats {
  display: flex;
  justify-content: center;
  gap: var(--space-8);
}

.stat {
  text-align: center;
}

.stat__label {
  display: block;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.stat__value {
  font-size: var(--font-xl);
  font-weight: 700;
}

.stat__unit {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  margin-left: 2px;
}

.prompt {
  text-align: center;
  font-size: var(--font-md);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: background 0.12s;
}

.prompt--ok {
  background: var(--color-success-weak);
  color: var(--color-success);
}

.prompt--bad {
  background: var(--color-danger-weak);
  color: var(--color-danger);
}
</style>
