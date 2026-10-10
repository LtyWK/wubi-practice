import { describe, expect, it } from 'vitest'
import type { InputScheme } from '@/schemes/base'
import { createSession, feedKey, type EngineEvent, type PracticeSession } from './judge'

const CODES: Record<string, string> = { 好: 'vb', 中: 'khk', 是: 'jghu', 我: 'trnt', 有: 'def' }
const SHORTS: Record<string, string[]> = {
  好: ['v', 'vb'],
  中: ['k', 'kh'],
  是: ['j', 'jgh'],
  有: ['e'],
}

const scheme: InputScheme = {
  id: 'wubi86',
  code: (char: string): string | null => CODES[char] ?? null,
  shorts: (char: string): string[] => SHORTS[char] ?? [],
  hint: () => [],
}

function feed(
  session: PracticeSession,
  keys: string[],
): { session: PracticeSession; events: EngineEvent[] } {
  let current = session
  const events: EngineEvent[] = []
  for (const key of keys) {
    const result = feedKey(current, key)
    current = result.session
    events.push(...result.events)
  }
  return { session: current, events }
}

describe('createSession', () => {
  it('跳过未收录字，首字置为 active', () => {
    const session = createSession(['好', '〇', '中'], scheme, 0)
    expect(session.items.map((i) => i.char)).toEqual(['好', '中'])
    expect(session.items[0].state).toBe('active')
    expect(session.items[1].state).toBe('pending')
    expect(session.finished).toBe(false)
  })
})

describe('feedKey 判定规则', () => {
  it('全码输满自动完成', () => {
    const { session, events } = feed(createSession(['好'], scheme, 0), ['v', 'b'])
    expect(session.finished).toBe(true)
    expect(session.correctChars).toBe(1)
    expect(events.map((e) => e.type)).toEqual([
      'key-accept',
      'key-accept',
      'char-done',
      'session-done',
    ])
  })

  it('一级简码 + 空格上屏', () => {
    const { session, events } = feed(createSession(['中'], scheme, 0), ['k', ' '])
    expect(session.finished).toBe(true)
    expect(events.map((e) => e.type)).toEqual(['key-accept', 'char-done', 'session-done'])
  })

  it('二级简码 + 空格上屏', () => {
    const { session } = feed(createSession(['中'], scheme, 0), ['k', 'h', ' '])
    expect(session.finished).toBe(true)
    expect(session.correctKeys).toBe(2)
  })

  it('错键拒绝且已接受输入保留', () => {
    const { session, events } = feed(createSession(['好'], scheme, 0), ['v', 'x'])
    expect(session.input).toBe('v')
    expect(session.totalKeys).toBe(2)
    expect(session.correctKeys).toBe(1)
    expect(events.map((e) => e.type)).toEqual(['key-accept', 'key-reject', 'char-error'])
  })

  it('错误事件携带 expect/actual', () => {
    const { events } = feed(createSession(['好'], scheme, 0), ['v', 'x'])
    const error = events.find((e) => e.type === 'char-error')
    expect(error).toMatchObject({ type: 'char-error', char: '好', expect: 'vb', actual: 'vx' })
  })

  it('空格误按记为错键', () => {
    const { session, events } = feed(createSession(['好'], scheme, 0), [' '])
    expect(session.totalKeys).toBe(1)
    expect(session.correctKeys).toBe(0)
    expect(events.map((e) => e.type)).toEqual(['key-reject', 'char-error'])
    expect(session.items[0].wrongAttempts).toEqual([' '])
  })

  it('多字连续推进', () => {
    const { session } = feed(createSession(['中', '好'], scheme, 0), ['k', ' '])
    expect(session.cursor).toBe(1)
    expect(session.items[0].state).toBe('done')
    expect(session.items[1].state).toBe('active')
    expect(session.finished).toBe(false)
  })

  it('末字完成触发 session-done', () => {
    const { session, events } = feed(createSession(['好'], scheme, 0), ['v', 'b'])
    expect(session.finished).toBe(true)
    expect(events.some((e) => e.type === 'session-done')).toBe(true)
  })

  it('非字母键一律忽略', () => {
    const base = createSession(['好'], scheme, 0)
    for (const key of ['1', 'V', 'Backspace', 'Enter']) {
      const result = feedKey(base, key)
      expect(result.events).toEqual([])
      expect(result.session).toBe(base)
    }
  })
})

