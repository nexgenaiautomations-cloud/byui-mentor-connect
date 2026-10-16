// One-shot generator for the ICAN brand assets: the hero shield, the 1-2-3
// crest, the in-app/email logo tiles, favicons and PWA icons. Everything is
// drawn as SVG here (so wording/colors are easy to change) and rasterized
// with sharp. The handshake comes from the white alpha-mask PNG.
// Run: node scripts/generate-brand-assets.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import opentype from "opentype.js";

const PUBLIC = resolve(process.cwd(), "public");
const HANDSHAKE = resolve(PUBLIC, "ican-handshake-white.png");

const INK = "#2E1065";
const BRAND = "#6D28D9";
const MAGENTA = "#A21CAF";
const DARK = "#4C1D95";
const LIGHT = "#C4B5FD";
const GOLD = "#E9C46A";
// Wordmark face: Cinzel (OFL, Google Fonts) — classical Roman capitals.
// Rendered as outlined paths so the PNGs don't depend on installed fonts.
const CINZEL = opentype.loadSync(resolve(process.cwd(), "scripts/fonts/Cinzel.ttf"));
const FONT = "'Arial Black', 'Segoe UI Black', Arial, Helvetica, sans-serif";

// Centered, letter-spaced text as an SVG path in the Cinzel face.
function cinzel(text, cx, baseline, size, tracking = 0, fill = "#ffffff") {
  const scale = size / CINZEL.unitsPerEm;
  const glyphs = CINZEL.stringToGlyphs(text);
  const widths = glyphs.map((g) => g.advanceWidth * scale);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (glyphs.length - 1);
  let x = cx - total / 2;
  const d = glyphs
    .map((g, i) => {
      const path = g.getPath(x, baseline, size).toPathData(2);
      x += widths[i] + tracking;
      return path;
    })
    .join(" ");
  return `<path d="${d}" fill="${fill}"/>`;
}
const FONT_TEXT = "'Segoe UI', Arial, Helvetica, sans-serif";

