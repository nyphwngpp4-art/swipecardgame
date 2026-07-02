/**
 * Save/resume for in-progress games.
 *
 * localStorage is the v1 backend — inside a Capacitor iOS app, swap the three
 * storage calls for @capacitor/preferences, which survives OS storage eviction.
 */
import type { GameState } from '../game/types';
import { DEFAULT_RULES } from '../game/rules';

const KEY = 'swipe-saved-game';
const VERSION = 1;

interface SaveEnvelope {
  version: number;
  savedAt: number;
  state: GameState;
}

/** Phases worth resuming into. 'gameOver' saves are cleared, never restored. */
const RESUMABLE_PHASES = new Set<GameState['phase']>(['playing', 'roundEnd']);

export function saveGame(state: GameState): void {
  try {
    const env: SaveEnvelope = { version: VERSION, savedAt: Date.now(), state };
    localStorage.setItem(KEY, JSON.stringify(env));
  } catch {
    // Storage full or unavailable — saving is best-effort
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Returns a validated saved game, or null. Corrupt/stale saves self-delete. */
export function loadSavedGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as SaveEnvelope;
    if (env.version !== VERSION) {
      clearSavedGame();
      return null;
    }
    const s = env.state;
    const valid =
      s &&
      RESUMABLE_PHASES.has(s.phase) &&
      Array.isArray(s.players) &&
      s.players.length >= 2 &&
      s.players.some(p => p.isHuman) &&
      Array.isArray(s.pile) &&
      Array.isArray(s.scores) &&
      s.scores.length === s.players.length &&
      typeof s.currentPlayerIdx === 'number' &&
      s.players[s.currentPlayerIdx] !== undefined;
    if (!valid) {
      clearSavedGame();
      return null;
    }
    // Saves from before house rules existed default to the standard rules
    if (!s.rules) s.rules = DEFAULT_RULES;
    return s;
  } catch {
    clearSavedGame();
    return null;
  }
}
