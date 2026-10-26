import type { PracticeSession } from './judge'

/**
 * 实时显示的最小统计窗口（毫秒）。
 * 开始时按键/字数样本过少，按真实耗时计算会得到虚高数值（首键 1 键 30ms ≈ 33 键/秒），
 * 因此在完成前按至少 1 秒窗口计算；完成与结算仍使用真实用时。
 */
export const MIN_LIVE_WINDOW_MS = 1000

/** 统计结果 */
export interface Stats {
  /** 速度：字/分钟 */
  speed: number
  /** 正确率：0-1 */
  accuracy: number
  /** 已用时（秒） */
  elapsedSec: number
}

/**
 * 计算会话统计。
 * 速度 = correctChars ÷ elapsedSec × 60；正确率 = correctKeys ÷ totalKeys。
 */
export function calcStats(session: PracticeSession, now: number): Stats {
  const elapsedMs = now - session.startAt
  const elapsedSec = elapsedMs > 0 ? elapsedMs / 1000 : 0
  const speed = elapsedSec > 0 ? (session.correctChars / elapsedSec) * 60 : 0
  const accuracy = session.totalKeys === 0 ? 1 : session.correctKeys / session.totalKeys
  return { speed, accuracy, elapsedSec }
}

/**
 * 计算按键级统计（用于字根练习：速度为正确击键数/分钟）。
 */
export function calcKeyStats(
  correctKeys: number,
  totalKeys: number,
  startAt: number,
  now: number,
): Stats {
  const elapsedMs = now - startAt
  const elapsedSec = elapsedMs > 0 ? elapsedMs / 1000 : 0
  const speed = elapsedSec > 0 ? (correctKeys / elapsedSec) * 60 : 0
  const accuracy = totalKeys === 0 ? 1 : correctKeys / totalKeys
  return { speed, accuracy, elapsedSec }
}
