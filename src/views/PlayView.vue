<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CodeHint from '@/components/CodeHint.vue'
import ResultModal from '@/components/ResultModal.vue'
import StatsBar from '@/components/StatsBar.vue'
import TextPanel from '@/components/TextPanel.vue'
import VirtualKeyboard from '@/components/VirtualKeyboard.vue'
import { loadArticles, loadZigen } from '@/data/loader'
import { buildPool, isHan, sample } from '@/data/pool'
import { LEVEL1_CHARS } from '@/data/short1'
import { findLevel, stageOfLevel } from '@/data/stages'
import { buildDrillPool } from '@/engine/drill'
import { createSession, feedKey, type PracticeSession } from '@/engine/judge'
import { checkTimeout, elapsed, startChar, type CharTimer } from '@/engine/timer'
import { ensureWubi86, wubi86 } from '@/schemes/wubi86'
import { playKeySound } from '@/audio/sound'
import { useFreeText } from '@/composables/useFreeText'
import { useUiSettings } from '@/composables/useUiSettings'
import { useLevels } from '@/composables/useLevels'
import { useMistakes } from '@/composables/useMistakes'
import { useSave } from '@/composables/useSave'
import type {
  Article,
  KeyFeedback,
  LevelConfig,
  MistakeOption,
  TextCharState,
  ZigenItem,
} from '@/types'

const route = useRoute()
const router = useRouter()
const { isStageUnlocked, recordResult } = useLevels()
const { record, markMastered } = useMistakes()
const { save, recordCharDone, recordCharError } = useSave()
const { freeTitle, freeText } = useFreeText()
const { soundOn, volume, setVolume } = useUiSettings()
const volumeOpen = ref(false)

function onVolumeInput(e: Event): void {
  setVolume(Number((e.target as HTMLInputElement).value) / 100)
}

function testSound(): void {
  if (soundOn.value) playKeySound('ok', volume.value)
}

const levelId = computed(() => String(route.params.id))
const isFree = computed(() => levelId.value === 'free')
const level = computed<LevelConfig | undefined>(() =>
  isFree.value ? undefined : findLevel(levelId.value),
)
const isZigen = computed(() => level.value?.type === 'zigen')
const mode = computed<'zigen' | 'text'>(() => (isZigen.value ? 'zigen' : 'text'))
const articleMode = computed(() => level.value?.type === 'article' || isFree.value)

/** 键盘按键上显示的完整字根表 */
const keyRoots = computed<Record<string, string[]>>(() => {
  const out: Record<string, string[]> = {}
  for (const [key, item] of Object.entries(zigenMap.value)) {
    out[key] = item.radicals
  }
  return out
})

// ---------- 通用状态 ----------
const now = ref(Date.now())
const started = ref(false)
const finished = ref(false)
const showResult = ref(false)
const drill = ref(false)
const feedback = ref<KeyFeedback | null>(null)
const sticky = ref<KeyFeedback | null>(null)
const charTimer = ref<CharTimer>(startChar(0))
const sessionStartAt = ref(0)
const timeouts = ref(0)
const streak = ref<Record<string, number>>({})
const zigenMap = ref<Record<string, ZigenItem>>({})
const articleTitle = ref('')

let tickTimer: number | undefined
let timeoutTimer: number | undefined
let fbTimer: number | undefined

// ---------- 字根模式 ----------
/** 字根练习题：目标字根与对应键位 */
interface ZigenTask {
  key: string
  root: string
}
const zigenQueue = ref<ZigenTask[]>([])
const zigenIndex = ref(0)
const zigenWrong = ref<boolean[]>([])
const zigenCorrectKeys = ref(0)
const zigenTotalKeys = ref(0)
const zigenErrors = ref<Record<string, number>>({})

// ---------- 文本模式 ----------
const session = ref<PracticeSession | null>(null)
const displayMap = ref<{ char: string; input: number }[]>([])

// ---------- 统计 ----------
const doneCount = computed(() =>
  mode.value === 'zigen' ? zigenIndex.value : (session.value?.cursor ?? 0),
)
const totalCount = computed(() =>
  mode.value === 'zigen' ? zigenQueue.value.length : (session.value?.items.length ?? 0),
)
const correctKeys = computed(() =>
  mode.value === 'zigen' ? zigenCorrectKeys.value : (session.value?.correctKeys ?? 0),
)
const totalKeys = computed(() =>
  mode.value === 'zigen' ? zigenTotalKeys.value : (session.value?.totalKeys ?? 0),
)
const stats = computed(() => {
  const elapsedMs = sessionStartAt.value > 0 ? Math.max(0, now.value - sessionStartAt.value) : 0
  const elapsedSec = elapsedMs / 1000
  const speed = elapsedSec > 0 ? (doneCount.value / elapsedSec) * 60 : 0
  const accuracy = totalKeys.value === 0 ? 1 : correctKeys.value / totalKeys.value
  return { speed, accuracy, elapsedSec }
})
const unit = computed(() => (isZigen.value ? '键/分' : '字/分'))

