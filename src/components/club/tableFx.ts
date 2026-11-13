import type { Card, GameEvent, GameState } from '../../game/types';

/** What the table should animate for the action that produced `next`. */
export interface TableFx {
  /** Changes with every action so CSS animations restart. */
  key: number;
  actor: number;
  /** Ids of cards that just arrived on the pile. */
  landed: string[];
  /** Cards that just left the pile (burned, swiped, or picked up). */
  ghost: Card[];
  ghostKind: 'burn' | 'swipe' | 'pickup' | null;
  /** Short banner for a pile-clearing move. */
  banner: 'burn' | 'swipe' | null;
}

const LAYING: GameEvent['type'][] = ['play', 'faceDownSuccess', 'faceDownFailure'];

export function deriveFx(prev: GameState, next: GameState): TableFx | null {
  if (prev === next || prev.roundNumber !== next.roundNumber) return null;
  if ((next.turnCount ?? 0) === (prev.turnCount ?? 0)) return null;
  const events = next.events ?? [];
  if (events.length === 0) return null;
  const actor = events[0].playerIdx;
  const played = events.filter(event => LAYING.includes(event.type)).flatMap(event => event.cards ?? []);
  const has = (type: GameEvent['type']) => events.some(event => event.type === type);
  const fx: TableFx = { key: next.turnCount ?? 0, actor, landed: played.map(card => card.id), ghost: [], ghostKind: null, banner: null };
  if (has('burn') || has('swipe')) {
    fx.ghost = [...prev.pile, ...played].slice(-4);
    fx.ghostKind = has('burn') ? 'burn' : 'swipe';
    fx.banner = fx.ghostKind;
    fx.landed = [];
  } else if (has('pickup') || has('eat')) {
    const staying = new Set(next.pile.map(card => card.id));
    fx.ghost = prev.pile.filter(card => !staying.has(card.id)).slice(-4);
    fx.ghostKind = 'pickup';
  }
  return fx;
}

function rankCount(cards: Card[] | undefined): string {
  if (!cards || cards.length === 0) return 'a card';
  return cards.length === 1 ? `${cards[0].rank}${cards[0].suit}` : `${cards.length}× ${cards[0].rank}`;
}

/** One short line describing what a player just did, for the seat label. */
export function describeMove(events: GameEvent[]): string | null {
  if (events.length === 0) return null;
  const find = (type: GameEvent['type']) => events.find(event => event.type === type);
  const laid = events.find(event => LAYING.includes(event.type));
  const pickup = find('pickup');
  if (find('roundEnd')) return 'Went out!';
  if (find('burn')) return 'Burned the pile';
  if (find('swipe')) return `Swiped with ${rankCount(laid?.cards)}`;
  if (find('eat')) return `Took the pile (${find('eat')!.count ?? 0})`;
  if (pickup && find('faceDownFailure')) return `Flipped ${rankCount(laid?.cards)}, took ${pickup.count ?? 0}`;
  if (pickup) return `Played ${rankCount(laid?.cards)}, took ${pickup.count ?? 0}`;
  if (find('faceDownSuccess')) return `Flipped ${rankCount(laid?.cards)}`;
  if (find('flip')) return 'Flipping a card…';
  if (laid) return `Played ${rankCount(laid.cards)}`;
  return null;
}

/** Stable small rotation/offset per card so the pile looks hand-placed. */
export function cardTilt(id: string): { rotate: number; x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const unit = (shift: number) => (((hash >> shift) & 0xff) / 255) * 2 - 1;
  return { rotate: unit(0) * 9, x: unit(8) * 5, y: unit(16) * 4 };
}
