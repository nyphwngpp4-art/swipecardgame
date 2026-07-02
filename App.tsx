import { AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { useSwipeGame } from './hooks/useSwipeGame';
import { StartMenu } from './components/StartMenu';
import { GameBoard } from './components/GameBoard';
import { GameOverModal, RoundEndModal } from './components/Modals';
import { loadSavedGame } from './lib/persistence';
import type { GameState } from './game/types';

import type { Theme } from './theme';
export type { Theme } from './theme';

export default function App() {
  const {
    state, startGame, startNextRound, resetToMenu, resumeGame,
    tryPlay, tryFlip, tryResolveFaceDown, tryEatPile, lastError,
    aiThinkingIdx,
  } = useSwipeGame();

  const [savedGame, setSavedGame] = useState<GameState | null>(() => loadSavedGame());

  // Re-check the save whenever we land on the menu (e.g. after Main Menu mid-game)
  useEffect(() => {
    if (!state) setSavedGame(loadSavedGame());
  }, [state]);

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('swipe-theme') as Theme | null;
    return saved === 'casino' ? 'casino' : 'classic';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('swipe-theme', theme);
  }, [theme]);

  const restartGame = () => {
    if (!state) return;
    startGame({
      numPlayers: state.players.length,
      humanCount: state.players.filter(p => p.isHuman).length,
      targetScore: state.targetScore,
      difficulty: state.difficulty,
    });
  };

  return (
    <div className="h-full w-full max-w-[520px] md:max-w-[620px] mx-auto relative px-1">
      <AnimatePresence mode="wait">
        {!state ? (
          <StartMenu
            key="menu"
            onStart={startGame}
            theme={theme}
            onThemeChange={setTheme}
            savedGame={savedGame}
            onContinue={() => savedGame && resumeGame(savedGame)}
          />
        ) : (
          <GameBoard
            key="board"
            state={state}
            onPlay={tryPlay}
            onFlipFaceDown={tryFlip}
            onResolveFaceDown={tryResolveFaceDown}
            lastError={lastError}
            aiThinkingIdx={aiThinkingIdx}
            onEatPile={tryEatPile}
            onRestart={restartGame}
            onMainMenu={resetToMenu}
            theme={theme}
            onThemeChange={setTheme}
          />
        )}
      </AnimatePresence>

      {state?.phase === 'roundEnd' && (
        <RoundEndModal state={state} onContinue={startNextRound} />
      )}
      {state?.phase === 'gameOver' && (
        <GameOverModal
          state={state}
          onNewGame={restartGame}
          onMainMenu={resetToMenu}
        />
      )}
    </div>
  );
}
