import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { GameState } from '../game/types';
import { getRecommendedMove } from '../game/guidance';
import { loadProgression, shouldShowHintButton } from '../lib/progression';

interface Props {
  state: GameState;
}

const PRACTICE_STEPS = [
  'Tap a rank in your hand to select every playable copy.',
  'Play equal-or-lower than the pile. Aces are low.',
  'A 10 burns the pile and gives you another turn.',
  'Four matching cards on top create a swipe and another turn.',
  'Clear a face-up card to unlock the face-down card beneath it.',
  'A face-down card can be flipped even while you still have cards in hand.',
  'When a high play forces a pickup, matching ranks stay on the new pile.',
];

export function GuidanceOverlay({ state }: Props) {
  const humanIdx = state.players.findIndex(player => player.isHuman);
  const hint = useMemo(() => getRecommendedMove(state, humanIdx), [state, humanIdx]);
  const [open, setOpen] = useState(false);
  const [practiceStep, setPracticeStep] = useState(0);
  const [showPractice, setShowPractice] = useState(state.mode === 'practice');
  const visible = shouldShowHintButton();

  useEffect(() => {
    setOpen(false);
  }, [state.currentPlayerIdx, state.pile.length, state.pendingFaceDown?.card.id]);

  useEffect(() => {
    if (state.mode !== 'practice') return;
    const next = Math.min(PRACTICE_STEPS.length - 1, Math.max(0, state.roundNumber - 1));
    setPracticeStep(next);
  }, [state.mode, state.roundNumber]);

  if (humanIdx < 0) return null;

  return (
    <>
      <AnimatePresence>
        {showPractice && state.mode === 'practice' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 top-[max(env(safe-area-inset-top),0.75rem)] z-[85] w-[min(92vw,430px)] -translate-x-1/2 rounded-xl border border-brass-500/40 bg-felt-900/95 px-4 py-3 shadow-2xl backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-brass-400">Practice coach</div>
                <div className="mt-1 text-sm leading-relaxed text-bone-100">{PRACTICE_STEPS[practiceStep]}</div>
              </div>
              <button onClick={() => setShowPractice(false)} className="text-xl leading-none text-bone-200/50" aria-label="Dismiss coaching">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {visible && state.phase === 'playing' && (
        <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0.5rem)+5.4rem)] right-3 z-[82] flex flex-col items-end gap-2">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                className="w-[min(82vw,310px)] rounded-xl border border-brass-500/35 bg-felt-900/95 p-4 shadow-2xl backdrop-blur"
              >
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-brass-400">{hint.title}</div>
                <div className="mt-1.5 text-sm leading-relaxed text-bone-100/90">{hint.body}</div>
                {hint.cardIds.length > 0 && (
                  <div className="mt-2 text-[10px] uppercase tracking-wide text-bone-200/45">Suggested cards are temporarily highlighted after an illegal move.</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setOpen(value => !value)}
            className="h-9 rounded-full border border-brass-500/45 bg-felt-800/95 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-brass-400 shadow-lg transition hover:bg-felt-700 active:scale-95"
          >
            Hint
          </button>
          <div className="text-[9px] text-bone-200/30">Fades after game 4 · {loadProgression().gamesCompleted}/4</div>
        </div>
      )}
    </>
  );
}
