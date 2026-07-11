import type { GameState } from '../game/types';
import { DEFAULT_RULES } from '../game/rules';

const KEY = 'swipe-saved-game';
const VERSION = 2;

interface SaveEnvelope {
  version: number;
  savedAt: number;
  state: GameState;
}

const RESUMABLE_PHASES = new Set<GameState['phase']>(['playing', 'roundEnd']);

export function saveGame(state: GameState): void {
  try {
    const env: SaveEnvelope = { version: VERSION, savedAt: Date.now(), state };
    localStorage.setItem(KEY, JSON.stringify(env));
  } catch {}
}

export function clearSavedGame(): void {
  try { localStorage.removeItem(KEY); } catch {}
}

function isCardArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(card => card === null || (
    typeof card === 'object' && card !== null &&
    typeof (card as { id?: unknown }).id === 'string' &&
    typeof (card as { rank?: unknown }).rank === 'string' &&
    typeof (card as { suit?: unknown }).suit === 'string'
  ));
}

export function loadSavedGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as SaveEnvelope;
    if (env.version !== VERSION || !env.state) {
      clearSavedGame();
      return null;
    }
    const s = env.state;
    const validPlayers = Array.isArray(s.players) && s.players.length >= 2 && s.players.every(player =>
      typeof player?.id === 'number' &&
      typeof player?.name === 'string' &&
      typeof player?.isHuman === 'boolean' &&
      isCardArray(player?.hand) && isCardArray(player?.faceUp) && isCardArray(player?.faceDown)
    );
    const valid =
      RESUMABLE_PHASES.has(s.phase) &&
      validPlayers &&
      s.players.some(p => p.isHuman) &&
      isCardArray(s.pile) &&
      Array.isArray(s.scores) &&
      s.scores.length === s.players.length &&
      typeof s.currentPlayerIdx === 'number' &&
      s.players[s.currentPlayerIdx] !== undefined &&
      typeof s.roundNumber === 'number' &&
      Array.isArray(s.log);
    if (!valid) {
      clearSavedGame();
      return null;
    }
    s.rules = s.rules ?? DEFAULT_RULES;
    s.mode = s.mode ?? 'standard';
    s.seed = s.seed ?? `legacy-${env.savedAt}`;
    return s;
  } catch {
    clearSavedGame();
    return null;
  }
}
