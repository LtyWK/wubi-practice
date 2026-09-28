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

/**
 * V2 关卡体系：6 阶段 / 27 小关。
 * 阶段内小关顺序自由；阶段内全部达标后解锁下一阶段。
 */
export const STAGES: StageConfig[] = [
  {
    id: 's1',
    title: '字根启蒙',
    description: '逐区认识 25 个键位与键名字根',
    levels: [
      zigen('s1-zigen-heng', '横区字根 G F D S A', HENG, 20, 4000, 15),
      zigen('s1-zigen-shu', '竖区字根 H J K L M', SHU, 20, 4000, 15),
      zigen('s1-zigen-pie', '撇区字根 T R E W Q', PIE, 20, 4000, 15),
      zigen('s1-zigen-na', '捺区字根 Y U I O P', NA, 20, 4000, 15),
      zigen('s1-zigen-zhe', '折区字根 N B V C X', ZHE, 20, 4000, 15),
    ],
  },
  {
    id: 's2',
    title: '键位强化',
    description: '跨区混合，加快找键速度',
    levels: [
      zigen('s2-mix-heng-shu', '横竖区混合', [...HENG, ...SHU], 25, 3000, 20),
      zigen('s2-mix-pie-na', '撇捺区混合', [...PIE, ...NA], 25, 3000, 20),
      zigen('s2-all-keys', '全键位综合', [...HENG, ...SHU, ...PIE, ...NA, ...ZHE], 30, 3000, 22),
    ],
  },
  {
    id: 's3',
    title: '简码入门',
    description: '一级简码与二级简码上屏',
    levels: [
      danzi('s3-short1-a', '一级简码 G–M', 'short1', HENG.concat(SHU), 12, 5000, 20),
      danzi('s3-short1-b', '一级简码 T–X', 'short1', [...PIE, ...NA, ...ZHE], 13, 5000, 20),
      danzi('s3-short1-all', '一级简码混合', 'short1', undefined, 20, 5000, 22),
      danzi('s3-short2-mix', '二级简码入门', 'short2', undefined, 20, 5000, 22),
    ],
  },
  {
    id: 's4',
    title: '常用字攻坚',
    description: '二级简码分区精练与识别码专题',
    levels: [
      danzi('s4-short2-heng-shu', '二级简码·横竖区', 'short2', HENG.concat(SHU), 20, 6000, 25),
      danzi('s4-short2-pie-na-zhe', '二级简码·撇捺折区', 'short2', [...PIE, ...NA, ...ZHE], 20, 6000, 25),
      danzi('s4-freq1-a', '常用字·横竖区', 'freq1', HENG.concat(SHU), 20, 6000, 20),
      danzi('s4-freq1-b', '常用字·撇捺折区', 'freq1', [...PIE, ...NA, ...ZHE], 20, 6000, 20),
      danzi('s4-freq1-idcode', '识别码专题', 'idcode', undefined, 20, 6000, 18, 0.8),
    ],
  },
  {
    id: 's5',
    title: '文章实战',
    description: '在诗文中连续输入，追求流畅',
    levels: [
      article('s5-poem-5', '五言绝句', ['jingyesi', 'dengguanquelou'], 40, 8000, 30, 0.9),
      article('s5-poem-7', '七言绝句', ['zaofabaidicheng', 'shanxing'], 56, 8000, 32, 0.9),
      article('s5-ci', '宋词一首', ['shuidiaogetou'], 110, 8000, 32, 0.88),
      article('s5-gu-wen', '古文短篇', ['loushiming', 'ailianshuo'], 160, 8000, 30, 0.88),
      article('s5-essay', '现代散文节选', ['chun'], 200, 8000, 35, 0.85),
    ],
  },
  {
    id: 's6',
    title: '综合挑战',
    description: '限时与低容错的终极考验',
    levels: [
      zigen('s6-challenge-zigen', '字根极速', [...HENG, ...SHU, ...PIE, ...NA, ...ZHE], 40, 2500, 30, 0.92),
      danzi('s6-challenge-short', '简码极速', 'short2', undefined, 30, 4000, 30, 0.92),
      danzi('s6-challenge-freq', '常用字长跑', 'freq1', undefined, 40, 5000, 28, 0.9),
      article('s6-challenge-article', '文章耐力', ['yueyanglou'], 250, 7000, 35, 0.9),
      danzi('s6-final', '毕业测试·常用字', 'freq1', undefined, 40, 4500, 30, 0.92),
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
