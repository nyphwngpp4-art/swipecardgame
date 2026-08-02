export type RNG = () => number;

/** Stable 32-bit hash for daily deals, tests, and deterministic CPU choices. */
export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32: compact, deterministic, and sufficient for game shuffles. */
export function createSeededRng(seed: string | number): RNG {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(prefix = 'game'): string {
  const entropy = `${Date.now()}-${Math.random()}-${performance.now?.() ?? 0}`;
  return `${prefix}-${hashString(entropy).toString(36)}`;
}
