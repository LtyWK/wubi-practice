/**
 * 字根表与键盘布局构建脚本（严格采用人工配置，不做字根推理）。
 *
 * 用法：tsx scripts/build-zigen.ts [wubi86|wubi98]（默认 wubi86）
 *
 * 输入（scripts/sources/）：
 *   - zigen-{scheme}.json    人工配置：names / short1 / roots
 *   - layout-{scheme}.json   人工配置：每键 size + cells（位置/加粗/标记）
 *   - zigen.json             86 版 25 键口诀源
 *   - data-wubi-v86.tsv / data-wubi-v98.tsv  拆解数据（统计常用字根权重）
 *   - data-chars.tsv         一级常用字
 *
 * 输出（src/data/generated/{scheme}/）：
 *   - zigen.json             每键：key/name/short1/area/mnemonic/roots/layout
 *   - radical-weights.json   一级常用字中的字根使用频率（常用字根强化训练）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Scheme = 'wubi86' | 'wubi98'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = resolve(ROOT, 'scripts/sources')
const OUT_ROOT = resolve(ROOT, 'src/data/generated')

/** 键位顺序（横竖撇捺折） */
const KEY_ORDER = 'gfdsahjklmtrewqyuiopnbvcx'.split('')

/** 五区归属：1 横 2 竖 3 撇 4 捺 5 折 */
const AREA: Record<string, number> = {
  g: 1, f: 1, d: 1, s: 1, a: 1,
  h: 2, j: 2, k: 2, l: 2, m: 2,
  t: 3, r: 3, e: 3, w: 3, q: 3,
  y: 4, u: 4, i: 4, o: 4, p: 4,
  n: 5, b: 5, v: 5, c: 5, x: 5,
}

/** 98 王码 25 键口诀（wb98 整理） */
const MNEMONIC_98: Record<string, string> = {
  g: '王旁青头五夫一',
  f: '土干十寸未甘雨',
  d: '大犬戊其古石厂',
  s: '木丁西甫一四里',
  a: '工戈草头右框七',
  h: '目上卜止虎头具',
  j: '日早两竖与虫依',
  k: '口中两川三个竖',
  l: '田甲方框四车里',
  m: '山由贝骨下框集',
  t: '禾竹反文双人立',
  r: '白斤气丘叉手提',
  e: '月用力豸毛衣白',
  w: '人八登头单人几',
  q: '金夕鸟儿犭边鱼',
  y: '言文方点谁人去',
  u: '立辛六羊病门里',
  i: '水族三点鳖头小',
  o: '火业广鹿四点米',
  p: '之字宝盖补礻衤',
  n: '已类左框心尸羽',
  b: '子耳了也乃框皮',
  v: '女刀九艮山西倒',
  c: '又巴牛厶马失蹄',
  x: '幺母贯头弓和匕',
}

/** 98 识别码 PUA（统计常用字根权重时排除） */
const IDENT_98 = new Set([
  'F0005', 'F000C', 'F000F', 'F0018', 'F001D', 'F0022',
  'F0026', 'F002C', 'F0035', 'F0040', 'F0063', 'F0065',
  'F0067', 'F006B', 'F0076',
])

/** 86 识别码 PUA */
const IDENT_86 = new Set([
  'E000', 'E015', 'E02D', 'E06A', 'E080', 'E097',
  'E0CD', 'E0DF', 'E0F4', 'E13D', 'E155', 'E171',
  'E1AD', 'E1DF', 'E1FA',
])

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

interface ZigenConfig {
  names: Record<string, string>
  short1: Record<string, string>
  roots: Record<string, string[]>
}

interface LayoutCell {
  cp: string
  bold?: boolean
  mark?: 'red' | 'green' | null
}

interface LayoutConfig {
  layouts: Record<string, { size: 4 | 5; cells: (LayoutCell | null)[] }>
}

/** 86 口诀源（scripts/sources/zigen.json） */
function mnemonic86(): Record<string, string> {
  const list = readJson<{ key: string; mnemonic: string }[]>(resolve(SOURCES, 'zigen.json'))
  const out: Record<string, string> = {}
  for (const item of list) out[item.key] = item.mnemonic
  return out
}

/** 解析一级（3500）常用字 */
function parseLevel1(): Set<string> {
  const lines = readFileSync(resolve(SOURCES, 'data-chars.tsv'), 'utf8').split(/\r?\n/)
  const result = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    if (cols.length < 6) continue
    if (cols[5] === '一级' && cols[1]?.length === 1) result.add(cols[1])
  }
  return result
}

