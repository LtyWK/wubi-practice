import { describe, expect, it } from 'vitest'
import {
  createTypingSession,
  feedBackspace,
  feedChar,
  feedText,
  startTyping,
  typingStats,
  type TypingEvent,
  type TypingSession,
} from './typing'

/** 逐字提交辅助：链式处理并累积事件 */
function typeChars(
  session: TypingSession,
  chars: string[],
  now: number,
): { session: TypingSession; events: TypingEvent[] } {
  let current = session
  const events: TypingEvent[] = []
  for (const char of chars) {
    const result = feedChar(current, char, now)
    current = result.session
    events.push(...result.events)
  }
  return { session: current, events }
}

describe('createTypingSession', () => {
  it('初始状态：未开始、无错误计数', () => {
    const s = createTypingSession(['你', '好'])
    expect(s).toEqual({
      target: ['你', '好'],
      pos: 0,
      errorSlot: null,
      errors: [],
      submitted: 0,
      backspaces: 0,
      startAt: null,
      finishedAt: null,
    })
  })

  it('target 为拷贝，外部数组变化不影响会话', () => {
    const source = ['你']
    const s = createTypingSession(source)
    source.push('好')
    expect(s.target).toEqual(['你'])
  })
})

describe('feedChar 正确输入', () => {
  it('全对完成：correct 序列、complete 事件、finishedAt', () => {
    const s0 = createTypingSession(['你', '好'])
    const r1 = feedChar(s0, '你', 1000)
    expect(r1.session.pos).toBe(1)
    expect(r1.session.submitted).toBe(1)
    expect(r1.session.startAt).toBe(1000)
    expect(r1.session.finishedAt).toBeNull()
    expect(r1.events).toEqual([{ type: 'correct', index: 0, char: '你' }])

    const r2 = feedChar(r1.session, '好', 2000)
    expect(r2.session.pos).toBe(2)
    expect(r2.session.submitted).toBe(2)
    expect(r2.session.finishedAt).toBe(2000)
    expect(r2.events).toEqual([{ type: 'correct', index: 1, char: '好' }, { type: 'complete' }])
  })

  it('startAt 只在首次输入时记录，后续不覆盖', () => {
    const r1 = feedChar(createTypingSession(['你', '好']), '你', 500)
    const r2 = feedChar(r1.session, '好', 900)
    expect(r2.session.startAt).toBe(500)
  })

  it('完成时间冻结：再次统计不随 now 增长', () => {
    const p1 = typeChars(createTypingSession(['你', '好']), ['你'], 0)
    const p2 = typeChars(p1.session, ['好'], 1000)
    const atFinish = typingStats(p2.session, 2000)
    const later = typingStats(p2.session, 99999)
    expect(later.elapsedMs).toBe(1000)
    expect(later.speed).toBe(atFinish.speed)
  })
})

describe('feedChar 错误输入', () => {
  it('错误不前进：pos 不变、wrong 事件、errorSlot、errors 记录、submitted 计数', () => {
    const r = feedChar(createTypingSession(['你', '好']), 'x', 100)
    expect(r.session.pos).toBe(0)
    expect(r.session.errorSlot).toBe('x')
    expect(r.session.errors).toEqual([{ index: 0, input: 'x', at: 100 }])
    expect(r.session.submitted).toBe(1)
    expect(r.session.startAt).toBe(100)
    expect(r.events).toEqual([{ type: 'wrong', index: 0, input: 'x' }])
  })

  it('错误后直接输入正确字符：前进并清槽，无需退格', () => {
    const s1 = feedChar(createTypingSession(['你', '好']), 'x', 100).session
    const r = feedChar(s1, '你', 200)
    expect(r.session.pos).toBe(1)
    expect(r.session.errorSlot).toBeNull()
    expect(r.session.finishedAt).toBeNull()
    expect(r.events).toEqual([{ type: 'correct', index: 0, char: '你' }])
    expect(r.session.errors).toEqual([{ index: 0, input: 'x', at: 100 }])
  })

  it('连续错误：errors 追加、errorSlot 为最新、index 为当前 pos', () => {
    let s = feedChar(createTypingSession(['你', '好']), 'x', 10).session
    s = feedChar(s, 'y', 20).session
    expect(s.errorSlot).toBe('y')
    expect(s.errors).toEqual([
      { index: 0, input: 'x', at: 10 },
      { index: 0, input: 'y', at: 20 },
    ])
    expect(s.submitted).toBe(2)
    expect(s.pos).toBe(0)
  })

  it('第二字错误时 index 为 1', () => {
    const s1 = feedChar(createTypingSession(['你', '好']), '你', 100).session
    const r = feedChar(s1, 'x', 200)
    expect(r.session.errors).toEqual([{ index: 1, input: 'x', at: 200 }])
    expect(r.events).toEqual([{ type: 'wrong', index: 1, input: 'x' }])
  })
})

