/**
 * 码表构建脚本：将原始数据源转换为前端使用的单字码表。
 *
 * 用法：tsx scripts/build-chars.ts [wubi86|wubi98]（默认 wubi86）
 *
 * 输入（scripts/sources/）：
 *   - wubi86.dict.yaml / wubi98.dict.yaml    RIME 码表（唯一编码事实源）
 *   - data-wubi-v86.tsv / data-wubi-v98.tsv  字根拆解序列
 *   - data-chars.tsv                         汉字分级（一级 3500）
 *   - roots-map.json                         86 版 PUA → 字根文本映射
 *
 * 输出（src/data/generated/{scheme}/）：
 *   - chars.json            全量单字码表
 *   - chars.freq1.json      一级（通用规范一级 3500）常用字
 * 输出（src/data/generated/）：
 *   - articles.json         文章库（方案共用）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Scheme = 'wubi86' | 'wubi98'

interface CharEntry {
  code: string
  short: string[]
  radicals: [string, string][]
  freq: 0 | 1
  idcode: boolean
}

/** 25 键键名字根（86/98 相同），用于未识别 PUA 的兜底显示 */
const KEY_ROOT: Record<string, string> = {
  g: '王', f: '土', d: '大', s: '木', a: '工',
  h: '目', j: '日', k: '口', l: '田', m: '山',
  t: '禾', r: '白', e: '月', w: '人', q: '金',
  y: '言', u: '立', i: '水', o: '火', p: '之',
  n: '已', b: '子', v: '女', c: '又', x: '纟',
}

/** 86 版识别码 PUA（BMP 私有区，字体渲染为带圈字形） */
const IDENT_PUA_86 = new Set([
  'E000', 'E015', 'E02D', 'E06A', 'E080', 'E097',
  'E0CD', 'E0DF', 'E0F4', 'E13D', 'E155', 'E171',
  'E1AD', 'E1DF', 'E1FA',
])

/** 98 版识别码 PUA（补充私有区 B，字体渲染为带圈字形） */
const IDENT_PUA_98 = new Set([
  'F0005', 'F000C', 'F000F', 'F0018', 'F001D', 'F0022',
  'F0026', 'F002C', 'F0035', 'F0040', 'F0063', 'F0065',
  'F0067', 'F006B', 'F0076',
])

