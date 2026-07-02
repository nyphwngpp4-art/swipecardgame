import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Card, GameState, Player, SelectedCard } from '../game/types';
import { topOfPile, isTen, isEqualOrLower, maxPlayableOfRank, cardsOfRank, getLegalLowerRanks } from '../game/rules';
import type { Rank } from '../game/types';
import type { GameError } from '../hooks/useSwipeGame';
import type { Theme } from '../theme';
import { playSound, haptic } from '../lib/sound';

import { Pile } from './Pile';
import { OpponentArea } from './OpponentArea';
import { PlayerArea, deriveAction, ActionBar } from './PlayerArea';
import { PlayingCard } from './PlayingCard';
import { PauseSheet, HowToPlayModal } from './Modals';

const CARD_LG_W = 80;
const CARD_LG_H = 112;
const FLIGHT_STAGGER_S = 0.065;
const FLIGHT_DURATION_S = 0.34;
const DRAG_THRESHOLD_PX = 22;
const FLICK_SPEED_PX_MS = 0.45;

function buildRankPool(player: Player, rank: string): SelectedCard[] {
  const pool: SelectedCard[] = [];
  player.faceUp.forEach((c, slot) => {
    if (c && c.rank === rank) pool.push({ card: c, source: { kind: 'faceUp', slot } });
  });
  player.hand.forEach(c => {
    if (c.rank === rank) pool.push({ card: c, source: { kind: 'hand' } });
  });
  return pool;
}

interface DragSession {
  sel: SelectedCard;
  card: Card;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
  active: boolean;
}

interface PendingDrag {
  sel: SelectedCard;
  card: Card;
  pointerId: number;
  startX: number;
  startY: number;
}

interface FlyingCard {
  id: string;
  card: Card;
  startRect: DOMRect;
  index: number;
  total: number;
  targetX: number;
  targetY: number;
}

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
  onThemeChange: (t: Theme) => void;
}

