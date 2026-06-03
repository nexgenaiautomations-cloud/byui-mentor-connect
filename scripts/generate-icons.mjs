// One-shot generator: takes the handshake source and writes every icon
// size the app needs (favicon, PWA, apple-touch, in-app logo).
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SRC = process.argv[2] ?? "C:/Users/gabri/Downloads/Untitled design (3) 1.png";
const PUBLIC = resolve(process.cwd(), "public");

// Brand background used behind the handshake on solid-fill icons.
const NAVY = { r: 27, g: 58, b: 107, alpha: 1 }; // #1B3A6B
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true });
}

// Trim transparent padding, then re-pad to a square so the handshake sits
// centered. Returns a Buffer of the trimmed-and-squared image at `size` px.
async function squareIcon({ size, bg, safeZoneRatio = 1 }) {
  const trimmed = await sharp(SRC).trim({ threshold: 10 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const side = Math.max(meta.width, meta.height);
  // Materialize the extend so sharp doesn't reorder it after a downstream
  // resize (which would produce a non-square result).
  const square = await sharp(trimmed)
    .extend({
      top: Math.floor((side - meta.height) / 2),
      bottom: Math.ceil((side - meta.height) / 2),
      left: Math.floor((side - meta.width) / 2),
      right: Math.ceil((side - meta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Now render onto a `size`-px canvas with the chosen background.
  // `safeZoneRatio < 1` shrinks the artwork inside a safe zone (needed for
  // maskable icons so the OS can crop into a circle/squircle).
  const inner = Math.round(size * safeZoneRatio);
  const resized = await sharp(square)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const out = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
  return out;
}

async function write(name, buf) {
  const path = resolve(PUBLIC, name);
  await ensureDir(path);
  await sharp(buf).png().toFile(path);
  console.log("wrote", name);
}

async function main() {
  // Favicon and Apple touch icons get a solid white background so the
  // handshake stays visible in browser tabs and on iOS home screens.
  await write("favicon-32.png", await squareIcon({ size: 32, bg: WHITE }));
  await write("apple-icon.png", await squareIcon({ size: 180, bg: WHITE }));

  // PWA icons: solid navy so they match the manifest theme color and look
  // intentional on phone home screens.
  await write("icon-192.png", await squareIcon({ size: 192, bg: NAVY }));
  await write("icon-512.png", await squareIcon({ size: 512, bg: NAVY }));
  // Maskable: keep the artwork in the safe zone (~80%) so OS masks don't
  // crop into the handshake.
  await write(
    "icon-maskable-512.png",
    await squareIcon({ size: 512, bg: NAVY, safeZoneRatio: 0.7 })
  );

  // Dashboard / sidebar logo: solid white background so the navy handshake
  // stays readable on top of the campus photo backdrop. Larger size so it
  // renders crisply on retina.
  await write(
    "byuican-icon.png",
    await squareIcon({ size: 256, bg: WHITE, safeZoneRatio: 0.78 })
  );

  // Small variant used by the topbar / mobile shell — same treatment.
  await write(
    "byuican-crest-sm.png",
    await squareIcon({ size: 96, bg: WHITE, safeZoneRatio: 0.78 })
  );

  // White silhouette on transparent — for the landing hero / dark-bg topbar
  // where a navy handshake on navy would disappear. Built by treating the
  // source alpha channel as a mask and stamping white pixels through it.
  await writeWhiteHandshake({ size: 256 });
}

async function writeWhiteHandshake({ size }) {
  const trimmed = await sharp(SRC).trim({ threshold: 10 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  const side = Math.max(meta.width, meta.height);
  // Materialize the extend in its own pipeline before resizing — sharp
  // internally reorders chained ops (resize, then extend) which would
  // otherwise produce a non-square result.
  const extended = await sharp(trimmed)
    .extend({
      top: Math.floor((side - meta.height) / 2),
      bottom: Math.ceil((side - meta.height) / 2),
      left: Math.floor((side - meta.width) / 2),
      right: Math.ceil((side - meta.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const square = await sharp(extended)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  // Take a fully opaque white block and intersect it with the handshake's
  // alpha mask using `dest-in`, leaving white pixels only where the
  // handshake is opaque.
  const white = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: square, blend: "dest-in" }])
    .png()
    .toBuffer();
  const path = resolve(PUBLIC, "byuican-handshake-white.png");
  await ensureDir(path);
  await sharp(white).toFile(path);
  console.log("wrote byuican-handshake-white.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
