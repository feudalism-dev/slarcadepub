/**
 * Player ship: mouse banks the world (via Camera), reticle sits near center
 * with a slight steer offset for feedback.
 */
export class Player {
  constructor(camera) {
    this.camera = camera;
  }

  /**
   * @param {import('../input/Input.js').Input} input
   */
  update(input) {
    this.camera.setSteer(input.steerX, input.steerY);
  }

  /** Screen-space aim point (slight offset from center). */
  aimScreen(width, height) {
    return {
      x: width * 0.5 + this.camera.viewX * 1.6,
      y: height * 0.45 + this.camera.viewY * 1.4,
    };
  }
}
