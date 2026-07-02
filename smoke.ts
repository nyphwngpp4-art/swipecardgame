import { newGame, playCards, flipFaceDown, resolveFaceDown, voluntaryEatPile } from '../game/engine';
import { chooseAIMove } from '../game/ai';
import type { GameState } from '../game/types';

function run() {
  let s: GameState = newGame({ numPlayers: 4, humanCount: 0, targetScore: 100 });
  let moves = 0;
  const maxMoves = 1000;

  while (s.phase === 'playing' && moves < maxMoves) {
    const move = chooseAIMove(s);
    let r;
    if (move.type === 'play') {
      r = playCards(s, move.selected);
    } else if (move.type === 'flipFaceDown') {
      r = flipFaceDown(s, move.slot);
    } else if (move.type === 'eatPile') {
      r = voluntaryEatPile(s);
    } else {
      r = resolveFaceDown(s, move.chain);
    }
    if (!r.ok) {
      console.error(`Move ${moves} failed:`, r.reason, 'move:', move);
      console.error('Current player:', s.players[s.currentPlayerIdx]);
      console.error('Pile top:', s.pile[s.pile.length - 1]);
      process.exit(1);
    }
    s = r.state;
    moves++;
  }

  console.log(`Round resolved in ${moves} moves.`);
  console.log(`Phase: ${s.phase}`);
  console.log(`Winner of round: ${s.winnerIdxThisRound !== null ? s.players[s.winnerIdxThisRound].name : 'none'}`);
  console.log(`Scores:`, s.scores);
  console.log(`Last 5 log entries:`, s.log.slice(0, 5));

  if (s.phase !== 'roundEnd' && s.phase !== 'gameOver') {
    console.error('Unexpected phase after smoke test:', s.phase);
    process.exit(1);
  }
  console.log('✓ Smoke test passed');
}

run();
