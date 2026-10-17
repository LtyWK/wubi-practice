import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useFreeText } from '@/composables/useFreeText'
import { useSave } from '@/composables/useSave'
import TypingView from './TypingView.vue'

const routeRef = vi.hoisted(() => ({ params: { id: 's4-common-1' } }))
const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef,
  useRouter: () => routerMock,
}))

const { resetAll } = useSave()
const { setFreeText } = useFreeText()

let wrapper: VueWrapper | null = null

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  localStorage.clear()
  resetAll()
  routerMock.push.mockClear()
  routerMock.replace.mockClear()
  routeRef.params.id = 's4-common-1'
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('TypingView 路由门禁', () => {
  it('未解锁阶段：进入跟打器关卡时重定向回地图', async () => {
    wrapper = mount(TypingView)
    await nextTick()
    expect(routerMock.replace).toHaveBeenCalledWith('/')
  })

  it('自由模式无文本：重定向回自由模式入口', async () => {
    routeRef.params.id = 'free'
    setFreeText('', '')
    wrapper = mount(TypingView)
    await nextTick()
    expect(routerMock.replace).toHaveBeenCalledWith('/free')
  })
})
