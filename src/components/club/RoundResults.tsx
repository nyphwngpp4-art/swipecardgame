import type { Card, GameState } from '../../game/types';
import { scoreValue } from '../../game/rules';
import { Dialog, Icon } from './Primitives';
import { playerName } from './GameTable';

export function RoundResults({ state, onContinue, onRestart, onMenu }: { state: GameState; onContinue: () => void; onRestart: () => void; onMenu: () => void }) {
  const finished = state.phase === 'gameOver';
  const winnerIdx = finished ? state.gameWinnerIdx : state.winnerIdxThisRound;
  if (winnerIdx === null) return null;
  const won = state.players[winnerIdx].isHuman;
  const humanIdx = state.players.findIndex(player => player.isHuman);
  const scores = state.players.map((player, index) => {
    const cards = [...player.hand, ...player.faceUp, ...player.faceDown].filter((card): card is Card => card !== null);
    return { index, total: state.scores[index], added: index === state.winnerIdxThisRound ? 0 : cards.reduce((sum, card) => sum + scoreValue(card), 0) };
  }).sort((a, b) => a.total - b.total);
  return <Dialog title={won ? finished ? 'A lovely little victory.' : 'Beautifully played!' : `${playerName(state, winnerIdx)} ${finished ? 'takes the game.' : 'wins the round.'}`} eyebrow={finished ? 'THAT WAS A GOOD GAME' : `ROUND ${state.roundNumber} COMPLETE`} onClose={onMenu}>
    <div className={`result-emblem ${won ? 'won' : ''}`}><Icon name={won ? 'trophy' : 'cards'} size={44} /></div><p className="result-subtitle">{won ? finished ? 'The lowest score. The biggest smile.' : 'All your cards played. Zero points this round.' : finished ? 'A fresh shuffle is a fresh chance. There’s always another hand.' : 'A fresh hand is on its way. Keep your score low and you’re in the game.'}</p>
    <div className="results-table"><div className="results-table-head"><span>Player</span><span>This round</span><span>Total</span></div>{scores.map(({ index, total, added }) => <div className={`results-row ${index === humanIdx ? 'you' : ''}`} key={index}><strong>{playerName(state, index)} {index === winnerIdx ? '✦' : ''}</strong><span>+{added}</span><b>{total}</b></div>)}</div>
    <div className="result-facts"><span><b>{state.metrics?.swipes[humanIdx] ?? 0}</b> your swipes</span><span><b>{state.metrics?.burns[humanIdx] ?? 0}</b> your burns</span><span><b>{state.roundNumber}</b> {state.roundNumber === 1 ? 'round' : 'rounds'}</span></div>
    <button className="primary-button full" onClick={finished ? onRestart : onContinue}>{finished ? 'One more game?' : 'Deal the next round'}<Icon name="cards" /></button><button className="text-button result-home" onClick={onMenu}>{finished ? 'Back to the club' : 'Save & take a break'}<Icon name="home" size={16} /></button>
  </Dialog>;
}