export function GameBoard({
  state, onPlay, onFlipFaceDown, onResolveFaceDown, lastError, aiThinkingIdx,
  onEatPile, onRestart, onMainMenu, theme, onThemeChange,
}: Props) {
  const [selected, setSelected] = useState<SelectedCard[]>([]);
  const [pendingChain, setPendingChain] = useState<SelectedCard[]>([]);
  const [swipeId, setSwipeId] = useState(0);
  const [launchingIds, setLaunchingIds] = useState<Set<string>>(new Set());
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [showEatConfirm, setShowEatConfirm] = useState(false);
  const [higherFlashKey, setHigherFlashKey] = useState(0);
  const [showPause, setShowPause] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 520,
  );
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [pileDropHighlight, setPileDropHighlight] = useState(false);
  const prevPileLenRef = useRef(state.pile.length);
  const pileTargetRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const pendingDragRef = useRef<PendingDrag | null>(null);
  const selectedRef = useRef(selected);
  const playRef = useRef<(override?: SelectedCard[]) => void>(() => {});

  const humanIdx = state.players.findIndex(p => p.isHuman);
  const opponents = state.players.filter((_, i) => i !== humanIdx);
  const isHumanTurn = state.currentPlayerIdx === humanIdx && state.phase === 'playing'
    && !state.pendingFaceDown;

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 520);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    dragSessionRef.current = dragSession;
  }, [dragSession]);

  function toggleSelect(sel: SelectedCard) {
    playSound('select');
    haptic(8);
    setSelected(prev => {
      const exists = prev.find(s => s.card.id === sel.card.id);
      if (exists) {
        // Hold back: deselect only this card
        return prev.filter(s => s.card.id !== sel.card.id);
      }

      const player = state.players[humanIdx];
      const rank = sel.card.rank as Rank;

      // Special rule: only one 10 may ever be selected (it burns immediately).
      if (rank === '10' && state.rules.tenBurns) {
        const existingTen = prev.find(s => s.card.rank === '10');
        if (existingTen) {
          return prev.filter(s => s.card.rank !== '10').concat(sel);
        }
        return [sel];
      }

      const max = maxPlayableOfRank(rank, state.pile, cardsOfRank(player, rank), state.rules);
      const pool = buildRankPool(player, rank);

      // New rank or empty selection: default to all legally playable cards
      if (prev.length === 0 || prev[0].card.rank !== rank) {
        return pool.slice(0, max);
      }

      // Same rank — add this card back if under the cap
      if (prev.length >= max) return prev;
      if (prev.some(s => s.card.id === sel.card.id)) return prev;
      return [...prev, sel];
    });
  }

  function clearSelection() {
    setSelected([]);
  }

  // Atomic rank selection (for the smart fan stacks) - single state update, no flash
  function selectRank(rank: string, desiredCount: number) {
    if (!state) return;

    const player = state.players[humanIdx];
    if (!player) return;

    const pool = buildRankPool(player, rank);
    const rankCards = cardsOfRank(player, rank as Rank);
    const maxPlay = maxPlayableOfRank(rank as Rank, state.pile, rankCards, state.rules);
    const finalCount = Math.min(desiredCount, pool.length, maxPlay);

    playSound('select');
    haptic(8);
    setSelected(pool.slice(0, finalCount));
  }

  function togglePendingChain(sel: SelectedCard) {
    playSound('select');
    setPendingChain(prev =>
      prev.find(p => p.card.id === sel.card.id) ? prev.filter(p => p.card.id !== sel.card.id) : [...prev, sel]
    );
  }

  const play = useCallback((override?: SelectedCard[]) => {
    // Guard against DOM event objects arriving via onClick={play}
    const source = Array.isArray(override) ? override : selectedRef.current;
    if (source.length === 0) return;

    // Safety clamp — never send more cards than the rules allow in one play
    const rank = source[0].card.rank as Rank;
    const player = state.players[humanIdx];
    const max = maxPlayableOfRank(rank, state.pile, cardsOfRank(player, rank), state.rules);
    const toPlay = source.slice(0, max);
    if (toPlay.length === 0) return;

    const ids = new Set(toPlay.map(s => s.card.id));

    // Measure pile landing zone + each card's start position before hiding sources
    const pileRect = pileTargetRef.current?.getBoundingClientRect();
    const targetX = pileRect
      ? pileRect.left + (pileRect.width - CARD_LG_W) / 2
      : window.innerWidth / 2 - CARD_LG_W / 2;
    const targetY = pileRect
      ? pileRect.top + (pileRect.height - CARD_LG_H) / 2
      : window.innerHeight * 0.38 - CARD_LG_H / 2;

    const handScroll = document.querySelector('[data-hand-scroll]');
    const handRect = handScroll?.getBoundingClientRect();

    const measured: FlyingCard[] = [];
    toPlay.forEach((sel, index) => {
      const el = document.querySelector(`[data-card-id="${sel.card.id}"]`) as HTMLElement | null;
      let startRect: DOMRect;
      if (el) {
        startRect = el.getBoundingClientRect();
      } else if (handRect) {
        startRect = new DOMRect(
          handRect.left + 12 + index * 18,
          handRect.top + 8,
          CARD_LG_W * 0.7,
          CARD_LG_H * 0.7,
        );
      } else {
        startRect = new DOMRect(
          window.innerWidth / 2 - CARD_LG_W / 2,
          window.innerHeight * 0.72,
          CARD_LG_W * 0.7,
          CARD_LG_H * 0.7,
        );
      }
      measured.push({
        id: sel.card.id,
        card: sel.card,
        startRect,
        index,
        total: toPlay.length,
        targetX,
        targetY,
      });
    });

    if (measured.length > 0) {
      setFlyingCards(measured);
      setLaunchingIds(ids);
    }

    const topBefore = topOfPile(state.pile);
    const isHigherPlay = toPlay.length > 0 && topBefore !== null &&
      !isTen(toPlay[0].card) &&
      !isEqualOrLower(toPlay[0].card, topBefore);

    // Wait for staggered flights to finish before updating game state
    const settleMs = Math.round(
      ((toPlay.length - 1) * FLIGHT_STAGGER_S + FLIGHT_DURATION_S + 0.08) * 1000,
    );

    setTimeout(() => {
      onPlay(toPlay);
      setSelected([]);
      setLaunchingIds(new Set());

      if (isHigherPlay) {
        setHigherFlashKey(k => k + 1);
      }

      setTimeout(() => setFlyingCards([]), 100);
    }, measured.length > 0 ? settleMs : 0);
  }, [state, humanIdx, onPlay]);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const playerAction = useMemo(
    () => deriveAction(state, selected, humanIdx),
    [state, selected, humanIdx],
  );

  // Truly stuck: nothing equal-or-lower and no 10 to burn — the only real move
  // is taking the pile, so surface it as the primary action instead of a dead button
  const stuckMustTakePile = useMemo(() => {
    if (!isHumanTurn || selected.length > 0 || state.pile.length === 0) return false;
    const player = state.players[humanIdx];
    const available = [
      ...player.hand,
      ...player.faceUp.filter((c): c is Card => c !== null),
    ];
    if (available.length === 0) return false;
    if (state.rules.tenBurns && available.some(isTen)) return false;
    return getLegalLowerRanks(available, topOfPile(state.pile), state.rules).size === 0;
  }, [state, selected.length, humanIdx, isHumanTurn]);

  const barAction = stuckMustTakePile
    ? {
        label: `Take the pile (${state.pile.length})`,
        enabled: true,
        variant: 'pickup' as const,
        helper: 'No equal-or-lower play available — or play a high card with it.',
      }
    : playerAction;

  const handleBarPlay = useCallback(() => {
    if (stuckMustTakePile) {
      onEatPile();
    } else {
      play();
    }
  }, [stuckMustTakePile, onEatPile, play]);

  // Desktop: Enter or Space commits the ready action
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target as HTMLElement | null;
      if (target && ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (showPause || showHowTo || showEatConfirm || state.pendingFaceDown) return;
      if (!barAction.enabled) return;
      e.preventDefault();
      handleBarPlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [barAction.enabled, handleBarPlay, showPause, showHowTo, showEatConfirm, state.pendingFaceDown]);

  function isOverPile(x: number, y: number, pad = 36): boolean {
    const rect = pileTargetRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      x >= rect.left - pad &&
      x <= rect.right + pad &&
      y >= rect.top - pad &&
      y <= rect.bottom + pad
    );
  }

  function isFlickTowardPile(vx: number, vy: number, x: number, y: number): boolean {
    const rect = pileTargetRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const speed = Math.hypot(vx, vy);
    if (speed < FLICK_SPEED_PX_MS) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const toPileX = cx - x;
    const toPileY = cy - y;
    const toLen = Math.hypot(toPileX, toPileY) || 1;
    const dot = (vx * toPileX + vy * toPileY) / (speed * toLen);
    return dot > 0.55;
  }

  function beginCardDrag(e: ReactPointerEvent, sel: SelectedCard) {
    if (!isHumanTurn) return;
    pendingDragRef.current = {
      sel,
      card: sel.card,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      let session = dragSessionRef.current;

      if (!session) {
        const pending = pendingDragRef.current;
        if (!pending || e.pointerId !== pending.pointerId) return;

        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          pendingDragRef.current = null;
          return;
        }
        if (!(dy < -DRAG_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx))) return;

        session = {
          ...pending,
          x: e.clientX,
          y: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          lastT: performance.now(),
          vx: 0,
          vy: 0,
          active: true,
        };
        pendingDragRef.current = null;
        dragSessionRef.current = session;
        setDragSession(session);
      }

      if (e.pointerId !== session.pointerId) return;

      const now = performance.now();
      const dt = Math.max(1, now - session.lastT);
      const vx = (e.clientX - session.lastX) / dt;
      const vy = (e.clientY - session.lastY) / dt;

      const next = {
        ...session,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: now,
        vx,
        vy,
        active: true,
      };
      dragSessionRef.current = next;
      setDragSession(next);
      setPileDropHighlight(isOverPile(e.clientX, e.clientY));
    };

    const onUp = (e: PointerEvent) => {
      if (pendingDragRef.current?.pointerId === e.pointerId) {
        pendingDragRef.current = null;
      }

      const session = dragSessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const droppedOnPile = (
        isOverPile(e.clientX, e.clientY) ||
        isFlickTowardPile(session.vx, session.vy, e.clientX, e.clientY)
      );

      dragSessionRef.current = null;
      setDragSession(null);
      setPileDropHighlight(false);

      if (!session.active) return;

      if (droppedOnPile) {
        const rank = session.sel.card.rank as Rank;
        const player = state.players[humanIdx];
        const max = maxPlayableOfRank(rank, state.pile, cardsOfRank(player, rank), state.rules);
        const pool = buildRankPool(player, rank);
        const current = selectedRef.current;
        const hasDragged = current.some(s => s.card.id === session.sel.card.id);
        const toPlay = hasDragged && current.length > 0 && current[0].card.rank === rank
          ? current.slice(0, max)
          : pool.slice(0, max);

        if (toPlay.length > 0) {
          playSound('select');
          haptic(12);
          setSelected(toPlay);
          selectedRef.current = toPlay;
          requestAnimationFrame(() => playRef.current(toPlay));
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [state, humanIdx]);

  function resolveFaceDown(chain: SelectedCard[]) {
    onResolveFaceDown(chain);
    setPendingChain([]);
  }

  // Whenever turn changes or pending state changes, clear local selection
  const turnKey = `${state.currentPlayerIdx}-${state.pile.length}-${state.pendingFaceDown?.card.id ?? 'none'}`;

  // Detect "swipe" events (10 burn or 4-of-a-kind) for celebration visuals
  useEffect(() => {
    const prevLen = prevPileLenRef.current;
    const currLen = state.pile.length;
    const wasSwipe = prevLen > 0 && currLen === 0;
    if (wasSwipe) {
      setSwipeId(id => id + 1);
    }
    prevPileLenRef.current = currLen;
  }, [state.pile.length]);

  const humanScore = state.scores[humanIdx];
  const scorePct = Math.min(100, (humanScore / state.targetScore) * 100);
  const inDanger = scorePct >= 70;

  return (
    <div className="h-full flex flex-col px-2.5 md:px-4 gap-1.5 md:gap-3 safe-top min-h-0">
      {/* Top HUD */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-felt-800/80 border border-brass-500/25 text-[11px] tracking-wide">
            <span className="text-brass-400 font-bold">ROUND {state.roundNumber}</span>
          </div>
          <div className="text-[10px] text-bone-200/50 tracking-wide">
            LOSS AT <span className="font-mono text-bone-200/80">{state.targetScore}</span>
          </div>
        </div>

        <button
          onClick={() => setShowPause(true)}
          className="w-11 h-11 -mr-1.5 flex items-center justify-center text-brass-400/80 hover:text-brass-400 active:scale-95 transition-all"
          aria-label="Pause menu"
        >
          <div className="flex flex-col gap-[4px]">
            <div className="w-[18px] h-[2px] rounded-full bg-current" />
            <div className="w-[18px] h-[2px] rounded-full bg-current" />
            <div className="w-[12px] h-[2px] rounded-full bg-current" />
          </div>
        </button>
      </div>

      {/* Opponents row — inner mx-auto keeps it centered when it fits,
          and scrollable from the left edge when it overflows */}
      <div className="flex overflow-x-auto no-scrollbar py-0.5">
        <div className="flex gap-2 mx-auto">
          {opponents.map(p => (
            <OpponentArea
              key={p.id}
              player={p}
              isCurrent={state.currentPlayerIdx === p.id}
              isThinking={aiThinkingIdx === p.id}
              score={state.scores[p.id]}
              theme={theme}
            />
          ))}
        </div>
      </div>

      {/* Center: pile */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 md:gap-3 py-0.5 min-h-0">
        <Pile
          ref={pileTargetRef}
          pile={state.pile}
          higherFlashKey={higherFlashKey}
          dropHighlight={pileDropHighlight}
          armed={barAction.enabled}
          onTap={handleBarPlay}
          swipesEnabled={state.rules.fourOfAKindSwipes}
          theme={theme}
        />

        <AnimatePresence>
          {lastError && (
            <motion.div
              key={lastError.nonce}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-oxblood-400 bg-oxblood-500/10 border border-oxblood-500/30 px-3.5 py-1 rounded-md tracking-wide"
            >
              {lastError.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game log — one line on mobile to save space for the hand */}
        <div className="text-center min-h-[18px] md:min-h-[28px]">
          {state.log.slice(0, compact ? 1 : 2).map((line, i) => (
            <div
              key={`${line}-${i}`}
              className={`text-[11px] md:text-xs ${i === 0 ? 'text-bone-200/80' : 'text-bone-200/40'}`}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Big "SWIPE!" celebration when a 10 or 4-of-a-kind clears the pile */}
        <AnimatePresence>
          {swipeId > 0 && (
            <motion.div
              key={swipeId}
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.15, 1.0, 0.9], y: [10, -6, -12, -30] }}
              transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-[38%] left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            >
              <div className="font-display text-[42px] md:text-[52px] font-black tracking-[-1.5px] text-brass-400 drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
                SWIPE!
              </div>
              <div className="h-0.5 w-16 mx-auto mt-1 bg-gradient-to-r from-transparent via-brass-500 to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player shell — hand gets a dedicated horizontal strip; action pinned below */}
      <div
        key={turnKey}
        className="flex-shrink-0 flex flex-col w-full min-w-0 rounded-t-2xl border-t border-felt-600/40 bg-felt-900/60"
      >
        <PlayerArea
          state={state}
          selected={selected}
          onToggleSelect={toggleSelect}
          onClearSelection={clearSelection}
          onFlipFaceDown={onFlipFaceDown}
          onPlay={play}
          onResolveFaceDown={resolveFaceDown}
          pendingChain={pendingChain}
          onTogglePendingChain={togglePendingChain}
          launchingIds={launchingIds}
          onSelectRank={selectRank}
          onRequestEatPile={() => setShowEatConfirm(true)}
          onCardPointerDown={beginCardDrag}
          draggingCardId={dragSession?.active ? dragSession.card.id : null}
          hideActionBar
          compact={compact}
          theme={theme}
        />

        {!state.pendingFaceDown && (
          <div className="flex-shrink-0 px-2 pt-0.5 pb-safe">
            <div className="flex items-center justify-between text-[10px] tracking-wide mb-1 px-0.5">
              <span className="text-bone-200/50">
                <span className={`font-mono ${inDanger ? 'text-oxblood-400' : 'text-brass-400'}`}>{humanScore}</span>
                <span className="text-bone-200/30"> / {state.targetScore}</span>
              </span>
              <div className="flex-1 mx-2 h-0.5 rounded-full bg-felt-700 overflow-hidden max-w-[120px]">
                <motion.div
                  className={`h-full rounded-full ${inDanger ? 'bg-oxblood-500' : 'bg-brass-500'}`}
                  initial={false}
                  animate={{ width: `${scorePct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                />
              </div>
            </div>
            <ActionBar action={barAction} onPlay={handleBarPlay} compact={compact} />
          </div>
        )}
      </div>

      {/* Drag ghost — follows finger while flicking toward pile */}
      {dragSession?.active && (
        <div
          className="fixed z-[75] pointer-events-none"
          style={{
            left: dragSession.x - CARD_LG_W / 2,
            top: dragSession.y - CARD_LG_H / 2,
            width: CARD_LG_W,
            height: CARD_LG_H,
          }}
        >
          <PlayingCard card={dragSession.card} size="lg" theme={theme} />
        </div>
      )}

      {/* Flying card layer — staggered, transform-based flight to measured pile */}
      <div className="fixed inset-0 z-[70] pointer-events-none">
        <AnimatePresence>
          {flyingCards.map(({ id, card, startRect, index, total, targetX, targetY }) => {
            const depthFromTop = total - 1 - index;
            const stackX = depthFromTop * -2;
            const stackY = depthFromTop * 2;
            const startScale = startRect.width / CARD_LG_W;

            return (
              <motion.div
                key={`fly-${id}`}
                initial={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  width: CARD_LG_W,
                  height: CARD_LG_H,
                  x: startRect.left,
                  y: startRect.top,
                  scale: startScale,
                  rotate: index % 2 === 0 ? -5 : 5,
                  opacity: 1,
                  zIndex: 80 + index,
                }}
                animate={{
                  x: targetX + stackX,
                  y: targetY + stackY,
                  scale: 1,
                  rotate: depthFromTop * 1.5,
                  opacity: 1,
                }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{
                  delay: index * FLIGHT_STAGGER_S,
                  duration: FLIGHT_DURATION_S,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ willChange: 'transform' }}
                className="rounded-[7px] overflow-hidden shadow-2xl origin-top-left"
              >
                <PlayingCard card={card} size="lg" theme={theme} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* AI blind-flip reveal — the gamble deserves its moment */}
      <AnimatePresence>
        {state.pendingFaceDown && !state.players[state.pendingFaceDown.playerIdx].isHuman && (() => {
          const pending = state.pendingFaceDown;
          const flipper = state.players[pending.playerIdx];
          const top = topOfPile(state.pile);
          const plays = (state.rules.tenBurns && isTen(pending.card))
            || isEqualOrLower(pending.card, top, state.rules);
          return (
            <motion.div
              key={pending.card.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="fixed inset-0 z-[65] bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 pointer-events-none"
            >
              <div className="text-sm uppercase tracking-[0.25em] text-bone-200/80">
                {flipper.name} flips…
              </div>
              <motion.div
                initial={{ rotateY: 180, scale: 0.7 }}
                animate={{ rotateY: 0, scale: 1.15 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformPerspective: 700 }}
              >
                <PlayingCard card={pending.card} size="lg" theme={theme} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.25 }}
                className={`font-display font-bold tracking-wide text-lg ${
                  plays ? 'text-brass-400' : 'text-oxblood-500'
                }`}
              >
                {state.rules.tenBurns && isTen(pending.card)
                  ? '🔥 Burns the pile!'
                  : state.rules.twosReset && pending.card.rank === '2'
                  ? '↺ Resets the pile!'
                  : plays
                  ? 'It plays!'
                  : 'Too high — takes the pile!'}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Eat Pile Confirmation */}
      <AnimatePresence>
        {showEatConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowEatConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-felt-800 border border-brass-500/30 rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="font-display text-2xl text-bone-100 mb-2">Eat the pile?</div>
              <div className="text-bone-200/80 text-sm leading-relaxed mb-6">
                You will take all <span className="font-mono text-brass-400">{state.pile.length}</span> cards from the pile into your hand.
                Your turn continues — you can play immediately with the new cards.
                <br /><br />
                <span className="text-oxblood-400">Risk:</span> more cards you must get rid of.
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEatConfirm(false)}
                  className="flex-1 py-3.5 rounded-xl bg-felt-700 hover:bg-felt-600 text-bone-200 font-display tracking-wider uppercase text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowEatConfirm(false);
                    onEatPile();
                  }}
                  className="flex-1 py-3.5 rounded-xl bg-oxblood-600 hover:bg-oxblood-500 text-bone-50 font-display tracking-wider uppercase text-sm"
                >
                  Eat the Pile
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PauseSheet
        open={showPause}
        onClose={() => setShowPause(false)}
        onRestart={() => { setShowPause(false); onRestart(); }}
        onMainMenu={() => { setShowPause(false); onMainMenu(); }}
        onHowToPlay={() => setShowHowTo(true)}
        theme={theme}
        onThemeChange={onThemeChange}
      />
      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />
    </div>
  );
}
