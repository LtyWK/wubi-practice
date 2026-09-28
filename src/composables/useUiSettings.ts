import { ref } from 'vue'

/** 文本对齐方式 */
export type TextAlign = 'center' | 'left'

const KEY = 'wubi.ui.align'

function loadAlign(): TextAlign {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'left' || v === 'center') return v
  } catch {
    // 忽略读取失败
  }
  return 'center'
}

/** 模块级共享 UI 偏好 */
const align = ref<TextAlign>(loadAlign())

/** UI 偏好设置（本地保存，不进入存档导出） */
export function useUiSettings(): {
  align: typeof align
  setAlign: (value: TextAlign) => void
} {
  function setAlign(value: TextAlign): void {
    align.value = value
    try {
      localStorage.setItem(KEY, value)
    } catch {
      // 忽略写入失败
    }
  }
  return { align, setAlign }
}
