import { nextTick } from 'vue'

/**
 * 测试驱动接口：以代码注入键盘事件，高速验证练习流程，无需真实键盘。
 */

/** 注入一次 keydown */
export function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

/** 注入一串按键，逐键等待响应式更新 */
export async function typeKeys(keys: string): Promise<void> {
  for (const key of keys) {
    pressKey(key)
    await nextTick()
  }
}

/** 轮询等待条件成立 */
export async function waitUntil(cond: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil 超时')
    await new Promise((resolve) => setTimeout(resolve, 10))
    await nextTick()
  }
}
