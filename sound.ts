/**
 * Sample-based sound system for Swipe.
 *
 * Real recorded card foley (Kenney "Casino Audio" pack, CC0 / public domain)
 * with the polish tricks every shipped card game uses:
 *  - 2–4 variants per action, cycled randomly (never the same twice in a row)
 *  - ±6–10% pitch and ±15% volume randomization on every play
 *  - layered "moments" (swipe = card fan + low thump; burn = fan + sizzle)
 *
 * Web Audio synthesis remains only as a fallback while samples decode
 * (first ~100ms of a session) or if decoding fails.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const isNative = Capacitor.isNativePlatform();

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;

// Load persisted mute preference
if (typeof localStorage !== 'undefined') {
  try {
    muted = localStorage.getItem('swipe-muted') === 'true';
  } catch {}
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('swipe-muted', String(next));
    } catch {}
  }
}

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(audioContext.destination);
    } catch {
      return null;
    }
  }
  // Resume on first user gesture (required by browsers)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function out(): AudioNode {
  return masterGain ?? getContext()!.destination;
}

/* ------------------------------------------------------------------ */
/* Sample library                                                     */
/* ------------------------------------------------------------------ */

const FILES = [
  'card-slide-1', 'card-slide-2', 'card-slide-3',
  'card-slide-5', 'card-slide-6',
  'card-place-1', 'card-place-2', 'card-place-3', 'card-place-4',
  'card-shove-1', 'card-shove-2', 'card-shove-3',
  'card-fan-1', 'card-fan-2',
  'card-shuffle',
  'chips-stack-1', 'chips-stack-2',
] as const;

type FileName = (typeof FILES)[number];

const buffers = new Map<FileName, AudioBuffer>();
let preloadStarted = false;

/** Fetch + decode all samples. Safe to call before the first user gesture —
 *  decoding works while the context is suspended. */
export function preloadSounds() {
  if (preloadStarted || typeof window === 'undefined') return;
  preloadStarted = true;
  const ctx = getContext();
  if (!ctx) return;
  const base = import.meta.env.BASE_URL ?? '/';
  for (const name of FILES) {
    fetch(`${base}sounds/${name}.m4a`)
      .then(r => r.arrayBuffer())
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => buffers.set(name, decoded))
      .catch(() => {/* missing/undecodable sample → synth fallback covers it */});
  }
}

interface VariantSpec {
  files: FileName[];
  gain: number;        // base volume 0..1
  pitchJitter: number; // ± fraction, e.g. 0.08 = ±8%
}

/** What each game event sounds like. */
const SAMPLE_MAP: Record<string, VariantSpec> = {
  select:  { files: ['card-slide-1', 'card-slide-2', 'card-slide-3'], gain: 0.4,  pitchJitter: 0.1 },
  play:    { files: ['card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'], gain: 0.75, pitchJitter: 0.07 },
  flip:    { files: ['card-slide-5', 'card-slide-6'], gain: 0.6,  pitchJitter: 0.08 },
  pickup:  { files: ['card-shove-1', 'card-shove-2', 'card-shove-3'], gain: 0.7,  pitchJitter: 0.06 },
  fan:     { files: ['card-fan-1', 'card-fan-2'], gain: 0.8,  pitchJitter: 0.05 },
  shuffle: { files: ['card-shuffle'], gain: 0.7,  pitchJitter: 0.03 },
  chips:   { files: ['chips-stack-1', 'chips-stack-2'], gain: 0.6,  pitchJitter: 0.06 },
};

// Avoid playing the same variant twice in a row
const lastVariant = new Map<string, number>();

function playSample(key: keyof typeof SAMPLE_MAP, opts?: { gainScale?: number; rate?: number; delayMs?: number }): boolean {
  const ctx = getContext();
  if (!ctx) return false;
  const spec = SAMPLE_MAP[key];

  let idx = Math.floor(Math.random() * spec.files.length);
  if (spec.files.length > 1 && idx === lastVariant.get(key)) {
    idx = (idx + 1) % spec.files.length;
  }
  lastVariant.set(key, idx);

  const buffer = buffers.get(spec.files[idx]);
  if (!buffer) return false; // not decoded yet → caller falls back to synth

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const jitter = 1 + (Math.random() * 2 - 1) * spec.pitchJitter;
  src.playbackRate.value = (opts?.rate ?? 1) * jitter;

  const gain = ctx.createGain();
  const volJitter = 1 + (Math.random() * 2 - 1) * 0.15;
  gain.gain.value = spec.gain * (opts?.gainScale ?? 1) * volJitter;

  src.connect(gain);
  gain.connect(out());
  src.start(ctx.currentTime + (opts?.delayMs ?? 0) / 1000);
  return true;
}

/* ------------------------------------------------------------------ */
/* Synth fallback (only while samples load, plus the error thud)      */
/* ------------------------------------------------------------------ */

