import type { LevelConfig } from '@/types'

/** 五区键位（横/竖/撇/捺/折） */
export const ZIGEN_AREAS: { id: string; title: string; keys: string[] }[] = [
  { id: 'heng', title: '横区字根（G F D S A）', keys: ['g', 'f', 'd', 's', 'a'] },
  { id: 'shu', title: '竖区字根（H J K L M）', keys: ['h', 'j', 'k', 'l', 'm'] },
  { id: 'pie', title: '撇区字根（T R E W Q）', keys: ['t', 'r', 'e', 'w', 'q'] },
  { id: 'na', title: '捺区字根（Y U I O P）', keys: ['y', 'u', 'i', 'o', 'p'] },
  { id: 'zhe', title: '折区字根（N B V C X）', keys: ['n', 'b', 'v', 'c', 'x'] },
]

/**
 * V1 关卡序列（共 15 关）：
 * 字根 5 关 → 一级简码 2 关 → 二级简码 4 关（按区）→ 常用字 4 关。
 */
export const LEVELS: LevelConfig[] = [
  ...ZIGEN_AREAS.map<LevelConfig>((area) => ({
    id: `zigen-${area.id}`,
    type: 'zigen',
    title: area.title,
    pool: area.keys,
    length: 20,
    require: { speed: 15, accuracy: 0.9 },
  })),

  {
    id: 'short1-a',
    type: 'danzi',
    title: '一级简码（一）',
    pool: [],
    source: 'short1',
    starts: ['g', 'f', 'd', 's', 'a', 'h', 'j', 'k', 'l', 'm'],
    length: 12,
    require: { speed: 20, accuracy: 0.85 },
  },
  {
    id: 'short1-b',
    type: 'danzi',
    title: '一级简码（二）',
    pool: [],
    source: 'short1',
    starts: ['t', 'r', 'e', 'w', 'q', 'y', 'u', 'i', 'o', 'p', 'n', 'b', 'v', 'c', 'x'],
    length: 12,
    require: { speed: 20, accuracy: 0.85 },
  },

  {
    id: 'short2-heng',
    type: 'danzi',
    title: '二级简码·横区',
    pool: [],
    source: 'short2',
    starts: ['g', 'f', 'd', 's', 'a'],
    length: 20,
    require: { speed: 25, accuracy: 0.85 },
  },
  {
    id: 'short2-shu',
    type: 'danzi',
    title: '二级简码·竖区',
    pool: [],
    source: 'short2',
    starts: ['h', 'j', 'k', 'l', 'm'],
    length: 20,
    require: { speed: 25, accuracy: 0.85 },
  },
  {
    id: 'short2-pie',
    type: 'danzi',
    title: '二级简码·撇区',
    pool: [],
    source: 'short2',
    starts: ['t', 'r', 'e', 'w', 'q'],
    length: 20,
    require: { speed: 25, accuracy: 0.85 },
  },
  {
    id: 'short2-na-zhe',
    type: 'danzi',
    title: '二级简码·捺折区',
    pool: [],
    source: 'short2',
    starts: ['y', 'u', 'i', 'o', 'p', 'n', 'b', 'v', 'c', 'x'],
    length: 20,
    require: { speed: 25, accuracy: 0.85 },
  },

  {
    id: 'freq1-heng',
    type: 'danzi',
    title: '常用字·横区',
    pool: [],
    source: 'freq1',
    starts: ['g', 'f', 'd', 's', 'a'],
    length: 20,
    require: { speed: 20, accuracy: 0.85 },
  },
  {
    id: 'freq1-shu',
    type: 'danzi',
    title: '常用字·竖区',
    pool: [],
    source: 'freq1',
    starts: ['h', 'j', 'k', 'l', 'm'],
    length: 20,
    require: { speed: 20, accuracy: 0.85 },
  },
  {
    id: 'freq1-pie',
    type: 'danzi',
    title: '常用字·撇区',
    pool: [],
    source: 'freq1',
    starts: ['t', 'r', 'e', 'w', 'q'],
    length: 20,
    require: { speed: 20, accuracy: 0.85 },
  },
  {
    id: 'freq1-na-zhe',
    type: 'danzi',
    title: '常用字·捺折区',
    pool: [],
    source: 'freq1',
    starts: ['y', 'u', 'i', 'o', 'p', 'n', 'b', 'v', 'c', 'x'],
    length: 20,
    require: { speed: 20, accuracy: 0.85 },
  },
]

/** 按 id 查询关卡 */
export function getLevel(id: string): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id)
}
