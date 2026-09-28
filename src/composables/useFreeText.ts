import { ref } from 'vue'

/** 自由模式标题（模块级共享） */
const freeTitle = ref('')
/** 自由模式文本（模块级共享） */
const freeText = ref('')

/** 自由模式：设置待练习的自定义文本 */
export function useFreeText(): {
  freeTitle: typeof freeTitle
  freeText: typeof freeText
  setFreeText: (title: string, text: string) => void
} {
  function setFreeText(title: string, text: string): void {
    freeTitle.value = title
    freeText.value = text
  }
  return { freeTitle, freeText, setFreeText }
}
