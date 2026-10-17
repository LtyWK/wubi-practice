<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import KeyHeatmap from '@/components/KeyHeatmap.vue'
import StatsBar from '@/components/StatsBar.vue'
import TypingProgress from '@/components/TypingProgress.vue'
import TypingResult from '@/components/TypingResult.vue'
import { loadArticles, loadCommon3500, loadWords } from '@/data/loader'
import { findLevel, stageOfLevel } from '@/data/stages'
import { rankFromChars, rankFromEndlessChars, rankFromSpeed } from '@/engine/rank'
import {
  createTypingSession,
  feedBackspace,
  feedChar,
  typingStats,
  type TypingSession,
} from '@/engine/typing'
import { useFreeText } from '@/composables/useFreeText'
import { useLevels } from '@/composables/useLevels'
import { useSave } from '@/composables/useSave'
import { useTypingInput } from '@/composables/useTypingInput'
import type {
  Article,
  LevelRank,
  TypingConfig,
  TypingMode,
  TypingSource,
  WordsTable,
} from '@/types'

type ViewMode = TypingMode | 'free'

/** 单次目标（一组 / 一段 / 一篇）结算快照 */
interface ModeRecord {
  speed: number
  accuracy: number
  elapsedMs: number
  done: number
  keystrokes: number
  keySpeed: number
  codeLength: number
  freq: Record<string, number>
  errors: { char: string; input: string }[]
}

interface ShowResultOptions {
  title: string
  passed?: boolean
  passLabel?: string
  rank?: LevelRank
  nextLabel?: string
  record?: ModeRecord
  retry?: () => void
  next?: () => void
}

const route = useRoute()
const router = useRouter()
const { isStageUnlocked, syncUnlocks } = useLevels()
const {
  getTypingProgress,
  recordTypingGroup,
  reshuffleTyping,
  recordLevelResult,
  getEndlessBest,
  recordEndlessBest,
} = useSave()
const { freeTitle, freeText } = useFreeText()

const levelId = computed(() => String(route.params.id))
const isFree = computed(() => levelId.value === 'free')
const level = computed(() => (isFree.value ? undefined : findLevel(levelId.value)))
const config = computed<TypingConfig | undefined>(() => level.value?.typing)
const mode = computed<ViewMode>(() =>
  isFree.value ? 'free' : (config.value?.mode ?? 'climb'),
)
const require = computed(() => level.value?.require ?? { speed: 0, accuracy: 0 })

const pageTitle = computed(() => {
  if (isFree.value) return freeTitle.value || '自由练习'
  return level.value?.title ?? '跟打练习'
})

// ---------- 通用状态 ----------
const inputEl = ref<HTMLInputElement | null>(null)
const panelBox = ref<HTMLElement | null>(null)
const ready = ref(false)
const session = ref<TypingSession>(createTypingSession([]))
const now = ref(Date.now())
const keyFreq = ref<Record<string, number>>({})
const showHeatmap = ref(true)
/** 目标切换计数：用于长文本自动滚回当前字 */
const sessionToken = ref(0)

/** 组/段达标后的短暂提示，1200ms 后自动推进 */
const advancePending = ref(false)
const bannerText = ref('')
let advanceTimer: number | undefined

// ---------- 结果 ----------
const resultVisible = ref(false)
const resultRecord = ref<ModeRecord | null>(null)
const resultTitle = ref('')
const resultPassed = ref<boolean | undefined>(undefined)
const resultPassLabel = ref('')
const resultRank = ref<LevelRank | undefined>(undefined)
const resultNextLabel = ref('')
let resultRetryFn: (() => void) | null = null
let resultNextFn: (() => void) | null = null

const EMPTY_RECORD: ModeRecord = {
  speed: 0,
  accuracy: 1,
  elapsedMs: 0,
  done: 0,
  keystrokes: 0,
  keySpeed: 0,
  codeLength: 0,
  freq: {},
  errors: [],
}
const shownRecord = computed(() => resultRecord.value ?? EMPTY_RECORD)

// ---------- 统计 ----------
const liveStats = computed(() => typingStats(session.value, now.value))
const keyTotal = computed(() =>
  Object.values(keyFreq.value).reduce((sum, count) => sum + count, 0),
)
const keySpeed = computed(() =>
  liveStats.value.elapsedMs > 0 ? (keyTotal.value * 60000) / liveStats.value.elapsedMs : 0,
)
const codeLength = computed(() =>
  liveStats.value.done > 0 ? keyTotal.value / liveStats.value.done : 0,
)
const goalChars = computed(() => config.value?.charTarget ?? 0)
const displayDone = computed(() => liveStats.value.done)
const displayTotal = computed(() => {
  if (mode.value === 'sprint' || mode.value === 'endless') {
    return goalChars.value || session.value.target.length
  }
  return session.value.target.length
})