function playTone({
  frequency,
  type = 'sine',
  duration = 0.08,
  volume = 0.25,
  attack = 0.002,
  decay = 0.06,
  pitchBend = 0,
}: {
  frequency: number;
  type?: OscillatorType;
  duration?: number;
  volume?: number;
  attack?: number;
  decay?: number;
  pitchBend?: number;
}) {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = type;
  osc.frequency.value = frequency;
  filter.type = 'lowpass';
  filter.frequency.value = 1800;

  const now = ctx.currentTime;
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.linearRampToValueAtTime(0.0001, now + duration + decay);

  if (pitchBend !== 0) {
    osc.frequency.linearRampToValueAtTime(frequency + pitchBend, now + duration * 0.7);
  }

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out());

  osc.start(now);
  osc.stop(now + duration + decay + 0.05);
}

function noiseBurst(duration = 0.18, volume = 0.2, filterFreq = 1800) {
  const ctx = getContext();
  if (!ctx) return;

  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.4;

  const gain = ctx.createGain();
  gain.gain.value = volume;
  gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(out());
  noise.start();
}

/** Soft paper-ish synth stand-ins, used only until samples finish decoding. */
function synthFallback(name: SoundName) {
  switch (name) {
    case 'tap':
    case 'select':
      noiseBurst(0.04, 0.1, 2400);
      break;
    case 'play':
      noiseBurst(0.07, 0.16, 1500);
      playTone({ frequency: 170, duration: 0.05, volume: 0.1 });
      break;
    case 'flip':
    case 'pickup':
      noiseBurst(0.09, 0.14, 1200);
      break;
    case 'shuffle':
      noiseBurst(0.25, 0.12, 1600);
      break;
    case 'swipe':
    case 'sweepCelebration':
      noiseBurst(0.3, 0.18, 900);
      playTone({ frequency: 100, duration: 0.3, volume: 0.2, decay: 0.18 });
      break;
    case 'burn':
      noiseBurst(0.22, 0.2, 1650);
      break;
    default:
      noiseBurst(0.05, 0.1, 1800);
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export type SoundName =
  | 'tap'
  | 'select'
  | 'play'
  | 'swipe'
  | 'burn'
  | 'error'
  | 'flip'
  | 'pickup'
  | 'shuffle'
  | 'sweepCelebration';

export function playSound(name: SoundName) {
  if (muted) return;
  preloadSounds(); // no-op after first call
  try {
    switch (name) {
      case 'tap':
      case 'select':
        if (!playSample('select')) synthFallback('select');
        break;

      case 'play':
        if (!playSample('play')) synthFallback('play');
        break;

      case 'flip':
        if (!playSample('flip')) synthFallback('flip');
        break;

      case 'pickup':
        if (!playSample('pickup')) synthFallback('pickup');
        break;

      case 'shuffle':
        if (!playSample('shuffle')) synthFallback('shuffle');
        break;

      case 'swipe':
        // Card fan + a low felt thump underneath
        if (playSample('fan')) {
          playTone({ frequency: 90, duration: 0.25, volume: 0.16, decay: 0.16 });
        } else {
          synthFallback('swipe');
        }
        break;

      case 'burn':
        // Fan played fast + bright sizzle = the 10 going up in flames
        if (playSample('fan', { rate: 1.25, gainScale: 0.9 })) {
          noiseBurst(0.18, 0.12, 2200);
        } else {
          synthFallback('burn');
        }
        break;

      case 'sweepCelebration':
        // Round end: chips hitting the table over a card fan
        if (!playSample('fan', { gainScale: 0.7 })) synthFallback('swipe');
        playSample('chips', { delayMs: 140 });
        playSample('chips', { delayMs: 320, gainScale: 0.7 });
        break;

      case 'error':
        // Deliberately dull, quiet double-thud — never a buzzer
        playTone({ frequency: 130, type: 'sine', duration: 0.05, volume: 0.12 });
        setTimeout(() => playTone({ frequency: 110, type: 'sine', duration: 0.06, volume: 0.1 }), 70);
        break;

      default:
        synthFallback(name);
    }
  } catch {
    // Sounds are non-critical
  }
}

/* ------------------------------------------------------------------ */
/* Haptics                                                            */
/* ------------------------------------------------------------------ */

/**
 * Haptic feedback. On iOS/Android (Capacitor) this is real Taptic feedback —
 * navigator.vibrate is a no-op inside WKWebView. On the web it falls back to
 * the Vibration API where supported.
 *
 * Pattern → intensity mapping: short numbers are light taps, longer ones
 * heavier; multi-part patterns (celebrations, errors) become notification
 * or medium impacts.
 */
export function haptic(pattern: number | number[]) {
  if (isNative) {
    try {
      if (Array.isArray(pattern)) {
        const total = pattern.reduce((a, b) => a + b, 0);
        if (total >= 120) {
          void Haptics.notification({ type: NotificationType.Success });
        } else {
          void Haptics.impact({ style: ImpactStyle.Medium });
        }
      } else if (pattern <= 15) {
        void Haptics.impact({ style: ImpactStyle.Light });
      } else if (pattern <= 30) {
        void Haptics.impact({ style: ImpactStyle.Medium });
      } else {
        void Haptics.impact({ style: ImpactStyle.Heavy });
      }
    } catch {}
    return;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}
