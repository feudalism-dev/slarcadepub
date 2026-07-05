/**
 * Pointer input for CEF / MOAP. Mouse steers the world view.
 */
export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.mouseX = canvas.width * 0.5;
    this.mouseY = canvas.height * 0.5;
    this.steerX = 0;
    this.steerY = 0;
    this.fireHeld = false;
    this._onMove = (e) => this._pointer(e.clientX, e.clientY);
    this._onDown = (e) => {
      this._pointer(e.clientX, e.clientY);
      this.fireHeld = true;
    };
    this._onUp = () => {
      this.fireHeld = false;
    };
    this._onTouchMove = (e) => {
      if (e.touches.length) {
        this._pointer(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    };
  }

  bind() {
    const c = this.canvas;
    c.addEventListener("mousemove", this._onMove);
    c.addEventListener("mousedown", this._onDown);
    window.addEventListener("mouseup", this._onUp);
    c.addEventListener("touchmove", this._onTouchMove, { passive: false });
    c.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length) {
          this._pointer(e.touches[0].clientX, e.touches[0].clientY);
          this.fireHeld = true;
          e.preventDefault();
        }
      },
      { passive: false }
    );
    c.addEventListener("touchend", this._onUp);
  }

  _pointer(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    this.mouseX = ((clientX - rect.left) / rect.width) * this.canvas.width;
    this.mouseY = ((clientY - rect.top) / rect.height) * this.canvas.height;
    let nx = (this.mouseX / this.canvas.width) * 2 - 1;
    let ny = (this.mouseY / this.canvas.height) * 2 - 1;
    if (nx > 1) nx = 1;
    if (nx < -1) nx = -1;
    if (ny > 1) ny = 1;
    if (ny < -1) ny = -1;
    this.steerX = nx;
    this.steerY = ny;
  }
}
