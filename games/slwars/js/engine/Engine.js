import { Camera } from "./Camera.js";

/**
 * Core loop + state machine. Owns canvas, camera, and rAF timing.
 */
export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.width = canvas.width;
    this.height = canvas.height;
    this.camera = new Camera(this.width, this.height);
    this.states = new Map();
    this.current = null;
    this.running = false;
    this._lastTime = 0;
    this._raf = 0;
    this.time = 0;
  }

  /**
   * @param {string} name
   * @param {{ enter?: Function, exit?: Function, update?: Function, draw?: Function }} state
   */
  registerState(name, state) {
    this.states.set(name, state);
  }

  setState(name) {
    const next = this.states.get(name);
    if (!next) {
      throw new Error(`Unknown state: ${name}`);
    }
    if (this.current && this.current.exit) {
      this.current.exit(this);
    }
    this.current = next;
    this.currentName = name;
    if (next.enter) {
      next.enter(this);
    }
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this._lastTime = 0;
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  stop() {
    this.running = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  _frame(now) {
    if (!this.running) {
      return;
    }
    if (!this._lastTime) {
      this._lastTime = now;
    }
    let dt = (now - this._lastTime) / 1000;
    if (dt > 0.05) {
      dt = 0.05;
    }
    this._lastTime = now;
    this.time += dt;

    this.camera.update(dt);
    if (this.current && this.current.update) {
      this.current.update(this, dt);
    }
    if (this.current && this.current.draw) {
      this.current.draw(this);
    }

    this._raf = requestAnimationFrame((t) => this._frame(t));
  }
}
