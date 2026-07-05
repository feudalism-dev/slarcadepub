import { Z_HORIZON, Z_PLAYER, PERSPECTIVE_FACTOR } from "../engine/Camera.js";

/**
 * 3D TIE/ln wireframe: central pod, hexagonal wing panels, struts.
 * Each frame: rotate local vertices → translate to world → perspective project → lineTo.
 */

/** Model scale in world units (before perspective). */
export const TIE_MODEL_SCALE = 18;

/**
 * Build line segments as pairs of 3D points [x,y,z] in model space.
 * Pod ≈ faceted sphere; wings = hexagons in YZ planes; struts connect them.
 */
function buildTieWireframe() {
  const segs = [];
  const add = (a, b) => segs.push({ p1: a, p2: b });

  // --- Central pod: front + back hex rings + meridians (faceted sphere) ---
  const podR = 1.0;
  const podZ = 0.7;
  const front = [];
  const back = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    front.push([Math.cos(a) * podR, Math.sin(a) * podR, podZ]);
    back.push([Math.cos(a) * podR, Math.sin(a) * podR, -podZ]);
  }
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    add(front[i], front[j]);
    add(back[i], back[j]);
    add(front[i], back[i]);
  }
  // Equator ring for sphere volume
  const eq = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    eq.push([Math.cos(a) * podR * 1.05, Math.sin(a) * podR * 1.05, 0]);
  }
  for (let i = 0; i < 6; i++) {
    add(eq[i], eq[(i + 1) % 6]);
  }

  // --- Hexagonal wing panels (in YZ plane, offset on X) ---
  const wingX = 3.4;
  const wingR = 2.6;
  function wingHex(xSign) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      pts.push([xSign * wingX, Math.cos(a) * wingR, Math.sin(a) * wingR]);
    }
    for (let i = 0; i < 6; i++) {
      add(pts[i], pts[(i + 1) % 6]);
    }
    // Cross braces on panel for 3D panel read
    add(pts[0], pts[3]);
    add(pts[1], pts[4]);
    add(pts[2], pts[5]);
    return pts;
  }
  const left = wingHex(-1);
  const right = wingHex(1);

  // --- Struts (pod to wing hubs) ---
  const hubL = [-wingX * 0.55, 0, 0];
  const hubR = [wingX * 0.55, 0, 0];
  add([-podR, 0, 0], hubL);
  add(hubL, left[2]);
  add(hubL, left[5]);
  add([podR, 0, 0], hubR);
  add(hubR, right[2]);
  add(hubR, right[5]);
  // Secondary struts for thickness
  add([0, podR * 0.4, 0], hubL);
  add([0, -podR * 0.4, 0], hubL);
  add([0, podR * 0.4, 0], hubR);
  add([0, -podR * 0.4, 0], hubR);

  return segs;
}

export const TIE_FIGHTER_WIREFRAME = buildTieWireframe();

function rotateX(x, y, z, c, s) {
  return [x, y * c - z * s, y * s + z * c];
}

function rotateY(x, y, z, c, s) {
  return [x * c + z * s, y, -x * s + z * c];
}

function rotateZ(x, y, z, c, s) {
  return [x * c - y * s, x * s + y * c, z];
}

/**
 * Rotate a model-space point by the fighter's orientation, then scale.
 */
function transformVertex(vx, vy, vz, t) {
  const cx = Math.cos(t.rx);
  const sx = Math.sin(t.rx);
  const cy = Math.cos(t.ry);
  const sy = Math.sin(t.ry);
  const cz = Math.cos(t.rz);
  const sz = Math.sin(t.rz);

  let p = rotateY(vx, vy, vz, cy, sy);
  p = rotateX(p[0], p[1], p[2], cx, sx);
  p = rotateZ(p[0], p[1], p[2], cz, sz);

  const s = TIE_MODEL_SCALE;
  return {
    x: t.x + p[0] * s,
    y: t.y + p[1] * s,
    z: t.z + p[2] * s,
  };
}

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
    rx: 0,
    ry: 0,
    rz: 0,
    drx: 0,
    dry: 0,
    drz: 0,
  };
}

export function resetTie(t, z = Z_HORIZON) {
  const side = Math.random() < 0.5 ? -1 : 1;
  t.z = z;
  t.baseX = side * (60 + Math.random() * 200);
  t.baseY = (Math.random() - 0.5) * 140;
  t.ampX = 40 + Math.random() * 60;
  t.ampY = 25 + Math.random() * 45;
  t.speed = 160 + Math.random() * 80;
  t.rx = Math.random() * Math.PI * 2;
  t.ry = Math.random() * Math.PI * 2;
  t.rz = Math.random() * Math.PI * 2;
  // Continuous tumble as they approach (arcade feel)
  t.drx = (Math.random() - 0.5) * 1.8;
  t.dry = 0.6 + Math.random() * 1.4;
  t.drz = (Math.random() - 0.5) * 1.2;
  t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
  t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;
  return t;
}

/**
 * Approach camera, curve path, spin in 3D.
 * @returns {boolean} true when past player (cull)
 */
export function updateTie(t, dt) {
  t.z -= t.speed * dt;
  t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
  t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;
  t.rx += t.drx * dt;
  t.ry += t.dry * dt;
  t.rz += t.drz * dt;
  return t.z <= Z_PLAYER;
}

/**
 * Project one world point with the camera formula.
 */
function projectWorld(camera, wx, wy, wz) {
  if (wz <= Z_PLAYER) {
    return null;
  }
  const scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + wz);
  return {
    x: (wx - camera.x) * scale + camera.cx,
    y: (wy - camera.y) * scale + camera.cy,
    scale,
  };
}

/**
 * Draw full 3D wireframe: rotate → world translate → perspective → line segments.
 */
export function drawTie(renderer, camera, t) {
  const ctx = renderer.ctx;
  const segs = TIE_FIGHTER_WIREFRAME;
  const centerScale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + t.z);
  const lw = centerScale > 0.45 ? 1.8 : 1.2;

  ctx.beginPath();
  ctx.strokeStyle = "#66ff66";
  ctx.lineWidth = lw;

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const w1 = transformVertex(s.p1[0], s.p1[1], s.p1[2], t);
    const w2 = transformVertex(s.p2[0], s.p2[1], s.p2[2], t);
    const a = projectWorld(camera, w1.x, w1.y, w1.z);
    const b = projectWorld(camera, w2.x, w2.y, w2.z);
    if (!a || !b) {
      continue;
    }
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}
