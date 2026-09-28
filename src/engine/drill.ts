import type { CharStat } from '@/types'

/** 加练候选 */
export interface DrillCandidate {
  char: string
  /** 综合得分（越高越需要练） */
  score: number
  /** 错误率 */
  errorRate: number
  /** 平均耗时（毫秒） */
  avgMs: number
}

/** 是否快于给定样本的中位数（用于 mastered 判定） */
export function isFasterThanMedian(ms: number, samples: number[]): boolean {
  if (samples.length === 0) return true
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = sorted[Math.floor(sorted.length / 2)]
  return ms <= mid
}

/**
 * 构建智能加练池：按 0.6×错误率 + 0.4×平均耗时（均归一化）降序排序。
 * 仅保留有错误或耗时为 0 之外的样本；返回前 limit 个。
 */
export function buildDrillPool(stats: Record<string, CharStat>, limit = 10): DrillCandidate[] {
  const entries = Object.entries(stats).map(([char, s]) => {
    const attempts = Math.max(1, s.attempts)
    return { char, errorRate: s.errors / attempts, avgMs: s.totalMs / attempts }
  })
  if (entries.length === 0) return []

  const maxError = Math.max(...entries.map((e) => e.errorRate), 0.0001)
  const maxMs = Math.max(...entries.map((e) => e.avgMs), 1)

  return entries
    .map((e) => ({
      ...e,
      score: 0.6 * (e.errorRate / maxError) + 0.4 * (e.avgMs / maxMs),
    }))
    .sort((a, b) => b.score - a.score || a.char.localeCompare(b.char))
    .slice(0, limit)
}
