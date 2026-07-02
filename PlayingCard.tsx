import { motion } from 'motion/react';
import type { PointerEvent } from 'react';
import type { Card } from '../game/types';
import type { Theme } from '../theme';

interface Props {
  card?: Card;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  dim?: boolean;
  legal?: boolean;
  launching?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: PointerEvent) => void;
  dragGhost?: boolean;
  layoutId?: string;
  theme?: Theme;
  priority?: boolean; // e.g. face-up card of a currently selected rank - encourage playing to clear the slot
}

const SIZES = {
  xs: 'w-7 h-10 text-[9px]',
  sm: 'w-10 h-14 text-xs',
  md: 'w-14 h-20 text-base',
  lg: 'w-20 h-28 text-2xl',
};

const RANK_SIZE = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-[13px]',
  lg: 'text-[15px]',
};

export function PlayingCard({
  card, faceDown = false, size = 'md', selected = false, dim = false, legal = false, launching = false,
  onClick, onPointerDown, dragGhost = false, layoutId, theme = 'classic', priority = false,
}: Props) {
  const isRed = card && (card.suit === '♥' || card.suit === '♦');
  const isCasino = theme === 'casino';

  const suitColor = isRed 
    ? (isCasino ? '#FF3366' : '#B84C3F') 
    : (isCasino ? '#00E5FF' : '#C9A961');

  const cardBg = isCasino ? '#1A2533' : '#2F3834';
  const cardBorder = isCasino ? '#FFE066' : '#B89E70';
  const rankColor = isCasino ? '#E8F4FF' : '#E8DDC4';
  const tenRingColor = isCasino ? '#FF2E63' : '#A8231F';

  // For casino theme, smoother cards: fewer hard inner boxes, more glow/neon for "fresh casino" feel
  const innerBorderClass = isCasino 
    ? 'border-[#FFE066]/30' 
    : 'border-brass-400/45';
  const innerBorder2Class = isCasino 
    ? 'border-[#FFE066]/15' 
    : 'border-brass-500/25';
  const accentLineClass = isCasino 
    ? 'bg-[#FFE066]/15' 
    : 'bg-white/[0.035]';
  const edgeHighlightClass = isCasino 
    ? 'bg-[#FFE066]/25' 
    : 'bg-white/4';

  if (faceDown) {
    return (
      <motion.div
        layoutId={layoutId}
        onClick={onClick}
        whileTap={onClick ? { scale: 0.965 } : {}}
        className={`
          ${SIZES[size]} relative rounded-[7px] flex-shrink-0 overflow-hidden
          border border-brass-600/70
          shadow-[0_4px_14px_rgba(0,0,0,0.5),0_1px_2px_rgba(0,0,0,0.3)]
          ${onClick ? 'cursor-pointer active:scale-[0.985]' : ''}
          ${dim ? 'opacity-55' : ''}
          ${selected ? 'ring-2 ring-brass-400 ring-offset-2 ring-offset-felt-900' : ''}
        `}
      >
        {/* Rich dark luxury back */}
        <div className={`absolute inset-0 ${isCasino ? 'bg-[#162D40]' : 'bg-[#1C2521]'}`}>
          {/* Fine brass outer frame */}
          <div className="absolute inset-[1.5px] border border-brass-500/70 rounded-[5px]" />
          <div className="absolute inset-[4px] border border-brass-600/40 rounded-[3px]" />

          {/* Elegant repeating geometric pattern - simplified for xs to avoid glare */}
          {size !== 'xs' && (
            <div className="absolute inset-[6px] overflow-hidden rounded-[2px]">
              <div className="absolute inset-0 bg-[repeating-linear-gradient(30deg,#1F2A25_0px,#1F2A25_2px,transparent_2px,transparent_6px)]" />
              <div className="absolute inset-0 bg-[repeating-linear-gradient(-30deg,#18201C_0px,#18201C_1px,transparent_1px,transparent_5px)] opacity-70" />
            </div>
          )}

          {/* Central ornate medallion */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-[46%] h-[46%]">
              <div className="absolute inset-0 border border-brass-400/50 rounded-full" />
              <div className="absolute inset-[8%] border border-brass-500/30 rounded-full" />
              <div className="absolute inset-[26%] border border-brass-400/60 rotate-45" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brass-400/90" />
            </div>
          </div>

          {/* Subtle edge bevel highlight */}
          <div className="absolute inset-x-[4px] top-[3px] h-px bg-white/5 rounded-full" />
        </div>
      </motion.div>
    );
  }

  if (!card) {
    return <div className={`${SIZES[size]} rounded-[7px] border border-dashed border-felt-600/40 flex-shrink-0`} />;
  }

  const isTen = card.rank === '10';
  // Static class strings — Tailwind can't compile runtime-built arbitrary values
  const tenAccent = isTen
    ? (isCasino ? 'ring-1 ring-[#FF2E63]/70' : 'ring-1 ring-[#A8231F]/70')
    : '';

  const interactive = !!(onClick || onPointerDown);

  return (
    <motion.div
      layoutId={layoutId}
      data-card-id={card.id}
      onClick={onClick}
      onPointerDown={onPointerDown}
      whileTap={interactive && !dragGhost ? { scale: 0.96 } : {}}
      animate={
        dragGhost
          ? { opacity: 0.35, scale: 0.94 }
          : launching
          ? { opacity: 0, scale: 0.92 }
          : selected
          ? { y: -18, scale: 1.025, opacity: 1 }
          : { y: 0, scale: 1, opacity: 1 }
      }
      transition={
        launching
          ? { duration: 0.1, ease: 'easeOut' }
          : { type: 'spring', stiffness: 420, damping: 28 }
      }
      className={`
        ${SIZES[size]} relative flex-shrink-0 select-none overflow-hidden rounded-[7px]
        flex flex-col
        ${interactive ? 'cursor-pointer active:scale-[0.985]' : ''}
        ${selected ? 'ring-2 ring-brass-400 ring-offset-2 ring-offset-felt-900' : ''}
        ${legal && !selected ? 'ring-2 ring-emerald-400/70' : ''}
        ${priority && !selected ? 'ring-2 ring-emerald-400/80 animate-pulse' : ''}
        ${dim ? 'opacity-50' : ''}
        ${tenAccent}
        ${isCasino
          ? 'shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_12px_rgba(255,215,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
          : 'shadow-[0_4px_16px_rgba(0,0,0,0.55),0_1px_3px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]'}
      `}
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
      }}
    >
      {/* Subtle dark grain texture - lighter/smoother in casino, and disabled for dim (non-interactive turns) and small sizes (xs opponent cards during other rounds) to avoid glare */}
      {!dim && size !== 'xs' && (
        <div className={`absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_0.6px,transparent_1px)] bg-[length:3px_3px] pointer-events-none ${isCasino ? 'opacity-60' : ''}`} />
      )}

      {/* Inner frame(s) - smoother in casino theme (less "box within box" look, more glow). Hidden when dim or xs to reduce glare on non-active turns/small views */}
      {!dim && size !== 'xs' && (
        <div className={`absolute inset-[2.5px] border ${innerBorderClass} rounded-[4px] pointer-events-none`} />
      )}
      {!dim && !isCasino && size !== 'xs' && (
        <div className={`absolute inset-[5px] border ${innerBorder2Class} rounded-[2px] pointer-events-none`} />
      )}

      {/* 10 burn accent bar at top - only when not dim and not xs */}
      {isTen && !dim && size !== 'xs' && (
        <div 
          className="absolute top-0 inset-x-[6px] h-[2px] bg-gradient-to-r from-transparent to-transparent"
          style={{ backgroundImage: `linear-gradient(to right, transparent, ${tenRingColor}80, transparent)` }}
        />
      )}

      {/* Top-left rank + suit */}
      <div className={`absolute top-[3px] left-[3px] flex flex-col items-start leading-none pl-[1px] ${RANK_SIZE[size]}`} style={{ color: rankColor }}>
        <div className="font-display font-bold tracking-[-0.02em]">{card.rank}</div>
        <div className="-mt-[1px] text-[0.92em]" style={{ color: suitColor }}>{card.suit}</div>
      </div>

      {/* Bottom-right rank + suit (rotated) */}
      <div className={`absolute bottom-[3px] right-[3px] flex flex-col items-end leading-none pr-[1px] rotate-180 ${RANK_SIZE[size]}`} style={{ color: rankColor }}>
        <div className="font-display font-bold tracking-[-0.02em]">{card.rank}</div>
        <div className="-mt-[1px] text-[0.92em]" style={{ color: suitColor }}>{card.suit}</div>
      </div>

      {/* Center: refined suit symbol */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: suitColor }}>
        <div
          className={`
            font-display select-none tracking-[-0.04em] drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]
            ${size === 'xs' ? 'text-[17px]' : size === 'sm' ? 'text-[26px]' : size === 'md' ? 'text-[42px]' : 'text-[60px]'}
            ${isTen ? 'opacity-95' : 'opacity-90'}
          `}
          style={isTen ? { filter: 'saturate(1.1)' } : undefined}
        >
          {card.suit}
        </div>
      </div>

      {/* Very subtle inner horizontal accents - lighter/smoother in casino. Hidden when dim or xs to prevent glare on non-active turns/small cards */}
      {!dim && size !== 'xs' && (
        <>
          <div className={`absolute top-[24%] left-[14%] right-[14%] h-px ${accentLineClass}`} />
          <div className={`absolute bottom-[24%] left-[14%] right-[14%] h-px ${accentLineClass}`} />
        </>
      )}

      {/* Edge highlight for premium bevel */}
      <div className={`absolute inset-x-[3px] top-[2px] h-px ${edgeHighlightClass} rounded-full pointer-events-none`} />
    </motion.div>
  );
}
