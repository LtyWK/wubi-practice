import type { CharEntry } from '@/types'
import { loadAllChars } from '@/data/loader'
import type { HintItem, InputScheme } from './base'

/** 已加载的码表；为 null 表示尚未调用 ensureWubi86 */
let table: Record<string, CharEntry> | null = null

/** 确保微软五笔（86 版）码表已加载 */
export async function ensureWubi86(): Promise<void> {
  if (!table) {
    table = await loadAllChars()
  }
}

/** 微软五笔（86 版王码）输入方案实现 */
export const wubi86: InputScheme = {
  id: 'wubi86',

  code(char: string): string | null {
    return table?.[char]?.code ?? null
  },

  shorts(char: string): string[] {
    return table?.[char]?.short ?? []
  },

  hint(char: string): HintItem[] {
    const entry = table?.[char]
    if (!entry) return []
    return entry.radicals.map(([text, key]) => ({ text, key }))
  },
}
