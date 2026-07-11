import { AnimatePresence, motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useSwipeGame } from './hooks/useSwipeGame';
import { StartMenu } from './components/StartMenu';
import { GameBoard } from './components/GameBoard';
import { GameOverModal, RoundEndModal } from './components/Modals';
import { GuidanceOverlay } from './components/GuidanceOverlay';
import { loadSavedGame } from './lib/persistence';
import type { GameState } from './game/types';
import type { Theme } from './theme';
export type { Theme } from './theme';

export default function App() {
  const {
    state, startGame, startNextRound, resetToMenu, resumeGame,
    tryPlay, tryFlip, tryResolveFaceDown, tryEatPile, lastError,
    aiThinkingIdx, newAchievements, clearNewAchievements,
  } = useSwipeGame();

  const [savedGame, setSavedGame] = useState<GameState | null>(() => loadSavedGame());

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
      humanCount: state.players.filter(player => player.isHuman).length,
      targetScore: state.targetScore,
      difficulty: state.difficulty,
      rules: state.rules,
      mode: state.mode ?? 'standard',
      seed: state.mode === 'daily' ? state.seed : undefined,
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

      {state && <GuidanceOverlay state={state} />}

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

      <AnimatePresence>
        {newAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-5 left-1/2 z-[100] w-[min(90vw,390px)] -translate-x-1/2 rounded-2xl border border-brass-500/45 bg-felt-900/95 p-4 shadow-2xl backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div className="text-2xl">🏆</div>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-brass-400">Achievement unlocked</div>
                {newAchievements.map(achievement => (
                  <div key={achievement.id} className="mt-1">
                    <div className="font-display font-bold text-bone-100">{achievement.title}</div>
                    <div className="text-xs text-bone-200/65">{achievement.description}</div>
                  </div>
                ))}
              </div>
              <button onClick={clearNewAchievements} className="text-xl leading-none text-bone-200/50" aria-label="Dismiss achievements">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
