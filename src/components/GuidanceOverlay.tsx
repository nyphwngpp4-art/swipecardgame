import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useReducer } from 'react';
import type { GameState } from '../game/types';
import { getRecommendedMove } from '../game/guidance';
import { loadProgression, shouldShowHintButton } from '../lib/progression';

interface Props {
  state: GameState;
  /** Reports which cards the open hint panel refers to, for props-driven highlighting. */
  onHighlightChange?: (cardIds: string[]) => void;
}

interface UIState {
  hintOpen: boolean;
  coachDismissed: boolean;
}

type UIAction =
  | { type: 'toggleHint' }
  | { type: 'closeHint' }
  | { type: 'dismissCoach' };

function reducer(state: UIState, action: UIAction): UIState {
  if (action.type === 'toggleHint') return { ...state, hintOpen: !state.hintOpen };
  if (action.type === 'closeHint') return { ...state, hintOpen: false };
  return { ...state, coachDismissed: true };
}

function practiceCopy(state: GameState, title: string, body: string): { title: string; body: string } {
  if (state.pendingFaceDown) {
    return {
      title: 'Face-down decision',
      body: 'The flip is committed. Add matching cards if available, then confirm. If the flipped card is too high, you take the pile.',
    };
  }
  if (state.pile.length === 0) {
    return {
      title: 'Lead the pile',
      body: 'With an empty pile, any rank is legal. Clearing several matching cards is usually stronger than playing one.',
    };
  }
  if (title.toLowerCase().includes('swipe')) {
    return {
      title: 'Finish the swipe',
      body: `${body} Four matching ranks on top clear the pile and let you play again.`,
    };
  }
  if (title.toLowerCase().includes('burn') || title.includes('10')) {
    return {
      title: 'Use the burn carefully',
      body: `${body} A 10 is powerful, but each unused 10 costs 20 points at round end.`,
    };
  }
  if (title.toLowerCase().includes('safe') || title.toLowerCase().includes('play')) {
    return {
      title: 'Read the pile',
      body: `${body} The normal rule is equal-or-lower; Aces are low.`,
    };
  }
  return { title, body };
}

export function GuidanceOverlay({ state, onHighlightChange }: Props) {
  const humanIdx = state.players.findIndex(player => player.isHuman);
  const hint = useMemo(() => getRecommendedMove(state, humanIdx), [state, humanIdx]);
  const [ui, dispatch] = useReducer(reducer, { hintOpen: false, coachDismissed: false });
  // Re-read stored progression only when a new game begins, not every render
  const progression = useMemo(() => loadProgression(), [state.seed]);
  const visible = shouldShowHintButton();
  const coach = practiceCopy(state, hint.title, hint.body);

  useEffect(() => {
    dispatch({ type: 'closeHint' });
  }, [state.currentPlayerIdx, state.pile.length, state.pendingFaceDown?.card.id]);

  // While the hint panel is open, its suggested cards glow on the table —
  // rendered through props (App → GameBoard → PlayingCard), not DOM mutation.
  // Illegal-move suggestions reach GameBoard directly via lastError.
  useEffect(() => {
    onHighlightChange?.(ui.hintOpen ? hint.cardIds : []);
  }, [ui.hintOpen, hint, onHighlightChange]);

  if (humanIdx < 0) return null;

  return (
    <>
      <AnimatePresence>
        {!ui.coachDismissed && state.mode === 'practice' && state.phase === 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 top-[max(env(safe-area-inset-top),0.75rem)] z-[85] w-[min(92vw,430px)] -translate-x-1/2 rounded-xl border border-brass-500/40 bg-felt-900/95 px-4 py-3 shadow-2xl backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-brass-400">Practice coach · {coach.title}</div>
                <div className="mt-1 text-sm leading-relaxed text-bone-100">{coach.body}</div>
                <div className="mt-1.5 text-[10px] text-bone-200/45">Face-down cards remain available once the face-up card above them is cleared—even while cards remain in your hand.</div>
              </div>
              <button onClick={() => dispatch({ type: 'dismissCoach' })} className="text-xl leading-none text-bone-200/50" aria-label="Dismiss coaching">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {visible && state.phase === 'playing' && (
        <div className={`fixed bottom-[calc(max(env(safe-area-inset-bottom),0.5rem)+5.4rem)] right-3 z-[82] flex flex-col items-end gap-2 transition-opacity ${progression.gamesCompleted === 3 ? 'opacity-60' : 'opacity-100'}`}>
          <AnimatePresence>
            {ui.hintOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                className="w-[min(82vw,310px)] rounded-xl border border-brass-500/35 bg-felt-900/95 p-4 shadow-2xl backdrop-blur"
              >
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-brass-400">{hint.title}</div>
                <div className="mt-1.5 text-sm leading-relaxed text-bone-100/90">{hint.body}</div>
                {hint.cardIds.length > 0 && (
                  <div className="mt-2 text-[10px] uppercase tracking-wide text-bone-200/45">The suggested cards are glowing on the table.</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => dispatch({ type: 'toggleHint' })}
            className="h-9 rounded-full border border-brass-500/45 bg-felt-800/95 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-brass-400 shadow-lg transition hover:bg-felt-700 active:scale-95"
          >
            Hint
          </button>
          <div className="text-[9px] text-bone-200/30">Available through game 4 · {progression.gamesCompleted}/4</div>
        </div>
      )}
    </>
  );
}
