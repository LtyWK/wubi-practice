import { ref } from 'vue'

/** 文本对齐方式 */
export type TextAlign = 'center' | 'left'
/** 主题模式 */
export type ThemeMode = 'auto' | 'light' | 'dark'

const ALIGN_KEY = 'wubi.ui.align'
const THEME_KEY = 'wubi.ui.theme'
const SOUND_KEY = 'wubi.ui.sound'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 忽略写入失败
  }
}

function initialTheme(): ThemeMode {
  const v = read(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
}

/** 模块级共享 UI 偏好 */
const align = ref<TextAlign>(read(ALIGN_KEY) === 'left' ? 'left' : 'center')
const theme = ref<ThemeMode>(initialTheme())
const soundOn = ref<boolean>(read(SOUND_KEY) !== 'off')

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

/** 将当前主题应用到 <html data-theme> */
function applyTheme(): void {
  if (typeof document === 'undefined') return
  const resolved = theme.value === 'auto' ? (systemPrefersDark() ? 'dark' : 'light') : theme.value
  document.documentElement.setAttribute('data-theme', resolved)
}

// 模块加载即应用主题，并跟随系统变化（auto 模式）
applyTheme()
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'auto') applyTheme()
  })
}

/** UI 偏好：文本对齐、主题、按键音效（本地保存，不进入存档导出） */
export function useUiSettings(): {
  align: typeof align
  theme: typeof theme
  soundOn: typeof soundOn
  setAlign: (value: TextAlign) => void
  setTheme: (value: ThemeMode) => void
  setSound: (value: boolean) => void
  applyTheme: () => void
} {
  function setAlign(value: TextAlign): void {
    align.value = value
    write(ALIGN_KEY, value)
  }

  function setTheme(value: ThemeMode): void {
    theme.value = value
    write(THEME_KEY, value)
    applyTheme()
  }

  function setSound(value: boolean): void {
    soundOn.value = value
    write(SOUND_KEY, value ? 'on' : 'off')
  }

  return { align, theme, soundOn, setAlign, setTheme, setSound, applyTheme }
}
