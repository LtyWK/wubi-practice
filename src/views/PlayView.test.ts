import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { pressKey, typeKeys, waitUntil } from '@/testing/drive'
import { useSave } from '@/composables/useSave'
import PlayView from './PlayView.vue'

const routeRef = vi.hoisted(() => ({ params: { id: 's1-zigen-heng' } }))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const { unlockStage, resetAll, isLevelPassed } = useSave()

beforeEach(() => {
  localStorage.clear()
  resetAll()
  routeRef.params.id = 's1-zigen-heng'
  unlockStage('s1')
})

describe('PlayView 字根模式', () => {
  it('渲染 QWERTY 键盘与目标字根，按对键推进进度', async () => {
    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.findAll('.tp-char').length > 0)

    expect(wrapper.findAll('.vk__key')).toHaveLength(28)
    expect(wrapper.findAll('.tp-char').length).toBeGreaterThan(0)

    const hint = wrapper.find('.vk__key--hint .vk__letter')
    expect(hint.exists()).toBe(true)
    pressKey(hint.text().toLowerCase())
    await nextTick()

    expect(wrapper.find('.tp-char--done-clean').exists()).toBe(true)
    expect(wrapper.find('.stats').text()).toContain('1/200')
  })

  it('按错键提示错误，完成后该字标记红色', async () => {
    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.findAll('.tp-char').length > 0)

    const hint = wrapper.find('.vk__key--hint .vk__letter')
    const right = hint.text().toLowerCase()
    const wrong = right === 'z' ? 'x' : 'z'

    pressKey(wrong)
    await nextTick()
    expect(wrapper.find('.vk__key--sticky-bad').exists()).toBe(true)

    pressKey(right)
    await nextTick()
    expect(wrapper.find('.tp-char--done-wrong').exists()).toBe(true)
  })

  it('点按虚拟键盘可上屏（触控）', async () => {
    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.findAll('.tp-char').length > 0)

    const hint = wrapper.find('.vk__key--hint')
    expect(hint.exists()).toBe(true)
    await hint.trigger('pointerdown')
    await nextTick()

    expect(wrapper.find('.tp-char--done-clean').exists()).toBe(true)
  })

  it('加练不写入关卡进度（未达标关卡不会被解锁）', async () => {
    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.findAll('.tp-char').length > 0)

    // 制造 30 次错键，拉低正确率使本关不达标（z 不在横区键位池内）
    for (let i = 0; i < 30; i += 1) {
      pressKey('z')
      await nextTick()
    }
    // 正确完成全部 200 题
    for (let i = 0; i < 200; i += 1) {
      const key = wrapper.find('.vk__key--hint .vk__letter').text().toLowerCase()
      pressKey(key)
      await nextTick()
    }

    await waitUntil(() => wrapper.find('.modal').exists())
    expect(isLevelPassed('s1-zigen-heng')).toBe(false)

    const practice = wrapper.findAll('button').find((b) => b.text().includes('加练所选'))
    expect(practice).toBeTruthy()
    await practice!.trigger('click')
    await nextTick()

    // 完成加练（10 题，均为实际打错的字根），即便成绩达标也不应解锁
    await waitUntil(() => wrapper.findAll('.tp-char').length > 0)
    for (let i = 0; i < 10; i += 1) {
      const key = wrapper.find('.vk__key--hint .vk__letter').text().toLowerCase()
      pressKey(key)
      await nextTick()
    }

    await waitUntil(() => wrapper.find('.modal').exists())
    expect(isLevelPassed('s1-zigen-heng')).toBe(false)
  })
})

describe('PlayView 单字模式', () => {
  it('显示编码提示，按全码可完成当前字', async () => {
    routeRef.params.id = 's2-short1-a'
    unlockStage('s2')

    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.find('.hint__code').exists())

    const code = wrapper.find('.hint__code').text().replace(/\s/g, '').toLowerCase()
    expect(code.length).toBeGreaterThan(0)
    await typeKeys(code)

    await waitUntil(() => wrapper.find('.tp-char--done-clean').exists())
    expect(wrapper.find('.tp-char--done-clean').exists()).toBe(true)
  })
})

describe('PlayView 退格', () => {
  it('可退格删除已输入字符（编码提示回退）', async () => {
    routeRef.params.id = 's2-short1-mix'
    unlockStage('s2')

    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.find('.hint__code').exists())

    const code = wrapper.find('.hint__code').text().replace(/\s/g, '').toLowerCase()
    pressKey(code[0])
    await nextTick()
    expect(wrapper.findAll('.hint__code-char--typed')).toHaveLength(1)

    pressKey('Backspace')
    await nextTick()
    expect(wrapper.findAll('.hint__code-char--typed')).toHaveLength(0)

    // 退格后仍可正常完成当前字
    await typeKeys(code)
    await waitUntil(() => wrapper.find('.tp-char--done-clean').exists())
    expect(wrapper.find('.tp-char--done-clean').exists()).toBe(true)
  })
})

