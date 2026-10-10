<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CodeHint from '@/components/CodeHint.vue'
import IntroPanel from '@/components/IntroPanel.vue'
import ResultModal from '@/components/ResultModal.vue'
import StatsBar from '@/components/StatsBar.vue'
import TextPanel from '@/components/TextPanel.vue'
import VirtualKeyboard from '@/components/VirtualKeyboard.vue'
import { loadArticles, loadRadicalWeights, loadZigen } from '@/data/loader'
import { buildLevelChars, isHan, randomSequence, weightedSequence } from '@/data/pool'
import { parseScript, type ParsedScript } from '@/data/script'
import { findLevel, stageOfLevel } from '@/data/stages'
import { buildDrillPool } from '@/engine/drill'
import { createSession, feedKey, type PracticeSession } from '@/engine/judge'
import { checkTimeout, elapsed, startChar, type CharTimer } from '@/engine/timer'
import { ensureScheme, getScheme } from '@/schemes/registry'
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
  PanelItem,
  RadicalWeight,
  TextCharState,
  ZigenItem,
} from '@/types'

/** 加练：每个错项的重复次数（总字数 = 错项数 × 该值） */
const DRILL_REPEAT = 10

const route = useRoute()
const router = useRouter()
const { isStageUnlocked, recordResult } = useLevels()
const { record, markMastered } = useMistakes()
const { save, recordCharDone, recordCharError } = useSave()
const { freeTitle, freeText } = useFreeText()
const {
  soundOn,
  volume,
  setVolume,
  hintsOn,
  setHints,
  setAlign,
  scheme: uiScheme,
} = useUiSettings()

/** 当前输入方案实现（顶部下拉切换方案后刷新页面生效） */
const scheme = computed(() => getScheme(uiScheme.value))
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
const isIntro = computed(() => level.value?.type === 'intro')
const mode = computed<'zigen' | 'text'>(() => (isZigen.value ? 'zigen' : 'text'))
const articleMode = computed(() => level.value?.type === 'article' || isFree.value)

// ---------- 通用状态 ----------
const now = ref(Date.now())
const started = ref(false)
const finished = ref(false)
const showResult = ref(false)
const drill = ref(false)
/** 暂停状态（暂停期间冻结计时与输入） */
const paused = ref(false)
let pausedAt = 0
const feedback = ref<KeyFeedback | null>(null)
const sticky = ref<KeyFeedback | null>(null)
const charTimer = ref<CharTimer>(startChar(0))
const sessionStartAt = ref(0)
const timeouts = ref(0)
const streak = ref<Record<string, number>>({})
const zigenMap = ref<Record<string, ZigenItem>>({})
/** 常用字根权重（常用字根强化训练用，按一级常用字使用频率降序） */
const radicalWeights = ref<RadicalWeight[]>([])
const articleTitle = ref('')
/** 本会话超时项（文本为汉字，字根为键位）→ 超时次数，用于加入加练 */
const timeoutCounts = ref<Record<string, number>>({})

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
/** 字根级错误次数（PUA 字根 → 次数），用于加练加权出题 */
const zigenRootErrors = ref<Record<string, number>>({})

// ---------- 文本模式 ----------
const session = ref<PracticeSession | null>(null)
const displayMap = ref<{ char: string; input: number }[]>([])
/** 脚本关（口诀训练）：解析后的脚本（提示行 + 训练行） */
const parsedScript = ref<ParsedScript | null>(null)
const scriptMode = computed(() => Boolean(level.value?.script?.length))

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

/** 从键位池生成字根练习题：键位均匀分布且不连续重复，每题取该键的随机字根 */
function makeZigenTasks(pool: string[], count: number): ZigenTask[] {
  return randomSequence(pool, count).map((key) => {
    // 打字训练使用完整字根列表（roots）
    const roots = zigenMap.value[key]?.roots ?? []
    const root =
      roots.length > 0 ? roots[Math.floor(Math.random() * roots.length)] : key.toUpperCase()
    return { key, root }
  })
}

/** 字根 → 键位反查表（加练出题用） */
function rootKeyMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const [key, item] of Object.entries(zigenMap.value)) {
    for (const root of item.roots) map.set(root, key)
  }
  return map
}

/**
 * 字根加练：按错误次数线性加权随机出题，打错越多的字根出现频率越高。
 * 纯加权随机（不做键位均衡 / 连续去重，否则会抹平加权效果）。
 */