const handshakeB64 = async (hex) => {
  // Recolor the white mask to `hex` (or keep white) and return a data URI.
  const base = await readFile(HANDSHAKE);
  if (!hex) return `data:image/png;base64,${base.toString("base64")}`;
  const { width, height } = await sharp(base).metadata();
  const tinted = await sharp({
    create: { width, height, channels: 4, background: hex },
  })
    .composite([{ input: base, blend: "dest-in" }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${tinted.toString("base64")}`;
};

const gradient = (id) => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${INK}"/>
    <stop offset="0.55" stop-color="${BRAND}"/>
    <stop offset="1" stop-color="${MAGENTA}"/>
  </linearGradient>`;

// Shield silhouette in a 1000-wide box; `h` is the bottom tip y.
const shieldPath = (inset, h) => {
  const l = 60 + inset;
  const r = 940 - inset;
  const t = 70 + inset;
  const shoulder = t + 90;
  const sideEnd = h * 0.56;
  return `M500 ${t} L${r} ${shoulder} L${r} ${sideEnd}
    C${r} ${h * 0.8} ${700 - inset * 0.2} ${h * 0.92} 500 ${h - inset * 1.2}
    C${300 + inset * 0.2} ${h * 0.92} ${l} ${h * 0.8} ${l} ${sideEnd} L${l} ${shoulder} Z`;
};

async function shieldSvg() {
  const hs = await handshakeB64();
  const H = 1100;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 ${H}" width="1000" height="${H}">
  <defs>${gradient("g")}</defs>
  <path d="${shieldPath(0, H)}" fill="#ffffff"/>
  <path d="${shieldPath(22, H)}" fill="url(#g)"/>
  <path d="${shieldPath(52, H)}" fill="none" stroke="${LIGHT}" stroke-opacity="0.55" stroke-width="6"/>
  <image href="${hs}" xlink:href="${hs}" x="300" y="150" width="400" height="400"/>
  ${cinzel("ICAN", 500, 745, 230, 18)}
  <rect x="350" y="790" width="300" height="4" rx="2" fill="${GOLD}"/>
  ${cinzel("CAREER ADVANCEMENT", 500, 856, 38, 4)}
  ${cinzel("NETWORK", 500, 906, 38, 4)}
</svg>`;
}

async function crestSvg() {
  const hs = await handshakeB64();
  const H = 1500;
  const cols = [
    { x: 250, n: "1", lines: ["CAREER", "TASK"], sub: ["WEEKLY"] },
    { x: 500, n: "2", lines: ["INTERNSHIPS", "/ INDUSTRY", "EXPERIENCES"], sub: ["BEFORE", "SENIOR YEAR"] },
    { x: 750, n: "3", lines: ["CAREER", "CHATS"], sub: ["EACH MONTH"] },
  ];
  const colSvg = cols
    .map((c) => {
      const lines = c.lines
        .map(
          (l, i) =>
            `<text x="${c.x}" y="${560 + i * 44}" text-anchor="middle" font-family="${FONT_TEXT}" font-weight="800" font-size="${c.lines.length > 2 ? 30 : 40}" fill="#ffffff">${l}</text>`
        )
        .join("");
      const subs = c.sub
        .map(
          (l, i) =>
            `<text x="${c.x}" y="${720 + i * 36}" text-anchor="middle" font-family="${FONT_TEXT}" font-weight="700" font-size="28" fill="${LIGHT}">${l}</text>`
        )
        .join("");
      return `${cinzel(c.n, c.x, 460, 150)}
        <rect x="${c.x - 50}" y="490" width="100" height="4" rx="2" fill="${GOLD}"/>
        ${lines}${subs}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 ${H}" width="1000" height="${H}">
  <defs>${gradient("g")}</defs>
  <path d="${shieldPath(0, H)}" fill="#ffffff"/>
  <path d="${shieldPath(22, H)}" fill="url(#g)"/>
  <path d="${shieldPath(52, H)}" fill="none" stroke="${LIGHT}" stroke-opacity="0.55" stroke-width="6"/>
  <image href="${hs}" xlink:href="${hs}" x="400" y="110" width="200" height="200"/>
  <line x1="375" y1="320" x2="375" y2="800" stroke="${LIGHT}" stroke-opacity="0.5" stroke-width="4"/>
  <line x1="625" y1="320" x2="625" y2="800" stroke="${LIGHT}" stroke-opacity="0.5" stroke-width="4"/>
  ${colSvg}
  <rect x="140" y="830" width="720" height="4" rx="2" fill="#ffffff" fill-opacity="0.6"/>
  ${cinzel("ICAN", 500, 1025, 200, 16)}
  <rect x="360" y="1068" width="280" height="4" rx="2" fill="${GOLD}"/>
  ${cinzel("CAREER ADVANCEMENT", 500, 1128, 38, 5)}
  ${cinzel("NETWORK", 500, 1176, 38, 5)}
</svg>`;
}

// Square tile with the handshake centered. `bg` is "gradient", "white" or a hex.
async function tileSvg({ size, bg, handshake, ratio = 0.7, radius = 0 }) {
  const hs = await handshakeB64(handshake);
  const inner = size * ratio;
  const off = (size - inner) / 2;
  const fill = bg === "gradient" ? "url(#g)" : bg === "white" ? "#ffffff" : bg;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>${gradient("g")}</defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="${fill}"/>
  <image href="${hs}" xlink:href="${hs}" x="${off}" y="${off}" width="${inner}" height="${inner}"/>
</svg>`;
}

async function png(name, svg, width) {
  const out = resolve(PUBLIC, name);
  let img = sharp(Buffer.from(svg), { density: 144 });
  if (width) img = img.resize({ width });
  await img.png().toFile(out);
  console.log("wrote", name);
}

async function main() {
  await png("ican-shield.png", await shieldSvg(), 800);
  await png("ican-crest.png", await crestSvg(), 800);

  // Favicons / apple-touch: purple handshake on white for browser tabs.
  await png("favicon-32.png", await tileSvg({ size: 32, bg: "white", handshake: DARK, ratio: 0.96 }));
  await png("favicon-128.png", await tileSvg({ size: 128, bg: "white", handshake: DARK, ratio: 0.9 }));
  await png("apple-icon.png", await tileSvg({ size: 180, bg: "white", handshake: DARK, ratio: 0.8 }));

  // PWA icons: white handshake on the brand gradient.
  await png("icon-192.png", await tileSvg({ size: 192, bg: "gradient", ratio: 0.72 }));
  await png("icon-512.png", await tileSvg({ size: 512, bg: "gradient", ratio: 0.72 }));
  await png("icon-maskable-512.png", await tileSvg({ size: 512, bg: "gradient", ratio: 0.56 }));

  // Email header + small in-app tile.
  await png("ican-icon.png", await tileSvg({ size: 256, bg: "white", handshake: DARK, ratio: 0.78, radius: 40 }));
  await png("ican-crest-sm.png", await tileSvg({ size: 96, bg: "white", handshake: DARK, ratio: 0.78 }));

  // favicon.ico: a 32px PNG is accepted inside .ico by every modern browser,
  // but sharp can't write ICO — emit a 16px PNG the layout already falls
  // back from; the .ico file is rebuilt from it below.
  const ico16 = await sharp(Buffer.from(await tileSvg({ size: 16, bg: "white", handshake: DARK, ratio: 1 })))
    .png()
    .toBuffer();
  await writeIco(resolve(PUBLIC, "favicon.ico"), ico16);
}

// Minimal single-image ICO container wrapping a PNG payload.
async function writeIco(path, pngBuf) {
  const { writeFile } = await import("node:fs/promises");
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(16, 6);
  header.writeUInt8(16, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngBuf.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile(path, Buffer.concat([header, pngBuf]));
  console.log("wrote favicon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
