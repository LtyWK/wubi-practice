<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CodeHint from '@/components/CodeHint.vue'
import StatsBar from '@/components/StatsBar.vue'
import TypingProgress from '@/components/TypingProgress.vue'
import TypingResult from '@/components/TypingResult.vue'
import VirtualKeyboard from '@/components/VirtualKeyboard.vue'
import { loadArticles, loadCommon3500, loadWords, loadZigen } from '@/data/loader'
import { findLevel, stageOfLevel } from '@/data/stages'
import { rankFromChars, rankFromEndlessChars, rankFromSpeed } from '@/engine/rank'
import { MIN_LIVE_WINDOW_MS } from '@/engine/stats'
import {
  createTypingSession,
  feedBackspace,
  feedChar,
  startTyping,
  typingStats,
  type TypingSession,
} from '@/engine/typing'
import { useFreeText } from '@/composables/useFreeText'
import { useLevels } from '@/composables/useLevels'
import { useSave } from '@/composables/useSave'
import { useTypingInput } from '@/composables/useTypingInput'
import { useUiSettings } from '@/composables/useUiSettings'
import { ensureScheme, getScheme } from '@/schemes/registry'
import type {
  Article,
  LevelRank,
  TypingConfig,
  TypingMode,
  TypingSource,
  WordsTable,
  ZigenItem,
} from '@/types'

type ViewMode = TypingMode | 'free'

/** 单次目标（一组 / 一段 / 一篇）结算快照 */
interface ModeRecord {
  speed: number
  accuracy: number
  elapsedMs: number
  done: number
  /** 物理按键总数（结算击键速度用） */
  keyCount: number
  errors: { char: string; input: string }[]
}

/** 显示项：汉字（对应引擎索引）／标点装饰／段落换行（自由模式与文章保留原文排版） */
type DisplayItem =
  | { kind: 'char'; char: string; index: number }
  | { kind: 'punct'; char: string }
  | { kind: 'br' }

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
const { scheme: uiScheme, align, setAlign } = useUiSettings()
const scheme = computed(() => getScheme(uiScheme.value))

/** 键位 → 字根表条目（虚拟键盘渲染，与编码练习关一致） */
const zigenMap = ref<Record<string, ZigenItem>>({})

const inputEl = ref<HTMLInputElement | null>(null)
const panelBox = ref<HTMLElement | null>(null)
const ready = ref(false)
const session = ref<TypingSession>(createTypingSession([]))
const now = ref(Date.now())
/** 显示项（含标点/换行装饰）：为空时按纯汉字流渲染 */
const display = ref<DisplayItem[] | null>(null)
/** 目标切换计数：用于长文本自动滚回当前字 */
const sessionToken = ref(0)

/** 虚拟键盘物理按键高亮（按下后短暂点亮） */
const pressedKey = ref('')
let pressTimer: number | undefined
const PRESS_FLASH_MS = 180

/**
 * 击键统计（跟打器口径，适配用户任意输入法）：
 * 统计真实物理按键（含 IME 组字期间的字母 / 数字选字 / 空格 / 退格）；
 * 计时起点为首次物理按键（session.startAt，由 startTyping 注入），含首字输入时间。
 */
const keyCount = ref(0)

/** 当前方案码表是否已加载（拆字提示就绪） */
const schemeReady = ref(false)

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
  keyCount: 0,
  errors: [],
}
const shownRecord = computed(() => resultRecord.value ?? EMPTY_RECORD)

/** 结算击键速度（键/秒） */
const shownKeySpeed = computed(() => {
  const record = shownRecord.value
  return record.elapsedMs > 0 ? (record.keyCount * 1000) / record.elapsedMs : 0
})

// ---------- 统计 ----------
/**
 * 实时统计：完成前按至少 1 秒窗口计算，避免开始瞬间样本过少导致速度虚高；
 * 完成与结算使用真实用时（引擎口径不变）。
 */
