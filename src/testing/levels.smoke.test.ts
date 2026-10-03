import { describe, expect, it } from 'vitest'
import { loadArticles, loadRadicalWeights, loadZigen } from '@/data/loader'
import { buildPool, isHan, sample } from '@/data/pool'
import { STAGES } from '@/data/stages'
import { createSession, feedKey } from '@/engine/judge'
import { ensureScheme, getScheme } from '@/schemes/registry'
import type { Article, LevelConfig, WubiScheme } from '@/types'

/** 两套输入方案各跑一遍关卡冒烟 */
const SCHEMES: WubiScheme[] = ['wubi86', 'wubi98']

/** 按关卡配置生成练习字符（与 PlayView 行为一致） */
async function levelChars(lv: LevelConfig, scheme: WubiScheme): Promise<string[]> {
  if (lv.type === 'article') {
    const articles = await loadArticles()
    const chosen = (lv.articleIds ?? [])
      .map((id) => articles.find((a) => a.id === id))
      .filter((a): a is Article => Boolean(a))
    const text = chosen.map((a) => a.paragraphs.join('\n')).join('\n')
    return [...text].filter(isHan)
  }
  return sample(await buildPool(lv, scheme), lv.length)
}

for (const scheme of SCHEMES) {
  describe(`关卡冒烟[${scheme}]：按正确编码可自动通关`, () => {
    for (const stage of STAGES) {
      for (const level of stage.levels) {
        it(`${level.id} · ${level.title}`, async () => {
          await ensureScheme(scheme)
          if (level.type === 'zigen') {
            if (level.source === 'radicals') {
              // 常用字根强化：出题依赖权重数据，且字形须来自合法字根表
              const [weights, zigenData] = await Promise.all([
                loadRadicalWeights(scheme),
                loadZigen(scheme),
              ])
              expect(weights.length).toBeGreaterThan(0)
              const rootsByKey = new Map(zigenData.map((z) => [z.key, new Set(z.roots)]))
              expect(weights.every((w) => rootsByKey.get(w.key)?.has(w.root))).toBe(true)
            } else {
              expect(level.pool.length).toBeGreaterThan(0)
            }
            return
          }
          const chars = await levelChars(level, scheme)
          expect(chars.length).toBeGreaterThan(0)

          let session = createSession(chars, getScheme(scheme), 0)
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
}
