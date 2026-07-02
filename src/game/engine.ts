import type { Card, GameState, HouseRules, Player, SelectedCard } from './types';
import { deal, handSort } from './deck';
import {
  compareValue,
  DEFAULT_RULES,
  extractMatchingFromPile,
  hasAnyLegalLowerPlay,
  isEqualOrLower,
  isFourOfAKindOnTop,
  isTen,
  scoreValue,
  topOfPile,
  validateMultiPlay,
} from './rules';

/* ------------------------------------------------------------------ */
/* Setup                                                              */
/* ------------------------------------------------------------------ */

export interface NewGameOptions {
  numPlayers: number;
  humanCount: number;
  targetScore: 100 | 200 | 300;
  difficulty?: 'easy' | 'medium' | 'hard';
  rules?: HouseRules;
}

function leadLine(name: string): string {
  return name === 'You' ? 'you lead.' : `${name} leads.`;
}

export function newGame(opts: NewGameOptions): GameState {
  const players = deal({ numPlayers: opts.numPlayers, humanCount: opts.humanCount });
  const startingPlayerIdx = Math.floor(Math.random() * players.length);
  return {
    phase: 'playing',
    rules: opts.rules ?? DEFAULT_RULES,
    players,
    pile: [],
    currentPlayerIdx: startingPlayerIdx,
    startingPlayerIdx,
    scores: players.map(() => 0),
    targetScore: opts.targetScore,
    difficulty: opts.difficulty || 'medium',
    roundNumber: 1,
    log: [`Round 1 — ${leadLine(players[startingPlayerIdx].name)}`],
    pendingFaceDown: null,
    winnerIdxThisRound: null,
    gameWinnerIdx: null,
  };
}

/** Start the next round. Out-player from previous round leads. */
export function nextRound(state: GameState): GameState {
  const numPlayers = state.players.length;
  const humanCount = state.players.filter(p => p.isHuman).length;
  const players = deal({ numPlayers, humanCount });
  // Preserve names so "Player 2" stays "Player 2"
  players.forEach((p, i) => { p.name = state.players[i].name; });

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
    // difficulty carried over from ...state
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function clonePlayer(p: Player): Player {
  return {
    ...p,
    hand: [...p.hand],
    faceUp: [...p.faceUp],
    faceDown: [...p.faceDown],
  };
}

function logPush(state: GameState, line: string): GameState {
  return { ...state, log: [line, ...state.log].slice(0, 12) };
}

/** Player's "live" cards available to play this turn (hand if any, else face-up). */
export function activeTier(player: Player): 'hand' | 'faceUp' | 'faceDown' {
  if (player.hand.length > 0) return 'hand';
  if (player.faceUp.some(c => c !== null)) return 'faceUp';
  return 'faceDown';
}

/** Cards usable from the active tier (face-up filtered to non-null). */
export function activeCards(player: Player): Card[] {
  const tier = activeTier(player);
  if (tier === 'hand') return player.hand;
  if (tier === 'faceUp') return player.faceUp.filter((c): c is Card => c !== null);
  return [];
}

/** Total cards remaining for a player. */
export function totalCards(p: Player): number {
  return p.hand.length + p.faceUp.filter(Boolean).length + p.faceDown.filter(Boolean).length;
}

/** True if the player has won the round (no cards anywhere). */
export function hasNoCards(p: Player): boolean {
  return totalCards(p) === 0;
}

/** True if the player can choose to play voluntarily from hand or face-up.
 *  Only false when they must flip face-down (hand and face-up empty). */
export function mustFlipFaceDown(p: Player): boolean {
  return p.hand.length === 0 && p.faceUp.every(c => c === null);
}

function nextPlayerIdx(state: GameState): number {
  const n = state.players.length;
  let i = (state.currentPlayerIdx + 1) % n;
  // Skip players who've gone out (totalCards === 0). Shouldn't happen mid-round
  // since round ends on first out, but defensive:
  let safety = n;
  while (hasNoCards(state.players[i]) && safety-- > 0) {
    i = (i + 1) % n;
  }
  return i;
}

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

export type PlayResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };

/**
 * Play a set of selected cards from current player.
 * Selected cards may come from hand and/or face-up; all must be same rank.
 * Handles: normal play, multi-card play, 10 burn, 4-of-a-kind swipe, "must play higher + pickup".
 */
