import type { GameState } from '../game/types';

const KEY = 'swipe-progression-v1';

export type AchievementId =
  | 'first-win'
  | 'clean-sweep'
  | 'burn-notice'
  | 'swipe-artist'
  | 'gambler'
  | 'comeback-kid'
  | 'daily-winner';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  unlockedAt: number;
}

export interface Progression {
  version: 1;
  gamesStarted: number;
  gamesCompleted: number;
  gamesWon: number;
  roundsWon: number;
  totalSwipes: number;
  totalBurns: number;
  totalPickups: number;
  bestWinningScore: number | null;
  bestDifficulty: 'easy' | 'medium' | 'hard' | null;
  dailyWins: string[];
  achievements: Achievement[];
}

const EMPTY: Progression = {
  version: 1,
  gamesStarted: 0,
  gamesCompleted: 0,
  gamesWon: 0,
  roundsWon: 0,
  totalSwipes: 0,
  totalBurns: 0,
  totalPickups: 0,
  bestWinningScore: null,
  bestDifficulty: null,
  dailyWins: [],
  achievements: [],
};

export const ACHIEVEMENTS: Record<AchievementId, Omit<Achievement, 'unlockedAt'>> = {
  'first-win': { id: 'first-win', title: 'First Win', description: 'Win your first full game.' },
  'clean-sweep': { id: 'clean-sweep', title: 'Clean Sweep', description: 'Win a round without taking the pile.' },
  'burn-notice': { id: 'burn-notice', title: 'Burn Notice', description: 'Burn the pile five times in one game.' },
  'swipe-artist': { id: 'swipe-artist', title: 'Swipe Artist', description: 'Complete three four-of-a-kind swipes in one game.' },
  gambler: { id: 'gambler', title: 'Gambler', description: 'Win after successfully playing a face-down card.' },
  'comeback-kid': { id: 'comeback-kid', title: 'Comeback Kid', description: 'Win after trailing by at least 30 points.' },
  'daily-winner': { id: 'daily-winner', title: 'Daily Winner', description: 'Win the daily deal.' },
};

export function loadProgression(): Progression {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Progression>;
    if (parsed.version !== 1) return { ...EMPTY };
    return {
      ...EMPTY,
      ...parsed,
      dailyWins: Array.isArray(parsed.dailyWins) ? parsed.dailyWins : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveProgression(value: Progression): void {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
}

export function recordGameStarted(): Progression {
  const next = loadProgression();
  next.gamesStarted += 1;
  saveProgression(next);
  return next;
}

function unlock(progress: Progression, id: AchievementId, unlocked: Achievement[]): void {
  if (progress.achievements.some(a => a.id === id)) return;
  const achievement: Achievement = { ...ACHIEVEMENTS[id], unlockedAt: Date.now() };
  progress.achievements.push(achievement);
  unlocked.push(achievement);
}

export function recordCompletedGame(state: GameState): { progression: Progression; unlocked: Achievement[] } {
  const progress = loadProgression();
  const unlocked: Achievement[] = [];
  const humanIdx = state.players.findIndex(p => p.isHuman);
  const won = humanIdx >= 0 && state.gameWinnerIdx === humanIdx;
  const metrics = state.metrics;

  progress.gamesCompleted += 1;
  if (won) {
    progress.gamesWon += 1;
    progress.bestWinningScore = progress.bestWinningScore === null
      ? state.scores[humanIdx]
      : Math.min(progress.bestWinningScore, state.scores[humanIdx]);
    const order = { easy: 0, medium: 1, hard: 2 } as const;
    if (!progress.bestDifficulty || order[state.difficulty] > order[progress.bestDifficulty]) progress.bestDifficulty = state.difficulty;
    unlock(progress, 'first-win', unlocked);
  }

  if (state.winnerIdxThisRound === humanIdx) progress.roundsWon += 1;
  if (metrics && humanIdx >= 0) {
    const burns = metrics.burns[humanIdx] ?? 0;
    const swipes = metrics.swipes[humanIdx] ?? 0;
    const pickups = metrics.pickups[humanIdx] ?? 0;
    progress.totalBurns += burns;
    progress.totalSwipes += swipes;
    progress.totalPickups += pickups;
    if (won && metrics.cleanRoundEligible[humanIdx]) unlock(progress, 'clean-sweep', unlocked);
    if (burns >= 5) unlock(progress, 'burn-notice', unlocked);
    if (swipes >= 3) unlock(progress, 'swipe-artist', unlocked);
    if (won && (metrics.faceDownSuccesses[humanIdx] ?? 0) > 0) unlock(progress, 'gambler', unlocked);
    if (won && metrics.largestDeficit >= 30) unlock(progress, 'comeback-kid', unlocked);
  }

  if (won && state.mode === 'daily' && state.seed) {
    if (!progress.dailyWins.includes(state.seed)) progress.dailyWins.push(state.seed);
    unlock(progress, 'daily-winner', unlocked);
  }

  saveProgression(progress);
  return { progression: progress, unlocked };
}

export function shouldShowHintButton(): boolean {
  return loadProgression().gamesCompleted < 4;
}

export function dailySeed(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `daily-${year}-${month}-${day}`;
}
