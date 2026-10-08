/** 脚本训练行中的单个格子 */
export interface ScriptCell {
  /** 显示字符 */
  char: string
  /** 是否参与输入（汉字参与；标点、空格仅显示） */
  train: boolean
  /** 训练字符对应的输入序号（非训练为 -1） */
  inputIndex: number
}

/** 脚本行：提示行 / 空行 / 训练行 */
export type ScriptLine =
  | { kind: 'hint'; text: string }
  | { kind: 'blank' }
  | { kind: 'chars'; cells: ScriptCell[] }

export interface ParsedScript {
  lines: ScriptLine[]
  /** 全部训练字符（按顺序），供创建输入会话 */
  chars: string[]
}

/** 是否汉字（与 pool.ts 的 isHan 判定一致） */
function isHan(c: string): boolean {
  return /[\u4e00-\u9fff]/.test(c)
}

/** 提示行格式：[...]，两端空白忽略 */
const HINT_RE = /^\[.*\]$/

/**
 * 解析训练脚本：
 * - `[...]` 提示行不参与训练；
 * - 空行为空行；
 * - 其他行逐字符拆格：汉字参与输入（按序编号），标点/空格仅显示。
 */
export function parseScript(lines: string[]): ParsedScript {
  const out: ScriptLine[] = []
  const chars: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') {
      out.push({ kind: 'blank' })
      continue
    }
    if (HINT_RE.test(line)) {
      out.push({ kind: 'hint', text: line })
      continue
    }
    const cells: ScriptCell[] = []
    for (const ch of line) {
      if (isHan(ch)) {
        cells.push({ char: ch, train: true, inputIndex: chars.length })
        chars.push(ch)
      } else {
        cells.push({ char: ch, train: false, inputIndex: -1 })
      }
    }
    out.push({ kind: 'chars', cells })
  }
  return { lines: out, chars }
}
