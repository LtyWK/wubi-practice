import type { CharEntry } from '@/types'

/** 全量单字码表（动态懒加载 + 内存缓存） */
let allCharsCache: Promise<Record<string, CharEntry>> | null = null

/** 一级（通用规范一级 3500）常用字 */
let freq1Cache: Promise<Record<string, CharEntry>> | null = null

/** 懒加载全量单字码表 */
export function loadAllChars(): Promise<Record<string, CharEntry>> {
  if (!allCharsCache) {
    allCharsCache = import('./generated/chars.json').then(
      (m) => m.default as unknown as Record<string, CharEntry>,
    )
  }
  return allCharsCache
}

/** 懒加载一级常用字表 */
export function loadFreq1Chars(): Promise<Record<string, CharEntry>> {
  if (!freq1Cache) {
    freq1Cache = import('./generated/chars.freq1.json').then(
      (m) => m.default as unknown as Record<string, CharEntry>,
    )
  }
  return freq1Cache
}
