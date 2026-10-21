import { beforeEach, describe, expect, it, vi } from 'vitest'

// 测试固定为 86 版方案（存档键 wubi.v2.save），与默认方案解耦
vi.hoisted(() => {
  localStorage.setItem('wubi.ui.scheme', 'wubi86')
})

import { flushSave, loadSaveFromStorage, useSave } from './useSave'

const {
  recordLevelResult,
  recordCharDone,
  recordCharError,
  isLevelPassed,
  unlockStage,
  isStageUnlocked,
  getTypingProgress,
  recordTypingGroup,
  reshuffleTyping,
  recordEndlessBest,
  getEndlessBest,
  getCharStat,
  exportSave,
  importSave,
  resetAll,
} = useSave()

beforeEach(() => {
  localStorage.clear()
  resetAll()
})

describe('useSave 关卡与阶段', () => {
  it('记录关卡成绩并保留最佳速度', () => {
    recordLevelResult('l1', 20, 0.9, true, 1)
    recordLevelResult('l1', 30, 0.8, true, 2)
    recordLevelResult('l1', 10, 1, false, 0)
    const result = useSave().getLevelResult('l1')
    expect(result?.bestSpeed).toBe(30)
    expect(result?.bestAccuracy).toBe(0.8)
    expect(result?.attempts).toBe(3)
    expect(result?.timeouts).toBe(3)
  })

  it('达标状态一旦为 true 不会被后续失败覆盖', () => {
    recordLevelResult('l1', 20, 0.9, true, 0)
    recordLevelResult('l1', 5, 0.5, false, 0)
    expect(isLevelPassed('l1')).toBe(true)
  })

  it('阶段解锁幂等', () => {
    unlockStage('s1')
    unlockStage('s1')
    expect(isStageUnlocked('s1')).toBe(true)
    expect(useSave().save.value.progress.unlockedStages).toHaveLength(1)
  })
})

describe('useSave 跟打器段位', () => {
  it('新段位更高时覆盖旧段位', () => {
    recordLevelResult('typing-1', 60, 0.9, true, 0, 'B')
    recordLevelResult('typing-1', 70, 0.95, true, 0, 'S')
    expect(useSave().getLevelResult('typing-1')?.rank).toBe('S')
  })

  it('旧段位更高时不被覆盖', () => {
    recordLevelResult('typing-1', 70, 0.95, true, 0, 'S')
    recordLevelResult('typing-1', 50, 0.8, true, 0, 'B')
    expect(useSave().getLevelResult('typing-1')?.rank).toBe('S')
  })

  it('未传段位时保留历史段位', () => {
    recordLevelResult('typing-1', 60, 0.9, true, 0, 'A')
    recordLevelResult('typing-1', 65, 0.92, true, 0)
    expect(useSave().getLevelResult('typing-1')?.rank).toBe('A')
  })

  it('首次未传段位时不产生段位', () => {
    recordLevelResult('typing-1', 60, 0.9, true, 0)
    expect(useSave().getLevelResult('typing-1')?.rank).toBeUndefined()
  })
})

describe('useSave 跟打器进度', () => {
  it('首次记录会创建进度', () => {
    recordTypingGroup('t1', 1, 60)
    const progress = getTypingProgress('t1')
    expect(progress?.groupIndex).toBe(1)
    expect(progress?.groupBests).toEqual([60])
  })

  it('连续两组分别记录最佳速度', () => {
    recordTypingGroup('t1', 1, 60)
    recordTypingGroup('t1', 2, 75)
    const progress = getTypingProgress('t1')
    expect(progress?.groupIndex).toBe(2)
    expect(progress?.groupBests).toEqual([60, 75])
  })

  it('groupIndex 不倒退', () => {
    recordTypingGroup('t1', 3, 60)
    recordTypingGroup('t1', 1, 80)
    expect(getTypingProgress('t1')?.groupIndex).toBe(3)
  })

  it('旧进度缺失/非法 groupIndex 时兜底，不产生 NaN 或回退', () => {
    // 模拟历史存档中进度对象缺少 groupIndex
    useSave().save.value.typing = { legacy: { groupBests: [55] } as never }
    recordTypingGroup('legacy', 2, 66)
    const progress = getTypingProgress('legacy')
    expect(progress?.groupIndex).toBe(2)
    expect(Number.isFinite(progress?.groupIndex)).toBe(true)
    expect(progress?.groupBests[0]).toBe(55)
  })

  it('同组更优速度覆盖、较差速度不覆盖', () => {
    recordTypingGroup('t1', 1, 60)
    recordTypingGroup('t1', 1, 80)
    recordTypingGroup('t1', 1, 50)
    expect(getTypingProgress('t1')?.groupBests[0]).toBe(80)
  })

  it('记录组进度时保留 shuffleSeed', () => {
    reshuffleTyping('t1', 42)
    recordTypingGroup('t1', 1, 70)
    expect(getTypingProgress('t1')?.shuffleSeed).toBe(42)
  })

  it('reshuffleTyping 重置进度并写入种子', () => {
    recordTypingGroup('t1', 2, 60)
    reshuffleTyping('t1', 9527)
    expect(getTypingProgress('t1')).toEqual({
      groupIndex: 0,
      groupBests: [],
      shuffleSeed: 9527,
    })
  })
})

