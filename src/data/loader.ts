import type { Article, CharEntry, RadicalWeight, ZigenItem } from '@/types'

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

/** 公版文章库 */
let articlesCache: Promise<Article[]> | null = null

/** 懒加载文章库 */
export function loadArticles(): Promise<Article[]> {
  if (!articlesCache) {
    articlesCache = import('./generated/articles.json').then(
      (m) => m.default as unknown as Article[],
    )
  }
  return articlesCache
}

/** 常用字根权重表（一级常用字字根使用频率） */
let radicalWeightCache: Promise<RadicalWeight[]> | null = null

/** 懒加载常用字根权重表 */
export function loadRadicalWeights(): Promise<RadicalWeight[]> {
  if (!radicalWeightCache) {
    radicalWeightCache = import('./generated/radical-weights.json').then(
      (m) => m.default as unknown as RadicalWeight[],
    )
  }
  return radicalWeightCache
}

/** 25 键字根表 */
let zigenCache: Promise<ZigenItem[]> | null = null

/** 懒加载字根表 */
export function loadZigen(): Promise<ZigenItem[]> {
  if (!zigenCache) {
    zigenCache = import('./generated/zigen.json').then(
      (m) => m.default as unknown as ZigenItem[],
    )
  }
  return zigenCache
}
