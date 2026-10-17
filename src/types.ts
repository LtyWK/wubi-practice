/** 五笔方案 id（86 版 / 98 王码） */
export type WubiScheme = 'wubi86' | 'wubi98'

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
  type: 'zigen' | 'danzi' | 'article' | 'intro' | 'typing'
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
  /** intro：教学关正文段落 */
  intro?: string[]
  /** 出题数量（article 为参考字数） */
  length: number
  /** 每键/每字超时（毫秒），超时仅提醒并计数 */
  timeoutMs: number
  /** 每批显示数量（默认 20） */
  batchSize?: number
  /** 出题模式：drill 表示每字连打 N 遍（口诀 / 全码肌肉记忆训练） */
  pattern?: 'drill'
  /** drill 每字连打遍数（默认 1） */
  drillRepeat?: number
  /** drill 出题时每局随机字序（默认 false：按 starts 顺序，即口诀序） */
  drillShuffle?: boolean
  /** 强制全码：禁用简码 + 空格上屏（全码训练关） */
  requireFull?: boolean
  /** 多源按权重混合出题（与 source 互斥） */
  mix?: { source: 'short1' | 'short2'; weight: number }[]
  /** 识别码字型过滤：1 左右 2 上下 3 杂合（source=idcode 时生效） */
  shape?: (1 | 2 | 3)[]
  /** 真实字根数过滤：radicals 去掉识别码后的字数（如 3 根字、4 根字） */
  rootCount?: number
  /**
   * 训练脚本（口诀关）：每行字符串。
   * - `[...]`：提示行，不参与输入；
   * - 空字符串：空行；
   * - 其他：训练行，汉字全部按顺序参与输入（标点/空格仅显示）。
   */
  script?: string[]
  /** 在拆字面板显示当前字的一级简码提示（一级简码训练关用） */
  showShort1?: boolean
  /** 在拆字面板显示简码规则说明与当前字全部层级简码（二级简码训练关用） */
  showShorts?: boolean
  /** 跟打器关卡配置（type='typing' 时必填，实际判定按此配置执行） */
  typing?: TypingConfig
  /** 达标要求（intro 关忽略；typing 关填展示用参考值，判定见 typing 配置） */
  require: { speed: number; accuracy: number }
}

/** 跟打器训练模式 */
export type TypingMode = 'climb' | 'sprint' | 'speedup' | 'marathon' | 'endless' | 'gauntlet'

/** 跟打器内容来源（common3500/词组表为方案共用数据；article 为文章库） */
export type TypingSource =
  | 'common3500'
  | 'words2'
  | 'words3'
  | 'words4'
  | 'words-mix'
  | 'article'

/** 跟打器关卡配置（type='typing'） */
export interface TypingConfig {
  /** 模式：climb 爬坡 / sprint 限时冲刺 / speedup 逐段提速 / marathon 耐力 / endless 无尽 / gauntlet 混合段落 */
  mode: TypingMode
  /** 内容来源 */
  source: TypingSource
  /** article 源：篇目 id 列表（多篇按序串接） */
  articleIds?: string[]
  /** 数组源：切片范围 [start, end)（缺省为全量） */
  range?: [number, number]
  /** climb：每组字数（默认 10） */
  groupSize?: number
  /** climb：组达标速度（字/分，默认 60） */
  groupSpeed?: number
  /** sprint：限时（秒） */
  durationSec?: number
  /** sprint/endless：达标字数 */
  charTarget?: number
  /** speedup：逐段速度门槛（字/分，按段落顺序，缺省沿用末档） */
  speedup?: number[]
  /** endless：错误上限（达到即结束） */
  errorLimit?: number
  /** sprint/endless：预生成文本长度（字） */
  poolSize?: number
  /** gauntlet：段落定义（依次完成） */
  segments?: TypingSegment[]
}

/** gauntlet 模式单段定义 */
export interface TypingSegment {
  /** 内容来源 */
  source: TypingSource
  /** article 源：篇目 id */
  articleIds?: string[]
  /** 数组源：切片范围 [start, end) */
  range?: [number, number]
  /** 字符数上限（article 源默认整篇） */
  count?: number
  /** 本段达标速度（字/分） */
  speed: number
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

/** 键盘布局单元（由 scripts/build-zigen.ts 生成） */
export interface LayoutCell {
  /** 字形（PUA 字符，由对应字根字体渲染） */
  cp: string
  /** 加粗显示（通常为键名字根） */
  bold: boolean
  /** 标记类型（仅标记，具体色值随主题） */
  mark: 'red' | 'green' | null
}

/** 字根表条目（严格来自人工配置，不做字根推理） */
export interface ZigenItem {
  /** 键位，如 "g" */
  key: string
  /** 键名字根（如 "王"） */
  name: string
  /** 一级简码（如 "一"） */
  short1: string
  /** 分区：1 横 2 竖 3 撇 4 捺 5 折 */
  area: number
  /** 助记口诀 */
  mnemonic: string
  /** 字根列表（PUA 字符，用于字根练习出题） */
  roots: string[]
  /** 键盘布局（矩阵尺寸 + 格子） */
  layout: { size: number; cells: (LayoutCell | null)[] }
}

/** 进度数据 */
export interface ProgressData {
  unlocked: string[]
  best: Record<string, { speed: number; accuracy: number; at: number }>
}

/** 文本面板字符状态（V2 五态） */
export type TextCharState = 'pending' | 'active' | 'done-clean' | 'done-wrong' | 'skip'

/** 文本面板项：字符流（danzi/article）或脚本关的提示行 / 换行 */
export type PanelItem =
  | { kind: 'char'; char: string; state: TextCharState }
  | { kind: 'hint'; text: string }
  | { kind: 'br' }

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

/** 跟打器段位（历史最高） */
export type LevelRank = 'S' | 'A' | 'B' | 'C'

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
  /** 跟打器关卡段位（历史最高） */
  rank?: LevelRank
}

/** 跟打器爬坡关卡进度（V3） */
export interface TypingProgress {
  /** 已通关组数（= 下一组索引） */
  groupIndex: number
  /** 随机排列种子（存在 = 本关使用随机序；缺省 = 默认字频序） */
  shuffleSeed?: number
  /** 每组最佳速度（字/分），下标 = 组序号 */
  groupBests: number[]
}

/** 跟打器特殊模式纪录（V3） */
export interface TypingRecords {
  /** 无尽模式单局最高完成字数 */
  endlessBestChars?: number
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
  /** 跟打器爬坡进度（S4/S5，V3） */
  typing?: Record<string, TypingProgress>
  /** 跟打器特殊模式纪录（V3） */
  records?: TypingRecords
}

/** 词组表（由 scripts/build-words.ts 生成，方案共用） */
export interface WordsTable {
  /** 常用二字词（权重降序） */
  words2: string[]
  /** 常用三字词（权重降序） */
  words3: string[]
  /** 常用四字词（权重降序） */
  words4: string[]
}
