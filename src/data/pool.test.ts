import { describe, expect, it } from 'vitest'
import type { LevelConfig, RadicalWeight } from '@/types'
import { ensureScheme } from '@/schemes/registry'
import { buildLevelChars, buildPool, drillSequence, randomSequence, sample, shapeOfIdcode, shuffle, weightedSequence } from './pool'

function rw(key: string, count: number): RadicalWeight {
  return { root: `pua-${key}`, key, count }
}

function counts(seq: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of seq) m.set(x, (m.get(x) ?? 0) + 1)
  return m
}

function hasAdjacentDuplicate(seq: string[]): boolean {
  for (let i = 1; i < seq.length; i += 1) {
    if (seq[i] === seq[i - 1]) return true
  }
  return false
}

describe('randomSequence', () => {
  it('池为空或长度为 0 时返回空数组', () => {
    expect(randomSequence([], 10)).toEqual([])
    expect(randomSequence(['a'], 0)).toEqual([])
  })

  it('单元素池按数量重复填充', () => {
    expect(randomSequence(['a'], 5)).toEqual(['a', 'a', 'a', 'a', 'a'])
  })

  it('长序列不出现相邻重复，且各元素出现次数均分', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    const seq = randomSequence(pool, 200)
    expect(seq).toHaveLength(200)
    expect(hasAdjacentDuplicate(seq)).toBe(false)
    const c = counts(seq)
    for (const x of pool) expect(c.get(x)).toBe(40)
  })

  it('长度非整除时各元素次数差不超过 1，且无相邻重复', () => {
    const seq = randomSequence(['a', 'b', 'c'], 10)
    expect(seq).toHaveLength(10)
    expect(hasAdjacentDuplicate(seq)).toBe(false)
    expect([...counts(seq).values()].sort()).toEqual([3, 3, 4])
  })

  it('sample 复用 randomSequence：长度正确且无相邻重复', () => {
    const seq = sample(['a', 'b', 'c'], 7)
    expect(seq).toHaveLength(7)
    expect(hasAdjacentDuplicate(seq)).toBe(false)
  })
})

describe('weightedSequence', () => {
  it('空表或长度为 0 时返回空数组', () => {
    expect(weightedSequence([], 10)).toEqual([])
    expect(weightedSequence([rw('a', 1)], 0)).toEqual([])
  })

  it('单元素表按数量重复填充', () => {
    const only = rw('a', 5)
    expect(weightedSequence([only], 4)).toEqual([only, only, only, only])
  })

  it('高频字根出现次数明显更多', () => {
    const high = rw('a', 1000)
    const low = rw('b', 1)
    const seq = weightedSequence([high, low], 2000)
    const highCount = seq.filter((x) => x.key === 'a').length
    expect(seq).toHaveLength(2000)
    expect(highCount).toBeGreaterThan(1500)
  })

  it('尽量使相邻题目的键位不同', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((k) => rw(k, 10))
    const seq = weightedSequence(items, 200)
    let adjacentSame = 0
    for (let i = 1; i < seq.length; i += 1) {
      if (seq[i].key === seq[i - 1].key) adjacentSame += 1
    }
    expect(seq).toHaveLength(200)
    expect(adjacentSame).toBe(0)
  })
})

describe('shuffle', () => {
  it('保持元素集合不变且不修改原数组', () => {
    const src = ['a', 'b', 'c', 'd']
    const out = shuffle(src)
    expect([...out].sort()).toEqual([...src].sort())
    expect(src).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('shapeOfIdcode', () => {
  it('由识别码末位推导字型（横GFD/竖HJK/撇TRE/捺YUI/折NBV）', () => {
    expect(shapeOfIdcode('fbn')).toBe(1) // 地：末 N = 左右
    expect(shapeOfIdcode('def')).toBe(2) // 有：末 F = 上下
    expect(shapeOfIdcode('khk')).toBe(3) // 中：末 K = 杂合
    expect(shapeOfIdcode('vbg')).toBe(1) // 好：末 G = 左右
    expect(shapeOfIdcode('lgyi')).toBe(3) // 国：末 I = 杂合
  })

  it('末位未落在识别码键位集合时返回 null', () => {
    // 识别码仅用 15 键：横 GFD / 竖 HJK / 撇 TRE / 捺 YUI / 折 NBV
    expect(shapeOfIdcode('abc')).toBeNull()
    expect(shapeOfIdcode('vw')).toBeNull()
    expect(shapeOfIdcode('qpm')).toBeNull()
  })
})

describe('drillSequence', () => {
  it('按池顺序每字连打 repeat 遍', () => {
    expect(drillSequence(['a', 'b', 'c'], 2, 6)).toEqual(['a', 'a', 'b', 'b', 'c', 'c'])
  })

  it('不足 total 时以乱序补足且不出现相邻重复', () => {
    const seq = drillSequence(['a', 'b', 'c', 'd'], 1, 10)
    expect(seq).toHaveLength(10)
    expect(seq.slice(0, 4)).toEqual(['a', 'b', 'c', 'd'])
    expect(hasAdjacentDuplicate(seq)).toBe(false)
  })

  it('超出 total 时截断', () => {
    expect(drillSequence(['a', 'b', 'c'], 3, 4)).toEqual(['a', 'a', 'a', 'b'])
  })

  it('空池或非正数量返回空数组', () => {
    expect(drillSequence([], 3, 9)).toEqual([])
    expect(drillSequence(['a'], 2, 0)).toEqual([])
  })
})

function level(extra: Partial<LevelConfig>): LevelConfig {
  return {
    id: 'test',
    type: 'danzi',
    title: 'test',
    pool: [],
    length: 100,
    timeoutMs: 5000,
    require: { speed: 0, accuracy: 0 },
    ...extra,
  }
}

describe('buildLevelChars（真数据 wubi86）', () => {
  it('mix：按权重分配题数并合并洗牌', async () => {
    await ensureScheme('wubi86')
    const chars = await buildLevelChars(
      level({
        length: 40,
        mix: [
          { source: 'short1', weight: 1 },
          { source: 'short2', weight: 3 },
        ],
      }),
      'wubi86',
    )
    expect(chars).toHaveLength(40)
    const [short1, short2] = await Promise.all([
      buildPool(level({ source: 'short1' }), 'wubi86'),
      buildPool(level({ source: 'short2' }), 'wubi86'),
    ])
    const allowed = new Set([...short1, ...short2])
    expect(chars.every((c) => allowed.has(c))).toBe(true)
  })

  it('drill：每字恰好连打 drillRepeat 遍', async () => {
    await ensureScheme('wubi86')
    const chars = await buildLevelChars(
      level({ source: 'short1', pattern: 'drill', drillRepeat: 4, drillShuffle: true }),
      'wubi86',
    )
    expect(chars).toHaveLength(100)
    const c = counts(chars)
    expect(c.size).toBe(25)
    for (const n of c.values()) expect(n).toBe(4)
  })
})

describe('buildPool 过滤（真数据 wubi86）', () => {
  it('idcode + rootCount + shape：双字根识别码·左右/上下型', async () => {
    await ensureScheme('wubi86')
    const pool = await buildPool(
      level({ source: 'idcode', rootCount: 2, shape: [1, 2] }),
      'wubi86',
    )
    expect(pool.length).toBeGreaterThan(0)
  })

  it('rootCount：四字根全码字', async () => {
    await ensureScheme('wubi86')
    const pool = await buildPool(level({ source: 'freq1', rootCount: 4 }), 'wubi86')
    expect(pool.length).toBeGreaterThan(0)
  })
})
