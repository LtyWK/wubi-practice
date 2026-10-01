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
  /** 是否含识别码（V2，用于识别码专题关） */
  idcode?: boolean
}

/** 关卡配置（src/data/stages.ts 静态定义） */
export interface LevelConfig {
  /** 如 "s1-zigen-heng" */
  id: string
  type: 'zigen' | 'danzi' | 'article'
  /** 如 "横区字根（G F D S A）" */
  title: string
  /** zigen：键位列表；danzi/article：忽略 */
  pool: string[]
  /** 出题来源：danzi 为 short1/short2/freq1/idcode；zigen 为 radicals（常用字根加权） */
  source?: 'short1' | 'short2' | 'freq1' | 'idcode' | 'radicals'
  /** danzi 出题首码过滤（可选，用于按区分关） */
  starts?: string[]
  /** article：篇目 id 列表 */
  articleIds?: string[]
  /** 出题数量（article 为参考字数） */
  length: number
  /** 每键/每字超时（毫秒），超时仅提醒并计数 */
  timeoutMs: number
  /** 每批显示数量（默认 20） */
  batchSize?: number
  /** 达标要求 */
  require: { speed: number; accuracy: number }
}

/** 阶段配置（大关卡） */
export interface StageConfig {
  id: string
  title: string
  description: string
  levels: LevelConfig[]
}

/** 文章（V2，含公版出处） */
export interface Article {
  id: string
  title: string
  author: string
  /** 出处说明（公版来源） */
  source: string
  /** 难度 1-4 */
  difficulty: 1 | 2 | 3 | 4
  /** 段落列表（已清洗标点） */
  paragraphs: string[]
}

/** 字根表条目（由 zigen.json 的口诀/注释 + zigen-glyphs.json 的字形合并生成） */
export interface ZigenItem {
  /** 键位，如 "g" */
  key: string
  /** 键名字根（键盘左上角） */
  name: string
  /** 一级简码（键盘右上角） */
  short1: string
  /** 键盘主体字形（≤15，不含键名，相似相邻） */
  glyphs: string[]
  /** 完整字形（打字训练用） */
  all: string[]
  /** 分区：横/竖/撇/捺/折 */
  area: string
  /** 助记口诀 */
  mnemonic: string
  /** 字形注释（如 革字底、青字头） */
  notes?: { root: string; note: string }[]
}

/** 进度数据 */
export interface ProgressData {
  unlocked: string[]
  best: Record<string, { speed: number; accuracy: number; at: number }>
}

/** 文本面板字符状态（V2 五态） */
export type TextCharState = 'pending' | 'active' | 'done-clean' | 'done-wrong' | 'skip'

/** 键盘按键反馈 */
export interface KeyFeedback {
  /** 键位（字母或空格 " "） */
  key: string
  type: 'ok' | 'bad' | 'timeout'
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

/** 常用字根权重（由 scripts/build-chars.ts 统计一级常用字生成） */
export interface RadicalWeight {
  /** 字根代表字形（PUA 字符） */
  root: string
  /** 所属键位 */
  key: string
  /** 一级常用字中的出现次数 */
  count: number
}

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
