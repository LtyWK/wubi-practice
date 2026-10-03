import { ref } from 'vue'
import type { CharStat, LevelResult, SaveV2, WubiScheme } from '@/types'

/** 86 版 V2 存档键（兼容既有数据） */
const KEY_86 = 'wubi.v2.save'
/** 方案偏好键（与 useUiSettings 保持一致） */
const SCHEME_KEY = 'wubi.ui.scheme'
/** V1 旧键（仅用于 86 首次迁移） */
const V1_PROGRESS = 'wubi.v1.progress'
const V1_MISTAKES = 'wubi.v1.mistakes'

/** 读取当前方案偏好（切换方案通过刷新页面生效，模块加载时确定一次即可） */
function currentScheme(): WubiScheme {
  try {
    return localStorage.getItem(SCHEME_KEY) === 'wubi86' ? 'wubi86' : 'wubi98'
  } catch {
    return 'wubi98'
  }
}

/** 当前方案存档键：86 沿用旧键，其余方案独立分键 */
function storageKey(scheme: WubiScheme): string {
  return scheme === 'wubi86' ? KEY_86 : `${KEY_86}.${scheme}`
}

const scheme = currentScheme()
const KEY = storageKey(scheme)

function emptySave(): SaveV2 {
  return {
    version: 2,
    exportedAt: 0,
    progress: { unlockedStages: [], levels: {} },
    mistakes: {},
    stats: {},
  }
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 从 V1 数据迁移（仅当无 V2 存档时执行一次，旧键保留不删） */
function migrateFromV1(): SaveV2 {
  const data = emptySave()
  const progressRaw = readLocal(V1_PROGRESS)
  if (progressRaw) {
    try {
      const old = JSON.parse(progressRaw) as {
        best?: Record<string, { speed: number; accuracy: number; at: number }>
      }
      for (const [id, best] of Object.entries(old.best ?? {})) {
        data.progress.levels[id] = {
          passed: true,
          bestSpeed: best.speed,
          bestAccuracy: best.accuracy,
          attempts: 1,
          timeouts: 0,
          at: best.at,
        }
      }
    } catch {
      // 忽略损坏的旧数据
    }
  }
  const mistakesRaw = readLocal(V1_MISTAKES)
  if (mistakesRaw) {
    try {
      data.mistakes = JSON.parse(mistakesRaw) as SaveV2['mistakes']
    } catch {
      // 忽略损坏的旧数据
    }
  }
  return data
}

function loadSave(): SaveV2 {
  const raw = readLocal(KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SaveV2>
      if (parsed.version === 2) {
        const base = emptySave()
        return {
          ...base,
          ...parsed,
          progress: {
            unlockedStages: parsed.progress?.unlockedStages ?? [],
            levels: parsed.progress?.levels ?? {},
          },
          mistakes: parsed.mistakes ?? {},
          stats: parsed.stats ?? {},
        }
      }
    } catch {
      // 损坏则回退迁移
    }
  }
  // V1 迁移仅适用于 86 版旧数据
  return scheme === 'wubi86' ? migrateFromV1() : emptySave()
}

/** 模块级共享存档状态 */
const save = ref<SaveV2>(loadSave())

/** 从 localStorage 加载（含 V1 迁移），供测试与初始化使用 */
export function loadSaveFromStorage(): SaveV2 {
  return loadSave()
}

// 页面隐藏或关闭前落盘，避免防抖窗口内丢失进度
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSave)
  window.addEventListener('pagehide', flushSave)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSave()
    })
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

/** 立即写入 localStorage（导出、测试、页面卸载前使用） */
export function flushSave(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save.value))
  } catch {
    // 忽略写入失败（隐私模式等）
  }
}

/** 防抖写入（300ms） */
export function touchSave(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(flushSave, 300)
}

/** 统一存档：关卡成绩、阶段解锁、单字统计、导入导出 */
export function useSave(): {
  save: typeof save
  getLevelResult: (id: string) => LevelResult | undefined
  isLevelPassed: (id: string) => boolean
  recordLevelResult: (
    id: string,
    speed: number,
    accuracy: number,
    passed: boolean,
    timeouts: number,
  ) => void
  isStageUnlocked: (id: string) => boolean
  unlockStage: (id: string) => void
  getCharStat: (char: string) => CharStat | undefined
  recordCharDone: (char: string, ms: number) => void
  recordCharError: (char: string) => void
  exportSave: () => string
  importSave: (text: string) => { ok: boolean; error?: string }
  resetAll: () => void
} {
  function getLevelResult(id: string): LevelResult | undefined {
    return save.value.progress.levels[id]
  }

  function isLevelPassed(id: string): boolean {
    return save.value.progress.levels[id]?.passed ?? false
  }

  function recordLevelResult(
    id: string,
    speed: number,
    accuracy: number,
    passed: boolean,
    timeouts: number,
  ): void {
    const prev = save.value.progress.levels[id]
    const better = !prev || speed > prev.bestSpeed
    save.value.progress.levels[id] = {
      passed: (prev?.passed ?? false) || passed,
      bestSpeed: better ? speed : prev.bestSpeed,
      bestAccuracy: better ? accuracy : prev.bestAccuracy,
      attempts: (prev?.attempts ?? 0) + 1,
      timeouts: (prev?.timeouts ?? 0) + timeouts,
      at: Date.now(),
    }
    touchSave()
  }

  function isStageUnlocked(id: string): boolean {
    return save.value.progress.unlockedStages.includes(id)
  }

  function unlockStage(id: string): void {
    if (!save.value.progress.unlockedStages.includes(id)) {
      save.value.progress.unlockedStages.push(id)
      touchSave()
    }
  }

  function ensureCharStat(char: string): CharStat {
    const stat = save.value.stats[char] ?? { attempts: 0, errors: 0, totalMs: 0, lastAt: 0 }
    save.value.stats[char] = stat
    return stat
  }

  function getCharStat(char: string): CharStat | undefined {
    return save.value.stats[char]
  }

  function recordCharDone(char: string, ms: number): void {
    const stat = ensureCharStat(char)
    stat.attempts += 1
    stat.totalMs += Math.max(0, Math.round(ms))
    stat.lastAt = Date.now()
    touchSave()
  }

  function recordCharError(char: string): void {
    const stat = ensureCharStat(char)
    stat.errors += 1
    stat.lastAt = Date.now()
    touchSave()
  }

  function exportSave(): string {
    return JSON.stringify({ ...save.value, exportedAt: Date.now() }, null, 2)
  }

  function importSave(text: string): { ok: boolean; error?: string } {
    try {
      const data = JSON.parse(text) as Partial<SaveV2>
      if (data.version !== 2) {
        return { ok: false, error: '存档版本不匹配（需要 version: 2）' }
      }
      save.value = {
        version: 2,
        exportedAt: data.exportedAt ?? 0,
        progress: {
          unlockedStages: data.progress?.unlockedStages ?? [],
          levels: data.progress?.levels ?? {},
        },
        mistakes: data.mistakes ?? {},
        stats: data.stats ?? {},
      }
      flushSave()
      return { ok: true }
    } catch {
      return { ok: false, error: '存档解析失败' }
    }
  }

  function resetAll(): void {
    save.value = emptySave()
    flushSave()
  }

  return {
    save,
    getLevelResult,
    isLevelPassed,
    recordLevelResult,
    isStageUnlocked,
    unlockStage,
    getCharStat,
    recordCharDone,
    recordCharError,
    exportSave,
    importSave,
    resetAll,
  }
}