function makeDrillZigenTasks(roots: string[]): ZigenTask[] {
  const keyOf = rootKeyMap()
  const items = roots
    .map((root) => ({
      root,
      key: keyOf.get(root) ?? '',
      count: Math.max(1, zigenRootErrors.value[root] ?? 1),
    }))
    .filter((w) => w.key)
  if (items.length === 0) return []
  const total = items.length * DRILL_REPEAT
  const sum = items.reduce((a, b) => a + b.count, 0)
  const out: ZigenTask[] = []
  for (let n = 0; n < total; n += 1) {
    let r = Math.random() * sum
    let pick = items[items.length - 1]
    for (const it of items) {
      r -= it.count
      if (r <= 0) {
        pick = it
        break
      }
    }
    out.push({ key: pick.key, root: pick.root })
  }
  return out
}

/** 常用字根强化：按常用字根权重加权出题，避免与上一题键位重复 */
function makeRadicalTasks(count: number): ZigenTask[] {
  if (radicalWeights.value.length === 0) {
    // 兜底：权重数据缺失时退回全键位随机
    return makeZigenTasks(Object.keys(zigenMap.value), count)
  }
  return weightedSequence(radicalWeights.value, count).map((w) => ({ key: w.key, root: w.root }))
}

/** 随机文字关卡（字根 / 单字）统一字符流：由 TextPanel 按容器宽度自动换行 */
const linearItems = computed<PanelItem[]>(() => {
  if (mode.value === 'zigen') {
    return zigenQueue.value.map((task, i) => {
      let state: TextCharState = 'pending'
      if (i < zigenIndex.value) state = zigenWrong.value[i] ? 'done-wrong' : 'done-clean'
      else if (i === zigenIndex.value) state = 'active'
      return { kind: 'char', char: task.root, state }
    })
  }
  return (session.value?.items ?? []).map((it) => ({
    kind: 'char',
    char: it.char,
    state: stateOf(it.state, it.wrongAttempts.length > 0),
  }))
})

const articleItems = computed<PanelItem[]>(() => {
  const s = session.value
  if (!s) return []
  return displayMap.value.map((d, i) => {
    if (d.input >= 0) {
      const item = s.items[d.input]
      if (!item) return { kind: 'char', char: d.char, state: 'pending' as TextCharState }
      return {
        kind: 'char',
        char: d.char,
        state: stateOf(item.state, item.wrongAttempts.length > 0),
      }
    }
    if (d.char === '\n') return { kind: 'br' }
    let prev = -1
    for (let j = i - 1; j >= 0; j -= 1) {
      if (displayMap.value[j].input >= 0) {
        prev = displayMap.value[j].input
        break
      }
    }
    const prevItem = prev >= 0 ? s.items[prev] : undefined
    const done = prevItem ? prevItem.state === 'done' : false
    return { kind: 'char', char: d.char, state: done ? 'skip' : 'pending' }
  })
})

/** 脚本关：提示行（不训练）+ 训练行（汉字绑定会话进度）+ 行尾换行 */
const scriptItems = computed<PanelItem[]>(() => {
  const parsed = parsedScript.value
  const s = session.value
  if (!parsed) return []
  const out: PanelItem[] = []
  for (const line of parsed.lines) {
    if (line.kind === 'hint') {
      out.push({ kind: 'hint', text: line.text })
      continue
    }
    if (line.kind === 'blank') {
      out.push({ kind: 'br' })
      continue
    }
    for (const cell of line.cells) {
      if (cell.train) {
        const item = s?.items[cell.inputIndex]
        out.push({
          kind: 'char',
          char: cell.char,
          state: item ? stateOf(item.state, item.wrongAttempts.length > 0) : 'pending',
        })
      } else {
        out.push({ kind: 'char', char: cell.char, state: 'skip' })
      }
    }
    out.push({ kind: 'br' })
  }
  return out
})

const textItems = computed<PanelItem[]>(() => {
  if (scriptMode.value) return scriptItems.value
  if (articleMode.value) return articleItems.value
  return linearItems.value
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
  // 关闭按键提示时不显示下一步高亮
  if (!hintsOn.value) return ''
  if (mode.value === 'zigen') return zigenQueue.value[zigenIndex.value]?.key ?? ''
  const s = session.value
  if (!s || s.finished) return ''
  const item = s.items[s.cursor]
  if (!item) return ''
  if (!s.requireFull && s.input.length > 0 && item.shorts.includes(s.input)) return ' '
  return item.code[s.input.length] ?? ''
})

// 关闭按键提示时清除残留的高亮与常亮
watch(hintsOn, (on) => {
  if (!on) {
    sticky.value = null
    feedback.value = null
  }
})

