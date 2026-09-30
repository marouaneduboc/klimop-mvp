/** Soft UI feedback tones — Web Audio API, low volume, short. No fanfare. */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx || ctx.state === 'closed') ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

/** Warm up audio on a user gesture so later autoplay-adjacent tones are allowed. */
export function unlockSfx(): void {
  getCtx()
}

function tone(
  frequency: number,
  durationMs: number,
  opts?: { type?: OscillatorType; gain?: number; slideTo?: number },
): void {
  const ac = getCtx()
  if (!ac) return
  try {
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = opts?.type ?? 'sine'
    osc.frequency.setValueAtTime(frequency, now)
    if (opts?.slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), now + durationMs / 1000)
    }
    const peak = opts?.gain ?? 0.045
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(now)
    osc.stop(now + durationMs / 1000 + 0.02)
  } catch { /* ignore */ }
}

/** Soft high chime — success / correct. */
export function playSoftSuccess(): void {
  tone(660, 140, { type: 'sine', gain: 0.04 })
  window.setTimeout(() => tone(880, 180, { type: 'sine', gain: 0.032 }), 70)
}

/** Soft low thud — miss / wrong. */
export function playSoftMiss(): void {
  tone(180, 160, { type: 'triangle', gain: 0.035, slideTo: 110 })
}
