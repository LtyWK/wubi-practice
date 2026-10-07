import { describe, expect, it } from 'vitest'
import type { PracticeSession } from './judge'
import { calcKeyStats, calcStats } from './stats'

function makeSession(
  correctChars: number,
  correctKeys: number,
  totalKeys: number,
  startAt: number,
): PracticeSession {
  return {
    items: [],
    cursor: 0,
    input: '',
    correctKeys,
    totalKeys,
    correctChars,
    startAt,
    finished: false,
    requireFull: false,
  }
}

describe('calcStats', () => {
  it('速度 = 字/分钟', () => {
    const stats = calcStats(makeSession(10, 30, 40, 0), 10_000)
    expect(stats.speed).toBeCloseTo(60)
    expect(stats.elapsedSec).toBe(10)
  })

  it('用时为 0 时速度为 0 且不除零', () => {
    const stats = calcStats(makeSession(5, 5, 5, 1000), 1000)
    expect(stats.speed).toBe(0)
    expect(stats.elapsedSec).toBe(0)
  })

  it('正确率 = 正确键/总键', () => {
    expect(calcStats(makeSession(0, 5, 10, 0), 1000).accuracy).toBeCloseTo(0.5)
  })

  it('无按键时正确率为 100%', () => {
    expect(calcStats(makeSession(0, 0, 0, 0), 1000).accuracy).toBe(1)
  })
})

describe('calcKeyStats', () => {
  it('字根练习速度为正确击键数/分钟', () => {
    const stats = calcKeyStats(20, 25, 0, 30_000)
    expect(stats.speed).toBeCloseTo(40)
    expect(stats.accuracy).toBeCloseTo(0.8)
  })
})