const liveStats = computed(() => {
  const base = typingStats(session.value, now.value)
  if (session.value.finishedAt !== null) return base
  const start = session.value.startAt
  if (start === null) return base
  const elapsedMs = Math.max(now.value - start, MIN_LIVE_WINDOW_MS)
  return { ...base, speed: base.done > 0 ? (base.done * 60000) / elapsedMs : 0 }
})
const goalChars = computed(() => config.value?.charTarget ?? 0)

/** 实时击键速度（键/秒）：物理按键数 ÷ 计时区间（完成前同样按最小窗口） */
const keySpeed = computed(() => {
  const start = session.value.startAt
  if (start === null) return 0
  const finished = session.value.finishedAt
  const end = finished ?? now.value
  const elapsedMs =
    finished !== null ? end - start : Math.max(end - start, MIN_LIVE_WINDOW_MS)
  return elapsedMs > 0 ? (keyCount.value * 1000) / elapsedMs : 0
})
const displayDone = computed(() => liveStats.value.done)
const displayTotal = computed(() => {
  if (mode.value === 'sprint' || mode.value === 'endless') {
    return goalChars.value || session.value.target.length
  }
  return session.value.target.length
})

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

/** 合并多段成绩：速度/正确率取简单平均，用时与击键累加（键速按合计重算） */
function mergeRecords(records: ModeRecord[]): ModeRecord {
  const elapsedMs = records.reduce((sum, record) => sum + record.elapsedMs, 0)
  const done = records.reduce((sum, record) => sum + record.done, 0)
  const keyCount = records.reduce((sum, record) => sum + record.keyCount, 0)
  return {
    speed: average(records.map((record) => record.speed)),
    accuracy: average(records.map((record) => record.accuracy)),
    elapsedMs,
    done,
    keyCount,
    errors: records.flatMap((record) => record.errors),
  }
}

function makeRecord(): ModeRecord {
  const finishedAt = session.value.finishedAt ?? Date.now()
  const stats = typingStats(session.value, finishedAt)
  return {
    speed: stats.speed,
    accuracy: stats.accuracy,
    elapsedMs: stats.elapsedMs,
    done: stats.done,
    keyCount: keyCount.value,
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

/** 原文 → 引擎目标汉字 + 显示项：标点与换行仅装饰显示，不参与跟打（自由模式与耐力关保留排版） */
function buildDisplay(text: string): { chars: string[]; items: DisplayItem[] } {
  const chars: string[] = []
  const items: DisplayItem[] = []
  const lines = text.split('\n')
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) items.push({ kind: 'br' })
    for (const char of line) {
      if (char === '\r') continue
      if (isHanChar(char)) {
        items.push({ kind: 'char', char, index: chars.length })
        chars.push(char)
      } else {
        items.push({ kind: 'punct', char })
      }
    }
  })
  return { chars, items }
}

async function loadArraySource(source: TypingSource): Promise<string[]> {
  if (source === 'common3500') return loadCommon3500()
  if (source === 'words2' || source === 'words3' || source === 'words4') {
    const words = await loadWords()
    return words[source]
  }
  return []
}

/** 按 7:2:1 权重从二/三/四字词中抽取不重复的 count 个词（种子随机，综合抽样用） */
function sampleMixedWords(words: WordsTable, count: number, rand: () => number): string[] {
  const pools = [
    { list: words.words2, weight: 7 },
    { list: words.words3, weight: 2 },
    { list: words.words4, weight: 1 },
  ].filter((pool) => pool.list.length > 0)
  if (pools.length === 0) return []
  const totalWeight = pools.reduce((sum, pool) => sum + pool.weight, 0)
  const picked: string[] = []
  const seen = new Set<string>()
  let guard = count * 60
  while (picked.length < count && guard > 0) {
    guard -= 1
    let roll = rand() * totalWeight
    let pool = pools[pools.length - 1]
    for (const candidate of pools) {
      roll -= candidate.weight
      if (roll <= 0) {
        pool = candidate
        break
      }
    }
    const word = pool.list[Math.floor(rand() * pool.list.length)]
    if (seen.has(word)) continue
    seen.add(word)
    picked.push(word)
  }
  return picked
}

