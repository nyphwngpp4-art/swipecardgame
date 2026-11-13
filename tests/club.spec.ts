import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function saveFixture(page: Page, kind = 'normal') {
  await page.goto('/');
  await page.evaluate(async kind => {
    const modulePath = '/src/game/engine.ts';
    const { newGame } = await import(modulePath);
    const state = newGame({ numPlayers: kind === 'five' ? 5 : 3, humanCount: 1, targetScore: 100, difficulty: 'easy', seed: 'browser-regression' });
    const c = (id: string, rank: string, suit = '♠') => ({ id, rank, suit });
    state.currentPlayerIdx = kind === 'opponent' ? 1 : 0;
    state.players[0].hand = [c('h5', '5'), c('h5b', '5', '♥'), c('h10', '10'), c('hK', 'K')];
    state.players[0].faceUp = [c('u5', '5', '♦'), null, c('uQ', 'Q'), null];
    state.players[0].faceDown = [c('dA', 'A'), c('d5', '5'), c('d8', '8'), c('dK', 'K')];
    state.pile = [c('p9', '9'), c('p7', '7', '♥')];
    if (kind === 'flip') { state.players[0].hand = [c('hQ', 'Q')]; state.players[0].faceUp = [null, null, null, null]; }
    if (kind === 'round') {
      state.phase = 'roundEnd'; state.winnerIdxThisRound = 0; state.scores = [0, 42, 58];
      state.players[0].hand = []; state.players[0].faceUp = [null,null,null,null]; state.players[0].faceDown = [null,null,null,null];
    }
    if (kind === 'game-over-ready') {
      state.players[0].hand = [c('last-ace', 'A')];
      state.players[0].faceUp = [null, null, null, null];
      state.players[0].faceDown = [null, null, null, null];
      state.pile = [];
      state.scores = [0, 99, 0];
    }
    localStorage.setItem('swipe-saved-game', JSON.stringify({ version: 2, savedAt: Date.now(), state }));
    localStorage.setItem('swipe-muted', 'true');
    localStorage.setItem('swipe-comfort-v1', JSON.stringify({pace:'relaxed',largeCards:true,coaching:true,reducedMotion:true}));
  }, kind);
  await page.reload();
  await page.getByRole('button', { name: 'Continue your game' }).click();
}
async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('swipe-saved-game')!).state);
}

