import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSave } from '@/composables/useSave'
import {
  loadArticles,
  loadCommon3500,
  loadRadicalWeights,
  loadWords,
  loadZigen,
} from '@/data/loader'
import { buildLevelChars, buildPool, isHan, sample } from '@/data/pool'
import { parseScript } from '@/data/script'
import { STAGES, stageOfLevel } from '@/data/stages'
import { createSession, feedKey } from '@/engine/judge'
import { ensureScheme, getScheme } from '@/schemes/registry'
import TypingView from '@/views/TypingView.vue'
import type { Article, LevelConfig, WubiScheme } from '@/types'

/** 两套输入方案各跑一遍关卡冒烟 */
const SCHEMES: WubiScheme[] = ['wubi86', 'wubi98']

const ALL_LEVELS: LevelConfig[] = STAGES.flatMap((stage) => stage.levels)
const TYPING_LEVELS: LevelConfig[] = ALL_LEVELS.filter((level) => level.type === 'typing')
/** climb 数据源的规定长度（实际数据由 scripts/verify-data.ts 校验；words-mix 为词表合计） */
const TYPING_SOURCE_LENGTH: Record<string, number> = {
  common3500: 3500,
  words2: 1000,
  words3: 200,
  words4: 200,
  'words-mix': 1400,
}
const CLIMB_LEVELS: LevelConfig[] = TYPING_LEVELS.filter(
  (level) => level.typing?.mode === 'climb',
)

// TypingView 依赖 vue-router；冒烟测试只模拟路由参数与跳转
const routeRef = vi.hoisted(() => ({ params: { id: 's4-common-1' } }))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef,
  useRouter: () => routerMock,
}))

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
  return buildLevelChars(lv, scheme)
}

describe('关卡配置一致性', () => {
  it('script 关的 length 与脚本训练字数一致', () => {
    let count = 0
    for (const stage of STAGES) {
      for (const level of stage.levels) {
        if (!level.script) continue
        count += 1
        expect(parseScript(level.script).chars.length, level.id).toBe(level.length)
      }
    }
    expect(count).toBeGreaterThan(0)
  })
})

