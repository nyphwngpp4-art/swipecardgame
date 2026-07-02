import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import type { GameState, Card } from '../game/types';
import { scoreValue } from '../game/rules';
import { isMuted, setMuted, playSound } from '../lib/sound';
import type { Theme } from '../theme';

/* ---------------- Round end ---------------- */

interface RoundEndProps {
  state: GameState;
  onContinue: () => void;
}

/** Points this player just added this round (cards still in their layout at round end). */
function roundPoints(state: GameState, idx: number): number {
  if (idx === state.winnerIdxThisRound) return 0;
  const p = state.players[idx];
  const remaining: Card[] = [
    ...p.hand,
    ...p.faceUp.filter((c): c is Card => c !== null),
    ...p.faceDown.filter((c): c is Card => c !== null),
  ];
  return remaining.reduce((sum, c) => sum + scoreValue(c), 0);
}

export function RoundEndModal({ state, onContinue }: RoundEndProps) {
  const winnerIdx = state.winnerIdxThisRound;
  if (winnerIdx === null) return null;
  const winner = state.players[winnerIdx];

  return (
    <Backdrop>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-felt-800 rounded-2xl p-7 max-w-sm w-full border border-brass-500/30"
      >
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-[0.3em] text-brass-400 mb-2">Round {state.roundNumber}</div>
          <div className="font-display text-3xl font-bold">{winner.name} went out</div>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-xs uppercase tracking-widest text-bone-200/50 mb-1 px-3">
            <span>Player</span>
            <span>Round / Total</span>
          </div>
          {state.players.map((p, i) => {
            const gained = roundPoints(state, i);
            return (
              <div
                key={p.id}
                className={`flex justify-between items-center py-2 px-3 rounded-lg ${
                  i === winnerIdx ? 'bg-brass-500/20' : 'bg-felt-700/50'
                }`}
              >
                <span className={i === winnerIdx ? 'text-brass-400 font-bold' : 'text-bone-100'}>
                  {p.name}{i === winnerIdx ? ' ✦' : ''}
                </span>
                <span className="font-mono text-sm">
                  <span className={gained === 0 ? 'text-brass-400' : 'text-oxblood-500'}>
                    +{gained}
                  </span>
                  <span className="text-bone-200/40 mx-1.5">/</span>
                  <span className="text-bone-100">{state.scores[i]}</span>
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={onContinue}
          className="w-full py-4 bg-brass-500 hover:bg-brass-400 active:scale-[0.985] text-felt-900
                     font-display font-bold tracking-wider uppercase rounded-xl transition-all"
        >
          Next Round
        </button>
      </motion.div>
    </Backdrop>
  );
}

/* ---------------- Game over ---------------- */

interface GameOverProps {
  state: GameState;
  onNewGame: () => void;
  onMainMenu: () => void;
}

export function GameOverModal({ state, onNewGame, onMainMenu }: GameOverProps) {
  const winnerIdx = state.gameWinnerIdx;
  if (winnerIdx === null) return null;
  const winner = state.players[winnerIdx];
  const sortedByScore = state.players
    .map((p, i) => ({ player: p, score: state.scores[i], idx: i }))
    .sort((a, b) => a.score - b.score);

  return (
    <Backdrop>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-felt-800 rounded-2xl p-7 max-w-sm w-full border border-brass-500/40"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
            className="text-5xl mb-2"
          >
            🏆
          </motion.div>
          <div className="text-xs uppercase tracking-[0.3em] text-brass-400 mb-2">Game Over</div>
          <div className="font-display text-4xl font-black">{winner.name} win{winner.isHuman ? '' : 's'}</div>
          <div className="text-bone-200/60 text-sm mt-1">{state.scores[winnerIdx]} points · {state.roundNumber} round{state.roundNumber === 1 ? '' : 's'}</div>
        </div>

        <div className="space-y-2 mb-6">
          {sortedByScore.map(({ player, score, idx }, rank) => (
            <div
              key={player.id}
              className={`flex justify-between py-2 px-3 rounded-lg ${
                idx === winnerIdx ? 'bg-brass-500/20' : 'bg-felt-700/50'
              }`}
            >
              <span>
                <span className="text-bone-200/40 mr-2 font-mono text-sm">#{rank + 1}</span>
                <span className={idx === winnerIdx ? 'text-brass-400 font-bold' : 'text-bone-100'}>
                  {player.name}
                </span>
              </span>
              <span className="font-mono">{score}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onNewGame}
            className="w-full py-4 bg-brass-500 hover:bg-brass-400 active:scale-[0.985] text-felt-900
                       font-display font-bold tracking-wider uppercase rounded-xl transition-all"
          >
            Play Again
          </button>
          <button
            onClick={onMainMenu}
            className="w-full py-3 bg-felt-700 hover:bg-felt-600 active:scale-[0.985] text-bone-200
                       font-display tracking-wider uppercase rounded-xl text-sm transition-all"
          >
            Main Menu
          </button>
        </div>
      </motion.div>
    </Backdrop>
  );
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Pause sheet ---------------- */

interface PauseSheetProps {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onHowToPlay: () => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export function PauseSheet({ open, onClose, onRestart, onMainMenu, onHowToPlay, theme, onThemeChange }: PauseSheetProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [confirmLeave, setConfirmLeave] = useState<null | 'restart' | 'menu'>(null);

  useEffect(() => {
    if (open) {
      setSoundEnabled(!isMuted());
      setConfirmLeave(null);
    }
  }, [open]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setMuted(!next);
    setSoundEnabled(next);
    if (next) playSound('select');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={e => e.stopPropagation()}
            className="bg-felt-800 border border-brass-500/30 rounded-t-2xl sm:rounded-2xl p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] w-full max-w-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="font-display text-2xl text-bone-100 tracking-tight">Paused</div>
              <button
                onClick={onClose}
                className="text-bone-200/60 hover:text-bone-200 text-2xl leading-none w-10 h-10 -mr-2 flex items-center justify-center"
                aria-label="Resume"
              >
                ×
              </button>
            </div>

            {!confirmLeave ? (
              <div className="space-y-3">
                {/* Sound toggle */}
                <div className="flex items-center justify-between bg-felt-700/60 rounded-xl px-4 py-3">
                  <div>
                    <div className="text-bone-100 font-medium">Sound</div>
                    <div className="text-xs text-bone-200/50">Card plays, swipes &amp; burns</div>
                  </div>
                  <button
                    onClick={toggleSound}
                    role="switch"
                    aria-checked={soundEnabled}
                    className={`relative w-14 h-8 rounded-full transition-colors ${soundEnabled ? 'bg-brass-500' : 'bg-felt-600'}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-all flex items-center justify-center text-[10px] font-bold
                        ${soundEnabled ? 'translate-x-6 text-brass-600' : 'text-felt-700'}`}
                    >
                      {soundEnabled ? '♪' : '×'}
                    </div>
                  </button>
                </div>

                {/* Theme picker */}
                <div className="bg-felt-700/60 rounded-xl px-4 py-3">
                  <div className="text-bone-100 font-medium mb-2">Table theme</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['classic', 'casino'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => onThemeChange(t)}
                        className={`py-2.5 rounded-lg text-sm font-display tracking-wide transition-all
                          ${theme === t
                            ? 'bg-brass-500 text-felt-900 font-bold'
                            : 'bg-felt-800 text-bone-200/70 border border-felt-600'}`}
                      >
                        {t === 'classic' ? '♣ Classic' : '✨ Casino'}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={onHowToPlay}
                  className="w-full py-3.5 bg-felt-700/60 hover:bg-felt-700 rounded-xl text-bone-100 font-medium text-left px-4 transition-colors"
                >
                  How to play
                </button>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => setConfirmLeave('restart')}
                    className="py-3.5 bg-felt-700 hover:bg-felt-600 rounded-xl text-bone-200 font-display tracking-wider uppercase text-sm transition-colors"
                  >
                    Restart
                  </button>
                  <button
                    onClick={() => setConfirmLeave('menu')}
                    className="py-3.5 bg-felt-700 hover:bg-felt-600 rounded-xl text-bone-200 font-display tracking-wider uppercase text-sm transition-colors"
                  >
                    Main Menu
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-4 bg-brass-500 hover:bg-brass-400 active:scale-[0.985] rounded-xl text-felt-900 font-display font-bold tracking-wider uppercase transition-all"
                >
                  Resume
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-bone-100 leading-relaxed">
                  {confirmLeave === 'restart'
                    ? 'Restart the game with the same settings? Current progress will be lost.'
                    : 'Leave to the main menu? Your game is saved — you can continue it anytime.'}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setConfirmLeave(null)}
                    className="py-3.5 bg-felt-700 hover:bg-felt-600 rounded-xl text-bone-200 font-display tracking-wider uppercase text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmLeave === 'restart' ? onRestart : onMainMenu}
                    className="py-3.5 bg-oxblood-600 hover:bg-oxblood-500 rounded-xl text-bone-50 font-display tracking-wider uppercase text-sm"
                  >
                    {confirmLeave === 'restart' ? 'Restart' : 'Leave'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- How to play ---------------- */

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

const RULES: Array<{ title: string; body: string }> = [
  { title: 'Goal', body: 'Be first to empty all 20 of your cards — 12 in hand, 4 face-up, 4 face-down. The winner of a round scores 0; everyone else scores what they still hold.' },
  { title: 'Play equal or lower', body: 'On your turn, play a card equal to or lower than the top of the pile. Aces are low. You can play several cards of the same rank at once.' },
  { title: '10 burns the pile', body: 'A 10 is always playable. It clears the pile and you go again. But careful — a 10 left in your hand at round end costs 20 points.' },
  { title: 'Four of a kind swipes', body: 'When four cards of the same rank sit on top of the pile, it gets swiped away — and whoever completed it plays again.' },
  { title: 'Stuck? Play higher & pick up', body: "If you can't play equal-or-lower, you must play a higher card and pick up the pile. Any pile cards matching the rank you played stay behind as the new pile." },
  { title: 'Face-up, then face-down', body: 'Face-up cards play like hand cards. Clear the face-up card to unlock the face-down beneath it — flipping one is a gamble: if it’s too high, you pick up the pile.' },
  { title: 'Eat the pile', body: 'You may voluntarily take the whole pile into your hand and keep your turn — useful for setting up four-of-a-kind swipes.' },
  { title: 'Scoring', body: 'A=1 · 2–9 face value · J/Q/K=10 · 10=20. When a player reaches the loss threshold, the game ends and the lowest total wins.' },
];

export function HowToPlayModal({ open, onClose }: HowToPlayProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-felt-800 border border-brass-500/30 rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="font-display text-2xl text-bone-100 tracking-tight">How to play</div>
              <button
                onClick={onClose}
                className="text-bone-200/60 hover:text-bone-200 text-2xl leading-none w-10 h-10 -mr-2 flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto px-6 pb-4 space-y-4">
              {RULES.map(r => (
                <div key={r.title}>
                  <div className="text-brass-400 font-display font-bold mb-0.5">{r.title}</div>
                  <div className="text-sm text-bone-200/80 leading-relaxed">{r.body}</div>
                </div>
              ))}
            </div>
            <div className="p-4 pt-2">
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-brass-500 hover:bg-brass-400 rounded-xl text-felt-900 font-display font-bold tracking-wider uppercase transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
