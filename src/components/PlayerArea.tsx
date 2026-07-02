import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { Card, GameState, Rank, SelectedCard } from '../game/types';
import { PlayingCard } from './PlayingCard';
import type { Theme } from '../theme';
import {
  isEqualOrLower,
  isTen,
  topOfPile,
  hasAnyLegalLowerPlay,
  validateMultiPlay,
  countSameRankOnTop,
  getLegalLowerRanks,
  compareValue,
  maxPlayableOfRank,
  cardsOfRank,
} from '../game/rules';
interface Props {
  state: GameState;
  selected: SelectedCard[];
  onToggleSelect: (sel: SelectedCard) => void;
  onClearSelection: () => void;
  onFlipFaceDown: (slot: number) => void;
  onPlay: () => void;
  onResolveFaceDown: (chain: SelectedCard[]) => void;
  pendingChain: SelectedCard[];
  onTogglePendingChain: (sel: SelectedCard) => void;
  launchingIds?: Set<string>;
  onSelectRank?: (rank: string, desiredCount: number) => void;
  onRequestEatPile?: () => void;
  onCardPointerDown?: (e: ReactPointerEvent, sel: SelectedCard) => void;
  draggingCardId?: string | null;
  hideActionBar?: boolean;
  compact?: boolean;
  theme?: Theme;
}

