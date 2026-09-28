import { computed, type ComputedRef } from 'vue'
import type { MistakeBook } from '@/types'
import { flushSave, touchSave, useSave } from './useSave'

/** 错题本条目 */
export type MistakeEntry = MistakeBook[string]

/** 错题本：记录、查询、标记掌握（数据存于统一存档 mistakes 字段） */
export function useMistakes(): {
  book: ComputedRef<MistakeBook>
  record: (char: string, code: string, actual: string) => void
  markMastered: (char: string) => void
  pending: () => [string, MistakeEntry][]
  clear: (char: string) => void
  reset: () => void
} {
  const { save } = useSave()

  const book = computed(() => save.value.mistakes)

  function record(char: string, code: string, actual: string): void {
    const entry: MistakeEntry = save.value.mistakes[char] ?? {
      code,
      count: 0,
      lastWrongInputs: [],
      lastAt: 0,
      mastered: false,
    }
    entry.code = code
    entry.count += 1
    entry.lastWrongInputs = [actual, ...entry.lastWrongInputs].slice(0, 5)
    entry.lastAt = Date.now()
    entry.mastered = false
    save.value.mistakes[char] = entry
    touchSave()
  }

  function markMastered(char: string): void {
    const entry = save.value.mistakes[char]
    if (entry && !entry.mastered) {
      entry.mastered = true
      touchSave()
    }
  }

  /** 未掌握（默认出现）的错题列表 */
  function pending(): [string, MistakeEntry][] {
    return Object.entries(save.value.mistakes).filter(([, entry]) => !entry.mastered)
  }

  function clear(char: string): void {
    if (save.value.mistakes[char]) {
      delete save.value.mistakes[char]
      touchSave()
    }
  }

  function reset(): void {
    save.value.mistakes = {}
    flushSave()
  }

  return { book, record, markMastered, pending, clear, reset }
}
