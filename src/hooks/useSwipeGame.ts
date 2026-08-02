import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMetrics, GameState, SelectedCard } from '../game/types';
import {
  createMetrics,
  flipFaceDown,
  newGame,
  nextRound,
  playCards,
  resolveFaceDown,
  voluntaryEatPile,
  type NewGameOptions,
} from '../game/engine';
import { chooseAIMove } from '../game/ai';
import { explainRuleError } from '../game/guidance';
import { playSound, haptic } from '../lib/sound';
import { saveGame, clearSavedGame } from '../lib/persistence';
import { createSeededRng } from '../lib/random';
import { recordCompletedGame, recordGameStarted, type Achievement } from '../lib/progression';

export interface GameError {
  code: 'RULE_ERROR';
  message: string;
  suggestedCardIds: string[];
  nonce: number;
}

/** Fold the action's structured events into cumulative game metrics. */
function updateMetrics(prev: GameState, next: GameState): GameState {
  const count = next.players.length;
  const base = prev.metrics ?? createMetrics(count);
  const metrics: GameMetrics = {
    burns: [...base.burns],
    swipes: [...base.swipes],
    pickups: [...base.pickups],
    voluntaryEats: [...base.voluntaryEats],
    faceDownSuccesses: [...base.faceDownSuccesses],
    faceDownFailures: [...base.faceDownFailures],
    cleanRoundEligible: [...base.cleanRoundEligible],
    roundsWon: [...(base.roundsWon ?? Array(count).fill(0))],
    cleanRoundWins: [...(base.cleanRoundWins ?? Array(count).fill(0))],
    largestDeficit: base.largestDeficit,
  };
  for (const event of next.events ?? []) {
    const p = event.playerIdx;
    switch (event.type) {
      case 'burn': metrics.burns[p] = (metrics.burns[p] ?? 0) + 1; break;
      case 'swipe': metrics.swipes[p] = (metrics.swipes[p] ?? 0) + 1; break;
      case 'pickup':
        metrics.pickups[p] = (metrics.pickups[p] ?? 0) + 1;
        metrics.cleanRoundEligible[p] = false;
        break;
      case 'eat':
        metrics.voluntaryEats[p] = (metrics.voluntaryEats[p] ?? 0) + 1;
        metrics.pickups[p] = (metrics.pickups[p] ?? 0) + 1;
        metrics.cleanRoundEligible[p] = false;
        break;
      case 'faceDownSuccess': metrics.faceDownSuccesses[p] = (metrics.faceDownSuccesses[p] ?? 0) + 1; break;
      case 'faceDownFailure': metrics.faceDownFailures[p] = (metrics.faceDownFailures[p] ?? 0) + 1; break;
      case 'roundEnd':
        metrics.roundsWon![p] = (metrics.roundsWon![p] ?? 0) + 1;
        if (metrics.cleanRoundEligible[p]) {
          metrics.cleanRoundWins![p] = (metrics.cleanRoundWins![p] ?? 0) + 1;
        }
        break;
      default: break;
    }
  }
  const humanIdx = next.players.findIndex(player => player.isHuman);
  if (humanIdx >= 0) {
    const humanScore = next.scores[humanIdx] ?? 0;
    const bestOpponent = Math.min(...next.scores.filter((_, index) => index !== humanIdx));
    metrics.largestDeficit = Math.max(metrics.largestDeficit, humanScore - bestOpponent);
  }
  return { ...next, metrics };
}

function feedbackForTransition(prev: GameState, next: GameState) {
  if (prev.phase === 'playing' && next.phase !== 'playing') {
    playSound('sweepCelebration');
    haptic([60, 40, 80]);
    return;
  }
  if (prev.pile.length > 0 && next.pile.length === 0) {
    if ((next.events ?? []).some(event => event.type === 'burn')) {
      playSound('burn');
      haptic([30, 30, 50]);
    } else {
      playSound('swipe');
      haptic([40, 30, 60]);
    }
    return;
  }
  if (next.pile.length > prev.pile.length) {
    playSound('play');
    haptic(15);
    return;
  }
  if (next.pile.length < prev.pile.length) {
    playSound('pickup');
    haptic(25);
  }
}