const currentHint = computed(() => {
  if (mode.value === 'zigen') return null
  const s = session.value
  if (!s || s.finished) return null
  const item = s.items[s.cursor]
  if (!item) return null
  // 一级简码训练关：额外提示当前字的一级简码
  const short1 = level.value?.showShort1
    ? item.shorts.find((short) => short.length === 1)
    : undefined
  return {
    char: item.char,
    code: item.code,
    items: scheme.value.hint(item.char),
    input: s.input,
    short1,
  }
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
    // 字根模式：按「实际打错的字根」列出，加练据此加权出题
    const list: MistakeOption[] = Object.entries(zigenRootErrors.value).map(([root, count]) => ({
      id: root,
      main: root,
      detail: `错误 ${count} 次`,
    }))
    const seen = new Set(list.map((o) => o.id))
    for (const [root, count] of Object.entries(timeoutCounts.value)) {
      if (seen.has(root)) continue
      list.push({ id: root, main: root, detail: `超时 ${count} 次` })
    }
    return list
  }
  const s = session.value
  const list: MistakeOption[] = []
  const seen = new Set<string>()
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
        seen.add(it.char)
      }
    }
  }
  for (const [char, count] of Object.entries(timeoutCounts.value)) {
    if (seen.has(char)) continue
    list.push({ id: char, main: char, detail: `超时 ${count} 次` })
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
  paused.value = false
  showResult.value = false
  feedback.value = null
  sticky.value = null
  timeouts.value = 0
  timeoutCounts.value = {}
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
  zigenRootErrors.value = {}
}

