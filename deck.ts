import type { Card, Rank, Suit, Player } from './types';

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function createDeck(numDecks: number): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        deck.push({ id: `${d}-${rank}${suit}-${Math.random().toString(36).slice(2, 7)}`, rank, suit });
      }
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface DealOptions {
  numPlayers: number;
  humanCount: number; // 1 = solo vs CPUs; can be more for hot-seat
}

export function deal({ numPlayers, humanCount }: DealOptions): Player[] {
  const cardsPerPlayer = 20;
  const totalCards = numPlayers * cardsPerPlayer;
  const numDecks = Math.ceil(totalCards / 52);
  const deck = shuffle(createDeck(numDecks));

  const players: Player[] = [];
  for (let i = 0; i < numPlayers; i++) {
    const player: Player = {
      id: i,
      name: i < humanCount ? (humanCount === 1 ? 'You' : `Player ${i + 1}`) : `CPU ${i - humanCount + 1}`,
      isHuman: i < humanCount,
      hand: [],
      faceUp: [],
      faceDown: [],
    };
    // Deal face-down first (4), then face-up (4), then hand (12)
    for (let j = 0; j < 4; j++) player.faceDown.push(deck.pop()!);
    for (let j = 0; j < 4; j++) player.faceUp.push(deck.pop()!);
    for (let j = 0; j < 12; j++) player.hand.push(deck.pop()!);
    // Sort hand on initial deal for human players (visual nicety)
    player.hand.sort(handSort);
    players.push(player);
  }
  return players;
}

import { compareValue } from './rules';

export function handSort(a: Card, b: Card): number {
  return compareValue(a) - compareValue(b);
}
