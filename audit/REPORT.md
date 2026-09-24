# Project audit — Swipe (2026-09-24)

## Executive summary

1. The repo has **no agent instructions**: no CLAUDE.md, no AGENTS.md, no `.claude/`. Claude, a second agent, and Codex have each worked on it with no shared rules and no human review, and the same bug classes were fixed in three separate PRs.
2. The two docs agents *do* read are partly wrong. README says deploy is on Vercel, but it is a Cloudflare auto-deploy from `main`. README calls the engine "deterministic apart from the shuffle", but the shuffle is seeded now. README also calls it a Tailwind project, but no Tailwind utilities are used.
3. The UI layer is written as very long single lines: 44 TSX lines over 300 characters, and `club.css` has 43 lines, one of them 7,217 characters. This is the biggest code-level drag on any agent or reviewer editing the UI.
4. All checks pass on the current head: lint, unit/simulation tests, build, and 15/15 Playwright + axe tests. The browser tests fail out of the box in Claude Code cloud sessions because of a Chromium version mismatch. A small config change fixes that.
5. Recommended order: items 1–4 are quick, documentation-heavy wins. Item 5 (formatting) has the most leverage. Items 6–8 need a decision from you before I act.

Every item below was checked against the current code (commit `3279636`) unless it is marked *historical*. Supporting detail: `audit/inventory.md`, `audit/session-notes.md`.

---

## Ranked findings — quick wins first

### 1. Add a shared agent instruction file (AGENTS.md, with CLAUDE.md importing it) — impact HIGH, effort LOW

**Problem and evidence.**
- There are no instruction files (`audit/inventory.md`).
- Three agent tools worked in sequence: `claude/` for #1 and #3–#9, `agent/` for #10, `codex/` for #11.
- No PR has ever had a review.
- Durable rules exist only in PR bodies or code comments:
  - save compatibility: `src/lib/persistence.ts:5-6`
  - pace default: `src/lib/preferences.ts:7-8`
  - determinism and the Daily Deal seed: PR #10
  - deploy target: PR #9
  - house-rule defaults: PR #4
  - a deliberate rule, flipping face-down while you still hold hand cards: PR #10
- The same bug classes recurred:
  - stale/duplicate card actions in #3, #10 and #11
  - small-screen overflow in #5 and #11
  - save robustness in #4, #10 and #11

**Proposed change.** Add a plain `AGENTS.md` of about 60 lines. Codex reads that file natively. Add a one-line `CLAUDE.md` containing `@AGENTS.md` so Claude Code loads the same file. It would cover:
- **Commands:** lint, test, test:ui, build. Node ≥ 22.12.
- **Architecture map:** the accurate version.
- **Non-negotiables:**
  - never break loading of older saves: bump `VERSION` in `persistence.ts` and backfill fields
  - engine stays pure and seeded
  - WCAG AA axe tests and the 320px layouts must keep passing
  - rule changes must update the README rules section and `src/__test`
- **Known traps:**
  - any action fired after a delay or animation must check that the turn hasn't moved on
  - the Play handler must not receive the DOM event
- **Deploy:** push to `main` triggers the Cloudflare worker `swipecardgame`. `ios/` is local-only.
- **Git:** one branch per PR.

**Affects:** documentation only. No runtime change.

**Test:** `npm run lint && npm test` still pass (no code touched). Check that each command and path in the file exists.

### 2. Correct README.md — impact MEDIUM, effort LOW

**Problem and evidence (all verified):**

