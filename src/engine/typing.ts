/**
 * 严格模式跟打判定引擎（不可变会话风格）。
 * 与 judge.ts 的约定一致：每次 feed 返回新会话与新事件；
 * 时间戳一律由调用方传入（引擎不读 Date.now()），以便测试与回放。
 */

/** 跟打会话状态（不可变，每次 feed 返回新对象） */
export interface TypingSession {
  /** 目标字符（汉字） */
  target: string[]
  /** 已正确提交字数 */
  pos: number
  /** 当前位置的错误显示（最新一次错误输入）；无错误为 null */
  errorSlot: string | null
  /** 错误记录（按发生顺序） */
  errors: { index: number; input: string; at: number }[]
  /** 提交字符总数（含错误） */
  submitted: number
  /** 有效退格次数（实际清除了错误槽） */
  backspaces: number
  /** 首次有效输入时间 */
  startAt: number | null
  /** 完成时间 */
  finishedAt: number | null
}

/** 引擎向视图层抛出的事件 */
export type TypingEvent =
  | { type: 'correct'; index: number; char: string }
  | { type: 'wrong'; index: number; input: string }
  | { type: 'backspace' }
  | { type: 'complete' }

/** 创建跟打会话：target 拷贝一份，避免外部修改影响会话状态 */
export function createTypingSession(target: string[]): TypingSession {
  return {
    target: [...target],
    pos: 0,
    errorSlot: null,
    errors: [],
    submitted: 0,
    backspaces: 0,
    startAt: null,
    finishedAt: null,
  }
}

/**
 * 以指定时间启动计时（跟打器：首次物理按键时调用，使用时包含首字输入时间，
 * 避免「首字免费」导致速度虚高）。已开始计时的会话保持不变。
 */
export function startTyping(s: TypingSession, at: number): TypingSession {
  if (s.startAt !== null) return s
  return { ...s, startAt: at }
}

/**
 * 提交一个字符。
 * - 已完成（pos 达到 target 长度）时忽略输入，原样返回；
 * - 与目标一致：前进一格并清空错误槽，末字完成时记录 finishedAt 并派发 complete；
 * - 不一致：覆盖错误槽并记录错误，不前进。
 *   错误槽有值时直接输入正确字符即可前进，无需先退格。
 * - startAt 兜底：未调用 startTyping 时以首次提交时间开始计时。
 */
export function feedChar(
  s: TypingSession,
  char: string,
  now: number,
): { session: TypingSession; events: TypingEvent[] } {
  const events: TypingEvent[] = []
  if (s.pos >= s.target.length) return { session: s, events }

  if (char === s.target[s.pos]) {
    const index = s.pos
    const next: TypingSession = {
      ...s,
      pos: index + 1,
      errorSlot: null,
      errors: [...s.errors],
      submitted: s.submitted + 1,
      startAt: s.startAt ?? now,
    }
    events.push({ type: 'correct', index, char })
    if (next.pos >= next.target.length && next.finishedAt === null) {
      next.finishedAt = now
      events.push({ type: 'complete' })
    }
    return { session: next, events }
  }

  const next: TypingSession = {
    ...s,
    errorSlot: char,
    errors: [...s.errors, { index: s.pos, input: char, at: now }],
    submitted: s.submitted + 1,
    startAt: s.startAt ?? now,
  }
  events.push({ type: 'wrong', index: s.pos, input: char })
  return { session: next, events }
}

/**
 * 退格：仅清除当前位置的错误槽。
 * 错误槽为空时完全无操作（返回原会话、无事件）——已正确提交的字不可回退。
 */
export function feedBackspace(
  s: TypingSession,
  now: number,
): { session: TypingSession; events: TypingEvent[] } {
  const events: TypingEvent[] = []
  if (s.errorSlot === null) return { session: s, events }

  const next: TypingSession = {
    ...s,
    errorSlot: null,
    errors: [...s.errors],
    backspaces: s.backspaces + 1,
    startAt: s.startAt ?? now,
  }
  events.push({ type: 'backspace' })
  return { session: next, events }
}

/** 连续提交一段文本：逐字符走 feedChar，基于新会话链式处理 */
export function feedText(
  s: TypingSession,
  text: string,
  now: number,
): { session: TypingSession; events: TypingEvent[] } {
  let session = s
  const events: TypingEvent[] = []
  for (const char of text) {
    const result = feedChar(session, char, now)
    session = result.session
    events.push(...result.events)
  }
  return { session, events }
}

/**
 * 计算跟打统计。
 * - elapsedMs：未开始为 0；完成后冻结为 finishedAt - startAt（不随 now 增长）；
 * - speed：字/分钟（pos × 60000 ÷ elapsedMs），保留原始浮点，展示层再取整；
 * - accuracy：1 - 错误数 ÷ 提交数；尚未提交时为 1；
 * - finished：pos >= target.length，空 target（total=0）视为已完成。
 */
export function typingStats(
  s: TypingSession,
  now: number,
): {
  speed: number
  accuracy: number
  elapsedMs: number
  done: number
  total: number
  finished: boolean
} {
  const elapsedMs = s.startAt === null ? 0 : (s.finishedAt ?? now) - s.startAt
  const speed = elapsedMs > 0 ? (s.pos * 60000) / elapsedMs : 0
  const accuracy = s.submitted === 0 ? 1 : 1 - s.errors.length / s.submitted
  return {
    speed,
    accuracy,
    elapsedMs,
    done: s.pos,
    total: s.target.length,
    finished: s.pos >= s.target.length,
  }
}
