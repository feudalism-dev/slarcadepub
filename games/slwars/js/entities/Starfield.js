import { Z_HORIZON, Z_PLAYER } from "../engine/Camera.js";

/**
 * Stars in world space. z decreases → scale grows → center-outward rush.
 */
export class Starfield {
  constructor(count = 160) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push(this._spawn(true));
    }
  }

  _spawn(randomZ) {
    return {
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 500,
      z: randomZ ? 1 + Math.random() * (Z_HORIZON - 1) : Z_HORIZON - Math.random() * 80,
    };
  }

  update(dt, speed = 400) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.z -= speed * dt;
      if (s.z <= Z_PLAYER) {
        const n = this._spawn(false);
        s.x = n.x;
        s.y = n.y;
        s.z = n.z;
      }
    }
  }

  draw(renderer, camera) {
    const ctx = renderer.ctx;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const p = camera.project(s.x, s.y, s.z);
      if (!p) continue;
      // Streak length grows as star approaches (scale increases)
      const streak = 1 + p.scale * 8;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(180,255,180,${0.15 + p.scale * 0.85})`;
      ctx.lineWidth = 1 + p.scale * 2;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + streak);
      ctx.stroke();
    }
  }
}
