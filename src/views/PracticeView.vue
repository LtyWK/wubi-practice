<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CharLine from '@/components/CharLine.vue'
import CodeHint from '@/components/CodeHint.vue'
import KeyboardMap from '@/components/KeyboardMap.vue'
import ResultModal from '@/components/ResultModal.vue'
import { findLevel, stageOfLevel } from '@/data/stages'
import { loadAllChars, loadFreq1Chars } from '@/data/loader'
import { createSession, feedKey, type PracticeSession } from '@/engine/judge'
import { calcStats } from '@/engine/stats'
import { ensureWubi86, wubi86 } from '@/schemes/wubi86'
import { useMistakes } from '@/composables/useMistakes'
import { useLevels } from '@/composables/useLevels'
import type { CharEntry, LevelConfig, MistakeOption } from '@/types'

const route = useRoute()
const router = useRouter()
const { isStageUnlocked, recordResult } = useLevels()
const { record, markMastered } = useMistakes()

const level = computed(() => findLevel(String(route.params.id)))

const session = ref<PracticeSession | null>(null)
const now = ref(Date.now())
const started = ref(false)
const showResult = ref(false)
const drill = ref(false)
const streak = ref<Record<string, number>>({})
const flash = ref(false)

let tickTimer: number | undefined
let flashTimer: number | undefined

const stats = computed(() =>
  session.value
    ? calcStats(session.value, now.value)
    : { speed: 0, accuracy: 1, elapsedSec: 0 },
)
const currentItem = computed(() => {
  const s = session.value
  if (!s || s.finished) return null
  return s.items[s.cursor] ?? null
})
const nextKey = computed(() => {
  const s = session.value
  const item = currentItem.value
  if (!s || !item) return ''
  return item.code[s.input.length] ?? ''
})
const lineItems = computed(
  () => session.value?.items.map((it) => ({ char: it.char, state: it.state })) ?? [],
)
const hintItems = computed(() => (currentItem.value ? wubi86.hint(currentItem.value.char) : []))
const options = computed<MistakeOption[]>(() => {
  const s = session.value
  if (!s) return []
  return s.items
    .filter((it) => it.wrongAttempts.length > 0)
    .map((it) => ({
      id: it.char,
      main: it.char,
      detail: `${it.code.toUpperCase()} · 错 ${it.wrongAttempts.length} 次 · 最近 ${
        it.wrongAttempts[it.wrongAttempts.length - 1]
      }`,
    }))
})
const passed = computed(() => {
  const req = level.value?.require
  if (!req) return false
  return stats.value.speed >= req.speed && stats.value.accuracy >= req.accuracy
})

function sample(pool: string[], count: number): string[] {
  if (pool.length === 0) return []
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const out: string[] = []
  while (out.length < count) {
    const need = count - out.length
    out.push(...shuffled.slice(0, need))
  }
  return out.slice(0, count)
}

async function buildPool(lv: LevelConfig): Promise<string[]> {
  if (lv.source === 'short1' || lv.source === 'short2') {
    const all = await loadAllChars()
    const len = lv.source === 'short1' ? 1 : 2
    const entries = Object.entries(all) as [string, CharEntry][]
    let pool = entries
      .filter(([, e]) => e.short.some((s) => s.length === len))
      .map(([c]) => c)
    if (lv.starts) {
      const set = new Set(lv.starts)
      pool = pool.filter((c) => {
        const shortCode = all[c].short.find((s) => s.length === len)
        return shortCode ? set.has(shortCode[0]) : false
      })
    }
    return pool
  }
  const freq = await loadFreq1Chars()
  let pool = Object.keys(freq)
  if (lv.source === 'idcode') {
    pool = pool.filter((c) => freq[c].idcode)
  }
  if (lv.starts) {
    const set = new Set(lv.starts)
    pool = pool.filter((c) => set.has(freq[c].code[0]))
  }
  return pool
}

function initSession(chars: string[], isDrill: boolean): void {
  if (chars.length === 0) return
  drill.value = isDrill
  streak.value = {}
  now.value = Date.now()
  started.value = false
  showResult.value = false
  session.value = createSession(chars, wubi86, 0)
}

function finish(): void {
  now.value = Date.now()
  showResult.value = true
  const lv = level.value
  if (lv) {
    recordResult(lv.id, stats.value.speed, stats.value.accuracy, passed.value, 0)
  }
}

function flashError(): void {
  flash.value = true
  if (flashTimer) window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => {
    flash.value = false
  }, 180)
}

function onKeydown(e: KeyboardEvent): void {
  let s = session.value
  if (!s || s.finished) return
  const key = e.key.toLowerCase()
  if (!/^[a-z ]$/.test(key)) return
  if (key === ' ') e.preventDefault()

  if (!started.value) {
    started.value = true
    s = { ...s, startAt: Date.now() }
    session.value = s
    now.value = Date.now()
  }

  const result = feedKey(s, key)
  session.value = result.session

  for (const ev of result.events) {
    if (ev.type === 'char-error') {
      record(ev.char, ev.expect, ev.actual)
      if (drill.value) streak.value[ev.char] = 0
      flashError()
    } else if (ev.type === 'char-done' && drill.value) {
      const n = (streak.value[ev.char] ?? 0) + 1
      streak.value[ev.char] = n
      if (n >= 2) markMastered(ev.char)
    } else if (ev.type === 'session-done') {
      finish()
    }
  }
}

function onPractice(ids: string[]): void {
  const chars: string[] = []
  for (const ch of ids) {
    for (let i = 0; i < 3; i += 1) chars.push(ch)
  }
  chars.sort(() => Math.random() - 0.5)
  initSession(chars, true)
}

function closeResult(): void {
  router.push('/')
}

onMounted(async () => {
  const lv = level.value
  const stageId = lv ? (stageOfLevel(lv.id)?.id ?? '') : ''
  if (!lv || lv.type !== 'danzi' || !isStageUnlocked(stageId)) {
    router.replace('/')
    return
  }
  await ensureWubi86()
  const pool = await buildPool(lv)
  initSession(sample(pool, lv.length), false)
  window.addEventListener('keydown', onKeydown)
  tickTimer = window.setInterval(() => {
    if (started.value && session.value && !session.value.finished) now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (tickTimer) window.clearInterval(tickTimer)
  if (flashTimer) window.clearTimeout(flashTimer)
})
</script>

<template>
  <section class="practice">
    <div class="stats">
      <div class="stat">
        <span class="stat__label">速度</span>
        <span class="stat__value">{{ stats.speed.toFixed(0) }}</span>
        <span class="stat__unit">字/分</span>
      </div>
      <div class="stat">
        <span class="stat__label">正确率</span>
        <span class="stat__value">{{ Math.round(stats.accuracy * 100) }}%</span>
      </div>
      <div class="stat">
        <span class="stat__label">进度</span>
        <span class="stat__value">
          {{ Math.min((session?.cursor ?? 0) + 1, session?.items.length ?? 0) }}/{{
            session?.items.length ?? 0
          }}
        </span>
      </div>
    </div>

    <CharLine :items="lineItems" :error="flash" />

    <CodeHint
      v-if="currentItem"
      :char="currentItem.char"
      :code="currentItem.code"
      :items="hintItems"
      :input="session?.input ?? ''"
    />

    <KeyboardMap :highlight="nextKey" />

    <ResultModal
      :visible="showResult"
      :title="level?.title ?? '单字练习'"
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
.practice {
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
</style>
