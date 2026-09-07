import { useEffect, useId, useRef, type ReactNode, type CSSProperties } from 'react';
import type { Card } from '../../game/types';

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    play: <path d="m9 5 11 7-11 7Z" />,
    book: <><path d="M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1Z" /><path d="M12 6v14" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="16" cy="17" r="3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    trophy: <><path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-5 0h10" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="4" /></>,
    sound: <><path d="M11 4 5 9H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="M11 4 5 9H2v6h3l6 5Zm5 5 5 6m0-6-5 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
    leaf: <><path d="M20 3C7 1 2 8 5 15s16 5 15-12Z" /><path d="M3 21 15 9" /></>,
    cards: <><rect x="8" y="3" width="13" height="17" rx="2" /><path d="m5 6-3 1 3 15 10-2" /><path d="m14.5 8 3 3.5-3 3.5-3-3.5Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 8a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.2-1 2.7m0 3v.1" /></>,
    history: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2" /></>,
    home: <><path d="m3 10 9-8 9 8v11H3Z" /><path d="M9 21v-8h6v8" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.spark}</svg>;
}

export const suitName: Record<string, string> = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
const rankName: Record<string, string> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
export function cardName(card: Card) { return `${rankName[card.rank] ?? card.rank} of ${suitName[card.suit]}`; }
export function CardFace({ card, back, small, selected, playable, onClick, disabled, label, count, style }: {
  card?: Card; back?: boolean; small?: boolean; selected?: boolean; playable?: boolean;
  onClick?: () => void; disabled?: boolean; label?: string; count?: number; style?: CSSProperties;
}) {
  const content = back ? <><div className="card-back-frame" /><span className="card-back-mark">S<span>♠</span></span></> : card ? <>
    <span className="card-corner"><b>{card.rank}</b><span>{card.suit}</span></span>
    <span className="card-pip">{card.suit}</span>
    <span className="card-corner bottom"><b>{card.rank}</b><span>{card.suit}</span></span>
    {selected && <span className="card-check"><Icon name="check" size={14} /></span>}
    {count && count > 1 ? <span className="card-count">×{count}</span> : null}
  </> : <span className="empty-card">✓</span>;
  const className = `club-card ${back ? 'is-back' : ''} ${small ? 'is-small' : ''} ${card && ['♥', '♦'].includes(card.suit) ? 'red-card' : ''} ${selected ? 'is-selected' : ''} ${playable ? 'is-playable' : ''} ${!card && !back ? 'is-empty' : ''}`;
  return onClick ? <button type="button" data-card-id={card?.id} className={className} style={style} onClick={onClick} disabled={disabled} aria-pressed={back ? undefined : !!selected} aria-label={label ?? (card ? cardName(card) : 'Reveal face-down card')}>{content}</button>
    : <div className={className} style={style} role="img" aria-label={label ?? (back ? 'Face-down card' : card ? cardName(card) : 'Empty card space')}>{content}</div>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}><span className="brand-mark">♠</span><span>swipe<span className="brand-dot">.</span><small>THE CARD CLUB</small></span></div>;
}

export function Dialog({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`club-dialog ${wide ? 'wide-dialog' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="dialog-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></header>
    <div className="dialog-content">{children}</div>
  </dialog>;
}

export function Toggle({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="setting-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" role="switch" checked={value} onChange={event => onChange(event.target.checked)} /><span className="switch-track" aria-hidden="true"><span /></span></label>;
}
