/**
 * 码表构建脚本：将原始数据源转换为前端使用的 chars.json。
 *
 * 输入（scripts/sources/）：
 *   - wubi86.dict.yaml      RIME 五笔 86 码表（唯一编码事实源）
 *   - data-wubi-v86.tsv     字根拆解序列（PUA 码点）
 *   - data-chars.tsv        汉字分级（用于标记一级 3500 字）
 *   - roots-map.json        PUA → 字根文本映射
 *
 * 输出（src/data/generated/）：
 *   - chars.json            全量单字码表
 *   - chars.freq1.json      一级（通用规范一级 3500）常用字
 *   - radical-weights.json  一级常用字的字根使用频率（常用字根强化训练用）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface CharEntry {
  code: string
  short: string[]
  radicals: [string, string][]
  freq: 0 | 1
  idcode: boolean
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = resolve(ROOT, 'scripts/sources')
const OUT_DIR = resolve(ROOT, 'src/data/generated')

/** 25 键键名字根，用于未识别 PUA 的兜底显示 */
const KEY_ROOT: Record<string, string> = {
  g: '王', f: '土', d: '大', s: '木', a: '工',
  h: '目', j: '日', k: '口', l: '田', m: '山',
  t: '禾', r: '白', e: '月', w: '人', q: '金',
  y: '言', u: '立', i: '水', o: '火', p: '之',
  n: '已', b: '子', v: '女', c: '又', x: '纟',
}

/** 识别码 PUA（字体渲染为带圈字形），统计常用字根时须排除 */
const IDENT_PUA = new Set([
  'E000', 'E015', 'E02D', 'E06A', 'E080', 'E097',
  'E0CD', 'E0DF', 'E0F4', 'E13D', 'E155', 'E171',
  'E1AD', 'E1DF', 'E1FA',
])

const CJK = /[\u4e00-\u9fff]/
const CODE = /^[a-z]{1,4}$/

/** 解析 RIME 码表，返回 字 → (编码 → 权重) */
function parseDict(): Map<string, Map<string, number>> {
  const text = readFileSync(resolve(SOURCES, 'wubi86.dict.yaml'), 'utf8')
  const lines = text.split(/\r?\n/)
  const result = new Map<string, Map<string, number>>()
  let inBody = false
  for (const line of lines) {
    if (!inBody) {
      if (line.trim() === '...') inBody = true
      continue
    }
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    if (cols.length < 2) continue
    const ch = cols[0]
    const code = cols[1]
    if (ch.length !== 1 || !CJK.test(ch) || !CODE.test(code)) continue
    const weight = Number(cols[2]) || 0
    let codes = result.get(ch)
    if (!codes) {
      codes = new Map()
      result.set(ch, codes)
    }
    const prev = codes.get(code)
    if (prev === undefined || weight > prev) codes.set(code, weight)
  }
  return result
}

interface DataRow {
  code: string
  puas: string[]
  /** 是否含识别码（flag 列非空） */
  idcode: boolean
}

/** 解析 search-wubi 拆解数据，返回 字 → { 全码, PUA 序列 } */
function parseData(): Map<string, DataRow> {
  const text = readFileSync(resolve(SOURCES, 'data-wubi-v86.tsv'), 'utf8')
  const lines = text.split(/\r?\n/)
  const result = new Map<string, DataRow>()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    if (cols.length < 8) continue
    const ch = cols[0]
    if (ch.length !== 1 || !CJK.test(ch)) continue
    const code = (cols[1] || '').replace(/[^a-z]/g, '')
    if (!code) continue
    const puas: string[] = []
    for (const c of cols[7] || '') {
      const v = c.codePointAt(0) ?? 0
      if (v >= 0xe000 && v <= 0xf8ff) puas.push(v.toString(16).toUpperCase())
    }
    const idcode = (cols[8] || '').trim().length > 0
    result.set(ch, { code, puas, idcode })
  }
  return result
}