describe('简码非全码前缀', () => {
  it('「有」全码 def / 简码 e：可直接 e + 空格上屏', () => {
    const { session } = feed(createSession(['有'], scheme, 0), ['e', ' '])
    expect(session.finished).toBe(true)
    expect(session.correctKeys).toBe(1)
  })

  it('「有」仍可按全码 d e f 完成', () => {
    const { session } = feed(createSession(['有'], scheme, 0), ['d', 'e', 'f'])
    expect(session.finished).toBe(true)
  })

  it('无关按键仍被拒绝', () => {
    const { session, events } = feed(createSession(['有'], scheme, 0), ['x'])
    expect(session.input).toBe('')
    expect(events[0].type).toBe('key-reject')
  })

  it('requireFull 下简码键被拒绝（必须走全码）', () => {
    const session = createSession(['有'], scheme, 0, { requireFull: true })
    const { session: after, events } = feed(session, ['e'])
    expect(after.input).toBe('')
    expect(events[0].type).toBe('key-reject')
  })
})

describe('requireFull 强制全码', () => {
  it('默认会话 requireFull 为 false', () => {
    expect(createSession(['好'], scheme, 0).requireFull).toBe(false)
  })

  it('开启后简码 + 空格不再上屏，空格记为错键', () => {
    const session = createSession(['中'], scheme, 0, { requireFull: true })
    const { session: after, events } = feed(session, ['k', ' '])
    expect(after.finished).toBe(false)
    expect(after.cursor).toBe(0)
    expect(events.map((e) => e.type)).toEqual(['key-accept', 'key-reject', 'char-error'])
    expect(after.items[0].wrongAttempts).toEqual(['k '])
  })

  it('开启后输满全码仍可完成', () => {
    const session = createSession(['好'], scheme, 0, { requireFull: true })
    const { session: after } = feed(session, ['v', 'b'])
    expect(after.finished).toBe(true)
    expect(after.correctChars).toBe(1)
  })
})

describe('退格', () => {
  it('删除当前字已输入末位字符并派发 key-back，不计入击键统计', () => {
    const s1 = feed(createSession(['我'], scheme, 0), ['t']).session
    expect(s1.input).toBe('t')
    const { session: s2, events } = feedKey(s1, 'Backspace')
    expect(s2.input).toBe('')
    expect(events.map((e) => e.type)).toEqual(['key-back'])
    expect(s2.totalKeys).toBe(s1.totalKeys)
    expect(s2.correctKeys).toBe(s1.correctKeys)
    expect(s2.cursor).toBe(0)
  })

  it('空输入时退格无事件、会话不变', () => {
    const base = createSession(['我'], scheme, 0)
    const result = feedKey(base, 'Backspace')
    expect(result.events).toEqual([])
    expect(result.session).toBe(base)
  })

  it('已发生的错误计数不因退格回滚', () => {
    const s1 = feed(createSession(['我'], scheme, 0), ['x']).session
    expect(s1.totalKeys).toBe(1)
    const s2 = feed(s1, ['t', 'Backspace']).session
    expect(s2.totalKeys).toBe(2)
    expect(s2.correctKeys).toBe(1)
    expect(s2.input).toBe('')
  })

  it('退格后可重新输入并完成', () => {
    const { session } = feed(createSession(['好'], scheme, 0), ['v', 'Backspace', 'v', 'b'])
    expect(session.finished).toBe(true)
    expect(session.correctChars).toBe(1)
  })

  it('requireFull 下同样支持退格', () => {
    const session = createSession(['好'], scheme, 0, { requireFull: true })
    const { session: after } = feed(session, ['v', 'Backspace', 'v', 'b'])
    expect(after.finished).toBe(true)
  })
})
