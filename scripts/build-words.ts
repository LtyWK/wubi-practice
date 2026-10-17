/**
 * 词组表构建脚本：从 86 版 RIME 码表提取常用二/三/四字词。
 *
 * 用法：tsx scripts/build-words.ts [--review]
 *   - 默认：生成 src/data/generated/words.json（方案共用）
 *   - --review：打印各表按权重排序的前 300 条，供人工审查黑名单
 *
 * 输入（scripts/sources/）：
 *   - wubi86.dict.yaml    RIME 码表（词条格式：text\tcode\tweight[\tstem]）
 *
 * 输出（src/data/generated/）：
 *   - words.json          二字词 1000 / 三字词 200 / 四字词 200（权重降序）
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = resolve(ROOT, 'scripts/sources')
const OUT_ROOT = resolve(ROOT, 'src/data/generated')

const PURE_HAN = /^[\u4e00-\u9fff]+$/

/**
 * 词组黑名单（按 top 300 人工审查后整理）。
 * 判定标准：无通用教学价值、商业专名、不雅/敏感词。
 */
export const WORD_BLACKLIST: readonly string[] = [
  // 商业品牌/专名
  '百度',
  '新浪',
  '淘宝',
  '雅虎',
  '诺基亚',
  '爱立信',
  '富士通',
  '摩托罗拉',
  '卡巴斯基',
  '阿尔卡特',
  '奥林巴斯',
  '纳斯达克',
  '可口可乐',
  '麦当劳',
  '英特尔',
  '阿里巴巴',
  // 日本企业形态，非中文通用词
  '株式会社',
  // 不当/敏感词
  '靖国神社',
  '花花公子',
  '番号',
]

type WordLength = 2 | 3 | 4

interface WordEntry {
  text: string
  code: string
  weight: number
}

/** 各表目标数量 */
const TARGET: Record<WordLength, number> = { 2: 1000, 3: 200, 4: 200 }

/** 解析 RIME 码表，提取纯汉字词条并按 text 去重（保留最高权重） */
function parseWords(): Map<WordLength, WordEntry[]> {
  const text = readFileSync(resolve(SOURCES, 'wubi86.dict.yaml'), 'utf8')
  const lines = text.split(/\r?\n/)
  const best = new Map<string, WordEntry>()
  let inBody = false

  for (const line of lines) {
    if (!inBody) {
      if (line.trim() === '...') inBody = true
      continue
    }
    if (!line || line.startsWith('#')) continue
    const cols = line.split('\t')
    if (cols.length < 3) continue
    const word = cols[0]
    if (word.length < 2 || word.length > 4 || !PURE_HAN.test(word)) continue
    const weight = Number(cols[2]) || 0
    const prev = best.get(word)
    if (!prev || weight > prev.weight) {
      best.set(word, { text: word, code: cols[1], weight })
    }
  }

  const result: Map<WordLength, WordEntry[]> = new Map([
    [2, []],
    [3, []],
    [4, []],
  ])
  for (const entry of best.values()) {
    result.get(entry.text.length as WordLength)?.push(entry)
  }
  for (const list of result.values()) {
    list.sort((a, b) => b.weight - a.weight || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
  }
  return result
}

/** 打印各表前 300 条供人工审查（标注已在黑名单中的词条） */
function review(words: Map<WordLength, WordEntry[]>): void {
  for (const len of [2, 3, 4] as const) {
    console.log(`=== ${len} 字词（按权重前 300）===`)
    for (const [i, w] of words.get(len)!.slice(0, 300).entries()) {
      const mark = WORD_BLACKLIST.includes(w.text) ? '\t[黑名单]' : ''
      console.log(`${String(i + 1).padStart(3)}. ${w.text}\t${w.code}\t${w.weight}${mark}`)
    }
  }
}

function build(words: Map<WordLength, WordEntry[]>): void {
  const tables = {} as Record<WordLength, string[]>
  for (const len of [2, 3, 4] as const) {
    const list = words
      .get(len)!
      .filter((w) => !WORD_BLACKLIST.includes(w.text))
      .slice(0, TARGET[len])
    if (list.length < TARGET[len]) {
      throw new Error(`${len} 字词不足：${list.length}（要求 ${TARGET[len]}）`)
    }
    tables[len] = list.map((w) => w.text)
  }

  mkdirSync(OUT_ROOT, { recursive: true })
  const output = {
    words2: tables[2],
    words3: tables[3],
    words4: tables[4],
  }
  writeFileSync(resolve(OUT_ROOT, 'words.json'), JSON.stringify(output), 'utf8')

  console.log(
    `[build-words] 二字词 ${output.words2.length}，三字词 ${output.words3.length}，` +
      `四字词 ${output.words4.length}，黑名单 ${WORD_BLACKLIST.length}`,
  )
}

function main(): void {
  const words = parseWords()
  if (process.argv.includes('--review')) {
    review(words)
    return
  }
  build(words)
}

// 供 verify-data.ts 导入黑名单时，避免执行构建逻辑
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
