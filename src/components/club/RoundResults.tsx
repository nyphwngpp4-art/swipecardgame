import { useState } from 'react';
import type { Card, GameState } from '../../game/types';
import { scoreValue } from '../../game/rules';
import { dailyResultOf, dailyShareText, dailyStreak, loadProgression, ordinal, type Achievement } from '../../lib/progression';
import { Dialog, Icon } from './Primitives';
import { playerName } from './GameTable';

const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 53) % 90) / 100,
  duration: 1.9 + ((i * 29) % 12) / 10,
  hue: ['#c3a267', '#285a46', '#b7554c', '#dfe8dd', '#e6d49a'][i % 5],
  turn: (i % 2 ? 1 : -1) * (200 + ((i * 71) % 300)),
}));

export function RoundResults({ state, achievements = [], onContinue, onRestart, onMenu }: {
  state: GameState; achievements?: Achievement[]; onContinue: () => void; onRestart: () => void; onMenu: () => void;
}) {
  const [shared, setShared] = useState<'idle' | 'copied' | 'failed'>('idle');
  const finished = state.phase === 'gameOver';
  const winnerIdx = finished ? state.gameWinnerIdx : state.winnerIdxThisRound;
  if (winnerIdx === null) return null;
  const won = state.players[winnerIdx].isHuman;
  const humanIdx = state.players.findIndex(player => player.isHuman);
  const history = state.roundHistory ?? [];
  const scores = state.players.map((player, index) => {
    const cards = [...player.hand, ...player.faceUp, ...player.faceDown].filter((card): card is Card => card !== null);
    return {
      index,
      total: state.scores[index],
      added: index === state.winnerIdxThisRound ? 0 : cards.reduce((sum, card) => sum + scoreValue(card), 0),
      rounds: history.map(round => round[index] ?? 0),
    };
  }).sort((a, b) => a.total - b.total);
  const result = dailyResultOf(state, humanIdx);
  const isDaily = finished && state.mode === 'daily' && !!state.seed;
  const streak = isDaily ? dailyStreak(loadProgression()) : 0;

  async function share() {
    const url = typeof location !== 'undefined' && location.protocol.startsWith('http') ? location.origin : undefined;
    const text = dailyShareText(state.seed!, result, streak, url);
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setShared('copied'); }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') setShared('failed');
    }
  }

  const title = won ? finished ? 'A lovely little victory.' : 'Beautifully played!' : `${playerName(state, winnerIdx)} ${finished ? 'takes the game.' : 'wins the round.'}`;
  const subtitle = won
    ? finished ? 'The lowest score. The biggest smile.' : 'All your cards played. Zero points this round.'
    : finished ? `You finished ${ordinal(result.place)} of ${result.players}. A fresh shuffle is a fresh chance.` : 'A fresh hand is on its way. Keep your score low and you’re in the game.';

  return <Dialog title={title} eyebrow={finished ? 'THAT WAS A GOOD GAME' : `ROUND ${state.roundNumber} COMPLETE`} onClose={onMenu}>
    {won && <div className="confetti" aria-hidden="true">{CONFETTI.map((piece, i) => <span key={i} style={{ left: `${piece.left}%`, background: piece.hue, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`, ['--turn' as string]: `${piece.turn}deg` }} />)}</div>}
    <div className={`result-emblem ${won ? 'won' : ''}`}><Icon name={won ? 'trophy' : 'cards'} size={32} /></div>
    <p className="result-subtitle">{subtitle}</p>
    <div className="results-table">
      <div className="results-table-head"><span>Player</span><span>This round</span><span>Total</span></div>
      {scores.map(({ index, total, added, rounds }) => <div className={`results-row ${index === humanIdx ? 'you' : ''}`} key={index}>
        <strong>{playerName(state, index)} {index === winnerIdx ? '✦' : ''}{rounds.length > 1 && <small aria-label={`Points by round: ${rounds.join(', ')}`}>{rounds.join(' · ')}</small>}</strong>
        <span>+{added}</span><b>{total}</b>
        <i className="results-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (total / state.targetScore) * 100)}%` }} className={total >= state.targetScore * 0.75 ? 'is-close' : ''} /></i>
      </div>)}
    </div>
    {!finished && <p className="results-target">The game ends when anyone reaches {state.targetScore} points.</p>}
    <div className="result-facts"><span><b>{state.metrics?.swipes[humanIdx] ?? 0}</b> your swipes</span><span><b>{state.metrics?.burns[humanIdx] ?? 0}</b> your burns</span><span><b>{state.roundNumber}</b> {state.roundNumber === 1 ? 'round' : 'rounds'}</span></div>
    {finished && achievements.length > 0 && <div className="result-milestones" role="status"><Icon name="trophy" size={22} /><div><strong>{achievements.length === 1 ? 'A new milestone' : 'New milestones'}</strong><p>{achievements.map(item => item.title).join(' · ')}</p></div></div>}
    {isDaily && <div className="result-daily"><div><strong>Today’s deal: {ordinal(result.place)} of {result.players}</strong><p>{streak > 1 ? `${streak}-day streak. See you tomorrow.` : 'A new deal arrives tomorrow.'}</p></div><button className="secondary-button" onClick={share}>{shared === 'copied' ? 'Copied ✓' : shared === 'failed' ? 'Couldn’t copy' : 'Share result'}</button></div>}
    <div className="result-actions">
      <button className="primary-button full" onClick={finished ? onRestart : onContinue}>{finished ? 'One more game?' : 'Deal the next round'}<Icon name="cards" /></button>
      <button className="text-button result-home" onClick={onMenu}>{finished ? 'Back to the club' : 'Save & take a break'}<Icon name="home" size={16} /></button>
    </div>
  </Dialog>;
}