const errorCount = computed(() => session.value.errors.length)
const summaryText = computed(
  () => `总击键 ${keyTotal.value} · 错误 ${errorCount.value} · 码长 ${codeLength.value.toFixed(2)}`,
)

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** 合并多段成绩：速度/正确率取简单平均，用时与击键累加 */
function mergeRecords(records: ModeRecord[]): ModeRecord {
  const elapsedMs = records.reduce((sum, record) => sum + record.elapsedMs, 0)
  const done = records.reduce((sum, record) => sum + record.done, 0)
  const keystrokes = records.reduce((sum, record) => sum + record.keystrokes, 0)
  const freq: Record<string, number> = {}
  for (const record of records) {
    for (const [code, count] of Object.entries(record.freq)) {
      freq[code] = (freq[code] ?? 0) + count
    }
  }
  return {
    speed: average(records.map((record) => record.speed)),
    accuracy: average(records.map((record) => record.accuracy)),
    elapsedMs,
    done,
    keystrokes,
    keySpeed: elapsedMs > 0 ? (keystrokes * 60000) / elapsedMs : 0,
    codeLength: done > 0 ? keystrokes / done : 0,
    freq,
    errors: records.flatMap((record) => record.errors),
  }
}

function makeRecord(): ModeRecord {
  const finishedAt = session.value.finishedAt ?? Date.now()
  const stats = typingStats(session.value, finishedAt)
  const keystrokes = keyTotal.value
  return {
    speed: stats.speed,
    accuracy: stats.accuracy,
    elapsedMs: stats.elapsedMs,
    done: stats.done,
    keystrokes,
    keySpeed: stats.elapsedMs > 0 ? (keystrokes * 60000) / stats.elapsedMs : 0,
    codeLength: stats.done > 0 ? keystrokes / stats.done : 0,
    freq: { ...keyFreq.value },
    errors: session.value.errors.map((error) => ({
      char: session.value.target[error.index] ?? '',
      input: error.input,
    })),
  }
}

// ---------- 文本来源工具 ----------
function isHanChar(char: string): boolean {
  return /[\u3400-\u9fff]/.test(char)
}

function hanChars(text: string): string[] {
  return [...text].filter(isHanChar)
}

async function loadArraySource(source: TypingSource): Promise<string[]> {
  if (source === 'common3500') return loadCommon3500()
  if (source === 'words2' || source === 'words3' || source === 'words4') {
    const words = await loadWords()
    return words[source]
  }
  return []
}

async function loadChosenArticles(ids: string[] | undefined): Promise<Article[]> {
  const articles = await loadArticles()
  return (ids ?? [])
    .map((id) => articles.find((article) => article.id === id))
    .filter((article): article is Article => Boolean(article))
}

