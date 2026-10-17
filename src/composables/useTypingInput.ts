import { onMounted, onUnmounted, watch, type Ref } from 'vue'

export interface TypingInputHandlers {
  /** 收到提交的字符（已过滤为汉字，可能多个） */
  onText: (text: string) => void
  /** 退格（非 IME 组合状态下） */
  onBackspace: () => void
  /** 物理按键按下（e.code 白名单：KeyA-KeyZ / Digit0-9 / Space / Backspace；IME 组合期间也回调，用于键帽反馈） */
  onKey?: (code: string) => void
  /** 是否接受输入（ref 或函数均可） */
  enabled?: () => boolean
}

/** 物理按键回调白名单（按 KeyboardEvent.code） */
const KEY_CODES = new Set<string>()
for (let i = 0; i < 26; i += 1) {
  KEY_CODES.add(`Key${String.fromCharCode(65 + i)}`)
}
for (let i = 0; i < 10; i += 1) KEY_CODES.add(`Digit${i}`)
KEY_CODES.add('Space')
KEY_CODES.add('Backspace')

/** 提取文本中的汉字（含扩展 A 区） */
function extractHan(text: string): string {
  let out = ''
  for (const char of text) {
    if (/[\u3400-\u9fff]/.test(char)) out += char
  }
  return out
}

/**
 * 跟打器输入捕获：隐藏 input 上的 IME 汉字流 + 物理按键回调（键帽反馈用）。
 *
 * - composition 期间的 input 事件忽略，compositionend 提交最终汉字；
 * - 兼容「compositionend 后仍派发同一次 input」的浏览器，避免重复提交；
 * - 屏蔽粘贴与拖放；输入框自动聚焦，视图可调用 focus() 重新聚焦；
 * - enabled() 为 false 时文本、退格、按键回调全部忽略。
 */
export function useTypingInput(
  inputEl: Ref<HTMLInputElement | null>,
  handlers: TypingInputHandlers,
): {
  focus: () => void
  /** 供测试/程序化注入已提交文本 */
  commit: (text: string) => void
} {
  let bound: HTMLInputElement | null = null
  /** 是否处于 IME 组合状态 */
  let composing = false
  /** compositionend 已提交的数据：用于跳过随后同数据的 input 事件 */
  let skipInputData: string | null = null

  function enabled(): boolean {
    return handlers.enabled ? handlers.enabled() : true
  }

  function commit(text: string): void {
    if (!enabled()) return
    const han = extractHan(text)
    if (han.length > 0) handlers.onText(han)
  }

  function onCompositionStart(): void {
    composing = true
    skipInputData = null
  }

  function onCompositionUpdate(): void {
    composing = true
  }

  function onCompositionEnd(event: CompositionEvent): void {
    composing = false
    const data = event.data || bound?.value || ''
    skipInputData = data
    commit(data)
    if (bound) bound.value = ''
  }

  function onInput(event: Event): void {
    const input = event.target as HTMLInputElement | null
    if (!input) return
    const inputEvent = event as InputEvent
    // 组合过程中的中间态不上屏
    if (composing || inputEvent.isComposing) return

    const data = typeof inputEvent.data === 'string' ? inputEvent.data : input.value
    // 部分浏览器 compositionend 后会再派发一次相同内容的 input
    if (skipInputData !== null && extractHan(data) === extractHan(skipInputData)) {
      skipInputData = null
      input.value = ''
      return
    }
    skipInputData = null
    commit(data)
    input.value = ''
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!enabled()) return
    // 物理按键回调：长按不重复触发；IME 组合期间同样回调（用于键帽反馈）
    if (KEY_CODES.has(event.code) && !event.repeat) handlers.onKey?.(event.code)
    // 组合中的退格交给输入法处理；普通退格仅清除错误槽
    if (event.code === 'Backspace' && !composing && !event.isComposing) {
      event.preventDefault()
      handlers.onBackspace()
    }
  }

  function preventDefault(event: Event): void {
    event.preventDefault()
  }

  function unbind(): void {
    const el = bound
    if (!el) return
    el.removeEventListener('compositionstart', onCompositionStart)
    el.removeEventListener('compositionupdate', onCompositionUpdate)
    el.removeEventListener('compositionend', onCompositionEnd)
    el.removeEventListener('input', onInput)
    el.removeEventListener('keydown', onKeydown, true)
    el.removeEventListener('paste', preventDefault)
    el.removeEventListener('drop', preventDefault)
    bound = null
  }

  function bind(): void {
    unbind()
    const el = inputEl.value
    if (!el) return
    bound = el
    el.addEventListener('compositionstart', onCompositionStart)
    el.addEventListener('compositionupdate', onCompositionUpdate)
    el.addEventListener('compositionend', onCompositionEnd)
    el.addEventListener('input', onInput)
    el.addEventListener('keydown', onKeydown, true)
    el.addEventListener('paste', preventDefault)
    el.addEventListener('drop', preventDefault)
    el.focus()
  }

  function focus(): void {
    inputEl.value?.focus()
  }

  onMounted(bind)
  watch(inputEl, bind, { flush: 'post' })
  onUnmounted(unbind)

  return { focus, commit }
}
