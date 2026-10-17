import type { LevelConfig, StageConfig, TypingConfig } from '@/types'

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

/** 跟打器关卡的总量（展示用）：climb 取切片跨度，gauntlet 累加各段，其余按目标/预生成量 */
function typingLength(cfg: TypingConfig): number {
  if (cfg.mode === 'climb') {
    // words3 / words4 不传 range，全量各 200；common3500 与 words2 按切片跨度
    return cfg.range ? cfg.range[1] - cfg.range[0] : 200
  }
  if (cfg.mode === 'gauntlet') {
    return (cfg.segments ?? []).reduce((sum, seg) => {
      const span = seg.range ? seg.range[1] - seg.range[0] : 0
      return sum + (seg.count ?? span)
    }, 0)
  }
  return cfg.charTarget ?? cfg.poolSize ?? 0
}

/**
 * 跟打器关卡：只判定提交的汉字，不显示编码/简码/键位提示。
 * require 仅作地图展示的参考值，实际判定按 typing 配置执行。
 */
function typing(
  id: string,
  title: string,
  cfg: TypingConfig,
  requireSpeed: number,
  requireAccuracy: number,
): LevelConfig {
  return {
    id,
    type: 'typing',
    title,
    pool: [],
    length: typingLength(cfg),
    timeoutMs: 0,
    typing: cfg,
    require: { speed: requireSpeed, accuracy: requireAccuracy },
  }
}

const HENG = ['g', 'f', 'd', 's', 'a']
const SHU = ['h', 'j', 'k', 'l', 'm']
const PIE = ['t', 'r', 'e', 'w', 'q']
const NA = ['y', 'u', 'i', 'o', 'p']
const ZHE = ['n', 'b', 'v', 'c', 'x']
const ALL_KEYS = [...HENG, ...SHU, ...PIE, ...NA, ...ZHE]

