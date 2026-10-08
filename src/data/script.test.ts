import { describe, expect, it } from 'vitest'
import { parseScript } from './script'

describe('parseScript', () => {
  it('识别提示行 / 空行 / 训练行', () => {
    const { lines, chars } = parseScript(['[口诀]', '', '一 地'])
    expect(lines[0]).toEqual({ kind: 'hint', text: '[口诀]' })
    expect(lines[1]).toEqual({ kind: 'blank' })
    expect(lines[2].kind).toBe('chars')
    expect(chars).toEqual(['一', '地'])
  })

  it('标点与空格仅显示，不参与输入', () => {
    const { lines, chars } = parseScript(['一 地， 在。'])
    expect(chars).toEqual(['一', '地', '在'])
    const line = lines[0]
    if (line.kind !== 'chars') throw new Error('应为训练行')
    const trains = line.cells.filter((c) => c.train)
    expect(trains.map((c) => c.char)).toEqual(['一', '地', '在'])
    expect(trains.map((c) => c.inputIndex)).toEqual([0, 1, 2])
    expect(line.cells.filter((c) => !c.train).map((c) => c.char)).toEqual([' ', '，', ' ', '。'])
  })

  it('训练字序号与 chars 顺序一致（跨行连续编号）', () => {
    const { lines, chars } = parseScript(['一 一', '地 地'])
    expect(chars).toEqual(['一', '一', '地', '地'])
    const indexes = lines.flatMap((l) =>
      l.kind === 'chars' ? l.cells.filter((c) => c.train).map((c) => c.inputIndex) : [],
    )
    expect(indexes).toEqual([0, 1, 2, 3])
  })

  it('提示行两端空白忽略', () => {
    const { lines } = parseScript(['  [口诀]  '])
    expect(lines[0]).toEqual({ kind: 'hint', text: '[口诀]' })
  })

  it('连续提示与 drill 行生成完整序列', () => {
    const script = [
      '[口诀]',
      '一 地 在 要 工',
      '一 地 在 要 工',
      '[强化肌肉记忆，每个字至少记住前2码]',
      '一 一 一',
      '地 地 地',
    ]
    const { chars } = parseScript(script)
    expect(chars.length).toBe(5 + 5 + 3 + 3)
    expect(chars.slice(0, 5)).toEqual(['一', '地', '在', '要', '工'])
    expect(chars.slice(10, 13)).toEqual(['一', '一', '一'])
  })
})
