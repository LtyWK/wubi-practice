/** 单个提示单元：五笔为字根，双拼为声母 / 韵母 */
export interface HintItem {
  /** 显示文本，如 "女"、"声母 h" */
  text: string
  /** 对应键位，如 "v" */
  key: string
}

/** 输入方案抽象接口：练习引擎仅依赖此接口，不感知具体方案细节。 */
export interface InputScheme {
  readonly id: 'wubi86' | 'wubi98' | 'wubi06' | 'doublepy-ms' | 'doublepy-flypy'
  /** 目标字符的标准全码（判定基准） */
  code(char: string): string | null
  /** 目标字符的可用简码列表（用于空格上屏），无简码返回空数组 */
  shorts(char: string): string[]
  /** 拆解提示（渲染用） */
  hint(char: string): HintItem[]
}
