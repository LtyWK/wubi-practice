/**
 * 数据校验脚本。
 *
 * 用法：tsx scripts/verify-data.ts [wubi86|wubi98]（默认 wubi86）
 *
 * 校验规则：
 *   ① chars.radicals 的键位拼接为 code 前缀（允许恰好多 1 位识别码）
 *   ② 一级简码 25 字与标准表一致
 *   ③ zigen 25 键完整；roots 与人工配置逐项一致；layout 引用的字形都在 roots 中
 *   ④ 随机抽取 50 个一级常用字输出编码清单，供人工比对
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Scheme = 'wubi86' | 'wubi98'

interface CharEntry {
  code: string
  short: string[]
  radicals: [string, string][]
  freq: 0 | 1
  idcode?: boolean
}

interface LayoutCell {
  cp: string
  bold?: boolean
  mark?: 'red' | 'green' | null
}

interface ZigenItem {
  key: string
  name: string
  short1: string
  roots: string[]
  layout: { size: number; cells: (LayoutCell | null)[] }
}

interface ZigenConfig {
  names: Record<string, string>
  short1: Record<string, string>
  roots: Record<string, string[]>
}

interface LayoutConfig {
  layouts: Record<string, { size: number; cells: (LayoutCell | null)[] }>
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = resolve(ROOT, 'scripts/sources')
const KEY_ORDER = 'gfdsahjklmtrewqyuiopnbvcx'.split('')

/** 一级简码：键 → 字（86/98 相同） */
const LEVEL1: Record<string, string> = {
  g: '一', f: '地', d: '在', s: '要', a: '工',
  h: '上', j: '是', k: '中', l: '国', m: '同',
  t: '和', r: '的', e: '有', w: '人', q: '我',
  y: '主', u: '产', i: '不', o: '为', p: '这',
  n: '民', b: '了', v: '发', c: '以', x: '经',
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function verify(scheme: Scheme): boolean {
  const suffix = scheme.slice(-2)
  const chars = readJson<Record<string, CharEntry>>(
    resolve(ROOT, `src/data/generated/${scheme}/chars.json`),
  )
  const zigen = readJson<ZigenItem[]>(resolve(ROOT, `src/data/generated/${scheme}/zigen.json`))
  const cfg = readJson<ZigenConfig>(resolve(SOURCES, `zigen-${suffix}.json`))
  const layout = readJson<LayoutConfig>(resolve(SOURCES, `layout-${suffix}.json`))

  const total = Object.keys(chars).length
  const freq1 = Object.values(chars).filter((e) => e.freq === 1).length

  // ① radicals 键位前缀
  let failPrefix = 0
  const badPrefix: string[] = []
  for (const [ch, e] of Object.entries(chars)) {
    const joined = e.radicals.map((r) => r[1]).join('')
    const ok = joined.length <= e.code.length && e.code.startsWith(joined)
    if (!ok) {
      failPrefix++
      if (badPrefix.length < 10) badPrefix.push(`${ch} ${e.code} radicals=${joined}`)
    }
  }

  // ② 一级简码
  const found: Record<string, string> = {}
  for (const [ch, e] of Object.entries(chars)) {
    for (const s of e.short) {
      if (s.length === 1) found[s] = ch
    }
  }
  const level1Ok =
    Object.keys(LEVEL1).length === Object.keys(found).length &&
    Object.entries(LEVEL1).every(([k, v]) => found[k] === v)

  // ③ zigen 完整性 + 与配置一致
  const zigenIssues: string[] = []
  if (zigen.length !== 25) zigenIssues.push(`键位数 ${zigen.length}（要求 25）`)
  const byKey = new Map(zigen.map((z) => [z.key, z]))
  for (const key of KEY_ORDER) {
    const z = byKey.get(key)
    if (!z) {
      zigenIssues.push(`${key} 缺失`)
      continue
    }
    if (z.name !== cfg.names[key]) zigenIssues.push(`${key} 键名不一致`)
    if (z.short1 !== cfg.short1[key]) zigenIssues.push(`${key} 简码不一致`)
    if (JSON.stringify(z.roots) !== JSON.stringify(cfg.roots[key])) {
      zigenIssues.push(`${key} roots 与配置不一致`)
    }
    const lo = layout.layouts[key]
    if (!lo || z.layout.size !== lo.size || JSON.stringify(z.layout.cells) !== JSON.stringify(lo.cells)) {
      zigenIssues.push(`${key} 布局与配置不一致`)
    }
    // layout 引用的字形都在 roots 中
    const rootSet = new Set(z.roots)
    for (const cell of z.layout.cells) {
      if (cell && !rootSet.has(cell.cp)) {
        zigenIssues.push(`${key} 布局含 roots 外的字形`)
        break
      }
    }
  }

  console.log(`=== ${scheme} 数据校验 ===`)
  console.log(`单字条目：${total}（要求 ≥ 7000）`)
  console.log(`一级常用字：${freq1}（要求 = 3500）`)
  console.log(`① radicals 键位前缀：${failPrefix === 0 ? '通过' : `失败 ${failPrefix}`}`)
  if (badPrefix.length) console.log('   示例：', badPrefix.join(' | '))
  console.log(`② 一级简码 25 字：${level1Ok ? '通过' : '不一致'}`)
  if (!level1Ok) console.log('   实际：', JSON.stringify(found))
  console.log(`③ 字根表完整性/一致性：${zigenIssues.length === 0 ? '通过' : `异常（${zigenIssues.join('; ')}）`}`)

  // ④ 抽样
  const freq1Chars = Object.keys(chars).filter((ch) => chars[ch].freq === 1)
  const sample: string[] = []
  const step = Math.max(1, Math.floor(freq1Chars.length / 50))
  for (let i = 0; i < freq1Chars.length && sample.length < 50; i += step) {
    sample.push(freq1Chars[i])
  }
  console.log('=== 抽样编码（供人工比对）===')
  console.log(
    sample
      .map((ch) => `${ch} ${chars[ch].code}  ${chars[ch].radicals.map((r) => r[1]).join('')}`)
      .join('  |  '),
  )

  const ok = total >= 7000 && freq1 === 3500 && failPrefix === 0 && level1Ok && zigenIssues.length === 0
  return ok
}

function main(): void {
  const arg = (process.argv[2] || 'wubi86') as Scheme
  if (arg !== 'wubi86' && arg !== 'wubi98') {
    console.error(`未知方案：${arg}（可选 wubi86 / wubi98）`)
    process.exit(1)
  }
  if (!verify(arg)) {
    console.error(`\n${arg} 数据校验未通过`)
    process.exit(1)
  }
  console.log(`\n${arg} 数据校验全部通过`)
}

main()
