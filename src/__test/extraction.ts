import { extractMatchingFromPile, maxPlayableOfRank, cardsOfRank } from '../game/rules';
import type { Player } from '../game/types';
import type { Card } from '../game/types';

function c(rank: Card['rank'], suit: Card['suit'] = '♠'): Card {
  return { id: `${rank}${suit}-${Math.random()}`, rank, suit };
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('  ✓', msg);
}

// Jay's example: pile contains 2K, 1×9, 3×8, 2×2 with top a 2 (so 9 is "higher").
// Player plays a 9. The other 9 in the pile stays on new pile. The 7 others go to hand.
{
  console.log('Test 1: 9 played over mixed pile, one 9 already in pile');
  const pile = [c('2','♣'), c('2','♠'), c('8','♥'), c('8','♦'), c('8','♣'), c('9','♠'), c('K','♥'), c('K','♦')];
  const { kept, pickedUp } = extractMatchingFromPile(pile, '9');
  assert(kept.length === 1, 'kept exactly 1 card (the existing 9)');
  assert(kept[0].rank === '9', 'kept card is rank 9');
  assert(pickedUp.length === 7, 'picked up 7 cards');
  assert(pickedUp.every(card => card.rank !== '9'), 'no 9s in picked-up pile');
}

// Strategic swipe: 3 Ks already on pile + player plays K = 4 Ks → swipe after pickup.
{
  console.log('Test 2: extraction creates 4-of-a-kind swipe');
  const pile = [c('K','♠'), c('K','♥'), c('K','♦'), c('9','♣'), c('8','♣'), c('7','♣')];
  const { kept, pickedUp } = extractMatchingFromPile(pile, 'K');
  assert(kept.length === 3, 'kept all 3 Ks');
  assert(pickedUp.length === 3, 'picked up 9/8/7');
}

// No matching ranks in pile: behaves like old rule.
{
  console.log('Test 3: no matches → full pickup, played cards alone on new pile');
  const pile = [c('A','♠'), c('2','♥'), c('3','♦')];
  const { kept, pickedUp } = extractMatchingFromPile(pile, 'K');
  assert(kept.length === 0, 'kept nothing');
  assert(pickedUp.length === 3, 'picked up all 3');
}

// Empty pile: edge case (shouldn't happen in practice but should not crash).
{
  console.log('Test 4: empty pile');
  const { kept, pickedUp } = extractMatchingFromPile([], '9');
  assert(kept.length === 0 && pickedUp.length === 0, 'both empty');
}

// maxPlayableOfRank: 3 in hand + 1 face-up = 4 selectable on empty pile
{
  console.log('Test 5: maxPlayable counts hand + face-up pool');
  const pool = [c('5'), c('5'), c('5'), c('5')];
  assert(maxPlayableOfRank('5', [], pool) === 4, 'all 4 playable on empty pile');
  const pile = [c('5')];
  assert(maxPlayableOfRank('5', pile, pool) === 3, 'only 3 more when 1 five on pile');
  assert(maxPlayableOfRank('5', pile, pool.slice(0, 3)) === 3, '3 in hand still capped at 3');
}

// 3 aces in hand + 1 ace face-up = 4 aces, playable on Q top
{
  console.log('Test 6: three hand aces + one open ace = four for swipe');
  const ace = (s: string) => c('A', s as '♠');
  const player: Player = {
    id: 0, name: 'You', isHuman: true,
    hand: [ace('♠'), ace('♥'), ace('♦')],
    faceUp: [ace('♣'), null, null, null],
    faceDown: [null, null, null, null],
  };
  const all = cardsOfRank(player, 'A');
  assert(all.length === 4, 'cardsOfRank finds all 4 aces');
  const pile = [c('Q', '♠')];
  assert(maxPlayableOfRank('A', pile, all) === 4, 'all 4 aces playable over queen');
}

console.log('\n✓ Extraction rule tests passed');
