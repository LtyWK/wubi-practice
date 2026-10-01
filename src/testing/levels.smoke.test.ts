import { describe, expect, it } from 'vitest'
import { loadArticles, loadRadicalWeights, loadZigen } from '@/data/loader'
import { buildPool, isHan, sample } from '@/data/pool'
import { STAGES } from '@/data/stages'
import { createSession, feedKey } from '@/engine/judge'
import { ensureWubi86, wubi86 } from '@/schemes/wubi86'
import type { Article, LevelConfig } from '@/types'

/** 按关卡配置生成练习字符（与 PlayView 行为一致） */
async function levelChars(lv: LevelConfig): Promise<string[]> {
  if (lv.type === 'article') {
    const articles = await loadArticles()
    const chosen = (lv.articleIds ?? [])
      .map((id) => articles.find((a) => a.id === id))
      .filter((a): a is Article => Boolean(a))
    const text = chosen.map((a) => a.paragraphs.join('\n')).join('\n')
    return [...text].filter(isHan)
  }
  return sample(await buildPool(lv), lv.length)
}

describe('关卡冒烟：按正确编码可自动通关', () => {
  for (const stage of STAGES) {
    for (const level of stage.levels) {
      it(`${level.id} · ${level.title}`, async () => {
        await ensureWubi86()
        if (level.type === 'zigen') {
          if (level.source === 'radicals') {
            // 常用字根强化：出题依赖权重数据而非固定键位池，且字形须来自合法字根表
            const [weights, zigenData] = await Promise.all([loadRadicalWeights(), loadZigen()])
            expect(weights.length).toBeGreaterThan(0)
            const allByKey = new Map(zigenData.map((z) => [z.key, new Set(z.all)]))
            expect(weights.every((w) => allByKey.get(w.key)?.has(w.root))).toBe(true)
          } else {
            expect(level.pool.length).toBeGreaterThan(0)
          }
          return
        }
        const chars = await levelChars(level)
        expect(chars.length).toBeGreaterThan(0)

        let session = createSession(chars, wubi86, 0)
        expect(session.items.length).toBeGreaterThan(0)

        for (const item of session.items) {
          for (const key of item.code) {
            session = feedKey(session, key).session
          }
        }

        expect(session.finished).toBe(true)
        expect(session.correctChars).toBe(session.items.length)
        expect(session.totalKeys).toBe(session.correctKeys)
      })
    }
  }
})