describe('useSave 无尽模式纪录', () => {
  it('记录历史最高完成字数', () => {
    recordEndlessBest(120)
    recordEndlessBest(80)
    recordEndlessBest(150)
    expect(getEndlessBest()).toBe(150)
  })

  it('无纪录时返回 0', () => {
    expect(getEndlessBest()).toBe(0)
  })
})

describe('useSave 单字统计', () => {
  it('累计完成次数、耗时与错误', () => {
    recordCharDone('好', 1000)
    recordCharDone('好', 500)
    recordCharError('好')
    const stat = getCharStat('好')
    expect(stat?.attempts).toBe(2)
    expect(stat?.totalMs).toBe(1500)
    expect(stat?.errors).toBe(1)
  })
})

describe('useSave 导出导入', () => {
  it('导出后可完整导入', () => {
    recordLevelResult('l1', 25, 0.95, true, 0)
    recordCharDone('好', 800)
    const text = exportSave()

    resetAll()
    expect(isLevelPassed('l1')).toBe(false)

    const result = importSave(text)
    expect(result.ok).toBe(true)
    expect(isLevelPassed('l1')).toBe(true)
    expect(getCharStat('好')?.totalMs).toBe(800)
  })

  it('拒绝版本不匹配的存档', () => {
    const result = importSave(JSON.stringify({ version: 1 }))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('版本')
  })

  it('拒绝非法 JSON', () => {
    expect(importSave('not-json').ok).toBe(false)
  })

  it('导出导入往返保留跟打器进度与纪录', () => {
    recordTypingGroup('t1', 1, 70)
    reshuffleTyping('t2', 123)
    recordEndlessBest(200)
    const text = exportSave()

    resetAll()
    expect(getTypingProgress('t1')).toBeUndefined()
    expect(getEndlessBest()).toBe(0)

    const result = importSave(text)
    expect(result.ok).toBe(true)
    expect(getTypingProgress('t1')?.groupBests).toEqual([70])
    expect(getTypingProgress('t2')?.shuffleSeed).toBe(123)
    expect(getEndlessBest()).toBe(200)
  })
})

describe('旧存档兼容', () => {
  it('缺少 typing/records 的 v2 存档可正常加载与写入', () => {
    localStorage.setItem(
      'wubi.v2.save',
      JSON.stringify({
        version: 2,
        exportedAt: 0,
        progress: { unlockedStages: [], levels: {} },
        mistakes: {},
        stats: {},
      }),
    )

    const loaded = loadSaveFromStorage()
    expect(loaded.typing).toEqual({})
    expect(loaded.records).toEqual({})

    const api = useSave()
    api.save.value = loaded
    expect(() => api.recordTypingGroup('t-old', 1, 66)).not.toThrow()
    expect(api.getTypingProgress('t-old')?.groupIndex).toBe(1)
    expect(api.getEndlessBest()).toBe(0)
  })
})

describe('V1 迁移', () => {
  it('将 v1 进度与错题迁移到 v2 结构', () => {
    localStorage.clear()
    localStorage.setItem(
      'wubi.v1.progress',
      JSON.stringify({
        unlocked: ['zigen-heng'],
        best: { 'zigen-heng': { speed: 22, accuracy: 0.96, at: 123 } },
      }),
    )
    localStorage.setItem(
      'wubi.v1.mistakes',
      JSON.stringify({
        好: { code: 'vb', count: 2, lastWrongInputs: ['vx'], lastAt: 1, mastered: false },
      }),
    )
    const migrated = loadSaveFromStorage()
    expect(migrated.progress.levels['zigen-heng'].passed).toBe(true)
    expect(migrated.progress.levels['zigen-heng'].bestSpeed).toBe(22)
    expect(migrated.mistakes['好'].count).toBe(2)
    flushSave()
  })
})
