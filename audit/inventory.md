# Inventory — Phase 1

Audit date: 2026-09-24. Branch: `claude/document-review-repo-changes-pn8r0y` @ `3279636` (PR #11 merged).

## Agent instruction files

| Looked for | Found |
|---|---|
| `CLAUDE.md` (any level) | **None** |
| `AGENTS.md` | **None** |
| `.claude/` (settings, skills, commands, hooks) | **None** |
| `.cursorrules`, `.cursor/`, `.github/copilot-instructions.md`, `.windsurfrules` | **None** |
| Embedded system prompts / prompt templates / few-shot examples | **None** (the app makes no LLM calls) |

The repo contains no agent-facing instructions. Durable project rules exist only as code comments (see `audit/REPORT.md`).

## Human-facing docs that agents will read as instructions

| File | Role |
|---|---|
| `README.md` | Feature summary, game rules, run/test/deploy commands, architecture, AI notes |
| `APP_STORE_PLAN.md` | iOS/Capacitor plan, phase status, manual steps for Jay, deploy command, launch checklist |

## Plans, specs, TODOs

- `APP_STORE_PLAN.md` holds the only plan/checklist. The Phase 3 table and the "Testing checklist" are unfinished.
- The code has no `TODO`, `FIXME`, `HACK`, or `XXX` markers (checked `src/`, `tests/`, `scripts/`).

## Build, test, and CI surface

| File | Notes |
|---|---|
| `package.json` | `lint` = `tsc --noEmit`; `test` = four `tsx` scripts in `src/__test/`; `test:ui` = Playwright; `build` = `tsc -b` + Vite via `scripts/vite.mjs` |
| `.github/workflows/quality.yml` | lint → test → build → Playwright install → test:ui, on PR and on push to main |
| `playwright.config.ts` | single worker; dev server on :5195; `SWIPE_SYSTEM_CHROME` env switches to the system Chrome channel |
| `.node-version` (`22`), `engines` (`>=22.12.0`) | Node pin |
| `wrangler.jsonc` | Cloudflare Worker static-assets deploy → `swipe.agaviai.com` |
| `capacitor.config.ts` | iOS wrapper; `ios/` is **gitignored** |
| `vite.config.mjs`, `scripts/vite.mjs` | Vite loaded programmatically (single config/module cache) |
| `tailwind.config.js`, `postcss.config.js`, `src/index.css` | Tailwind pipeline |
| `scripts/make-icons.mjs` | icon/splash generation |

## Source layout (3,067 lines TS/TSX)

- `src/game/`: pure engine (`engine`, `rules`, `deck`, `ai`, `guidance`, `types`)
- `src/lib/`: `persistence` (versioned saves), `progression`, `preferences`, `random` (seeded RNG), `sound` (audio and haptics)
- `src/hooks/useSwipeGame.ts`: state, saving, sound, and CPU pacing
- `src/components/club/*`, `src/App.tsx`, `src/club.css`: UI (PR #11 redesign)
- `src/__test/*.ts`: rules and simulation tests; `tests/club.spec.ts`: browser and axe tests

## Agent session history

- `~/.claude/projects/-home-user-swipecardgame/`: contains **only this audit session**. There are no prior Claude Code sessions on this container, because cloud containers are ephemeral.
- `~/.codex/sessions/`: **does not exist**.
- Proxy used instead: git history (39 commits: 28 by the repo owner account, 10 `Claude`, 1 `Agavi`) plus GitHub PR bodies and review threads (#1–#11). Branch prefixes `claude/`, `codex/`, and `agent/` show that at least three different agents have worked on the repo.
