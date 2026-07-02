export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;       // unique id for React keys & animation tracking
  rank: Rank;
  suit: Suit;
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean;
  hand: Card[];
  faceUp: (Card | null)[];   // length 4; null when card has been played
  faceDown: (Card | null)[]; // length 4; null when card has been played
}

export type Phase = 'menu' | 'playing' | 'roundEnd' | 'gameOver';

export type CardSource =
  | { kind: 'hand' }
  | { kind: 'faceUp'; slot: number }
  | { kind: 'faceDown'; slot: number };

export interface SelectedCard {
  card: Card;
  source: CardSource;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  pile: Card[];                  // top of pile is last element
  currentPlayerIdx: number;
  startingPlayerIdx: number;
  scores: number[];              // cumulative across rounds, index aligned w/ players
  targetScore: 100 | 200 | 300;
  difficulty: 'easy' | 'medium' | 'hard';
  roundNumber: number;
  log: string[];                 // recent action narration (newest first)
  pendingFaceDown: { playerIdx: number; slot: number; card: Card } | null;
  // when a face-down was just flipped and player may chain matches from hand
  // (or auto-resolves if no chain possible)
  winnerIdxThisRound: number | null;
  gameWinnerIdx: number | null;
}