/**
 * 数组源综合目标（普通跟打，全键位综合形式）：
 * 每次进入从全源池随机抽取 sample 个字/词（不重复）；词组以不换行空格分隔显示。
 */
async function buildArrayTarget(
  cfgValue: TypingConfig,
): Promise<{ chars: string[]; items: DisplayItem[] | null }> {
  const count = cfgValue.sample ?? 200
  if (cfgValue.source === 'words-mix') {
    const words = await loadWords()
    const picked = sampleMixedWords(words, count, Math.random)
    const chars: string[] = []
    const items: DisplayItem[] = []
    for (const word of picked) {
      if (items.length > 0) items.push({ kind: 'punct', char: '\u00a0' })
      for (const char of word) {
        items.push({ kind: 'char', char, index: chars.length })
        chars.push(char)
      }
    }
    return { chars, items }
  }
  const pool = await loadArraySource(cfgValue.source)
  const chars = shuffleWith(pool, Math.random).slice(0, count)
  return { chars, items: null }
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

function startTarget(chars: string[], items: DisplayItem[] | null = null): void {
  clearAdvance()
  resultVisible.value = false
  resultRecord.value = null
  display.value = items
  keyCount.value = 0
  session.value = createTypingSession(chars)
  sessionToken.value += 1
  now.value = Date.now()
  void nextTick(() => {
    syncFocusRect()
    focusInput()
  })
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

/** 爬坡通关速度档位（字/分）：默认取关卡配置档（无效值时用中间档），当前组判定按所选档实时生效 */
const CLIMB_SPEEDS = [35, 50, 70]
function initialClimbSpeed(): number {
  const configured = config.value?.groupSpeed ?? 0
  return CLIMB_SPEEDS.includes(configured) ? configured : CLIMB_SPEEDS[1]
}
const climbSpeed = ref(initialClimbSpeed())
const groupSpeed = computed(() => climbSpeed.value)

/** 切换通关速度档位并恢复输入焦点 */
function setClimbSpeed(speed: number): void {
  climbSpeed.value = speed
  void nextTick(() => focusInput())
}
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
  // 可进入：已通关组（复习）与前线组（返回当前进度）；更后面的组不可跳过
  if (index > groupIndex.value) return
  if (index === currentGroup.value) return
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
  const limitMs = (session.value.target.length * 60000) / groupSpeed.value
  const passed = stats.elapsedMs <= limitMs + 1e-6

  if (groupIsReview.value) {
    // 复习旧组：仅更新界面上的组最佳速度，不写存档进度（回打不改变通关状态）；
    // 完成后连续进入下一组复习，直至到达前线组后恢复正常训练
    rememberGroupBest(index, stats.speed)
    const next = index + 1
    const tail =
      next >= groupIndex.value
        ? next >= totalGroups.value
          ? '本关已全部完成'
          : `回到当前进度（第 ${next + 1} 组）`
        : `继续复习第 ${next + 1} 组`
    showBanner(`复习完成 · ${stats.speed.toFixed(0)} 字/分 · ${tail}`)
    scheduleAdvance(() => {
      if (next >= totalGroups.value) completeClimbLevel()
      else startGroup(next)
    })
    return
  }

  if (!passed) {
    // 未达标：不打断训练（不出结算卡片），短暂提示后自动重来本组
    showBanner(
      `未达标 · ${stats.speed.toFixed(0)} 字/分（需 ≥${groupSpeed.value}）· 自动重来本组`,
    )
    scheduleAdvance(() => startGroup(index))
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
  // 诗词内容默认居中（仍可手动切换）
  setAlign('center')
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
  // 宋词 / 古文内容默认居中（仍可手动切换）
  setAlign('center')
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

// ---------- 耐力 / 综合跟打（marathon：文章或数组源一次打完） ----------
const marathonDisplay = ref<{ chars: string[]; items: DisplayItem[] | null } | null>(null)

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
    retry: () => {
      const built = marathonDisplay.value
      if (built) startTarget(built.chars, built.items)
    },
  })
}

