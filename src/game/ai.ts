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

export type AIMove =
  | { type: 'play'; selected: SelectedCard[] }
  | { type: 'flipFaceDown'; slot: number }
  | { type: 'resolveFaceDown'; chain: SelectedCard[] }
  | { type: 'eatPile' };

type Sourced = { card: Card; source: SelectedCard['source'] };

/**
 * Choose AI move for the current player.
 * Strategy (heuristics, beatable but reasonable):
 *  - Eat the pile when it sets up a four-of-a-kind swipe.
 *  - Prefer equal-or-lower plays; save 10s for forced situations.
 *  - When forced higher: dump highest-scoring rank with most copies, or set up swipes.
 *  - Chain face-up cards before hand when resolving a flipped face-down.
 */
export function chooseAIMove(state: GameState): AIMove {
  const difficulty = state.difficulty || 'medium';
  const player = state.players[state.currentPlayerIdx];

  // Pending face-down: chain matching-rank cards from face-up (first) and hand.
  if (state.pendingFaceDown && state.pendingFaceDown.playerIdx === state.currentPlayerIdx) {
    const flipped = state.pendingFaceDown.card;
    return { type: 'resolveFaceDown', chain: buildFaceDownChain(player, flipped.rank, difficulty) };
  }

  // Must flip face-down?
  if (mustFlipFaceDown(player)) {
    return { type: 'flipFaceDown', slot: chooseFaceDownSlot(player, difficulty) };
  }

  const top = topOfPile(state.pile);
  const tier = activeTier(player);
  const pool = buildPool(player, tier);

  // Voluntary eat — set up a swipe before playing normally.
  if (state.pile.length > 0 && shouldEatPile(state, player, pool, difficulty)) {
    return { type: 'eatPile' };
  }

  const byRank = groupByRank(pool);

  function capForRank(rank: string): number {
    if (rank === '10') return 1;
    if (top && top.rank === rank) {
      const onTop = countSameRankOnTop(state.pile, top.rank);
      return Math.max(0, 4 - onTop);
    }
    return 4;
  }

  // 1) Equal-or-lower plays (excluding 10s — handle separately).
  const legalLowerRanks: string[] = [];
  for (const [rank, items] of byRank) {
    if (rank === '10') continue;
    const sample = items[0].card;
    if (isEqualOrLower(sample, top)) legalLowerRanks.push(rank);
  }

  if (legalLowerRanks.length > 0) {
    legalLowerRanks.sort((a, b) => {
      const ca = byRank.get(a)!.length;
      const cb = byRank.get(b)!.length;
      if (cb !== ca) return cb - ca;
      const va = compareValue(byRank.get(a)![0].card);
      const vb = compareValue(byRank.get(b)![0].card);
      return vb - va;
    });
    let chosen = legalLowerRanks[0];
    if (difficulty === 'easy' && legalLowerRanks.length > 1 && Math.random() < 0.4) {
      chosen = legalLowerRanks[Math.floor(Math.random() * legalLowerRanks.length)];
    }
    const cap = capForRank(chosen);
    const items = sortForPlay(byRank.get(chosen)!, difficulty);
    const take = Math.min(items.length, cap);
    const selected: SelectedCard[] = items.slice(0, take).map(s => ({ card: s.card, source: s.source }));
    return { type: 'play', selected };
  }

  // 2) No legal lower play. Consider playing a 10 if available.
  const tensInPool = pool.filter(s => isTen(s.card));
  if (tensInPool.length > 0) {
    const t = tensInPool[0];
    if (difficulty !== 'easy' || Math.random() > 0.3) {
      return { type: 'play', selected: [{ card: t.card, source: t.source }] };
    }
  }

  // 3) Forced higher + pickup.
  const allRanks = Array.from(byRank.keys());

  function pileMatchCount(rank: string): number {
    return state.pile.reduce((acc, c) => acc + (c.rank === rank ? 1 : 0), 0);
  }
  function playableCount(rank: string): number {
    return Math.min(byRank.get(rank)!.length, capForRank(rank));
  }

  allRanks.sort((a, b) => {
    const swipeScoreA = pileMatchCount(a) + playableCount(a) >= 4 ? 1 : 0;
    const swipeScoreB = pileMatchCount(b) + playableCount(b) >= 4 ? 1 : 0;
    if (swipeScoreA !== swipeScoreB) return swipeScoreB - swipeScoreA;

    const matchA = pileMatchCount(a);
    const matchB = pileMatchCount(b);
    if (matchA !== matchB) return matchB - matchA;

    const sa = scoreValue(byRank.get(a)![0].card);
    const sb = scoreValue(byRank.get(b)![0].card);
    if (sb !== sa) return sb - sa;
    const ca = byRank.get(a)!.length;
    const cb = byRank.get(b)!.length;
    if (cb !== ca) return cb - ca;
    return compareValue(byRank.get(b)![0].card) - compareValue(byRank.get(a)![0].card);
  });
  let chosen = allRanks[0];
  if (difficulty === 'easy' && allRanks.length > 1 && Math.random() < 0.35) {
    chosen = allRanks[Math.floor(Math.random() * allRanks.length)];
  }
  const cap = capForRank(chosen);
  const items = sortForPlay(byRank.get(chosen)!, difficulty);
  const take = Math.min(items.length, cap);
  const selected: SelectedCard[] = items.slice(0, take).map(s => ({ card: s.card, source: s.source }));
  return { type: 'play', selected };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildPool(player: Player, tier: ReturnType<typeof activeTier>): Sourced[] {
  const pool: Sourced[] = [];
  if (tier === 'hand') {
    player.hand.forEach(c => pool.push({ card: c, source: { kind: 'hand' } }));
    player.faceUp.forEach((c, i) => {
      if (c) pool.push({ card: c, source: { kind: 'faceUp', slot: i } });
    });
  } else {
    player.faceUp.forEach((c, i) => {
      if (c) pool.push({ card: c, source: { kind: 'faceUp', slot: i } });
    });
  }
  return pool;
}

function groupByRank(pool: Sourced[]): Map<string, Sourced[]> {
  const byRank = new Map<string, Sourced[]>();
  for (const s of pool) {
    const arr = byRank.get(s.card.rank) ?? [];
    arr.push(s);
    byRank.set(s.card.rank, arr);
  }
  return byRank;
}

/** Face-up first on hard/medium — clears slots and unlocks face-downs. */
function sortForPlay(items: Sourced[], difficulty: string): Sourced[] {
  if (difficulty !== 'hard' && difficulty !== 'medium') return items;
  return [...items].sort((a, b) => {
    const aIsFu = a.source.kind === 'faceUp' ? 1 : 0;
    const bIsFu = b.source.kind === 'faceUp' ? 1 : 0;
    return bIsFu - aIsFu;
  });
}

function buildFaceDownChain(player: Player, rank: Rank, difficulty: string): SelectedCard[] {
  const chain: SelectedCard[] = [];
  player.faceUp.forEach((c, slot) => {
    if (c && c.rank === rank) chain.push({ card: c, source: { kind: 'faceUp', slot } });
  });
  player.hand
    .filter(c => c.rank === rank)
    .forEach(c => chain.push({ card: c, source: { kind: 'hand' } }));

  if (difficulty === 'easy' && chain.length > 1 && Math.random() < 0.3) {
    return chain.slice(0, 1);
  }
  return chain;
}

function chooseFaceDownSlot(player: Player, difficulty: string): number {
  const slots = [0, 1, 2, 3].filter(i => player.faceDown[i] !== null && player.faceUp[i] === null);
  if (slots.length === 0) return 0;
  if (difficulty === 'easy') {
    return slots[Math.floor(Math.random() * slots.length)];
  }
  // Systematically clear left-to-right columns.
  return slots[0];
}

/**
 * Eat the pile when combined pile + hand/face-up copies of a rank reach four,
 * enabling an immediate swipe on the replayed turn.
 */
function shouldEatPile(
  state: GameState,
  player: Player,
  pool: Sourced[],
  difficulty: string,
): boolean {
  if (state.pile.length === 0) return false;

  const heldCards = player.hand.length + player.faceUp.filter(Boolean).length;
  if (heldCards + state.pile.length > 28 && difficulty !== 'hard') return false;

  let bestScore = 0;

  const ranks = new Set<Rank>([
    ...state.pile.map(c => c.rank),
    ...pool.map(s => s.card.rank),
  ]);

  for (const rank of ranks) {
    if (rank === '10') continue;
    const pileCount = state.pile.filter(c => c.rank === rank).length;
    const poolCount = pool.filter(s => s.card.rank === rank).length;
    const total = pileCount + poolCount;
    if (total < 4 || poolCount < 1) continue;

    let score = total * 10 + pileCount;
    const top = topOfPile(state.pile);
    if (top && top.rank === rank) {
      const onTop = countSameRankOnTop(state.pile, rank);
      if (onTop >= 3) score += 40;
      else if (onTop >= 2) score += 20;
    }
    bestScore = Math.max(bestScore, score);
  }

  if (bestScore === 0) return false;

  // Small refusal chance on all difficulties — deterministic eat/replay cycles
  // between AIs can otherwise repeat the same board state forever
  if (difficulty === 'easy') return Math.random() < 0.25;
  if (difficulty === 'medium') return bestScore >= 50 && Math.random() < 0.85;
  return bestScore >= 40 && Math.random() < 0.9;
}