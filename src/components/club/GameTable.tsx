import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { Card, GameState, Rank, SelectedCard } from '../../game/types';
import { totalCards } from '../../game/engine';
import { cardsOfRank, countSameRankOnTop, hasAnyLegalLowerPlay, isEqualOrLower, maxPlayableOfRank, topOfPile, validateMultiPlay } from '../../game/rules';
import { getRecommendedMove } from '../../game/guidance';
import type { GameError } from '../../hooks/useSwipeGame';
import type { Preferences } from '../../lib/preferences';
import { playSound } from '../../lib/sound';
import { Brand, CardFace, Dialog, Icon, cardName } from './Primitives';
import { cardTilt, deriveFx, describeMove, type TableFx } from './tableFx';

const names = ['You', 'Rose', 'Arthur', 'June', 'Oscar'];
export function playerName(state: GameState, index: number) {
  return state.players[index].name.startsWith('CPU') ? names[index] ?? state.players[index].name : state.players[index].name;
}
export function friendlyLog(state: GameState, line: string) {
  return state.players.reduce((text, player, index) => text.replaceAll(player.name, playerName(state, index)), line)
    .replace('ate the pile', 'took the pile');
}

const RANK_KEYS: Record<string, Rank> = { a: 'A', '1': '10', '0': '10', j: 'J', q: 'Q', k: 'K', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9' };
const FLICK_DISTANCE = 44;

/** How many overlapping card groups fit on one row of the hand. */
function useHandLayout(hasCards: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(99);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cardWidth = el.querySelector<HTMLElement>('.club-card')?.offsetWidth ?? 80;
      const visible = Math.max(30, cardWidth * 0.42);
      setPerRow(Math.max(3, Math.floor((el.clientWidth - cardWidth) / visible) + 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasCards]);
  return { ref, perRow };
}

function chunkRows<T>(items: T[], perRow: number): T[][] {
  if (items.length <= perRow) return [items];
  const rowCount = Math.min(3, Math.ceil(items.length / perRow));
  const size = Math.ceil(items.length / rowCount);
  return Array.from({ length: rowCount }, (_, row) => items.slice(row * size, (row + 1) * size)).filter(row => row.length);
}

export function GameTable({ state, onPlay, onFlip, onResolve, onTake, onPause, onLearn, onSettings, onPauseChange, preferences, lastError, sound, onSound }: {
  state: GameState; onPlay: (cards: SelectedCard[]) => void; onFlip: (slot: number) => void;
  onResolve: (cards: SelectedCard[]) => void; onTake: () => void; onPause: () => void; onLearn: () => void;
  onSettings: () => void; onPauseChange: (paused: boolean) => void; preferences: Preferences; lastError: GameError | null; sound: boolean; onSound: () => void;
}) {
  const humanIdx = state.players.findIndex(p => p.isHuman);
  const player = state.players[humanIdx];
  const isMyTurn = state.currentPlayerIdx === humanIdx && state.phase === 'playing';
  const pending = state.pendingFaceDown?.playerIdx === humanIdx ? state.pendingFaceDown : null;
  const [selected, setSelected] = useState<SelectedCard[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [dialog, setDialog] = useState<'take' | 'history' | 'scores' | null>(null);
  const [flipSlot, setFlipSlot] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [stacked, setStacked] = useState(true);
  const [lastMoves, setLastMoves] = useState<Record<number, string>>({});
  const [fits, setFits] = useState(true);
  const playAreaRef = useRef<HTMLElement>(null);

  // Work out what just happened so the table can animate it. Derived during
  // render (not in an effect) so the very first paint of a new state already
  // carries its animation classes.
  const previous = useRef(state);
  const fxRef = useRef<TableFx | null>(null);
  if (previous.current !== state) {
    fxRef.current = deriveFx(previous.current, state);
    previous.current = state;
  }
  const fx = fxRef.current;

  const top = topOfPile(state.pile);
  const pool: SelectedCard[] = [
    ...player.hand.map(card => ({ card, source: { kind: 'hand' } as const })),
    ...player.faceUp.flatMap((card, slot) => card ? [{ card, source: { kind: 'faceUp', slot } as const }] : []),
  ];
  const available = pool.map(item => item.card);
  const hasLower = hasAnyLegalLowerPlay(available, top, state.rules);
  const hint = getRecommendedMove(state, humanIdx);
  const isSafe = (card: Card) => isEqualOrLower(card, top, state.rules);
  const canUse = (card: Card) => isMyTurn && (pending ? card.rank === pending.card.rank : isSafe(card) || !hasLower);

  useEffect(() => { setSelected([]); setFlipSlot(null); setNotice(''); setShowHint(false); }, [state.turnCount, state.roundNumber, state.currentPlayerIdx]);
  useEffect(() => () => onPauseChange(false), [onPauseChange]);
  useEffect(() => { setLastMoves({}); }, [state.roundNumber, state.seed]);
  useEffect(() => {
    const events = state.events ?? [];
    const line = describeMove(events);
    if (line && events.length) setLastMoves(moves => ({ ...moves, [events[0].playerIdx]: line }));
  }, [state.turnCount, state.events]);
  // Flick-to-play needs vertical drags on cards, so it is only switched on
  // when the table fits the screen and nothing has to scroll.
  useLayoutEffect(() => {
    const el = playAreaRef.current;
    if (!el) return;
    const check = () => setFits(el.scrollHeight <= el.clientHeight + 4);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [player.hand.length, stacked, preferences.largeCards]);

  function openDialog(value: typeof dialog) { setDialog(value); onPauseChange(value !== null); }
  function validSelection(items: SelectedCard[]) {
    const cards = [...(pending ? [pending.card] : []), ...items.map(item => item.card)];
    return validateMultiPlay(cards, top, state.pile, state.rules);
  }
  /** The selection that tapping `items` would produce. */
  function nextSelection(items: SelectedCard[]): SelectedCard[] {
    const same = selected[0]?.card.rank === items[0].card.rank;
    const wanted = [...(same ? selected : []), ...items.filter(item => !same || !selected.some(s => s.card.id === item.card.id))];
    const accepted: SelectedCard[] = [];
    for (const item of wanted) if (validSelection([...accepted, item]).ok) accepted.push(item);
    return accepted;
  }
  function select(items: SelectedCard[]) {
    if (!items.length || !canUse(items[0].card)) return;
    setFlipSlot(null); setNotice('');
    if (items.some(item => selected.some(s => s.card.id === item.card.id))) {
      setSelected(selected.filter(item => !items.some(s => s.card.id === item.card.id))); return;
    }
    const accepted = nextSelection(items);
    if (!accepted.length) setNotice(pending ? 'Confirm the revealed card first. No more matching cards fit this play.' : 'That play is full. Play the selected cards first.');
    setSelected(accepted); playSound('select');
  }
  function useHint() {
    setShowHint(true); setFlipSlot(null);
    const next: SelectedCard[] = [];
    for (const item of pool.filter(item => hint.cardIds.includes(item.card.id))) if (validSelection([...next, item]).ok) next.push(item);
    setSelected(next);
    if (hint.action === 'flip' && !pending) setFlipSlot(player.faceDown.findIndex((card, slot) => card && !player.faceUp[slot]));
  }

  const selectedRank = pending?.card.rank ?? selected[0]?.card.rank;
  const selectedHigher = !!selectedRank && !isSafe(pending?.card ?? selected[0].card);
  const isBurn = selectedRank === '10' && state.rules.tenBurns;
  const playCount = selected.length + (pending ? 1 : 0);
  const isSwipe = !!selectedRank && state.rules.fourOfAKindSwipes && countSameRankOnTop(state.pile, selectedRank) + playCount === 4;
  const sameRankPool = selectedRank ? pool.filter(item => item.card.rank === selectedRank) : [];
  const maxRank = selectedRank ? Math.max(0, maxPlayableOfRank(selectedRank, state.pile, [...(pending ? [pending.card] : []), ...cardsOfRank(player, selectedRank)], state.rules) - (pending ? 1 : 0)) : 0;
  const minCount = pending ? 0 : 1;
  function stepSelection(delta: 1 | -1) {
    if (delta < 0) { if (selected.length > minCount) setSelected(selected.slice(0, -1)); }
    else {
      const extra = sameRankPool.find(item => !selected.some(s => s.card.id === item.card.id));
      if (extra && validSelection([...selected, extra]).ok) setSelected([...selected, extra]);
    }
    playSound('select');
  }

  const canCommit = isMyTurn && (selected.length > 0 || !!pending || flipSlot !== null);
  function commit(cards = selected) {
    if (flipSlot !== null) onFlip(flipSlot);
    else if (pending) onResolve(cards);
    else onPlay(cards);
  }

  /* --- Flick a card up toward the pile to play it ---------------------- */
  const drag = useRef<{ id: number; x: number; y: number; el: HTMLElement; dy: number } | null>(null);
  const dragEndedAt = useRef(0);
  function gestureFor(items: SelectedCard[]) {
    if (!fits || !canUse(items[0].card)) return undefined;
    const finish = (event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) => {
      const active = drag.current;
      if (!active || active.id !== event.pointerId) return;
      drag.current = null;
      active.el.style.removeProperty('--drag');
      active.el.classList.remove('is-dragging');
      if (active.dy > -8) return;
      dragEndedAt.current = Date.now();
      if (cancelled || active.dy > -FLICK_DISTANCE) return;
      const already = items.every(item => selected.some(s => s.card.id === item.card.id));
      const cards = already ? selected : nextSelection(items);
      if (!cards.length) return;
      // A flick only commits a play that costs nothing. Picking up the pile
      // or chaining onto a reveal still goes through the Play button.
      if (!pending && isSafe(cards[0].card)) commit(cards);
      else { setFlipSlot(null); setSelected(cards); playSound('select'); }
    };
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, el: event.currentTarget, dy: 0 };
      },
      onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
        const active = drag.current;
        if (!active || active.id !== event.pointerId) return;
        active.dy = Math.min(0, event.clientY - active.y);
        if (active.dy < -8) {
          if (!active.el.hasPointerCapture(event.pointerId)) active.el.setPointerCapture(event.pointerId);
          active.el.classList.add('is-dragging');
          active.el.style.setProperty('--drag', `${Math.max(active.dy, -130)}px`);
        }
      },
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => finish(event, false),
      onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => finish(event, true),
    };
  }
  const tap = (items: SelectedCard[]) => () => { if (Date.now() - dragEndedAt.current > 350) select(items); };

  /* --- Keyboard: rank keys select, Enter plays, H hints, Esc clears ---- */
  const keys = useRef({ commit, canCommit, select, useHint, isMyTurn, pool, clear: () => { setSelected([]); setFlipSlot(null); }, hasSelection: selected.length > 0 || flipSlot !== null });
  keys.current = { commit, canCommit, select, useHint, isMyTurn, pool, clear: () => { setSelected([]); setFlipSlot(null); }, hasSelection: selected.length > 0 || flipSlot !== null };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      const k = keys.current;
      const key = event.key.toLowerCase();
      if (key === 'enter') {
        const onCard = !!target?.closest('.gt-hand, .gt-mine');
        if (target?.closest('button') && !onCard) return;
        if (k.canCommit) { event.preventDefault(); k.commit(); }
      } else if (key === 'escape' && k.hasSelection) { event.preventDefault(); k.clear(); }
      else if (key === 'h' && k.isMyTurn) { event.preventDefault(); k.useHint(); }
      else if (RANK_KEYS[key] && k.isMyTurn) {
        const matches = k.pool.filter(item => item.card.rank === RANK_KEYS[key]);
        if (matches.length) { event.preventDefault(); k.select(matches); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mainLabel = !isMyTurn ? `${playerName(state, state.currentPlayerIdx)} is playing…`
    : flipSlot !== null ? `Reveal card ${flipSlot + 1}`
    : pending ? `Confirm ${pending.card.rank}${selected.length ? ` + ${selected.length} matching` : ''}`
    : !selected.length ? 'Select cards to play'
    : isBurn ? 'Burn the pile'
    : isSwipe ? 'Swipe the pile'
    : selectedHigher ? `Play ${selectedRank} & pick up`
    : `Play ${selected.length === 1 ? selectedRank : `${selected.length} matching cards`}`;
  const instruction = !isMyTurn ? 'Settle in. Your turn is coming.'
    : pending ? `You revealed ${cardName(pending.card)}. ${selectedHigher ? 'It is too high; you’ll pick up the pile.' : 'It can be played.'}`
    : flipSlot !== null ? 'A little surprise awaits. Once revealed, this card must be played.'
    : selected.length ? (isBurn ? 'Your 10 clears the pile. Then you go again.'
      : isSwipe ? 'Four of a kind! Clear the pile and take another turn.'
      : selectedHigher ? 'Your higher card stays. Take the pile, except cards matching your rank.'
      : `Looking good. ${selected.length > 1 ? 'Matching ranks can be played together.' : 'Add matching cards, or make your move.'}`)
    : !hasLower && available.length ? 'No equal or lower cards. Choose a higher rank and pick up the pile.'
    : top && !(state.rules.twosReset && top.rank === '2') ? `Choose ${top.rank} or lower${state.rules.tenBurns ? ', or a 10 to burn' : ''}.`
    : 'An open table. Choose any rank to get started.';

  /* --- Layout ---------------------------------------------------------- */
  const groups = stacked
    ? [...new Set(player.hand.map(card => card.rank))].map(rank => player.hand.filter(card => card.rank === rank))
    : player.hand.map(card => [card]);
  const { ref: handRef, perRow } = useHandLayout(groups.length > 0);
  const rows = chunkRows(groups, perRow);
  const opponents = state.players.map((opponent, index) => ({ opponent, index })).filter(({ opponent }) => !opponent.isHuman);
  const seatVector = (index: number): CSSProperties => {
    if (index === humanIdx) return { '--fx-x': '0vw', '--fx-y': '34vh' } as CSSProperties;
    const seat = opponents.findIndex(item => item.index === index);
    const spread = opponents.length > 1 ? seat / (opponents.length - 1) - 0.5 : 0;
    return { '--fx-x': `${Math.round(spread * 64)}vw`, '--fx-y': '-30vh' } as CSSProperties;
  };
  const visiblePile = state.pile.slice(-4);
  const onTop = top ? countSameRankOnTop(state.pile, top.rank) : 0;
  const coaching = preferences.coaching || state.mode === 'practice';
  const tableTitle = state.mode === 'daily' ? 'THE DAILY DEAL' : state.mode === 'practice' ? 'THE PRACTICE TABLE' : 'THE CLASSIC TABLE';
  const statusFor = (index: number) => index === state.currentPlayerIdx && state.phase === 'playing' ? 'Thinking…' : lastMoves[index] ?? 'Computer player';
  const hintedIds = showHint || state.mode === 'practice' ? hint.cardIds : [];
  const suggested = lastError?.suggestedCardIds ?? [];

  return <div className="gt-shell" data-large={preferences.largeCards} data-my-turn={isMyTurn} data-rows={Math.max(1, rows.length)}>
    <header className="gt-header">
      <Brand compact />
      <div className="gt-title"><span className="eyebrow">{tableTitle}</span><span>Round {state.roundNumber} <span aria-hidden="true">·</span> {state.targetScore}-point game</span></div>
      <div className="topbar-actions">
        <button className="icon-button gt-sound" onClick={onSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}><Icon name={sound ? 'sound' : 'mute'} /></button>
        <button className="secondary-button gt-pause" onClick={onPause}><Icon name="pause" />Pause</button>
      </div>
    </header>

    <main className="gt-main">
      <section className="gt-play" aria-label="Game table" ref={playAreaRef}>
        <div className="gt-felt">
          <div className="gt-opponents" style={{ '--seats': opponents.length } as CSSProperties}>
            {opponents.map(({ opponent, index }) => <div className={`gt-opponent ${index === state.currentPlayerIdx ? 'is-active' : ''}`} key={opponent.id}>
              <div className="gt-opponent-id">
                <div className={`avatar avatar-${index}`}>{playerName(state, index).slice(0, 1)}</div>
                <div><strong>{playerName(state, index)}</strong><span className="gt-opponent-count">{totalCards(opponent)}<i> cards</i><span> · {state.scores[index]} pts</span></span></div>
              </div>
              <div className="gt-opponent-cards">
                {opponent.faceUp.map((card, slot) => <CardFace key={slot} card={card ?? undefined} back={!card && !!opponent.faceDown[slot]} small />)}
                <span className="gt-opponent-hand" aria-label={`${opponent.hand.length} in hand`}><Icon name="cards" size={13} />{opponent.hand.length}</span>
              </div>
              <span className="gt-opponent-status" key={index === state.currentPlayerIdx ? 'thinking' : lastMoves[index]}>{statusFor(index)}</span>
            </div>)}
          </div>

          <div className="gt-center">
            <span className="gt-wordmark" aria-hidden="true">swipe.</span>
            <div className="gt-pile" role="img" aria-label={top ? `Pile: ${cardName(top)} on top, ${state.pile.length} ${state.pile.length === 1 ? 'card' : 'cards'}` : 'The pile is empty'}>
              <div className="gt-pile-outline" />
              {state.pile.length > 4 && <div className="gt-pile-depth" style={{ '--depth': Math.min(6, Math.ceil(state.pile.length / 4)) } as CSSProperties} />}
              {visiblePile.length === 0 && <div className="gt-pile-empty"><span>♠</span><span>Fresh start</span></div>}
              {visiblePile.map((card, i) => {
                const tilt = cardTilt(card.id);
                const landing = fx?.landed.includes(card.id);
                return <div className={`gt-pile-card ${landing ? 'fx-land' : ''}`} key={card.id} style={{ '--tilt': `${tilt.rotate}deg`, '--dx': `${tilt.x}px`, '--dy': `${tilt.y}px`, '--order': fx?.landed.indexOf(card.id) ?? 0, zIndex: i + 1, ...(landing && fx ? seatVector(fx.actor) : {}) } as CSSProperties}><CardFace card={card} /></div>;
              })}
              {fx?.ghostKind && <div className={`gt-ghost fx-${fx.ghostKind}`} key={fx.key} style={seatVector(fx.actor)} aria-hidden="true">
                {fx.ghost.map((card, i) => { const tilt = cardTilt(card.id); return <div className="gt-pile-card" key={card.id} style={{ '--tilt': `${tilt.rotate}deg`, '--dx': `${tilt.x}px`, '--dy': `${tilt.y}px`, '--order': i } as CSSProperties}><CardFace card={card} /></div>; })}
                {fx.ghostKind === 'burn' && <span className="gt-flame" />}
              </div>}
            </div>
            <div className="gt-pile-info">
              <strong>{top ? `${top.rank} on the pile` : 'The table is open'}</strong>
              <span>{state.pile.length ? `${state.pile.length} ${state.pile.length === 1 ? 'card' : 'cards'} in the pile` : 'Any card can start the pile'}</span>
              {top && state.rules.fourOfAKindSwipes && <div className="gt-meter" role="img" aria-label={`${onTop} of 4 matching cards for a swipe`}>{[1, 2, 3, 4].map(n => <span key={n} className={n <= onTop ? 'filled' : ''} />)}<small>{onTop === 3 ? 'one more swipes!' : '4 to swipe'}</small></div>}
            </div>
            {fx?.banner && <div className="gt-banner" key={fx.key}><Icon name="spark" /><strong>{fx.banner === 'burn' ? 'A lovely burn!' : 'That’s a swipe!'}</strong><span>{fx.actor === humanIdx ? 'You play again' : `${playerName(state, fx.actor)} plays again`}</span></div>}
          </div>

          <div className="gt-mine">
            <span className="eyebrow">{isMyTurn ? <><span className="status-dot" /> YOUR TURN · </> : null}YOUR TABLE CARDS</span>
            <div className="gt-slots">{player.faceUp.map((card, slot) => {
              const hidden = player.faceDown[slot];
              const revealed = pending?.slot === slot;
              const item: SelectedCard | null = card ? { card, source: { kind: 'faceUp', slot } } : null;
              const flippable = !card && !!hidden && isMyTurn && !pending;
              return <div className={`gt-slot ${hidden && card ? 'has-hidden' : ''}`} key={slot}>
                <CardFace small
                  card={revealed ? pending!.card : card ?? undefined}
                  back={!card && !!hidden && !revealed}
                  className={revealed ? 'fx-reveal' : ''}
                  selected={card ? selected.some(s => s.card.id === card.id) : flipSlot === slot}
                  playable={card ? canUse(card) : flippable}
                  onClick={item ? tap([item]) : hidden && !pending ? () => { setFlipSlot(slot); setSelected([]); } : undefined}
                  disabled={card ? !canUse(card) : !isMyTurn || !!pending}
                  label={card ? `${cardName(card)}, table card ${slot + 1}` : `Choose face-down card ${slot + 1}`} />
                <span>{revealed ? 'Revealed' : card ? hidden ? 'Covers a card' : 'Face up' : hidden ? 'Tap to reveal' : 'All clear'}</span>
              </div>;
            })}</div>
          </div>
        </div>

        <div className="gt-toolbar">
          <h2 className="gt-hand-title"><span className="gt-you">Y</span>Your hand <small>{player.hand.length} {player.hand.length === 1 ? 'card' : 'cards'}</small></h2>
          <div className="gt-tools">
            <button className="text-button gt-compact-only" onClick={() => openDialog('scores')}><Icon name="trophy" size={16} /> Scores · {state.scores[humanIdx]} pts</button>
            <button className="text-button gt-compact-only" onClick={() => openDialog('history')}><Icon name="history" size={16} /> Moves</button>
            <button className="text-button" aria-pressed={stacked} onClick={() => setStacked(!stacked)}><Icon name="cards" size={16} />{stacked ? 'Show every card' : 'Stack matching'}</button>
          </div>
        </div>

        <section className="gt-hand" aria-label="Your cards" ref={handRef} data-flick={fits}>
          {rows.length ? rows.map((row, rowIndex) => <div className="gt-hand-row" key={`${state.seed}-${state.roundNumber}-${rowIndex}`}>{row.map(group => {
            const items: SelectedCard[] = group.map(card => ({ card, source: { kind: 'hand' } }));
            const active = group.filter(card => selected.some(item => item.card.id === card.id));
            const usable = canUse(group[0]);
            const nudge = group.some(card => suggested.includes(card.id) || (isMyTurn && !selected.length && hintedIds.includes(card.id)));
            return <div className="gt-hand-group" key={group[0].id}>
              <CardFace card={group[0]} count={group.length} gesture={gestureFor(items)}
                badge={active.length > 0 && group.length > 1 ? `${active.length}/${group.length}` : undefined}
                className={`fx-deal ${nudge ? 'is-hinted' : ''} ${state.rules.tenBurns && group[0].rank === '10' ? 'is-burn' : ''}`}
                onClick={tap(items)} disabled={!usable} selected={active.length > 0} playable={usable}
                label={`${cardName(group[0])}${group.length > 1 ? `, ${group.length} matching cards` : ''}${active.length ? `, ${active.length} selected` : ''}${!usable && isMyTurn ? ', cannot play this turn' : ''}`} />
            </div>;
          })}</div>) : <div className="gt-hand-empty"><Icon name="check" /><span>Your hand is clear. Finish your table cards!</span></div>}
        </section>
      </section>

      <aside className="gt-sidebar">
        <div className="scorecard">
          <div className="side-heading"><span className="eyebrow">THE SCORECARD</span><Icon name="trophy" size={19} /></div>
          <p>Lowest score wins. First to {state.targetScore} ends the game.</p>
          {state.players.map((p, i) => <div className={`score-row ${p.isHuman ? 'you' : ''}`} key={p.id}><span className={`score-avatar avatar-${i}`}>{playerName(state, i)[0]}</span><span>{playerName(state, i)}{p.isHuman && <small>THAT’S YOU</small>}</span><b>{state.scores[i]}<small>pts</small></b></div>)}
          <button className="text-button" onClick={() => openDialog('scores')}>How scoring works <Icon name="arrow" size={16} /></button>
        </div>
        <div className="coach-card">
          <span className="eyebrow">A FRIEND AT THE TABLE</span>
          <h3>{coaching ? hint.title : 'A little help is always here.'}</h3>
          <p>{coaching ? hint.body : 'Ask for a suggestion whenever you’d like one.'}</p>
          <button className="secondary-button" onClick={useHint} disabled={!isMyTurn}>Suggest a move <Icon name="spark" size={17} /></button>
        </div>
        <div className="table-history">
          <div className="side-heading"><span className="eyebrow">AROUND THE TABLE</span><Icon name="history" size={18} /></div>
          {state.log.slice(0, 3).map((line, i) => <p key={`${state.turnCount}-${i}`} className={i === 0 ? 'latest-event' : ''}>{friendlyLog(state, line)}</p>)}
          <button className="text-button" onClick={() => openDialog('history')}>Recent moves <Icon name="arrow" size={16} /></button>
        </div>
        <p className="gt-keys"><b>Keys</b> A–K pick a rank · Enter plays · H hint · Esc clears</p>
        <button className="text-button table-comfort" onClick={onSettings}><Icon name="settings" size={18} /> Make yourself comfortable</button>
      </aside>
    </main>

    <p className="sr-only" role="log" aria-live="polite">{state.currentPlayerIdx !== humanIdx || !fx || fx.actor !== humanIdx ? friendlyLog(state, state.log[0] ?? '') : ''}</p>

    <div className="gt-dock">
      <div className={`gt-guidance ${isMyTurn ? 'is-mine' : ''} ${lastError ? 'is-error' : ''}`} role="status" aria-live="polite" key={lastError?.nonce ?? 'ok'}>
        <span className="gt-guidance-icon"><Icon name={isMyTurn ? 'play' : 'clock'} size={22} /></span>
        <div><strong>{isMyTurn ? pending ? 'A little reveal…' : 'Your move. Take your time.' : `${playerName(state, state.currentPlayerIdx)}’s turn`}</strong><p>{lastError?.message || notice || (showHint ? hint.body : instruction)}</p></div>
      </div>
      <div className="gt-actions">
        <button className="secondary-button gt-hint" onClick={useHint} disabled={!isMyTurn}><Icon name="spark" size={18} />Hint</button>
        {selected.length > 0 || flipSlot !== null
          ? <button className="text-button" onClick={() => { setSelected([]); setFlipSlot(null); }}>Clear</button>
          : <button className="text-button" disabled={!isMyTurn || !state.pile.length || !!pending} onClick={() => openDialog('take')}>Take pile</button>}
        {selectedRank && flipSlot === null && (maxRank > 1 || sameRankPool.length > 1) && <div className="gt-stepper" role="group" aria-label={`How many ${selectedRank}s to play`}>
          <button onClick={() => stepSelection(-1)} disabled={selected.length <= minCount} aria-label={`One fewer ${selectedRank}`}>−</button>
          <span aria-live="polite">{selected.length}<small> of {Math.min(sameRankPool.length, Math.max(maxRank, selected.length))}</small></span>
          <button onClick={() => stepSelection(1)} disabled={selected.length >= Math.min(sameRankPool.length, maxRank)} aria-label={`One more ${selectedRank}`}>+</button>
        </div>}
        <button className={`primary-button play-action ${canCommit ? 'is-ready' : ''}`} disabled={!canCommit} onClick={() => commit()}>{mainLabel}<Icon name="arrow" size={19} /></button>
        <button className="icon-button gt-help" onClick={onLearn} aria-label="How to play"><Icon name="help" /></button>
      </div>
    </div>

    {dialog === 'take' && <Dialog title="Take the pile?" eyebrow="A STRATEGIC CHOICE" onClose={() => openDialog(null)}>
      <p className="panel-intro">Add all {state.pile.length} pile cards to your hand. You keep your turn and can then play any rank. It can pay off when the pile holds cards that complete a four of a kind for you.</p>
      <div className="dialog-actions"><button className="secondary-button" onClick={() => openDialog(null)}>Keep playing</button><button className="primary-button" onClick={() => { openDialog(null); /* Allow the pause state to clear before committing. */ setTimeout(onTake, 0); }}>Take {state.pile.length} cards</button></div>
    </Dialog>}
    {dialog === 'history' && <Dialog title="Around the table" eyebrow="RECENT MOVES" onClose={() => openDialog(null)}><ol className="history-list">{state.log.map((line, i) => <li key={i}>{friendlyLog(state, line)}</li>)}</ol></Dialog>}
    {dialog === 'scores' && <Dialog title="The scorecard" eyebrow="LOWEST SCORE WINS" onClose={() => openDialog(null)}>
      <div className="scoring-values">{state.players.map((p, i) => <span key={p.id}>{playerName(state, i)}<b>{state.scores[i]} pts</b></span>)}</div>
      <p className="panel-intro">Empty all your cards to win the round and score zero. Everyone else adds the value of their remaining cards.</p>
      <div className="scoring-values"><span>Ace <b>1</b></span><span>2–9 <b>Face value</b></span><span>Jack, Queen, King <b>10</b></span><span>10 <b>20</b></span></div>
      <p className="panel-intro">When anyone reaches {state.targetScore} points, the game ends. The lowest total wins.</p>
      <button className="primary-button full" onClick={() => openDialog(null)}>Back to the game</button>
    </Dialog>}
  </div>;
}
