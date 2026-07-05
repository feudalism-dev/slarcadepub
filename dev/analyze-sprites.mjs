import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "../games/invaders/sprites.png");

const img = sharp(src);
const meta = await img.metadata();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const h = info.height;
const ch = info.channels;

function isBg(r, g, b) {
  return r > 145 && g > 145 && b > 145;
}

for (let y = 0; y < h; y += 2) {
  let n = 0;
  let minx = w;
  let maxx = 0;
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * ch;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isBg(r, g, b)) {
      n++;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
    }
  }
  if (n > 120) {
    console.log(`y ${y} n ${n} x ${minx}-${maxx}`);
  }
}

// Sample grid for invader row 1 - find blob centers in x
function rowBlobs(y0, y1) {
  const cols = new Array(w).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      if (!isBg(data[i], data[i + 1], data[i + 2])) cols[x]++;
    }
  }
  const blobs = [];
  let start = -1;
  for (let x = 0; x < w; x++) {
    if (cols[x] > 3 && start < 0) start = x;
    if ((cols[x] <= 3 || x === w - 1) && start >= 0) {
      const end = cols[x] > 3 && x === w - 1 ? x : x - 1;
      if (end - start > 20) blobs.push([start, end]);
      start = -1;
    }
  }
  return blobs;
}

const rows = [
  ["A", 88, 175],
  ["B", 200, 285],
  ["C", 310, 395],
  ["D", 420, 505],
];
for (const [name, y0, y1] of rows) {
  console.log(`row ${name}`, rowBlobs(y0, y1));
}
