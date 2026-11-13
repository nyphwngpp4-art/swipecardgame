/**
 * AI strength benchmark: seats of different difficulty play seeded rounds
 * against each other. Reports average round points per difficulty (lower is
 * better). Run with `npx tsx src/__test/ai-bench.ts [rounds]`.
 */
import { newGame, playCards, flipFaceDown, resolveFaceDown, voluntaryEatPile } from '../game/engine';
import { chooseAIMove } from '../game/ai';
import { createSeededRng } from '../lib/random';
import type { GameState } from '../game/types';

type Difficulty = GameState['difficulty'];

export function playRound(seed: string, seats: Difficulty[]): { points: number[]; winner: number | null; moves: number } {
  let s = newGame({ numPlayers: seats.length, humanCount: 0, targetScore: 300, seed });
  const rng = createSeededRng(`${seed}-ai`);
  let moves = 0;
  while (s.phase === 'playing' && moves < 3000) {
    const view: GameState = { ...s, difficulty: seats[s.currentPlayerIdx] };
    const move = chooseAIMove(view, rng);
    const r = move.type === 'play' ? playCards(s, move.selected)
      : move.type === 'flipFaceDown' ? flipFaceDown(s, move.slot)
      : move.type === 'eatPile' ? voluntaryEatPile(s)
      : resolveFaceDown(s, move.chain);
    if (!r.ok) throw new Error(`Illegal AI move (${seats[s.currentPlayerIdx]}): ${r.reason}`);
    s = r.state;
    moves++;
  }
  return { points: s.scores, winner: s.winnerIdxThisRound, moves };
}

export function benchmark(rounds: number, lineups: Difficulty[][]) {
  const total: Record<Difficulty, { points: number; seats: number; wins: number }> = {
    easy: { points: 0, seats: 0, wins: 0 }, medium: { points: 0, seats: 0, wins: 0 }, hard: { points: 0, seats: 0, wins: 0 },
  };
  let stalled = 0; let moves = 0; let played = 0;
  for (let i = 0; i < rounds; i++) {
    const base = lineups[i % lineups.length];
    // Rotate seats so no difficulty benefits from table position.
    const shift = Math.floor(i / lineups.length) % base.length;
    const seats = base.map((_, k) => base[(k + shift) % base.length]);
    const result = playRound(`bench-${i}`, seats);
    if (result.winner === null) { stalled++; continue; }
    played++; moves += result.moves;
    seats.forEach((d, k) => { total[d].points += result.points[k]; total[d].seats++; if (result.winner === k) total[d].wins++; });
  }
  return { total, stalled, avgMoves: moves / Math.max(1, played) };
}

if (process.argv[1]?.endsWith('ai-bench.ts')) {
  const rounds = Number(process.argv[2] ?? 600);
  const { total, stalled, avgMoves } = benchmark(rounds, [['easy', 'medium', 'hard'], ['hard', 'easy', 'medium', 'hard'], ['medium', 'hard', 'easy', 'medium', 'easy']]);
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const t = total[d];
    console.log(`${d.padEnd(6)} avg points ${(t.points / t.seats).toFixed(1).padStart(6)}   round wins ${(100 * t.wins / t.seats).toFixed(1)}%  (${t.seats} seats)`);
  }
  console.log(`stalled rounds: ${stalled}/${rounds}, avg moves per round: ${avgMoves.toFixed(0)}`);
}
