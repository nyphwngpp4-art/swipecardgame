import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, SelectedCard } from '../game/types';
import {
  flipFaceDown,
  newGame,
  nextRound,
  playCards,
  resolveFaceDown,
  voluntaryEatPile,
  type NewGameOptions,
} from '../game/engine';
import { chooseAIMove } from '../game/ai';
import { playSound, haptic } from '../lib/sound';
import { saveGame, clearSavedGame } from '../lib/persistence';

export interface GameError {
  message: string;
  nonce: number; // changes every time, so identical messages still re-animate
}

/** Fire the right sound/haptic for a state transition. */
function feedbackForTransition(prev: GameState, next: GameState) {
  // Round / game end celebrations
  if (prev.phase === 'playing' && next.phase !== 'playing') {
    playSound('sweepCelebration');
    haptic([60, 40, 80]);
    return;
  }

  // Pile cleared → was it a burn (10) or a four-of-a-kind swipe?
  if (prev.pile.length > 0 && next.pile.length === 0) {
    const lastLine = next.log[0] ?? '';
    if (lastLine.includes('burned')) {
      playSound('burn');
      haptic([30, 30, 50]);
    } else {
      playSound('swipe');
      haptic([40, 30, 60]);
    }
    return;
  }

  // Pile grew → a normal play landed
  if (next.pile.length > prev.pile.length) {
    playSound('play');
    haptic(15);
    return;
  }

  // Pile shrank into a hand (pickup / eat)
  if (next.pile.length < prev.pile.length) {
    playSound('pickup');
    haptic(25);
  }
}

export function useSwipeGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [lastError, setLastError] = useState<GameError | null>(null);
  const [aiThinkingIdx, setAiThinkingIdx] = useState<number | null>(null);
  const errorNonce = useRef(0);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const raiseError = useCallback((message: string) => {
    errorNonce.current += 1;
    setLastError({ message, nonce: errorNonce.current });
    playSound('error');
    haptic([20, 30, 20]);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setLastError(null), 2800);
  }, []);

  const commit = useCallback((prev: GameState | null, next: GameState) => {
    setLastError(null);
    if (prev) feedbackForTransition(prev, next);
    setState(next);
  }, []);

  const startGame = useCallback((opts: NewGameOptions) => {
    setLastError(null);
    playSound('shuffle');
    setState(newGame(opts));
  }, []);

  const startNextRound = useCallback(() => {
    playSound('shuffle');
    setState(s => (s ? nextRound(s) : s));
  }, []);

  const resetToMenu = useCallback(() => {
    setLastError(null);
    setState(null);
  }, []);

  const resumeGame = useCallback((saved: GameState) => {
    setLastError(null);
    setState(saved);
  }, []);

  // Persist progress so an interrupted session can resume.
  // Going to the menu (state === null) keeps the save; finishing a game clears it.
  useEffect(() => {
    if (!state) return;
    if (state.phase === 'gameOver') {
      clearSavedGame();
      return;
    }
    saveGame(state);
  }, [state]);

  const tryPlay = useCallback((selected: SelectedCard[]) => {
    setState(s => {
      if (!s) return s;
      const r = playCards(s, selected);
      if (r.ok) {
        setLastError(null);
        feedbackForTransition(s, r.state);
        return r.state;
      }
      raiseError(r.reason);
      return s;
    });
  }, [raiseError]);

  const tryFlip = useCallback((slot: number) => {
    setState(s => {
      if (!s) return s;
      const r = flipFaceDown(s, slot);
      if (!r.ok) {
        raiseError(r.reason);
        return s;
      }
      setLastError(null);
      playSound('flip');
      haptic(20);

      // No chain possible → auto-resolve, but after a suspense beat so the
      // player actually witnesses the reveal before the verdict lands
      const newState = r.state;
      const pending = newState.pendingFaceDown;
      if (pending && pending.playerIdx === newState.currentPlayerIdx) {
        const player = newState.players[newState.currentPlayerIdx];
        const hasHandMatches = player.hand.some(c => c.rank === pending.card.rank);
        const hasFaceUpMatches = player.faceUp.some(c => c && c.rank === pending.card.rank);

        if (!hasHandMatches && !hasFaceUpMatches) {
          const flippedId = pending.card.id;
          setTimeout(() => {
            setState(cur => {
              // Only resolve if this exact flip is still pending (user may have confirmed)
              if (!cur || cur.pendingFaceDown?.card.id !== flippedId) return cur;
              const resolveResult = resolveFaceDown(cur, []);
              if (!resolveResult.ok) return cur;
              feedbackForTransition(cur, resolveResult.state);
              return resolveResult.state;
            });
          }, 1100);
        }
      }
      return newState;
    });
  }, [raiseError]);

  const tryResolveFaceDown = useCallback((chain: SelectedCard[]) => {
    setState(s => {
      if (!s) return s;
      const r = resolveFaceDown(s, chain);
      if (r.ok) {
        setLastError(null);
        feedbackForTransition(s, r.state);
        return r.state;
      }
      raiseError(r.reason);
      return s;
    });
  }, [raiseError]);

  const tryEatPile = useCallback(() => {
    setState(s => {
      if (!s) return s;
      const r = voluntaryEatPile(s);
      if (r.ok) {
        setLastError(null);
        feedbackForTransition(s, r.state);
        return r.state;
      }
      raiseError(r.reason);
      return s;
    });
  }, [raiseError]);

  // AI auto-play loop
  useEffect(() => {
    if (!state) return;
    if (state.phase !== 'playing') return;
    const current = state.players[state.currentPlayerIdx];
    if (current.isHuman) {
      setAiThinkingIdx(null);
      return;
    }

    setAiThinkingIdx(state.currentPlayerIdx);

    const t = setTimeout(() => {
      setAiThinkingIdx(null);
      const move = chooseAIMove(state);
      if (move.type === 'play') {
        const r = playCards(state, move.selected);
        if (r.ok) commit(state, r.state);
        else console.warn('AI illegal play:', r.reason, move);
      } else if (move.type === 'flipFaceDown') {
        const r = flipFaceDown(state, move.slot);
        if (r.ok) {
          playSound('flip');
          // Leave the flip pending — the next loop tick resolves it after the
          // reveal delay below, giving the blind flip its moment of suspense.
          setState(r.state);
        } else console.warn('AI illegal flip:', r.reason);
      } else if (move.type === 'eatPile') {
        const r = voluntaryEatPile(state);
        if (r.ok) commit(state, r.state);
        else console.warn('AI illegal eat:', r.reason);
      } else {
        const r = resolveFaceDown(state, move.chain);
        if (r.ok) commit(state, r.state);
        else console.warn('AI illegal resolve:', r.reason);
      }
    }, state.pendingFaceDown ? 1500 : 650 + Math.random() * 550);

    return () => clearTimeout(t);
  }, [state, commit]);

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
  };
}
