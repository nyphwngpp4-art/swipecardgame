import type { Card, GameState, Player, Rank, SelectedCard } from './types';
import { activeTier, mustFlipFaceDown } from './engine';
import {
  compareValue,
  countSameRankOnTop,
  isEqualOrLower,
  isTen,
  scoreValue,
  topOfPile,
} from './rules';
import type { RNG } from '../lib/random';

export type AIMove =
  | { type: 'play'; selected: SelectedCard[] }
  | { type: 'flipFaceDown'; slot: number }
  | { type: 'resolveFaceDown'; chain: SelectedCard[] }
  | { type: 'eatPile' };

type Sourced = { card: Card; source: SelectedCard['source'] };

export function chooseAIMove(state: GameState, rng: RNG = Math.random): AIMove {
  const difficulty = state.difficulty || 'medium';
  const player = state.players[state.currentPlayerIdx];

  if (state.pendingFaceDown && state.pendingFaceDown.playerIdx === state.currentPlayerIdx) {
    const flipped = state.pendingFaceDown.card;
    return { type: 'resolveFaceDown', chain: buildFaceDownChain(player, flipped.rank, difficulty, rng) };
  }

  if (mustFlipFaceDown(player)) {
    return { type: 'flipFaceDown', slot: chooseFaceDownSlot(player, difficulty, rng) };
  }

  const rules = state.rules;
  const top = topOfPile(state.pile);
  const tier = activeTier(player);
  const pool = buildPool(player, tier);

  if (state.pile.length > 0 && shouldEatPile(state, player, pool, difficulty, rng)) {
    return { type: 'eatPile' };
  }

  const byRank = groupByRank(pool);

  function capForRank(rank: string): number {
    if (rules.tenBurns && rank === '10') return 1;
    if (rules.fourOfAKindSwipes && top && top.rank === rank) {
      const onTop = countSameRankOnTop(state.pile, top.rank);
      return Math.max(0, 4 - onTop);
    }
    return 4;
  }

  let legalLowerRanks: string[] = [];
  for (const [rank, items] of byRank) {
    if (rules.tenBurns && rank === '10') continue;
    if (isEqualOrLower(items[0].card, top, rules)) legalLowerRanks.push(rank);
  }

  if (rules.twosReset && legalLowerRanks.length > 1 && difficulty !== 'easy') {
    const withoutTwos = legalLowerRanks.filter(rank => rank !== '2');
    if (withoutTwos.length > 0) legalLowerRanks = withoutTwos;
  }

  if (legalLowerRanks.length > 0) {
    legalLowerRanks.sort((a, b) => scoreLegalRank(state, byRank, b, difficulty) - scoreLegalRank(state, byRank, a, difficulty));
    let chosen = legalLowerRanks[0];
    if (difficulty === 'easy' && legalLowerRanks.length > 1 && rng() < 0.45) {
      chosen = legalLowerRanks[Math.floor(rng() * legalLowerRanks.length)];
    }
    const cap = capForRank(chosen);
    const items = sortForPlay(byRank.get(chosen)!, difficulty);
    const take = difficulty === 'easy' && items.length > 1 && rng() < 0.25
      ? 1
      : Math.min(items.length, cap);
    return { type: 'play', selected: items.slice(0, take).map(s => ({ card: s.card, source: s.source })) };
  }

  if (rules.tenBurns) {
    const tens = pool.filter(s => isTen(s.card));
    if (tens.length > 0 && (difficulty !== 'easy' || rng() > 0.3)) {
      return { type: 'play', selected: [{ card: tens[0].card, source: tens[0].source }] };
    }
  }

  const allRanks = Array.from(byRank.keys());
  allRanks.sort((a, b) => scoreForcedRank(state, byRank, b, difficulty) - scoreForcedRank(state, byRank, a, difficulty));
  let chosen = allRanks[0];
  if (difficulty === 'easy' && allRanks.length > 1 && rng() < 0.4) {
    chosen = allRanks[Math.floor(rng() * allRanks.length)];
  }
  const cap = capForRank(chosen);
  const items = sortForPlay(byRank.get(chosen)!, difficulty);
  const take = Math.min(items.length, cap);
  return { type: 'play', selected: items.slice(0, take).map(s => ({ card: s.card, source: s.source })) };
}

