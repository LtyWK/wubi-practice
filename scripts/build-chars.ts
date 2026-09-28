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
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

function main(): void {
  const dict = parseDict()
  const data = parseData()
  const level1 = parseLevel1()
  const rootsMap = parseRootsMap()

  const all = new Set<string>([...dict.keys(), ...data.keys()])
  const entries: Record<string, CharEntry> = {}
  const freq1: Record<string, CharEntry> = {}
  const unmapped = new Set<string>()

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
    if (d) {
      const n = Math.min(d.puas.length, code.length)
      for (let i = 0; i < n; i++) {
        const key = code[i]
        const pua = d.puas[i]
        const root = rootsMap.get(pua)
        if (!root) unmapped.add(pua)
        radicals.push([root ?? KEY_ROOT[key] ?? key, key])
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

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'chars.json'), JSON.stringify(entries), 'utf8')
  writeFileSync(resolve(OUT_DIR, 'chars.freq1.json'), JSON.stringify(freq1), 'utf8')
  // 字根表直接复制，供前端键盘图使用
  const zigen = readFileSync(resolve(SOURCES, 'zigen.json'), 'utf8')
  writeFileSync(resolve(OUT_DIR, 'zigen.json'), zigen, 'utf8')

  const total = Object.keys(entries).length
  const f1 = Object.keys(freq1).length
  console.log(`[build-chars] 单字条目 ${total}，一级常用字 ${f1}`)
  if (unmapped.size > 0) {
    console.log(`[build-chars] 未映射字根 PUA ${unmapped.size} 个（已按键名兜底）`)
  }
}

main()