export function useSwipeGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [lastError, setLastError] = useState<GameError | null>(null);
  const [aiThinkingIdx, setAiThinkingIdx] = useState<number | null>(null);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const errorNonce = useRef(0);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedGameSeed = useRef<string | null>(null);

  const raiseError = useCallback((reason: string, current?: GameState) => {
    errorNonce.current += 1;
    const humanIdx = current?.players.findIndex(player => player.isHuman) ?? -1;
    const detail = current && humanIdx >= 0
      ? explainRuleError(reason, current, humanIdx)
      : { message: reason, suggestedCardIds: [] };
    setLastError({ code: 'RULE_ERROR', ...detail, nonce: errorNonce.current });
    playSound('error');
    haptic([20, 30, 20]);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setLastError(null), 3600);
  }, []);

  const commit = useCallback((prev: GameState | null, rawNext: GameState, soundOverride?: 'flip') => {
    const next = prev ? updateMetrics(prev, rawNext) : rawNext;
    setLastError(null);
    if (soundOverride === 'flip') {
      playSound('flip');
      haptic(20);
    } else if (prev) {
      feedbackForTransition(prev, next);
    }
    setState(next);
  }, []);

  const startGame = useCallback((opts: NewGameOptions) => {
    setLastError(null);
    setNewAchievements([]);
    recordedGameSeed.current = null;
    recordGameStarted();
    playSound('shuffle');
    setState(newGame(opts));
  }, []);

  const startNextRound = useCallback(() => {
    playSound('shuffle');
    setState(current => current ? nextRound(current) : current);
  }, []);

  const resetToMenu = useCallback(() => {
    setLastError(null);
    setState(null);
  }, []);

  const resumeGame = useCallback((saved: GameState) => {
    setLastError(null);
    setState(saved);
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.phase === 'gameOver') {
      clearSavedGame();
      const identity = state.seed ?? `legacy-${state.roundNumber}-${state.scores.join('-')}`;
      if (recordedGameSeed.current !== identity) {
        recordedGameSeed.current = identity;
        const result = recordCompletedGame(state);
        setNewAchievements(result.unlocked);
      }
      return;
    }
    saveGame(state);
  }, [state]);

  const tryPlay = useCallback((selected: SelectedCard[]) => {
    setState(current => {
      if (!current) return current;
      const result = playCards(current, selected);
      if (!result.ok) {
        raiseError(result.reason, current);
        return current;
      }
      const next = updateMetrics(current, result.state);
      setLastError(null);
      feedbackForTransition(current, next);
      return next;
    });
  }, [raiseError]);

  const tryFlip = useCallback((slot: number) => {
    setState(current => {
      if (!current) return current;
      const result = flipFaceDown(current, slot);
      if (!result.ok) {
        raiseError(result.reason, current);
        return current;
      }
      setLastError(null);
      playSound('flip');
      haptic(20);
      const newState = result.state;
      const pending = newState.pendingFaceDown;
      if (pending && pending.playerIdx === newState.currentPlayerIdx) {
        const player = newState.players[newState.currentPlayerIdx];
        const hasMatches = player.hand.some(card => card.rank === pending.card.rank)
          || player.faceUp.some(card => card?.rank === pending.card.rank);
        if (!hasMatches) {
          const flippedId = pending.card.id;
          setTimeout(() => {
            setState(latest => {
              if (!latest || latest.pendingFaceDown?.card.id !== flippedId) return latest;
              const resolved = resolveFaceDown(latest, []);
              if (!resolved.ok) return latest;
              const next = updateMetrics(latest, resolved.state);
              feedbackForTransition(latest, next);
              return next;
            });
          }, 1100);
        }
      }
      return newState;
    });
  }, [raiseError]);

  const tryResolveFaceDown = useCallback((chain: SelectedCard[]) => {
    setState(current => {
      if (!current) return current;
      const result = resolveFaceDown(current, chain);
      if (!result.ok) {
        raiseError(result.reason, current);
        return current;
      }
      const next = updateMetrics(current, result.state);
      setLastError(null);
      feedbackForTransition(current, next);
      return next;
    });
  }, [raiseError]);

  const tryEatPile = useCallback(() => {
    setState(current => {
      if (!current) return current;
      const result = voluntaryEatPile(current);
      if (!result.ok) {
        raiseError(result.reason, current);
        return current;
      }
      const next = updateMetrics(current, result.state);
      setLastError(null);
      feedbackForTransition(current, next);
      return next;
    });
  }, [raiseError]);

  useEffect(() => {
    if (!state || state.phase !== 'playing') return;
    const current = state.players[state.currentPlayerIdx];
    if (current.isHuman) {
      setAiThinkingIdx(null);
      return;
    }
    setAiThinkingIdx(state.currentPlayerIdx);
    // Seeded by the monotonic action counter: replaying the same seed with the
    // same human moves is fully deterministic (daily deal), yet a board state
    // that recurs mid-game still gets fresh randomness — identical per-state
    // seeds would let CPU-vs-CPU eat/replay cycles repeat forever.
    const turnSeed = `${state.seed ?? 'legacy'}-turn-${state.turnCount ?? state.log.length}-${state.currentPlayerIdx}`;
    const rng = createSeededRng(turnSeed);
    const timer = setTimeout(() => {
      setAiThinkingIdx(null);
      const move = chooseAIMove(state, rng);
      if (move.type === 'play') {
        const result = playCards(state, move.selected);
        if (result.ok) commit(state, result.state);
        else console.warn('AI illegal play:', result.reason, move);
      } else if (move.type === 'flipFaceDown') {
        const result = flipFaceDown(state, move.slot);
        if (result.ok) commit(state, result.state, 'flip');
        else console.warn('AI illegal flip:', result.reason);
      } else if (move.type === 'eatPile') {
        const result = voluntaryEatPile(state);
        if (result.ok) commit(state, result.state);
        else console.warn('AI illegal eat:', result.reason);
      } else {
        const result = resolveFaceDown(state, move.chain);
        if (result.ok) commit(state, result.state);
        else console.warn('AI illegal resolve:', result.reason);
      }
    }, state.pendingFaceDown ? 1500 : 650 + rng() * 550);
    return () => clearTimeout(timer);
  }, [state, commit]);

  useEffect(() => () => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
  }, []);

  return {
    state,
    startGame,
    startNextRound,
    resetToMenu,
    resumeGame,
    tryPlay,
    tryFlip,
    tryResolveFaceDown,
    tryEatPile,
    lastError,
    aiThinkingIdx,
    newAchievements,
    clearNewAchievements: () => setNewAchievements([]),
  };
}
