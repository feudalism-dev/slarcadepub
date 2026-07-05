/**
 * Wireframe canvas renderer. All drawing via beginPath / moveTo / lineTo.
 */
export class Renderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  clear(color = "#000000") {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw a local 2D vertex map at world position, scaled by perspective.
   * `points` is an array of [x,y] pairs; segments are consecutive pairs
   * or use `segments` as index pairs into `points`.
   *
   * @param {Array<[number, number]>} points local vertices
   * @param {number} sx screen x of origin
   * @param {number} sy screen y of origin
   * @param {number} scale perspective scale (focusDistance / z)
   * @param {string} color
   * @param {number} [lineWidth]
   * @param {Array<[number, number]>} [segments] optional edge list as point indices
   */
  drawWireframe(points, sx, sy, scale, color, lineWidth = 1.5, segments = null) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (segments) {
      for (let i = 0; i < segments.length; i++) {
        const a = points[segments[i][0]];
        const b = points[segments[i][1]];
        ctx.moveTo(sx + a[0] * scale, sy + a[1] * scale);
        ctx.lineTo(sx + b[0] * scale, sy + b[1] * scale);
      }
    } else {
      for (let i = 0; i < points.length; i += 2) {
        const a = points[i];
        const b = points[i + 1];
        if (!a || !b) break;
        ctx.moveTo(sx + a[0] * scale, sy + a[1] * scale);
        ctx.lineTo(sx + b[0] * scale, sy + b[1] * scale);
      }
    }
    ctx.stroke();
  }

  /**
   * Draw a world-space segment through the camera.
   */
  drawWorldLine(camera, x1, y1, z1, x2, y2, z2, color, width = 1, fly = false) {
    const proj = fly ? camera.projectFly.bind(camera) : camera.project.bind(camera);
    const a = proj(x1, y1, z1);
    const b = proj(x2, y2, z2);
    if (!a || !b) {
      return;
    }
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  drawCrosshair(x, y, color = "#66ff66") {
    const ctx = this.ctx;
    const s = 10;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - 3, y);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y - 3);
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + s);
    ctx.stroke();
  }
}