- **Deploy target is wrong.** README says "For Vercel: `vercel --prod`" (`README.md:51-54`). The real target is Cloudflare: `wrangler.jsonc` routes to `swipe.agaviai.com`, and a push to `main` auto-deploys (PRs #7 and #9).
- **Determinism claim is stale.** README says "fully deterministic and pure (apart from the shuffle)" (`README.md:66`). The shuffle is seeded via `createSeededRng` (`src/game/engine.ts:52-53`).
- **Tailwind claim misleads.** README says the app is "built with … Tailwind" (`README.md:3`). None of the custom `felt/bone/brass/oxblood` theme tokens are used anywhere in `src/`. Only Tailwind's base reset is in effect, and styling lives in `src/club.css`. An agent following the README would write utility classes into a codebase that uses none.
- **Architecture list is incomplete** (`README.md:58-64`). It omits `src/game/guidance.ts`, `src/lib/persistence.ts`, `progression.ts`, `random.ts`, `sound.ts`, and `src/__test/`.
- **Rules section is incomplete.** It omits the configurable house rules: 2s reset, and toggling off burns and swipes (`src/game/types.ts` `HouseRules`; Lobby toggles). It also omits the voluntary pickup, which is exercised by `tests/club.spec.ts:84`.

**Proposed change.** Rewrite those five passages. Keep everything else, including the sound credits and the AI notes.

**Affects:** documentation only.

**Test:** check each command and path in the diff against the repo, and run `npm run lint`.

### 3. Refresh APP_STORE_PLAN.md status — impact LOW–MEDIUM, effort LOW

**Problem and evidence:**
- **Stats marked as still to do.** Phase 4 lists "Stats: games played / won, best score" as future work, but it shipped in `src/lib/progression.ts` (commit 05ecaa2).
- **Deploy instructions conflict.** The plan gives only `npx wrangler deploy` as the way to redeploy, while `main` already auto-deploys (#7).
- **`ios/` is not in git.** The plan says "The native project lives in `ios/`", but `ios/` is in `.gitignore`. The portrait lock in `Info.plist` and the Xcode signing setup therefore exist on one Mac only, not in git. This is the underlying issue behind item 7.
- **Domain mismatch.** The privacy-policy row says "agavi.ai", but the domain used everywhere else is `agaviai.com`. I'm flagging this rather than fixing it, because it may be intentional.

**Proposed change.** Update the status lines, note the auto-deploy, and state plainly that `ios/` is local-only. Leave the Phase 3 table and the checklist untouched.

**Affects:** documentation only.

**Test:** read-through, plus a spot check of each claim against the code.

### 4. Make the browser tests runnable in Claude Code cloud sessions — impact MEDIUM, effort LOW

**Problem and evidence (verified this session).**
- `npm run test:ui` fails 15/15 here with "Executable doesn't exist at …chromium_headless_shell-1243".
- The cause is a version mismatch: `@playwright/test` 1.63 expects browser build 1243, while the container ships build 1194 at `/opt/pw-browsers`.
- Pointing `launchOptions.executablePath` at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` makes all 15 pass (32.6s).
- The config's only escape hatch, `SWIPE_SYSTEM_CHROME`, switches to the system Chrome channel, and Chrome isn't installed here.
- Result: any cloud agent either skips the UI tests or burns time on this.

**Proposed change.**
- In `playwright.config.ts`, honour an optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` env var and pass it as `launchOptions.executablePath`.
- Document the variable in AGENTS.md.
- CI is unchanged, because it runs `npx playwright install`.

**Affects:** test config only.

**Test:** `npm run test:ui` with the variable set gives 15/15 here. Without it the behaviour is unchanged, which CI will confirm.

### 5. Adopt Prettier and reformat the UI layer once — impact HIGH, effort MEDIUM

**Problem and evidence.**
- 44 lines in `src/App.tsx` and `src/components/club/*.tsx` exceed 300 characters. `GameTable.tsx:106` is 1,500 characters, and `GameTable.tsx:86` holds the whole turn-instruction decision tree as one nested ternary.
- `src/club.css` is the entire stylesheet in 43 lines; line 23 alone is 7,217 characters.
- These are hard to review and hard to diff, and exact-match editing tools fail on them or need huge context. This UI layer is also where the stale/duplicate-action bugs have recurred.

**Proposed change.**
- Add `prettier` as a devDependency with a minimal config, plus `format` and `format:check` scripts.
- Run it once over `src/`, `tests/` and `scripts/` as a single mechanical commit with no hand edits.
- Add `npm run format:check` to CI.
- I'd leave splitting the nested ternary at `GameTable.tsx:86` into a small function as a separate, optional follow-up.

**Affects:**
- Every source file changes whitespace only.
- Open branches would conflict. None are active, but that's the cost.

**Test:**
- lint, `npm test`, `npm run build`, and `npm run test:ui` (15/15).
- Compare the built CSS with a whitespace-insensitive diff against the pre-format build.
- Take screenshots of the lobby and table at 390px and 1440px before and after, and compare them.

### 6. Remove the dead Tailwind theme (and optionally Tailwind itself) — impact LOW–MEDIUM, effort LOW–MEDIUM, **needs your call**

**Problem and evidence.**
- None of the colour, font, shadow or animation extensions in `tailwind.config.js` (felt/bone/brass/oxblood, `glow-brass`, `pulse-glow`) are referenced in `src/`.
- The only Tailwind output that matters is Preflight, from `@tailwind base` in `src/index.css`. `shadow-card` looks like a match, but it is actually a custom class (`pile-shadow-card`).
- The leftover design tokens come from the pre-#11 look, and they contradict the current palette in `club.css`.

**Options:**
- (a) Delete the unused `theme.extend` block. This is safe because nothing references it.
- (b) Remove Tailwind and PostCSS entirely and replace Preflight with the few reset rules the UI relies on. That is cleaner, but it risks visual changes.

I recommend (a) now, and (b) only if you want a lighter toolchain.

**Test:** build, test:ui, and a screenshot comparison. For (a), the built CSS should be byte-identical.

### 7. Decide whether `ios/` belongs in git — impact MEDIUM, effort LOW, **needs your call**

**Problem.** `ios/` is gitignored (`.gitignore:5`). Capacitor's own guidance is to commit the native project. Right now the Info.plist portrait lock, the signing settings and the generated icon catalog live on one machine only. No cloud agent or second Mac can reproduce the iOS build.

**Proposed change.** Remove `ios/` from `.gitignore` and commit the project from your Mac. I can't do this from here, because the folder isn't in the repo. The alternative is to keep it ignored on purpose and document why.

**Test:** a fresh clone, then `npm ci && npm run build && npx cap sync ios`, then open it in Xcode.

### 8. Repo hygiene on GitHub — impact LOW, effort LOW, **outward-facing, needs your OK**

**Problem and evidence.**
- PR #2, the Cloudflare bot's worker rename, is still open, although #9 already did the rename.
- Four merged branches remain on the remote: `agent/…`, `claude/swipe-game-deployment-uhptxm`, `codex/…`, and `update_worker_name_to_swipecardgame`.

**Proposed change.** Close #2 with a note, and delete the four merged branches.

**Test:** `git ls-remote --heads origin` shows only `main` plus the active branches.

### 9. Minor code and CI consistency — impact LOW, effort TRIVIAL

- `useSwipeGame` defaults `pace = 'relaxed'` (`src/hooks/useSwipeGame.ts:104`), but the #11 review decision made `'regular'` the default (`src/lib/preferences.ts:9-11`). `App.tsx:26` always passes the preference, so nothing is broken today, but the two defaults contradict each other. Proposed change: default to `DEFAULT_PREFERENCES.pace`.
- CI hard-codes `node-version: 22` (`.github/workflows/quality.yml:16`) while the repo pins Node in `.node-version`. Proposed change: use `node-version-file: .node-version` so there's one source of truth.

**Test:** lint, test, and CI green on the PR.

---

## Dropped — checked and already resolved

- **AI-vs-AI stalls** (#3, *historical*): a 480-game simulation this session gave **0 stalls**. It covered 4 rule variants × 3 difficulties × 40 seeded games of 3–5 players. The retry in `src/__test/fullgame.ts:56-60` currently hides nothing. It could be removed later, but it isn't worth an item.
- **"GameBoard not fully decomposed"** (#10): the component no longer exists, because #11 replaced it.
- **Save migration** (#4, #10): implemented and versioned (`src/lib/persistence.ts`), and covered by `tests/club.spec.ts:177`.

## Not changed and deliberately kept

- The long-form rules in the README are verbose but correct and useful, so I'd extend them rather than trim them.
- Jay's manual iPhone steps in APP_STORE_PLAN.md are human instructions, not agent noise, so they stay as they are.
- No security, legal or privacy requirements were found that need rewording. The "Data Not Collected" privacy stance stays as it is.

---

**Stopping here.** Nothing outside `audit/` has been modified. Tell me which item numbers to apply. I'll do them one at a time, run the tests listed for each, and show you the diff before moving to the next.
