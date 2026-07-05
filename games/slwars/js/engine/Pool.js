/**
 * Fixed-size object pool — acquire/release, no per-frame alloc churn.
 */
export class Pool {
  /**
   * @param {() => object} factory
   * @param {number} size
   */
  constructor(factory, size) {
    this._factory = factory;
    this._free = [];
    this._active = [];
    for (let i = 0; i < size; i++) {
      const obj = factory();
      obj._pooled = true;
      obj.active = false;
      this._free.push(obj);
    }
  }

  get active() {
    return this._active;
  }

  acquire() {
    let obj = this._free.pop();
    if (!obj) {
      obj = this._factory();
      obj._pooled = true;
    }
    obj.active = true;
    this._active.push(obj);
    return obj;
  }

  release(obj) {
    if (!obj.active) {
      return;
    }
    obj.active = false;
    const idx = this._active.indexOf(obj);
    if (idx >= 0) {
      this._active.splice(idx, 1);
    }
    this._free.push(obj);
  }

  releaseAll() {
    while (this._active.length) {
      const obj = this._active.pop();
      obj.active = false;
      this._free.push(obj);
    }
  }

  /**
   * Iterate active list backwards; release when predicate returns true.
   * @param {(obj: object, dt: number) => boolean} updateFn return true to release
   */
  updateEach(dt, updateFn) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      const obj = this._active[i];
      if (updateFn(obj, dt)) {
        this.release(obj);
      }
    }
  }
}
