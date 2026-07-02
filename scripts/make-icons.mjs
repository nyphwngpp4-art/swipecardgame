/**
 * Generates all app icons + splash screens from a single SVG design
 * (the card-back medallion motif used on face-down cards in-game).
 *
 *   node scripts/make-icons.mjs
 *
 * Outputs:
 *   public/icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png  (PWA)
 *   assets/icon-only.png (1024), assets/splash.png + splash-dark.png (2732)         (Capacitor)
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const BRASS_LIGHT = '#E8C879';
const BRASS = '#C9A961';
const BRASS_DARK = '#A38847';

const defs = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="78%">
      <stop offset="0%" stop-color="#1A2E22"/>
      <stop offset="100%" stop-color="#0F1B14"/>
    </radialGradient>
  </defs>`;

/** Medallion centered at (cx, cy), sized by r (outer ring radius). */
function medallion(cx, cy, r) {
  const sq = r * 0.53; // half-diagonal of the rotated square
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${BRASS_LIGHT}" stroke-width="${r * 0.05}" opacity="0.9"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.79}" fill="none" stroke="${BRASS}" stroke-width="${r * 0.022}" opacity="0.55"/>
    <rect x="${cx - sq}" y="${cy - sq}" width="${sq * 2}" height="${sq * 2}" fill="none"
          stroke="${BRASS_LIGHT}" stroke-width="${r * 0.042}" opacity="0.85"
          transform="rotate(45 ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.11}" fill="${BRASS_LIGHT}"/>`;
}

function cornerDot(cx, cy, s) {
  return `<rect x="${cx - s}" y="${cy - s}" width="${s * 2}" height="${s * 2}" fill="${BRASS}" opacity="0.5"
          transform="rotate(45 ${cx} ${cy})"/>`;
}

/** App icon, 1024 viewBox. `inset` shrinks content toward center (for maskable safe zone). */
function iconSvg(inset = 0) {
  const s = (1024 - inset * 2) / 1024; // content scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${defs}
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g transform="translate(${inset} ${inset}) scale(${s})">
    <rect x="56" y="56" width="912" height="912" rx="96" fill="none" stroke="${BRASS}" stroke-width="10" opacity="0.85"/>
    <rect x="92" y="92" width="840" height="840" rx="72" fill="none" stroke="${BRASS_DARK}" stroke-width="4" opacity="0.6"/>
    ${medallion(512, 512, 240)}
    ${cornerDot(200, 200, 17)}
    ${cornerDot(824, 200, 17)}
    ${cornerDot(200, 824, 17)}
    ${cornerDot(824, 824, 17)}
  </g>
</svg>`;
}

/** Splash, 2732 square: full-bleed felt with a larger lone medallion. */
function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  ${defs}
  <rect width="2732" height="2732" fill="url(#bg)"/>
  ${medallion(1366, 1366, 330)}
</svg>`;
}

async function render(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`✓ ${file} (${size}px)`);
}

await mkdir('public', { recursive: true });
await mkdir('assets', { recursive: true });

const icon = iconSvg();
const maskable = iconSvg(102); // ~80% safe zone for Android maskable masks

await render(icon, 192, 'public/icon-192.png');
await render(icon, 512, 'public/icon-512.png');
await render(maskable, 512, 'public/icon-512-maskable.png');
await render(icon, 180, 'public/apple-touch-icon.png');
await render(icon, 1024, 'assets/icon-only.png');
await render(splashSvg(), 2732, 'assets/splash.png');
await render(splashSvg(), 2732, 'assets/splash-dark.png');

console.log('All icons generated.');
