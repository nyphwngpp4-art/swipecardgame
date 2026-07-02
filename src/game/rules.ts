import type { Card, Rank } from './types';

/** Comparison value used for "equal-or-lower" play rule. 10 is special (burn), so undefined. */
const COMPARE: Record<Rank, number | null> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': null, // burn card — never sits as "top" for comparison purposes
  'J': 11, 'Q': 12, 'K': 13,
};

/** Score value at round end: A=1, 2-9=face, 10=20, J/Q/K=10. */
const SCORE: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 20,
  'J': 10, 'Q': 10, 'K': 10,
};

export function compareValue(c: Card): number {
  // 10s won't appear here in normal flow because they burn the pile,
  // but if asked, treat as 0 (lowest) for sort stability.
  return COMPARE[c.rank] ?? 0;
}

export function scoreValue(c: Card): number {
  return SCORE[c.rank];
}

export function isTen(c: Card): boolean {
  return c.rank === '10';
}

/** Top card of pile (or null if empty). */
export function topOfPile(pile: Card[]): Card | null {
  return pile.length === 0 ? null : pile[pile.length - 1];
}

/** Returns true if the given single card can legally be played as an EQUAL-OR-LOWER play. */
export function isEqualOrLower(card: Card, top: Card | null): boolean {
  if (top === null) return true;
  if (isTen(card)) return true; // 10 is always legal (burns)
  if (isTen(top)) return true;  // shouldn't happen, but safe default
  return compareValue(card) <= compareValue(top);
}

/** True if any card in the set could be played equal-or-lower onto the pile. */
export function hasAnyLegalLowerPlay(cards: Card[], top: Card | null): boolean {
  return cards.some(c => isEqualOrLower(c, top));
}

/** Validate a multi-card play: all same rank, and the rank itself is legal vs top. */
export function validateMultiPlay(
  cards: Card[],
  top: Card | null,
  pile: Card[]
): { ok: true } | { ok: false; reason: string } {
  if (cards.length === 0) return { ok: false, reason: 'No cards selected.' };
  const firstRank = cards[0].rank;
  if (!cards.every(c => c.rank === firstRank)) {
    return { ok: false, reason: 'Multi-card plays must all be the same rank.' };
  }
  // 10s: only one 10 plays at a time (it burns immediately).
  if (firstRank === '10' && cards.length > 1) {
    return { ok: false, reason: 'Only one 10 can be played at a time.' };
  }

  // Cap multi-card plays so total same-rank cards on top of pile do not exceed 4.
  // E.g. pile top is a 5; you may play up to 3 more 5s (totaling 4 → swipe).
  if (top && top.rank === firstRank && firstRank !== '10') {
    const sameRankOnTop = countSameRankOnTop(pile, firstRank);
    const maxAdditional = 4 - sameRankOnTop;
    if (cards.length > maxAdditional) {
      return {
        ok: false,
        reason: `Only ${maxAdditional} ${firstRank}${maxAdditional === 1 ? '' : 's'} needed to make four.`,
      };
    }
  } else if (cards.length > 4) {
    // Otherwise capped at 4 (anything beyond would be a no-op since 4-of-a-kind swipes)
    return { ok: false, reason: 'Maximum four of a kind in a single play.' };
  }

  return { ok: true };
}

/** All cards of a rank the player holds (face-up first, then hand). */
export function cardsOfRank(
  player: { hand: Card[]; faceUp: (Card | null)[] },
  rank: Rank,
): Card[] {
  return [
    ...player.faceUp.filter((c): c is Card => c !== null && c.rank === rank),
    ...player.hand.filter(c => c.rank === rank),
  ];
}

/**
 * Max cards of this rank the player may include in one play from their pool
 * (hand + face-up). Accounts for cards already on the pile top and the 4-of-a-kind cap.
 */
export function maxPlayableOfRank(rank: Rank, pile: Card[], availableOfRank: Card[]): number {
  const poolCount = availableOfRank.length;
  if (poolCount === 0) return 0;
  if (rank === '10') return 1;
  const top = topOfPile(pile);
  if (top && top.rank === rank) {
    const onTop = countSameRankOnTop(pile, rank);
    return Math.min(poolCount, Math.max(0, 4 - onTop));
  }
  return Math.min(poolCount, 4);
}

/** Counts how many cards on the very top of pile share the given rank. */
export function countSameRankOnTop(pile: Card[], rank: Rank): number {
  let count = 0;
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank === rank) count++;
    else break;
  }
  return count;
}

/** True if pile's top 4 cards are all the same rank. */
export function isFourOfAKindOnTop(pile: Card[]): boolean {
  if (pile.length < 4) return false;
  const top = pile[pile.length - 1];
  return countSameRankOnTop(pile, top.rank) >= 4;
}

/**
 * When a player picks up the pile, any cards in the pile matching the rank
 * they played stay behind to join the new pile. Returns { kept, pickedUp }.
 */
export function extractMatchingFromPile(pile: Card[], rank: Rank): {
  kept: Card[];
  pickedUp: Card[];
} {
  const kept: Card[] = [];
  const pickedUp: Card[] = [];
  for (const c of pile) {
    if (c.rank === rank) kept.push(c);
    else pickedUp.push(c);
  }
  return { kept, pickedUp };
}

/**
 * Returns the set of ranks that are currently legal to play as an equal-or-lower move
 * (excluding 10s, which are handled separately as always-legal burns).
 */
export function getLegalLowerRanks(available: Card[], top: Card | null): Set<Rank> {
  const ranks = new Set<Rank>();
  for (const c of available) {
    if (isTen(c)) continue;
    if (isEqualOrLower(c, top)) ranks.add(c.rank);
  }
  return ranks;
}
