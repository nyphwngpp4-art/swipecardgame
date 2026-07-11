import type { GameMetrics, GameMode, GameState, HouseRules } from './types';
import { deal } from './deck';
import { DEFAULT_RULES } from './rules';
import { createSeededRng, randomSeed } from '../lib/random';

export interface GameSetupOptions {
  numPlayers: number;
  humanCount: number;
  targetScore: 100 | 200 | 300;
  difficulty?: 'easy' | 'medium' | 'hard';
  rules?: HouseRules;
  mode?: GameMode;
  seed?: string;
}

function metrics(count: number): GameMetrics {
  return {
    burns: Array(count).fill(0),
    swipes: Array(count).fill(0),
    pickups: Array(count).fill(0),
    voluntaryEats: Array(count).fill(0),
    faceDownSuccesses: Array(count).fill(0),
    faceDownFailures: Array(count).fill(0),
    cleanRoundEligible: Array(count).fill(true),
    largestDeficit: 0,
  };
}

function leadLine(name: string): string {
  return name === 'You' ? 'you lead.' : `${name} leads.`;
}

export function createGame(opts: GameSetupOptions): GameState {
  const seed = opts.seed ?? randomSeed(opts.mode ?? 'standard');
  const rng = createSeededRng(`${seed}-round-1`);
  const players = deal({ numPlayers: opts.numPlayers, humanCount: opts.humanCount, rng });
  const startingPlayerIdx = Math.floor(rng() * players.length);
  return {
    phase: 'playing',
    rules: opts.rules ?? DEFAULT_RULES,
    players,
    pile: [],
    currentPlayerIdx: startingPlayerIdx,
    startingPlayerIdx,
    scores: players.map(() => 0),
    targetScore: opts.targetScore,
    difficulty: opts.difficulty ?? 'medium',
    roundNumber: 1,
    log: [`Round 1 — ${leadLine(players[startingPlayerIdx].name)}`],
    pendingFaceDown: null,
    winnerIdxThisRound: null,
    gameWinnerIdx: null,
    mode: opts.mode ?? 'standard',
    seed,
    metrics: metrics(players.length),
  };
}

export function createNextRound(state: GameState): GameState {
  const humanCount = state.players.filter(p => p.isHuman).length;
  const seed = state.seed ?? randomSeed('legacy');
  const rng = createSeededRng(`${seed}-round-${state.roundNumber + 1}`);
  const players = deal({ numPlayers: state.players.length, humanCount, rng });
  players.forEach((player, index) => { player.name = state.players[index].name; });
  const startingPlayerIdx = state.winnerIdxThisRound ?? state.startingPlayerIdx;
  return {
    ...state,
    phase: 'playing',
    players,
    pile: [],
    currentPlayerIdx: startingPlayerIdx,
    startingPlayerIdx,
    roundNumber: state.roundNumber + 1,
    log: [`Round ${state.roundNumber + 1} — ${leadLine(players[startingPlayerIdx].name)}`],
    pendingFaceDown: null,
    winnerIdxThisRound: null,
    metrics: state.metrics ? {
      ...state.metrics,
      cleanRoundEligible: state.metrics.cleanRoundEligible.map(() => true),
    } : metrics(players.length),
  };
}
