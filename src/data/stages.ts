import type { LevelConfig, StageConfig } from '@/types'

function zigen(
  id: string,
  title: string,
  keys: string[],
  length: number,
  timeoutMs: number,
  speed: number,
  accuracy = 0.9,
): LevelConfig {
  return { id, type: 'zigen', title, pool: keys, length, timeoutMs, require: { speed, accuracy } }
}

/** 常用字根强化：按键位字根在一级常用字中的使用频率加权出题 */
function zigenRadicals(
  id: string,
  title: string,
  length: number,
  timeoutMs: number,
  speed: number,
  accuracy = 0.9,
): LevelConfig {
  return {
    id,
    type: 'zigen',
    title,
    pool: [],
    source: 'radicals',
    length,
    timeoutMs,
    require: { speed, accuracy },
  }
}

function danzi(
  id: string,
  title: string,
  source: LevelConfig['source'],
  starts: string[] | undefined,
  length: number,
  timeoutMs: number,
  speed: number,
  accuracy = 0.85,
  opt: Partial<LevelConfig> = {},
): LevelConfig {
  return {
    id,
    type: 'danzi',
    title,
    pool: [],
    source,
    starts,
    length,
    timeoutMs,
    require: { speed, accuracy },
    ...opt,
  }
}

/** 教学关：纯阅读，阅读完毕即视为达标 */
function intro(id: string, title: string, paragraphs: string[]): LevelConfig {
  return {
    id,
    type: 'intro',
    title,
    pool: [],
    intro: paragraphs,
    length: 0,
    timeoutMs: 0,
    require: { speed: 0, accuracy: 0 },
  }
}

function article(
  id: string,
  title: string,
  articleIds: string[],
  length: number,
  timeoutMs: number,
  speed: number,
  accuracy = 0.88,
): LevelConfig {
  return {
    id,
    type: 'article',
    title,
    pool: [],
    articleIds,
    length,
    timeoutMs,
    require: { speed, accuracy },
  }
}

const HENG = ['g', 'f', 'd', 's', 'a']
const SHU = ['h', 'j', 'k', 'l', 'm']
const PIE = ['t', 'r', 'e', 'w', 'q']
const NA = ['y', 'u', 'i', 'o', 'p']
const ZHE = ['n', 'b', 'v', 'c', 'x']
const ALL_KEYS = [...HENG, ...SHU, ...PIE, ...NA, ...ZHE]

/**
 * V2 关卡体系：6 阶段 / 37 小关。
 *
 * 训练量设计依据（单次练习约 3–6 分钟，达到有效肌肉记忆时长）：
 * - 字根关：单区 200 题（每键约 40 次）；全键位综合 300 题（每键约 12 次）
 * - 常用字根强化：300 题，按一级常用字中字根的使用频率加权，高频字根更多出现
 * - 简码关：100 题；口诀关按训练脚本分组出题（全文熟悉 → 逐句 drill 每字 10 遍 → 全文强化）
 * - 全码训练（s2-short1-full）：250 题（25 字 × 10 遍），每局随机字序，强制全码
 * - 常用字/识别码关：100–150 题
 * - 文章关：整篇连续输入（length 为字数参考，实际按篇目字数）
 * - 教学关（intro）：纯阅读，阅读完毕即达标
 *
 * 阶段内小关顺序自由；阶段内全部达标后解锁下一阶段。
 */