/** 手写 mulberry32：同一种子重建同一排列（存档只存种子） */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWith<T>(items: T[], rand: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

function shuffle<T>(items: T[]): T[] {
  return shuffleWith(items, Math.random)
}

/** 循环乱序拼接：用于冲刺/文章类长文本，避免同一轮内相邻重复 */
function rotatePool(base: string[], size: number): string[] {
  const pool = [...new Set(base)]
  if (pool.length === 0 || size <= 0) return []
  const out: string[] = []
  while (out.length < size) {
    const round = shuffle(pool)
    const prev = out[out.length - 1]
    if (prev !== undefined && round[0] === prev && round.length > 1) {
      const index = round.findIndex((char) => char !== prev)
      if (index > 0) {
        const tmp = round[0]
        round[0] = round[index]
        round[index] = tmp
      }
    }
    out.push(...round)
  }
  return out.slice(0, size)
}

// ---------- 目标与结果 ----------
function clearAdvance(): void {
  if (advanceTimer !== undefined) {
    window.clearTimeout(advanceTimer)
    advanceTimer = undefined
  }
  advancePending.value = false
  bannerText.value = ''
}

function showBanner(text: string): void {
  bannerText.value = text
  advancePending.value = true
}

function scheduleAdvance(action: () => void): void {
  if (advanceTimer !== undefined) window.clearTimeout(advanceTimer)
  advanceTimer = window.setTimeout(() => {
    advanceTimer = undefined
    advancePending.value = false
    bannerText.value = ''
    action()
  }, 1200)
}

function startTarget(chars: string[]): void {
  clearAdvance()
  resultVisible.value = false
  resultRecord.value = null
  keyFreq.value = {}
  session.value = createTypingSession(chars)
  sessionToken.value += 1
  now.value = Date.now()
  void nextTick(() => focusInput())
}

function showResult(options: ShowResultOptions): void {
  clearAdvance()
  resultRecord.value = options.record ?? makeRecord()
  resultTitle.value = options.title
  resultPassed.value = options.passed
  resultPassLabel.value = options.passLabel ?? ''
  resultRank.value = options.rank
  resultNextLabel.value = options.nextLabel ?? ''
  resultRetryFn = options.retry ?? null
  resultNextFn = options.next ?? null
  resultVisible.value = true
  now.value = Date.now()
}

function handleResultRetry(): void {
  const retry = resultRetryFn
  resultVisible.value = false
  resultRetryFn = null
  resultNextFn = null
  if (retry) retry()
}

function handleResultNext(): void {
  const next = resultNextFn
  resultVisible.value = false
  resultRetryFn = null
  resultNextFn = null
  if (next) next()
}

function goBack(): void {
  router.push(isFree.value ? '/free' : '/')
}

function handleResultClose(): void {
  goBack()
}

// ---------- 爬坡（S4/S5） ----------
const climbSource = ref<string[]>([])
const climbSeed = ref<number | undefined>(undefined)
const groupIndex = ref(0)
const currentGroup = ref(0)
const groupBests = ref<number[]>([])
const groupIsReview = ref(false)

const isClimb = computed(() => mode.value === 'climb')
const groupSize = computed(() => config.value?.groupSize ?? 10)
const groupSpeed = computed(() => config.value?.groupSpeed ?? 60)
const climbGroups = computed<string[][]>(() => {
  const sorted =
    climbSeed.value === undefined
      ? climbSource.value
      : shuffleWith(climbSource.value, mulberry32(climbSeed.value))
  const groups: string[][] = []
  for (let i = 0; i < sorted.length; i += groupSize.value) {
    groups.push(sorted.slice(i, i + groupSize.value))
  }
  return groups
})
const totalGroups = computed(() => climbGroups.value.length)
const climbSourceUnit = computed(() =>
  config.value?.source === 'common3500' ? '字' : '词',
)

function groupChars(index: number): string[] {
  const items = climbGroups.value[index] ?? []
  return items.flatMap((item) => [...item])
}

function rememberGroupBest(index: number, speed: number): void {
  const bests = [...groupBests.value]
  for (let i = bests.length; i < index; i += 1) bests[i] = 0
  bests[index] = Math.max(bests[index] ?? 0, speed)
  groupBests.value = bests
}

function startGroup(index: number): void {
  if (index < 0 || index >= totalGroups.value) return
  currentGroup.value = index
  groupIsReview.value = index < groupIndex.value
  startTarget(groupChars(index))
}

function onSelectGroup(index: number): void {
  if (!isClimb.value) return
  if (index >= groupIndex.value && index !== currentGroup.value) return
  startGroup(index)
}

function completeClimbLevel(): void {
  const bestSpeed = Math.max(0, ...groupBests.value)
  const lastStats = typingStats(session.value, session.value.finishedAt ?? Date.now())
  const rank = rankFromSpeed(bestSpeed, groupSpeed.value, lastStats.accuracy)
  recordLevelResult(levelId.value, bestSpeed, lastStats.accuracy, true, 0, rank)
  syncUnlocks()
  showResult({
    title: `${level.value?.title ?? '常用字爬坡'} · 通关`,
    passed: true,
    passLabel: `最佳单组 ${bestSpeed.toFixed(0)} 字/分 · 每组门槛 ${groupSpeed.value} 字/分`,
    rank,
    record: { ...makeRecord(), speed: bestSpeed },
    retry: () => startGroup(Math.min(currentGroup.value, totalGroups.value - 1)),
  })
}

function completeClimbGroup(): void {
  const index = currentGroup.value
  const stats = typingStats(session.value, session.value.finishedAt ?? Date.now())
  const chars = session.value.target.length
  const limitMs = (chars * 60000) / groupSpeed.value
  const passed = stats.elapsedMs <= limitMs + 1e-6

  if (groupIsReview.value) {
    // 复习旧组：记录最佳速度（内部取最大值，不倒退进度）
    recordTypingGroup(levelId.value, index + 1, stats.speed)
    rememberGroupBest(index, stats.speed)
    showBanner(`复习完成 · ${stats.speed.toFixed(0)} 字/分`)
    scheduleAdvance(() => {
      if (groupIndex.value >= totalGroups.value) completeClimbLevel()
      else startGroup(groupIndex.value)
    })
    return
  }

  if (!passed) {
    // 不达标不写进度，仅展示本组成绩以便立即重打
    showResult({
      title: `第 ${index + 1} 组未达标`,
      passed: false,
      passLabel: `每组 ${chars} 字 ≤${(limitMs / 1000).toFixed(1)} 秒（${groupSpeed.value} 字/分）`,
      record: makeRecord(),
      retry: () => startGroup(index),
    })
    return
  }

  // 新组达标：保存组最佳并推进到下一组
  recordTypingGroup(levelId.value, index + 1, stats.speed)
  rememberGroupBest(index, stats.speed)
  groupIndex.value = Math.max(groupIndex.value, index + 1)
  const next = index + 1
  const tail = next >= totalGroups.value ? '本关完成' : `即将进入第 ${next + 1} 组`
  showBanner(`本组达标 · ${stats.speed.toFixed(0)} 字/分 · ${tail}`)
  scheduleAdvance(() => {
    if (next >= totalGroups.value) completeClimbLevel()
    else startGroup(next)
  })
}

async function setupClimb(cfgValue: TypingConfig): Promise<boolean> {
  const source = await loadArraySource(cfgValue.source)
  const [start, end] = cfgValue.range ?? [0, source.length]
  climbSource.value = source.slice(start, end)
  const saved = getTypingProgress(levelId.value)
  climbSeed.value = saved?.shuffleSeed
  groupBests.value = [...(saved?.groupBests ?? [])]
  groupIndex.value = Math.min(Math.max(0, saved?.groupIndex ?? 0), climbGroups.value.length)
  if (climbGroups.value.length === 0) {
    router.replace('/')
    return false
  }
  startGroup(Math.min(groupIndex.value, totalGroups.value - 1))
  return true
}

function onReshuffle(): void {
  if (!isClimb.value) return
  if (!window.confirm('将打乱本关顺序并清除本关进度，确定？')) return
  const seed = Math.floor(Math.random() * 0xffffffff) || 1
  reshuffleTyping(levelId.value, seed)
  climbSeed.value = seed
  groupIndex.value = 0
  groupBests.value = []
  startGroup(0)
}

// ---------- 限时冲刺（S6） ----------
const sprintPool = ref<string[]>([])
const sprintRemaining = computed(() => {
  const duration = config.value?.durationSec ?? 180
  const startAt = session.value.startAt
  if (startAt === null) return duration
  return Math.max(0, duration - (now.value - startAt) / 1000)
})

function sprintExpired(): boolean {
  const startAt = session.value.startAt
  if (startAt === null) return false
  return Date.now() - startAt >= (config.value?.durationSec ?? 180) * 1000
}

function finishSprint(): void {
  if (resultVisible.value) return
  const record = makeRecord()
  const done = session.value.pos
  const target = config.value?.charTarget ?? 0
  const passed = done >= target
  const rank = rankFromChars(done, target)
  recordLevelResult(levelId.value, record.speed, record.accuracy, passed, 0, rank)
  syncUnlocks()
  showResult({
    title: '限时冲刺结束',
    passed,
    passLabel: `${config.value?.durationSec ?? 180} 秒内 ≥${target} 字 · 本局 ${done} 字`,
    rank,
    record,
    retry: () => startTarget(sprintPool.value),
  })
}

async function setupSprint(cfgValue: TypingConfig): Promise<boolean> {
  const chosen = await loadChosenArticles(cfgValue.articleIds)
  const base = chosen.flatMap((article) => hanChars(article.paragraphs.join('\n')))
  if (base.length === 0) {
    router.replace('/')
    return false
  }
  sprintPool.value = rotatePool(base, cfgValue.poolSize ?? 2000)
  startTarget(sprintPool.value)
  return true
}

// ---------- 逐段提速 / 综合测试共用段落状态 ----------
const segmentIndex = ref(0)
const segmentRecords = ref<ModeRecord[]>([])

function addSegmentRecord(record: ModeRecord): void {
  segmentRecords.value = [...segmentRecords.value, record]
}

// ---------- 逐段提速（S6） ----------
const speedSegments = ref<string[][]>([])

function speedupThreshold(index: number): number {
  const list = config.value?.speedup ?? []
  if (list.length === 0) return require.value.speed || 60
  return list[Math.min(index, list.length - 1)]
}

function startSpeedupSegment(index: number): void {
  if (index < 0 || index >= speedSegments.value.length) return
  segmentIndex.value = index
  startTarget(speedSegments.value[index])
}

function completeSpeedupSegment(): void {
  const index = segmentIndex.value
  const record = makeRecord()
  const threshold = speedupThreshold(index)
  if (record.speed < threshold) {
    showResult({
      title: `第 ${index + 1} 段未达标`,
      passed: false,
      passLabel: `本段要求 ≥${threshold} 字/分`,
      record,
      retry: () => startSpeedupSegment(index),
    })
    return
  }
  addSegmentRecord(record)
  if (index + 1 >= speedSegments.value.length) {
    finishSpeedupLevel()
    return
  }
  showBanner(`第 ${index + 1} 段达标 · ${record.speed.toFixed(0)} 字/分 · 即将进入第 ${index + 2} 段`)
  scheduleAdvance(() => startSpeedupSegment(index + 1))
}

function finishSpeedupLevel(): void {
  const merged = mergeRecords(segmentRecords.value)
  const rank = rankFromSpeed(merged.speed, require.value.speed || 60, merged.accuracy)
  recordLevelResult(levelId.value, merged.speed, merged.accuracy, true, 0, rank)
  syncUnlocks()
  showResult({
    title: `${level.value?.title ?? '逐段提速'} · 全篇通过`,
    passed: true,
    passLabel: `共 ${speedSegments.value.length} 段 · 平均 ${merged.speed.toFixed(0)} 字/分`,
    rank,
    record: merged,
    retry: () => {
      segmentRecords.value = []
      startSpeedupSegment(0)
    },
  })
}

async function setupSpeedup(cfgValue: TypingConfig): Promise<boolean> {
  const chosen = await loadChosenArticles(cfgValue.articleIds)
  const segments = chosen
    .flatMap((article) => article.paragraphs.map((paragraph) => hanChars(paragraph)))
    .filter((chars) => chars.length > 0)
  if (segments.length === 0) {
    router.replace('/')
    return false
  }
  speedSegments.value = segments
  segmentRecords.value = []
  startSpeedupSegment(0)
  return true
}

// ---------- 耐力（S6） ----------
const marathonTarget = ref<string[]>([])

function finishMarathon(): void {
  const record = makeRecord()
  const passed =
    record.speed >= require.value.speed && record.accuracy >= require.value.accuracy
  const rank = rankFromSpeed(record.speed, require.value.speed, record.accuracy)
  recordLevelResult(levelId.value, record.speed, record.accuracy, passed, 0, rank)
  syncUnlocks()
  showResult({
    title: passed ? `${level.value?.title ?? '耐力'} · 达标` : `${level.value?.title ?? '耐力'} · 未达标`,
    passed,
    passLabel: `≥${require.value.speed} 字/分 · 正确率 ≥${Math.round(require.value.accuracy * 100)}%`,
    rank,
    record,
    retry: () => startTarget(marathonTarget.value),
  })
}

async function setupMarathon(cfgValue: TypingConfig): Promise<boolean> {
  const chosen = await loadChosenArticles(cfgValue.articleIds)
  const chars = chosen.flatMap((article) => hanChars(article.paragraphs.join('\n')))
  if (chars.length === 0) {
    router.replace('/')
    return false
  }
  marathonTarget.value = chars
  startTarget(chars)
  return true
}

// ---------- 无尽（S6） ----------
const endlessPool = ref<string[]>([])
const endlessBest = ref(0)
const endlessRemaining = computed(() =>
  Math.max(0, (config.value?.errorLimit ?? 10) - session.value.errors.length),
)

function endlessErrorLimit(): number {
  return config.value?.errorLimit ?? 10
}

/** 按 7:2:1 权重随机混合二字/三字/四字词，拼至目标字数 */
function buildWordMix(words: WordsTable, size: number): string[] {
  const pools = [
    { list: words.words2, weight: 7 },
    { list: words.words3, weight: 2 },
    { list: words.words4, weight: 1 },
  ].filter((pool) => pool.list.length > 0)
  if (pools.length === 0) return []
  const totalWeight = pools.reduce((sum, pool) => sum + pool.weight, 0)
  const out: string[] = []
  while (out.length < size) {
    let pick = pools[pools.length - 1]
    let roll = Math.random() * totalWeight
    for (const pool of pools) {
      roll -= pool.weight
      if (roll <= 0) {
        pick = pool
        break
      }
    }
    const word = pick.list[Math.floor(Math.random() * pick.list.length)]
    out.push(...hanChars(word))
  }
  return out.slice(0, size)
}

function finishEndless(): void {
  if (resultVisible.value) return
  const record = makeRecord()
  const done = session.value.pos
  if (done > getEndlessBest()) recordEndlessBest(done)
  endlessBest.value = getEndlessBest()
  const target = config.value?.charTarget ?? 0
  const passed = done >= target
  const rank = rankFromEndlessChars(done, target)
  recordLevelResult(levelId.value, record.speed, record.accuracy, passed, 0, rank)
  syncUnlocks()
  showResult({
    title: '无尽词流结束',
    passed,
    passLabel: `单局 ≥${target} 字 · 本局 ${done} 字 · 历史纪录 ${endlessBest.value} 字`,
    rank,
    record,
    retry: () => startTarget(endlessPool.value),
  })
}

async function setupEndless(cfgValue: TypingConfig): Promise<boolean> {
  const words = await loadWords()
  endlessPool.value = buildWordMix(words, cfgValue.poolSize ?? 3000)
  if (endlessPool.value.length === 0) {
    router.replace('/')
    return false
  }
  endlessBest.value = getEndlessBest()
  startTarget(endlessPool.value)
  return true
}

// ---------- 毕业综合（S6） ----------
const gauntletTargets = ref<string[][]>([])
const gauntletSpeeds = ref<number[]>([])

function startGauntletSegment(index: number): void {
  if (index < 0 || index >= gauntletTargets.value.length) return
  segmentIndex.value = index
  startTarget(gauntletTargets.value[index])
}

function completeGauntletSegment(): void {
  const index = segmentIndex.value
  const record = makeRecord()
  const threshold = gauntletSpeeds.value[index] ?? 60
  if (record.speed < threshold) {
    showResult({
      title: `第 ${index + 1} 段未达标`,
      passed: false,
      passLabel: `本段要求 ≥${threshold} 字/分`,
      record,
      retry: () => startGauntletSegment(index),
    })
    return
  }
  addSegmentRecord(record)
  if (index + 1 >= gauntletTargets.value.length) {
    finishGauntlet()
    return
  }
  showBanner(`第 ${index + 1} 段达标 · ${record.speed.toFixed(0)} 字/分 · 即将进入第 ${index + 2} 段`)
  scheduleAdvance(() => startGauntletSegment(index + 1))
}

function finishGauntlet(): void {
  const merged = mergeRecords(segmentRecords.value)
  const rank = rankFromSpeed(merged.speed, require.value.speed || 60, merged.accuracy)
  recordLevelResult(levelId.value, merged.speed, merged.accuracy, true, 0, rank)
  syncUnlocks()
  showResult({
    title: `${level.value?.title ?? '毕业综合'} · 全部通过`,
    passed: true,
    passLabel: `共 ${gauntletTargets.value.length} 段 · 平均 ${merged.speed.toFixed(0)} 字/分`,
    rank,
    record: merged,
    retry: () => {
      segmentRecords.value = []
      startGauntletSegment(0)
    },
  })
}

async function setupGauntlet(cfgValue: TypingConfig): Promise<boolean> {
  const targets: string[][] = []
  const speeds: number[] = []
  for (const segment of cfgValue.segments ?? []) {
    let chars: string[] = []
    if (segment.source === 'article') {
      const chosen = await loadChosenArticles(segment.articleIds)
      const all = chosen.flatMap((article) => hanChars(article.paragraphs.join('\n')))
      chars = typeof segment.count === 'number' ? all.slice(0, segment.count) : all
    } else {
      const items = await loadArraySource(segment.source)
      const [start, end] = segment.range ?? [0, items.length]
      const picked = items.slice(start, end)
      const limited = typeof segment.count === 'number' ? picked.slice(0, segment.count) : picked
      chars = shuffle(limited.flatMap((item) => hanChars(item)))
    }
    if (chars.length > 0) {
      targets.push(chars)
      speeds.push(segment.speed)
    }
  }
  if (targets.length === 0) {
    router.replace('/')
    return false
  }
  gauntletTargets.value = targets
  gauntletSpeeds.value = speeds
  segmentRecords.value = []
  startGauntletSegment(0)
  return true
}

// ---------- 自由模式 ----------
function setupFree(): boolean {
  const chars = hanChars(freeText.value)
  if (chars.length === 0) {
    router.replace('/free')
    return false
  }
  startTarget(chars)
  return true
}

function finishFree(): void {
  showResult({
    title: '自由练习完成',
    record: makeRecord(),
    retry: () => startTarget(hanChars(freeText.value)),
  })
}

// ---------- 输入处理 ----------
function canInput(): boolean {
  return (
    ready.value &&
    !resultVisible.value &&
    !advancePending.value &&
    session.value.finishedAt === null
  )
}

function onKey(code: string): void {
  keyFreq.value[code] = (keyFreq.value[code] ?? 0) + 1
}

function onTargetComplete(): void {
  switch (mode.value) {
    case 'climb':
      completeClimbGroup()
      break
    case 'sprint':
      finishSprint()
      break
    case 'speedup':
      completeSpeedupSegment()
      break
    case 'marathon':
      finishMarathon()
      break
    case 'endless':
      finishEndless()
      break
    case 'gauntlet':
      completeGauntletSegment()
      break
    default:
      finishFree()
      break
  }
}

function onText(text: string): void {
  if (!canInput()) return
  if (mode.value === 'sprint' && sprintExpired()) {
    finishSprint()
    return
  }
  if (mode.value === 'endless' && session.value.errors.length >= endlessErrorLimit()) {
    finishEndless()
    return
  }

  for (const char of text) {
    if (!canInput()) break
    const result = feedChar(session.value, char, Date.now())
    session.value = result.session
    if (result.events.some((event) => event.type === 'complete')) {
      onTargetComplete()
      break
    }
    if (mode.value === 'endless' && session.value.errors.length >= endlessErrorLimit()) {
      finishEndless()
      break
    }
    if (mode.value === 'sprint' && sprintExpired()) {
      finishSprint()
      break
    }
  }
  now.value = Date.now()
}

function onBackspace(): void {
  if (!canInput()) return
  if (mode.value === 'sprint' && sprintExpired()) {
    finishSprint()
    return
  }
  session.value = feedBackspace(session.value, Date.now()).session
  now.value = Date.now()
}

const { focus: focusInput, commit } = useTypingInput(inputEl, {
  onText,
  onBackspace,
  onKey,
  enabled: canInput,
})

/** 测试/程序化注入：与真实提交走同一条过滤与判定路径 */
function feed(text: string): void {
  commit(text)
}

defineExpose({ feed })

// ---------- 推进 / 重开 ----------
function restart(): void {
  if (!ready.value) return
  clearAdvance()
  resultVisible.value = false
  switch (mode.value) {
    case 'climb':
      startGroup(Math.min(currentGroup.value, Math.max(0, totalGroups.value - 1)))
      break
    case 'sprint':
      startTarget(sprintPool.value)
      break
    case 'speedup':
      startSpeedupSegment(segmentIndex.value)
      break
    case 'marathon':
      startTarget(marathonTarget.value)
      break
    case 'endless':
      startTarget(endlessPool.value)
      break
    case 'gauntlet':
      startGauntletSegment(segmentIndex.value)
      break
    default:
      setupFree()
      break
  }
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.isComposing || !ready.value) return
  event.preventDefault()
  restart()
}