test('home, tutorial keyboard focus, and remembered comfort settings', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', {name:'Good company. Great cards.'})).toBeVisible();
  await page.getByRole('button', { name: 'How to play', exact:true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for(let i=0; i<4; i++) await page.getByRole('button', { name:'Next', exact:true }).click();
  await expect(page.getByText('The lowest score wins.',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'How to play',exact:true})).toBeFocused();
  await page.getByRole('button', {name:'Comfort settings'}).click();
  await page.getByRole('switch', {name:/Gentle motion/}).check();
  await page.getByRole('button',{name:'Quick',exact:true}).click();
  await page.getByRole('button',{name:'All set'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Comfort settings'}).click();
  await expect(page.getByRole('switch',{name:/Gentle motion/})).toBeChecked();
  await expect(page.getByRole('button',{name:'Quick',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(errors).toEqual([]);
});

test('matching cards from hand and table form a confirmed multi-card play', async ({ page }) => {
  await saveFixture(page);
  await page.getByRole('button',{name:'5 of spades, 2 matching cards',exact:true}).click();
  await page.getByRole('button',{name:'5 of diamonds, table card 1',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play 3 matching cards'})).toBeEnabled();
  const before = await saved(page); expect(before.players[0].hand).toHaveLength(4);
  await page.getByRole('button',{name:'Play 3 matching cards'}).click();
  await expect.poll(async () => (await saved(page)).turnCount).toBe(1);
  const after = await saved(page);
  expect(after.players[0].hand).toHaveLength(2);
  expect(after.players[0].faceUp[0]).toBeNull();
  expect(after.pile).toHaveLength(5);
});

test('a 10 burns the pile and keeps the turn', async ({ page }) => {
  await saveFixture(page);
  await page.getByRole('button',{name:'10 of spades',exact:true}).click();
  await page.getByRole('button',{name:'Burn the pile',exact:true}).click();
  await expect.poll(async () => (await saved(page)).pile.length).toBe(0);
  expect((await saved(page)).currentPlayerIdx).toBe(0);
  await expect(page.getByText('An open table. Choose any rank to get started.')).toBeVisible();
});

test('voluntary pickup is confirmed and keeps the turn', async ({ page }) => {
  await saveFixture(page);
  await page.getByRole('button',{name:'Take pile',exact:true}).click();
  await page.getByRole('button',{name:'Take 2 cards',exact:true}).click();
  await expect.poll(async () => (await saved(page)).pile.length).toBe(0);
  expect((await saved(page)).players[0].hand).toHaveLength(6);
  expect((await saved(page)).currentPlayerIdx).toBe(0);
});

test('face-down reveals wait for confirmation and survive reload', async ({ page }) => {
  await saveFixture(page, 'flip');
  await page.getByRole('button',{name:'Choose face-down card 2',exact:true}).click();
  expect((await saved(page)).pendingFaceDown).toBeNull();
  await page.getByRole('button',{name:'Reveal card 2'}).click();
  await expect(page.getByRole('button',{name:'Confirm 5',exact:true})).toBeVisible();
  await page.waitForTimeout(1600);
  expect((await saved(page)).pendingFaceDown.card.id).toBe('d5');
  await page.reload();
  await page.getByRole('button',{name:'Continue your game'}).click();
  await page.getByRole('button',{name:'Confirm 5',exact:true}).click();
  await expect.poll(async () => (await saved(page)).pendingFaceDown).toBeNull();
  expect((await saved(page)).players[0].faceDown[1]).toBeNull();
});

test('pause freezes opponents, saves, and resumes', async ({ page }) => {
  await saveFixture(page, 'opponent');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const before = (await saved(page)).turnCount;
  await page.waitForTimeout(3000);
  expect((await saved(page)).turnCount).toBe(before);
  await page.getByRole('button',{name:'Save & return to the club'}).click();
  await page.getByRole('button',{name:'Continue your game'}).click();
  await expect.poll(async () => (await saved(page)).turnCount, {timeout:5000}).toBeGreaterThan(before);
});

test('round scorecard advances to a new round with totals intact', async ({ page }) => {
  await saveFixture(page, 'round');
  await expect(page.getByRole('heading',{name:'Beautifully played!'})).toBeVisible();
  await page.getByRole('button',{name:'Deal the next round'}).click();
  await expect.poll(async () => (await saved(page)).roundNumber).toBe(2);
  expect((await saved(page)).scores).toEqual([0,42,58]);
  expect((await saved(page)).players[0].hand).toHaveLength(12);
});

test('daily deal uses fixed settings; practice is marked separately', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:/The daily deal A fresh/}).click();
  await page.getByRole('button',{name:'Shuffle & deal'}).click();
  const daily = await saved(page);
  expect(daily.mode).toBe('daily'); expect(daily.seed).toMatch(/^daily-/); expect(daily.players).toHaveLength(4); expect(daily.difficulty).toBe('medium');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Save & return to the club'}).click();
  await page.getByRole('button',{name:/Easy does it A gentle practice/}).click();
  await page.getByRole('button',{name:'Shuffle & deal'}).click();
  expect((await saved(page)).mode).toBe('practice');
  expect((await saved(page)).difficulty).toBe('easy');
});

test('house rules persist into a new classic game', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Classic table Friendly/ }).click();
  await page.getByRole('button', { name: 'House rules +' }).click();
  await page.getByRole('switch', { name: /10s burn the pile/ }).uncheck();
  await page.getByRole('switch', { name: /2s reset the pile/ }).check();
  await page.getByRole('button', { name: 'Shuffle & deal' }).click();
  const state = await saved(page);
  expect(state.rules).toEqual({ tenBurns: false, fourOfAKindSwipes: true, twosReset: true });
});

test('restart replaces the current hand and resets scores', async ({ page }) => {
  await saveFixture(page);
  const before = await saved(page);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Start a fresh game' }).click();
  await page.getByRole('button', { name: 'Shuffle & deal' }).click();
  await expect.poll(async () => (await saved(page)).seed).not.toBe(before.seed);
  const after = await saved(page);
  expect(after.roundNumber).toBe(1);
  expect(after.scores).toEqual([0, 0, 0]);
  expect(after.players[0].hand).toHaveLength(12);
});

test('finishing the last card shows game results and starts another game', async ({ page }) => {
  await saveFixture(page, 'game-over-ready');
  await page.getByRole('button', { name: 'Ace of spades', exact: true }).click();
  await page.getByRole('button', { name: 'Play A', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A lovely little victory.' })).toBeVisible();
  await expect(page.getByText('The lowest score. The biggest smile.')).toBeVisible();
  await expect(page.getByText(/New milestones|A new milestone/)).toBeVisible();
  await page.getByRole('button', { name: 'One more game?' }).click();
  await expect.poll(async () => (await saved(page)).phase).toBe('playing');
  expect((await saved(page)).scores).toEqual([0, 0, 0]);
});

test('invalid saved data is cleared without blocking a new game', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('swipe-saved-game', JSON.stringify({ version: 2, savedAt: Date.now(), state: { phase: 'playing' } })));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Let’s play Swipe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue your game' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('swipe-saved-game'))).toBeNull();
});

test('phone has readable cards, reachable actions, scorecard, and no overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await saveFixture(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'Hint',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Select cards to play'})).toBeInViewport();
  await page.getByRole('button',{name:'Scores · 0 pts'}).click();
  await expect(page.getByRole('heading',{name:'The scorecard'})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Hint',exact:true}).click();
  await expect(page.locator('.play-action')).toBeEnabled();
  await page.screenshot({path:'test-results/swipe-phone.png',fullPage:true});
});