export function PlayerArea({
  state, selected, onToggleSelect, onClearSelection, onFlipFaceDown,
  onPlay, onResolveFaceDown, pendingChain, onTogglePendingChain,
  launchingIds = new Set(), onSelectRank, onRequestEatPile,
  onCardPointerDown, draggingCardId = null, hideActionBar = false, compact = false,
  theme = 'classic',
}: Props) {
  const cardSize = compact ? 'sm' as const : 'md' as const;
  const humanIdx = state.players.findIndex(p => p.isHuman);
  const player = state.players[humanIdx];
  const isMyTurn = state.currentPlayerIdx === humanIdx && state.phase === 'playing';
  const top = topOfPile(state.pile);
  const pending = state.pendingFaceDown && state.pendingFaceDown.playerIdx === humanIdx
    ? state.pendingFaceDown
    : null;

  // Face-up matches for chaining when face-down flipped
  const faceUpChainOptions = pending
    ? player.faceUp
        .map((c, slot) => (c && c.rank === pending.card.rank ? { card: c, slot } : null))
        .filter((x): x is { card: Card; slot: number } => x !== null)
    : [];

  const handHasCards = player.hand.length > 0;
  const faceUpRemaining = player.faceUp.filter(c => c !== null) as Card[];
  const handAndFaceUpEmpty = !handHasCards && faceUpRemaining.length === 0;

  const isCardSelected = (cardId: string) =>
    selected.some(s => s.card.id === cardId);

  const currentSelectedRank = selected.length > 0 ? selected[0].card.rank : null;

  const action = useMemo(() => deriveAction(state, selected, humanIdx), [state, selected, humanIdx]);

  // Compute which ranks are currently legal equal-or-lower plays (for highlighting)
  const legalRanks = useMemo(() => {
    if (!isMyTurn || pending) return new Set<string>();
    const top = topOfPile(state.pile);
    const available: Card[] = [
      ...player.hand,
      ...player.faceUp.filter((c): c is Card => c !== null),
    ];
    return getLegalLowerRanks(available, top);
  }, [state.pile, player.hand, player.faceUp, isMyTurn, pending]);

  const hasTenAvailable = useMemo(
    () => player.hand.some(isTen) || player.faceUp.some(c => c !== null && isTen(c)),
    [player.hand, player.faceUp]
  );

  // Stuck state: it's your turn, pile has cards, nothing equal-or-lower available
  const isStuck = isMyTurn && !pending && !handAndFaceUpEmpty
    && state.pile.length > 0 && legalRanks.size === 0;

  // Group hand into smart stacks by rank — face-up cards live only in the
  // table row below (they'd read as duplicates here)
  const handStacks = useMemo(() => {
    const groups = new Map<string, Card[]>();
    for (const c of player.hand) {
      const arr = groups.get(c.rank) ?? [];
      arr.push(c);
      groups.set(c.rank, arr);
    }
    return Array.from(groups.entries()).sort(
      (a, b) => compareValue(a[1][0]) - compareValue(b[1][0]),
    );
  }, [player.hand]);

  const selectedSummary = selected.length > 0
    ? `${selected.length}×${selected[0].card.rank}`
    : null;

  const bindDrag = (sel: SelectedCard, enabled: boolean) =>
    enabled && onCardPointerDown
      ? (e: ReactPointerEvent) => onCardPointerDown(e, sel)
      : undefined;

  return (
    <div className={`flex flex-col w-full min-w-0 ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {/* Pending face-down chain UI */}
      {pending && (
        <div className="px-3 py-3 bg-felt-800/90 rounded-xl border border-brass-500/40 shadow-inner">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-xs uppercase tracking-widest text-brass-400">Flipped</div>
            <PlayingCard card={pending.card} size="sm" theme={theme} />
            <ChainAdvice pending={pending.card} top={top} />
          </div>
          {(player.hand.some(c => c.rank === pending.card.rank) || faceUpChainOptions.length > 0) && (
            <div className="mb-2">
              <div className="text-xs text-bone-200/60 mb-1">
                Chain matching cards?
              </div>
              {player.hand.some(c => c.rank === pending.card.rank) && (
                <div className="mb-1">
                  <div className="text-[10px] text-bone-200/50 mb-0.5">Hand</div>
                  <div className="flex gap-1">
                    {player.hand
                      .filter(c => c.rank === pending.card.rank)
                      .map(c => (
                        <div key={c.id} onClick={() => onTogglePendingChain({ card: c, source: { kind: 'hand' } })}>
                          <PlayingCard
                            card={c}
                            size="sm"
                            selected={pendingChain.some(p => p.card.id === c.id)}
                            launching={launchingIds.has(c.id)}
                            theme={theme}
                            onClick={() => {}}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {faceUpChainOptions.length > 0 && (
                <div>
                  <div className="text-[10px] text-bone-200/50 mb-0.5">Face-up (play to clear slot)</div>
                  <div className="flex gap-1">
                    {faceUpChainOptions.map(m => (
                      <div key={m.card.id} onClick={() => onTogglePendingChain({ card: m.card, source: { kind: 'faceUp', slot: m.slot } })}>
                        <PlayingCard
                          card={m.card}
                          size="sm"
                          selected={pendingChain.some(p => p.card.id === m.card.id)}
                          launching={launchingIds.has(m.card.id)}
                          theme={theme}
                          onClick={() => {}}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => onResolveFaceDown(pendingChain)}
            className="w-full py-3.5 bg-brass-500 hover:bg-brass-400 active:bg-brass-600
                       text-felt-900 font-display font-bold tracking-wider uppercase rounded-xl active:scale-[0.985] transition-all"
          >
            Confirm Play
          </button>
        </div>
      )}

      {/* Hand — primary interaction; swipe horizontally to reach every rank */}
      {!pending && (
        <div className="w-full min-w-0 pt-1">
          <div className="px-2 mb-0.5 flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-bone-200/40">Hand</span>
            <div className="flex items-baseline gap-2 min-w-0">
              {selectedSummary && (
                <span className="text-[10px] text-brass-400/80 tabular-nums truncate">{selectedSummary}</span>
              )}
              {handStacks.length > 3 && (
                <span className="text-[9px] text-bone-200/25 flex-shrink-0">swipe →</span>
              )}
              <span className="font-mono text-[10px] text-bone-200/30">{player.hand.length}</span>
            </div>
          </div>

          <div data-hand-scroll className="hand-scroll-row w-full min-w-0">
            <div className={`flex gap-2 w-max px-2 pr-10 ${compact ? 'min-h-[76px] pt-1 pb-0.5' : 'min-h-[100px] pt-2 pb-1'}`}>
          {handStacks.length > 0 ? (
            handStacks.map(([rank, cards]) => {
              const count = cards.length;
              const allOfRank = cardsOfRank(player, rank as Rank);
              const isRankSelected = selected.some(s => s.card.rank === rank);
              const selectedCountForRank = selected.filter(s => s.card.rank === rank).length;
              const isLegal = legalRanks.has(rank);

              // Max selectable across hand + face-up, respecting pile 4-of-a-kind cap
              const maxSelectable = (() => {
                if (!isMyTurn || pending) return 0;
                return maxPlayableOfRank(rank as Rank, state.pile, allOfRank);
              })();

              const toggleHandCard = (c: Card) => {
                if (!isMyTurn || pending) return;
                onToggleSelect({ card: c, source: { kind: 'hand' } });
              };

              const handleStackAreaClick = () => {
                if (!isMyTurn || pending) return;

                // One tap selects the max legal play (incl. matching face-up cards).
                // Tap again when fully selected clears.
                if (!isRankSelected || selectedCountForRank < maxSelectable) {
                  onSelectRank?.(rank, maxSelectable);
                  return;
                }
                onClearSelection();
              };

              const handleBadgeClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (!isMyTurn || pending) return;
                if (selectedCountForRank > 0) {
                  onClearSelection();
                } else {
                  // Select the maximum legal play (all cards needed for a swipe when possible)
                  onSelectRank?.(rank, maxSelectable);
                }
              };

              return (
                <div
                  key={rank}
                  onClick={handleStackAreaClick}
                  className={`relative flex-shrink-0 cursor-pointer transition-all active:scale-[0.985] ${!isMyTurn || pending ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <div className={`relative transition-all ${
                    compact
                      ? count >= 5 ? 'w-[68px]' : count >= 4 ? 'w-[58px]' : count === 0 ? 'w-10' : 'w-10'
                      : count >= 5 ? 'w-[84px]' : count >= 4 ? 'w-[72px]' : count === 0 ? 'w-10' : 'w-14'
                  } ${compact ? 'h-14' : 'h-20'} ${isRankSelected ? 'scale-[1.06]' : ''}`}>
                    {cards.length > 4 && (
                      <div className="absolute -top-1.5 left-0 z-30 px-1 py-px rounded-full bg-felt-900 border border-brass-500/50 text-[9px] font-bold text-brass-400 tabular-nums">
                        +{cards.length - 4}
                      </div>
                    )}
                    {cards.slice(0, 4).map((c, idx) => {
                      const thisCardSelected = selected.some(s => s.card.id === c.id);
                      const fanSize = Math.min(cards.length, 4);
                      const baseSpacing = isRankSelected ? -10 : fanSize >= 4 ? -2.5 : -1.5;
                      const leftBase = isRankSelected ? idx * 2 : idx * (fanSize >= 4 ? 3.5 : 5);
                      const rotBase = isRankSelected ? idx * -2 : idx * (fanSize >= 4 ? -3 : -4);
                      const extraLift = thisCardSelected ? -14 : 0;
                      const topPos = (idx * baseSpacing) + extraLift;
                      return (
                        <div
                          key={c.id}
                          className="absolute"
                          style={{
                            left: leftBase,
                            top: topPos,
                            transform: `rotate(${rotBase}deg)`,
                            zIndex: thisCardSelected ? 20 : (10 - idx),
                          }}
                          onClick={(e) => { e.stopPropagation(); toggleHandCard(c); }}
                        >
                          <PlayingCard
                            card={c}
                            size={cardSize}
                            selected={thisCardSelected}
                            legal={isLegal && !isRankSelected}
                            launching={launchingIds.has(c.id)}
                            dragGhost={draggingCardId === c.id}
                            theme={theme}
                            dim={!isMyTurn || !!pending}
                            onPointerDown={bindDrag(
                              { card: c, source: { kind: 'hand' } },
                              isMyTurn && !pending,
                            )}
                          />
                        </div>
                      );
                    })}

                    {/* Count / selected badge — tap to select max legal play or clear */}
                    {count > 1 && (
                      <div
                        onClick={handleBadgeClick}
                        className={`absolute -bottom-1 -right-1 z-20 px-1.5 py-px rounded-full text-[10px] font-bold tabular-nums transition-all cursor-pointer
                          ${selectedCountForRank > 0
                            ? 'bg-brass-400 text-felt-900 scale-110 shadow'
                            : 'bg-felt-800 text-brass-400 border border-brass-600/60'}`}>
                        {selectedCountForRank > 0 ? selectedCountForRank : count}
                      </div>
                    )}
                  </div>

                  <div className={`text-center mt-1 text-xs font-display tracking-tight transition-all
                    ${isRankSelected ? 'text-brass-400 font-semibold' : 'text-bone-200/70'}`}>
                    {rank}
                    {count > 1 && <span className="text-[10px] text-bone-200/40 ml-px">×{count}</span>}
                  </div>
                </div>
              );
            })
          ) : (
            !handHasCards && (
              <div className="text-bone-200/40 italic text-sm py-6 px-2">
                Hand empty — play face-up or flip face-down.
              </div>
            )
          )}
            </div>
          </div>
        </div>
      )}

      {/* Open cards — compact row below hand */}
      {!pending && (
        <div className="flex items-end gap-2 justify-center px-1 pb-0.5">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map(i => {
              const fdCard = player.faceDown[i];
              const fuCard = player.faceUp[i];
              const canFlip = isMyTurn && fuCard === null && fdCard !== null;
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  {fdCard ? (
                    <PlayingCard
                      faceDown
                      size="xs"
                      theme={theme}
                      onClick={canFlip ? () => onFlipFaceDown(i) : undefined}
                      dim={!canFlip}
                    />
                  ) : (
                    <div className="w-7 h-10" />
                  )}
                  {fuCard ? (
                    <PlayingCard
                      card={fuCard}
                      size="xs"
                      selected={isCardSelected(fuCard.id)}
                      legal={legalRanks.has(fuCard.rank)}
                      launching={launchingIds.has(fuCard.id)}
                      dragGhost={draggingCardId === fuCard.id}
                      theme={theme}
                      priority={currentSelectedRank === fuCard.rank && !isCardSelected(fuCard.id)}
                      onClick={isMyTurn ? () => onToggleSelect({
                        card: fuCard,
                        source: { kind: 'faceUp', slot: i },
                      }) : undefined}
                      onPointerDown={bindDrag(
                        { card: fuCard, source: { kind: 'faceUp', slot: i } },
                        isMyTurn,
                      )}
                    />
                  ) : (
                    <div className="w-7 h-10" />
                  )}
                </div>
              );
            })}
          </div>

          {isMyTurn && onRequestEatPile && state.pile.length > 0 && (
            <button
              onClick={onRequestEatPile}
              className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-oxblood-500/60 bg-felt-800 text-[9px] font-display text-oxblood-300 active:scale-95 transition-all"
            >
              EAT
            </button>
          )}
        </div>
      )}

      {isStuck && selected.length === 0 && !pending && (
        <div className="text-center text-[10px] text-brass-400/80 px-2 pb-0.5">
          {hasTenAvailable ? 'Burn with 10 or play high & eat pile' : 'Play high rank — you’ll pick up the pile'}
        </div>
      )}

      {/* Action bar — rendered in GameBoard footer when hideActionBar */}
      {!pending && !hideActionBar && <ActionBar action={action} onPlay={onPlay} compact={compact} />}
    </div>
  );
}

