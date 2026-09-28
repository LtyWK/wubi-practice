/** 单字码表条目（由 scripts/build-chars.ts 生成） */
export interface CharEntry {
  /** 全码，如 "vb" */
  code: string
  /** 简码层级，如 ["v", "vb"] */
  short: string[]
  /** 拆字：[字根, 键位]，如 [["女","v"],["子","b"]] */
  radicals: [string, string][]
  /** 1 = 通用规范一级 3500 字 */
  freq: 0 | 1
}

/** 关卡配置（src/data/levels.ts 静态定义） */
export interface LevelConfig {
  /** 如 "zigen-heng" */
  id: string
  type: 'zigen' | 'danzi'
  /** 如 "横区字根（G F D S A）" */
  title: string
  /** zigen：键位列表；danzi：忽略 */
  pool: string[]
  /** danzi 出题池 */
  source?: 'short1' | 'short2' | 'freq1'
  /** danzi 出题首码过滤（可选，用于按区分关） */
  starts?: string[]
  /** 出题数量 */
  length: number
  /** 达标要求 */
  require: { speed: number; accuracy: number }
}

/** 字根表条目（scripts/sources/zigen.json） */
export interface ZigenItem {
  /** 键位，如 "g" */
  key: string
  /** 键名字根，如 "王" */
  name: string
  /** 分区：横/竖/撇/捺/折 */
  area: string
  /** 助记口诀 */
  mnemonic: string
  /** 该键位字根列表 */
  radicals: string[]
}

/** 进度数据 */
export interface ProgressData {
  unlocked: string[]
  best: Record<string, { speed: number; accuracy: number; at: number }>
}

/** 错题本（仅单字；字根错误仅存于会话级） */
export type MistakeBook = Record<
  string,
  {
    code: string
    count: number
    /** 最近最多 5 条错误输入 */
    lastWrongInputs: string[]
    lastAt: number
    mastered: boolean
  }
>
