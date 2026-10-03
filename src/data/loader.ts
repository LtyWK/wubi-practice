import type { Article, CharEntry, RadicalWeight, WubiScheme, ZigenItem } from '@/types'

type CharsTable = Record<string, CharEntry>

/**
 * 所有 generated JSON 的懒加载器（构建期静态展开，支持方案化路径）。
 * 数据由 `pnpm data:build` 生成到 src/data/generated/{scheme}/。
 */
const modules = import.meta.glob('./generated/**/*.json')

function loadJson<T>(path: string): Promise<T> {
  const loader = modules[`./generated/${path}`]
  if (!loader) {
    return Promise.reject(new Error(`数据文件不存在：${path}（请先运行 pnpm data:build）`))
  }
  return loader().then((m) => (m as { default: T }).default)
}

/** 按 key 缓存懒加载 Promise */
const caches = new Map<string, Promise<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!caches.has(key)) caches.set(key, load())
  return caches.get(key) as Promise<T>
}

/** 懒加载全量单字码表 */
export function loadAllChars(scheme: WubiScheme): Promise<CharsTable> {
  return cached(`${scheme}/chars`, () => loadJson<CharsTable>(`${scheme}/chars.json`))
}

/** 懒加载一级常用字表 */
export function loadFreq1Chars(scheme: WubiScheme): Promise<CharsTable> {
  return cached(`${scheme}/freq1`, () => loadJson<CharsTable>(`${scheme}/chars.freq1.json`))
}

/** 懒加载字根表（含键盘布局） */
export function loadZigen(scheme: WubiScheme): Promise<ZigenItem[]> {
  return cached(`${scheme}/zigen`, () => loadJson<ZigenItem[]>(`${scheme}/zigen.json`))
}

/** 懒加载常用字根权重表 */
export function loadRadicalWeights(scheme: WubiScheme): Promise<RadicalWeight[]> {
  return cached(`${scheme}/weights`, () =>
    loadJson<RadicalWeight[]>(`${scheme}/radical-weights.json`),
  )
}

/** 懒加载公版文章库（方案共用） */
export function loadArticles(): Promise<Article[]> {
  return cached('articles', () => loadJson<Article[]>('articles.json'))
}