// ---------- 文本展示 ----------
function stateOf(state: string, wrong: boolean): TextCharState {
  if (state === 'done') return wrong ? 'done-wrong' : 'done-clean'
  return state === 'active' ? 'active' : 'pending'
}

/** 从键位池生成字根练习题（每个题随机取该键的一个字根） */
function makeZigenTasks(pool: string[], count: number): ZigenTask[] {
  const out: ZigenTask[] = []
  for (let i = 0; i < count; i += 1) {
    const key = pool[Math.floor(Math.random() * pool.length)]
    const roots = zigenMap.value[key]?.radicals ?? []
    const root =
      roots.length > 0 ? roots[Math.floor(Math.random() * roots.length)] : key.toUpperCase()
    out.push({ key, root })
  }
  return out
}

const zigenItems = computed<{ char: string; state: TextCharState }[]>(() =>
  zigenQueue.value.map((task, i) => {
    let state: TextCharState = 'pending'
    if (i < zigenIndex.value) state = zigenWrong.value[i] ? 'done-wrong' : 'done-clean'
    else if (i === zigenIndex.value) state = 'active'
    return { char: task.root, state }
  }),
)

const danziItems = computed<{ char: string; state: TextCharState }[]>(() =>
  (session.value?.items ?? []).map((it) => ({
    char: it.char,
    state: stateOf(it.state, it.wrongAttempts.length > 0),
  })),
)

const articleItems = computed<{ char: string; state: TextCharState }[]>(() => {
  const s = session.value
  if (!s) return []
  return displayMap.value.map((d, i) => {
    if (d.input >= 0) {
      const item = s.items[d.input]
      if (!item) return { char: d.char, state: 'pending' as TextCharState }
      return { char: d.char, state: stateOf(item.state, item.wrongAttempts.length > 0) }
    }
    if (d.char === '\n') return { char: '\n', state: 'skip' as TextCharState }
    let prev = -1
    for (let j = i - 1; j >= 0; j -= 1) {
      if (displayMap.value[j].input >= 0) {
        prev = displayMap.value[j].input
        break
      }
    }
    const prevItem = prev >= 0 ? s.items[prev] : undefined
    const done = prevItem ? prevItem.state === 'done' : false
    return { char: d.char, state: done ? 'skip' : 'pending' }
  })
})

const textItems = computed(() => {
  if (mode.value === 'zigen') return zigenItems.value
  if (articleMode.value) return articleItems.value
  return danziItems.value
})

/** 标题：大关（阶段）· 小关 */
const panelTitle = computed(() => {
  const lv = level.value
  const stage = lv ? stageOfLevel(lv.id) : undefined
  if (articleMode.value) {
    const base = articleTitle.value || '自由练习'
    return stage ? `${stage.title} · ${base}` : base
  }
  if (!lv) return ''
  return stage ? `${stage.title} · ${lv.title}` : lv.title
})

// ---------- 下一步按键 ----------
const highlight = computed(() => {
  if (mode.value === 'zigen') return zigenQueue.value[zigenIndex.value]?.key ?? ''
  const s = session.value
  if (!s || s.finished) return ''
  const item = s.items[s.cursor]
  if (!item) return ''
  if (s.input.length > 0 && item.shorts.includes(s.input)) return ' '
  return item.code[s.input.length] ?? ''
})

const currentHint = computed(() => {
  if (mode.value === 'zigen') return null
  const s = session.value
  if (!s || s.finished) return null
  const item = s.items[s.cursor]
  if (!item) return null
  return { char: item.char, code: item.code, items: wubi86.hint(item.char), input: s.input }
})

// ---------- 达标与结算 ----------
const requirement = computed(() => level.value?.require ?? { speed: 20, accuracy: 0.85 })
const passed = computed(() => {
  if (!level.value) return true
  return stats.value.speed >= requirement.value.speed &&
    stats.value.accuracy >= requirement.value.accuracy
})

const options = computed<MistakeOption[]>(() => {
  if (mode.value === 'zigen') {
    return Object.entries(zigenErrors.value).map(([key, count]) => ({
      id: key,
      main: key.toUpperCase(),
      detail: `错误 ${count} 次`,
    }))
  }
  const s = session.value
  const list: MistakeOption[] = []
  if (s) {
    for (const it of s.items) {
      if (it.wrongAttempts.length > 0) {
        list.push({
          id: it.char,
          main: it.char,
          detail: `${it.code.toUpperCase()} · 错 ${it.wrongAttempts.length} 次 · 最近 ${
            it.wrongAttempts[it.wrongAttempts.length - 1]
          }`,
        })
      }
    }
  }
  if (list.length === 0) {
    return buildDrillPool(save.value.stats, 10).map((c) => ({
      id: c.char,
      main: c.char,
      detail: `错误率 ${Math.round(c.errorRate * 100)}% · 均耗时 ${(c.avgMs / 1000).toFixed(1)}s（智能推荐）`,
    }))
  }
  return list
})

