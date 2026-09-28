import { beforeEach, describe, expect, it } from 'vitest'
import { flushSave, loadSaveFromStorage, useSave } from './useSave'

const {
  recordLevelResult,
  recordCharDone,
  recordCharError,
  isLevelPassed,
  unlockStage,
  isStageUnlocked,
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
