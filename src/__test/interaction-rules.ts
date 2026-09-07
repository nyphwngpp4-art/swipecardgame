import assert from 'node:assert/strict';
import { newGame, playCards, flipFaceDown, resolveFaceDown } from '../game/engine';
import { chooseAIMove } from '../game/ai';
import { getRecommendedMove } from '../game/guidance';
import type { Card, GameState, Rank, SelectedCard } from '../game/types';

const card = (id: string, rank: Rank): Card => ({ id, rank, suit: '♠' });
const hand = (c: Card): SelectedCard => ({ card: c, source: { kind: 'hand' } });
function fixture(): GameState {
  const state = newGame({ numPlayers: 3, humanCount: 1, targetScore: 100, difficulty: 'easy', seed: 'interaction-regression' });
  state.currentPlayerIdx = 0;
  state.players[0].hand = [card('h5', '5'), card('h10', '10'), card('hK', 'K')];
  state.players[0].faceUp = [null, null, null, null];
  state.players[0].faceDown = [card('d5', '5'), null, null, null];
  state.pile = [card('p9', '9')];
  return state;
}
let state = fixture();
const original = JSON.stringify(state);
assert.equal(playCards(state, [hand(state.players[0].hand[0]), hand(state.players[0].hand[0])]).ok, false, 'Duplicate cards cannot be played twice');
assert.equal(playCards(state, [hand(card('ghost', '5'))]).ok, false, 'A stale card cannot be replayed');
assert.equal(playCards(state, [hand({ ...state.players[0].hand[0], rank: 'A' })]).ok, false, 'A card cannot change rank');
assert.equal(playCards(state, [{ card: state.players[0].hand[0], source: { kind: 'faceUp', slot: 0 } }]).ok, false, 'The source must match');
assert.equal(JSON.stringify(state), original, 'Rejected actions leave state intact');

state = fixture();
state.pile = [card('p5a', '5'), card('p5b', '5'), card('p5c', '5')];
const flip = flipFaceDown(state, 0);
assert.ok(flip.ok);
if (!flip.ok) throw new Error('Flip failed');
assert.equal(resolveFaceDown(flip.state, [hand(state.players[0].hand[0])]).ok, false, 'The revealed card counts toward the four-card cap');
assert.equal(getRecommendedMove(flip.state, 0).cardIds.length, 0, 'Hint never suggests an extra card on a complete swipe');
assert.deepEqual(chooseAIMove(flip.state).type, 'resolveFaceDown');
const cpuChain = chooseAIMove(flip.state);
assert.ok(cpuChain.type === 'resolveFaceDown' && cpuChain.chain.length === 0, 'CPU also respects the reveal cap');
const resolve = resolveFaceDown(flip.state, []);
assert.ok(resolve.ok && resolve.state.pile.length === 0 && resolve.state.currentPlayerIdx === 0, 'Four of a kind clears the pile and keeps the turn');

state = fixture();
state.players[0].faceDown[0] = card('d10', '10');
const tenFlip = flipFaceDown(state, 0);
assert.ok(tenFlip.ok);
if (!tenFlip.ok) throw new Error('Flip failed');
assert.equal(resolveFaceDown(tenFlip.state, [hand(state.players[0].hand[1])]).ok, false, 'Burns use exactly one ten');

state = fixture();
state.pile = [card('ace', 'A')];
state.players[0].hand = [card('king', 'K'), card('ten', '10')];
for (const random of [0, 0.15, 0.29, 0.4, 0.9]) {
  const move = chooseAIMove(state, () => random);
  assert.ok(move.type === 'play');
  if (move.type === 'play') assert.ok(playCards(state, move.selected).ok, 'Gentle CPU never passes up its only legal burn and freezes');
}
assert.equal(JSON.stringify(newGame({numPlayers: 4, humanCount: 1, targetScore: 100, seed: 'daily-example'})), JSON.stringify(newGame({numPlayers: 4, humanCount: 1, targetScore: 100, seed: 'daily-example'})), 'Daily deal is deterministic');
console.log('✓ Interaction regressions: duplicate/stale cards, source validation, face-down caps, hint/AI parity, gentle CPU legality, deterministic deals');
