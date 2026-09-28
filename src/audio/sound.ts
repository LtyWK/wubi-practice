/**
 * 按键音效：使用 Web Audio 实时合成，无需音频文件、无第三方依赖。
 * 首次按键时才创建 AudioContext（符合浏览器自动播放策略）。
 */

export type SoundKind = 'ok' | 'bad' | 'timeout'

let ctx: AudioContext | null = null

type AudioContextCtor = typeof AudioContext

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  const Ctor = win.AudioContext ?? win.webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  freq: number,
  durationMs: number,
  volume: number,
  type: OscillatorType = 'sine',
  delayMs = 0,
): void {
  const c = ensureContext()
  if (!c) return
  try {
    const t0 = c.currentTime + delayMs / 1000
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(t0)
    osc.stop(t0 + durationMs / 1000 + 0.03)
  } catch {
    // 音效失败不影响练习
  }
}

/** 播放按键反馈音（小音量；错误音更明显） */
export function playKeySound(kind: SoundKind): void {
  if (kind === 'ok') {
    tone(880, 45, 0.04)
  } else if (kind === 'bad') {
    tone(240, 90, 0.085, 'square')
    tone(180, 120, 0.07, 'square', 55)
  } else {
    tone(520, 70, 0.045, 'triangle')
  }
}
