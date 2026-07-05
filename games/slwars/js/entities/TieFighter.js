import {
  Z_HORIZON,
  Z_PLAYER,
  PERSPECTIVE_FACTOR,
  projectVertex,
} from "../engine/Camera.js";

export const TIE_MODEL_SCALE = 42;

function buildTieWireframe() {
  const segs = [];
  const add = (a, b) => segs.push({ p1: a, p2: b });

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
  const eq = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    eq.push([Math.cos(a) * podR * 1.05, Math.sin(a) * podR * 1.05, 0]);
  }
  for (let i = 0; i < 6; i++) {
    add(eq[i], eq[(i + 1) % 6]);
  }

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
    add(pts[0], pts[3]);
    add(pts[1], pts[4]);
    add(pts[2], pts[5]);
    return pts;
  }
  const left = wingHex(-1);
  const right = wingHex(1);
  const hubL = [-wingX * 0.55, 0, 0];
  const hubR = [wingX * 0.55, 0, 0];
  add([-podR, 0, 0], hubL);
  add(hubL, left[2]);
  add(hubL, left[5]);
  add([podR, 0, 0], hubR);
  add(hubR, right[2]);
  add(hubR, right[5]);
  add([0, podR * 0.4, 0], hubL);
  add([0, -podR * 0.4, 0], hubL);
  add([0, podR * 0.4, 0], hubR);
  add([0, -podR * 0.4, 0], hubR);

  return segs;
}

export const TIE_FIGHTER_WIREFRAME = buildTieWireframe();

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
    rotationSpeedX: 0,
    rotationSpeedY: 0,
    rotationSpeedZ: 0,
  };
}

export function resetTie(t, z = Z_HORIZON) {
  const side = Math.random() < 0.5 ? -1 : 1;
  t.z = z;
  t.baseX = side * (60 + Math.random() * 200);
  t.baseY = (Math.random() - 0.5) * 140;
  t.ampX = 40 + Math.random() * 60;
  t.ampY = 25 + Math.random() * 45;
  t.speed = 140 + Math.random() * 70;
  t.rx = Math.random() * Math.PI * 2;
  t.ry = Math.random() * Math.PI * 2;
  t.rz = (Math.random() - 0.5) * 0.8;
  t.rotationSpeedX = (Math.random() - 0.5) * 3.5;
  t.rotationSpeedY = 1.8 + Math.random() * 2.8;
  t.rotationSpeedZ = (Math.random() - 0.5) * 2.2;
  t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
  t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;
  return t;
}

export function updateTie(t, dt) {
  t.z -= t.speed * dt;
  t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
  t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;
  t.rx += t.rotationSpeedX * dt;
  t.ry += t.rotationSpeedY * dt;
  t.rz += t.rotationSpeedZ * dt;
  return t.z <= Z_PLAYER;
}

/**
 * Each endpoint: rotate → world translate → perspective (never a flat 2D map).
 */
export function drawTie(renderer, camera, t) {
  const ctx = renderer.ctx;
  const segs = TIE_FIGHTER_WIREFRAME;
  const centerScale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + t.z);
  const lw = centerScale > 0.4 ? 2 : 1.3;

  ctx.beginPath();
  ctx.strokeStyle = "#66ff66";
  ctx.lineWidth = lw;

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const a = projectVertex(s.p1, t, camera, TIE_MODEL_SCALE);
    const b = projectVertex(s.p2, t, camera, TIE_MODEL_SCALE);
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}
