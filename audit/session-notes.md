# Session notes — Phase 3

**Source caveat.** No local agent transcripts exist. `~/.claude/projects/` holds only this audit session, and `~/.codex/` is absent. These notes come from the proxy record instead: git history plus GitHub PRs #1–#11 (bodies, comments, and review threads, all read read-only). No secrets or personal data were copied.

## What the record shows

- **No human review has ever happened.** None of the 11 PRs has a review, review comment, or thread. The only comments are Cloudflare deploy-status bot posts on #2, #10, and #11. Most PRs were merged within seconds of being opened. PR bodies and code comments are therefore the only place decisions were ever written down.
- **Three different agent tools, and no shared instructions between them:**
  - `claude/swipe-game-deployment-uhptxm` produced PRs #1 and #3–#9 (2026-07-01 → 07-02). That is one branch reused for 8 PRs.
  - `agent/gameplay-guidance-progression` produced #10 (2026-07-11 → merged 08-01).
  - `codex/swipe-card-club` produced #11 (2026-09-07), a full UI redesign.

  Each agent had to rediscover the conventions on its own.

## Recurring problems (same class fixed more than once)

| Problem class | Where | Rough date |
|---|---|---|
| Stale or duplicate card actions from UI events and delayed animations | #3 (Play button passed the click event as the card list), #10 (delayed card-flight submits a stale move), #11 (stale/duplicate card actions again) | 07-02, 07-11, 09-07 |
| Small-screen overflow / unreachable controls | #5 (Deal button unreachable at 390×660), #11 (320px → tablet) | 07-02, 09-07 |
| Save compatibility / robustness | #4 (old saves fall back to standard rules), #10 (versioned and validated schema), #11 (invalid saves recovered) | 07-01, 07-11, 09-07 |
| Deploy target / worker-name confusion | #2, #7, #9 | 07-02 |
| AI-vs-AI stalls | #3 (2/108 → 1/216 stalls; a test retry was added) | 07-02 |

## Decisions that never made it into agent instructions

- **Deploy:** Cloudflare Workers via Git integration, worker `swipecardgame`, domain swipe.agaviai.com (#9). A push to `main` auto-builds (#7). The old `swipe-game` worker is stale (#9). *(README still says Vercel.)*
- **House-rule defaults:** 10s burn on, four-of-a-kind swipes on, 2s reset off. Old saves fall back to standard rules (#4).
- **Deliberate rule choice:** a face-down card may be flipped while cards remain in hand (#10).
- **Determinism:** seeded shuffles, deterministic CPU per turn, date-seeded Daily Deal (#10). *(README still says "apart from the shuffle".)*
- **Saves:** never delete a player's in-progress game on update; the schema is versioned (#10; also a comment in `src/lib/persistence.ts`).
- **CPU pace default:** changed to `regular` in the #11 review fix (commit d977117). It lives only in a code comment in `src/lib/preferences.ts`.
- **Quality bar:** lint + unit + build + 15 Playwright/axe (WCAG AA) tests; layouts from 320px to tablet (#11).
- **Hints:** shown for the first four games, fading during game four (#10).
- **PWA:** autoUpdate registration, so a new deploy shows on the first visit (#6).

## Unfinished work mentioned

- #10: the old `GameBoard` "was not fully decomposed". **Obsolete**, because #11 replaced it (`src/components/` now holds only `club/`).
- PR #2 (Cloudflare bot worker rename) is still **open** although #9 superseded it.
- Merged branches still on the remote: `agent/gameplay-guidance-progression`, `claude/swipe-game-deployment-uhptxm`, `codex/swipe-card-club`, `update_worker_name_to_swipecardgame`.
- `APP_STORE_PLAN.md`: swap localStorage for `@capacitor/preferences` before App Store launch. Still not done: the dependency is absent.