// ---------- 实时显示 ----------
const modeInfo = computed(() => {
  switch (mode.value) {
    case 'climb':
      if (totalGroups.value === 0) return ''
      return `第 ${Math.min(currentGroup.value + 1, totalGroups.value)}/${totalGroups.value} 组 · 每组 ${groupSize.value} ${climbSourceUnit.value} · 门槛 ≥${groupSpeed.value} 字/分`
    case 'sprint':
      return `剩余 ${formatClock(sprintRemaining.value)} · 目标 ${goalChars.value} 字`
    case 'speedup':
      return `第 ${segmentIndex.value + 1}/${speedSegments.value.length} 段 · 本段要求 ≥${speedupThreshold(segmentIndex.value)} 字/分`
    case 'endless':
      return `已打 ${liveStats.value.done} 字 · 纪录 ${endlessBest.value} 字 · 剩余错误 ${endlessRemaining.value} 次`
    case 'gauntlet':
      return `第 ${segmentIndex.value + 1}/${gauntletTargets.value.length} 段 · 本段要求 ≥${gauntletSpeeds.value[segmentIndex.value] ?? 0} 字/分`
    case 'marathon':
      return `一次打完 · 达标 ≥${require.value.speed} 字/分 · 正确率 ≥${Math.round(require.value.accuracy * 100)}%`
    default:
      return '自由练习 · 不计关卡进度'
  }
})