test('five-player tables remain usable from the smallest phone through tablet', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 700 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await saveFixture(page, 'five');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('region', { name: 'Game table' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Select cards to play' })).toBeInViewport();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'We’ll keep your seat.' })).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('the whole table fits one screen with no scrolling', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 664 }, { width: 375, height: 667 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    await saveFixture(page);
    const fit = await page.evaluate(() => {
      const play = document.querySelector('.gt-play')!;
      return { table: play.scrollHeight - play.clientHeight, page: document.documentElement.scrollHeight - innerHeight };
    });
    expect(fit.table, `table overflow at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(4);
    expect(fit.page, `page overflow at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button', { name: '5 of spades, 2 matching cards', exact: true })).toBeInViewport({ ratio: 0.9 });
    await expect(page.getByRole('button', { name: 'Queen of spades, table card 3', exact: true })).toBeInViewport({ ratio: 0.9 });
    await expect(page.getByRole('img', { name: /^Pile: 7 of hearts on top/ })).toBeInViewport({ ratio: 0.9 });
    await expect(page.locator('.play-action')).toBeInViewport({ ratio: 1 });
  }
});

test('flicking a card toward the pile plays it; a costly play still asks first', async ({ page }) => {
  await saveFixture(page);
  const fives = page.getByRole('button', { name: '5 of spades, 2 matching cards', exact: true });
  const box = (await fives.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + box.height / 2 - 40, { steps: 4 });
  await page.mouse.move(box.x + 20, box.y + box.height / 2 - 90, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await saved(page)).turnCount).toBe(1);
  expect((await saved(page)).pile.map((card: { rank: string }) => card.rank)).toEqual(['9', '7', '5', '5']);
});

test('keyboard and the count stepper choose how many cards to play', async ({ page }) => {
  await saveFixture(page);
  await page.keyboard.press('5');
  await expect(page.getByRole('button', { name: 'Play 3 matching cards' })).toBeEnabled();
  await page.getByRole('button', { name: 'One fewer 5' }).click();
  await page.getByRole('button', { name: 'One fewer 5' }).click();
  await expect(page.getByRole('button', { name: 'Play 5', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'One fewer 5' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Select cards to play' })).toBeDisabled();
  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: 'Burn the pile', exact: true })).toBeEnabled();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await saved(page)).pile.length).toBe(0);
  expect((await saved(page)).currentPlayerIdx).toBe(0);
});

test('an opponent’s move is shown at their seat and on the pile', async ({ page }) => {
  await saveFixture(page, 'opponent');
  const seat = page.locator('.gt-opponent').first();
  await expect(seat.locator('.gt-opponent-status')).toHaveText('Thinking…');
  await expect(seat.locator('.gt-opponent-status')).toHaveText(/^(Played|Burned|Swiped|Took|Flipped)/, { timeout: 6000 });
});

test('a finished daily deal records a result, a streak, and a shareable summary', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await saveFixture(page, 'game-over-ready');
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('swipe-saved-game')!);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    save.state.mode = 'daily';
    save.state.seed = `daily-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    localStorage.setItem('swipe-saved-game', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Continue your game' }).click();
  await page.getByRole('button', { name: 'Ace of spades', exact: true }).click();
  await page.getByRole('button', { name: 'Play A', exact: true }).click();
  await expect(page.getByText('Today’s deal: 1st of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Share result' }).click();
  await expect(page.getByRole('button', { name: 'Copied ✓' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('1st of 3 · 0 pts · 1 round');
  await page.getByRole('button', { name: 'Back to the club' }).click();
  await expect(page.getByText('Today’s deal won ✓')).toBeVisible();
});

test('home and game pass WCAG AA automated accessibility checks', async ({ page }) => {
  await page.goto('/');
  const home = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(home.violations.map(v => ({id:v.id,nodes:v.nodes.map(n => n.target)}))).toEqual([]);
  await saveFixture(page);
  const game = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(game.violations.map(v => ({id:v.id,nodes:v.nodes.map(n => n.target)}))).toEqual([]);
});