// ---------- 初始化 ----------
function resetCommon(): void {
  finished.value = false
  started.value = false
  showResult.value = false
  feedback.value = null
  sticky.value = null
  timeouts.value = 0
  sessionStartAt.value = 0
  charTimer.value = startChar(0)
  now.value = Date.now()
}

function initZigen(queue: ZigenTask[], isDrill = false): void {
  resetCommon()
  drill.value = isDrill
  zigenQueue.value = queue
  zigenIndex.value = 0
  zigenWrong.value = new Array(queue.length).fill(false)
  zigenCorrectKeys.value = 0
  zigenTotalKeys.value = 0
  zigenErrors.value = {}
}

function initText(chars: string[], isDrill = false): void {
  resetCommon()
  drill.value = isDrill
  streak.value = {}
  session.value = createSession(chars, wubi86, 0)
  displayMap.value = chars.map((c, i) => ({ char: c, input: i }))
}

function buildDisplay(text: string): void {
  const map: { char: string; input: number }[] = []
  let ci = 0
  for (const c of text) {
    if (isHan(c)) {
      map.push({ char: c, input: ci })
      ci += 1
    } else {
      map.push({ char: c, input: -1 })
    }
  }
  displayMap.value = map
}

async function initArticle(lv: LevelConfig): Promise<void> {
  const articles = await loadArticles()
  const chosen = (lv.articleIds ?? [])
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is Article => Boolean(a))
  if (chosen.length === 0) {
    router.replace('/')
    return
  }
  const text = chosen.map((a) => a.paragraphs.join('\n')).join('\n')
  articleTitle.value = chosen.map((a) => `《${a.title}》${a.author}`).join('　')
  const chars = [...text].filter(isHan)
  initText(chars)
  buildDisplay(text)
}

// ---------- 按键处理 ----------
function startIfNeeded(): void {
  if (started.value) return
  started.value = true
  sessionStartAt.value = Date.now()
  charTimer.value = startChar(Date.now())
  if (session.value) session.value = { ...session.value, startAt: sessionStartAt.value }
}

function setFeedback(key: string, type: KeyFeedback['type'], keep = true): void {
  if (soundOn.value) playKeySound(type, volume.value)
  feedback.value = { key, type }
  if (keep && type !== 'timeout') sticky.value = { key, type }
  if (fbTimer) window.clearTimeout(fbTimer)
  fbTimer = window.setTimeout(() => {
    feedback.value = null
  }, 350)
}

function handleZigenKey(key: string): void {
  if (!/^[a-z]$/.test(key)) return
  zigenTotalKeys.value += 1
  const expect = zigenQueue.value[zigenIndex.value]?.key
  if (key === expect) {
    zigenCorrectKeys.value += 1
    setFeedback(key, 'ok')
    zigenIndex.value += 1
    charTimer.value = startChar(Date.now())
    if (zigenIndex.value >= zigenQueue.value.length) finish()
  } else {
    zigenErrors.value[key] = (zigenErrors.value[key] ?? 0) + 1
    zigenWrong.value[zigenIndex.value] = true
    setFeedback(key, 'bad')
    charTimer.value = startChar(Date.now())
  }
}

