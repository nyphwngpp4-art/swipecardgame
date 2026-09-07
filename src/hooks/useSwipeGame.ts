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

export function useSwipeGame({ paused = false, pace = 'relaxed' }: { paused?: boolean; pace?: 'relaxed' | 'regular' | 'quick' } = {}) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [state, setState] = useState<GameState | null>(null);
  const latest = useRef<GameState | null>(null);
  const [lastError, setLastError] = useState<GameError | null>(null);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [visible, setVisible] = useState(() => !document.hidden);
  const recordedGameSeed = useRef<string | null>(null);
  const errorNonce = useRef(0);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const publish = useCallback((next: GameState | null) => {
    latest.current = next;
    setState(next);
    setLastError(null);
  }, []);
  const commit = useCallback((prev: GameState, rawNext: GameState, flip = false) => {
    if (latest.current !== prev) return;
    const next = updateMetrics(prev, rawNext);
    publish(next);
    if (flip) { playSound('flip'); haptic(20); }
    else feedbackForTransition(prev, next);
  }, [publish]);
  const raiseError = useCallback((reason: string, current: GameState) => {
    const detail = explainRuleError(reason, current, current.currentPlayerIdx);
    setLastError({ code: 'RULE_ERROR', ...detail, nonce: ++errorNonce.current });
    playSound('error');
  }, []);

  const startGame = useCallback((opts: NewGameOptions) => {
    setNewAchievements([]);
    recordedGameSeed.current = null;
    if (opts.mode !== 'practice') recordGameStarted();
    playSound('shuffle');
    publish(newGame(opts));
  }, [publish]);
  const startNextRound = useCallback(() => {
    const current = latest.current;
    if (!current || current.phase !== 'roundEnd') return;
    playSound('shuffle');
    publish(nextRound(current));
  }, [publish]);
  const resetToMenu = useCallback(() => publish(null), [publish]);
  const resumeGame = useCallback((saved: GameState) => publish(saved), [publish]);

  useEffect(() => {
    if (!state) return;
    if (state.phase === 'gameOver') {
      clearSavedGame();
      const identity = state.seed ?? `legacy-${state.roundNumber}-${state.scores.join('-')}`;
      if (recordedGameSeed.current !== identity && state.mode !== 'practice') {
        recordedGameSeed.current = identity;
        setNewAchievements(recordCompletedGame(state).unlocked);
      }
    } else saveGame(state);
  }, [state]);

  function humanAction(action: (current: GameState) => ReturnType<typeof playCards>, flip = false) {
    const current = latest.current;
    if (!current || pausedRef.current || document.hidden || current.phase !== 'playing' || !current.players[current.currentPlayerIdx].isHuman) return;
    const result = action(current);
    if (result.ok) commit(current, result.state, flip);
    else raiseError(result.reason, current);
  }

  useEffect(() => {
    if (!state || state.phase !== 'playing' || paused || !visible || state.players[state.currentPlayerIdx].isHuman) {
      return;
    }
    const turnSeed = `${state.seed ?? 'legacy'}-turn-${state.turnCount ?? state.log.length}-${state.currentPlayerIdx}`;
    const rng = createSeededRng(turnSeed);
    const delay = { relaxed: 2200, regular: 1300, quick: 600 }[pace];
    const timer = setTimeout(() => {
      if (latest.current !== state || pausedRef.current || document.hidden) return;
      const move = chooseAIMove(state, rng);
      const result = move.type === 'play' ? playCards(state, move.selected)
        : move.type === 'flipFaceDown' ? flipFaceDown(state, move.slot)
        : move.type === 'eatPile' ? voluntaryEatPile(state)
        : resolveFaceDown(state, move.chain);
      if (result.ok) commit(state, result.state, move.type === 'flipFaceDown');
      else console.warn('AI illegal move:', result.reason);
    }, delay);
    return () => clearTimeout(timer);
  }, [state, commit, paused, visible, pace]);

  return {
    state, startGame, startNextRound, resetToMenu, resumeGame,
    tryPlay: (selected: SelectedCard[]) => humanAction(current => playCards(current, selected)),
    tryFlip: (slot: number) => humanAction(current => flipFaceDown(current, slot), true),
    tryResolveFaceDown: (chain: SelectedCard[]) => humanAction(current => resolveFaceDown(current, chain)),
    tryEatPile: () => humanAction(voluntaryEatPile),
    lastError, newAchievements,
    clearNewAchievements: () => setNewAchievements([]),
  };
}
