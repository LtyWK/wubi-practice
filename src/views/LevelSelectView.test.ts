import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSave } from '@/composables/useSave'
import LevelSelectView from './LevelSelectView.vue'

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerMock.push }),
}))

const { resetAll, unlockStage, recordLevelResult, recordTypingGroup, recordEndlessBest } = useSave()

beforeEach(() => {
  localStorage.clear()
  resetAll()
  routerMock.push.mockClear()
})

describe('LevelSelectView 跳转分流', () => {
  it('typing 关跳转 /typing/:id，其余关跳转 /play/:id', async () => {
    unlockStage('s1')
    unlockStage('s4')

    const wrapper = mount(LevelSelectView)
    const cards = wrapper.findAll('button.card')

    const typingCard = cards.find((b) => b.text().includes('最常用 700 字'))
    expect(typingCard).toBeTruthy()
    expect(typingCard!.text()).toContain('每组 10 字 ≤10 秒')
    await typingCard!.trigger('click')
    expect(routerMock.push).toHaveBeenLastCalledWith('/typing/s4-common-1')

    const normalCard = cards.find((b) => b.text().includes('横区字根'))
    expect(normalCard).toBeTruthy()
    expect(normalCard!.text()).toContain('≥ 30 键/分 · 90%')
    await normalCard!.trigger('click')
    expect(routerMock.push).toHaveBeenLastCalledWith('/play/s1-zigen-heng')
  })
})

describe('LevelSelectView climbing 关卡', () => {
  it('显示组进度条、组进度文本与最佳组速度，未开始显示未开始', () => {
    unlockStage('s4')
    recordTypingGroup('s4-common-1', 3, 78)

    const wrapper = mount(LevelSelectView)
    const cards = wrapper.findAll('button.card')

    const started = cards.find((b) => b.text().includes('最常用 700 字'))
    expect(started).toBeTruthy()
    expect(started!.text()).toContain('进度 3/70 组')
    expect(started!.text()).toContain('最佳 78 字/分')

    const bar = started!.find<HTMLProgressElement>('progress.card__bar')
    expect(bar.exists()).toBe(true)
    expect(bar.element.value).toBe(3)
    expect(bar.element.max).toBe(70)

    const fresh = cards.find((b) => b.text().includes('常用 700 字·二'))
    expect(fresh).toBeTruthy()
    expect(fresh!.text()).toContain('进度 0/70 组')
    expect(fresh!.text()).toContain('未开始')
  })
})

describe('LevelSelectView 挑战关卡', () => {
  it('按模式渲染规则标签、段位徽章与无尽纪录', () => {
    unlockStage('s6')
    recordLevelResult('s6-sprint-poem', 300, 0.99, true, 0, 'S')
    recordEndlessBest(1234)

    const wrapper = mount(LevelSelectView)
    const cards = wrapper.findAll('button.card')

    const sprint = cards.find((b) => b.text().includes('诗词限时冲刺'))
    expect(sprint).toBeTruthy()
    expect(sprint!.text()).toContain('限时 3 分钟')
    expect(sprint!.text()).toContain('达标 ≥180 字')
    expect(sprint!.find('.rank--s').exists()).toBe(true)

    const speedup = cards.find((b) => b.text().includes('古韵逐段提速'))
    expect(speedup!.text()).toContain('逐段提速 50→60→70 字/分')

    const marathon = cards.find((b) => b.text().includes('现代文耐力长跑'))
    expect(marathon!.text()).toContain('≥70 字/分 · 正确率 ≥95%')

    const endless = cards.find((b) => b.text().includes('无尽词流'))
    expect(endless!.text()).toContain('单局 ≥500 字')
    expect(endless!.text()).toContain('错 10 次结束')
    expect(endless!.text()).toContain('纪录 1234 字')

    const gauntlet = cards.find((b) => b.text().includes('毕业综合测试'))
    expect(gauntlet!.text()).toContain('3 段综合测试')
  })
})