function handleTextKey(key: string): void {
  const s = session.value
  if (!s) return
  const result = feedKey(s, key)
  session.value = result.session
  for (const ev of result.events) {
    if (ev.type === 'key-accept') setFeedback(key, 'ok')
    else if (ev.type === 'key-reject') setFeedback(key, 'bad')
    if (ev.type === 'char-error') {
      record(ev.char, ev.expect, ev.actual)
      recordCharError(ev.char)
      if (drill.value) streak.value[ev.char] = 0
    } else if (ev.type === 'char-done') {
      recordCharDone(ev.char, elapsed(charTimer.value, Date.now()))
      if (drill.value) {
        const n = (streak.value[ev.char] ?? 0) + 1
        streak.value[ev.char] = n
        if (n >= 2) markMastered(ev.char)
      }
      charTimer.value = startChar(Date.now())
    } else if (ev.type === 'session-done') {
      finish()
    }
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (finished.value) return
  const key = e.key.toLowerCase()
  if (!/^[a-z ]$/.test(key)) return
  if (key === ' ') e.preventDefault()
  startIfNeeded()
  if (mode.value === 'zigen') handleZigenKey(key)
  else handleTextKey(key)
}

function onTimeoutTick(): void {
  if (!started.value || finished.value) return
  const timeoutMs = level.value?.timeoutMs ?? 4000
  const r = checkTimeout(charTimer.value, timeoutMs, Date.now())
  if (r.timedOut) {
    charTimer.value = r.timer
    timeouts.value += 1
    const key = highlight.value
    if (key) setFeedback(key, 'timeout', false)
  }
}

// ---------- 结算与加练 ----------
function finish(): void {
  finished.value = true
  now.value = Date.now()
  showResult.value = true
  const lv = level.value
  if (lv) {
    recordResult(lv.id, stats.value.speed, stats.value.accuracy, passed.value, timeouts.value)
  }
}

function onPractice(ids: string[]): void {
  if (mode.value === 'zigen') {
    const tasks: ZigenTask[] = []
    for (const key of ids) {
      tasks.push(...makeZigenTasks([key, key, key], 3))
    }
    tasks.sort(() => Math.random() - 0.5)
    initZigen(tasks, true)
    return
  }
  const repeated: string[] = []
  for (const id of ids) {
    for (let i = 0; i < 3; i += 1) repeated.push(id)
  }
  repeated.sort(() => Math.random() - 0.5)
  initText(repeated, true)
}

function closeResult(): void {
  router.push('/')
}

// ---------- 生命周期 ----------
onMounted(async () => {
  await ensureWubi86()
  const zigenData = await loadZigen()
  zigenMap.value = Object.fromEntries(zigenData.map((z) => [z.key, z]))

  if (isFree.value) {
    if (!freeText.value) {
      router.replace('/free')
      return
    }
    articleTitle.value = freeTitle.value || '自由练习'
    const text = freeText.value
    const chars = [...text].filter(isHan)
    initText(chars)
    buildDisplay(text)
  } else {
    const lv = level.value
    if (!lv) {
      router.replace('/')
      return
    }
    const stageId = stageOfLevel(lv.id)?.id ?? ''
    if (!isStageUnlocked(stageId)) {
      router.replace('/')
      return
    }
    if (lv.type === 'zigen') {
      initZigen(makeZigenTasks(lv.pool, lv.length))
    } else if (lv.type === 'article') {
      await initArticle(lv)
    } else {
      const pool = await buildPool(lv)
      initText(sample(pool, lv.length))
    }
  }

  window.addEventListener('keydown', onKeydown)
  tickTimer = window.setInterval(() => {
    if (started.value && !finished.value) now.value = Date.now()
  }, 1000)
  timeoutTimer = window.setInterval(onTimeoutTick, 200)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (tickTimer) window.clearInterval(tickTimer)
  if (timeoutTimer) window.clearInterval(timeoutTimer)
  if (fbTimer) window.clearTimeout(fbTimer)
})
</script>

<template>
  <section class="play">
    <StatsBar
      :speed="stats.speed"
      :accuracy="stats.accuracy"
      :done="doneCount"
      :total="totalCount"
      :elapsed-sec="stats.elapsedSec"
      :timeouts="timeouts"
      :unit="unit"
    />

    <TextPanel :items="textItems" :title="panelTitle" />

    <CodeHint
      v-if="currentHint"
      :char="currentHint.char"
      :code="currentHint.code"
      :items="currentHint.items"
      :input="currentHint.input"
    />

    <div class="keyboard-wrap">
      <div class="volume">
        <button class="volume__btn" @click="volumeOpen = !volumeOpen">
          {{ soundOn ? `音量 ${Math.round(volume * 100)}%` : '音效已关闭' }}
        </button>
        <div v-if="volumeOpen" class="volume__panel">
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
          <button class="volume__test" :disabled="!soundOn" @click="testSound">试听</button>
        </div>
      </div>
      <VirtualKeyboard
        :highlight="highlight"
        :feedback="feedback"
        :sticky="sticky"
        :roots="keyRoots"
        :short1="LEVEL1_CHARS"
        :disabled="finished"
      />
    </div>

    <ResultModal
      :visible="showResult"
      :title="panelTitle || level?.title || '练习结算'"
      :stats="stats"
      :passed="passed"
      :requirement="requirement"
      :options="options"
      :show-pass="!isFree"
      @practice="onPractice"
      @close="closeResult"
    />
  </section>
</template>

<style scoped>
.play {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.keyboard-wrap {
  position: relative;
}

.volume {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-2);
  position: relative;
}

.volume__btn {
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.volume__btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.volume__panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.volume__range {
  width: 150px;
  accent-color: var(--color-primary);
}

.volume__test {
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-sm);
}

.volume__test:disabled,
.volume__range:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
