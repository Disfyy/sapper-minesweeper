import { useEffect, useState } from 'react'

const MUTED_KEY = 'ms.muted'

type SoundName = 'reveal' | 'flag' | 'win' | 'loss' | 'click'

let _ctx: AudioContext | null = null
let _muted: boolean = readStoredMuted()
const listeners = new Set<(m: boolean) => void>()

function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

function getCtx(): AudioContext | null {
  if (_muted) return null
  if (!_ctx) {
    try {
      const Ctor =
        typeof window !== 'undefined'
          ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null
      if (!Ctor) return null
      _ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (_ctx.state === 'suspended') {
    void _ctx.resume().catch(() => undefined)
  }
  return _ctx
}

function tone(opts: {
  freq: number
  duration: number
  type?: OscillatorType
  attack?: number
  release?: number
  gain?: number
  startDelay?: number
}) {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime + (opts.startDelay ?? 0)
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.freq, now)
  const peak = opts.gain ?? 0.12
  const attack = opts.attack ?? 0.005
  const release = opts.release ?? 0.06
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(peak, now + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration + release)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + opts.duration + release + 0.02)
}

function slide(opts: {
  from: number
  to: number
  duration: number
  type?: OscillatorType
  gain?: number
}) {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = opts.type ?? 'sawtooth'
  osc.frequency.setValueAtTime(opts.from, now)
  osc.frequency.exponentialRampToValueAtTime(Math.max(opts.to, 1), now + opts.duration)
  const peak = opts.gain ?? 0.16
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(peak, now + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + opts.duration + 0.05)
}

export function playSound(name: SoundName) {
  if (_muted) return
  switch (name) {
    case 'reveal':
      tone({ freq: 520, duration: 0.04, type: 'triangle', gain: 0.07 })
      return
    case 'flag':
      tone({ freq: 760, duration: 0.05, type: 'square', gain: 0.06 })
      tone({ freq: 1140, duration: 0.04, type: 'triangle', gain: 0.04, startDelay: 0.04 })
      return
    case 'click':
      tone({ freq: 380, duration: 0.035, type: 'square', gain: 0.05 })
      return
    case 'win':
      tone({ freq: 523.25, duration: 0.12, type: 'triangle', gain: 0.1, startDelay: 0 })
      tone({ freq: 659.25, duration: 0.12, type: 'triangle', gain: 0.1, startDelay: 0.1 })
      tone({ freq: 783.99, duration: 0.18, type: 'triangle', gain: 0.12, startDelay: 0.2 })
      tone({ freq: 1046.5, duration: 0.24, type: 'triangle', gain: 0.12, startDelay: 0.32 })
      return
    case 'loss':
      slide({ from: 220, to: 60, duration: 0.55, type: 'sawtooth', gain: 0.18 })
      tone({ freq: 90, duration: 0.45, type: 'sine', gain: 0.18, startDelay: 0.04 })
      return
  }
}

export function setMuted(m: boolean) {
  _muted = m
  try {
    localStorage.setItem(MUTED_KEY, m ? '1' : '0')
  } catch {
    /* ignore */
  }
  listeners.forEach((cb) => cb(m))
}

export function getMuted(): boolean {
  return _muted
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const [muted, setMutedState] = useState<boolean>(_muted)
  useEffect(() => {
    const cb = (m: boolean) => setMutedState(m)
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }, [])
  return [muted, setMuted]
}
