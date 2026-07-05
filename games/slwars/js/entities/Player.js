/**
 * Player at z = 0. Mouse banks world camera (x/y), not a free-floating crosshair.
 */
export class Player {
  constructor(camera) {
    this.camera = camera;
  }

  update(input) {
    this.camera.setSteer(input.steerX, input.steerY);
  }

  /** Reticle near center; slight feedback from bank. */
  aimScreen(width, height) {
    return {
      x: width * 0.5 + this.camera.x * 0.08,
      y: height * 0.5 + this.camera.y * 0.08,
    };
  }
}
