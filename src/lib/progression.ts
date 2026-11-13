import type { GameState } from '../game/types';

const KEY = 'swipe-progression-v1';

export type AchievementId =
  | 'first-win'
  | 'clean-sweep'
  | 'burn-notice'
  | 'swipe-artist'
  | 'gambler'
  | 'comeback-kid'
  | 'daily-winner'
  | 'hat-trick'
  | 'sharp-mind'
  | 'featherweight'
  | 'full-house'
  | 'regular';

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
  /** Fields below were added after version 1 shipped; all are backfilled on load. */
  winStreak: number;
  bestWinStreak: number;
  dailyResults: Record<string, DailyResult>;
}

/** The player's best finish on one day's deal. */
export interface DailyResult {
  place: number;
  players: number;
  score: number;
  rounds: number;
  won: boolean;
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
  winStreak: 0,
  bestWinStreak: 0,
  dailyResults: {},
};

export const ACHIEVEMENTS: Record<AchievementId, Omit<Achievement, 'unlockedAt'>> = {
  'first-win': { id: 'first-win', title: 'First Win', description: 'Win your first full game.' },
  'clean-sweep': { id: 'clean-sweep', title: 'Clean Sweep', description: 'Win a round without taking the pile.' },
  'burn-notice': { id: 'burn-notice', title: 'Burn Notice', description: 'Burn the pile five times in one game.' },
  'swipe-artist': { id: 'swipe-artist', title: 'Swipe Artist', description: 'Complete three four-of-a-kind swipes in one game.' },
  gambler: { id: 'gambler', title: 'Gambler', description: 'Win after successfully playing a face-down card.' },
  'comeback-kid': { id: 'comeback-kid', title: 'Comeback Kid', description: 'Win after trailing by at least 30 points.' },
  'daily-winner': { id: 'daily-winner', title: 'Daily Winner', description: 'Win the daily deal.' },
  'hat-trick': { id: 'hat-trick', title: 'Hat Trick', description: 'Win three games in a row.' },
  'sharp-mind': { id: 'sharp-mind', title: 'Sharp Mind', description: 'Win a game against clever opponents.' },
  featherweight: { id: 'featherweight', title: 'Featherweight', description: 'Win a game with 25 points or fewer.' },
  'full-house': { id: 'full-house', title: 'Full House', description: 'Win at a five-player table.' },
  regular: { id: 'regular', title: 'A Regular', description: 'Play the daily deal five days in a row.' },
};

export function loadProgression(): Progression {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, dailyWins: [], achievements: [], dailyResults: {} };
    const parsed = JSON.parse(raw) as Partial<Progression>;
    if (parsed.version !== 1) return { ...EMPTY };
    return {
      ...EMPTY,
      ...parsed,
      dailyWins: Array.isArray(parsed.dailyWins) ? parsed.dailyWins : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      dailyResults: parsed.dailyResults && typeof parsed.dailyResults === 'object' ? parsed.dailyResults : {},
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
    progress.winStreak += 1;
    progress.bestWinStreak = Math.max(progress.bestWinStreak, progress.winStreak);
    if (progress.winStreak >= 3) unlock(progress, 'hat-trick', unlocked);
    if (state.difficulty === 'hard') unlock(progress, 'sharp-mind', unlocked);
    if (state.scores[humanIdx] <= 25) unlock(progress, 'featherweight', unlocked);
    if (state.players.length >= 5) unlock(progress, 'full-house', unlocked);
  } else {
    progress.winStreak = 0;
  }

  if (metrics && humanIdx >= 0) {
    const burns = metrics.burns[humanIdx] ?? 0;
    const swipes = metrics.swipes[humanIdx] ?? 0;
    const pickups = metrics.pickups[humanIdx] ?? 0;
    progress.roundsWon += metrics.roundsWon?.[humanIdx]
      ?? (state.winnerIdxThisRound === humanIdx ? 1 : 0);
    progress.totalBurns += burns;
    progress.totalSwipes += swipes;
    progress.totalPickups += pickups;
    if ((metrics.cleanRoundWins?.[humanIdx] ?? 0) > 0) unlock(progress, 'clean-sweep', unlocked);
    if (burns >= 5) unlock(progress, 'burn-notice', unlocked);
    if (swipes >= 3) unlock(progress, 'swipe-artist', unlocked);
    if (won && (metrics.faceDownSuccesses[humanIdx] ?? 0) > 0) unlock(progress, 'gambler', unlocked);
    if (won && metrics.largestDeficit >= 30) unlock(progress, 'comeback-kid', unlocked);
  }

  if (state.mode === 'daily' && state.seed && humanIdx >= 0) {
    const result = dailyResultOf(state, humanIdx);
    const previous = progress.dailyResults[state.seed];
    if (!previous || result.place < previous.place || (result.place === previous.place && result.score < previous.score)) {
      progress.dailyResults[state.seed] = result;
    }
    if (won) {
      if (!progress.dailyWins.includes(state.seed)) progress.dailyWins.push(state.seed);
      unlock(progress, 'daily-winner', unlocked);
    }
    if (dailyStreak(progress) >= 5) unlock(progress, 'regular', unlocked);
  }

  saveProgression(progress);
  return { progression: progress, unlocked };
}

/** Finishing position (1 = lowest score) for a completed game. */
export function dailyResultOf(state: GameState, humanIdx: number): DailyResult {
  const mine = state.scores[humanIdx];
  return {
    place: 1 + state.scores.filter(score => score < mine).length,
    players: state.players.length,
    score: mine,
    rounds: state.roundNumber,
    won: state.gameWinnerIdx === humanIdx,
  };
}

/** Consecutive days with a finished daily deal, counting back from today
 *  (or from yesterday, so a streak is not lost before today's game). */
export function dailyStreak(progress: Progression, today = new Date()): number {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!progress.dailyResults[dailySeed(day)]) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (progress.dailyResults[dailySeed(day)]) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];
export function ordinal(place: number): string {
  return ORDINALS[place - 1] ?? `${place}th`;
}

/** Plain-text summary a player can send to a friend. */
export function dailyShareText(seed: string, result: DailyResult, streak: number, url?: string): string {
  const date = seed.replace('daily-', '');
  const lines = [
    `Swipe · daily deal ${date}`,
    `${result.won ? '🏆' : '🃏'} ${ordinal(result.place)} of ${result.players} · ${result.score} pts · ${result.rounds} ${result.rounds === 1 ? 'round' : 'rounds'}`,
  ];
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  if (url) lines.push(url);
  return lines.join('\n');
}

export function dailySeed(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `daily-${year}-${month}-${day}`;
}