describe('feedBackspace', () => {
  it('有错误槽：清槽、backspace 事件、backspaces 计数', () => {
    const s1 = feedChar(createTypingSession(['你']), 'x', 100).session
    const r = feedBackspace(s1, 200)
    expect(r.session.errorSlot).toBeNull()
    expect(r.session.backspaces).toBe(1)
    expect(r.session.pos).toBe(0)
    expect(r.session.startAt).toBe(100)
    expect(r.events).toEqual([{ type: 'backspace' }])
  })

  it('无错误时无操作：原会话引用、events 空、不计数不退格', () => {
    const base = createTypingSession(['你'])
    const r = feedBackspace(base, 100)
    expect(r.session).toBe(base)
    expect(r.events).toEqual([])
    expect(base.backspaces).toBe(0)
  })

  it('完成后退格无操作（已提交字不可回退）', () => {
    const done = feedChar(createTypingSession(['你']), '你', 100).session
    const r = feedBackspace(done, 200)
    expect(r.session).toBe(done)
    expect(r.events).toEqual([])
    expect(done.pos).toBe(1)
  })

  it('退格后可重新输入并完成', () => {
    const s1 = feedBackspace(feedChar(createTypingSession(['你']), 'x', 100).session, 150).session
    const r = feedChar(s1, '你', 200)
    expect(r.session.finishedAt).toBe(200)
    expect(r.events.map((e) => e.type)).toEqual(['correct', 'complete'])
  })
})

describe('feedText', () => {
  it('混合正确与错误：逐字链式处理并累积事件', () => {
    const { session, events } = feedText(createTypingSession(['你', '好', '吗']), '你x好吗', 500)
    expect(session.pos).toBe(3)
    expect(session.submitted).toBe(4)
    expect(session.finishedAt).toBe(500)
    expect(session.errors).toEqual([{ index: 1, input: 'x', at: 500 }])
    expect(events.map((e) => e.type)).toEqual([
      'correct',
      'wrong',
      'correct',
      'correct',
      'complete',
    ])
  })

  it('多次 feedText 基于新会话链式处理', () => {
    const s0 = createTypingSession(['你', '好'])
    const r1 = feedText(s0, '你', 100)
    const r2 = feedText(r1.session, '好', 200)
    expect(r2.session.finishedAt).toBe(200)
    expect(r2.session.startAt).toBe(100)
    expect(r2.events).toEqual([{ type: 'correct', index: 1, char: '好' }, { type: 'complete' }])
    expect(s0.pos).toBe(0)
  })

  it('空字符串无操作', () => {
    const base = createTypingSession(['你'])
    const r = feedText(base, '', 100)
    expect(r.session).toBe(base)
    expect(r.events).toEqual([])
  })
})

describe('完成后忽略输入', () => {
  it('完成后 feedChar 原样返回', () => {
    const done = typeChars(createTypingSession(['你']), ['你'], 100).session
    const r = feedChar(done, '好', 200)
    expect(r.session).toBe(done)
    expect(r.events).toEqual([])
    expect(done.finishedAt).toBe(100)
  })

  it('空 target 视为已完成，输入被忽略', () => {
    const base = createTypingSession([])
    const r = feedChar(base, '你', 100)
    expect(r.session).toBe(base)
    expect(r.events).toEqual([])
  })
})

