import { ref } from 'vue'
import type { ProgressData } from '@/types'

/** localStorage 键名 */
const KEY = 'wubi.v1.progress'

/** 最佳成绩记录 */
export interface BestRecord {
  speed: number
  accuracy: number
  at: number
}

function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const data = JSON.parse(raw) as Partial<ProgressData>
      return { unlocked: data.unlocked ?? [], best: data.best ?? {} }
    }
  } catch {
    // 忽略损坏或不可用的本地数据
  }
  return { unlocked: [], best: {} }
}

/** 模块级共享状态（跨视图） */
const progress = ref<ProgressData>(loadProgress())

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress.value))
  } catch {
    // 忽略写入失败（隐私模式等）
  }
}

/** 解锁进度与最佳成绩 */
export function useProgress(): {
  progress: typeof progress
  isUnlocked: (id: string) => boolean
  unlock: (id: string) => void
  recordBest: (id: string, speed: number, accuracy: number) => void
  bestOf: (id: string) => BestRecord | undefined
  reset: () => void
} {
  function isUnlocked(id: string): boolean {
    return progress.value.unlocked.includes(id)
  }

  function unlock(id: string): void {
    if (!progress.value.unlocked.includes(id)) {
      progress.value.unlocked.push(id)
      persist()
    }
  }

  function recordBest(id: string, speed: number, accuracy: number): void {
    const prev = progress.value.best[id]
    if (!prev || speed > prev.speed) {
      progress.value.best[id] = { speed, accuracy, at: Date.now() }
      persist()
    }
  }

  function bestOf(id: string): BestRecord | undefined {
    return progress.value.best[id]
  }

  function reset(): void {
    progress.value = { unlocked: [], best: {} }
    persist()
  }

  return { progress, isUnlocked, unlock, recordBest, bestOf, reset }
}