const SCHEMES: Record<Scheme, { dict: string; data: string; ident: Set<string> }> = {
  wubi86: { dict: 'wubi86.dict.yaml', data: 'data-wubi-v86.tsv', ident: IDENT_PUA_86 },
  wubi98: { dict: 'wubi98.dict.yaml', data: 'data-wubi-v98.tsv', ident: IDENT_PUA_98 },
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = resolve(ROOT, 'scripts/sources')
const OUT_ROOT = resolve(ROOT, 'src/data/generated')

const CJK = /[\u4e00-\u9fff]/
const CODE = /^[a-z]{1,4}$/

/** 解析 RIME 码表，返回 字 → (编码 → 权重) */
function parseDict(dictFile: string): Map<string, Map<string, number>> {
  const text = readFileSync(resolve(SOURCES, dictFile), 'utf8')
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
  /** 是否含识别码 */
  idcode: boolean
}

/** 解析 86 版拆解数据（TSV 列式），返回 字 → { 全码, PUA 序列 } */
function parseData86(dataFile: string): Map<string, DataRow> {
  const text = readFileSync(resolve(SOURCES, dataFile), 'utf8')
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

/** 解析 98 版拆解数据（OpenCC 格式：字\t〔※字根序列※☯※编码※☯※拼音※〕） */
function parseData98(dataFile: string): Map<string, DataRow> {
  const text = readFileSync(resolve(SOURCES, dataFile), 'utf8')
  const lines = text.split(/\r?\n/)
  const result = new Map<string, DataRow>()
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 2) continue
    const ch = cols[0]
    if (ch.length !== 1 || !CJK.test(ch)) continue
    let inner = cols[1]
    if (inner.includes('〔')) inner = inner.slice(inner.indexOf('〔') + 1)
    if (inner.includes('〕')) inner = inner.slice(0, inner.indexOf('〕'))
    const parts = inner.split('\u262f') // ☯
    if (parts.length < 2) continue // 含「·」的多拆法行，无编码
    const code = (parts[1] || '').replace(/[^a-z]/g, '')
    if (!code) continue
    const puas: string[] = []
    for (const c of parts[0]) {
      const v = c.codePointAt(0) ?? 0
      if (v >= 0xf0000 && v <= 0x10fffd) puas.push(v.toString(16).toUpperCase())
    }
    const idcode = puas.length > 0 && IDENT_PUA_98.has(puas[puas.length - 1])
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

/** 载入 86 PUA → 字根文本映射 */
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

function buildChars(scheme: Scheme): void {
  const cfg = SCHEMES[scheme]
  const dict = parseDict(cfg.dict)
  const data = scheme === 'wubi86' ? parseData86(cfg.data) : parseData98(cfg.data)
  const level1 = parseLevel1()
  const rootsMap = scheme === 'wubi86' ? parseRootsMap() : new Map<string, string>()

  // 编码 → 首选字（权重最高者）：简码只归属首选字，避免重码字误占简码
  // （98 码表中键名字也带单字母编码，如「王」有 g，须让位给权重更高的「一」）
  const primary = new Map<string, { ch: string; weight: number }>()
  for (const [ch, codes] of dict) {
    for (const [c, w] of codes) {
      const cur = primary.get(c)
      if (!cur || w > cur.weight) primary.set(c, { ch, weight: w })
    }
  }

  const all = new Set<string>([...dict.keys(), ...data.keys()])
  const entries: Record<string, CharEntry> = {}
  const freq1: Record<string, CharEntry> = {}

  for (const ch of all) {
    const d = data.get(ch)
    const codes = dict.get(ch)
    const code = pickCode(codes, d?.code ?? '')
    if (!code) continue

    const short: string[] = []
    if (codes) {
      for (const c of codes.keys()) {
        if (c.length < code.length && primary.get(c)?.ch === ch) short.push(c)
      }
      short.sort((a, b) => a.length - b.length || a.localeCompare(b))
    }

    const radicals: [string, string][] = []
    if (d) {
      const n = Math.min(d.puas.length, code.length)
      for (let i = 0; i < n; i++) {
        const key = code[i]
        const pua = d.puas[i]
        // 86：映射为字根文本；98：直接用 PUA 字形（字体渲染）
        const root = scheme === 'wubi86' ? (rootsMap.get(pua) ?? KEY_ROOT[key] ?? key) : String.fromCodePoint(parseInt(pua, 16))
        radicals.push([root, key])
      }
    }

    const isFreq1 = level1.has(ch)
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

  const outDir = resolve(OUT_ROOT, scheme)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'chars.json'), JSON.stringify(entries), 'utf8')
  writeFileSync(resolve(outDir, 'chars.freq1.json'), JSON.stringify(freq1), 'utf8')

  // 文章库（方案共用）
  const articlesPath = resolve(SOURCES, 'articles.json')
  writeFileSync(
    resolve(OUT_ROOT, 'articles.json'),
    existsSync(articlesPath) ? readFileSync(articlesPath, 'utf8') : '[]',
    'utf8',
  )

  const total = Object.keys(entries).length
  const f1 = Object.keys(freq1).length
  console.log(`[build-chars:${scheme}] 单字条目 ${total}，一级常用字 ${f1}`)
}

function main(): void {
  const arg = (process.argv[2] || 'wubi86') as Scheme
  if (arg !== 'wubi86' && arg !== 'wubi98') {
    console.error(`未知方案：${arg}（可选 wubi86 / wubi98）`)
    process.exit(1)
  }
  buildChars(arg)
}

main()