function charClass(index: number): Record<string, boolean> {
  const pos = session.value.pos
  return {
    'tv-char--done': index < pos,
    'tv-char--active': index === pos,
    'tv-char--error': index === pos && session.value.errorSlot !== null,
    'tv-char--pending': index > pos,
  }
}

function displayChar(index: number): string {
  if (index === session.value.pos && session.value.errorSlot !== null) {
    return session.value.errorSlot
  }
  return session.value.target[index] ?? ''
}

/** 长文本跟随当前字滚动；新目标（sessionToken 变化）重新定位 */
watch(
  () => [sessionToken.value, session.value.pos] as const,
  async () => {
    await nextTick()
    const el = panelBox.value?.querySelector<HTMLElement>('.tv-char[data-active="true"]')
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  },
)

// ---------- 生命周期 ----------
let tickTimer: number | undefined
let disposed = false

function startTick(): void {
  if (tickTimer !== undefined) return
  tickTimer = window.setInterval(() => {
    if (session.value.startAt === null || resultVisible.value) return
    now.value = Date.now()
    if (mode.value === 'sprint' && sprintExpired()) finishSprint()
  }, 100)
}

async function setupMode(cfgValue: TypingConfig): Promise<boolean> {
  switch (cfgValue.mode) {
    case 'climb':
      return setupClimb(cfgValue)
    case 'sprint':
      return setupSprint(cfgValue)
    case 'speedup':
      return setupSpeedup(cfgValue)
    case 'marathon':
      return setupMarathon(cfgValue)
    case 'endless':
      return setupEndless(cfgValue)
    case 'gauntlet':
      return setupGauntlet(cfgValue)
    default:
      return false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onWindowKeydown)

  if (isFree.value) {
    if (!setupFree()) return
    ready.value = true
    startTick()
    return
  }

  const lv = level.value
  if (!lv || lv.type !== 'typing' || !lv.typing) {
    router.replace('/')
    return
  }
  const stageId = stageOfLevel(lv.id)?.id ?? ''
  if (!isStageUnlocked(stageId)) {
    router.replace('/')
    return
  }
  const ok = await setupMode(lv.typing)
  if (!ok || disposed) return
  ready.value = true
  startTick()
})

