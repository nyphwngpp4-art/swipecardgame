import { useState } from 'react';
import { motion } from 'motion/react';
import type { GameSetupOptions } from '../game/setup';
import type { GameState, HouseRules } from '../game/types';
import { DEFAULT_RULES } from '../game/rules';
import type { Theme } from '../theme';
import { HowToPlayModal } from './Modals';
import { dailySeed, loadProgression } from '../lib/progression';

const RULES_KEY = 'swipe-house-rules';

function loadHouseRules(): HouseRules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return DEFAULT_RULES;
    const parsed = JSON.parse(raw);
    return {
      twosReset: typeof parsed.twosReset === 'boolean' ? parsed.twosReset : DEFAULT_RULES.twosReset,
      tenBurns: typeof parsed.tenBurns === 'boolean' ? parsed.tenBurns : DEFAULT_RULES.tenBurns,
      fourOfAKindSwipes: typeof parsed.fourOfAKindSwipes === 'boolean' ? parsed.fourOfAKindSwipes : DEFAULT_RULES.fourOfAKindSwipes,
    };
  } catch {
    return DEFAULT_RULES;
  }
}

function saveHouseRules(rules: HouseRules) {
  try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch {}
}

interface Props {
  onStart: (opts: GameSetupOptions) => void;
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
  const [rules, setRules] = useState<HouseRules>(loadHouseRules);
  const [showHowTo, setShowHowTo] = useState(false);
  const progression = loadProgression();
  const todaySeed = dailySeed();
  const dailyWon = progression.dailyWins.includes(todaySeed);
  const winRate = progression.gamesCompleted > 0
    ? Math.round((progression.gamesWon / progression.gamesCompleted) * 100)
    : 0;

