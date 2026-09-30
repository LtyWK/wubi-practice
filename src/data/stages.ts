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

function danzi(
  id: string,
  title: string,
  source: LevelConfig['source'],
  starts: string[] | undefined,
  length: number,
  timeoutMs: number,
  speed: number,
  accuracy = 0.85,
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
 * V2 关卡体系：6 阶段 / 28 小关。
 *
 * 训练量设计依据（单次练习 3–6 分钟，达到有效肌肉记忆时长）：
 * - 字根关：单区 200 题（每键约 40 次）；全键位综合 300 题（每键约 12 次）
 * - 简码 / 常用字关：200 题
 * - 文章关：整篇连续输入（length 为字数参考，实际按篇目字数）
 *
 * 阶段内小关顺序自由；阶段内全部达标后解锁下一阶段。
 */
export const STAGES: StageConfig[] = [
  {
    id: 's1',
    title: '字根启蒙',
    description: '逐区认识 25 个键位与全部字根，并以全键位综合收束',
    levels: [
      zigen('s1-zigen-heng', '横区字根 G F D S A', HENG, 200, 4000, 30),
      zigen('s1-zigen-shu', '竖区字根 H J K L M', SHU, 200, 4000, 30),
      zigen('s1-zigen-pie', '撇区字根 T R E W Q', PIE, 200, 4000, 30),
      zigen('s1-zigen-na', '捺区字根 Y U I O P', NA, 200, 4000, 30),
      zigen('s1-zigen-zhe', '折区字根 N B V C X', ZHE, 200, 4000, 30),
      zigen('s1-all-keys', '全键位综合', ALL_KEYS, 300, 3000, 50),
    ],
  },
  {
    id: 's2',
    title: '简码入门',
    description: '一级简码与二级简码上屏',
    levels: [
      danzi('s2-short1-a', '一级简码 G–M', 'short1', HENG.concat(SHU), 200, 5000, 40),
      danzi('s2-short1-b', '一级简码 T–X', 'short1', [...PIE, ...NA, ...ZHE], 200, 5000, 40),
      danzi('s2-short1-all', '一级简码混合', 'short1', undefined, 200, 5000, 50),
      danzi('s2-short2-mix', '二级简码入门', 'short2', undefined, 200, 5000, 50),
    ],
  },
  {
    id: 's3',
    title: '常用字攻坚',
    description: '二级简码分区精练与识别码专题',
    levels: [
      danzi('s3-short2-heng-shu', '二级简码·横竖区', 'short2', HENG.concat(SHU), 200, 6000, 50),
      danzi('s3-short2-pie-na-zhe', '二级简码·撇捺折区', 'short2', [...PIE, ...NA, ...ZHE], 200, 6000, 50),
      danzi('s3-freq1-a', '常用字·横竖区', 'freq1', HENG.concat(SHU), 200, 6000, 50),
      danzi('s3-freq1-b', '常用字·撇捺折区', 'freq1', [...PIE, ...NA, ...ZHE], 200, 6000, 50),
      danzi('s3-freq1-idcode', '识别码专题', 'idcode', undefined, 200, 6000, 50, 0.8),
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
