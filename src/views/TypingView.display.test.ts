import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { loadCommon3500, loadArticles, loadZigen } from '@/data/loader'
import { ensureScheme } from '@/schemes/registry'
import { useFreeText } from '@/composables/useFreeText'
import { useSave } from '@/composables/useSave'
import { useUiSettings } from '@/composables/useUiSettings'
import TypingView from './TypingView.vue'

const routeRef = vi.hoisted(() => ({ params: { id: 's4-common-1' } }))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef,
  useRouter: () => routerMock,
}))

const { unlockStage, resetAll } = useSave()
const { setFreeText } = useFreeText()
const { setAlign } = useUiSettings()

let wrapper: VueWrapper | null = null

beforeAll(async () => {
  // 预加载数据：避免假定时器下真实动态 import 尚未完成导致等待超时
  await Promise.all([
    loadCommon3500(),
    loadArticles(),
    loadZigen('wubi86'),
    loadZigen('wubi98'),
    ensureScheme('wubi86'),
    ensureScheme('wubi98'),
  ])
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  localStorage.clear()
  resetAll()
  setAlign('left')
  routerMock.push.mockClear()
  routerMock.replace.mockClear()
  routeRef.params.id = 's4-common-1'
  unlockStage('s4')
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

function feed(view: VueWrapper, text: string): void {
  const vm = view.vm as unknown as { feed: (value: string) => void }
  vm.feed(text)
}

describe('TypingView 显示与输入体验', () => {
  it('自由模式：保留标点与换行排版，标点不参与跟打', async () => {
    routeRef.params.id = 'free'
    setFreeText('排版测试', '你好，世界！\n第二行。')
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 7, '自由文本加载')

    // 目标仅汉字；标点装饰显示；换行保留段落结构
    expect(view.findAll('.tv-char').map((node) => node.text()).join('')).toBe('你好世界第二行')
    expect(view.findAll('.tv-punct').map((node) => node.text())).toEqual(['，', '！', '。'])
    expect(view.find('.typing__target br').exists()).toBe(true)

    feed(view, '你好世界第二行')
    await nextTick()
    expect(view.find('.result').exists()).toBe(true)
    expect(view.find('.result').text()).toContain('自由练习完成')
  })

  it('进行中显示光标，隐藏输入框位于目标区域内（IME 候选框跟随）', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    expect(view.find('.typing__target .typing__caret').exists()).toBe(true)
    expect(view.find('.typing__target .typing__input').exists()).toBe(true)
    expect(view.text()).not.toContain('键频')
  })

  it('拆字提示卡片：显示当前字的五笔拆解并随输入更新', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')
    await waitFor(() => view.find('.hint-card').exists(), '拆字卡片加载')

    const first = view.findAll('.tv-char')[0].text()
    expect(view.find('.hint-card .hint__char').text()).toBe(first)

    feed(view, first)
    await nextTick()
    const second = view.findAll('.tv-char')[1].text()
    expect(view.find('.hint-card .hint__char').text()).toBe(second)
  })

  it('虚拟键盘渲染字根矩阵（与编码练习关一致）', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')
    await waitFor(() => view.find('.vk__cell').exists(), '字根矩阵加载')

    expect(view.findAll('.vk__cell').length).toBeGreaterThan(0)
    expect(view.find('.vk__cell .vk__root').exists()).toBe(true)
  })

  it('对齐切换：流式布局显示按钮、诗词关自动居中；网格关不显示按钮', async () => {
    // 网格关（S4 爬坡）：不提供对齐按钮
    const grid = mount(TypingView)
    await waitFor(() => grid.findAll('.tv-char').length === 10, '第一组目标加载')
    expect(grid.find('.typing__target--grid').exists()).toBe(true)
    expect(grid.find('.align-btn').exists()).toBe(false)
    grid.unmount()

    // 诗词冲刺：进入时自动居中（初始为左对齐）
    routeRef.params.id = 's6-sprint-poem'
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length > 0, '冲刺目标加载')
    await waitFor(() => view.find('.align-btn--active').exists(), '对齐按钮就绪')

    expect(view.find('.typing__target--flow').exists()).toBe(true)
    expect(view.find('.typing__flow--center').exists()).toBe(true)
    expect(view.find('.align-btn--active').text()).toBe('居中')

    // 手动切换到左对齐
    const leftBtn = view.findAll('.align-btn').find((node) => node.text() === '左对齐')
    expect(leftBtn).toBeTruthy()
    await leftBtn!.trigger('click')
    await nextTick()
    expect(view.find('.typing__flow--left').exists()).toBe(true)
    expect(view.find('.typing__flow--center').exists()).toBe(false)
  }, 20000)

  it('虚拟键盘：物理按键按下时对应键帽高亮，随后自动熄灭', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    expect(view.find('.vk').exists()).toBe(true)
    const input = view.find('.typing__input').element as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }))
    await nextTick()

    const pressed = view.find('.vk__key--press')
    expect(pressed.exists()).toBe(true)
    expect(pressed.text()).toContain('A')

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()
    expect(view.find('.vk__key--press').exists()).toBe(false)
  })
})
