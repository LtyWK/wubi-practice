import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import KeyboardMap from './KeyboardMap.vue'

describe('KeyboardMap', () => {
  it('渲染 25 个键位', async () => {
    const wrapper = mount(KeyboardMap)
    await vi.waitFor(() => {
      expect(wrapper.findAll('.key')).toHaveLength(25)
    })
  })

  it('传入高亮键时仅该键高亮', async () => {
    const wrapper = mount(KeyboardMap, { props: { highlight: 'g' } })
    await vi.waitFor(() => {
      expect(wrapper.findAll('.key--active')).toHaveLength(1)
    })
    const active = wrapper.findAll('.key--active')
    expect(active[0].text()).toContain('王')
  })

  it('每格显示键位字母与键名字根', async () => {
    const wrapper = mount(KeyboardMap)
    await vi.waitFor(() => {
      expect(wrapper.findAll('.key')).toHaveLength(25)
    })
    const first = wrapper.findAll('.key')[0]
    expect(first.text()).toContain('王')
    expect(first.text()).toContain('G')
  })
})