describe('跟打器关卡配置一致性', () => {
  // 跟打器数据（common3500/words/articles）与输入方案无关，但沿用项目惯例两套方案各校验一遍
  for (const scheme of SCHEMES) {
    it(`6 阶段 43 关且 id 全局唯一 [${scheme}]`, () => {
      expect(STAGES.map((stage) => stage.levels.length)).toEqual([7, 10, 7, 8, 5, 6])
      expect(ALL_LEVELS).toHaveLength(43)
      expect(new Set(ALL_LEVELS.map((level) => level.id)).size).toBe(43)
      expect(TYPING_LEVELS).toHaveLength(19)
    })

    it(`typing 关必填 mode/source [${scheme}]`, () => {
      for (const level of TYPING_LEVELS) {
        const cfg = level.typing
        if (!cfg) throw new Error(`${level.id} 缺少 typing 配置`)
        expect(cfg.mode, `${level.id} mode`).toBeTruthy()
        expect(cfg.source, `${level.id} source`).toBeTruthy()
      }
    })

    it(`climb 关组参数与切片范围合法 [${scheme}]`, () => {
      expect(CLIMB_LEVELS).toHaveLength(9)
      for (const level of CLIMB_LEVELS) {
        const cfg = level.typing
        if (!cfg) throw new Error(`${level.id} 缺少 typing 配置`)
        expect(cfg.mode, level.id).toBe('climb')
        expect(Object.keys(TYPING_SOURCE_LENGTH), `${level.id} source`).toContain(cfg.source)

        const sourceLength = TYPING_SOURCE_LENGTH[cfg.source]
        if (sourceLength === undefined) throw new Error(`${level.id} 数据源无长度定义`)

        const groupSize = cfg.groupSize ?? 0
        const groupSpeed = cfg.groupSpeed ?? 0
        expect(Number.isInteger(groupSize), `${level.id} groupSize`).toBe(true)
        expect(groupSize, `${level.id} groupSize`).toBeGreaterThan(0)
        expect(Number.isInteger(groupSpeed), `${level.id} groupSpeed`).toBe(true)
        expect(groupSpeed, `${level.id} groupSpeed`).toBeGreaterThan(0)

        // words3/words4 允许省略 range（缺省为全量 200）；common3500/words2 必须显式切片
        if (cfg.source === 'common3500' || cfg.source === 'words2') {
          expect(cfg.range, `${level.id} 缺少 range`).toBeDefined()
        }
        const [start, end] = cfg.range ?? [0, sourceLength]
        expect(Number.isInteger(start), `${level.id} range.start`).toBe(true)
        expect(Number.isInteger(end), `${level.id} range.end`).toBe(true)
        expect(start, `${level.id} range.start`).toBeGreaterThanOrEqual(0)
        expect(start, `${level.id} range.start < end`).toBeLessThan(end)
        expect(end, `${level.id} range.end 超出数据源`).toBeLessThanOrEqual(sourceLength)
      }
    })

    it(`综合抽样关（marathon 数组源）字段齐全 [${scheme}]`, () => {
      const sampled = TYPING_LEVELS.filter((level) => level.typing?.sample !== undefined)
      expect(sampled.map((level) => level.id).sort()).toEqual([
        's4-common-mix',
        's4-common-mix-low',
        's4-common-mix-mid',
        's5-words-mix',
      ])
      for (const level of sampled) {
        const cfg = level.typing
        if (!cfg) throw new Error(`${level.id} 缺少 typing 配置`)
        expect(cfg.mode, level.id).toBe('marathon')
        // 常用字综合关按常用程度分段抽样，词组综合关覆盖全池
        const sourceLength = TYPING_SOURCE_LENGTH[cfg.source]
        if (sourceLength === undefined) throw new Error(`${level.id} 数据源无长度定义`)
        if (cfg.source === 'common3500') {
          expect(cfg.range, `${level.id} 缺少频段 range`).toBeDefined()
          const [start, end] = cfg.range ?? [0, sourceLength]
          expect(start, `${level.id} range.start`).toBeGreaterThanOrEqual(0)
          expect(start, `${level.id} range.start < end`).toBeLessThan(end)
          expect(end, `${level.id} range.end 超出数据源`).toBeLessThanOrEqual(sourceLength)
        } else {
          expect(cfg.range, `${level.id} 抽样关不应有 range`).toBeUndefined()
        }
        const poolSize = cfg.range ? cfg.range[1] - cfg.range[0] : sourceLength
        expect(Number.isInteger(cfg.sample), `${level.id} sample 应为整数`).toBe(true)
        expect(cfg.sample ?? 0, `${level.id} sample`).toBeGreaterThan(0)
        expect(cfg.sample ?? 0, `${level.id} sample 超出抽样范围`).toBeLessThanOrEqual(poolSize)
        expect(level.require.speed, `${level.id} require.speed`).toBeGreaterThan(0)
        expect(level.require.accuracy, `${level.id} require.accuracy`).toBeGreaterThan(0)
      }

      // 常用字综合上/中/下应连续且完整覆盖 3500 常用字
      const commonRanges = sampled
        .filter((level) => level.typing?.source === 'common3500')
        .map((level) => level.typing?.range)
        .sort((a, b) => (a?.[0] ?? 0) - (b?.[0] ?? 0))
      expect(commonRanges).toEqual([
        [0, 1167],
        [1167, 2334],
        [2334, 3500],
      ])
    })

    it(`article 源引用的篇目均存在 [${scheme}]`, async () => {
      const articles = await loadArticles()
      const ids = new Set(articles.map((article) => article.id))
      const refs: { levelId: string; articleIds: string[] }[] = []
      for (const level of TYPING_LEVELS) {
        const cfg = level.typing
        if (!cfg) continue
        if (cfg.source === 'article') {
          refs.push({ levelId: level.id, articleIds: cfg.articleIds ?? [] })
        }
        for (const segment of cfg.segments ?? []) {
          if (segment.source === 'article') {
            refs.push({
              levelId: `${level.id} 段落`,
              articleIds: segment.articleIds ?? [],
            })
          }
        }
      }
      expect(refs.length).toBeGreaterThan(0)
      for (const ref of refs) {
        expect(ref.articleIds.length, `${ref.levelId} 未引用篇目`).toBeGreaterThan(0)
        for (const id of ref.articleIds) {
          expect(ids.has(id), `${ref.levelId} 引用不存在的篇目 ${id}`).toBe(true)
        }
      }
    })

    it(`S6 各挑战模式字段齐全 [${scheme}]`, () => {
      const s6 = STAGES.find((stage) => stage.id === 's6')
      if (!s6) throw new Error('缺少 S6 挑战关卡阶段')
      expect(s6.levels).toHaveLength(6)
      const modes = new Set<string>()
      for (const level of s6.levels) {
        const cfg = level.typing
        if (!cfg) throw new Error(`${level.id} 缺少 typing 配置`)
        modes.add(cfg.mode)
        switch (cfg.mode) {
          case 'sprint':
            expect(cfg.durationSec ?? 0, `${level.id} durationSec`).toBeGreaterThan(0)
            expect(cfg.charTarget ?? 0, `${level.id} charTarget`).toBeGreaterThan(0)
            break
          case 'speedup':
            expect(cfg.speedup?.length ?? 0, `${level.id} speedup 数组为空`).toBeGreaterThan(0)
            for (const speed of cfg.speedup ?? []) {
              expect(speed, `${level.id} speedup 门槛`).toBeGreaterThan(0)
            }
            break
          case 'endless':
            expect(cfg.charTarget ?? 0, `${level.id} charTarget`).toBeGreaterThan(0)
            expect(cfg.errorLimit ?? 0, `${level.id} errorLimit`).toBeGreaterThan(0)
            expect(Number.isInteger(cfg.errorLimit), `${level.id} errorLimit`).toBe(true)
            break
          case 'marathon':
            expect(cfg.articleIds?.length ?? 0, `${level.id} articleIds`).toBeGreaterThan(0)
            expect(level.require.speed, `${level.id} require.speed`).toBeGreaterThan(0)
            expect(level.require.accuracy, `${level.id} require.accuracy`).toBeGreaterThan(0)
            break
          case 'gauntlet':
            expect(cfg.segments?.length ?? 0, `${level.id} segments 为空`).toBeGreaterThan(0)
            for (const segment of cfg.segments ?? []) {
              expect(segment.speed, `${level.id} 段落速度`).toBeGreaterThan(0)
            }
            break
        }
      }
      expect([...modes].sort()).toEqual([
        'endless',
        'gauntlet',
        'marathon',
        'speedup',
        'sprint',
      ])
    })
  }
})