/**
 * V3 关卡体系：6 阶段 / 39 小关。
 *
 * 训练量设计依据（单次练习约 3–6 分钟，达到有效肌肉记忆时长）：
 * - 字根关：单区 200 题（每键约 40 次）；全键位综合 300 题（每键约 12 次）
 * - 常用字根强化：300 题，按一级常用字中字根的使用频率加权，高频字根更多出现
 * - 简码关：100 题；口诀关按训练脚本分组出题（全文熟悉 → 逐句 drill 每字 10 遍 → 全文强化）
 * - 全码训练（s2-short1-full）：250 题 = 每字连打 5 遍（前 125）+ 均匀随机（后 125），每局随机字序，强制全码
 * - 二级简码五区关：题量 = 池大小（各取 86/98 较大值），一轮即可覆盖整个池
 * - S2 通关速度门槛整体控制在 20–30 字/分（新手友好，随关卡推进递增）
 * - S3 识别码关：全码基础各 100 题；识别码分型按 86/98 池较大值定题量（250/210/170），随机取样即可
 * - S4/S5 爬坡关：10 字（词）一组、组达标 60 字/分，逐组推进并保存进度
 * - S6 挑战关：限时冲刺 / 逐段提速 / 耐力 / 无尽 / 公文 / 混合段落
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
      danzi('s2-short1-a', '一级简码·口诀上半段', undefined, undefined, 190, 5000, 25, 0.85, {
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
      danzi('s2-short1-b', '一级简码·口诀下半段', undefined, undefined, 285, 5000, 25, 0.85, {
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
      danzi('s2-short1-full', '一级简码·全码训练', 'short1', undefined, 250, 5000, 20, 0.9, {
        // 前 125 题：每字连打 5 遍（每字一行）；后 125 题：25 字均匀随机
        pattern: 'drill',
        drillRepeat: 5,
        drillShuffle: true,
        requireFull: true,
      }),
      danzi('s2-short1-mix', '一级简码混合', 'short1', undefined, 200, 5000, 30, 0.85, {
        showShort1: true,
      }),
      // 二级简码·五区：题量 = 两方案池较大值，一轮即可覆盖全区
      danzi('s2-short2-heng', '二级简码·横区（G F D S A）', 'short2', HENG, 125, 6000, 25, 0.85, {
        showShorts: true,
      }),
      danzi('s2-short2-shu', '二级简码·竖区（H J K L M）', 'short2', SHU, 122, 6000, 25, 0.85, {
        showShorts: true,
      }),
      danzi('s2-short2-pie', '二级简码·撇区（T R E W Q）', 'short2', PIE, 125, 6000, 25, 0.85, {
        showShorts: true,
      }),
      danzi('s2-short2-na', '二级简码·捺区（Y U I O P）', 'short2', NA, 124, 6000, 25, 0.85, {
        showShorts: true,
      }),
      danzi('s2-short2-zhe', '二级简码·折区（N B V C X）', 'short2', ZHE, 118, 6000, 25, 0.85, {
        showShorts: true,
      }),
    ],
  },
  {
    id: 's3',
    title: '识别码专题',
    description: '全码基础与末笔识别码专项训练',
    levels: [
      intro('s3-intro', '识别码原理', [
        '当一个字拆出的字根不足 4 个时，五笔需要补一个「末笔字型交叉识别码」，使编码唯一。',
        '识别码由字的「末笔画」与「字型」共同决定：',
        '字型：左右型（1）、上下型（2）、杂合型（3）。',
        '字型判别：左右型可左右分开，如「亿」（亻 + 乙）；上下型可上下分开，如「字」（宀 + 子）；杂合型为整体或内外结构，如「丙」。',
        '末笔：横（1）、竖（2）、撇（3）、捺（4）、折（5）。',
        '键位规律——末笔决定区，字型决定区内位置：',
        '横区 G F D ｜ 竖区 H J K ｜ 撇区 T R E ｜ 捺区 Y U I ｜ 折区 N B V（依次为左右、上下、杂合）',
        '例：「沐」= 氵 + 木（2 个字根）+ 末笔捺(4) + 左右型(1) → 识别码 Y → 全码 ISY。',
        '本阶段先练三字根、四字根全码字，再按左右、上下、杂合三种字型专攻识别码，最后综合训练。',
      ]),
      danzi('s3-full-3roots', '全码基础·三字根', 'freq1', undefined, 100, 6000, 40, 0.85, {
        rootCount: 3,
      }),
      danzi('s3-full-4roots', '全码基础·四字根', 'freq1', undefined, 100, 6000, 40, 0.85, {
        rootCount: 4,
      }),
      // 识别码分型：题量按 86/98 两方案池较大值设定，随机取样即可
      danzi('s3-idcode-1', '识别码·左右型', 'idcode', undefined, 250, 6000, 30, 0.85, {
        rootCount: 2,
        shape: [1],
      }),
      danzi('s3-idcode-2', '识别码·上下型', 'idcode', undefined, 210, 6000, 30, 0.85, {
        rootCount: 2,
        shape: [2],
      }),
      danzi('s3-idcode-3', '识别码·杂合型', 'idcode', undefined, 170, 6000, 30, 0.85, {
        rootCount: 2,
        shape: [3],
      }),
      danzi('s3-idcode-mix', '识别码·综合', 'idcode', undefined, 200, 6000, 35, 0.85, {
        rootCount: 2,
      }),
    ],
  },
  {
    id: 's4',
    title: '常用字爬坡',
    description: '3500 常用字，十连一组，每组 60 字/分过关',
    levels: [
      typing(
        's4-common-1',
        '最常用 700 字',
        { mode: 'climb', source: 'common3500', range: [0, 700], groupSize: 10, groupSpeed: 50 },
        60,
        0,
      ),
      typing(
        's4-common-2',
        '常用 700 字·二',
        { mode: 'climb', source: 'common3500', range: [700, 1400], groupSize: 10, groupSpeed: 50 },
        60,
        0,
      ),
      typing(
        's4-common-3',
        '常用 700 字·三',
        {
          mode: 'climb',
          source: 'common3500',
          range: [1400, 2100],
          groupSize: 10,
          groupSpeed: 50,
        },
        60,
        0,
      ),
      typing(
        's4-common-4',
        '常用 700 字·四',
        {
          mode: 'climb',
          source: 'common3500',
          range: [2100, 2800],
          groupSize: 10,
          groupSpeed: 50,
        },
        60,
        0,
      ),
      typing(
        's4-common-5',
        '常用 700 字·五',
        {
          mode: 'climb',
          source: 'common3500',
          range: [2800, 3500],
          groupSize: 10,
          groupSpeed: 50,
        },
        60,
        0,
      ),
    ],
  },
  {
    id: 's5',
    title: '词组爬坡',
    description: '常用词组十连一组，速度与手感双修',
    levels: [
      typing(
        's5-words2-a',
        '常用二字词·上',
        { mode: 'climb', source: 'words2', range: [0, 500], groupSize: 10, groupSpeed: 50 },
        60,
        0,
      ),
      typing(
        's5-words2-b',
        '常用二字词·下',
        { mode: 'climb', source: 'words2', range: [500, 1000], groupSize: 10, groupSpeed: 50 },
        60,
        0,
      ),
      typing(
        's5-words3',
        '常用三字词',
        { mode: 'climb', source: 'words3', groupSize: 10, groupSpeed: 50 },
        60,
        0,
      ),
      typing(
        's5-words4',
        '常用四字词',
        { mode: 'climb', source: 'words4', groupSize: 10, groupSpeed: 50 },
        60,
        0,
      ),
    ],
  },
  {
    id: 's6',
    title: '挑战关卡',
    description: '限时冲刺 · 逐段提速 · 耐力 · 无尽 · 终极公文 · 毕业综合',
    levels: [
      typing(
        's6-sprint-poem',
        '诗词限时冲刺',
        {
          mode: 'sprint',
          source: 'article',
          articleIds: ['tangshi-5', 'tangshi-7'],
          durationSec: 180,
          charTarget: 180,
          poolSize: 2000,
        },
        60,
        0.9,
      ),
      typing(
        's6-speedup-classic',
        '古韵逐段提速',
        {
          mode: 'speedup',
          source: 'article',
          articleIds: ['songci', 'guwen', 'yueyanglou'],
          speedup: [50, 60, 70],
        },
        60,
        0.9,
      ),
      typing(
        's6-marathon-essay',
        '现代文耐力长跑',
        { mode: 'marathon', source: 'article', articleIds: ['xiandai'] },
        70,
        0.95,
      ),
      typing(
        's6-endless',
        '无尽词流',
        {
          mode: 'endless',
          source: 'words-mix',
          poolSize: 3000,
          charTarget: 500,
          errorLimit: 10,
        },
        0,
        0,
      ),
      typing(
        's6-final-policy',
        '公文终极挑战',
        { mode: 'marathon', source: 'article', articleIds: ['zfgzbg-2025-task'] },
        100,
        0.98,
      ),
      typing(
        's6-gauntlet',
        '毕业综合测试',
        {
          mode: 'gauntlet',
          source: 'common3500',
          segments: [
            { source: 'common3500', range: [0, 100], speed: 60 },
            { source: 'words2', range: [0, 50], speed: 60 },
            { source: 'article', articleIds: ['tangshi-5'], count: 100, speed: 60 },
          ],
        },
        60,
        0.9,
      ),
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