async function setupMarathon(cfgValue: TypingConfig): Promise<boolean> {
  // 文章源：保留标点排版；数组源（综合关）：每次进入随机抽样 200 字/词，一次打完
  const built =
    cfgValue.source === 'article'
      ? buildDisplay(
          (await loadChosenArticles(cfgValue.articleIds))
            .map((article) => article.paragraphs.join('\n'))
            .join('\n'),
        )
      : await buildArrayTarget(cfgValue)
  if (built.chars.length === 0) {
    router.replace('/')
    return false
  }
  marathonDisplay.value = built
  startTarget(built.chars, built.items)
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
  const { chars, items } = buildDisplay(freeText.value)
  if (chars.length === 0) {
    router.replace('/free')
    return false
  }
  startTarget(chars, items)
  return true
}

function finishFree(): void {
  const { chars, items } = buildDisplay(freeText.value)
  showResult({
    title: '自由练习完成',
    record: makeRecord(),
    retry: () => startTarget(chars, items),
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

/** 物理按键 → 虚拟键盘键位标识（仅字母 / 空格 / 退格有对应键帽） */
function codeToKey(code: string): string {
  if (code === 'Space') return ' '
  if (code === 'Backspace') return 'Backspace'
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  return ''
}

/** 物理按键（含 IME 组字期间）：首次按键启动计时，累计击键并点亮虚拟键盘对应键帽 */
function onKey(code: string): void {
  if (session.value.startAt === null) {
    session.value = startTyping(session.value, Date.now())
  }
  keyCount.value += 1
  const key = codeToKey(code)
  if (!key) return
  pressedKey.value = key
  if (pressTimer !== undefined) window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressTimer = undefined
    pressedKey.value = ''
  }, PRESS_FLASH_MS)
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
    case 'marathon': {
      const built = marathonDisplay.value
      if (built) startTarget(built.chars, built.items)
      break
    }
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
      return `第 ${Math.min(currentGroup.value + 1, totalGroups.value)}/${totalGroups.value} 组 · 每组 ${groupSize.value} ${climbSourceUnit.value}`
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

/** 渲染序列：有装饰项（标点/换行）用原文排版，否则按纯汉字流 */
const displayItems = computed<DisplayItem[]>(
  () =>
    display.value ??
    session.value.target.map((char, index) => ({ kind: 'char' as const, char, index })),
)

/** 网格布局（爬坡 / 毕业综合）：与文本面板网格一致，不提供对齐切换 */
const isGridLayout = computed(() => isClimb.value || mode.value === 'gauntlet')

/** 文本对齐（全局设置，与编码练习关共用）：仅流式布局生效 */
const targetClasses = computed(() => ({
  'typing__target--grid': isGridLayout.value,
  'typing__target--flow': !isGridLayout.value,
  'typing__flow--center': !isGridLayout.value && align.value === 'center',
  'typing__flow--left': !isGridLayout.value && align.value === 'left',
}))

/** 切换对齐并恢复输入焦点 */
function handleAlign(value: 'center' | 'left'): void {
  setAlign(value)
  void nextTick(() => focusInput())
}

/** 光标可见条件：进行中且目标未完成 */
const caretVisible = computed(
  () =>
    ready.value &&
    !resultVisible.value &&
    session.value.finishedAt === null &&
    session.value.target.length > 0,
)

const caretStyle = ref<Record<string, string>>({})

/** 同步隐藏输入框与光标到当前待输入字的位置（IME 候选框跟随该位置出现） */
function syncFocusRect(): void {
  const box = panelBox.value
  const input = inputEl.value
  if (!box || !input) return
  const active = box.querySelector<HTMLElement>('.tv-char[data-active="true"]')
  if (!active) {
    input.style.left = '0px'
    input.style.top = '0px'
    input.style.width = '1px'
    input.style.height = '1em'
    caretStyle.value = {}
    return
  }
  const boxRect = box.getBoundingClientRect()
  const rect = active.getBoundingClientRect()
  const left = rect.left - boxRect.left + box.scrollLeft
  const top = rect.top - boxRect.top + box.scrollTop
  const height = Math.max(rect.height, 16)
  input.style.left = `${left}px`
  input.style.top = `${top}px`
  input.style.width = `${Math.max(rect.width, 6)}px`
  input.style.height = `${height}px`
  caretStyle.value = { left: `${left - 1}px`, top: `${top}px`, height: `${height}px` }
}

/** 拆字提示卡片：当前待输入字的五笔拆解（跟打模式下仅作参考） */
const hintData = computed(() => {
  if (!schemeReady.value || resultVisible.value || session.value.finishedAt !== null) return null
  const char = session.value.target[session.value.pos]
  if (!char) return null
  const code = scheme.value.code(char)
  if (!code) return null
  return { char, code, items: scheme.value.hint(char) }
})

/** 长文本跟随当前字滚动；新目标（sessionToken 变化）重新定位；光标与输入框跟随 */
watch(
  () => [sessionToken.value, session.value.pos, session.value.errorSlot] as const,
  async () => {
    await nextTick()
    const el = panelBox.value?.querySelector<HTMLElement>('.tv-char[data-active="true"]')
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    syncFocusRect()
    // 平滑滚动过程中再校准一次
    window.setTimeout(() => syncFocusRect(), 260)
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
  window.addEventListener('resize', syncFocusRect)

  // 字根键盘与拆字提示需要当前方案数据（后台加载，不阻塞练习）
  void ensureScheme(uiScheme.value).then(() => {
    schemeReady.value = true
  })
  void loadZigen(uiScheme.value).then((data) => {
    zigenMap.value = Object.fromEntries(data.map((z) => [z.key, z]))
  })

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
  window.removeEventListener('resize', syncFocusRect)
  if (tickTimer !== undefined) window.clearInterval(tickTimer)
  if (pressTimer !== undefined) window.clearTimeout(pressTimer)
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
    />

    <p v-if="ready && !resultVisible" class="typing__mode">{{ modeInfo }}</p>

    <div v-if="ready && !resultVisible && isClimb" class="typing__climb-bar">
      <span class="typing__climb-label">通关速度</span>
      <span class="typing__climb-group">
        <button
          v-for="speed in CLIMB_SPEEDS"
          :key="speed"
          type="button"
          class="speed-btn"
          :class="{ 'speed-btn--active': climbSpeed === speed }"
          @click.stop="setClimbSpeed(speed)"
        >
          {{ speed }}
        </button>
      </span>
      <span class="typing__climb-unit">字/分</span>
      <span class="typing__climb-tip">
        速度达 {{ groupSpeed }} 字/分自动进入下一组，未达标自动重来
      </span>
    </div>

    <p v-if="!ready" class="typing__loading">加载中…</p>

    <template v-else-if="!resultVisible">
      <section class="typing__stage" @click="focusInput">
        <div v-if="advancePending" class="typing__banner">{{ bannerText }}</div>
        <div v-if="ready && !isGridLayout" class="typing__align">
          <span class="typing__align-group">
            <button
              class="align-btn"
              :class="{ 'align-btn--active': align === 'center' }"
              @click.stop="handleAlign('center')"
            >
              居中
            </button>
            <button
              class="align-btn"
              :class="{ 'align-btn--active': align === 'left' }"
              @click.stop="handleAlign('left')"
            >
              左对齐
            </button>
          </span>
        </div>
        <div
          ref="panelBox"
          class="typing__target"
          :class="targetClasses"
          @scroll.passive="syncFocusRect"
        >
          <!-- 隐藏输入框与光标跟随当前待输入字（IME 候选框随之定位） -->
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
          <span v-if="caretVisible" class="typing__caret" :style="caretStyle"></span>
          <template v-for="(item, i) in displayItems" :key="`${sessionToken}-${i}-${item.kind}`">
            <br v-if="item.kind === 'br'" />
            <span v-else-if="item.kind === 'punct'" class="tv-punct">{{ item.char }}</span>
            <span
              v-else
              class="tv-char"
              :class="charClass(item.index)"
              :data-index="item.index"
              :data-active="item.index === session.pos ? 'true' : undefined"
              :title="
                item.index === session.pos && session.errorSlot
                  ? `错误输入：${session.errorSlot} · 正确：${item.char}`
                  : undefined
              "
              >{{ displayChar(item.index) }}</span
            >
          </template>
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

      <CodeHint
        v-if="hintData"
        :char="hintData.char"
        :code="hintData.code"
        :items="hintData.items"
        input=""
      />

      <div class="typing__bottom">
        <div v-if="mode === 'endless'" class="typing__tools">
          <button type="button" class="typing__btn" @click="finishEndless">结束本局</button>
        </div>
        <VirtualKeyboard :press="pressedKey" :zigen="zigenMap" />
      </div>
    </template>

    <TypingResult
      v-if="resultVisible"
      :title="resultTitle"
      :speed="shownRecord.speed"
      :accuracy="shownRecord.accuracy"
      :elapsed-ms="shownRecord.elapsedMs"
      :keystrokes="shownKeySpeed"
      :rank="resultRank"
      :passed="resultPassed"
      :pass-label="resultPassLabel"
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

/* 爬坡：通关速度档位与连续训练说明 */
.typing__climb-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: calc(-1 * var(--space-1));
  font-size: var(--font-sm);
  color: var(--color-text-muted);
}

.typing__climb-group {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.speed-btn {
  min-width: 44px;
  padding: 2px 10px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}

.speed-btn + .speed-btn {
  border-left: 1px solid var(--color-border);
}

.speed-btn--active {
  background: var(--color-primary-weak);
  color: var(--color-primary);
  font-weight: 600;
}

.typing__climb-tip {
  color: var(--color-text-muted);
  opacity: 0.9;
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

/* 跟随当前字的透明输入框：捕获 IME 事件，输入法候选框随其位置出现 */
.typing__input {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
  width: 6px;
  height: 1em;
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  color: transparent;
  caret-color: transparent;
  opacity: 0;
  font-size: 16px;
  cursor: text;
  pointer-events: auto;
}

/* 文本光标：跟随当前待输入字 */
.typing__caret {
  position: absolute;
  z-index: 2;
  width: 2px;
  border-radius: 1px;
  background: var(--color-primary);
  pointer-events: none;
  animation: tv-caret-blink 1.06s steps(1) infinite;
}

@keyframes tv-caret-blink {
  0%,
  55% {
    opacity: 1;
  }
  56%,
  100% {
    opacity: 0.15;
  }
}

/* 标点等装饰字符：显示但不参与跟打 */
.tv-punct {
  color: var(--text-pending);
  opacity: 0.7;
  user-select: none;
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

/* 对齐切换（与编码练习关的文本面板一致）：仅流式布局显示 */
.typing__align {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-1);
}

.typing__align-group {
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

.typing__target {
  position: relative;
  z-index: 2;
  pointer-events: none;
  user-select: text;
}

/* 文本对齐：与全局设置联动 */
.typing__flow--center {
  text-align: center;
}

.typing__flow--left {
  text-align: left;
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
