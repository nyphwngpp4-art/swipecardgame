import { motion } from 'motion/react';
import type { Player } from '../game/types';
import { PlayingCard } from './PlayingCard';
import type { Theme } from '../theme';

interface Props {
  player: Player;
  isCurrent: boolean;
  isThinking?: boolean;
  score: number;
  theme?: Theme;
}

// Deterministic avatar hue per opponent so seats are easy to tell apart at a glance.
const AVATAR_BG = ['#7C5CBF', '#3E8E7E', '#B05C7C', '#5C7CB0'];

export function OpponentArea({ player, isCurrent, isThinking, score, theme = 'classic' }: Props) {
  // "CPU 2" → "C2"; "Maya" → "M" — keeps multiple CPU seats distinguishable
  const digit = player.name.match(/\d+/)?.[0] ?? '';
  const initial = (player.name.trim().slice(0, 1).toUpperCase() + digit).slice(0, 2) || '?';
  const avatarBg = AVATAR_BG[player.id % AVATAR_BG.length];

  return (
    <motion.div
      animate={isCurrent ? { y: -2, scale: 1.02 } : { y: 0, scale: 1 }}
      className={`
        flex flex-col items-center gap-1.5 px-2.5 py-2 rounded-xl transition-all duration-150 flex-shrink-0
        ${isCurrent ? 'bg-felt-700 ring-1 ring-brass-400/70 shadow-[0_0_18px_rgba(232,200,121,0.18)]' : 'bg-felt-800/40'}
      `}
    >
      {/* Avatar + identity */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-bone-50 text-sm
                        border ${isCurrent ? 'border-brass-400' : 'border-white/10'}`}
            style={{ backgroundColor: avatarBg }}
          >
            {initial}
            <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-felt-900 border border-brass-500/60
                             flex items-center justify-center text-[9px] font-mono text-brass-400 tabular-nums">
              {player.hand.length}
            </span>
          </div>
          {/* Active-turn pulse ring */}
          {isCurrent && (
            <motion.div
              className="absolute -inset-[3px] rounded-full border-2 border-brass-400/80 pointer-events-none"
              animate={{ opacity: [0.9, 0.35, 0.9], scale: [1, 1.1, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        <div className="flex flex-col leading-tight">
          <span className={`font-display font-bold text-xs ${isCurrent ? 'text-brass-400' : 'text-bone-100'}`}>
            {player.name}
          </span>
          <span className="text-[10px] text-bone-200/60 font-mono tabular-nums min-h-[13px]">
            {isThinking ? <ThinkingDots /> : <>{score} pt</>}
          </span>
        </div>
      </div>

      {/* Face-down / face-up mini grid — public info, strategically relevant */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="relative w-7 h-10">
            {!player.faceDown[i] && !player.faceUp[i] && (
              <div className="absolute inset-0 rounded border border-dashed border-felt-600/40" />
            )}
            {player.faceDown[i] && (
              <div className="absolute inset-0">
                <PlayingCard faceDown size="xs" theme={theme} />
              </div>
            )}
            {player.faceUp[i] && (
              <div className="absolute inset-0" style={{ transform: 'translate(2px, 2px)' }}>
                <PlayingCard card={player.faceUp[i]!} size="xs" theme={theme} />
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-[3px] items-center text-brass-400/90" aria-label="thinking">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-current inline-block"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}