export const STAGES: StageConfig[] = [
  {
    id: 's1',
    title: '字根启蒙',
    description: '逐区认识 25 个键位与全部字根，再以全键位综合与常用字根强化收束',
    levels: [
      zigen('s1-zigen-heng', '横区字根 G F D S A', HENG, 200, 4000, 30),
      zigen('s1-zigen-shu', '竖区字根 H J K L M', SHU, 200, 4000, 30),
      zigen('s1-zigen-pie', '撇区字根 T R E W Q', PIE, 200, 4000, 30),
      zigen('s1-zigen-na', '捺区字根 Y U I O P', NA, 200, 4000, 30),
      zigen('s1-zigen-zhe', '折区字根 N B V C X', ZHE, 200, 4000, 30),
      zigen('s1-all-keys', '全键位综合', ALL_KEYS, 300, 3000, 50),
      zigenRadicals('s1-zigen-common', '常用字根强化训练', 300, 3000, 50),
    ],
  },
  {
    id: 's2',
    title: '简码入门',
    description: '认识简码与口诀，练熟一级简码全码与二级简码上屏',
    levels: [
      intro('s2-intro', '简码概念与口诀', [
        '五笔输入法中，为减少击键，给最常用的字规定了简码：',
        '一级简码——按 1 个键 + 空格即可上屏，共 25 个字，分别对应 25 个字母键。',
        '二级简码——按 2 个键 + 空格上屏，覆盖 600 多个常用字。',
        '一级简码口诀（按键盘五区排列，左为字、右为对应键位）：',
        '一 地 在 要 工　｜　G F D S A',
        '上 是 中 国 同　｜　H J K L M',
        '和 的 有 人 我　｜　T R E W Q',
        '主 产 不 为 这　｜　Y U I O P',
        '民 了 发 以 经　｜　N B V C X',
        '提示：词组输入时，每个字只取前 2 码。所以即便会用简码上屏，也要记住这些字的前 2 码——后面「一级简码·全码训练」会反复练习完整编码，为词组输入打好基础。',
      ]),
      danzi('s2-short1-a', '一级简码·口诀上半段', undefined, undefined, 190, 5000, 35, 0.85, {
        script: [
          '[口诀]',
          '一 地 在 要 工， 上 是 中 国 同。',
          '一 地 在 要 工， 上 是 中 国 同。',
          '',
          '一 地 在 要 工',
          '一 地 在 要 工',
          '[强化肌肉记忆，每个字至少记住前2码]',
          '一 一 一 一 一 一 一 一 一 一',
          '地 地 地 地 地 地 地 地 地 地',
          '在 在 在 在 在 在 在 在 在 在',
          '要 要 要 要 要 要 要 要 要 要',
          '工 工 工 工 工 工 工 工 工 工',
          '[口诀]',
          '上 是 中 国 同',
          '上 是 中 国 同',
          '[强化肌肉记忆，每个字至少记住前2码]',
          '上 上 上 上 上 上 上 上 上 上',
          '是 是 是 是 是 是 是 是 是 是',
          '中 中 中 中 中 中 中 中 中 中',
          '国 国 国 国 国 国 国 国 国 国',
          '同 同 同 同 同 同 同 同 同 同',
          '[口诀强化记忆]',
          '一 地 在 要 工， 上 是 中 国 同。',
          '一 地 在 要 工， 上 是 中 国 同。',
          '一 地 在 要 工， 上 是 中 国 同。',
          '一 地 在 要 工， 上 是 中 国 同。',
          '一 地 在 要 工， 上 是 中 国 同。',
        ],
        showShort1: true,
      }),
      danzi('s2-short1-b', '一级简码·口诀下半段', undefined, undefined, 285, 5000, 35, 0.85, {
        script: [
          '[口诀]',
          '和 的 有 人 我， 主 产 不 为 这， 民 了 发 以 经。',
          '和 的 有 人 我， 主 产 不 为 这， 民 了 发 以 经。',
          '',
          '和 的 有 人 我',
          '和 的 有 人 我',
          '[强化肌肉记忆，每个字至少记住前2码]',
          '和 和 和 和 和 和 和 和 和 和',
          '的 的 的 的 的 的 的 的 的 的',
          '有 有 有 有 有 有 有 有 有 有',
          '人 人 人 人 人 人 人 人 人 人',
          '我 我 我 我 我 我 我 我 我 我',
          '[口诀]',
          '主 产 不 为 这',
          '主 产 不 为 这',
          '[强化肌肉记忆，每个字至少记住前2码]',
          '主 主 主 主 主 主 主 主 主 主',
          '产 产 产 产 产 产 产 产 产 产',
          '不 不 不 不 不 不 不 不 不 不',
          '为 为 为 为 为 为 为 为 为 为',
          '这 这 这 这 这 这 这 这 这 这',
          '[口诀]',
          '民 了 发 以 经',
          '民 了 发 以 经',
          '[强化肌肉记忆，每个字至少记住前2码]',
          '民 民 民 民 民 民 民 民 民 民',
          '了 了 了 了 了 了 了 了 了 了',
          '发 发 发 发 发 发 发 发 发 发',
          '以 以 以 以 以 以 以 以 以 以',
          '经 经 经 经 经 经 经 经 经 经',
          '[口诀强化记忆]',
          '和 的 有 人 我， 主 产 不 为 这， 民 了 发 以 经。',
          '和 的 有 人 我， 主 产 不 为 这， 民 了 发 以 经。',
          '和 的 有 人 我， 主 产 不 为 这， 民 了 发 以 经。',
          '和 的 有 人 我， 主 产 不 为 这， 民 了 发 以 经。',
          '和 的 有 人 我， 主 产 不 为 这， 民 了 发 以 经。',
        ],
        showShort1: true,
      }),
      danzi('s2-short1-full', '一级简码·全码训练', 'short1', undefined, 250, 5000, 30, 0.9, {
        pattern: 'drill',
        drillRepeat: 10,
        drillShuffle: true,
        requireFull: true,
      }),
      danzi('s2-short1-mix', '一级简码混合', 'short1', undefined, 100, 5000, 40, 0.85, {
        showShort1: true,
      }),
      danzi('s2-short2-a', '二级简码·首码横竖区', 'short2', HENG.concat(SHU), 100, 6000, 40),
      danzi('s2-short2-b', '二级简码·首码撇捺折区', 'short2', [...PIE, ...NA, ...ZHE], 100, 6000, 40),
      danzi('s2-short2-mix', '二级简码·全键位混合', 'short2', undefined, 100, 5000, 45),
      danzi('s2-short-all', '一二级简码综合', undefined, undefined, 150, 5000, 50, 0.85, {
        showShort1: true,
        mix: [
          { source: 'short1', weight: 1 },
          { source: 'short2', weight: 3 },
        ],
      }),
    ],
  },
  {
    id: 's3',
    title: '常用字攻坚',
    description: '拆字与识别码专项，攻克全码输入',
    levels: [
      intro('s3-intro', '识别码原理', [
        '当一个字拆出的字根不足 4 个时，五笔需要补一个「末笔字型交叉识别码」，使编码唯一。',
        '识别码由字的「末笔画」与「字型」共同决定：',
        '字型：左右型（1）、上下型（2）、杂合型（3）。',
        '末笔：横（1）、竖（2）、撇（3）、捺（4）、折（5）。',
        '键位规律——末笔决定区，字型决定区内位置：',
        '横区 G F D ｜ 竖区 H J K ｜ 撇区 T R E ｜ 捺区 Y U I ｜ 折区 N B V（依次为左右、上下、杂合）',
        '例：「沐」= 氵 + 木（2 个字根）+ 末笔捺(4) + 左右型(1) → 识别码 Y → 全码 ISY。',
        '本阶段先练三字根全码字，再专攻双字根字的识别码，最后综合常用字。',
      ]),
      danzi('s3-full-3roots', '全码基础·三字根', 'freq1', undefined, 100, 6000, 40, 0.85, {
        rootCount: 3,
      }),
      danzi('s3-idcode-left-up', '识别码·左右/上下型', 'idcode', undefined, 150, 6000, 30, 0.85, {
        rootCount: 2,
        shape: [1, 2],
      }),
      danzi('s3-idcode-mix', '识别码·杂合型', 'idcode', undefined, 100, 6000, 30, 0.85, {
        rootCount: 2,
        shape: [3],
      }),
      danzi('s3-full-4roots', '全码基础·四字根', 'freq1', undefined, 100, 6000, 40, 0.85, {
        rootCount: 4,
      }),
      danzi('s3-freq1-a', '常用字·横竖区', 'freq1', HENG.concat(SHU), 100, 6000, 50),
      danzi('s3-freq1-b', '常用字·撇捺折区', 'freq1', [...PIE, ...NA, ...ZHE], 100, 6000, 50),
      danzi('s3-freq1-mix', '常用字·全码综合', 'freq1', undefined, 150, 5000, 50),
    ],
  },
  {
    id: 's4',
    title: '文章实战',
    description: '在诗文中连续输入，追求流畅',
    levels: [
      article('s4-poem-5', '五言诗合集（10 首）', ['tangshi-5'], 260, 8000, 60, 0.9),
      article('s4-poem-7', '七言诗合集（8 首）', ['tangshi-7'], 280, 8000, 60, 0.9),
      article('s4-ci', '宋词合集（3 首）', ['songci'], 230, 8000, 60, 0.88),
      article('s4-gu-wen', '古文合集（陋室铭 · 爱莲说）', ['guwen'], 205, 8000, 60, 0.88),
      article('s4-essay', '现代文合集（春 · 匆匆）', ['xiandai'], 300, 8000, 70, 0.85),
    ],
  },
  {
    id: 's5',
    title: '综合挑战',
    description: '限时与低容错的终极考验',
    levels: [
      zigen('s5-challenge-zigen', '字根极速', ALL_KEYS, 200, 2500, 60, 0.92),
      danzi('s5-challenge-short', '简码极速', 'short2', undefined, 200, 4000, 60, 0.92),
      danzi('s5-challenge-freq', '常用字长跑', 'freq1', undefined, 200, 5000, 60, 0.9),
      article('s5-challenge-article', '文章耐力·岳阳楼记全文', ['yueyanglou'], 360, 7000, 70, 0.9),
      danzi('s5-final', '毕业测试·常用字', 'freq1', undefined, 200, 4500, 60, 0.92),
    ],
  },
  {
    id: 's6',
    title: '终极挑战',
    description: '以政府公文长文冲击极限速度',
    levels: [
      article('s6-policy-500', '公文长跑·500 字', ['zfgzbg-2024'], 500, 8000, 90, 0.9),
      article('s6-policy-800', '公文长跑·800 字', ['zfgzbg-2025'], 800, 8000, 100, 0.9),
      article('s6-policy-1000', '公文长跑·1000 字', ['zfgzbg-2025-task'], 1000, 8000, 120, 0.9),
    ],
  },
]

/** 按 id 查询阶段 */
export function findStage(id: string): StageConfig | undefined {
  return STAGES.find((stage) => stage.id === id)
}

/** 按 id 查询关卡 */
export function findLevel(id: string): LevelConfig | undefined {
  for (const stage of STAGES) {
    const level = stage.levels.find((l) => l.id === id)
    if (level) return level
  }
  return undefined
}

/** 查询关卡所属阶段 */
export function stageOfLevel(levelId: string): StageConfig | undefined {
  return STAGES.find((stage) => stage.levels.some((l) => l.id === levelId))
}
