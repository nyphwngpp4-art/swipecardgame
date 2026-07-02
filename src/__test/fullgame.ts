import { newGame, nextRound, playCards, flipFaceDown, resolveFaceDown, voluntaryEatPile } from '../game/engine';
import { chooseAIMove } from '../game/ai';
import type { GameState } from '../game/types';

function runFullGame(numPlayers: number) {
  let s: GameState = newGame({ numPlayers, humanCount: 0, targetScore: 100 });
  let totalMoves = 0;
  const maxTotalMoves = 8000;

  while (s.phase !== 'gameOver' && totalMoves < maxTotalMoves) {
    while (s.phase === 'playing' && totalMoves < maxTotalMoves) {
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
        console.error(`[${numPlayers}p] Move ${totalMoves} failed:`, r.reason);
        return false;
      }
      s = r.state;
      totalMoves++;
    }
    if (s.phase === 'roundEnd') {
      s = nextRound(s);
    }
  }

  if (s.phase !== 'gameOver') {
    console.error(`[${numPlayers}p] Did not reach gameOver in ${maxTotalMoves} moves`);
    return false;
  }
  console.log(`[${numPlayers}p] Game over in ${totalMoves} moves, ${s.roundNumber} rounds. Winner: ${s.players[s.gameWinnerIdx!].name} (${s.scores[s.gameWinnerIdx!]}pts)`);
  return true;
}

let allOk = true;
for (const np of [3, 4, 5]) {
  for (let trial = 0; trial < 3; trial++) {
    if (!runFullGame(np)) allOk = false;
  }
}
console.log(allOk ? '\n✓ All full-game tests passed' : '\n✗ Failures');
process.exit(allOk ? 0 : 1);
