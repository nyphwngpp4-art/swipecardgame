/**
 * Regression checks for the pieces that make the game feel right:
 * difficulty levels that are genuinely apart, structured events the table
 * animates from, round history, and daily-deal bookkeeping.
 */
import assert from 'node:assert/strict';
import { newGame, playCards, voluntaryEatPile } from '../game/engine';
import { deriveFx, describeMove } from '../components/club/tableFx';
import { dailySeed, dailyShareText, dailyStreak, type Progression } from '../lib/progression';
import { benchmark } from './ai-bench';
import type { Card, GameState, Rank, SelectedCard } from '../game/types';

const card = (id: string, rank: Rank): Card => ({ id, rank, suit: '♠' });
const hand = (c: Card): SelectedCard => ({ card: c, source: { kind: 'hand' } });
function fixture(): GameState {
  const state = newGame({ numPlayers: 3, humanCount: 1, targetScore: 100, difficulty: 'easy', seed: 'quality' });
  state.currentPlayerIdx = 0;
  state.players[0].hand = [card('h5', '5'), card('hK', 'K'), card('hK2', 'K')];
  state.players[0].faceUp = [null, null, null, null];
  state.pile = [card('p9', '9'), card('pK', 'K'), card('p7', '7')];
  return state;
}

/* Difficulty ladder: each level must clearly out-score the one below. */
const { total, stalled } = benchmark(900, [['easy', 'medium', 'hard'], ['hard', 'easy', 'medium', 'hard'], ['medium', 'hard', 'easy', 'medium', 'easy']]);
const avg = (d: 'easy' | 'medium' | 'hard') => total[d].points / total[d].seats;
assert.equal(stalled, 0, 'No simulated round stalls');
assert.ok(avg('hard') < avg('medium') - 3, `Clever (${avg('hard').toFixed(1)}) clearly beats balanced (${avg('medium').toFixed(1)})`);
assert.ok(avg('medium') < avg('easy') - 4, `Balanced (${avg('medium').toFixed(1)}) clearly beats gentle (${avg('easy').toFixed(1)})`);

/* Events carry what happened, so the table never parses log text. */
let state = fixture();
const play = playCards(state, [hand(state.players[0].hand[0])]);
assert.ok(play.ok);
if (!play.ok) throw new Error('unreachable');
assert.deepEqual(play.state.events?.[0], { type: 'play', playerIdx: 0, cards: [card('h5', '5')] });
assert.deepEqual(deriveFx(state, play.state)?.landed, ['h5'], 'A played card lands on the pile');
assert.equal(describeMove(play.state.events ?? []), 'Played 5♠');

state = fixture();
state.players[0].hand = [card('hK', 'K'), card('hK2', 'K')];
const forced = playCards(state, state.players[0].hand.map(hand));
assert.ok(forced.ok);
if (!forced.ok) throw new Error('unreachable');
const pickup = forced.state.events?.find(event => event.type === 'pickup');
assert.equal(pickup?.count, 2, 'Pickup reports how many cards were taken (the matching King stays)');
const forcedFx = deriveFx(state, forced.state);
assert.equal(forcedFx?.ghostKind, 'pickup');
assert.deepEqual(forcedFx?.ghost.map(c => c.id), ['p9', 'p7'], 'Only the cards that left the pile fly to the player');
assert.equal(describeMove(forced.state.events ?? []), 'Played 2× K, took 2');

state = fixture();
const eat = voluntaryEatPile(state);
assert.ok(eat.ok && eat.state.events?.[0].count === 3, 'Taking the pile reports its size');

/* Round history sums to the running scores. */
state = fixture();
state.players[0].hand = [card('last', 'A')];
state.players[0].faceDown = [null, null, null, null];
const out = playCards(state, [hand(state.players[0].hand[0])]);
assert.ok(out.ok);
if (!out.ok) throw new Error('unreachable');
assert.equal(out.state.roundHistory?.length, 1);
assert.deepEqual(out.state.roundHistory?.[0], out.state.scores, 'First round history equals the scores');
assert.equal(out.state.roundHistory?.[0][0], 0, 'The player who went out scores zero');

/* Daily streaks count back from today, or from yesterday before today's game. */
const day = (offset: number) => { const d = new Date(2026, 10, 13); d.setDate(d.getDate() + offset); return d; };
const result = { place: 2, players: 4, score: 47, rounds: 3, won: false };
const progress = { dailyResults: { [dailySeed(day(-1))]: result, [dailySeed(day(-2))]: result, [dailySeed(day(-4))]: result } } as unknown as Progression;
assert.equal(dailyStreak(progress, day(0)), 2, 'Yesterday and the day before keep the streak alive');
progress.dailyResults[dailySeed(day(0))] = result;
assert.equal(dailyStreak(progress, day(0)), 3);
assert.equal(dailyStreak(progress, day(2)), 0, 'A missed day resets the streak');
assert.equal(dailyShareText('daily-2026-11-13', result, 3), 'Swipe · daily deal 2026-11-13\n🃏 2nd of 4 · 47 pts · 3 rounds\n🔥 3-day streak');

console.log(`✓ Quality: difficulty ladder (gentle ${avg('easy').toFixed(1)} / balanced ${avg('medium').toFixed(1)} / clever ${avg('hard').toFixed(1)} avg points), table events, round history, daily streaks`);
