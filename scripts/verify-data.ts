/**
 * 数据校验脚本（T1.5）。
 *
 * 校验规则：
 *   ① 每字 radicals 的键位拼接为 code 的前缀（允许恰好多 1 位识别码）
 *   ② 每个字根 ∈ 86 字根表
 *   ③ 一级简码 25 字与内置表完全一致
 *   ④ 随机抽取 50 个一级常用字输出编码清单，供人工与微软五笔比对
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface CharEntry {
  code: string
  short: string[]
  radicals: [string, string][]
  freq: 0 | 1
}

interface ZigenItem {
  key: string
  name: string
  radicals: string[]
  notes?: { root: string; note: string }[]
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = resolve(ROOT, 'scripts/sources')
const GEN = resolve(ROOT, 'src/data/generated/chars.json')

/** 一级简码：键 → 字 */
const LEVEL1: Record<string, string> = {
  g: '一', f: '地', d: '在', s: '要', a: '工',
  h: '上', j: '是', k: '中', l: '国', m: '同',
  t: '和', r: '的', e: '有', w: '人', q: '我',
  y: '主', u: '产', i: '不', o: '为', p: '这',
  n: '民', b: '了', v: '发', c: '以', x: '经',
}

/** 25 键键名字根 */
const KEY_ROOT: Record<string, string> = {
  g: '王', f: '土', d: '大', s: '木', a: '工',
  h: '目', j: '日', k: '口', l: '田', m: '山',
  t: '禾', r: '白', e: '月', w: '人', q: '金',
  y: '言', u: '立', i: '水', o: '火', p: '之',
  n: '已', b: '子', v: '女', c: '又', x: '纟',
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function main(): void {
  const chars = readJson<Record<string, CharEntry>>(GEN)
  const zigen = readJson<ZigenItem[]>(resolve(SOURCES, 'zigen.json'))
  const rootsMap = readJson<Record<string, string>>(resolve(SOURCES, 'roots-map.json'))

  const validRoots = new Set<string>(Object.values(KEY_ROOT))
  for (const z of zigen) for (const r of z.radicals) validRoots.add(r)
  for (const [k, v] of Object.entries(rootsMap)) if (!k.startsWith('_')) validRoots.add(v)

  const total = Object.keys(chars).length
  const freq1 = Object.values(chars).filter((e) => e.freq === 1).length

  let failPrefix = 0
  let failRoot = 0
  const badPrefix: string[] = []
  const badRoot = new Set<string>()

  for (const [ch, e] of Object.entries(chars)) {
    const joined = e.radicals.map((r) => r[1]).join('')
    let ok = joined.length <= e.code.length && e.code.startsWith(joined)
    if (!ok) {
      // 允许恰好多 1 位识别码：radicals 键位为 code 的全部键位
      ok = joined === e.code.slice(0, joined.length) && joined.length === e.code.length
    }
    if (!ok) {
      failPrefix++
      if (badPrefix.length < 10) badPrefix.push(`${ch} ${e.code} radicals=${joined}`)
    }
    for (const [root] of e.radicals) {
      if (!validRoots.has(root)) {
        failRoot++
        badRoot.add(root)
        break
      }
    }
  }

  // 校验③ 一级简码
  const found: Record<string, string> = {}
  for (const [ch, e] of Object.entries(chars)) {
    for (const s of e.short) {
      if (s.length === 1) found[s] = ch
    }
  }
  const level1Ok =
    Object.keys(LEVEL1).length === Object.keys(found).length &&
    Object.entries(LEVEL1).every(([k, v]) => found[k] === v)

  console.log('=== 数据校验 ===')
  console.log(`单字条目：${total}（要求 ≥ 7000）`)
  console.log(`一级常用字：${freq1}（要求 = 3500）`)
  console.log(`① radicals 键位前缀：${failPrefix === 0 ? '通过' : `失败 ${failPrefix}`}`)
  if (badPrefix.length) console.log('   示例：', badPrefix.join(' | '))
  console.log(`② 字根表合法性：${failRoot === 0 ? '通过' : `失败 ${failRoot}`}`)
  if (badRoot.size) console.log('   非法字根：', [...badRoot].join(' '))
  console.log(`③ 一级简码 25 字：${level1Ok ? '通过' : '不一致'}`)
  if (!level1Ok) console.log('   实际：', JSON.stringify(found))

  // 校验④ 字根表完整性：25 键，每键 2-14 个字根（K 键仅「口川」2 个）
  const zigenIssues: string[] = []
  if (zigen.length !== 25) zigenIssues.push(`键位数 ${zigen.length}（要求 25）`)
  for (const z of zigen) {
    if (z.radicals.length < 2 || z.radicals.length > 14) {
      zigenIssues.push(`${z.key}:${z.radicals.length}`)
    }
  }
  const zigenOk = zigenIssues.length === 0
  console.log(`④ 字根表完整性：${zigenOk ? '通过' : `异常（${zigenIssues.join(' ')}）`}`)

  // 校验④ 抽 50 个一级常用字
  const freq1Chars = Object.keys(chars).filter((ch) => chars[ch].freq === 1)
  const sample: string[] = []
  const step = Math.max(1, Math.floor(freq1Chars.length / 50))
  for (let i = 0; i < freq1Chars.length && sample.length < 50; i += step) {
    sample.push(freq1Chars[i])
  }
  console.log('=== 抽样编码（供人工与微软五笔比对）===')
  console.log(
    sample
      .map((ch) => `${ch} ${chars[ch].code}  ${chars[ch].radicals.map((r) => r[0]).join('')}`)
      .join('  |  '),
  )

  const ok =
    total >= 7000 && freq1 === 3500 && failPrefix === 0 && failRoot === 0 && level1Ok && zigenOk
  if (!ok) {
    console.error('\n数据校验未通过')
    process.exit(1)
  }
  console.log('\n数据校验全部通过')
}

main()
