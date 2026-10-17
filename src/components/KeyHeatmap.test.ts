import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import KeyHeatmap from './KeyHeatmap.vue'

describe('KeyHeatmap', () => {
  it('渲染每键次数，0 次键显示 0', () => {
    const wrapper = mount(KeyHeatmap, {
      props: { freq: { KeyA: 5, KeyB: 2 } },
    })
    expect(wrapper.find('[data-code="KeyA"] .hm__key-value').text()).toBe('5')
    expect(wrapper.find('[data-code="KeyB"] .hm__key-value').text()).toBe('2')
    expect(wrapper.find('[data-code="KeyC"] .hm__key-value').text()).toBe('0')
    expect(wrapper.find('[data-code="Digit1"] .hm__key-value').text()).toBe('0')
  })

  it('点击切换为占比模式', async () => {
    const wrapper = mount(KeyHeatmap, {
      props: { freq: { KeyA: 3, KeyB: 1 } },
    })
    expect(wrapper.find('[data-code="KeyA"] .hm__key-value').text()).toBe('3')

    await wrapper.trigger('click')

    expect(wrapper.find('[data-code="KeyA"] .hm__key-value').text()).toBe('75.0%')
    expect(wrapper.find('[data-code="KeyB"] .hm__key-value').text()).toBe('25.0%')
  })

  it('空数据显示占位文案', () => {
    const wrapper = mount(KeyHeatmap, { props: { freq: {} } })
    expect(wrapper.text()).toContain('暂无键频数据')
  })

  it('摘要显示总击键数与最高键', () => {
    const wrapper = mount(KeyHeatmap, {
      props: { freq: { KeyA: 5, KeyB: 2, Space: 1 } },
    })
    const summary = wrapper.find('.hm__summary').text()
    expect(summary).toContain('总击键 8')
    expect(summary).toContain('最高键 A（5 次）')
  })

  it('每键 title 包含键名与次数', () => {
    const wrapper = mount(KeyHeatmap, {
      props: { freq: { KeyA: 4 } },
    })
    expect(wrapper.find('[data-code="KeyA"]').attributes('title')).toContain('A 键')
    expect(wrapper.find('[data-code="KeyA"]').attributes('title')).toContain('4 次')
  })
})