onUnmounted(() => {
  disposed = true
  window.removeEventListener('keydown', onWindowKeydown)
  if (tickTimer !== undefined) window.clearInterval(tickTimer)
  clearAdvance()
})
</script>

<template>
  <section class="typing">
    <header class="typing__bar">
      <button type="button" class="typing__back" @click="goBack">← 返回</button>
      <h1 class="typing__title">{{ pageTitle }}</h1>
      <div class="typing__actions">
        <button v-if="isClimb" type="button" class="typing__btn" @click="onReshuffle">
          重新随机
        </button>
        <button type="button" class="typing__btn" @click="restart">重开</button>
      </div>
    </header>

    <StatsBar
      :speed="liveStats.speed"
      :accuracy="liveStats.accuracy"
      :done="displayDone"
      :total="displayTotal"
      :elapsed-sec="liveStats.elapsedMs / 1000"
      :keystrokes="keySpeed"
      :code-length="codeLength"
    />

    <p v-if="ready && !resultVisible" class="typing__mode">{{ modeInfo }}</p>

    <p v-if="!ready" class="typing__loading">加载中…</p>

    <template v-else-if="!resultVisible">
      <section class="typing__stage" @click="focusInput">
        <input
          ref="inputEl"
          class="typing__input"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          aria-label="跟打输入"
        />
        <div v-if="advancePending" class="typing__banner">{{ bannerText }}</div>
        <div
          ref="panelBox"
          class="typing__target"
          :class="isClimb || mode === 'gauntlet' ? 'typing__target--grid' : 'typing__target--flow'"
        >
          <span
            v-for="(char, index) in session.target"
            :key="`${index}-${char}`"
            class="tv-char"
            :class="charClass(index)"
            :data-index="index"
            :data-active="index === session.pos ? 'true' : undefined"
            :title="
              index === session.pos && session.errorSlot
                ? `错误输入：${session.errorSlot} · 正确：${char}`
                : undefined
            "
            >{{ displayChar(index) }}</span
          >
        </div>
        <p v-if="session.errorSlot" class="typing__error-hint">
          当前应为「{{ session.target[session.pos] }}」，刚输入「{{ session.errorSlot }}」
        </p>
      </section>

      <TypingProgress
        v-if="isClimb"
        :total="totalGroups"
        :done="groupIndex"
        :current="currentGroup"
        :bests="groupBests"
        clickable
        @select="onSelectGroup"
      />

      <div class="typing__bottom">
        <div class="typing__tools">
          <button type="button" class="typing__btn" @click="showHeatmap = !showHeatmap">
            {{ showHeatmap ? '键频：开' : '键频：关' }}
          </button>
          <button
            v-if="mode === 'endless'"
            type="button"
            class="typing__btn"
            @click="finishEndless"
          >
            结束本局
          </button>
        </div>
        <KeyHeatmap v-if="showHeatmap" :freq="keyFreq" compact />
        <p class="typing__summary">{{ summaryText }}</p>
      </div>
    </template>

    <TypingResult
      v-if="resultVisible"
      :title="resultTitle"
      :speed="shownRecord.speed"
      :accuracy="shownRecord.accuracy"
      :elapsed-ms="shownRecord.elapsedMs"
      :keystrokes="shownRecord.keystrokes"
      :key-speed="shownRecord.keySpeed"
      :code-length="shownRecord.codeLength"
      :rank="resultRank"
      :passed="resultPassed"
      :pass-label="resultPassLabel"
      :freq="shownRecord.freq"
      :errors="shownRecord.errors"
      :next-label="resultNextLabel || undefined"
      @retry="handleResultRetry"
      @next="handleResultNext"
      @close="handleResultClose"
    />
  </section>