export function playCards(state: GameState, selected: SelectedCard[]): PlayResult {
  if (state.phase !== 'playing') return { ok: false, reason: 'Game not in playing phase.' };
  if (state.pendingFaceDown) return { ok: false, reason: 'Resolve face-down first.' };

  const player = state.players[state.currentPlayerIdx];
  const cards = selected.map(s => s.card);

  // Validate source: cards must come from the active tier.
  const tier = activeTier(player);
  if (tier === 'faceDown') {
    return { ok: false, reason: 'You must flip a face-down card.' };
  }
  for (const sel of selected) {
    if (tier === 'hand' && sel.source.kind !== 'hand') {
      // When hand has cards, you cannot play face-up cards yet.
      // Exception: same-rank multi-card from hand+faceUp is allowed in some house rules,
      // but per Jay's spec, hand and face-up are interchangeable (the example was 2 hand kings + 1 face-up king at round start when hand is full).
      // So we permit mixed hand+faceUp plays.
    }
    if (sel.source.kind === 'faceDown') {
      return { ok: false, reason: 'Use Flip to play a face-down card.' };
    }
  }

  // Validate: same rank, sane quantity.
  const top = topOfPile(state.pile);
  const v = validateMultiPlay(cards, top, state.pile, state.rules);
  if (!v.ok) return { ok: false, reason: v.reason };

  // Determine play type.
  const burns = state.rules.tenBurns && isTen(cards[0]);
  const playingHigher = top !== null && !burns && !isEqualOrLower(cards[0], top, state.rules);

  if (playingHigher) {
    // Must only play higher when no equal-or-lower option exists in the active set.
    const available = tier === 'hand'
      ? [...player.hand, ...player.faceUp.filter((c): c is Card => c !== null)]
      : player.faceUp.filter((c): c is Card => c !== null);
    if (hasAnyLegalLowerPlay(available, top, state.rules)) {
      return {
        ok: false,
        reason: 'You have a card equal-or-lower; you must play that instead.',
      };
    }
  }

  // Apply: remove selected cards from player, add to pile.
  const newPlayer = clonePlayer(player);
  for (const sel of selected) {
    if (sel.source.kind === 'hand') {
      const idx = newPlayer.hand.findIndex(c => c.id === sel.card.id);
      if (idx >= 0) newPlayer.hand.splice(idx, 1);
    } else if (sel.source.kind === 'faceUp') {
      newPlayer.faceUp[sel.source.slot] = null;
    }
  }
  let newPile = [...state.pile, ...cards];

  let nextState: GameState = {
    ...state,
    players: state.players.map((p, i) => i === state.currentPlayerIdx ? newPlayer : p),
    pile: newPile,
  };

  // Narrate
  const cardLabel = cards.length === 1
    ? `${cards[0].rank}${cards[0].suit}`
    : `${cards.length}× ${cards[0].rank}`;
  nextState = logPush(nextState, `${player.name} played ${cardLabel}.`);
  if (state.rules.twosReset && cards[0].rank === '2' && !playingHigher) {
    nextState = logPush(nextState, `↺ 2 resets the pile — anything can be played.`);
  }

  // Pickup-on-higher mechanic: pile beneath played cards goes to player's hand,
  // BUT any cards in the pile matching the played rank stay on the new pile.
  // (e.g., play a 9 over a King → if there's already a 9 in the pile, both 9s
  //  remain as the new pile; only the non-matching cards are picked up.)
  if (playingHigher) {
    const playedRank = cards[0].rank;
    const { kept, pickedUp } = extractMatchingFromPile(state.pile, playedRank);
    newPlayer.hand = [...newPlayer.hand, ...pickedUp].sort(handSort);
    newPile = [...kept, ...cards]; // matching extracted goes under the played cards
    nextState = {
      ...nextState,
      players: nextState.players.map((p, i) => i === state.currentPlayerIdx ? newPlayer : p),
      pile: newPile,
    };
    const keptLabel = kept.length > 0
      ? ` (kept ${kept.length} matching ${playedRank}${kept.length === 1 ? '' : 's'} on pile)`
      : '';
    nextState = logPush(
      nextState,
      `${player.name} picked up ${pickedUp.length} card${pickedUp.length === 1 ? '' : 's'}${keptLabel}.`
    );
  }

  return { ok: true, state: resolvePileAndAdvance(nextState, state.currentPlayerIdx, playingHigher) };
}

/**
 * After a play, check for win, 10 burn, 4-of-a-kind swipe.
 * Advances current player if appropriate.
 */
