// Strip the white canvas around the BYUI CAN shield while preserving the
// shield's white interior panels.
//
// Naive flood-fill leaks through tiny gaps in the navy outline (around the
// handshake fingers and the bottom point) and ends up erasing the inside.
// To prevent that, we:
//   1. Build a "barrier" mask of every pixel that isn't pure white.
//   2. Dilate the mask so small gaps in the navy outline close up.
//   3. BFS from the four image edges through non-barrier (pure-white) pixels
//      and set only those to transparent.
import sharp from "sharp";
import { resolve } from "node:path";

const SRC = process.argv[2] ?? "C:/Users/gabri/Downloads/, AI generated.png";
const OUT = resolve(process.cwd(), "public/byuican-shield.png");

const WHITE_THRESHOLD = 245; // a pixel is white if R, G, and B all exceed this
const DILATE_RADIUS = 4;     // pixels — wide enough to seal hairline outline gaps

async function main() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = Buffer.from(data);

  // Pass 1: barrier mask — anything that isn't pure white.
  const barrier = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (
        px[i] < WHITE_THRESHOLD ||
        px[i + 1] < WHITE_THRESHOLD ||
        px[i + 2] < WHITE_THRESHOLD
      ) {
        barrier[y * W + x] = 1;
      }
    }
  }

  // Pass 2: dilate the barrier so tiny outline breaks close up.
  const dilated = new Uint8Array(W * H);
  const R = DILATE_RADIUS;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hit = 0;
      for (let dy = -R; dy <= R && !hit; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          if (barrier[ny * W + nx]) {
            hit = 1;
            break;
          }
        }
      }
      dilated[y * W + x] = hit;
    }
  }

  // Pass 3: BFS from all four image edges through non-dilated pixels.
  const reached = new Uint8Array(W * H);
  const queue = [];
  function push(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const v = y * W + x;
    if (reached[v] || dilated[v]) return;
    reached[v] = 1;
    queue.push(v);
  }
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (queue.length) {
    const v = queue.pop();
    const x = v % W;
    const y = (v - x) / W;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Pass 4: write alpha 0 only for pixels the BFS could actually reach. The
  // dilated band stays opaque (white halo close to the navy outline), which
  // is preferable to chewing into the outline itself.
  for (let i3 = 0; i3 < W * H; i3++) {
    if (reached[i3]) px[i3 * 4 + 3] = 0;
  }

  // Now trim the transparent border so the image is tight to the shield. We
  // crop manually because sharp's .trim() ignores alpha-only borders here.
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    const srcRow = (minY + y) * W + minX;
    const dstRow = y * cropW;
    for (let x = 0; x < cropW; x++) {
      const si = (srcRow + x) * 4;
      const di = (dstRow + x) * 4;
      cropped[di] = px[si];
      cropped[di + 1] = px[si + 1];
      cropped[di + 2] = px[si + 2];
      cropped[di + 3] = px[si + 3];
    }
  }

  await sharp(cropped, { raw: { width: cropW, height: cropH, channels: 4 } })
    .png()
    .toFile(OUT);
  console.log("wrote", OUT, `${cropW}x${cropH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