function scoreLegalRank(
  state: GameState,
  byRank: Map<string, Sourced[]>,
  rank: string,
  difficulty: string,
): number {
  const items = byRank.get(rank)!;
  const sample = items[0].card;
  let score = items.length * 30 + compareValue(sample);
  if (items.some(item => item.source.kind === 'faceUp')) score += difficulty === 'hard' ? 28 : 14;
  if (state.rules.fourOfAKindSwipes) {
    const top = topOfPile(state.pile);
    if (top?.rank === rank) {
      const onTop = countSameRankOnTop(state.pile, top.rank);
      if (onTop + items.length >= 4) score += 180;
      else score += onTop * 18;
    }
  }
  if (difficulty === 'hard') {
    const nextIdx = (state.currentPlayerIdx + 1) % state.players.length;
    const nextCards = state.players[nextIdx].hand.length + state.players[nextIdx].faceUp.filter(Boolean).length + state.players[nextIdx].faceDown.filter(Boolean).length;
    if (nextCards <= 5) score += compareValue(sample) * 4;
    if (rank === 'A' || rank === '2') score -= 12;
  }
  return score;
}

function scoreForcedRank(
  state: GameState,
  byRank: Map<string, Sourced[]>,
  rank: string,
  difficulty: string,
): number {
  const cards = byRank.get(rank)!;
  const pileMatches = state.pile.filter(card => card.rank === rank).length;
  const canSwipe = pileMatches + Math.min(cards.length, 4) >= 4;
  let score = scoreValue(cards[0].card) * 12 + cards.length * 8 + pileMatches * 15;
  if (canSwipe) score += 120;
  if (difficulty === 'hard' && cards.some(card => card.source.kind === 'faceUp')) score += 25;
  return score;
}

function buildPool(player: Player, tier: ReturnType<typeof activeTier>): Sourced[] {
  const pool: Sourced[] = [];
  if (tier === 'hand') {
    player.hand.forEach(card => pool.push({ card, source: { kind: 'hand' } }));
    player.faceUp.forEach((card, slot) => {
      if (card) pool.push({ card, source: { kind: 'faceUp', slot } });
    });
  } else {
    player.faceUp.forEach((card, slot) => {
      if (card) pool.push({ card, source: { kind: 'faceUp', slot } });
    });
  }
  return pool;
}

function groupByRank(pool: Sourced[]): Map<string, Sourced[]> {
  const byRank = new Map<string, Sourced[]>();
  for (const item of pool) {
    const entries = byRank.get(item.card.rank) ?? [];
    entries.push(item);
    byRank.set(item.card.rank, entries);
  }
  return byRank;
}

function sortForPlay(items: Sourced[], difficulty: string): Sourced[] {
  if (difficulty === 'easy') return items;
  return [...items].sort((a, b) => Number(b.source.kind === 'faceUp') - Number(a.source.kind === 'faceUp'));
}

function buildFaceDownChain(player: Player, rank: Rank, difficulty: string, rng: RNG): SelectedCard[] {
  const chain: SelectedCard[] = [];
  player.faceUp.forEach((card, slot) => {
    if (card?.rank === rank) chain.push({ card, source: { kind: 'faceUp', slot } });
  });
  player.hand.filter(card => card.rank === rank).forEach(card => chain.push({ card, source: { kind: 'hand' } }));
  if (difficulty === 'easy' && chain.length > 1 && rng() < 0.35) return chain.slice(0, 1);
  return chain;
}

function chooseFaceDownSlot(player: Player, difficulty: string, rng: RNG): number {
  const slots = [0, 1, 2, 3].filter(index => player.faceDown[index] !== null && player.faceUp[index] === null);
  if (slots.length === 0) return 0;
  if (difficulty === 'easy') return slots[Math.floor(rng() * slots.length)];
  return slots[0];
}

function shouldEatPile(
  state: GameState,
  player: Player,
  pool: Sourced[],
  difficulty: string,
  rng: RNG,
): boolean {
  if (state.pile.length === 0 || !state.rules.fourOfAKindSwipes) return false;
  const heldCards = player.hand.length + player.faceUp.filter(Boolean).length;
  if (heldCards + state.pile.length > 28 && difficulty !== 'hard') return false;

  let bestScore = 0;
  const ranks = new Set<Rank>([...state.pile.map(card => card.rank), ...pool.map(item => item.card.rank)]);
  for (const rank of ranks) {
    if (rank === '10') continue;
    const pileCount = state.pile.filter(card => card.rank === rank).length;
    const poolCount = pool.filter(item => item.card.rank === rank).length;
    const total = pileCount + poolCount;
    if (total < 4 || poolCount < 1) continue;
    let score = total * 10 + pileCount;
    const top = topOfPile(state.pile);
    if (top?.rank === rank) {
      const onTop = countSameRankOnTop(state.pile, rank);
      score += onTop >= 3 ? 40 : onTop >= 2 ? 20 : 0;
    }
    bestScore = Math.max(bestScore, score);
  }

  if (bestScore === 0) return false;
  if (difficulty === 'easy') return rng() < 0.2;
  if (difficulty === 'medium') return bestScore >= 50 && rng() < 0.75;
  return bestScore >= 40 && rng() < 0.95;
}