/** 解析汉字分级，返回一级（3500 常用）字集合 */
function parseLevel1(): Set<string> {
  const text = readFileSync(resolve(SOURCES, 'data-chars.tsv'), 'utf8')
  const lines = text.split(/\r?\n/)
  const result = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    if (cols.length < 6) continue
    const ch = cols[1]
    const level = cols[5]
    if (level === '一级' && ch.length === 1) result.add(ch)
  }
  return result
}

/** 载入 PUA → 字根文本映射 */
function parseRootsMap(): Map<string, string> {
  const raw = readFileSync(resolve(SOURCES, 'roots-map.json'), 'utf8')
  const obj = JSON.parse(raw) as Record<string, string>
  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith('_')) map.set(k, v)
  }
  return map
}

/** 选择全码：优先字典中最长编码（4 码优先），否则用拆解数据的全码 */
function pickCode(codes: Map<string, number> | undefined, fallback: string): string {
  if (codes) {
    let best = ''
    for (const c of codes.keys()) {
      if (c.length > best.length) best = c
    }
    if (best) return best
  }
  return fallback
}

/** 字根表元数据（键名/口诀/分区/注释，scripts/sources/zigen.json） */
interface ZigenMeta {
  key: string
  name: string
  area: string
  mnemonic: string
  notes?: { root: string; note: string }[]
}

/** 键位字形配置（scripts/sources/zigen-glyphs.json） */
interface ZigenGlyphEntry {
  name: string
  short1: string
  glyphs: string[]
  all: string[]
}