export { deriveAction, ActionBar };

function ChainAdvice({ pending, top }: { pending: Card; top: Card | null }) {
  if (!top) return <div className="text-xs text-bone-200/60">Empty pile — playable.</div>;
  if (isTen(pending)) return <div className="text-xs text-brass-400">10 — burns the pile.</div>;
  if (isEqualOrLower(pending, top)) {
    return <div className="text-xs text-bone-200/60">Equal-or-lower — playable.</div>;
  }
  return <div className="text-xs text-oxblood-500">Higher than top — pile pickup.</div>;
}

/* ----------- ActionBar ------------ */

interface DerivedAction {
  label: string;
  enabled: boolean;
  helper?: string;
  variant: 'play' | 'pickup' | 'flip' | 'disabled';
}

function deriveAction(state: GameState, selected: SelectedCard[], humanIdx: number): DerivedAction {
  if (state.currentPlayerIdx !== humanIdx) {
    return { label: 'Waiting…', enabled: false, variant: 'disabled' };
  }
  if (state.phase !== 'playing') {
    return { label: '—', enabled: false, variant: 'disabled' };
  }

  const player = state.players[humanIdx];
  const handAndFaceUpEmpty =
    player.hand.length === 0 && player.faceUp.every(c => c === null);

  if (handAndFaceUpEmpty) {
    return {
      label: 'Tap a face-down to flip',
      enabled: false,
      variant: 'flip',
      helper: 'Your hand and face-up cards are gone.',
    };
  }

  if (selected.length === 0) {
    return {
      label: 'Select cards to play',
      enabled: false,
      variant: 'disabled',
    };
  }

  const cards = selected.map(s => s.card);
  const top = topOfPile(state.pile);

  const sameRank = cards.every(c => c.rank === cards[0].rank);
  if (!sameRank) {
    return {
      label: 'Multi-cards must match rank',
      enabled: false,
      variant: 'disabled',
    };
  }

  const v = validateMultiPlay(cards, top, state.pile);
  if (!v.ok) {
    return { label: v.reason, enabled: false, variant: 'disabled' };
  }

  const head = cards[0];
  const playingHigher = top !== null && !isTen(head) && !isEqualOrLower(head, top);

  if (playingHigher) {
    const available: Card[] = [
      ...player.hand,
      ...player.faceUp.filter((c): c is Card => c !== null),
    ];
    if (hasAnyLegalLowerPlay(available, top)) {
      return {
        label: 'You have a lower play available',
        enabled: false,
        variant: 'disabled',
        helper: 'Must play equal-or-lower if you can.',
      };
    }
    return {
      label: cards.length === 1
        ? `Play ${head.rank}${head.suit} & pick up pile`
        : `Play ${cards.length} × ${head.rank} & pick up pile`,
      enabled: true,
      variant: 'pickup',
      helper: 'No equal-or-lower play available.',
    };
  }

  if (isTen(head)) {
    return { label: 'Burn pile with 10', enabled: true, variant: 'play' };
  }

  const willMakeFour = top && top.rank === head.rank
    ? countSameRankOnTop(state.pile, head.rank) + cards.length >= 4
    : cards.length >= 4;
  if (willMakeFour) {
    return {
      label: cards.length === 1 ? `Play ${head.rank}${head.suit} — SWIPE!` : `Play ${cards.length} × ${head.rank} — SWIPE!`,
      enabled: true,
      variant: 'play',
    };
  }

  return {
    label: cards.length === 1
      ? `Play ${head.rank}${head.suit}`
      : `Play ${cards.length} × ${head.rank}`,
    enabled: true,
    variant: 'play',
  };
}

function ActionBar({ action, onPlay, compact = false }: { action: DerivedAction; onPlay: () => void; compact?: boolean }) {
  const colorClass =
    action.variant === 'pickup'
      ? 'bg-oxblood-500 hover:bg-oxblood-600 text-bone-50'
      : action.variant === 'play'
      ? 'bg-brass-500 hover:bg-brass-400 active:bg-brass-600 text-felt-900'
      : 'bg-felt-700 text-bone-200/40';

  return (
    <div className="px-2">
      <button
        onClick={action.enabled ? () => onPlay() : undefined}
        disabled={!action.enabled}
        className={`
          w-full ${compact ? 'py-3 text-sm' : 'py-[17px] text-[15px]'} rounded-xl font-display font-bold tracking-[0.06em] uppercase
          transition-all active:scale-[0.985] ${colorClass}
          ${action.enabled ? 'shadow-[0_4px_14px_rgba(0,0,0,0.35)]' : 'cursor-not-allowed opacity-70'}
        `}
      >
        {action.label}
      </button>
      {action.helper && (
        <div className="text-xs text-bone-200/50 text-center mt-1.5">{action.helper}</div>
      )}
    </div>
  );
}
