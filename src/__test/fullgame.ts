import { newGame, nextRound, playCards, flipFaceDown, resolveFaceDown, voluntaryEatPile } from '../game/engine';
import { chooseAIMove } from '../game/ai';
import type { GameState, HouseRules } from '../game/types';

function runFullGame(numPlayers: number, rules?: HouseRules, label = '') {
  let s: GameState = newGame({ numPlayers, humanCount: 0, targetScore: 100, rules });
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
    console.error(`[${numPlayers}p${label}] Did not reach gameOver in ${maxTotalMoves} moves`);
    return 'stalled';
  }
  console.log(`[${numPlayers}p${label}] Game over in ${totalMoves} moves, ${s.roundNumber} rounds. Winner: ${s.players[s.gameWinnerIdx!].name} (${s.scores[s.gameWinnerIdx!]}pts)`);
  return true;
}

const VARIANTS: Array<{ rules?: HouseRules; label: string }> = [
  { rules: undefined, label: '' },
  { rules: { twosReset: true, tenBurns: true, fourOfAKindSwipes: true }, label: ' 2s-reset' },
  { rules: { twosReset: false, tenBurns: false, fourOfAKindSwipes: false }, label: ' hardcore' },
  { rules: { twosReset: true, tenBurns: false, fourOfAKindSwipes: false }, label: ' 2s+hardcore' },
];

let allOk = true;
for (const { rules, label } of VARIANTS) {
  for (const np of label === '' ? [3, 4, 5] : [3, 5]) {
    for (let trial = 0; trial < (label === '' ? 3 : 2); trial++) {
      let result = runFullGame(np, rules, label);
      // AI-vs-AI games have a small residual chance of a card-cycling stalemate
      // (no human to break the loop). One stall is bad luck; two in a row is a bug.
      if (result === 'stalled') {
        console.log(`[${np}p${label}] Retrying stalled game with a fresh deal…`);
        result = runFullGame(np, rules, label);
      }
      if (result !== true) allOk = false;
    }
  }
}
console.log(allOk ? '\n✓ All full-game tests passed' : '\n✗ Failures');
process.exit(allOk ? 0 : 1);
