/**
 * True Z-axis perspective projection.
 *
 * World: player at z = 0, horizon at z = 1000.
 * scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + z)
 * screenX = (x * scale) + width/2
 * screenY = (y * scale) + height/2
 *
 * Rotation is NOT done here — call projectVertex() on each model vertex
 * (rotate → translate → then camera.project).
 */
export const PERSPECTIVE_FACTOR = 500;
export const Z_HORIZON = 1000;
export const Z_PLAYER = 0;

export class Camera {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cx = width * 0.5;
    this.cy = height * 0.5;
    this.x = 0;
    this.y = 0;
    this._targetX = 0;
    this._targetY = 0;
  }

  setSteer(nx, ny) {
    this._targetX = nx * 120;
    this._targetY = ny * 80;
  }

  update(dt) {
    const k = 1 - Math.exp(-7 * dt);
    this.x += (this._targetX - this.x) * k;
    this.y += (this._targetY - this.y) * k;
  }

  /**
   * Project a WORLD-SPACE point. Vertices must already be rotated + translated.
   */
  project(wx, wy, wz) {
    if (wz <= Z_PLAYER) {
      return null;
    }
    const scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + wz);
    return {
      x: (wx - this.x) * scale + this.cx,
      y: (wy - this.y) * scale + this.cy,
      z: wz,
      scale,
    };
  }
}

/**
 * Transforms a local 3D vertex into a 2D screen coordinate.
 * 1. Rotate by fighter.rx / ry / rz (tumbling)
 * 2. Add fighter world position
 * 3. Apply PERSPECTIVE_FACTOR projection
 *
 * @param {number[]|{x:number,y:number,z:number}} v
 * @param {object} fighter
 * @param {Camera} camera
 * @param {number} modelScale
 */
export function projectVertex(v, fighter, camera, modelScale = 42) {
  let lx = (v.x !== undefined ? v.x : v[0]) * modelScale;
  let ly = (v.y !== undefined ? v.y : v[1]) * modelScale;
  let lz = (v.z !== undefined ? v.z : v[2]) * modelScale;

  const cy = Math.cos(fighter.ry);
  const sy = Math.sin(fighter.ry);
  let rx = lx * cy - lz * sy;
  let rz = lx * sy + lz * cy;
  let ry = ly;

  const cx = Math.cos(fighter.rx);
  const sx = Math.sin(fighter.rx);
  const rry = ry * cx - rz * sx;
  const rrz = ry * sx + rz * cx;
  const rrx = rx;

  const cz = Math.cos(fighter.rz);
  const sz = Math.sin(fighter.rz);
  const worldX = rrx * cz - rry * sz + fighter.x;
  const worldY = rrx * sz + rry * cz + fighter.y;
  const worldZ = rrz + fighter.z;

  return camera.project(worldX, worldY, worldZ);
}
