import { Pool } from "../engine/Pool.js";
import { Z_HORIZON } from "../engine/Camera.js";
import { Starfield } from "../entities/Starfield.js";
import { Player } from "../entities/Player.js";
import {
  createTie,
  resetTie,
  updateTie,
  drawTie,
} from "../entities/TieFighter.js";

const TIE_POOL_SIZE = 16;
const ACTIVE_TIES = 8;

/**
 * Phase 1 dogfight with true Z perspective.
 *
 * A) Update: z -= speed (approach camera)
 * B) Cull: z <= 0 → release
 * C) Draw: sort farthest-first, project with PF/(PF+z)
 */
export function createDogfightState(input) {
  let stars;
  let player;
  let ties;
  const drawList = [];

  function spawnWave() {
    ties.releaseAll();
    for (let i = 0; i < ACTIVE_TIES; i++) {
      const t = ties.acquire();
      resetTie(t, 200 + i * ((Z_HORIZON - 200) / ACTIVE_TIES));
    }
  }

  return {
    enter(engine) {
      stars = new Starfield(160);
      player = new Player(engine.camera);
      ties = new Pool(createTie, TIE_POOL_SIZE);
      engine.camera.x = 0;
      engine.camera.y = 0;
      spawnWave();
    },

    exit() {
      if (ties) {
        ties.releaseAll();
      }
    },

    update(engine, dt) {
      player.update(input);
      stars.update(dt, 420);

      // A + B: approach and cull past player
      ties.updateEach(dt, (t) => updateTie(t, dt));

      while (ties.active.length < ACTIVE_TIES) {
        resetTie(ties.acquire(), Z_HORIZON - Math.random() * 120);
      }
    },

    draw(engine) {
      const { renderer, camera } = engine;
      renderer.clear("#000");
      stars.draw(renderer, camera);

      // C: sort by Z-depth, farthest first
      drawList.length = 0;
      const active = ties.active;
      for (let i = 0; i < active.length; i++) {
        drawList.push(active[i]);
      }
      drawList.sort((a, b) => b.z - a.z);

      for (let i = 0; i < drawList.length; i++) {
        drawTie(renderer, camera, drawList[i]);
      }

      const aim = player.aimScreen(engine.width, engine.height);
      renderer.drawCrosshair(aim.x, aim.y);
    },
  };
}