function initText(chars: string[], isDrill = false): void {
  resetCommon()
  drill.value = isDrill
  streak.value = {}
  session.value = createSession(chars, scheme.value, 0, { requireFull: level.value?.requireFull })
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
  if (keep && type !== 'timeout' && hintsOn.value) sticky.value = { key, type }
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
    const task = zigenQueue.value[zigenIndex.value]
    if (task) {
      // 记录实际打错的字根（按字根聚合，供加练加权）
      zigenRootErrors.value[task.root] = (zigenRootErrors.value[task.root] ?? 0) + 1
    }
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

/** 统一输入入口：物理键盘与虚拟键盘点按共用 */
function handleInput(key: string): void {
  if (finished.value || paused.value) return
  if (!/^[a-z ]$/.test(key)) return
  startIfNeeded()
  if (mode.value === 'zigen') handleZigenKey(key)
  else handleTextKey(key)
}

function onKeydown(e: KeyboardEvent): void {
  const key = e.key.toLowerCase()
  if (key === ' ') e.preventDefault()
  handleInput(key)
}

/** 当前待练项标识：文本为汉字，字根为键位；已完成时返回空串 */
function currentItemId(): string {
  if (mode.value === 'zigen') return zigenQueue.value[zigenIndex.value]?.root ?? ''
  const s = session.value
  if (!s || s.finished) return ''
  return s.items[s.cursor]?.char ?? ''
}

function onTimeoutTick(): void {
  if (!started.value || finished.value || paused.value) return
  const timeoutMs = level.value?.timeoutMs ?? 4000
  const r = checkTimeout(charTimer.value, timeoutMs, Date.now())
  if (r.timedOut) {
    charTimer.value = r.timer
    timeouts.value += 1
    const id = currentItemId()
    if (id) timeoutCounts.value[id] = (timeoutCounts.value[id] ?? 0) + 1
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
  // 加练不计入关卡进度与解锁
  if (lv && !drill.value) {
    recordResult(lv.id, stats.value.speed, stats.value.accuracy, passed.value, timeouts.value)
  }
}

function onPractice(ids: string[]): void {
  if (ids.length === 0) return
  if (mode.value === 'zigen') {
    // 字根加练：按错误次数加权，打错的字根出现频率更高
    const tasks = makeDrillZigenTasks(ids)
    initZigen(tasks.length > 0 ? tasks : makeZigenTasks(ids, ids.length * DRILL_REPEAT), true)
    return
  }
  // 单字加练：每项重复 DRILL_REPEAT 次，整体均匀随机且不连续重复
  initText(randomSequence(ids, ids.length * DRILL_REPEAT), true)
}

function closeResult(): void {
  router.push('/')
}

// ---------- 生命周期 ----------
/** 开启本关一局（首次进入与「重新开始」共用） */
async function startRound(): Promise<void> {
  if (isFree.value) {
    if (!freeText.value) {
      router.replace('/free')
      return
    }
    articleTitle.value = freeTitle.value || '自由练习'
    const text = freeText.value
    initText([...text].filter(isHan))
    buildDisplay(text)
    return
  }
  const lv = level.value
  if (!lv) return
  if (lv.type === 'intro') return
  parsedScript.value = null
  if (lv.type === 'zigen') {
    initZigen(
      lv.source === 'radicals' ? makeRadicalTasks(lv.length) : makeZigenTasks(lv.pool, lv.length),
    )
  } else if (lv.type === 'article') {
    await initArticle(lv)
  } else if (lv.script && lv.script.length > 0) {
    const parsed = parseScript(lv.script)
    parsedScript.value = parsed
    initText(parsed.chars)
  } else {
    initText(await buildLevelChars(lv, uiScheme.value))
  }
}

/** 教学关：阅读完毕即达标，返回地图 */
function completeIntro(): void {
  const lv = level.value
  if (lv) recordResult(lv.id, 0, 1, true, 0)
  router.push('/')
}

/** 重新开始本关（重新抽题，开新一轮） */
function restart(): void {
  void startRound()
}

/** 暂停 / 继续：恢复时扣除暂停时长，避免影响速度与超时判定 */
function togglePause(): void {
  if (finished.value) return
  if (paused.value) {
    const duration = Date.now() - pausedAt
    if (sessionStartAt.value > 0) sessionStartAt.value += duration
    if (charTimer.value.charStartAt > 0) {
      charTimer.value = { ...charTimer.value, charStartAt: charTimer.value.charStartAt + duration }
    }
    paused.value = false
  } else {
    pausedAt = Date.now()
    paused.value = true
  }
}

onMounted(async () => {
  await ensureScheme(uiScheme.value)
  const [zigenData, weights] = await Promise.all([
    loadZigen(uiScheme.value),
    loadRadicalWeights(uiScheme.value),
  ])
  zigenMap.value = Object.fromEntries(zigenData.map((z) => [z.key, z]))
  radicalWeights.value = weights

  if (!isFree.value) {
    const lv = level.value
    const stageId = lv ? (stageOfLevel(lv.id)?.id ?? '') : ''
    if (!lv || !isStageUnlocked(stageId)) {
      router.replace('/')
      return
    }
  }
  // 教学关仅阅读，不进入打字流程
  if (isIntro.value) return
  // 口诀脚本关：进入时自动居中（仍可手动切换）
  if (scriptMode.value) setAlign('center')
  await startRound()

  window.addEventListener('keydown', onKeydown)
  tickTimer = window.setInterval(() => {
    if (started.value && !finished.value && !paused.value) now.value = Date.now()
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
    <IntroPanel
      v-if="isIntro"
      :title="level?.title ?? '教学关'"
      :paragraphs="level?.intro ?? []"
      @done="completeIntro"
    />

    <template v-else>
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
      :short1="currentHint.short1"
    />

    <div class="keyboard-wrap">
      <div class="controls">
        <button class="ctrl-btn" :class="{ 'ctrl-btn--on': paused }" @click="togglePause">
          {{ paused ? '继续' : '暂停' }}
        </button>
        <button class="ctrl-btn" @click="restart">重新开始</button>
        <button
          class="ctrl-btn"
          :class="{ 'ctrl-btn--off': !hintsOn }"
          @click="setHints(!hintsOn)"
        >
          {{ hintsOn ? '按键提示：开' : '按键提示：关' }}
        </button>
        <div class="volume">
          <button class="ctrl-btn" @click="volumeOpen = !volumeOpen">
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
      </div>
      <VirtualKeyboard
        :highlight="highlight"
        :feedback="feedback"
        :sticky="sticky"
        :zigen="zigenMap"
        :disabled="finished"
        @press="handleInput"
      />
    </div>

    <div v-if="paused" class="pause-overlay" @click="togglePause">
      <span class="pause-overlay__title">已暂停</span>
      <span class="pause-overlay__hint">点击任意处继续</span>
    </div>

    <ResultModal
      :visible="showResult"
      :title="panelTitle || level?.title || '练习结算'"
      :stats="stats"
      :passed="passed"
      :requirement="requirement"
      :options="options"
      :show-pass="!isFree && !drill"
      @practice="onPractice"
      @close="closeResult"
    />
    </template>
  </section>
</template>

<style scoped>
.play {
  position: relative;
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.keyboard-wrap {
  position: relative;
}

.controls {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.volume {
  position: relative;
}

.ctrl-btn {
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.ctrl-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.ctrl-btn--off {
  color: var(--color-text-muted);
  opacity: 0.65;
}

.ctrl-btn--on {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

/* 暂停遮罩：覆盖练习区，点击任意处继续 */
.pause-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  background: rgba(15, 23, 42, 0.62);
  border-radius: var(--radius-lg);
  cursor: pointer;
  user-select: none;
  backdrop-filter: blur(1px);
}

.pause-overlay__title {
  font-size: var(--font-xl);
  font-weight: 700;
  line-height: 1.3;
  color: #fff;
  letter-spacing: 0.15em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.pause-overlay__hint {
  font-size: var(--font-sm);
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
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

/* 窄屏：压缩间距，控制按钮换行 */
@media (max-width: 640px) {
  .play {
    gap: var(--space-4);
  }

  .controls {
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }

  .volume__range {
    width: 110px;
  }
}
</style>
