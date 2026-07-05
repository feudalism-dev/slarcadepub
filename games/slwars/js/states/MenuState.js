/**
 * Menu is driven by DOM overlay; this state only clears the canvas.
 */
export const MenuState = {
  enter(engine) {
    engine.renderer.clear("#000");
  },

  update() {},

  draw(engine) {
    engine.renderer.clear("#000");
  },

  exit() {},
};
