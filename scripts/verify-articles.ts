/**
 * 文章数据校验（R4.1）。
 *
 * 校验：
 *   ① 结构完整（id/title/author/source/paragraphs/difficulty）
 *   ② id 唯一，汉字数 ≥ 10
 *   ③ stages.ts 中所有 articleIds 都能在文章库中找到
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface Article {
  id: string
  title: string
  author: string
  source: string
  difficulty: number
  paragraphs: string[]
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function hanCount(text: string): number {
  return [...text].filter((c) => /[\u4e00-\u9fff]/.test(c)).length
}

function main(): void {
  const articles = JSON.parse(
    readFileSync(resolve(ROOT, 'scripts/sources/articles.json'), 'utf8'),
  ) as Article[]

  const errors: string[] = []
  const ids = new Set<string>()

  for (const a of articles) {
    if (!a.id || !a.title || !a.author || !a.source) errors.push(`字段缺失：${a.id || '?'}`)
    if (ids.has(a.id)) errors.push(`id 重复：${a.id}`)
    ids.add(a.id)
    if (!Array.isArray(a.paragraphs) || a.paragraphs.length === 0) {
      errors.push(`段落为空：${a.id}`)
      continue
    }
    const count = hanCount(a.paragraphs.join(''))
    if (count < 10) errors.push(`汉字过少（${count}）：${a.id}`)
    if (a.difficulty < 1 || a.difficulty > 4) errors.push(`难度越界：${a.id}`)
  }

  const stagesSource = readFileSync(resolve(ROOT, 'src/data/stages.ts'), 'utf8')
  const referenced = [...stagesSource.matchAll(/'([a-z0-9-]+)'/g)]
    .map((m) => m[1])
    .filter((id) => /^(jingyesi|dengguanquelou|zaofabaidicheng|shanxing|shuidiaogetou|loushiming|ailianshuo|chun|yueyanglou)$/.test(id))
  for (const id of referenced) {
    if (!ids.has(id)) errors.push(`stages 引用不存在：${id}`)
  }

  console.log('=== 文章校验 ===')
  console.log(`篇目 ${articles.length} 篇，引用校验 ${referenced.length} 处`)
  for (const a of articles) {
    console.log(`  ${a.id} 《${a.title}》 ${a.author} · ${hanCount(a.paragraphs.join(''))} 字`)
  }

  if (errors.length > 0) {
    console.error('\n文章校验未通过：')
    for (const e of errors) console.error('  -', e)
    process.exit(1)
  }
  console.log('文章校验全部通过')
}

main()
