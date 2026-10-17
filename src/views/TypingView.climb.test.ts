import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { loadCommon3500 } from '@/data/loader'
import { useSave } from '@/composables/useSave'
import TypingView from './TypingView.vue'

const routeRef = vi.hoisted(() => ({ params: { id: 's4-common-1' } }))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef,
  useRouter: () => routerMock,
}))

const { unlockStage, resetAll, getTypingProgress } = useSave()

let wrapper: VueWrapper | null = null

beforeAll(async () => {
  // 预加载数据：避免假定时器下真实动态 import 尚未完成导致等待超时
  await loadCommon3500()
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  localStorage.clear()
  resetAll()
  routerMock.push.mockClear()
  routerMock.replace.mockClear()
  routeRef.params.id = 's4-common-1'
  unlockStage('s4')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** 等待异步数据加载与响应式更新（同时推进假定时器） */
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

describe('TypingView 爬坡（S4）', () => {
  it('单组达标：出现达标提示、保存进度并在 1200ms 后进入下一组', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    const chars = targetChars(view)
    feed(view, chars.slice(0, 5).join(''))
    await nextTick()
    await vi.advanceTimersByTimeAsync(5000)
    feed(view, chars.slice(5).join(''))
    await nextTick()

    const banner = view.find('.typing__banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('达标')
    expect(getTypingProgress('s4-common-1')?.groupIndex).toBe(1)
    // 提示期间仍停留在第 1 组
    expect(view.find('.tp__cell--current').text()).toBe('1')

    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()

    expect(view.find('.tp__cell--current').text()).toBe('2')
    expect(view.findAll('.tv-char')).toHaveLength(10)
    expect(getTypingProgress('s4-common-1')?.groupBests[0]).toBeGreaterThan(0)
  })

  it('单组不达标：显示未达标结算，groupIndex 保持 0', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    const chars = targetChars(view)
    feed(view, chars.slice(0, 5).join(''))
    await nextTick()
    expect(view.findAll('.tv-char--done')).toHaveLength(5)
    // 10 字门槛为 10 秒，这里故意用 15 秒
    await vi.advanceTimersByTimeAsync(15000)
    feed(view, chars.slice(5).join(''))
    await nextTick()

    expect(view.find('.result').exists()).toBe(true)
    expect(view.find('.result__pass--fail').exists()).toBe(true)
    expect(view.find('.result__pass--fail').text()).toBe('未达标')
    expect(view.find('.result').text()).toContain('10.0 秒')
    // 未达标不写进度（无记录等价于 groupIndex = 0）
    expect(getTypingProgress('s4-common-1')?.groupIndex ?? 0).toBe(0)
  })

  it('重新随机：清空进度、写入种子并打乱当前组顺序', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    const before = targetChars(view).join('')
    const button = view.findAll('button').find((node) => node.text() === '重新随机')
    expect(button).toBeTruthy()
    await button!.trigger('click')
    await nextTick()

    const progress = getTypingProgress('s4-common-1')
    expect(progress?.groupIndex).toBe(0)
    expect(progress?.groupBests).toEqual([])
    expect(typeof progress?.shuffleSeed).toBe('number')

    const after = targetChars(view).join('')
    expect(after).toHaveLength(10)
    expect(after).not.toBe(before)
  })
})