function resolvePileAndAdvance(
  state: GameState,
  actingPlayerIdx: number,
  forcedHigherPickup: boolean
): GameState {
  let s = state;

  // Check win condition first (player emptied all cards).
  const acting = s.players[actingPlayerIdx];
  if (hasNoCards(acting)) {
    return endRound(s, actingPlayerIdx);
  }

  // 10 burn
  const top = topOfPile(s.pile);
  if (s.rules.tenBurns && top && isTen(top)) {
    s = { ...s, pile: [] };
    s = logPush(s, `🔥 Pile burned by 10.`);
    // Same player goes again.
    s = { ...s, currentPlayerIdx: actingPlayerIdx };
    return s;
  }

  // 4-of-a-kind swipe
  if (s.rules.fourOfAKindSwipes && isFourOfAKindOnTop(s.pile)) {
    s = { ...s, pile: [] };
    s = logPush(s, `🌀 Four of a kind — pile swiped.`);
    s = { ...s, currentPlayerIdx: actingPlayerIdx };
    return s;
  }

  // If they played higher and picked up, turn passes (they didn't really get a clean play).
  // Otherwise advance normally.
  if (forcedHigherPickup) {
    return { ...s, currentPlayerIdx: nextPlayerIdx(s) };
  }
  return { ...s, currentPlayerIdx: nextPlayerIdx(s) };
}

/* ------------------------------------------------------------------ */
/* Face-down flow                                                     */
/* ------------------------------------------------------------------ */

/**
 * Flip a face-down card. Sets pendingFaceDown so player can optionally chain
 * matching-rank cards from hand before resolution.
 */
export function flipFaceDown(state: GameState, slot: number): PlayResult {
  if (state.phase !== 'playing') return { ok: false, reason: 'Not in playing phase.' };
  if (state.pendingFaceDown) return { ok: false, reason: 'Already a flipped card pending.' };

  const player = state.players[state.currentPlayerIdx];
  const card = player.faceDown[slot];
  if (!card) return { ok: false, reason: 'No card in that face-down slot.' };

  // Per rules: face-down may be flipped any turn the player has the option to play one,
  // i.e. when face-up slot above it is empty. (Hand may still be non-empty — they CHOOSE.)
  if (player.faceUp[slot] !== null) {
    return { ok: false, reason: 'Face-up card above this face-down must be played first.' };
  }

  return {
    ok: true,
    state: {
      ...state,
      pendingFaceDown: { playerIdx: state.currentPlayerIdx, slot, card },
      log: [`${player.name} flipped a face-down: ${card.rank}${card.suit}.`, ...state.log].slice(0, 12),
    },
  };
}

/**
 * Resolve a flipped face-down card with optional chain of same-rank cards from hand and/or face-up.
 * Chaining face-up cards of the rank helps clear them to unlock the face-down slots.
 */
export function resolveFaceDown(state: GameState, chain: SelectedCard[]): PlayResult {
  if (!state.pendingFaceDown) return { ok: false, reason: 'No face-down pending.' };
  if (state.currentPlayerIdx !== state.pendingFaceDown.playerIdx) {
    return { ok: false, reason: 'Wrong player.' };
  }
  const { card, slot } = state.pendingFaceDown;

  // Chain cards must all match face-down rank.
  for (const ch of chain) {
    if (ch.card.rank !== card.rank) return { ok: false, reason: 'Chain cards must match rank.' };
  }

  const player = state.players[state.currentPlayerIdx];
  const newPlayer = clonePlayer(player);
  newPlayer.faceDown[slot] = null;
  for (const ch of chain) {
    if (ch.source.kind === 'hand') {
      const idx = newPlayer.hand.findIndex(c => c.id === ch.card.id);
      if (idx >= 0) newPlayer.hand.splice(idx, 1);
      else return { ok: false, reason: 'Chain card not in hand.' };
    } else if (ch.source.kind === 'faceUp') {
      const s = ch.source.slot;
      if (newPlayer.faceUp[s] && newPlayer.faceUp[s].id === ch.card.id) {
        newPlayer.faceUp[s] = null;
      } else return { ok: false, reason: 'Chain card not in the specified face-up slot.' };
    } else {
      return { ok: false, reason: 'Invalid chain source.' };
    }
  }

  const allCards: Card[] = [card, ...chain.map(ch => ch.card)];
  const top = topOfPile(state.pile);
  const flipBurns = state.rules.tenBurns && isTen(card);
  const isHigher = top !== null && !flipBurns && !isEqualOrLower(card, top, state.rules);

  let newPile: Card[];
  let pickedUp: Card[] = [];
  let kept: Card[] = [];
  if (isHigher) {
    // Same extraction rule: matching ranks in the old pile stay on the new pile.
    const ext = extractMatchingFromPile(state.pile, card.rank);
    kept = ext.kept;
    pickedUp = ext.pickedUp;
    newPlayer.hand = [...newPlayer.hand, ...pickedUp].sort(handSort);
    newPile = [...kept, ...allCards];
  } else {
    newPile = [...state.pile, ...allCards];
  }

  let nextState: GameState = {
    ...state,
    players: state.players.map((p, i) => i === state.currentPlayerIdx ? newPlayer : p),
    pile: newPile,
    pendingFaceDown: null,
  };

  const chainLabel = chain.length > 0 ? ` + ${chain.length} matching` : '';
  if (isHigher) {
    const keptLabel = kept.length > 0
      ? ` (kept ${kept.length} matching ${card.rank}${kept.length === 1 ? '' : 's'} on pile)`
      : '';
    nextState = logPush(
      nextState,
      `${player.name} flipped ${card.rank}${chainLabel} — too high; picked up ${pickedUp.length}${keptLabel}.`
    );
  } else {
    nextState = logPush(nextState, `${player.name} flipped ${card.rank}${chainLabel}.`);
  }

  return { ok: true, state: resolvePileAndAdvance(nextState, state.currentPlayerIdx, isHigher) };
}

