import type { Card, GameState, Rank, SelectedCard } from './types';
import { activeTier } from './engine';
import {
  cardsOfRank,
  compareValue,
  countSameRankOnTop,
  getLegalLowerRanks,
  isTen,
  maxPlayableOfRank,
  topOfPile,
} from './rules';

export interface GameHint {
  title: string;
  body: string;
  cardIds: string[];
  action: 'play' | 'burn' | 'swipe' | 'pickup' | 'flip' | 'wait';
}

function selectionsForRank(state: GameState, playerIdx: number, rank: Rank): SelectedCard[] {
  const player = state.players[playerIdx];
  const selected: SelectedCard[] = [];
  player.faceUp.forEach((card, slot) => {
    if (card?.rank === rank) selected.push({ card, source: { kind: 'faceUp', slot } });
  });
  player.hand.forEach(card => {
    if (card.rank === rank) selected.push({ card, source: { kind: 'hand' } });
  });
  const cap = maxPlayableOfRank(rank, state.pile, cardsOfRank(player, rank), state.rules);
  return selected.slice(0, cap);
}

export function getRecommendedMove(state: GameState, playerIdx: number): GameHint {
  const player = state.players[playerIdx];
  if (!player || state.phase !== 'playing') {
    return { title: 'Round complete', body: 'Review the scorecard, then continue.', cardIds: [], action: 'wait' };
  }
  if (state.currentPlayerIdx !== playerIdx) {
    return { title: 'Watch the table', body: 'Notice which ranks opponents are clearing and which special cards they spend.', cardIds: [], action: 'wait' };
  }
  if (state.pendingFaceDown?.playerIdx === playerIdx) {
    const rank = state.pendingFaceDown.card.rank;
    const matches = selectionsForRank(state, playerIdx, rank);
    return matches.length
      ? { title: `Chain your ${rank}s`, body: 'Add every matching hand or face-up card before confirming to thin your stack.', cardIds: matches.map(s => s.card.id), action: 'play' }
      : { title: 'Resolve the flip', body: 'No matching cards can be chained. Confirm the revealed card.', cardIds: [], action: 'flip' };
  }
  if (activeTier(player) === 'faceDown') {
    return { title: 'Choose a face-down card', body: 'Any unlocked face-down slot is a gamble. Pick one to reveal it.', cardIds: [], action: 'flip' };
  }

  const available: Card[] = [...player.hand, ...player.faceUp.filter((c): c is Card => c !== null)];
  const top = topOfPile(state.pile);

  if (state.rules.tenBurns) {
    const ten = available.find(isTen);
    if (ten && state.pile.length >= 4) {
      return { title: 'Burn the pile', body: 'A 10 clears this growing pile and gives you another turn.', cardIds: [ten.id], action: 'burn' };
    }
  }

  if (state.rules.fourOfAKindSwipes && top) {
    const onTop = countSameRankOnTop(state.pile, top.rank);
    const matching = selectionsForRank(state, playerIdx, top.rank);
    if (matching.length > 0 && onTop + matching.length >= 4) {
      const needed = Math.max(1, 4 - onTop);
      return { title: 'Complete the swipe', body: `Play ${needed} ${top.rank}${needed === 1 ? '' : 's'} to clear the pile and go again.`, cardIds: matching.slice(0, needed).map(s => s.card.id), action: 'swipe' };
    }
  }

  const legal = [...getLegalLowerRanks(available, top, state.rules)];
  if (legal.length > 0) {
    legal.sort((a, b) => {
      const aCards = selectionsForRank(state, playerIdx, a);
      const bCards = selectionsForRank(state, playerIdx, b);
      if (bCards.length !== aCards.length) return bCards.length - aCards.length;
      return compareValue(bCards[0].card) - compareValue(aCards[0].card);
    });
    const rank = legal[0];
    const picks = selectionsForRank(state, playerIdx, rank);
    return { title: `Play your ${rank}${picks.length > 1 ? 's' : ''}`, body: picks.length > 1 ? `You can clear ${picks.length} matching cards in one move.` : 'This is your strongest safe equal-or-lower play.', cardIds: picks.map(s => s.card.id), action: 'play' };
  }

  const ten = state.rules.tenBurns ? available.find(isTen) : undefined;
  if (ten) return { title: 'Use the 10', body: 'You have no safe lower play. Burn the pile instead of picking it up.', cardIds: [ten.id], action: 'burn' };

  const ranks = [...new Set(available.map(c => c.rank))].sort((a, b) => compareValue(available.find(c => c.rank === b)!) - compareValue(available.find(c => c.rank === a)!));
  const rank = ranks[0];
  const picks = selectionsForRank(state, playerIdx, rank);
  return { title: 'No safe play', body: `Dump your high ${rank}${picks.length > 1 ? 's' : ''} and take the pile, or voluntarily take it first if that creates a swipe.`, cardIds: picks.map(s => s.card.id), action: 'pickup' };
}

export function explainRuleError(reason: string, state: GameState, playerIdx: number): { message: string; suggestedCardIds: string[] } {
  if (reason.includes('equal-or-lower')) {
    const hint = getRecommendedMove(state, playerIdx);
    return { message: `${reason} Try the highlighted ${hint.title.toLowerCase()}.`, suggestedCardIds: hint.cardIds };
  }
  if (reason.includes('face-up card above')) {
    return { message: 'That face-down card is still covered. Play the face-up card in the same column first.', suggestedCardIds: [] };
  }
  if (reason.includes('same rank') || reason.includes('must all be')) {
    return { message: 'Multi-card plays must use one rank. Select only matching cards.', suggestedCardIds: [] };
  }
  return { message: reason, suggestedCardIds: [] };
}