/** 拆解数据 → 字 → PUA 序列（86/98 两种格式） */
function parseDecomposition(scheme: Scheme): Map<string, string[]> {
  const result = new Map<string, string[]>()
  if (scheme === 'wubi86') {
    const lines = readFileSync(resolve(SOURCES, 'data-wubi-v86.tsv'), 'utf8').split(/\r?\n/)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t')
      if (cols.length < 8) continue
      const ch = cols[0]
      if (ch.length !== 1) continue
      const puas: string[] = []
      for (const c of cols[7] || '') {
        const v = c.codePointAt(0) ?? 0
        if (v >= 0xe000 && v <= 0xf8ff) puas.push(v.toString(16).toUpperCase())
      }
      if (puas.length) result.set(ch, puas)
    }
  } else {
    for (const line of readFileSync(resolve(SOURCES, 'data-wubi-v98.tsv'), 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue
      const cols = line.split('\t')
      if (cols.length < 2) continue
      const ch = cols[0]
      if (ch.length !== 1) continue
      let inner = cols[1]
      if (inner.includes('〔')) inner = inner.slice(inner.indexOf('〔') + 1)
      if (inner.includes('〕')) inner = inner.slice(0, inner.indexOf('〕'))
      const rootPart = inner.split('\u262f')[0] // ☯ 前为字根序列
      const puas: string[] = []
      for (const c of rootPart) {
        const v = c.codePointAt(0) ?? 0
        if (v >= 0xf0000 && v <= 0x10fffd) puas.push(v.toString(16).toUpperCase())
      }
      if (puas.length) result.set(ch, puas)
    }
  }
  return result
}

interface ZigenItem {
  key: string
  name: string
  short1: string
  area: number
  mnemonic: string
  roots: string[]
  layout: { size: number; cells: (LayoutCell | null)[] }
}

interface RadicalWeight {
  root: string
  key: string
  count: number
}

function build(scheme: Scheme): void {
  const zigen = readJson<ZigenConfig>(resolve(SOURCES, `zigen-${scheme.slice(-2)}.json`))
  const layout = readJson<LayoutConfig>(resolve(SOURCES, `layout-${scheme.slice(-2)}.json`))
  const mnemonic = scheme === 'wubi86' ? mnemonic86() : MNEMONIC_98

  // 字根 PUA → 键位（用于常用字根权重）
  const rootKey = new Map<string, string>()
  for (const key of KEY_ORDER) {
    for (const ch of zigen.roots[key] ?? []) rootKey.set(ch, key)
  }

  const items: ZigenItem[] = KEY_ORDER.map((key) => {
    const lo = layout.layouts[key] ?? { size: 5, cells: [] }
    return {
      key,
      name: zigen.names[key] ?? '',
      short1: zigen.short1[key] ?? '',
      area: AREA[key],
      mnemonic: mnemonic[key] ?? '',
      roots: zigen.roots[key] ?? [],
      layout: { size: lo.size, cells: lo.cells },
    }
  })

  // 常用字根权重：一级常用字拆解中的字根使用频率（仅统计配置中的字根，排除识别码）
  const level1 = parseLevel1()
  const decomp = parseDecomposition(scheme)
  const ident = scheme === 'wubi86' ? IDENT_86 : IDENT_98
  const counts = new Map<string, number>()
  for (const [ch, puas] of decomp) {
    if (!level1.has(ch)) continue
    for (const pua of puas) {
      if (ident.has(pua)) continue
      const root = String.fromCodePoint(parseInt(pua, 16))
      if (!rootKey.has(root)) continue
      counts.set(root, (counts.get(root) ?? 0) + 1)
    }
  }
  const weights: RadicalWeight[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([root, count]) => ({ root, key: rootKey.get(root) as string, count }))

  const outDir = resolve(OUT_ROOT, scheme)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'zigen.json'), JSON.stringify(items), 'utf8')
  writeFileSync(resolve(outDir, 'radical-weights.json'), JSON.stringify(weights), 'utf8')

  const totalRoots = items.reduce((n, it) => n + it.roots.length, 0)
  console.log(`[build-zigen:${scheme}] 25 键，字根 ${totalRoots}，常用字根权重 ${weights.length}`)
}

function main(): void {
  const arg = (process.argv[2] || 'wubi86') as Scheme
  if (arg !== 'wubi86' && arg !== 'wubi98') {
    console.error(`未知方案：${arg}（可选 wubi86 / wubi98）`)
    process.exit(1)
  }
  build(arg)
}

main()