/** Cancel a pending face-down (only meaningful pre-resolve; here we always require resolve). */
export function cancelPendingFaceDown(state: GameState): GameState {
  // We do not allow cancellation per rules: once flipped, it's committed.
  return state;
}

/**
 * Voluntary "Eat the Pile" action.
 * Player takes the entire current pile into their hand (no extraction).
 * Turn does NOT advance — they get to play again immediately with the new cards.
 * This enables the powerful "pick up to set up a swipe" strategy.
 */
export function voluntaryEatPile(state: GameState): PlayResult {
  if (state.phase !== 'playing') return { ok: false, reason: 'Game not in playing phase.' };
  if (state.pendingFaceDown) return { ok: false, reason: 'Resolve the flipped card first.' };

  const player = state.players[state.currentPlayerIdx];
  const pileCards = [...state.pile];

  if (pileCards.length === 0) {
    return { ok: false, reason: 'The pile is already empty.' };
  }

  const newPlayer = clonePlayer(player);
  newPlayer.hand = [...newPlayer.hand, ...pileCards].sort(handSort);

  let nextState: GameState = {
    ...state,
    players: state.players.map((p, i) => i === state.currentPlayerIdx ? newPlayer : p),
    pile: [],
  };

  nextState = logPush(nextState, `${player.name} ate the pile (${pileCards.length} cards).`);

  // Player stays as current — they can play again (or flip face-downs) with the new hand.
  return { ok: true, state: nextState };
}

/* ------------------------------------------------------------------ */
/* Round / game end                                                   */
/* ------------------------------------------------------------------ */

function endRound(state: GameState, winnerIdx: number): GameState {
  // Compute scores for each player.
  const newScores = [...state.scores];
  state.players.forEach((p, i) => {
    if (i === winnerIdx) return; // 0 pts
    const remaining = [
      ...p.hand,
      ...p.faceUp.filter((c): c is Card => c !== null),
      ...p.faceDown.filter((c): c is Card => c !== null),
    ];
    const pts = remaining.reduce((sum, c) => sum + scoreValue(c), 0);
    newScores[i] += pts;
  });

  const gameOver = newScores.some(s => s >= state.targetScore);
  const phase: GameState['phase'] = gameOver ? 'gameOver' : 'roundEnd';
  const gameWinnerIdx = gameOver
    ? newScores.reduce((bestIdx, _, i, arr) => (arr[i] < arr[bestIdx] ? i : bestIdx), 0)
    : null;

  return {
    ...state,
    phase,
    scores: newScores,
    winnerIdxThisRound: winnerIdx,
    gameWinnerIdx,
    log: [
      `${state.players[winnerIdx].name} went out!`,
      ...state.log,
    ].slice(0, 12),
  };
}

/* ------------------------------------------------------------------ */
/* Diagnostics                                                        */
/* ------------------------------------------------------------------ */

/** Returns top card values to render comparison in UI. Pure utility. */
export function pileTop(state: GameState): Card | null {
  return topOfPile(state.pile);
}

/** Returns true if it's the human's turn (any human, primarily for hot-seat). */
export function isHumanTurn(state: GameState): boolean {
  return state.players[state.currentPlayerIdx]?.isHuman ?? false;
}

export { compareValue };
