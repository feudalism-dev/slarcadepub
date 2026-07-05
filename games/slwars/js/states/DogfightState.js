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

const TIE_POOL_SIZE = 8;
/** Few on-screen targets so each is trackable. */
const ACTIVE_TIES = 3;
/** Minimum gap between spawns (seconds). */
const SPAWN_COOLDOWN = 1.4;
/** New fighters enter near the horizon. */
const SPAWN_Z_MIN = 850;
const SPAWN_Z_MAX = 1000;

/**
 * Phase 1 dogfight — 3D rotating TIE wireframes, sparse targets.
 */
export function createDogfightState(input) {
  let stars;
  let player;
  let ties;
  let spawnTimer = 0;
  const drawList = [];

  function trySpawn() {
    if (ties.active.length >= ACTIVE_TIES) {
      return;
    }
    if (spawnTimer > 0) {
      return;
    }
    const t = ties.acquire();
    const z = SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN);
    resetTie(t, z);
    spawnTimer = SPAWN_COOLDOWN;
  }

  return {
    enter(engine) {
      stars = new Starfield(160);
      player = new Player(engine.camera);
      ties = new Pool(createTie, TIE_POOL_SIZE);
      engine.camera.x = 0;
      engine.camera.y = 0;
      spawnTimer = 0;
      ties.releaseAll();
      // Stagger initial wave far apart in depth
      for (let i = 0; i < ACTIVE_TIES; i++) {
        const t = ties.acquire();
        resetTie(t, SPAWN_Z_MIN + i * ((SPAWN_Z_MAX - SPAWN_Z_MIN) / ACTIVE_TIES));
        spawnTimer = SPAWN_COOLDOWN;
      }
    },

    exit() {
      if (ties) {
        ties.releaseAll();
      }
    },

    update(engine, dt) {
      player.update(input);
      stars.update(dt, 420);

      if (spawnTimer > 0) {
        spawnTimer -= dt;
      }

      ties.updateEach(dt, (t) => updateTie(t, dt));
      trySpawn();
    },

    draw(engine) {
      const { renderer, camera } = engine;
      renderer.clear("#000");
      stars.draw(renderer, camera);

      // Farthest first (painter's algorithm for wireframes)
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
