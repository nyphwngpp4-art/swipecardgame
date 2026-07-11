import type { Card, Rank, Suit, Player } from './types';
import { compareValue } from './rules';
import type { RNG } from '../lib/random';

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function createDeck(numDecks: number): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < numDecks; d++) {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        deck.push({ id: `${d}-${rank}${suit}`, rank, suit });
      }
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng: RNG = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface DealOptions {
  numPlayers: number;
  humanCount: number;
  rng?: RNG;
}

export function deal({ numPlayers, humanCount, rng = Math.random }: DealOptions): Player[] {
  const cardsPerPlayer = 20;
  const totalCards = numPlayers * cardsPerPlayer;
  const numDecks = Math.ceil(totalCards / 52);
  const deck = shuffle(createDeck(numDecks), rng);

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
    for (let j = 0; j < 4; j++) player.faceDown.push(deck.pop()!);
    for (let j = 0; j < 4; j++) player.faceUp.push(deck.pop()!);
    for (let j = 0; j < 12; j++) player.hand.push(deck.pop()!);
    player.hand.sort(handSort);
    players.push(player);
  }
  return players;
}

export function handSort(a: Card, b: Card): number {
  return compareValue(a) - compareValue(b);
}
