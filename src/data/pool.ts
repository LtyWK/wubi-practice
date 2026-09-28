import type { LevelConfig } from '@/types'
import { loadAllChars, loadFreq1Chars } from './loader'

/** 是否汉字 */
export function isHan(c: string): boolean {
  return /[\u4e00-\u9fff]/.test(c)
}

/** 随机抽取 count 个（池不足时允许重复） */
export function sample(pool: string[], count: number): string[] {
  if (pool.length === 0) return []
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const out: string[] = []
  while (out.length < count) {
    out.push(...shuffled.slice(0, count - out.length))
  }
  return out.slice(0, count)
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
