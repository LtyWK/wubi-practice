import type { LevelConfig, RadicalWeight, WubiScheme } from '@/types'
import { loadAllChars, loadFreq1Chars } from './loader'
import { parseScript } from './script'

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
 * 由全码推导字型（识别码末位字母蕴含字型）：
 * 末笔区前 3 键依次为 左右(1) / 上下(2) / 杂合(3)。
 * 非识别码末位返回 null。
 */
export function shapeOfIdcode(code: string): 1 | 2 | 3 | null {
  const id = code[code.length - 1]
  const map: Record<string, 1 | 2 | 3> = {
    g: 1,
    f: 2,
    d: 3,
    h: 1,
    j: 2,
    k: 3,
    t: 1,
    r: 2,
    e: 3,
    y: 1,
    u: 2,
    i: 3,
    n: 1,
    b: 2,
    v: 3,
  }
  return map[id] ?? null
}

/**
 * drill 序列：按池顺序每字连打 repeat 遍；若不足 total，则以乱序补足。
 * 用于口诀记忆（顺序连打）与全码肌肉记忆（随机字序连打）训练。
 */
export function drillSequence(pool: string[], repeat: number, total: number): string[] {
  if (pool.length === 0 || total <= 0) return []
  const head: string[] = []
  for (const x of pool) {
    for (let i = 0; i < repeat && head.length < total; i += 1) head.push(x)
    if (head.length >= total) break
  }
  if (head.length >= total) return head.slice(0, total)
  const tail = randomSequence(pool, total - head.length)
  // 避免 drill 段末尾与乱序段首项相邻重复
  if (head.length > 0 && tail[0] === head[head.length - 1]) {
    const idx = tail.findIndex((x) => x !== head[head.length - 1])
    if (idx > 0) {
      const tmp = tail[0]
      tail[0] = tail[idx]
      tail[idx] = tmp
    }
  }
  return [...head, ...tail]
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
      // drill 模式按 starts 顺序排列（口诀序：G F D S A…）
      if (lv.pattern === 'drill') {
        const order = lv.starts
        pool.sort((a, b) => {
          const ka = all[a].short.find((s) => s.length === len)?.[0] ?? ''
          const kb = all[b].short.find((s) => s.length === len)?.[0] ?? ''
          return order.indexOf(ka) - order.indexOf(kb)
        })
      }
    }
    return pool
  }
  const freq = await loadFreq1Chars(scheme)
  let pool = Object.keys(freq)
  if (lv.source === 'idcode') pool = pool.filter((c) => freq[c].idcode)
  if (lv.rootCount !== undefined) {
    // 真实字根数：识别码字的 radicals 末位为识别码，需扣除
    const target = lv.rootCount
    pool = pool.filter((c) => freq[c].radicals.length - (freq[c].idcode ? 1 : 0) === target)
  }
  if (lv.shape && lv.shape.length > 0) {
    const set = new Set(lv.shape)
    pool = pool.filter((c) => {
      if (!freq[c].idcode) return false
      const shape = shapeOfIdcode(freq[c].code)
      return shape !== null && set.has(shape)
    })
  }
  if (lv.starts) {
    const set = new Set(lv.starts)
    pool = pool.filter((c) => set.has(freq[c].code[0]))
  }
  return pool
}

/**
 * 按关卡配置生成练习字符流（danzi 关；zigen/article 由视图另行处理）。
 * - script：按训练脚本顺序出题（提示行不参与）；
 * - mix：多源按权重分配题数，各自取样后合并洗牌；
 * - drill：按池顺序每字连打 drillRepeat 遍（drillShuffle 时每局随机字序）；
 * - 默认：从出题池均匀随机取样。
 */
export async function buildLevelChars(lv: LevelConfig, scheme: WubiScheme): Promise<string[]> {
  if (lv.script && lv.script.length > 0) {
    return parseScript(lv.script).chars
  }
  if (lv.mix && lv.mix.length > 0) {
    const totalWeight = lv.mix.reduce((sum, m) => sum + m.weight, 0)
    const merged: string[] = []
    let remaining = lv.length
    for (let i = 0; i < lv.mix.length; i += 1) {
      const m = lv.mix[i]
      const isLast = i === lv.mix.length - 1
      const want =
        isLast || totalWeight <= 0
          ? remaining
          : Math.round((lv.length * m.weight) / totalWeight)
      const count = Math.max(0, Math.min(want, remaining))
      if (count === 0) continue
      const sub = await buildPool({ ...lv, source: m.source, starts: undefined }, scheme)
      merged.push(...sample(sub, count))
      remaining -= count
    }
    return shuffle(merged)
  }
  const pool = await buildPool(lv, scheme)
  if (lv.pattern === 'drill') {
    const ordered = lv.drillShuffle ? shuffle(pool) : pool
    return drillSequence(ordered, lv.drillRepeat ?? 1, lv.length)
  }
  return sample(pool, lv.length)
}
