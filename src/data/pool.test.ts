import { describe, expect, it } from 'vitest'
import type { RadicalWeight } from '@/types'
import { randomSequence, sample, shuffle, weightedSequence } from './pool'

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