function main(): void {
  const dict = parseDict()
  const data = parseData()
  const level1 = parseLevel1()
  const rootsMap = parseRootsMap()

  // 统计 PUA → 键位分布（多数投票确定主键位），用于一致性校验
  const puaKeyFreq = new Map<string, Map<string, number>>()

  const all = new Set<string>([...dict.keys(), ...data.keys()])
  const entries: Record<string, CharEntry> = {}
  const freq1: Record<string, CharEntry> = {}
  const unmapped = new Set<string>()
  // 一级常用字中各字根的使用频率（按 键位+字根文本 聚合，root 为该根的代表字形）
  const radicalFreq = new Map<string, { root: string; key: string; count: number }>()

  for (const ch of all) {
    const d = data.get(ch)
    const codes = dict.get(ch)
    const code = pickCode(codes, d?.code ?? '')
    if (!code) continue

    const short: string[] = []
    if (codes) {
      for (const c of codes.keys()) {
        if (c.length < code.length) short.push(c)
      }
      short.sort((a, b) => a.length - b.length || a.localeCompare(b))
    }

    const radicals: [string, string][] = []
    /** 与 radicals 一一对应的 PUA 字形（用于常用字根权重数据的代表字形） */
    const radicalGlyphs: string[] = []
    if (d) {
      const n = Math.min(d.puas.length, code.length)
      for (let i = 0; i < n; i++) {
        const key = code[i]
        const pua = d.puas[i]
        const known = rootsMap.get(pua)
        if (!known) unmapped.add(pua)
        const root = known ?? KEY_ROOT[key] ?? key
        radicals.push([root, key])
        radicalGlyphs.push(String.fromCodePoint(parseInt(pua, 16)))
        let keys = puaKeyFreq.get(pua)
        if (!keys) {
          keys = new Map()
          puaKeyFreq.set(pua, keys)
        }
        keys.set(key, (keys.get(key) ?? 0) + 1)
      }
    }

    const isFreq1 = level1.has(ch)
    // 统计一级常用字使用的字根：同键位同字根文本归并计数（排除识别码，其字形为带圈符号）
    if (isFreq1) {
      for (let i = 0; i < radicals.length; i++) {
        if (d && IDENT_PUA.has(d.puas[i])) continue
        const [text, key] = radicals[i]
        const id = `${key}:${text}`
        const cur = radicalFreq.get(id)
        if (cur) cur.count += 1
        else radicalFreq.set(id, { root: radicalGlyphs[i], key, count: 1 })
      }
    }
    const entry: CharEntry = {
      code,
      short,
      radicals,
      freq: isFreq1 ? 1 : 0,
      idcode: d?.idcode ?? false,
    }
    entries[ch] = entry
    if (isFreq1) freq1[ch] = entry
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'chars.json'), JSON.stringify(entries), 'utf8')
  writeFileSync(resolve(OUT_DIR, 'chars.freq1.json'), JSON.stringify(freq1), 'utf8')
  // 常用字根权重：一级常用字中各字根出现次数（降序），驱动「常用字根强化训练」
  const radicalWeights = [...radicalFreq.values()].sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key),
  )
  writeFileSync(resolve(OUT_DIR, 'radical-weights.json'), JSON.stringify(radicalWeights), 'utf8')
  // 字根表：口诀/注释（zigen.json）+ 字形（zigen-glyphs.json）合并输出
  const zigenMeta = JSON.parse(
    readFileSync(resolve(SOURCES, 'zigen.json'), 'utf8'),
  ) as ZigenMeta[]
  const zigenGlyphs = JSON.parse(
    readFileSync(resolve(SOURCES, 'zigen-glyphs.json'), 'utf8'),
  ) as Record<string, ZigenGlyphEntry>
  const zigenOut = zigenMeta.map((meta) => {
    const glyphs = zigenGlyphs[meta.key] ?? {
      name: meta.name,
      short1: '',
      glyphs: [],
      all: [],
    }
    return {
      key: meta.key,
      ...glyphs,
      area: meta.area,
      mnemonic: meta.mnemonic,
      notes: meta.notes,
    }
  })
  writeFileSync(resolve(OUT_DIR, 'zigen.json'), JSON.stringify(zigenOut), 'utf8')

  // 一致性校验：拆解数据中每个非识别码 PUA 的主键位，其字形应出现在该键的 all 中
  // 人工排除的字根 PUA（scripts/sources/zigen-exclude.json），不参与一致性校验
  const excludePath = resolve(SOURCES, 'zigen-exclude.json')
  const EXCLUDE_PUA = new Set<string>(
    existsSync(excludePath)
      ? (
          (JSON.parse(readFileSync(excludePath, 'utf8')) as { pua?: string[] }).pua ?? []
        ).map((x) => x.toUpperCase().replace('U+', ''))
      : [],
  )
  const allByKey = new Map<string, Set<string>>()
  for (const item of zigenOut) allByKey.set(item.key, new Set(item.all))
  const mismatches = new Set<string>()
  for (const [pua, keys] of puaKeyFreq) {
    if (IDENT_PUA.has(pua) || EXCLUDE_PUA.has(pua)) continue
    const mainKey = [...keys.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const glyph = String.fromCodePoint(parseInt(pua, 16))
    if (!allByKey.get(mainKey)?.has(glyph)) {
      mismatches.add(`${mainKey.toUpperCase()}:U+${pua}`)
    }
  }
  if (mismatches.size > 0) {
    console.log(`[build-chars] 字形归并与拆解数据不一致 ${mismatches.size} 处：`)
    console.log('  ' + [...mismatches].join('  '))
  }
  // 文章库（R4.1 生成；缺失时输出空数组占位）
  const articlesPath = resolve(SOURCES, 'articles.json')
  writeFileSync(
    resolve(OUT_DIR, 'articles.json'),
    existsSync(articlesPath) ? readFileSync(articlesPath, 'utf8') : '[]',
    'utf8',
  )

  const total = Object.keys(entries).length
  const f1 = Object.keys(freq1).length
  console.log(`[build-chars] 单字条目 ${total}，一级常用字 ${f1}，常用字根 ${radicalWeights.length}`)
  if (unmapped.size > 0) {
    console.log(`[build-chars] 未映射字根 PUA ${unmapped.size} 个（已按键名兜底）`)
  }
}

main()
