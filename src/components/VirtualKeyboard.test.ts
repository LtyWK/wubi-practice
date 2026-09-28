import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VirtualKeyboard from './VirtualKeyboard.vue'

describe('VirtualKeyboard', () => {
  it('渲染 26 个字母键与空格键', () => {
    const wrapper = mount(VirtualKeyboard)
    expect(wrapper.findAll('.vk__key')).toHaveLength(27)
    expect(wrapper.find('.vk__key--space').exists()).toBe(true)
  })

  it('高亮下一步按键', () => {
    const wrapper = mount(VirtualKeyboard, { props: { highlight: 'g' } })
    expect(wrapper.findAll('.vk__key--hint')).toHaveLength(1)
    expect(wrapper.find('.vk__key--hint').text()).toBe('G')
  })

  it('闪烁反馈按键类名正确', () => {
    const wrapper = mount(VirtualKeyboard, {
      props: { feedback: { key: 'v', type: 'bad' } },
    })
    expect(wrapper.find('.vk__key--flash-bad').exists()).toBe(true)
  })

  it('最近一次输入常亮', () => {
    const wrapper = mount(VirtualKeyboard, {
      props: { sticky: { key: 'b', type: 'ok' } },
    })
    expect(wrapper.find('.vk__key--sticky-ok').text()).toBe('B')
  })

  it('超时提示类名正确', () => {
    const wrapper = mount(VirtualKeyboard, {
      props: { feedback: { key: ' ', type: 'timeout' } },
    })
    expect(wrapper.find('.vk__key--flash-timeout').exists()).toBe(true)
  })
})
