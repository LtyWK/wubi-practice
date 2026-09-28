import { describe, expect, it } from 'vitest'
import type { CharStat } from '@/types'
import { buildDrillPool, isFasterThanMedian } from './drill'

function stat(attempts: number, errors: number, totalMs: number): CharStat {
  return { attempts, errors, totalMs, lastAt: 0 }
}

describe('buildDrillPool', () => {
  it('空统计返回空数组', () => {
    expect(buildDrillPool({})).toEqual([])
  })

  it('错误率高的字排在前面', () => {
    const pool = buildDrillPool({
      好: stat(10, 5, 1000),
      中: stat(10, 0, 1000),
      是: stat(10, 1, 1000),
    })
    expect(pool[0].char).toBe('好')
    expect(pool[1].char).toBe('是')
    expect(pool[2].char).toBe('中')
  })

  it('耗时高的字获得更高分', () => {
    const pool = buildDrillPool({
      慢: stat(4, 0, 12000),
      快: stat(4, 0, 1000),
    })
    expect(pool[0].char).toBe('慢')
  })

  it('限制返回数量', () => {
    const stats: Record<string, CharStat> = {}
    for (let i = 0; i < 20; i += 1) stats[`c${i}`] = stat(2, i, 500)
    expect(buildDrillPool(stats, 5)).toHaveLength(5)
  })
})

describe('isFasterThanMedian', () => {
  it('无样本时视为通过', () => {
    expect(isFasterThanMedian(1000, [])).toBe(true)
  })

  it('低于中位数通过、高于不通过', () => {
    expect(isFasterThanMedian(500, [400, 600, 1000])).toBe(true)
    expect(isFasterThanMedian(1200, [400, 600, 1000])).toBe(false)
  })
})