describe('PlayView 教学关', () => {
  it('阅读完毕后标记通关', async () => {
    routeRef.params.id = 's2-intro'
    unlockStage('s2')

    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.find('.intro').exists())
    expect(wrapper.find('.intro__title').text()).toContain('简码概念')
    expect(wrapper.findAll('.intro__p').length).toBeGreaterThan(0)

    const btn = wrapper.findAll('button').find((b) => b.text().includes('已阅读'))
    expect(btn).toBeTruthy()
    await btn!.trigger('click')

    expect(isLevelPassed('s2-intro')).toBe(true)
  })
})

describe('PlayView 口诀脚本关', () => {
  it('渲染提示行与分组训练序列，按全码可推进', async () => {
    routeRef.params.id = 's2-short1-a'
    unlockStage('s2')

    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.find('.tp-hint').exists())

    // 提示行样式与内容
    const hints = wrapper.findAll('.tp-hint')
    expect(hints.length).toBeGreaterThan(0)
    expect(hints[0].text()).toContain('[口诀]')
    expect(hints.some((h) => h.text().includes('强化肌肉记忆'))).toBe(true)

    // 每组 drill 后的换行（br）存在
    expect(wrapper.findAll('.text-panel__text br').length).toBeGreaterThan(0)

    // 一级简码关显示简码提示
    const shorts = wrapper.find('.hint__shorts')
    expect(shorts.exists()).toBe(true)
    expect(shorts.text()).toContain('一级简码')
    expect(shorts.text()).toContain('G')

    // 第一题应为「一」，按全码完成
    const code = wrapper.find('.hint__code').text().replace(/\s/g, '').toLowerCase()
    expect(code.length).toBeGreaterThan(0)
    await typeKeys(code)
    await waitUntil(() => wrapper.find('.tp-char--done-clean').exists())
    expect(wrapper.find('.tp-char--done-clean').text()).toBe('一')
  })

  it('全码训练关（requireFull）不显示简码提示，且 drill 分组换行', async () => {
    routeRef.params.id = 's2-short1-full'
    unlockStage('s2')

    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.find('.hint__code').exists())
    expect(wrapper.find('.hint__shorts').exists()).toBe(false)
    // 每字连打 5 遍为一组，组尾换行
    expect(wrapper.findAll('.text-panel__text br').length).toBeGreaterThan(0)
  })

  it('二级简码关显示简码规则说明与当前字各级简码', async () => {
    routeRef.params.id = 's2-short2-heng'
    unlockStage('s2')

    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.find('.hint__shorts').exists())

    const guide = wrapper.find('.hint__short-guide')
    expect(guide.exists()).toBe(true)
    expect(guide.text()).toContain('一级简码：打 1 个键 + 空格')
    expect(guide.text()).toContain('二级简码：打 2 个键 + 空格')
    expect(guide.text()).toContain('三级简码：打 3 个键 + 空格')

    // 当前字至少有二级简码提示
    const items = wrapper.findAll('.hint__short-item')
    expect(items.length).toBeGreaterThan(0)
    expect(items.some((i) => i.text().includes('二级简码'))).toBe(true)
  })
})

describe('PlayView 随机字/字根网格布局', () => {
  it('字根关：每行 20 个（两组各 10 个），无对齐按钮', async () => {
    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.findAll('.tp-char').length > 0)

    expect(wrapper.find('.tp-grid').exists()).toBe(true)
    expect(wrapper.find('.text-panel__text').exists()).toBe(false)
    expect(wrapper.find('.align-btn').exists()).toBe(false)

    // 200 题 / 每行 20 个 = 10 行，每行两组、每组 10 个
    const rows = wrapper.findAll('.tp-grid__row')
    expect(rows).toHaveLength(10)
    for (const row of rows) {
      const groups = row.findAll('.tp-grid__group')
      expect(groups).toHaveLength(2)
      expect(groups[0].findAll('.tp-char')).toHaveLength(10)
      expect(groups[1].findAll('.tp-char')).toHaveLength(10)
    }
    expect(wrapper.findAll('.tp-char')).toHaveLength(200)
  })

  it('随机单字关使用网格布局，drill 关与脚本关保持字符流', async () => {
    routeRef.params.id = 's2-short1-mix'
    unlockStage('s2')

    const mixWrapper = mount(PlayView)
    await waitUntil(() => mixWrapper.findAll('.tp-char').length > 0)
    expect(mixWrapper.find('.tp-grid').exists()).toBe(true)
    mixWrapper.unmount()

    routeRef.params.id = 's2-short1-full'
    const drillWrapper = mount(PlayView)
    await waitUntil(() => drillWrapper.find('.hint__code').exists())
    expect(drillWrapper.find('.tp-grid').exists()).toBe(false)
    expect(drillWrapper.find('.text-panel__text').exists()).toBe(true)
    expect(drillWrapper.findAll('.text-panel__text br').length).toBeGreaterThan(0)
    drillWrapper.unmount()

    routeRef.params.id = 's2-short1-a'
    const scriptWrapper = mount(PlayView)
    await waitUntil(() => scriptWrapper.find('.tp-hint').exists())
    expect(scriptWrapper.find('.tp-grid').exists()).toBe(false)
    expect(scriptWrapper.find('.text-panel__text').exists()).toBe(true)
    scriptWrapper.unmount()
  })
})

