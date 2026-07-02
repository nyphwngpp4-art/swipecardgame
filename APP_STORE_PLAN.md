# Swipe → iOS App Store: Conversion Plan

The game is a static Vite/React SPA, which makes **Capacitor** the right wrapper: it embeds the
built `dist/` in a real native iOS app with access to native haptics, splash screens, and the
App Store pipeline. No rewrite needed.

## ✅ Phase 1 — Capacitor wrapper (DONE — June 2026)

The native project lives in `ios/` (Capacitor 8, Swift Package Manager — no CocoaPods needed).
After any web code change:

```bash
npm run build && npx cap sync ios
```

## ✅ Phase 2 — Native polish (DONE — June 2026)

All shipped:

1. **Real haptics** — `haptic()` in `src/lib/sound.ts` routes through `@capacitor/haptics`
   (Taptic impacts + success notifications) on native, `navigator.vibrate` on web.
2. **Self-hosted fonts** — `@fontsource-variable/fraunces` + `dm-sans`, bundled woff2,
   Google Fonts CDN removed. Fully offline.
3. **Icon + splash** — generated from `scripts/make-icons.mjs` (card-back medallion design)
   into the Xcode asset catalog via `@capacitor/assets`. Regenerate: `node scripts/make-icons.mjs
   && npx capacitor-assets generate --ios`.
4. **Status bar + orientation** — light status-bar text set at launch (`src/main.tsx`);
   portrait-locked in `ios/App/App/Info.plist`.
5. **PWA / offline** — `vite-plugin-pwa` service worker precaches everything; manifest +
   home-screen icons in `public/`. Deploying `dist/` to any static host gives a free
   installable web app (Safari → Share → Add to Home Screen).
6. **Audio unlock** — Web Audio resumes on first gesture (pre-existing). Verify on device.

## Jay's manual steps — run it on your iPhone (free, no Developer Program)

1. **Install Xcode** from the Mac App Store (big download, ~12 GB). Then point the
   command-line tools at it:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. **Open the project:** `npx cap open ios` (or open `ios/App/App.xcodeproj` in Xcode).
   First open: let Xcode finish "Resolving Package Dependencies" (Swift Package Manager).
3. **Sign with your free Apple ID:** Xcode → Settings → Accounts → "+" → add your Apple ID.
   Then select the **App** target → Signing & Capabilities → check "Automatically manage
   signing" → Team: *your name (Personal Team)*.
4. **Run on your phone:** plug in the iPhone (tap "Trust" on it), pick it in the device
   dropdown, press ▶︎. First run: on the phone, Settings → General → VPN & Device
   Management → trust your developer certificate.
5. Free-account caveats: the install expires after **7 days** (re-run from Xcode to refresh)
   and you can have 3 personally-signed apps at a time.

## ✅ Free distribution — LIVE at https://swipe.agaviai.com (June 2026)

Deployed as a Cloudflare Worker with static assets (`wrangler.jsonc`), custom domain
`swipe.agaviai.com` auto-provisioned with DNS + SSL. Redeploy after changes:

```bash
npm run build && npx wrangler deploy
```

On iPhone: open https://swipe.agaviai.com in Safari → Share → **Add to Home Screen**.
Launches fullscreen, works offline after first load, saves games locally.

## Phase 3 — App Store submission

| Item | Detail |
|------|--------|
| Apple Developer Program | $99/year, needed to ship to TestFlight + App Store |
| Bundle ID | `com.agavi.swipe` (set in Phase 1) |
| Privacy "nutrition label" | Easy: the game collects **no data** — select "Data Not Collected" |
| Privacy policy URL | Still required even with no collection; a one-paragraph page on agavi.ai works |
| Age rating | Questionnaire → 4+ (simulated gambling = No; it's a shedding card game, no wagering) |
| Screenshots | 6.7" (1290×2796) and 6.5" (1284×2778) sets — capture from simulator with both themes |
| App Review note | Guideline 4.2 (minimum functionality) rejects website-like wrappers. Swipe is fine: fully interactive, offline, haptics, no external links. Mention "fully offline card game, no account needed" in review notes. |

## Phase 4 — Worth doing before/shortly after launch

- **Resume-in-progress game** — ✅ shipped (June 2026): `GameState` autosaves to localStorage on
  every move (`src/lib/persistence.ts`), clears on game over, and the start menu shows a
  Continue card. Before App Store launch, swap the storage calls for `@capacitor/preferences`
  so saves survive iOS storage eviction.
- **Stats**: games played / won, best score — local only, shown on the start menu.
- **Game Center**: leaderboard for lowest cumulative score, achievements ("First Swipe",
  "Burn 3 piles in one round"). `@capacitor-community/game-center` or defer to v1.1.
- **Android**: `npx cap add android` reuses everything; Play Store is a $25 one-time fee.

## Testing checklist before submitting

- [ ] iPhone with Dynamic Island: HUD and action button clear of notch/home indicator (safe-area
      padding shipped in this revision — verify on device)
- [ ] Sound + haptics on physical device
- [ ] Airplane mode: app fully playable, fonts render
- [ ] Backgrounding mid-animation, then resuming — animations recover
- [ ] iPad: layout centers (max-width container already handles this)
