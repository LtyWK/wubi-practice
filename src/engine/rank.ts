import type { LevelRank } from '@/types'

/**
 * 速度型段位：速度达到门槛的 1.3/1.15/1.0 倍，且正确率达到对应门槛。
 * 任何一项不满足时依次向下检查，最终为 C。
 */
export function rankFromSpeed(speed: number, baseSpeed: number, accuracy: number): LevelRank {
  if (baseSpeed <= 0 || !Number.isFinite(speed)) return 'C'
  if (speed >= baseSpeed * 1.3 && accuracy >= 0.99) return 'S'
  if (speed >= baseSpeed * 1.15 && accuracy >= 0.98) return 'A'
  if (speed >= baseSpeed * 1.0 && accuracy >= 0.95) return 'B'
  return 'C'
}

/** 字数型段位（限时冲刺）：按完成字数相对目标倍率评级（1.67/1.33 取 5/3、4/3） */
export function rankFromChars(done: number, target: number): LevelRank {
  if (target <= 0 || !Number.isFinite(done)) return 'C'
  if (done >= target * (5 / 3)) return 'S'
  if (done >= target * (4 / 3)) return 'A'
  if (done >= target * 1.0) return 'B'
  return 'C'
}

/** 无尽模式段位：单局字数达到目标的 4/2/1 倍 */
export function rankFromEndlessChars(done: number, target: number): LevelRank {
  if (target <= 0 || !Number.isFinite(done)) return 'C'
  if (done >= target * 4) return 'S'
  if (done >= target * 2) return 'A'
  if (done >= target * 1.0) return 'B'
  return 'C'
}
