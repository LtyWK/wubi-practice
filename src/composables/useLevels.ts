import type { LevelResult, StageConfig } from '@/types'
import { STAGES } from '@/data/stages'
import { useSave } from './useSave'

/** 阶段与小关进度：解锁、成绩、通关同步 */
export function useLevels(): {
  stages: StageConfig[]
  isStageUnlocked: (stageId: string) => boolean
  isLevelPassed: (levelId: string) => boolean
  levelResult: (levelId: string) => LevelResult | undefined
  stageProgress: (stage: StageConfig) => { passed: number; total: number }
  syncUnlocks: () => void
  recordResult: (
    levelId: string,
    speed: number,
    accuracy: number,
    passed: boolean,
    timeouts: number,
  ) => void
} {
  const { isStageUnlocked, unlockStage, isLevelPassed, getLevelResult, recordLevelResult } =
    useSave()

  function stageProgress(stage: StageConfig): { passed: number; total: number } {
    const total = stage.levels.length
    const passed = stage.levels.filter((l) => isLevelPassed(l.id)).length
    return { passed, total }
  }

  /** 首阶段默认解锁；阶段内全部小关达标则解锁下一阶段 */
  function syncUnlocks(): void {
    const first = STAGES[0]
    if (first) unlockStage(first.id)
    for (let i = 0; i < STAGES.length - 1; i += 1) {
      const stage = STAGES[i]
      if (stage.levels.length > 0 && stage.levels.every((l) => isLevelPassed(l.id))) {
        unlockStage(STAGES[i + 1].id)
      }
    }
  }

  function recordResult(
    levelId: string,
    speed: number,
    accuracy: number,
    passed: boolean,
    timeouts: number,
  ): void {
    recordLevelResult(levelId, speed, accuracy, passed, timeouts)
    syncUnlocks()
  }

  return {
    stages: STAGES,
    isStageUnlocked,
    isLevelPassed,
    levelResult: getLevelResult,
    stageProgress,
    syncUnlocks,
    recordResult,
  }
}
