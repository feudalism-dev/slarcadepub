/**
 * Stars rush from horizon (high z) toward camera — center-outward motion.
 */
export class Starfield {
  constructor(count = 140) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push(this._spawn(true));
    }
  }

  _spawn(randomZ) {
    return {
      x: (Math.random() - 0.5) * 70,
      y: (Math.random() - 0.5) * 50,
      z: randomZ ? 0.5 + Math.random() * 99.5 : 90 + Math.random() * 10,
    };
  }

  update(dt, speed = 50) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.z -= speed * dt * (0.55 + (100 - s.z) / 100);
      if (s.z < 0.2) {
        const n = this._spawn(false);
        s.x = n.x;
        s.y = n.y;
        s.z = n.z;
      }
    }
  }

  /**
   * @param {import('../render/Renderer.js').Renderer} renderer
   * @param {import('../engine/Camera.js').Camera} camera
   */
  draw(renderer, camera) {
    const ctx = renderer.ctx;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const p = camera.projectFly(s.x, s.y, s.z);
      if (!p) continue;
      const bright = 1 - s.z / 100;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(180,255,180,${0.2 + bright * 0.8})`;
      ctx.lineWidth = 1 + bright * 2;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + 1 + bright * 5);
      ctx.stroke();
    }
  }
}
