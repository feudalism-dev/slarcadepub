import { Z_HORIZON, Z_PLAYER } from "../engine/Camera.js";

/**
 * Classic TIE/ln front-view wireframe in local units.
 * Screen size = TIE_ORIGINAL_SIZE * scale, where
 * scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + z).
 */
export const TIE_ORIGINAL_SIZE = 14;

/** Local vertices (pod, left wing, right wing). */
export const TIE_POINTS = [
  // Pod hex
  [0, -1.1],
  [1.0, -0.55],
  [1.0, 0.55],
  [0, 1.1],
  [-1.0, 0.55],
  [-1.0, -0.55],
  // Left wing hex
  [-5.2, -2.4],
  [-3.4, -2.4],
  [-2.6, 0],
  [-3.4, 2.4],
  [-5.2, 2.4],
  [-6.0, 0],
  // Right wing hex
  [5.2, -2.4],
  [3.4, -2.4],
  [2.6, 0],
  [3.4, 2.4],
  [5.2, 2.4],
  [6.0, 0],
];

export const TIE_SEGMENTS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 6],
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [16, 17],
  [17, 12],
  [5, 8],
  [4, 8],
  [1, 14],
  [2, 14],
];

export function createTie() {
  return {
    active: false,
    x: 0,
    y: 0,
    z: Z_HORIZON,
    baseX: 0,
    baseY: 0,
    ampX: 0,
    ampY: 0,
    speed: 200,
  };
}

/**
 * Spawn at the horizon with a world-space path center.
 */
export function resetTie(t, z = Z_HORIZON) {
  const side = Math.random() < 0.5 ? -1 : 1;
  t.z = z;
  t.baseX = side * (40 + Math.random() * 180);
  t.baseY = (Math.random() - 0.5) * 120;
  t.ampX = 30 + Math.random() * 50;
  t.ampY = 20 + Math.random() * 40;
  t.speed = 180 + Math.random() * 120;
  // Initial position from trajectory formula
  t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
  t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;
  return t;
}

/**
 * Step A: move toward camera (z decreases).
 * Curved path from z (not random size).
 * Step B: return true when z <= 0 (passed player — cull).
 */
export function updateTie(t, dt) {
  t.z -= t.speed * dt;

  // Curved flight path driven by depth
  t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
  t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;

  return t.z <= Z_PLAYER;
}

/**
 * Draw using true perspective: screen pos + drawnSize from z only.
 */
export function drawTie(renderer, camera, t) {
  const p = camera.project(t.x, t.y, t.z);
  if (!p) {
    return;
  }
  // drawnSize = ORIGINAL_SIZE * scale  (scale already = PF / (PF + z))
  const drawScale = TIE_ORIGINAL_SIZE * p.scale;
  const lw = p.scale > 0.55 ? 2 : 1.25;
  renderer.drawWireframe(
    TIE_POINTS,
    p.x,
    p.y,
    drawScale,
    "#66ff66",
    lw,
    TIE_SEGMENTS
  );
}