describe('typingStats', () => {
  it('20 字 20 秒 → 60 字/分', () => {
    const target = Array.from('一二三四五六七八九十一二三四五六七八九十')
    expect(target).toHaveLength(20)
    const first = feedText(createTypingSession(target), target.slice(0, 10).join(''), 0).session
    const { session } = feedText(first, target.slice(10).join(''), 20000)
    const st = typingStats(session, 20000)
    expect(st.speed).toBe(60)
    expect(st.elapsedMs).toBe(20000)
    expect(st.accuracy).toBe(1)
    expect(st.done).toBe(20)
    expect(st.total).toBe(20)
    expect(st.finished).toBe(true)
  })

  it('2 错 10 提交 → 正确率 0.8', () => {
    let s = createTypingSession(Array.from('一二三四五六七八'))
    s = feedChar(s, 'x', 0).session
    s = feedChar(s, '一', 1000).session
    s = feedChar(s, 'x', 2000).session
    s = feedText(s, '二三四五六七八', 3000).session
    expect(s.submitted).toBe(10)
    expect(s.errors).toHaveLength(2)
    expect(s.pos).toBe(8)
    expect(typingStats(s, 3000).accuracy).toBeCloseTo(0.8, 10)
  })

  it('未开始：elapsedMs 与 speed 为 0，accuracy 为 1', () => {
    const st = typingStats(createTypingSession(['你']), 500)
    expect(st.elapsedMs).toBe(0)
    expect(st.speed).toBe(0)
    expect(st.accuracy).toBe(1)
    expect(st.finished).toBe(false)
  })

  it('空 target：total 为 0 且视为已完成', () => {
    const st = typingStats(createTypingSession([]), 100)
    expect(st.total).toBe(0)
    expect(st.done).toBe(0)
    expect(st.finished).toBe(true)
    expect(st.speed).toBe(0)
    expect(st.accuracy).toBe(1)
  })
})

describe('startTyping（跟打器：首次物理按键启动计时）', () => {
  it('设置 startAt，使首字输入时间计入用时（不再「首字免费」）', () => {
    const s0 = createTypingSession(['你', '好'])
    // 首次按键在 t=1000，首字提交在 t=2000：用时含首字输入的 1 秒
    const started = startTyping(s0, 1000)
    expect(started.startAt).toBe(1000)

    const first = feedChar(started, '你', 2000)
    expect(first.session.startAt).toBe(1000) // 提交不覆盖按键起点

    const st = typingStats(first.session, 2000)
    expect(st.elapsedMs).toBe(1000)
    expect(st.speed).toBe(60) // 1 字 / 1 秒

    const second = feedChar(first.session, '好', 3000)
    const done = typingStats(second.session, 3000)
    expect(done.elapsedMs).toBe(2000)
    expect(done.speed).toBe(60) // 2 字 / 2 秒，速度不再虚高
  })

  it('已开始计时的会话保持原 startAt', () => {
    const s0 = createTypingSession(['你'])
    const started = startTyping(s0, 1000)
    expect(startTyping(started, 5000)).toBe(started)

    // 未调用 startTyping 时，兜底以首次提交时间开始
    const s1 = createTypingSession(['你'])
    const submitted = feedChar(s1, '你', 700)
    expect(submitted.session.startAt).toBe(700)
  })
})

describe('不可变性', () => {
  it('所有 feed 均不修改入参会话', () => {
    const base = createTypingSession(['你', '好'])
    const before = { ...base, errors: [...base.errors] }
    feedChar(base, 'x', 100)
    feedChar(base, '你', 200)
    feedBackspace(base, 300)
    feedText(base, '你好', 400)
    expect(base).toEqual(before)
    expect(base.pos).toBe(0)
    expect(base.errors).toHaveLength(0)
  })

  it('返回的新会话与旧会话不共享 errors 数组', () => {
    const s0 = createTypingSession(['你'])
    const wrong = feedChar(s0, 'x', 100)
    expect(wrong.session).not.toBe(s0)
    expect(wrong.session.errors).not.toBe(s0.errors)
    expect(s0.errors).toHaveLength(0)

    const correct = feedChar(wrong.session, '你', 200)
    expect(correct.session.errors).not.toBe(wrong.session.errors)
    expect(wrong.session.errors).toHaveLength(1)
  })
})