</template>

<style scoped>
.typing {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.typing__bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.typing__back {
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  white-space: nowrap;
}

.typing__back:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.typing__title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--font-lg);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.typing__actions {
  display: flex;
  gap: var(--space-2);
}

.typing__btn {
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  white-space: nowrap;
}

.typing__btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.typing__mode {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  text-align: center;
}

.typing__loading {
  padding: var(--space-6);
  color: var(--color-text-muted);
  text-align: center;
}

.typing__stage {
  position: relative;
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  cursor: text;
}

/* 透明输入框覆盖练习区：捕获 IME 事件，不显示输入内容 */
.typing__input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  color: transparent;
  opacity: 0;
  font-size: 16px;
  cursor: text;
}

.typing__banner {
  position: relative;
  z-index: 2;
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-success);
  border-radius: var(--radius-md);
  background: var(--color-success-weak);
  color: var(--color-success);
  font-size: var(--font-sm);
  font-weight: 600;
  text-align: center;
}

.typing__target {
  position: relative;
  z-index: 2;
  pointer-events: none;
  user-select: text;
}

.typing__target--flow {
  max-height: 42vh;
  min-height: 96px;
  overflow-y: auto;
  padding-right: var(--space-2);
  scrollbar-width: thin;
  font-size: 1.375rem;
  line-height: 2;
  letter-spacing: 0.12em;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.typing__target--grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: var(--space-2);
  justify-items: center;
  max-height: 42vh;
  overflow-y: auto;
  padding: var(--space-2) 0;
  font-size: 1.75rem;
  line-height: 1.6;
  scrollbar-width: thin;
}

