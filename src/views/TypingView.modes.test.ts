import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { loadArticles, loadCommon3500, loadWords } from '@/data/loader'
import { useFreeText } from '@/composables/useFreeText'
import { useSave } from '@/composables/useSave'
import TypingView from './TypingView.vue'

const routeRef = vi.hoisted(() => ({ params: { id: 's6-marathon-essay' } }))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef,
  useRouter: () => routerMock,
}))

const { unlockStage, resetAll, getLevelResult } = useSave()
const { setFreeText } = useFreeText()

let wrapper: VueWrapper | null = null

beforeAll(async () => {
  // 预加载数据：避免假定时器下真实动态 import 尚未完成导致等待超时
  await Promise.all([loadArticles(), loadCommon3500(), loadWords()])
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  localStorage.clear()
  resetAll()
  routerMock.push.mockClear()
  routerMock.replace.mockClear()
  routeRef.params.id = 's6-marathon-essay'
  unlockStage('s6')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const step = 10
  for (let waited = 0; waited <= 10000; waited += step) {
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

describe('TypingView 挑战模式（S6）', () => {
  it('耐力长跑：打完全篇后按速度与正确率达标并记录段位', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length >= 300, '文章目标加载')

    const chars = targetChars(view)
    expect(chars.length).toBeGreaterThan(300)

    // 首字启动计时，10 秒后一次性完成剩余文本：速度远高于 70 字/分
    feed(view, chars[0])
    await nextTick()
    await vi.advanceTimersByTimeAsync(10000)
    feed(view, chars.slice(1).join(''))
    await nextTick()

    expect(view.find('.result').exists()).toBe(true)
    expect(view.find('.result__pass--ok').exists()).toBe(true)
    expect(view.find('.result__pass--ok').text()).toBe('达标')

    const result = getLevelResult('s6-marathon-essay')
    expect(result?.passed).toBe(true)
    expect(result?.bestSpeed).toBeGreaterThan(70)
    expect(result?.rank).toBe('S')
  })

  it('无尽词流：累计错误达到上限后自动结算', async () => {
    routeRef.params.id = 's6-endless'
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length >= 1000, '词流目标加载')

    // 词流中不含「龘」字，连续 10 次错误即触发结束
    feed(view, '龘'.repeat(10))
    await nextTick()

    expect(view.find('.result').exists()).toBe(true)
    expect(view.find('.result__pass--fail').exists()).toBe(true)
    expect(view.find('.result').text()).toContain('无尽词流结束')
    expect(getLevelResult('s6-endless')?.passed).toBe(false)
  }, 20000)

  it('逐段提速：首段达标后短暂提示并进入下一段', async () => {
    routeRef.params.id = 's6-speedup-classic'
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length > 0, '第一段加载')
    expect(view.find('.typing__mode').text()).toContain('第 1/')

    const chars = targetChars(view)
    feed(view, chars[0])
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    feed(view, chars.slice(1).join(''))
    await nextTick()

    expect(view.find('.typing__banner').text()).toContain('第 1 段达标')
    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()
    expect(view.find('.typing__mode').text()).toContain('第 2/')
  })

  it('毕业综合：第一段达标后进入第二段', async () => {
    routeRef.params.id = 's6-gauntlet'
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length > 0, '第一段加载')
    expect(view.find('.typing__mode').text()).toContain('第 1/3 段')

    const chars = targetChars(view)
    feed(view, chars[0])
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    feed(view, chars.slice(1).join(''))
    await nextTick()

    expect(view.find('.typing__banner').text()).toContain('第 1 段达标')
    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()
    expect(view.find('.typing__mode').text()).toContain('第 2/3 段')
  })

  it('限时冲刺：首次提交启动倒计时，超时自动结算', async () => {
    routeRef.params.id = 's6-sprint-poem'
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length >= 1000, '冲刺目标加载')

    const chars = targetChars(view)
    const startedAt = Date.now()
    feed(view, chars[0])
    await nextTick()
    expect(view.find('.typing__mode').text()).toContain('剩余')

    // 直接把系统时间拨到 180 秒后，再触发一次 100ms 刷新（避免逐帧跑完 1800 次）
    vi.setSystemTime(startedAt + 180001)
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()

    expect(view.find('.result').exists()).toBe(true)
    expect(view.find('.result__pass--fail').exists()).toBe(true)
    expect(view.find('.result').text()).toContain('限时冲刺结束')
    expect(getLevelResult('s6-sprint-poem')?.passed).toBe(false)
  }, 20000)

  it('常用字综合 200：全池随机抽样、一次打完按速度与正确率达标', async () => {
    routeRef.params.id = 's4-common-mix'
    unlockStage('s4')
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 200, '综合目标加载')

    const chars = targetChars(view)
    expect(chars).toHaveLength(200)
    expect(new Set(chars).size).toBe(200) // 随机抽样不重复

    feed(view, chars[0])
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    feed(view, chars.slice(1).join(''))
    await nextTick()

    expect(view.find('.result').exists()).toBe(true)
    expect(view.find('.result__pass--ok').exists()).toBe(true)
    expect(getLevelResult('s4-common-mix')?.passed).toBe(true)
  }, 20000)

  it('常用词综合 200：词间分隔显示、随机抽取 200 词、一次打完结算', async () => {
    routeRef.params.id = 's5-words-mix'
    unlockStage('s5')
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length > 200, '词组目标加载')

    const chars = targetChars(view)
    expect(chars.length).toBeGreaterThan(200) // 200 个词的合计字数多于 200
    expect(view.findAll('.tv-punct')).toHaveLength(199) // 200 个词之间的分隔

    feed(view, chars[0])
    await nextTick()
    await vi.advanceTimersByTimeAsync(2000)
    feed(view, chars.slice(1).join(''))
    await nextTick()

    expect(view.find('.result').exists()).toBe(true)
    expect(getLevelResult('s5-words-mix')?.passed).toBe(true)
  }, 20000)

  it('自由模式：完成后显示结算面板且不展示达标徽章', async () => {
    routeRef.params.id = 'free'
    setFreeText('自由测试', '跟打器自由练习测试')
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length > 0, '自由文本加载')

    const chars = targetChars(view)
    feed(view, chars.join(''))
    await nextTick()

    expect(view.find('.result').exists()).toBe(true)
    expect(view.find('.result').text()).toContain('自由练习完成')
    // 自由模式不传 passed，不显示达标/未达标徽章
    expect(view.find('.result__pass').exists()).toBe(false)
  })
})