describe('简码上屏冒烟：二级简码关每字各级简码 + 空格均可上屏', () => {
  for (const scheme of SCHEMES) {
    for (const stage of STAGES) {
      for (const level of stage.levels) {
        if (level.source !== 'short2') continue
        it(`${level.id} [${scheme}]`, async () => {
          await ensureScheme(scheme)
          const input = getScheme(scheme)
          const pool = await buildPool(level, scheme)
          const chars = [...new Set(sample(pool, 100))]
          expect(chars.length).toBeGreaterThan(0)
          for (const ch of chars) {
            const shorts = input.shorts(ch)
            expect(shorts.length, ch).toBeGreaterThan(0)
            for (const short of shorts) {
              let session = createSession([ch], input, 0)
              for (const key of short) session = feedKey(session, key).session
              session = feedKey(session, ' ').session
              expect(session.finished, `${ch} 打 ${short} + 空格`).toBe(true)
            }
          }
        })
      }
    }
  }
})

describe('简码上屏冒烟：脚本关按最短简码 + 空格可依次上屏', () => {
  for (const scheme of SCHEMES) {
    for (const stage of STAGES) {
      for (const level of stage.levels) {
        const script = level.script
        if (!script) continue
        it(`${level.id} [${scheme}]`, async () => {
          await ensureScheme(scheme)
          const input = getScheme(scheme)
          const chars = parseScript(script).chars
          let session = createSession(chars, input, 0)
          for (let i = 0; i < chars.length; i += 1) {
            const item = session.items[session.cursor]
            const shorts = input.shorts(item.char).filter((s) => s.length > 0)
            const shortest = [...shorts].sort((a, b) => a.length - b.length)[0] ?? item.code
            for (const key of shortest) session = feedKey(session, key).session
            if (shortest !== item.code) session = feedKey(session, ' ').session
            expect(session.cursor, item.char).toBe(i + 1)
          }
          expect(session.finished).toBe(true)
        })
      }
    }
  }
})

