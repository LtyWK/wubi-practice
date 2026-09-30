import type { LevelConfig } from '@/types'
import { loadAllChars, loadFreq1Chars } from './loader'

/** 是否汉字 */
export function isHan(c: string): boolean {
  return /[\u4e00-\u9fff]/.test(c)
}

/** Fisher–Yates 洗牌（均匀随机，不修改原数组） */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/**
 * 生成长度 count 的随机序列：
 * - 循环洗牌取用，各元素出现次数尽量均分；
 * - 避免相邻元素相同（含跨轮边界）；
 * - 池不足时允许重复，池为空返回空数组。
 */
export function randomSequence<T>(pool: T[], count: number): T[] {
  if (pool.length === 0 || count <= 0) return []
  if (pool.length === 1) return new Array<T>(count).fill(pool[0])

  const out: T[] = []
  let prev: T | undefined
  while (out.length < count) {
    const round = shuffle(pool)
    // 跨轮边界去重：若本轮首个元素与上一轮末尾相同，则与后续不同元素交换
    if (prev !== undefined && round[0] === prev) {
      const idx = round.findIndex((x) => x !== prev)
      if (idx > 0) {
        const tmp = round[0]
        round[0] = round[idx]
        round[idx] = tmp
      }
    }
    for (const x of round) {
      if (out.length >= count) break
      out.push(x)
    }
    prev = out[out.length - 1]
  }
  return out
}

/** 随机抽取 count 个（池不足时允许重复，分布均匀且避免相邻重复） */
export function sample(pool: string[], count: number): string[] {
  return randomSequence(pool, count)
}

/** 按关卡配置构建出题池（单字关） */
export async function buildPool(lv: LevelConfig): Promise<string[]> {
  if (lv.source === 'short1' || lv.source === 'short2') {
    const all = await loadAllChars()
    const len = lv.source === 'short1' ? 1 : 2
    let pool = Object.keys(all).filter((c) => all[c].short.some((s) => s.length === len))
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
  if (lv.source === 'idcode') pool = pool.filter((c) => freq[c].idcode)
  if (lv.starts) {
    const set = new Set(lv.starts)
    pool = pool.filter((c) => set.has(freq[c].code[0]))
  }
  return pool
}
