import { ref } from 'vue'
import type { MistakeBook } from '@/types'

/** localStorage 键名 */
const KEY = 'wubi.v1.mistakes'

/** 错题本条目 */
export type MistakeEntry = MistakeBook[string]

function loadMistakes(): MistakeBook {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MistakeBook
  } catch {
    // 忽略损坏或不可用的本地数据
  }
  return {}
}

/** 模块级共享状态（跨视图） */
const book = ref<MistakeBook>(loadMistakes())

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(book.value))
  } catch {
    // 忽略写入失败
  }
}

/** 错题本：记录、查询、标记掌握 */
export function useMistakes(): {
  book: typeof book
  record: (char: string, code: string, actual: string) => void
  markMastered: (char: string) => void
  pending: () => [string, MistakeEntry][]
  clear: (char: string) => void
  reset: () => void
} {
  function record(char: string, code: string, actual: string): void {
    const entry: MistakeEntry = book.value[char] ?? {
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
    book.value[char] = entry
    persist()
  }

  function markMastered(char: string): void {
    const entry = book.value[char]
    if (entry && !entry.mastered) {
      entry.mastered = true
      persist()
    }
  }

  /** 未掌握（默认出现）的错题列表 */
  function pending(): [string, MistakeEntry][] {
    return Object.entries(book.value).filter(([, entry]) => !entry.mastered)
  }

  function clear(char: string): void {
    if (book.value[char]) {
      delete book.value[char]
      persist()
    }
  }

  function reset(): void {
    book.value = {}
    persist()
  }

  return { book, record, markMastered, pending, clear, reset }
}
