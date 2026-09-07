import { useCallback, useEffect, useState } from 'react';
import { useSwipeGame } from './hooks/useSwipeGame';
import { Lobby, loadHouseRules } from './components/club/Lobby';
import { GameTable } from './components/club/GameTable';
import { ComfortPanel, LearnPanel, ProgressPanel } from './components/club/ClubPanels';
import { RoundResults } from './components/club/RoundResults';
import { Dialog, Icon } from './components/club/Primitives';
import { loadSavedGame } from './lib/persistence';
import { loadPreferences, savePreferences } from './lib/preferences';
import { isMuted, setMuted, playSound } from './lib/sound';
import type { NewGameOptions } from './game/engine';
import type { Theme } from './theme';
import './club.css';
export type { Theme } from './theme';

type Panel = 'learn' | 'settings' | 'progress' | 'pause' | 'restart' | null;
export default function App() {
  const [panel, setPanel] = useState<Panel>(null);
  const [boardPaused, setBoardPaused] = useState(false);
  const [preferences, setPreferences] = useState(loadPreferences);
  const [sound, setSound] = useState(() => !isMuted());
  const [savedGame, setSavedGame] = useState(loadSavedGame);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem('swipe-theme') === 'casino' ? 'casino' : 'classic'; } catch { return 'classic'; }
  });
  const game = useSwipeGame({ paused: panel !== null || boardPaused, pace: preferences.pace });
  const { state } = game;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('swipe-theme', theme); } catch { /* Optional storage. */ }
  }, [theme]);
  useEffect(() => {
    savePreferences(preferences);
    document.documentElement.dataset.gentle = String(preferences.reducedMotion);
  }, [preferences]);
  const onPauseChange = useCallback((value: boolean) => setBoardPaused(value), []);
  function toggleSound() { setMuted(sound); setSound(!sound); if (!sound) playSound('select'); }
  function start(options: NewGameOptions) { setPanel(null); setBoardPaused(false); game.startGame(options); }
  function restart() {
    if (!state) return;
    start({ numPlayers: state.players.length, humanCount: state.players.filter(player => player.isHuman).length, targetScore: state.targetScore, difficulty: state.difficulty, rules: state.rules, mode: state.mode ?? 'standard', seed: state.mode === 'daily' ? state.seed : undefined });
  }
  function menu() { setPanel(null); setBoardPaused(false); game.resetToMenu(); setSavedGame(loadSavedGame()); }
  function continueGame() { if (savedGame) { setPanel(null); setBoardPaused(false); game.resumeGame(savedGame); } }
  const closePanel = () => setPanel(null);
  return <div className="swipe-app">
    {state ? <GameTable state={state} onPlay={game.tryPlay} onFlip={game.tryFlip} onResolve={game.tryResolveFaceDown} onTake={game.tryEatPile} onPause={() => setPanel('pause')} onLearn={() => setPanel('learn')} onSettings={() => setPanel('settings')} onPauseChange={onPauseChange} preferences={preferences} lastError={game.lastError} sound={sound} onSound={toggleSound} /> : <Lobby savedGame={savedGame} onContinue={continueGame} onStart={start} onLearn={() => setPanel('learn')} onSettings={() => setPanel('settings')} onProgress={() => setPanel('progress')} sound={sound} onSound={toggleSound} />}
    {panel === 'settings' && <ComfortPanel preferences={preferences} onChange={setPreferences} theme={theme} onThemeChange={setTheme} sound={sound} onSound={toggleSound} onClose={closePanel} />}
    {panel === 'learn' && <LearnPanel onClose={closePanel} rules={state?.rules ?? loadHouseRules()} />}
    {panel === 'progress' && <ProgressPanel onClose={closePanel} />}
    {panel === 'pause' && state && <Dialog title="We’ll keep your seat." eyebrow="GAME PAUSED" onClose={closePanel}><div className="pause-art"><Icon name="leaf" size={44} /></div><p className="panel-intro centered">Take a breath. Put the kettle on.<br />Everyone at the table can wait.</p><button className="primary-button full" onClick={closePanel}>Back to the game <Icon name="play" /></button><div className="pause-options"><button onClick={() => setPanel('settings')}><Icon name="settings" /> Comfort settings <Icon name="arrow" /></button><button onClick={() => setPanel('learn')}><Icon name="book" /> How to play <Icon name="arrow" /></button><button onClick={menu}><Icon name="home" /> Save & return to the club <Icon name="arrow" /></button><button onClick={() => setPanel('restart')}><Icon name="cards" /> Start a fresh game <Icon name="arrow" /></button></div><p className="form-footnote">Your game saves automatically on this device.</p></Dialog>}
    {panel === 'restart' && <Dialog title="Ready for a fresh shuffle?" eyebrow="START AGAIN" onClose={() => setPanel('pause')}><p className="panel-intro">This replaces your current game and scores. Your table settings stay the same.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setPanel('pause')}>Keep this game</button><button className="primary-button" onClick={restart}>Shuffle & deal</button></div></Dialog>}
    {state && (state.phase === 'roundEnd' || state.phase === 'gameOver') && <RoundResults state={state} onContinue={game.startNextRound} onRestart={restart} onMenu={menu} />}
    {game.newAchievements.length > 0 && !state && <div className="achievement-toast" role="status"><Icon name="trophy" /><div><strong>A new little milestone</strong><p>{game.newAchievements.map(item => item.title).join(' · ')}</p></div><button className="icon-button" onClick={game.clearNewAchievements} aria-label="Dismiss achievement"><Icon name="close" /></button></div>}
  </div>;
}