  const setRule = (patch: Partial<HouseRules>) => {
    setRules(previous => {
      const next = { ...previous, ...patch };
      saveHouseRules(next);
      return next;
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="h-full w-full overflow-y-auto no-scrollbar">
      <div className="min-h-full w-full flex flex-col items-center justify-center px-6 py-12 safe-top safe-bottom">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-brass-400/70 text-lg tracking-[0.5em] mb-1 select-none">♠ ♥ ♦ ♣</div>
            <div className="font-display text-6xl font-black tracking-tight text-bone-50">Swipe</div>
            <div className="text-brass-400 text-sm tracking-[0.3em] uppercase mt-1">A card game of nerve &amp; timing</div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={toggleTheme} className="text-xs px-3 py-1.5 rounded-full border border-brass-400/50 text-brass-400 hover:bg-brass-400/10 active:scale-95 transition">
                {theme === 'classic' ? '♣ Classic' : '✨ Casino'}
              </button>
              <button onClick={() => setShowHowTo(true)} className="text-xs px-3 py-1.5 rounded-full border border-bone-200/30 text-bone-200/70 hover:bg-white/5 active:scale-95 transition">
                How to play
              </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-felt-600/60 bg-felt-800/65 p-3">
            <Stat label="Games" value={progression.gamesCompleted} />
            <Stat label="Wins" value={progression.gamesWon} />
            <Stat label="Win rate" value={`${winRate}%`} />
            <Stat label="Swipes" value={progression.totalSwipes} />
            <Stat label="Burns" value={progression.totalBurns} />
            <Stat label="Badges" value={progression.achievements.length} />
          </div>

          {savedGame && onContinue && <ContinueCard saved={savedGame} onContinue={onContinue} />}

          <button
            onClick={() => onStart({
              numPlayers: 4,
              humanCount: 1,
              targetScore: 100,
              difficulty: 'medium',
              rules: DEFAULT_RULES,
              mode: 'daily',
              seed: todaySeed,
            })}
            className="mb-7 w-full rounded-2xl border border-brass-500/55 bg-gradient-to-br from-felt-700 to-felt-800 p-4 text-left shadow-lg transition active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-brass-400">Daily deal</div>
                <div className="mt-1 font-display text-xl font-bold text-bone-100">Same cards. One daily challenge.</div>
                <div className="mt-1 text-xs text-bone-200/55">Seed {todaySeed.replace('daily-', '')} · medium · 4 players</div>
              </div>
              <div className="text-right">
                <div className="text-2xl">{dailyWon ? '✓' : '◆'}</div>
                <div className="text-[9px] uppercase tracking-wide text-bone-200/45">{dailyWon ? 'Won today' : 'Play'}</div>
              </div>
            </div>
          </button>

          <div className="space-y-7">
            <Field label="Players">
              <div className="grid grid-cols-3 gap-2">
                {[3, 4, 5].map(value => <Choice key={value} active={numPlayers === value} onClick={() => setNumPlayers(value)}>{value}</Choice>)}
              </div>
              <div className="mt-2 text-xs text-bone-200/60">You + {numPlayers - 1} CPU</div>
            </Field>

            <Field label="Loss threshold">
              <div className="grid grid-cols-3 gap-2">
                {[100, 200, 300].map(value => (
                  <Choice key={value} active={targetScore === value} onClick={() => setTargetScore(value as 100 | 200 | 300)}>{value}</Choice>
                ))}
              </div>
              <div className="mt-2 text-xs text-bone-200/60">First to {targetScore} loses. Lowest total wins.</div>
            </Field>

            <Field label="AI Difficulty">
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as const).map(value => (
                  <Choice key={value} active={difficulty === value} onClick={() => setDifficulty(value)}>{value[0].toUpperCase() + value.slice(1)}</Choice>
                ))}
              </div>
              <div className="mt-2 text-xs text-bone-200/60">
                {difficulty === 'easy' ? 'Forgiving CPU that misses some combinations.' : difficulty === 'medium' ? 'Efficient CPU that protects special cards.' : 'Pressure-aware CPU that clears slots and plans swipe setups.'}
              </div>
            </Field>

            <Field label="House rules">
              <div className="space-y-2">
                <RuleToggle on={rules.twosReset} onToggle={() => setRule({ twosReset: !rules.twosReset })} title="2s reset the pile" detail="A 2 plays on anything and resets — next card is free." />
                <RuleToggle on={rules.tenBurns} onToggle={() => setRule({ tenBurns: !rules.tenBurns })} title="10 burns the pile" detail="Off: 10 is a normal card between 9 and Jack." />
                <RuleToggle on={rules.fourOfAKindSwipes} onToggle={() => setRule({ fourOfAKindSwipes: !rules.fourOfAKindSwipes })} title="Four of a kind swipes" detail="Off: no swipe clears — a grindier game." />
              </div>
            </Field>
          </div>

          <div className="mt-10 space-y-3">
            <button
              onClick={() => onStart({ numPlayers, humanCount: 1, targetScore, difficulty, rules, mode: 'standard' })}
              className="w-full py-4 bg-brass-500 hover:bg-brass-400 active:bg-brass-600 active:scale-[0.99] text-felt-900 font-display font-bold text-lg tracking-wider uppercase rounded-xl transition-all shadow-lg"
            >
              Deal
            </button>
            <button
              onClick={() => onStart({ numPlayers: 3, humanCount: 1, targetScore: 100, difficulty: 'easy', rules: DEFAULT_RULES, mode: 'practice' })}
              className="w-full py-3.5 bg-felt-700 hover:bg-felt-600 active:scale-[0.99] text-bone-200 font-display font-bold tracking-wider uppercase rounded-xl transition-all border border-brass-400/40"
            >
              Guided Practice
            </button>
            <div className="text-[10px] text-center text-bone-200/50">Contextual coaching stays on while you learn the core decisions.</div>
            {savedGame && <div className="text-[10px] text-center text-bone-200/40">Starting a new deal replaces your saved game.</div>}
          </div>
        </div>
      </div>
      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="text-center"><div className="font-mono text-lg text-brass-400">{value}</div><div className="text-[9px] uppercase tracking-wide text-bone-200/40">{label}</div></div>;
}

function ContinueCard({ saved, onContinue }: { saved: GameState; onContinue: () => void }) {
  const humanIdx = saved.players.findIndex(player => player.isHuman);
  const yourScore = humanIdx >= 0 ? saved.scores[humanIdx] : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-2xl bg-felt-800/80 border border-brass-500/40 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div><div className="text-xs uppercase tracking-[0.25em] text-brass-400 font-bold mb-1">Game in progress</div><div className="text-sm text-bone-200/80">Round {saved.roundNumber} · {saved.players.length} players · you: <span className="font-mono text-brass-400">{yourScore} pts</span></div></div>
        <div className="text-2xl select-none" aria-hidden>🂠</div>
      </div>
      <button onClick={onContinue} className="w-full py-3.5 bg-brass-500 hover:bg-brass-400 active:bg-brass-600 active:scale-[0.99] text-felt-900 font-display font-bold tracking-wider uppercase rounded-xl transition-all">Continue</button>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-xs uppercase tracking-[0.25em] text-brass-400 mb-3 font-bold">{label}</div>{children}</div>;
}

function RuleToggle({ on, onToggle, title, detail }: { on: boolean; onToggle: () => void; title: string; detail: string }) {
  return (
    <button onClick={onToggle} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all active:scale-[0.99] border ${on ? 'bg-felt-700 border-brass-500/50' : 'bg-felt-800/60 border-felt-600'}`}>
      <div className="flex-1 min-w-0"><div className={`text-sm font-display font-bold ${on ? 'text-bone-100' : 'text-bone-200/60'}`}>{title}</div><div className="text-[11px] text-bone-200/50 leading-snug">{detail}</div></div>
      <div className={`flex-shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-brass-500' : 'bg-felt-600'}`}><div className={`w-5 h-5 rounded-full bg-bone-50 shadow transition-transform ${on ? 'translate-x-4' : ''}`} /></div>
    </button>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`py-3 rounded-xl font-display font-bold text-lg transition-all active:scale-[0.97] ${active ? 'bg-bone-100 text-felt-900 shadow-md' : 'bg-felt-700 text-bone-200/70 hover:bg-felt-600 border border-felt-600'}`}>{children}</button>;
}
