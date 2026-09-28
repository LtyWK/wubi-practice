import { beforeEach, describe, expect, it } from 'vitest'
import { useMistakes } from './useMistakes'
import { flushSave } from './useSave'

const { record, markMastered, pending, reset, book } = useMistakes()

beforeEach(() => {
  reset()
})

describe('useMistakes', () => {
  it('记录错误并累计次数', () => {
    record('好', 'vb', 'vx')
    record('好', 'vb', 'v')
    expect(book.value['好'].count).toBe(2)
    expect(book.value['好'].code).toBe('vb')
  })

  it('lastWrongInputs 上限 5 条且最新在前', () => {
    for (let i = 0; i < 7; i += 1) record('好', 'vb', `e${i}`)
    const arr = book.value['好'].lastWrongInputs
    expect(arr).toHaveLength(5)
    expect(arr[0]).toBe('e6')
  })

  it('标记掌握后不再出现在默认错题列表', () => {
    record('好', 'vb', 'vx')
    expect(pending()).toHaveLength(1)
    markMastered('好')
    expect(pending()).toHaveLength(0)
    expect(book.value['好'].mastered).toBe(true)
  })

  it('再次出错会重置掌握标记', () => {
    record('好', 'vb', 'vx')
    markMastered('好')
    record('好', 'vb', 'v')
    expect(book.value['好'].mastered).toBe(false)
  })

  it('持久化到 localStorage（统一存档 mistakes 字段）', () => {
    record('好', 'vb', 'vx')
    flushSave()
    const raw = localStorage.getItem('wubi.v2.save')
    expect(raw).toBeTruthy()
    const data = JSON.parse(raw ?? '{}') as { mistakes?: Record<string, unknown> }
    expect(data.mistakes?.['好']).toBeTruthy()
  })
})
