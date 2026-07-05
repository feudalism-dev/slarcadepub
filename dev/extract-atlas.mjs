import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "../games/invaders/sprites.png");

const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
const w = info.width;
const ch = info.channels;

function isBg(r, g, b) {
  return r > 142 && g > 142 && b > 142;
}

function trimRect(x0, y0, x1, y1) {
  let minX = x1;
  let minY = y1;
  let maxX = x0;
  let maxY = y0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * ch;
      if (!isBg(data[i], data[i + 1], data[i + 2])) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const COLS = [34, 112, 190, 268, 346, 424, 502, 580];
const CELL_W = 78;
const ROW_BANDS = [
  [96, 188],
  [206, 298],
  [316, 408],
  [426, 518],
];

const invaders = [];
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 8; col++) {
    const rect = trimRect(COLS[col], ROW_BANDS[row][0], COLS[col] + CELL_W, ROW_BANDS[row][1]);
    if (rect) {
      invaders.push({
        row,
        frame: col % 2,
        color: Math.floor(col / 2),
        ...rect,
      });
    }
  }
}

const atlas = {
  sheet: "sprites.jpg",
  invaders,
  player: [
    trimRect(36, 552, 128, 638),
    trimRect(132, 552, 228, 638),
  ],
  bullet: trimRect(708, 502, 900, 518),
  levelComplete: trimRect(36, 782, 198, 958),
  gameOver: trimRect(204, 782, 358, 958),
};

console.log(JSON.stringify(atlas, null, 2));
fs.writeFileSync(path.join(__dirname, "../games/invaders/sprites-atlas.json"), JSON.stringify(atlas, null, 2));
