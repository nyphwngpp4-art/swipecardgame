import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Card } from '../game/types';
import { PlayingCard } from './PlayingCard';
import type { Theme } from '../theme';
import { countSameRankOnTop, isFourOfAKindOnTop } from '../game/rules';

interface Props {
  pile: Card[];
  higherFlashKey?: number;
  dropHighlight?: boolean;
  /** Selection is ready — pile becomes a tap target that commits the play */
  armed?: boolean;
  onTap?: () => void;
  /** House rule: four-of-a-kind swipe visuals only shown when the rule is on */
  swipesEnabled?: boolean;
  theme?: Theme;
}

export const Pile = forwardRef<HTMLDivElement, Props>(function Pile(
  { pile, higherFlashKey, dropHighlight = false, armed = false, onTap, swipesEnabled = true, theme = 'classic' },
  ref,
) {
  const top = pile.length > 0 ? pile[pile.length - 1] : null;
  const sameRankOnTop = top ? countSameRankOnTop(pile, top.rank) : 0;
  const fourOfAKind = swipesEnabled && isFourOfAKindOnTop(pile);
  const oneFromSwipe = swipesEnabled && sameRankOnTop === 3;
  const stackPreview = pile.slice(-4, -1);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="text-xs uppercase tracking-[0.3em] text-bone-200/40">Pile</div>
      <div
        ref={ref}
        onClick={armed ? onTap : undefined}
        className={`relative w-20 h-28 rounded-lg transition-all duration-150 ${
          dropHighlight
            ? 'ring-2 ring-brass-400 ring-offset-2 ring-offset-felt-900 scale-[1.04]'
            : armed
            ? 'cursor-pointer animate-pulse-glow'
            : ''
        }`}
      >
        {!top && (
          <div className="absolute inset-0 rounded-md border-2 border-dashed border-felt-600/40
                          flex items-center justify-center text-bone-200/30 text-xs">
            empty
          </div>
        )}
        <AnimatePresence>
          {stackPreview.map((c, i) => (
            <motion.div
              key={c.id + '-bg'}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: (i - stackPreview.length) * 1.5,
                y: (i - stackPreview.length) * 1.5,
                rotate: (i - stackPreview.length) * 1.5,
              }}
              exit={{
                x: (i - 1.5) * 38,
                y: -70,
                rotate: (i - 1.5) * 22,
                opacity: 0,
                scale: 0.6,
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <PlayingCard card={c} size="lg" theme={theme} />
            </motion.div>
          ))}
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          {top && (
            <motion.div
              key={top.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <PlayingCard card={top} size="lg" theme={theme} />
            </motion.div>
          )}
        </AnimatePresence>
        {top && sameRankOnTop >= 2 && (
          <motion.div
            key={`${top.rank}-${sameRankOnTop}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`absolute -top-2 -right-2 z-10 px-2 py-0.5 rounded-full font-display font-bold text-xs tabular-nums shadow-md pointer-events-none
              ${oneFromSwipe
                ? 'bg-brass-400 text-felt-900 ring-2 ring-brass-300/80'
                : 'bg-felt-800 text-brass-400 border border-brass-500/50'}`}
          >
            {top.rank}×{sameRankOnTop}
          </motion.div>
        )}
        {fourOfAKind && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-md animate-pulse-glow pointer-events-none"
          />
        )}
        <AnimatePresence>
          {higherFlashKey ? (
            <motion.div
              key={higherFlashKey}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1.0, 0.9] }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="text-[72px] font-black text-oxblood-500 drop-shadow-[0_0_12px_rgba(168,35,31,0.9)]">
                ✕
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="text-xs text-bone-200/50 text-center">
        {pile.length === 0 ? (
          '—'
        ) : (
          <>
            <span>{pile.length} card{pile.length === 1 ? '' : 's'}</span>
            {oneFromSwipe && (
              <span className="block text-brass-400/90 mt-0.5 tracking-wide">1 more for swipe</span>
            )}
          </>
        )}
      </div>
    </div>
  );
});