import { useState } from 'react';
import type { NewGameOptions } from '../../game/engine';
import type { GameMode, GameState, HouseRules } from '../../game/types';
import { DEFAULT_RULES } from '../../game/rules';
import { dailySeed, loadProgression } from '../../lib/progression';
import { Brand, CardFace, Dialog, Icon, Toggle } from './Primitives';

interface Props {
  savedGame: GameState | null; onContinue: () => void; onStart: (options: NewGameOptions) => void;
  onLearn: () => void; onSettings: () => void; onProgress: () => void; sound: boolean; onSound: () => void;
}
export function loadHouseRules(): HouseRules {
  try { const rules = JSON.parse(localStorage.getItem('swipe-house-rules') || '{}'); return Object.fromEntries(Object.entries(DEFAULT_RULES).map(([key, value]) => [key, typeof rules[key] === 'boolean' ? rules[key] : value])) as unknown as HouseRules; }
  catch { return { ...DEFAULT_RULES }; }
}
export function Lobby({ savedGame, onContinue, onStart, onLearn, onSettings, onProgress, sound, onSound }: Props) {
  const [setup, setSetup] = useState<GameMode | null>(null);
  const [players, setPlayers] = useState(3);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [targetScore, setTargetScore] = useState<100 | 200 | 300>(100);
  const [rules, setRules] = useState(loadHouseRules);
  const [showRules, setShowRules] = useState(false);
  const progress = loadProgression();
  const today = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric' }).format(new Date());
  const dailyWon = progress.dailyWins.includes(dailySeed());
  function start() {
    if (!setup) return;
    try { localStorage.setItem('swipe-house-rules', JSON.stringify(rules)); } catch { /* Optional storage. */ }
    onStart({ numPlayers: setup === 'daily' ? 4 : setup === 'practice' ? 3 : players, humanCount: 1, targetScore: setup === 'daily' ? 100 : targetScore, difficulty: setup === 'practice' ? 'easy' : setup === 'daily' ? 'medium' : difficulty, mode: setup, seed: setup === 'daily' ? dailySeed() : undefined, rules: setup === 'daily' ? DEFAULT_RULES : rules });
  }
  return <div className="club-shell">
    <aside className="club-sidebar"><Brand /><nav aria-label="Main navigation"><button className="nav-item active" aria-current="page"><Icon name="cards" /> Let’s play <span>✦</span></button><button className="nav-item" onClick={onLearn}><Icon name="book" /> How to play</button><button className="nav-item" onClick={onProgress}><Icon name="trophy" /> Your collection</button></nav><div className="sidebar-note"><span>♧</span><p>A good hand.<br />A little luck.<br /><em>A lovely time.</em></p><div className="tiny-suits">♠ <i>♥</i> ♣ <i>♦</i></div></div><button className="nav-item settings-link" onClick={onSettings}><Icon name="settings" /> Make it yours</button><div className="sidebar-bottom">Pull up a chair. Stay a while.</div></aside>
    <main className="lobby-main"><header className="lobby-topbar"><div className="mobile-brand"><Brand compact /></div><div className="welcome-line"><span className="status-dot" /> YOUR FAVOURITE SEAT IS WAITING</div><div className="topbar-actions"><button className="icon-button" onClick={onSound} aria-label={sound ? 'Turn sound off' : 'Turn sound on'}><Icon name={sound ? 'sound' : 'mute'} /></button><button className="icon-button" onClick={onSettings} aria-label="Comfort settings"><Icon name="settings" /></button></div></header>
      <section className="lobby-hero"><div className="hero-copy"><span className="hero-label"><span /> THE SIMPLE PLEASURE OF A GOOD GAME</span><h1>Good company.<br /><em>Great cards.</em></h1><p>A familiar favourite with a fresh shuffle.<br />Settle in, take your time, and make your move.</p><button className="cream-button" onClick={savedGame ? onContinue : () => setSetup('standard')}><Icon name="play" />{savedGame ? 'Continue your game' : 'Let’s play Swipe'}<Icon name="arrow" /></button><div className="hero-assurance"><Icon name="check" size={16} /> No rush. No sign-up. Just one more round.</div></div>
      <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><span className="hero-spark spark-one">✦</span><span className="hero-spark spark-two">✧</span><div className="hero-card fan-one"><CardFace back /></div><div className="hero-card fan-two"><CardFace card={{ id: 'hero-q', rank: 'Q', suit: '♣' }} /></div><div className="hero-card fan-three"><CardFace card={{ id: 'hero-a', rank: 'A', suit: '♥' }} /></div><div className="hero-card fan-four"><CardFace card={{ id: 'hero-k', rank: 'K', suit: '♠' }} /></div><span className="hero-seal"><span>ONE MORE</span><b>♠</b><span>ROUND?</span></span><div className="hero-caption">A little strategy. A lovely escape.</div></div></section>
      <section className="choose-section"><div className="section-heading"><div><span className="eyebrow">THERE’S A SEAT FOR EVERY MOOD</span><h2>How would you like to play?</h2></div><span className="subtle-caption">Your turn to unwind.</span></div><div className="mode-grid">
        <button className="mode-card" onClick={() => setSetup('standard')}><span className="mode-icon green-icon"><Icon name="leaf" size={27} /></span><span className="mode-kicker">YOUR EVERYDAY FAVOURITE</span><strong>Classic table</strong><p>Friendly computer players.<br />Your rules. Your pace.</p><span className="mode-bottom">Make yourself at home <Icon name="arrow" /></span></button>
        <button className="mode-card daily-card" onClick={() => setSetup('daily')}><span className="mode-icon gold-icon"><Icon name="sun" size={28} /></span><span className="daily-date">{today}</span><span className="mode-kicker">A LITTLE DAILY RITUAL</span><strong>The daily deal</strong><p>A fresh challenge every day.<br />The same starting deal for everyone.</p><span className="mode-bottom">{dailyWon ? 'Today’s deal won ✓' : 'See what today holds'} <Icon name="arrow" /></span></button>
        <button className="mode-card" onClick={() => setSetup('practice')}><span className="mode-icon rose-icon"><Icon name="book" size={27} /></span><span className="mode-kicker">A HELPING HAND</span><strong>Easy does it</strong><p>A gentle practice table.<br />Learn a little with every turn.</p><span className="mode-bottom">Find your feet <Icon name="arrow" /></span></button>
      </div></section>
      <section className="club-bottom"><div className="tip-block"><span className="tip-icon"><Icon name="spark" size={23} /></span><div><span className="eyebrow">A LITTLE TABLE WISDOM</span><p>Four of a kind? That’s a swipe. Clear the pile, take another turn.</p></div><button className="text-button" onClick={onLearn}>Learn the game <Icon name="arrow" size={17} /></button></div><button className="collection-preview" onClick={onProgress}><span className="collection-medal"><Icon name="trophy" size={23} /></span><span><strong>{progress.gamesWon ? `${progress.gamesWon} lovely victories` : 'Your first win is waiting'}</strong><small>{progress.achievements.length} of 7 milestones collected</small></span><Icon name="arrow" size={18} /></button></section>
      <footer className="lobby-footer"><span>Made for the love of the game.</span><span>♠ <i>♥</i> ♣ <i>♦</i></span><button onClick={onLearn}>Need a hand?</button></footer>
    </main>
    {setup && <Dialog title={setup === 'daily' ? 'Today’s little challenge' : setup === 'practice' ? 'A little practice, a lot of fun' : 'Set your table'} eyebrow={setup === 'daily' ? `THE DAILY DEAL · ${today}` : 'COME ON IN'} onClose={() => setSetup(null)}>
      <p className="panel-intro">{setup === 'daily' ? 'Four players, classic rules, and the same starting cards for everyone today. Your choices shape the game.' : setup === 'practice' ? 'Three players, gentle opponents, and helpful advice. There’s no timer. Take all the time you need.' : 'A friendly game against computer players. Choose what feels right.'}</p>
      {savedGame && <div className="save-notice"><Icon name="history" /><span>A new game replaces your saved game from round {savedGame.roundNumber}. <button className="text-button" onClick={onContinue}>Continue that game instead</button></span></div>}
      {setup === 'standard' && <><div className="setting-block"><strong>Seats at the table</strong><div className="segmented">{[3, 4, 5].map(n => <button key={n} aria-pressed={players === n} onClick={() => setPlayers(n)}>{n} players</button>)}</div></div><div className="setting-block"><strong>A little challenge?</strong><div className="segmented">{(['easy', 'medium', 'hard'] as const).map(value => <button key={value} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{value === 'easy' ? 'Gentle' : value === 'medium' ? 'Balanced' : 'Clever'}</button>)}</div></div></>}
      {setup !== 'daily' && <><div className="setting-block"><strong>Score limit <span className="muted">· lowest score wins</span></strong><div className="segmented">{([100, 200, 300] as const).map(score => <button key={score} aria-pressed={targetScore === score} onClick={() => setTargetScore(score)}>{score} points</button>)}</div></div><button className="rules-disclosure" onClick={() => setShowRules(!showRules)} aria-expanded={showRules}><span>House rules</span><span>{showRules ? '−' : '+'}</span></button>{showRules && <div className="house-rules"><Toggle label="10s burn the pile" description="Play a 10 on anything, clear the pile, go again." value={rules.tenBurns} onChange={tenBurns => setRules({ ...rules, tenBurns })} /><Toggle label="Four of a kind swipes" description="Four matching ranks on top clear the pile." value={rules.fourOfAKindSwipes} onChange={fourOfAKindSwipes => setRules({ ...rules, fourOfAKindSwipes })} /><Toggle label="2s reset the pile" description="After a 2, the next player can play any rank." value={rules.twosReset} onChange={twosReset => setRules({ ...rules, twosReset })} /></div>}</>}
      <button className="primary-button full" onClick={start}>Shuffle & deal <Icon name="cards" /></button><p className="form-footnote">Your game saves automatically on this device.</p>
    </Dialog>}
  </div>;
}
