/**
 * Virtual camera + 3D→2D projection.
 * scale = focusDistance / z  (z is depth ahead of the camera).
 */
export class Camera {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cx = width * 0.5;
    this.cy = height * 0.45;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.focusDistance = 280;
    this.zNear = 0.35;
    this.zFar = 100;

    /** Smoothed view bank (world shift from mouse steering). */
    this.viewX = 0;
    this.viewY = 0;
    this._targetViewX = 0;
    this._targetViewY = 0;
  }

  /**
   * Mouse offsets in [-1, 1] steer the world (inertia), not a fixed crosshair.
   */
  setSteer(nx, ny) {
    this._targetViewX = nx * 14;
    this._targetViewY = ny * 9;
  }

  update(dt) {
    const k = 1 - Math.exp(-7 * dt);
    this.viewX += (this._targetViewX - this.viewX) * k;
    this.viewY += (this._targetViewY - this.viewY) * k;
    this.x = this.viewX;
    this.y = this.viewY;
  }

  /**
   * Project world point to screen.
   * @returns {{x:number,y:number,z:number,scale:number}|null}
   */
  project(wx, wy, wz) {
    const z = wz - this.z;
    if (z < this.zNear || z > this.zFar) {
      return null;
    }
    const scale = this.focusDistance / z;
    return {
      x: (wx - this.x) * scale + this.cx,
      y: (wy - this.y) * scale + this.cy,
      z,
      scale,
    };
  }

  /** Allow fly-past slightly closer than zNear for off-screen exit. */
  projectFly(wx, wy, wz) {
    const z = wz - this.z;
    if (z < 0.12 || z > this.zFar) {
      return null;
    }
    const scale = this.focusDistance / z;
    return {
      x: (wx - this.x) * scale + this.cx,
      y: (wy - this.y) * scale + this.cy,
      z,
      scale,
    };
  }
}
