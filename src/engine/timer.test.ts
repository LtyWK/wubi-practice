import { describe, expect, it } from 'vitest'
import { checkTimeout, elapsed, startChar } from './timer'

describe('CharTimer', () => {
  it('未到超时点不触发', () => {
    const timer = startChar(1000)
    const r = checkTimeout(timer, 4000, 3000)
    expect(r.timedOut).toBe(false)
    expect(r.timer.timeouts).toBe(0)
  })

  it('到达超时点触发一次', () => {
    const timer = startChar(1000)
    const r = checkTimeout(timer, 4000, 5000)
    expect(r.timedOut).toBe(true)
    expect(r.timer.timeouts).toBe(1)
  })

  it('同一超时点不重复触发', () => {
    let timer = startChar(1000)
    timer = checkTimeout(timer, 4000, 5000).timer
    const again = checkTimeout(timer, 4000, 5200)
    expect(again.timedOut).toBe(false)
  })

  it('连续超时按周期触发', () => {
    let timer = startChar(1000)
    timer = checkTimeout(timer, 4000, 5000).timer
    const second = checkTimeout(timer, 4000, 9000)
    expect(second.timedOut).toBe(true)
    expect(second.timer.timeouts).toBe(2)
  })

  it('timeoutMs <= 0 时不启用超时', () => {
    const r = checkTimeout(startChar(0), 0, 100000)
    expect(r.timedOut).toBe(false)
  })

  it('elapsed 返回当前字耗时', () => {
    expect(elapsed(startChar(100), 600)).toBe(500)
    expect(elapsed(startChar(600), 100)).toBe(0)
  })
})
