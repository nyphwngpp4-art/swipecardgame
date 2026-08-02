import { useCallback, useEffect, useRef } from 'react';
import type { GameState, SelectedCard } from '../game/types';
import type { GameError } from '../hooks/useSwipeGame';
import type { Theme } from '../theme';
import { GameBoard } from './GameBoard';

interface Props {
  state: GameState;
  onPlay: (selected: SelectedCard[]) => void;
  onFlipFaceDown: (slot: number) => void;
  onResolveFaceDown: (chain: SelectedCard[]) => void;
  lastError: GameError | null;
  aiThinkingIdx: number | null;
  onEatPile: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  hintCardIds?: string[];
}

function selectionStillExists(state: GameState, selection: SelectedCard[]): boolean {
  const player = state.players[state.currentPlayerIdx];
  if (!player?.isHuman || state.phase !== 'playing' || state.pendingFaceDown) return false;
  return selection.every(item => {
    if (item.source.kind === 'hand') return player.hand.some(card => card.id === item.card.id);
    if (item.source.kind === 'faceUp') return player.faceUp[item.source.slot]?.id === item.card.id;
    return false;
  });
}

/**
 * GameBoard intentionally delays onPlay until its card-flight animation settles.
 * This wrapper rejects a delayed callback when the turn or source cards changed
 * during that animation, preventing stale state from being submitted.
 */
export function GameBoardController(props: Props) {
  const latestState = useRef(props.state);
  useEffect(() => { latestState.current = props.state; }, [props.state]);

  const guardedPlay = useCallback((selected: SelectedCard[]) => {
    const current = latestState.current;
    if (!selectionStillExists(current, selected)) return;
    props.onPlay(selected);
  }, [props.onPlay]);

  const guardedFlip = useCallback((slot: number) => {
    const current = latestState.current;
    const player = current.players[current.currentPlayerIdx];
    if (!player?.isHuman || current.phase !== 'playing' || current.pendingFaceDown) return;
    if (!player.faceDown[slot] || player.faceUp[slot]) return;
    props.onFlipFaceDown(slot);
  }, [props.onFlipFaceDown]);

  return <GameBoard {...props} onPlay={guardedPlay} onFlipFaceDown={guardedFlip} />;
}