.tv-char {
  border-radius: var(--radius-sm);
  transition: color 0.12s;
}

.tv-char--pending {
  color: var(--text-pending);
}

.tv-char--done {
  color: var(--text-done);
}

.tv-char--active {
  color: var(--color-text);
  font-weight: 700;
  padding: 0 2px;
  background: var(--text-active-bg);
  box-shadow: inset 0 -2px 0 var(--color-primary);
}

.tv-char--error {
  color: var(--text-wrong);
  text-decoration: underline wavy var(--text-wrong);
  text-underline-offset: 5px;
  box-shadow: inset 0 -2px 0 var(--text-wrong);
}

.typing__error-hint {
  position: relative;
  z-index: 2;
  margin-top: var(--space-2);
  color: var(--text-wrong);
  font-size: var(--font-sm);
  text-align: center;
}

.typing__bottom {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.typing__tools {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.typing__summary {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  text-align: center;
}

@media (max-width: 640px) {
  .typing__bar {
    flex-wrap: wrap;
    justify-content: center;
  }

  .typing__title {
    order: -1;
    flex-basis: 100%;
    white-space: normal;
  }

  .typing__stage {
    padding: var(--space-4);
  }

  .typing__target--grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    font-size: 1.4rem;
  }

  .typing__target--flow {
    font-size: 1.15rem;
    max-height: 36vh;
  }
}
</style>
