import type { InputScheme } from '@/schemes/base'

/** 单字在会话中的状态 */
export type CharState = 'pending' | 'active' | 'done'

/** 会话中的单个练习字 */
export interface PracticeItem {
  char: string
  code: string
  state: CharState
  /** 本字每次出错时已输入的内容快照 */
  wrongAttempts: string[]
  /** 该字可用简码（用于空格上屏判定） */
  shorts: string[]
}

/** 一次练习会话（不可变，每次 feedKey 返回新对象） */
export interface PracticeSession {
  items: PracticeItem[]
  /** 当前字下标 */
  cursor: number
  /** 当前字已接受的输入 */
  input: string
  correctKeys: number
  totalKeys: number
  correctChars: number
  /** 由调用方传入的时间戳 */
  startAt: number
  finished: boolean
  /** 强制全码：禁用简码 + 空格上屏，须输满全码方可通过 */
  requireFull: boolean
}

/** 创建会话的可选参数 */
export interface SessionOptions {
  /** 强制全码（全码训练关用），默认 false */
  requireFull?: boolean
}

/** 引擎向视图层抛出的事件 */
export type EngineEvent =
  | { type: 'key-accept' }
  | { type: 'key-reject'; expect: string; actual: string }
  | { type: 'char-done'; char: string }
  | { type: 'char-error'; char: string; expect: string; actual: string }
  | { type: 'session-done' }

/** 仅响应小写字母与空格 */
const KEY_RE = /^[a-z ]$/

/**
 * 创建练习会话。
 * 未收录（code 为 null）的字会被跳过。
 */
export function createSession(
  chars: string[],
  scheme: InputScheme,
  now: number,
  options: SessionOptions = {},
): PracticeSession {
  const items: PracticeItem[] = []
  for (const char of chars) {
    const code = scheme.code(char)
    if (!code) continue
    items.push({ char, code, state: 'pending', wrongAttempts: [], shorts: scheme.shorts(char) })
  }
  if (items.length > 0) items[0].state = 'active'
  return {
    items,
    cursor: 0,
    input: '',
    correctKeys: 0,
    totalKeys: 0,
    correctChars: 0,
    startAt: now,
    finished: items.length === 0,
    requireFull: options.requireFull ?? false,
  }
}

/** 深拷贝会话（items 与 wrongAttempts 均复制） */
function clone(session: PracticeSession): PracticeSession {
  return {
    ...session,
    items: session.items.map((item) => ({ ...item, wrongAttempts: [...item.wrongAttempts] })),
  }
}

/** 完成当前字并推进光标 */
function complete(session: PracticeSession, events: EngineEvent[]): void {
  const item = session.items[session.cursor]
  item.state = 'done'
  session.correctChars += 1
  events.push({ type: 'char-done', char: item.char })
  session.cursor += 1
  session.input = ''
  if (session.cursor >= session.items.length) {
    session.finished = true
    events.push({ type: 'session-done' })
  } else {
    session.items[session.cursor].state = 'active'
  }
}

/** 接受一个正确字母键 */
function accept(session: PracticeSession, key: string, events: EngineEvent[]): void {
  const item = session.items[session.cursor]
  session.input += key
  session.totalKeys += 1
  session.correctKeys += 1
  events.push({ type: 'key-accept' })
  if (session.input === item.code) complete(session, events)
}

/** 拒绝一个错误按键（字母或空格） */
function reject(session: PracticeSession, actual: string, events: EngineEvent[]): void {
  const item = session.items[session.cursor]
  session.totalKeys += 1
  item.wrongAttempts.push(actual)
  events.push({ type: 'key-reject', expect: item.code, actual })
  events.push({ type: 'char-error', char: item.char, expect: item.code, actual })
}

/**
 * 处理一次按键。
 * 返回新的会话与本次产生的事件列表；会话不满足输入条件时原样返回。
 */
export function feedKey(
  session: PracticeSession,
  key: string,
): { session: PracticeSession; events: EngineEvent[] } {
  const events: EngineEvent[] = []
  if (session.finished || !KEY_RE.test(key)) {
    return { session, events }
  }
  const next = clone(session)
  const item = next.items[next.cursor]

  if (key === ' ') {
    if (!next.requireFull && next.input.length > 0 && item.shorts.includes(next.input)) {
      complete(next, events)
    } else {
      reject(next, next.input + ' ', events)
    }
  } else if (item.code.startsWith(next.input + key)) {
    accept(next, key, events)
  } else {
    reject(next, next.input + key, events)
  }

  return { session: next, events }
}
