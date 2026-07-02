import { useState } from 'react';
import { motion } from 'motion/react';
import type { NewGameOptions } from '../game/engine';
import type { GameState } from '../game/types';
import type { Theme } from '../theme';
import { HowToPlayModal } from './Modals';

interface Props {
  onStart: (opts: NewGameOptions) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  savedGame?: GameState | null;
  onContinue?: () => void;
}

export function StartMenu({ onStart, theme, onThemeChange, savedGame, onContinue }: Props) {
  const toggleTheme = () => onThemeChange(theme === 'classic' ? 'casino' : 'classic');
  const [numPlayers, setNumPlayers] = useState(4);
  const [targetScore, setTargetScore] = useState<100 | 200 | 300>(100);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showHowTo, setShowHowTo] = useState(false);
  const humanCount = 1; // CPU-only opponents for now

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-full w-full flex flex-col items-center justify-center px-6 py-12 safe-top safe-bottom"
    >
      <div className="max-w-md w-full">
        {/* Title block */}
        <div className="text-center mb-10">
          <div className="text-brass-400/70 text-lg tracking-[0.5em] mb-1 select-none">♠ ♥ ♦ ♣</div>
          <div className="font-display text-6xl font-black tracking-tight text-bone-50">
            Swipe
          </div>
          <div className="text-brass-400 text-sm tracking-[0.3em] uppercase mt-1">
            A card game of nerve &amp; timing
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={toggleTheme}
              className="text-xs px-3 py-1.5 rounded-full border border-brass-400/50 text-brass-400 hover:bg-brass-400/10 active:scale-95 transition"
              title="Toggle theme"
            >
              {theme === 'classic' ? '♣ Classic' : '✨ Casino'}
            </button>
            <button
              onClick={() => setShowHowTo(true)}
              className="text-xs px-3 py-1.5 rounded-full border border-bone-200/30 text-bone-200/70 hover:bg-white/5 active:scale-95 transition"
            >
              How to play
            </button>
          </div>
        </div>

        {/* Continue card — shown when an interrupted game is saved */}
        {savedGame && onContinue && (
          <ContinueCard saved={savedGame} onContinue={onContinue} />
        )}

        <div className="space-y-7">
          <Field label="Players">
            <div className="grid grid-cols-3 gap-2">
              {[3, 4, 5].map(n => (
                <Choice key={n} active={numPlayers === n} onClick={() => setNumPlayers(n)}>
                  {n}
                </Choice>
              ))}
            </div>
            <div className="mt-2 text-xs text-bone-200/60">You + {numPlayers - 1} CPU</div>
          </Field>

          <Field label="Loss threshold">
            <div className="grid grid-cols-3 gap-2">
              {[100, 200, 300].map(n => (
                <Choice key={n} active={targetScore === n} onClick={() => setTargetScore(n as 100 | 200 | 300)}>
                  {n}
                </Choice>
              ))}
            </div>
            <div className="mt-2 text-xs text-bone-200/60">
              First to {targetScore} loses. Lowest total wins.
            </div>
          </Field>

          <Field label="AI Difficulty">
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <Choice key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                  {d === 'easy' ? 'Easy' : d === 'medium' ? 'Medium' : 'Hard'}
                </Choice>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-10 space-y-3">
          <button
            onClick={() => onStart({ numPlayers, humanCount, targetScore, difficulty })}
            className="w-full py-4 bg-brass-500 hover:bg-brass-400 active:bg-brass-600 active:scale-[0.99]
                       text-felt-900 font-display font-bold text-lg tracking-wider uppercase
                       rounded-xl transition-all shadow-lg"
          >
            Deal
          </button>
          <button
            onClick={() => onStart({ numPlayers: 3, humanCount: 1, targetScore: 100, difficulty: 'easy' })}
            className="w-full py-3.5 bg-felt-700 hover:bg-felt-600 active:scale-[0.99] text-bone-200 font-display font-bold tracking-wider uppercase
                       rounded-xl transition-all border border-brass-400/40"
          >
            Practice Game
          </button>
          <div className="text-[10px] text-center text-bone-200/50">
            Short, easy 3-player game with in-game tips — the fastest way to learn.
          </div>
          {savedGame && (
            <div className="text-[10px] text-center text-bone-200/40">
              Starting a new deal replaces your saved game.
            </div>
          )}
        </div>
      </div>

      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />
    </motion.div>
  );
}

function ContinueCard({ saved, onContinue }: { saved: GameState; onContinue: () => void }) {
  const humanIdx = saved.players.findIndex(p => p.isHuman);
  const yourScore = humanIdx >= 0 ? saved.scores[humanIdx] : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 p-4 rounded-2xl bg-felt-800/80 border border-brass-500/40 shadow-lg"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-brass-400 font-bold mb-1">
            Game in progress
          </div>
          <div className="text-sm text-bone-200/80">
            Round {saved.roundNumber} · {saved.players.length} players · you:{' '}
            <span className="font-mono text-brass-400">{yourScore} pts</span>
          </div>
        </div>
        <div className="text-2xl select-none" aria-hidden>🂠</div>
      </div>
      <button
        onClick={onContinue}
        className="w-full py-3.5 bg-brass-500 hover:bg-brass-400 active:bg-brass-600 active:scale-[0.99]
                   text-felt-900 font-display font-bold tracking-wider uppercase rounded-xl transition-all"
      >
        Continue
      </button>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.25em] text-brass-400 mb-3 font-bold">{label}</div>
      {children}
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`
        py-3 rounded-xl font-display font-bold text-lg transition-all active:scale-[0.97]
        ${active
          ? 'bg-bone-100 text-felt-900 shadow-md'
          : 'bg-felt-700 text-bone-200/70 hover:bg-felt-600 border border-felt-600'}
      `}
    >
      {children}
    </button>
  );
}
