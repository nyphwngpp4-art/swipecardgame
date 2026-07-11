export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  hand: Card[];
  faceUp: (Card | null)[];
  faceDown: (Card | null)[];
}

export type Phase = 'menu' | 'playing' | 'roundEnd' | 'gameOver';
export type GameMode = 'standard' | 'practice' | 'daily';

export type CardSource =
  | { kind: 'hand' }
  | { kind: 'faceUp'; slot: number }
  | { kind: 'faceDown'; slot: number };

export interface SelectedCard {
  card: Card;
  source: CardSource;
}

export interface HouseRules {
  twosReset: boolean;
  tenBurns: boolean;
  fourOfAKindSwipes: boolean;
}

export interface GameMetrics {
  burns: number[];
  swipes: number[];
  pickups: number[];
  voluntaryEats: number[];
  faceDownSuccesses: number[];
  faceDownFailures: number[];
  cleanRoundEligible: boolean[];
  /** Rounds each player has won; optional on saves from before it existed. */
  roundsWon?: number[];
  /** Rounds won without ever taking the pile that round. */
  cleanRoundWins?: number[];
  largestDeficit: number;
}

/** Structured record of what an engine action did — the source of truth for
 *  metrics and sound feedback, instead of parsing narration log strings. */
export interface GameEvent {
  type:
    | 'play'
    | 'burn'
    | 'swipe'
    | 'pickup'
    | 'eat'
    | 'reset'
    | 'flip'
    | 'faceDownSuccess'
    | 'faceDownFailure'
    | 'roundEnd';
  playerIdx: number;
}

export interface GameState {
  phase: Phase;
  rules: HouseRules;
  players: Player[];
  pile: Card[];
  currentPlayerIdx: number;
  startingPlayerIdx: number;
  scores: number[];
  targetScore: 100 | 200 | 300;
  difficulty: 'easy' | 'medium' | 'hard';
  roundNumber: number;
  log: string[];
  pendingFaceDown: { playerIdx: number; slot: number; card: Card } | null;
  winnerIdxThisRound: number | null;
  gameWinnerIdx: number | null;
  /** Optional for compatibility with version-1 saves. */
  mode?: GameMode;
  seed?: string;
  metrics?: GameMetrics;
  /** Events produced by the most recent engine action (replaced, not appended). */
  events?: GameEvent[];
  /** Monotonic count of committed actions — seeds per-turn AI randomness so
   *  repeated board states never replay identical CPU decisions. */
  turnCount?: number;
}