describe('S2 二级简码池划分与全覆盖', () => {
  const s2Stage = STAGES.find((s) => s.id === 's2')
  const short2Levels = (s2Stage?.levels ?? []).filter((l) => l.source === 'short2')

  /** 全池（无首码过滤） */
  const fullLevel = (): LevelConfig => ({ ...short2Levels[0], starts: undefined })

  for (const scheme of SCHEMES) {
    it(`五区关池互斥且并集为全部二级简码 [${scheme}]`, async () => {
      await ensureScheme(scheme)
      expect(short2Levels).toHaveLength(5)
      const pools = await Promise.all(short2Levels.map((l) => buildPool(l, scheme)))
      const all = pools.flat()
      expect(new Set(all).size).toBe(all.length)
      const full = await buildPool(fullLevel(), scheme)
      expect(new Set(all)).toEqual(new Set(full))
    })

    it(`各二级简码关题量不小于池大小（一轮全覆盖）[${scheme}]`, async () => {
      await ensureScheme(scheme)
      for (const l of short2Levels) {
        const pool = await buildPool(l, scheme)
        expect(l.length, l.id).toBeGreaterThanOrEqual(pool.length)
      }
    })
  }
})

for (const scheme of SCHEMES) {
  describe(`关卡冒烟[${scheme}]：按正确编码可自动通关`, () => {
    for (const stage of STAGES) {
      for (const level of stage.levels) {
        // 跟打器关卡只比对提交的汉字，无法按五笔编码自动通关：
        // 配置由上方「跟打器关卡配置一致性」校验，climb 流程由下方「跟打器爬坡冒烟」覆盖
        if (level.type === 'intro' || level.type === 'typing') continue
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

describe('跟打器爬坡冒烟：第 1 组达标写入进度', () => {
  const { resetAll, unlockStage, getTypingProgress } = useSave()
  let wrapper: VueWrapper | null = null

  beforeAll(async () => {
    // 预加载方案共用的跟打器数据，避免假定时器下动态 import 未完成导致等待超时
    await Promise.all([loadArticles(), loadCommon3500(), loadWords()])
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    localStorage.clear()
    resetAll()
    routerMock.push.mockClear()
    routerMock.replace.mockClear()
    routeRef.params.id = 's4-common-1'
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  /** 等待异步目标加载完成（同时推进假定时器） */
  async function waitFor(cond: () => boolean, label: string): Promise<void> {
    const step = 10
    for (let waited = 0; waited <= 5000; waited += step) {
      if (cond()) return
      await nextTick()
      await vi.advanceTimersByTimeAsync(step)
    }
    throw new Error(`等待超时：${label}`)
  }

  function targetChars(view: VueWrapper): string[] {
    return view.findAll('.tv-char').map((node) => node.text())
  }

  function feed(view: VueWrapper, text: string): void {
    const vm = view.vm as unknown as { feed: (value: string) => void }
    vm.feed(text)
  }

  // climb 数据（common3500/words）与输入方案无关，测一套即可
  for (const level of CLIMB_LEVELS) {
    it(`${level.id} · ${level.title}`, async () => {
      const stageId = stageOfLevel(level.id)?.id
      if (!stageId) throw new Error(`${level.id} 未归属任何阶段`)
      unlockStage(stageId)
      routeRef.params.id = level.id

      const view = mount(TypingView)
      wrapper = view
      await waitFor(() => view.findAll('.tv-char').length > 0, `${level.id} 目标加载`)

      const chars = targetChars(view)
      expect(chars.length, `${level.id} 第一组字数`).toBeGreaterThan(0)

      // 首字启动计时，推进 10ms 让组用时 > 0（速度与组最佳记录才为正数）
      feed(view, chars[0])
      await nextTick()
      await vi.advanceTimersByTimeAsync(10)
      feed(view, chars.slice(1).join(''))
      await nextTick()

      const progress = getTypingProgress(level.id)
      expect(progress?.groupIndex, `${level.id} 已通关组数`).toBe(1)
      expect(progress?.groupBests[0], `${level.id} 第 1 组最佳速度`).toBeGreaterThan(0)
      expect(view.find('.typing__banner').text(), `${level.id} 达标提示`).toContain('达标')
    })
  }
})
