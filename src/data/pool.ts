import type { LevelConfig, RadicalWeight, WubiScheme } from '@/types'
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

/**
 * 按权重生成字根序列。
 * - `exponent` 控制权重压缩：默认 0.5（sqrt，常用字根强化用，保留低频机会）；
 *   传 1 为线性（字根加练用，打错越多的字根出现频率越高）；
 * - 尽量让相邻题目的键位不同，使键位分布更均衡。
 */
export function weightedSequence(
  items: RadicalWeight[],
  count: number,
  exponent = 0.5,
): RadicalWeight[] {
  if (items.length === 0 || count <= 0) return []
  if (items.length === 1) return new Array<RadicalWeight>(count).fill(items[0])

  const weights = items.map((it) => Math.pow(Math.max(1, it.count), exponent))
  const total = weights.reduce((a, b) => a + b, 0)

  function pick(): RadicalWeight {
    let r = Math.random() * total
    for (let i = 0; i < items.length; i += 1) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }

  const out: RadicalWeight[] = []
  let prevKey = ''
  while (out.length < count) {
    let next = pick()
    // 避免连续出现同一键位，重抽有限次后接受
    for (let guard = 0; next.key === prevKey && guard < 8; guard += 1) next = pick()
    out.push(next)
    prevKey = next.key
  }
  return out
}

/** 按关卡配置构建出题池（单字关），码表按方案加载 */
export async function buildPool(lv: LevelConfig, scheme: WubiScheme): Promise<string[]> {
  if (lv.source === 'short1' || lv.source === 'short2') {
    const all = await loadAllChars(scheme)
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
  const freq = await loadFreq1Chars(scheme)
  let pool = Object.keys(freq)
  if (lv.source === 'idcode') pool = pool.filter((c) => freq[c].idcode)
  if (lv.starts) {
    const set = new Set(lv.starts)
    pool = pool.filter((c) => set.has(freq[c].code[0]))
  }
  return pool
}
