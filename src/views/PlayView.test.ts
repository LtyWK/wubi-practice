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

const { unlockStage, resetAll } = useSave()

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

    expect(wrapper.findAll('.vk__key')).toHaveLength(27)
    expect(wrapper.findAll('.tp-char').length).toBeGreaterThan(0)

    const hint = wrapper.find('.vk__key--hint .vk__letter')
    expect(hint.exists()).toBe(true)
    pressKey(hint.text().toLowerCase())
    await nextTick()

    expect(wrapper.find('.tp-char--done-clean').exists()).toBe(true)
    expect(wrapper.find('.stats').text()).toContain('1/40')
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
})

describe('PlayView 单字模式', () => {
  it('显示编码提示，按全码可完成当前字', async () => {
    routeRef.params.id = 's3-short1-a'
    unlockStage('s2')
    unlockStage('s3')

    const wrapper = mount(PlayView)
    await waitUntil(() => wrapper.find('.hint__code').exists())

    const code = wrapper.find('.hint__code').text().replace(/\s/g, '').toLowerCase()
    expect(code.length).toBeGreaterThan(0)
    await typeKeys(code)

    await waitUntil(() => wrapper.find('.tp-char--done-clean').exists())
    expect(wrapper.find('.tp-char--done-clean').exists()).toBe(true)
  })
})
