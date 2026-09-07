import { useEffect, useState } from 'react';
import type { Card, GameState, SelectedCard } from '../../game/types';
import { totalCards } from '../../game/engine';
import { cardsOfRank, countSameRankOnTop, hasAnyLegalLowerPlay, isEqualOrLower, maxPlayableOfRank, topOfPile, validateMultiPlay } from '../../game/rules';
import { getRecommendedMove } from '../../game/guidance';
import type { GameError } from '../../hooks/useSwipeGame';
import type { Preferences } from '../../lib/preferences';
import { playSound } from '../../lib/sound';
import { Brand, CardFace, Dialog, Icon, cardName } from './Primitives';

const names = ['You', 'Rose', 'Arthur', 'June', 'Oscar'];
export function playerName(state: GameState, index: number) {
  return state.players[index].name.startsWith('CPU') ? names[index] ?? state.players[index].name : state.players[index].name;
}
export function friendlyLog(state: GameState, line: string) {
  return state.players.reduce((text, player, index) => text.replaceAll(player.name, playerName(state, index)), line)
    .replace('ate the pile', 'took the pile');
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
  const top = topOfPile(state.pile);
  const pool: SelectedCard[] = [
    ...player.hand.map(card => ({ card, source: { kind: 'hand' } as const })),
    ...player.faceUp.flatMap((card, slot) => card ? [{ card, source: { kind: 'faceUp', slot } as const }] : []),
  ];
  const available = pool.map(item => item.card);
  const hasLower = hasAnyLegalLowerPlay(available, top, state.rules);
  const hint = getRecommendedMove(state, humanIdx);
  const canUse = (card: Card) => isMyTurn && (pending ? card.rank === pending.card.rank : isEqualOrLower(card, top, state.rules) || !hasLower);
  useEffect(() => { setSelected([]); setFlipSlot(null); setNotice(''); setShowHint(false); }, [state.turnCount, state.roundNumber, state.currentPlayerIdx]);
  useEffect(() => () => onPauseChange(false), [onPauseChange]);
  function openDialog(value: typeof dialog) { setDialog(value); onPauseChange(value !== null); }
  function validSelection(items: SelectedCard[]) {
    const cards = [...(pending ? [pending.card] : []), ...items.map(item => item.card)];
    return validateMultiPlay(cards, top, state.pile, state.rules);
  }
  function select(items: SelectedCard[]) {
    if (!items.length || !canUse(items[0].card)) return;
    setFlipSlot(null); setNotice('');
    if (items.some(item => selected.some(s => s.card.id === item.card.id))) {
      setSelected(selected.filter(item => !items.some(s => s.card.id === item.card.id))); return;
    }
    const same = selected[0]?.card.rank === items[0].card.rank;
    const next = [...(same ? selected : []), ...items.filter(item => !same || !selected.some(s => s.card.id === item.card.id))];
    let accepted: SelectedCard[] = [];
    for (const item of next) if (validSelection([...accepted, item]).ok) accepted.push(item);
    if (!accepted.length) setNotice(pending ? 'Confirm the revealed card first. No more matching cards fit this play.' : 'That play is full. Play the selected cards first.');
    setSelected(accepted); playSound('select');
  }
  function selectMatches() {
    const rank = pending?.card.rank ?? selected[0]?.card.rank;
    if (!rank) return;
    const matches = pool.filter(item => item.card.rank === rank);
    let next: SelectedCard[] = [];
    for (const match of matches) if (validSelection([...next, match]).ok) next.push(match);
    setSelected(next);
  }
  function useHint() {
    setShowHint(true); setFlipSlot(null);
    let next: SelectedCard[] = [];
    for (const item of pool.filter(item => hint.cardIds.includes(item.card.id))) if (validSelection([...next, item]).ok) next.push(item);
    setSelected(next);
    if (hint.action === 'flip' && !pending) setFlipSlot(player.faceDown.findIndex((card, slot) => card && !player.faceUp[slot]));
  }
  const groups = stacked ? [...new Set(player.hand.map(card => card.rank))].map(rank => player.hand.filter(card => card.rank === rank)) : player.hand.map(card => [card]);
  const selectedRank = pending?.card.rank ?? selected[0]?.card.rank;
  const selectedHigher = selectedRank && !isEqualOrLower(pending?.card ?? selected[0].card, top, state.rules);
  const isBurn = selectedRank === '10' && state.rules.tenBurns;
  const playCount = selected.length + (pending ? 1 : 0);
  const isSwipe = selectedRank && state.rules.fourOfAKindSwipes && countSameRankOnTop(state.pile, selectedRank) + playCount === 4;
  const mainLabel = !isMyTurn ? `${playerName(state, state.currentPlayerIdx)} is playing…` : flipSlot !== null ? `Reveal card ${flipSlot + 1}` : pending ? `Confirm ${pending.card.rank}${selected.length ? ` + ${selected.length} matching` : ''}` : !selected.length ? 'Select cards to play' : isBurn ? 'Burn the pile' : isSwipe ? 'Swipe the pile' : selectedHigher ? `Play ${selectedRank} & pick up` : `Play ${selected.length === 1 ? selectedRank : `${selected.length} matching cards`}`;
  const instruction = !isMyTurn ? 'Settle in. Your turn is coming.' : pending ? `You revealed ${cardName(pending.card)}. ${selectedHigher ? 'It is too high; you’ll pick up the pile.' : 'It can be played.'}` : flipSlot !== null ? 'A little surprise awaits. Once revealed, this card must be played.' : selected.length ? isBurn ? 'Your 10 clears the pile. Then you go again.' : isSwipe ? 'Four of a kind! Clear the pile and take another turn.' : selectedHigher ? 'Your higher card stays. Take the pile, except cards matching your rank.' : `Looking good. ${selected.length > 1 ? 'Matching ranks can be played together.' : 'Add matching cards, or make your move.'}` : !hasLower && available.length ? 'No equal or lower cards. Choose a higher rank and pick up the pile.' : top && !(state.rules.twosReset && top.rank === '2') ? `Choose ${top.rank} or lower${state.rules.tenBurns ? ', or a 10 to burn' : ''}.` : 'An open table. Choose any rank to get started.';
  const celebration = (state.events ?? []).find(event => event.type === 'burn' || event.type === 'swipe');
  const maxRank = selectedRank ? maxPlayableOfRank(selectedRank, state.pile, cardsOfRank(player, selectedRank), state.rules) : 0;
  return <div className={`game-shell ${preferences.largeCards ? 'large-cards' : ''}`}>
    <header className="game-header"><Brand compact /><div className="game-title"><span className="eyebrow">{state.mode === 'daily' ? 'THE DAILY DEAL' : state.mode === 'practice' ? 'THE PRACTICE TABLE' : 'THE CLASSIC TABLE'}</span><span>Round {state.roundNumber} <span className="header-dot">·</span> {state.targetScore}-point game</span></div><div className="topbar-actions"><button className="icon-button sound-control" onClick={onSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}><Icon name={sound ? 'sound' : 'mute'} /></button><button className="secondary-button pause-button" onClick={onPause}><Icon name="pause" />Pause</button></div></header>
    <main className="game-layout"><section className="table-column" aria-label="Game table"><div className="felt-table"><div className="felt-inner-line" /><div className="opponents">{state.players.map((opponent, index) => !opponent.isHuman && <div className={`opponent ${index === state.currentPlayerIdx ? 'active-player' : ''}`} key={opponent.id}><div className={`avatar avatar-${index}`}>{playerName(state, index).slice(0, 1)}<span>{['♠', '♥', '♣', '♦'][index - 1]}</span></div><strong>{playerName(state, index)}</strong><span className="opponent-count">{totalCards(opponent)} cards <span>· {state.scores[index]} pts</span></span><div className="opponent-table-cards">{opponent.faceUp.map((card, slot) => <CardFace key={slot} card={card ?? undefined} back={!card && !!opponent.faceDown[slot]} small />)}</div><span className="opponent-turn">{index === state.currentPlayerIdx ? 'Thinking…' : 'Computer player'}</span></div>)}</div>
      <div className="pile-stage"><span className="table-wordmark" aria-hidden="true">swipe.</span><div className="pile-display"><div className="pile-outline" />{top ? <><div className="pile-shadow-card" /><CardFace card={top} /></> : <div className="empty-pile"><span>♠</span><span>Fresh start</span></div>}</div><div className="pile-caption"><strong>{top ? `${top.rank} on the pile` : 'The table is open'}</strong><span>{state.pile.length ? `${state.pile.length} ${state.pile.length === 1 ? 'card' : 'cards'} in the pile` : 'Any card can start the pile'}</span></div>{top && state.rules.fourOfAKindSwipes && <div className="swipe-meter" aria-label={`${countSameRankOnTop(state.pile, top.rank)} of 4 matching cards for a swipe`}>{[1, 2, 3, 4].map(n => <span key={n} className={n <= countSameRankOnTop(state.pile, top.rank) ? 'filled' : ''} />)}<small>4 to swipe</small></div>}{celebration && <div className="table-celebration" key={state.turnCount}><Icon name="spark" /><strong>{celebration.type === 'burn' ? 'A lovely burn!' : 'That’s a swipe!'}</strong><span>{playerName(state, celebration.playerIdx)} plays again</span></div>}</div>
      <div className="table-bottom-strip"><span><span className="status-dot" /> {isMyTurn ? 'YOUR TURN' : `${playerName(state, state.currentPlayerIdx).toUpperCase()}’S TURN`}</span><span>No timer. Take your time.</span></div></div>
      <div className="mobile-table-tools"><button className="text-button" onClick={() => openDialog('scores')}><Icon name="trophy" size={17} /> Scores · {state.scores[humanIdx]} pts</button><button className="text-button" onClick={() => openDialog('history')}><Icon name="history" size={17} /> Recent moves</button><button className="text-button" onClick={onLearn}><Icon name="help" size={17} /> Rules</button></div>
      <section className="hand-section" aria-label="Your cards"><div className="hand-heading"><div><span className="your-avatar">Y</span><h2>Your hand <small>{player.hand.length} cards</small></h2></div><button className="text-button" aria-pressed={stacked} onClick={() => setStacked(!stacked)}><Icon name="cards" size={17} />{stacked ? 'Show every card' : 'Stack matching'}</button></div>
      <div className="hand-cards">{groups.length ? groups.map(group => {
        const active = group.filter(card => selected.some(item => item.card.id === card.id));
        return <div className="hand-card-group" key={group[0].id}><CardFace card={group[0]} count={group.length} onClick={() => select(group.map(card => ({ card, source: { kind: 'hand' } })))} disabled={!canUse(group[0])} selected={active.length > 0} playable={canUse(group[0])} label={`${cardName(group[0])}${group.length > 1 ? `, ${group.length} matching cards` : ''}${active.length ? `, ${active.length} selected` : ''}${!canUse(group[0]) && isMyTurn ? ', cannot play this turn' : ''}`} /><span className="card-group-label">{active.length ? `${active.length} selected` : state.rules.tenBurns && group[0].rank === '10' ? 'BURNS PILE' : canUse(group[0]) ? 'PLAYABLE' : ' '}</span></div>;
      }) : <div className="empty-hand"><Icon name="check" /><span>Your hand is clear. Finish your table cards!</span></div>}</div>
      <div className="your-table"><div className="your-table-copy"><span className="eyebrow">YOUR TABLE CARDS</span><p>Play the face-up card.<br />Discover what’s underneath.</p></div><div className="table-slots">{player.faceUp.map((card, slot) => <div className={`table-slot ${player.faceDown[slot] && card ? 'has-hidden' : ''}`} key={slot}>
        <CardFace small card={pending?.slot === slot ? pending.card : card ?? undefined} back={!card && !!player.faceDown[slot] && pending?.slot !== slot} selected={card ? selected.some(s => s.card.id === card.id) : flipSlot === slot} playable={card ? canUse(card) : isMyTurn && !pending && !!player.faceDown[slot]} onClick={card ? () => select([{ card, source: { kind: 'faceUp', slot } }]) : player.faceDown[slot] && !pending ? () => { setFlipSlot(slot); setSelected([]); } : undefined} disabled={card ? !canUse(card) : !isMyTurn || !!pending} label={card ? `${cardName(card)}, table card ${slot + 1}` : `Choose face-down card ${slot + 1}`} /><span>{pending?.slot === slot ? 'Revealed' : card ? 'Face up' : player.faceDown[slot] ? 'Tap to reveal' : 'All clear'}</span></div>)}</div></div></section>
    </section><aside className="table-sidebar"><div className="scorecard"><div className="side-heading"><span className="eyebrow">THE SCORECARD</span><Icon name="trophy" size={19} /></div><h3>A little friendly competition.</h3><p>Lowest score wins.</p>{state.players.map((p, i) => <div className={`score-row ${p.isHuman ? 'you' : ''}`} key={p.id}><span className={`score-avatar avatar-${i}`}>{playerName(state, i)[0]}</span><span>{playerName(state, i)}{p.isHuman && <small>THAT’S YOU</small>}</span><b>{state.scores[i]}<small>pts</small></b></div>)}<button className="text-button" onClick={() => openDialog('scores')}>How scoring works <Icon name="arrow" size={16} /></button></div>
      <div className="coach-card"><span className="mode-icon gold-icon"><Icon name="spark" /></span><span className="eyebrow">A FRIEND AT THE TABLE</span><h3>{preferences.coaching || state.mode === 'practice' ? hint.title : 'A little help is always here.'}</h3><p>{preferences.coaching || state.mode === 'practice' ? hint.body : 'Ask for a suggestion whenever you’d like one.'}</p><button className="secondary-button" onClick={useHint} disabled={!isMyTurn}>Suggest a move <Icon name="spark" size={17} /></button></div>
      <div className="table-history"><div className="side-heading"><span className="eyebrow">AROUND THE TABLE</span><Icon name="history" size={18} /></div>{state.log.slice(0, 3).map((line, i) => <p key={`${state.turnCount}-${i}`} className={i === 0 ? 'latest-event' : ''}>{friendlyLog(state, line)}</p>)}<button className="text-button" onClick={() => openDialog('history')}>Recent moves <Icon name="arrow" size={16} /></button></div><button className="text-button table-comfort" onClick={onSettings}><Icon name="settings" size={18} /> Make yourself comfortable</button>
    </aside></main>
    <div className="turn-dock"><div className={`turn-guidance ${isMyTurn ? 'your-turn' : ''}`} role="status" aria-live="polite"><span className="turn-symbol"><Icon name={isMyTurn ? 'play' : 'clock'} size={22} /></span><div><strong>{isMyTurn ? pending ? 'A little reveal…' : 'Your move. Take your time.' : `${playerName(state, state.currentPlayerIdx)}’s turn`}</strong><p>{lastError?.message || notice || (showHint ? hint.body : instruction)}</p></div></div><div className="turn-actions"><button className="secondary-button hint-button" onClick={useHint} disabled={!isMyTurn}><Icon name="spark" size={18} />Hint</button>{selectedRank && maxRank > selected.length && <button className="text-button add-matching" onClick={selectMatches}>Add matching</button>}{selected.length > 0 || flipSlot !== null ? <button className="text-button clear-button" onClick={() => { setSelected([]); setFlipSlot(null); }}>Clear</button> : <button className="text-button take-button" disabled={!isMyTurn || !state.pile.length || !!pending} onClick={() => openDialog('take')}>Take pile</button>}<button className="primary-button play-action" disabled={!isMyTurn || (!selected.length && !pending && flipSlot === null)} onClick={() => { if (flipSlot !== null) onFlip(flipSlot); else if (pending) onResolve(selected); else onPlay(selected); }}>{mainLabel}<Icon name="arrow" size={19} /></button><button className="icon-button rules-help" onClick={onLearn} aria-label="How to play"><Icon name="help" /></button></div></div>
    {dialog === 'take' && <Dialog title="Take the pile?" eyebrow="A STRATEGIC CHOICE" onClose={() => openDialog(null)}><p className="panel-intro">Add all {state.pile.length} pile cards to your hand. You keep your turn and can then play any rank.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => openDialog(null)}>Keep playing</button><button className="primary-button" onClick={() => { openDialog(null); /* Allow the pause state to clear before committing. */ setTimeout(onTake, 0); }}>Take {state.pile.length} cards</button></div></Dialog>}
    {dialog === 'history' && <Dialog title="Around the table" eyebrow="RECENT MOVES" onClose={() => openDialog(null)}><ol className="history-list">{state.log.map((line, i) => <li key={i}>{friendlyLog(state, line)}</li>)}</ol></Dialog>}
    {dialog === 'scores' && <Dialog title="The scorecard" eyebrow="LOWEST SCORE WINS" onClose={() => openDialog(null)}><div className="scoring-values">{state.players.map((p, i) => <span key={p.id}>{playerName(state, i)}<b>{state.scores[i]} pts</b></span>)}</div><p className="panel-intro">Empty all your cards to win the round and score zero. Everyone else adds the value of their remaining cards.</p><div className="scoring-values"><span>Ace <b>1</b></span><span>2–9 <b>Face value</b></span><span>Jack, Queen, King <b>10</b></span><span>10 <b>20</b></span></div><p className="panel-intro">When anyone reaches {state.targetScore} points, the game ends. The lowest total wins.</p><button className="primary-button full" onClick={() => openDialog(null)}>Back to the game</button></Dialog>}
  </div>;
}
