/**
 * Classic TIE/ln front-view wireframe:
 * central hexagonal pod, left/right hexagonal wing panels, pylons.
 * Local units; screen size = local * (focusDistance / z).
 */

/** Vertex map (local 2D). */
export const TIE_POINTS = [
  // Pod hex (center)
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

/** Edges as indices into TIE_POINTS. */
export const TIE_SEGMENTS = [
  // Pod
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 0],
  // Left wing
  [6, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 6],
  // Right wing
  [12, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [16, 17],
  [17, 12],
  // Pylons (pod to wing hubs)
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
    z: 100,
    startZ: 100,
    entryX: 0,
    entryY: 0,
    exitX: 0,
    exitY: 0,
    curveAmp: 0,
    curveAmpY: 0,
    phase: 0,
    freq: 1,
    speed: 30,
    age: 0,
    size: 1,
  };
}

/**
 * Reset a pooled TIE onto a peripheral attack run.
 */
export function resetTie(t, z = 100) {
  const side = Math.random() < 0.5 ? -1 : 1;
  t.z = z;
  t.startZ = z;
  t.entryX = side * (12 + Math.random() * 20);
  t.entryY = (Math.random() - 0.5) * 16;
  t.exitX = -side * (8 + Math.random() * 14);
  t.exitY = t.entryY - (10 + Math.random() * 8);
  t.curveAmp = (8 + Math.random() * 14) * (Math.random() < 0.5 ? -1 : 1);
  t.curveAmpY = 3 + Math.random() * 5;
  t.phase = Math.random() * Math.PI * 2;
  t.freq = 1.3 + Math.random() * 1.8;
  t.speed = 28 + Math.random() * 18;
  t.age = 0;
  t.size = 0.9 + Math.random() * 0.35;
  t.x = t.entryX;
  t.y = t.entryY;
  return t;
}

/**
 * Curved attack run. Returns true when past the player (release to pool).
 */
export function updateTie(t, dt, camera) {
  t.age += dt;
  t.z -= t.speed * dt;

  let progress = 1 - t.z / t.startZ;
  if (progress < 0) progress = 0;
  if (progress > 1) progress = 1;

  const arc = Math.sin(progress * Math.PI);
  t.x =
    t.entryX * (1 - progress) +
    t.exitX * progress +
    arc * t.curveAmp +
    Math.sin(t.age * t.freq + t.phase) * (2 + arc * 3);
  t.y =
    t.entryY * (1 - progress) +
    t.exitY * progress +
    arc * t.curveAmpY * 0.4 +
    Math.sin(t.age * t.freq * 0.8 + t.phase * 1.2) * (1.2 + arc * 2);

  // Near-camera bank with player view (maneuvering feel)
  if (t.z < 15) {
    const close = (15 - t.z) / 15;
    t.x += camera.viewX * 0.35 * close;
    t.y += camera.viewY * 0.35 * close;
  }

  // Missed — flew past player
  return t.z < 0.15;
}

/**
 * @param {import('../render/Renderer.js').Renderer} renderer
 * @param {import('../engine/Camera.js').Camera} camera
 * @param {object} t
 */
export function drawTie(renderer, camera, t) {
  const p = camera.projectFly(t.x, t.y, t.z);
  if (!p) {
    return;
  }
  const scale = p.scale * t.size;
  const lw = t.z < 10 ? 2 : 1.4;
  renderer.drawWireframe(
    TIE_POINTS,
    p.x,
    p.y,
    scale,
    "#66ff66",
    lw,
    TIE_SEGMENTS
  );
}
