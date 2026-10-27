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

const { unlockStage, resetAll, getTypingProgress, recordTypingGroup } = useSave()

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

  it('单组未达标：不打断训练（无结算卡片），提示后自动重来本组', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    const chars = targetChars(view)
    feed(view, chars.slice(0, 5).join(''))
    await nextTick()
    expect(view.findAll('.tv-char--done')).toHaveLength(5)
    // 默认 50 字/分档：10 字门槛为 12 秒，这里故意用 15 秒
    await vi.advanceTimersByTimeAsync(15000)
    feed(view, chars.slice(5).join(''))
    await nextTick()

    // 不显示结算卡片，仅横幅提示未达标
    expect(view.find('.result').exists()).toBe(false)
    const banner = view.find('.typing__banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('未达标')

    // 自动重来本组：进度未推进、本组重新开始
    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()
    expect(getTypingProgress('s4-common-1')?.groupIndex ?? 0).toBe(0)
    expect(view.findAll('.tv-char--done')).toHaveLength(0)
    expect(view.find('.tp__cell--current').text()).toBe('1')
  })

  it('重来本组时随机改变组内顺序（同组内容不变）', async () => {
    // 首次洗牌全取 0（组序左移一位），重来洗牌全取近 1（保持组基础顺序），确保结果可确定
    let calls = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      calls += 1
      return calls <= 9 ? 0 : 0.999999
    })

    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    const before = targetChars(view)
    feed(view, before.slice(0, 5).join(''))
    await nextTick()
    await vi.advanceTimersByTimeAsync(15000) // 超过默认 50 字/分门槛
    feed(view, before.slice(5).join(''))
    await nextTick()
    expect(view.find('.typing__banner').text()).toContain('未达标')

    // 1200ms 后自动重来本组：字集合不变、顺序已随机改变
    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()
    const after = targetChars(view)
    expect(after).toHaveLength(10)
    expect([...after].sort()).toEqual([...before].sort())
    expect(after).not.toEqual(before)
  })

  it('通关速度档位：35/50/70 可选（默认 50），切到 70 档后同样成绩不再达标', async () => {
    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第一组目标加载')

    // 档位按钮与连续训练说明
    expect(view.findAll('.speed-btn').map((node) => node.text())).toEqual(['35', '50', '70'])
    expect(view.find('.speed-btn--active').text()).toBe('50')
    expect(view.text()).toContain('速度达 50 字/分自动进入下一组，未达标自动重来')

    // 切到 70 档：50 字/分档下 10 秒可过关的成绩（60 字/分）变为未达标
    const btn70 = view.findAll('.speed-btn').find((node) => node.text() === '70')
    expect(btn70).toBeTruthy()
    await btn70!.trigger('click')
    await nextTick()
    expect(view.find('.speed-btn--active').text()).toBe('70')
    expect(view.text()).toContain('速度达 70 字/分自动进入下一组')

    // 10 字用时 10 秒 = 60 字/分：50 档可过、70 档未达标
    const chars = targetChars(view)
    feed(view, chars.slice(0, 5).join(''))
    await nextTick()
    await vi.advanceTimersByTimeAsync(10000)
    feed(view, chars.slice(5).join(''))
    await nextTick()

    expect(view.find('.typing__banner').text()).toContain('未达标')
    expect(getTypingProgress('s4-common-1')?.groupIndex ?? 0).toBe(0)
  })

  it('回打已通关组不倒退进度：通过 1、2 后回打 1，组 2 仍为已通关', async () => {
    recordTypingGroup('s4-common-1', 1, 60)
    recordTypingGroup('s4-common-1', 2, 70)

    const view = mount(TypingView)
    wrapper = view
    await waitFor(() => view.findAll('.tv-char').length === 10, '第 3 组目标加载')

    // 自动从第 3 组开始，进度 2 组
    expect(view.find('.tp__cell--current').text()).toBe('3')
    expect(view.findAll('.tp__cell')[1].classes()).toContain('tp__cell--passed')

    // 点击第 1 组回打
    await view.findAll('.tp__cell')[0].trigger('click')
    await nextTick()
    expect(view.find('.tp__cell--current').text()).toBe('1')
    expect(view.findAll('.tp__cell')[1].classes()).toContain('tp__cell--passed')

    // 回打期间前线组（第 3 组）保持可点击，可随时返回当前进度
    const frontier = view.findAll('.tp__cell')[2]
    expect(frontier.classes()).not.toContain('tp__cell--locked')
    expect(frontier.classes()).toContain('tp__cell--frontier')
    expect(frontier.classes()).toContain('tp__cell--clickable')
    await frontier.trigger('click')
    await nextTick()
    expect(view.find('.tp__cell--current').text()).toBe('3')

    // 再次回打第 1 组并完成
    await view.findAll('.tp__cell')[0].trigger('click')
    await nextTick()
    const chars = targetChars(view)
    feed(view, chars[0])
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
    feed(view, chars.slice(1).join(''))
    await nextTick()

    // 复习后进度不倒退：仍为 2 组，组 2 仍显示已通关
    expect(getTypingProgress('s4-common-1')?.groupIndex).toBe(2)
    expect(view.findAll('.tp__cell')[1].classes()).toContain('tp__cell--passed')

    // 连续复习：完成组 1 的复习后进入组 2（仍是已通关组复习）
    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()
    expect(view.find('.tp__cell--current').text()).toBe('2')

    // 完成组 2 的复习后到达前线组 3（恢复正常训练）
    const second = targetChars(view)
    feed(view, second[0])
    await nextTick()
    await vi.advanceTimersByTimeAsync(500)
    feed(view, second.slice(1).join(''))
    await nextTick()
    await vi.advanceTimersByTimeAsync(1200)
    await nextTick()
    expect(view.find('.tp__cell--current').text()).toBe('3')

    // 重新进入关卡（模拟刷新 / 返回地图再进入）：进度不丢失、不回退
    wrapper?.unmount()
    wrapper = null
    const reopened = mount(TypingView)
    wrapper = reopened
    await waitFor(() => reopened.findAll('.tv-char').length === 10, '重新进入加载')
    expect(getTypingProgress('s4-common-1')?.groupIndex).toBe(2)
    expect(reopened.find('.tp__cell--current').text()).toBe('3')
    expect(reopened.findAll('.tp__cell')[1].classes()).toContain('tp__cell--passed')
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
