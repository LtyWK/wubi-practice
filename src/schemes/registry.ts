import type { CharEntry, WubiScheme } from '@/types'
import { loadAllChars } from '@/data/loader'
import type { HintItem, InputScheme } from './base'

/** 已加载的码表；未加载时为 undefined */
const tables: Partial<Record<WubiScheme, Record<string, CharEntry>>> = {}

/** 确保指定方案的码表已加载 */
export async function ensureScheme(scheme: WubiScheme): Promise<void> {
  if (!tables[scheme]) {
    tables[scheme] = await loadAllChars(scheme)
  }
}

function makeScheme(scheme: WubiScheme): InputScheme {
  return {
    id: scheme,
    code(char: string): string | null {
      return tables[scheme]?.[char]?.code ?? null
    },
    shorts(char: string): string[] {
      return tables[scheme]?.[char]?.short ?? []
    },
    hint(char: string): HintItem[] {
      const entry = tables[scheme]?.[char]
      if (!entry) return []
      return entry.radicals.map(([text, key]) => ({ text, key }))
    },
  }
}

/** 86 版（微软五笔）方案实现 */
export const wubi86: InputScheme = makeScheme('wubi86')

/** 98 王码方案实现 */
export const wubi98: InputScheme = makeScheme('wubi98')

/** 按 id 取方案实现 */
export function getScheme(scheme: WubiScheme): InputScheme {
  return scheme === 'wubi98' ? wubi98 : wubi86
}

/** 兼容旧接口：确保 86 码表已加载 */
export async function ensureWubi86(): Promise<void> {
  await ensureScheme('wubi86')
}

/** 确保 98 码表已加载 */
export async function ensureWubi98(): Promise<void> {
  await ensureScheme('wubi98')
}
