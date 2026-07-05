/**
 * True Z-axis perspective projection.
 *
 * World: player at z = 0, horizon at z = 1000.
 * scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + z)
 * screenX = (x * scale) + width/2
 * screenY = (y * scale) + height/2
 * drawnSize = originalSize * scale
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

    /** World-space view bank (mouse steering shifts the world). */
    this.x = 0;
    this.y = 0;
    this._targetX = 0;
    this._targetY = 0;
  }

  /** Mouse offsets in [-1, 1] bank the world with inertia. */
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
   * Perspective scale for a world z.
   * Grows toward 1 as z → 0; shrinks toward 0 as z → horizon.
   */
  scaleAt(z) {
    if (z < Z_PLAYER) {
      return null;
    }
    return PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + z);
  }

  /**
   * Project world (x, y, z) → screen.
   * @returns {{x:number,y:number,z:number,scale:number,drawnSize:function}|null}
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

  /** drawnSize = originalSize * scale */
  drawnSize(originalSize, z) {
    const scale = this.scaleAt(z);
    if (scale === null) {
      return 0;
    }
    return originalSize * scale;
  }
}
