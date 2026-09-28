import { beforeEach, describe, expect, it } from 'vitest'
import { useProgress } from './useProgress'

const { isUnlocked, unlock, recordBest, bestOf, reset } = useProgress()

beforeEach(() => {
  reset()
})

describe('useProgress', () => {
  it('解锁后写入 localStorage', () => {
    unlock('zigen-heng')
    expect(isUnlocked('zigen-heng')).toBe(true)
    const raw = localStorage.getItem('wubi.v1.progress')
    expect(raw).toBeTruthy()
    const data = JSON.parse(raw ?? '{}') as { unlocked: string[] }
    expect(data.unlocked).toContain('zigen-heng')
  })

  it('重复解锁不产生重复项', () => {
    unlock('zigen-heng')
    unlock('zigen-heng')
    const raw = localStorage.getItem('wubi.v1.progress') ?? '{}'
    const data = JSON.parse(raw) as { unlocked: string[] }
    expect(data.unlocked.filter((id) => id === 'zigen-heng')).toHaveLength(1)
  })

  it('最佳成绩只保留更高速度', () => {
    recordBest('l1', 10, 0.9)
    recordBest('l1', 20, 0.85)
    expect(bestOf('l1')?.speed).toBe(20)
    recordBest('l1', 5, 1)
    expect(bestOf('l1')?.speed).toBe(20)
  })
})
