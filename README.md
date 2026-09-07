# Swipe

A warm, accessible, mobile-first version of the card game **Swipe**, built with Vite, React, TypeScript, and Tailwind.

## The Card Club experience

- **Three ways to play:** a configurable classic table, a shared daily deal, and a gentle practice table.
- **Comfort-first play:** large cards by default, optional coaching, reduced motion, two table colours, sound controls, and adjustable computer-player pace.
- **Clear turns:** cards are selected before they are committed, legal choices are highlighted, matching cards can be grouped, and potentially costly moves explain their result before play.
- **Friendly progression:** local milestones, win history, automatic saves, and a full scorecard without accounts or tracking.
- **Accessible controls:** keyboard-ready dialogs, visible focus states, WCAG AA colour contrast, and complete text labels for cards and controls.
- **Offline-ready:** the production build includes an installable PWA and all fonts and sounds needed for play.

## Rules (this build)

- **3–5 players.** Two decks shuffled together (104 cards). Each player gets 4 face-down, 4 face-up (sitting on top of face-down), and 12 in hand.
- **Play equal-or-lower** than the top card of the pile. Aces are low (A=1). 10 is special — see below.
- **Multi-card plays:** any number of same-rank cards from your hand and/or face-up at once. Multi-cards capped so the top of the pile never exceeds four of a kind in a single play (e.g. if a 5 is on top, you may play up to three 5s, completing the four).
- **10 burns the pile.** Pile cleared, you play again.
- **Four of a kind on top of the pile swipes it.** Whoever placed the fourth plays again with anything.
- **No equal-or-lower in your hand?** You **must play higher** and pick up the pile. **Any cards in the pile matching the rank you just played stay on the new pile** alongside your played cards. The rest goes to your hand. (Example: you play a 9 over a King; if there's already a 9 in the pile, both 9s stay as the new pile, and you pick up everything else.) The same extraction rule applies if a flipped face-down card is too high — there's strategy in choosing which higher rank to dump.
- **Face-up cards** play just like hand cards. To play a face-down card you must first clear the face-up sitting on it. You then choose any later turn to flip it.
- **Flipping face-down** is a gamble: if it's playable, it counts as your play (and you may chain matching-rank cards from your hand to thin your stack); if it's higher than the top of pile, you pick up the pile.
- **Going out:** first player to empty all 20 cards wins the round and scores 0.
- **Scoring:** A=1, 2–9 face value, J/Q/K=10, **10=20**. Round ends, others total their remaining cards. First player to hit the loss threshold (100/200/300) ends the game; **lowest cumulative total wins.**

## Run it

```bash
npm ci
npm run dev
```

Then open `http://localhost:5173` on your phone (same Wi-Fi) or desktop.

Node.js 22.12 or newer is required.

## Quality checks

```bash
npm run lint       # TypeScript
npm test           # rules, regressions, and complete simulated games
npm run test:ui    # browser flows, responsive layouts, and WCAG AA checks
npm run build      # production PWA
```

## Deploy

```bash
npm run build
# dist/ is a static SPA — drop it on Vercel, Cloudflare Pages, Netlify, etc.
```

For Vercel: `vercel --prod` from the project root, or import the repo on the dashboard.

## Architecture

- `src/game/` — pure game logic. Engine, rules, deck, AI. No React.
- `src/hooks/useSwipeGame.ts` — coordinates game state, saving, sounds, and paced computer turns.
- `src/components/club/` — the responsive lobby, card table, dialogs, scoring, tutorial, and comfort controls.
- `src/lib/preferences.ts` — local comfort settings.
- `tests/club.spec.ts` — full browser and accessibility coverage.

The engine is fully deterministic and pure (apart from the shuffle), so it's easy to add tests, replays, or networked multiplayer later.

## App Store

See [APP_STORE_PLAN.md](APP_STORE_PLAN.md) for the Capacitor-based iOS conversion plan.

## Sound credits

Card foley from [Kenney — Casino Audio](https://kenney.nl/assets/casino-audio) (CC0 / public
domain), converted to AAC in `public/sounds/`. Playback adds random pitch/volume variation per
play; see `src/lib/sound.ts`.

## Notes on the AI

The current CPU is heuristic, not search-based. It:
- Plays the most-copies-of-a-rank that's equal-or-lower, preferring higher legal ranks (saves low cards as defense).
- Uses 10s as legal burns when no ordinary safe play exists.
- When forced higher, dumps the highest-scoring rank with most copies.
- Auto-chains matching cards on face-down flips.

Gentle, balanced, and clever difficulties tune its decisions while keeping the same rules as the player.
