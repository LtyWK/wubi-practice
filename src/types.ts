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

/** 结算弹窗中的错误选项 */
export interface MistakeOption {
  /** 唯一标识：单字为汉字，字根为键位 */
  id: string
  /** 主显示文本 */
  main: string
  /** 详情文本 */
  detail: string
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

/** 单字统计（V2） */
export interface CharStat {
  /** 完成次数 */
  attempts: number
  /** 累计错误击键 */
  errors: number
  /** 累计输入耗时（毫秒） */
  totalMs: number
  /** 最近一次记录时间 */
  lastAt: number
}

/** 关卡成绩（V2） */
export interface LevelResult {
  /** 是否达标 */
  passed: boolean
  bestSpeed: number
  bestAccuracy: number
  /** 尝试次数 */
  attempts: number
  /** 超时次数 */
  timeouts: number
  /** 最近一次时间戳 */
  at: number
}

/** V2 存档结构（localStorage 单键存储） */
export interface SaveV2 {
  version: 2
  exportedAt: number
  progress: {
    /** 已解锁阶段 id */
    unlockedStages: string[]
    /** 关卡成绩 */
    levels: Record<string, LevelResult>
  }
  mistakes: MistakeBook
  stats: Record<string, CharStat>
}
