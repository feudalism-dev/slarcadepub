/**
 * SL Wars — clean perspective rewrite
 *
 * Projection (no full 3D engine):
 *   x_screen = (x_world / z) * PERSPECTIVE + CX
 *   y_screen = (y_world / z) * PERSPECTIVE + CY
 *
 * World: +x right, +y down (canvas-aligned), +z away from camera.
 * Draw only objects with z in [Z_NEAR, Z_FAR]. Sort far → near.
 * Wireframe only: beginPath / moveTo / lineTo.
 */
(function () {
  "use strict";

  if (typeof SLArcade !== "undefined" && SLArcade.registerGameId) {
    SLArcade.registerGameId("slwars");
  }

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var overlay = document.getElementById("overlay");
  var btnStart = document.getElementById("btn-start");
  var stateLabel = document.getElementById("state-label");

  var W = canvas.width;
  var H = canvas.height;
  var CX = W * 0.5;
  var CY = H * 0.42;

  /** Perspective factor — larger = stronger foreshortening */
  var PERSPECTIVE = 220;

  /** Visible depth band (world units) */
  var Z_NEAR = 1;
  var Z_FAR = 100;

  /** Ground plane y (positive = below horizon / vanishing point) */
  var GROUND_Y = 10;

  var COL_GRID = "#1a5c1a";
  var COL_GRID_NEAR = "#3f9f3f";
  var COL_TURRET = "#e8c84a";
  var COL_GUN = "#ff5555";
  var COL_TIE = "#66ff66";
  var COL_TRENCH = "#44cc88";
  var COL_HUD = "#66ff66";

  var STATE_MENU = "MENU";
  var STATE_DOGFIGHT = "DOGFIGHT";
  var STATE_SURFACE = "SURFACE";
  var STATE_TRENCH = "TRENCH";
  var STATE_GAME_OVER = "GAME_OVER";

  var state = STATE_MENU;
  var lastTime = 0;
  var scrollSpeed = 18;
  var turrets = [];
  var ties = [];
  var gridScroll = 0;

  /**
   * Project world (x, y, z) → screen. Returns null if outside draw band.
   */
  function project(x, y, z) {
    if (z < Z_NEAR || z > Z_FAR) {
      return null;
    }
    return {
      x: (x / z) * PERSPECTIVE + CX,
      y: (y / z) * PERSPECTIVE + CY,
      z: z,
      scale: PERSPECTIVE / z,
    };
  }

  /** Draw a world-space line segment if either end is visible. */
  function drawLine3(x1, y1, z1, x2, y2, z2, color, width) {
    var a = project(x1, y1, z1);
    var b = project(x2, y2, z2);
    if (!a && !b) {
      return;
    }
    if (!a) {
      a = clipToNear(x1, y1, z1, x2, y2, z2);
    }
    if (!b) {
      b = clipToNear(x2, y2, z2, x1, y1, z1);
    }
    if (!a || !b) {
      return;
    }
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /** Simple near-plane clip for a segment that straddles Z_NEAR. */
  function clipToNear(xOut, yOut, zOut, xIn, yIn, zIn) {
    if (zIn < Z_NEAR || zIn > Z_FAR) {
      return null;
    }
    if (zOut === zIn) {
      return project(xIn, yIn, zIn);
    }
    var t = (Z_NEAR - zOut) / (zIn - zOut);
    if (t < 0 || t > 1) {
      return null;
    }
    return project(
      xOut + (xIn - xOut) * t,
      yOut + (yIn - yOut) * t,
      Z_NEAR
    );
  }

  function clearScreen() {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * Death Star surface: receding grid.
   * Horizontal lines = distance bands.
   * Vertical lines = perspective rails converging on the vanishing point.
   */
  function drawSurfaceGrid() {
    var z;
    var x;
    var lane;
    var zStep = 4;
    var halfWidth = 40;

    for (z = Z_FAR; z >= Z_NEAR + 0.5; z -= zStep) {
      var zDraw = z - (gridScroll % zStep);
      if (zDraw < Z_NEAR || zDraw > Z_FAR) {
        continue;
      }
      var nearness = 1 - (zDraw - Z_NEAR) / (Z_FAR - Z_NEAR);
      var col = nearness > 0.7 ? COL_GRID_NEAR : COL_GRID;
      drawLine3(-halfWidth, GROUND_Y, zDraw, halfWidth, GROUND_Y, zDraw, col, 1);
    }

    for (lane = -5; lane <= 5; lane++) {
      x = lane * 8;
      drawLine3(x, GROUND_Y, Z_NEAR + 0.5, x, GROUND_Y, Z_FAR, COL_GRID, 1);
    }
  }

  /**
   * Turret: square base + vertical gun, all in world space.
   * Size is implicit — projection scales as z → Z_NEAR.
   */
  function drawTurret(t) {
    var x = t.x;
    var z = t.z;
    var base = 1.2;
    var h = t.h;
    var y0 = GROUND_Y;
    var y1 = GROUND_Y - h;
    var col = COL_TURRET;

    drawLine3(x - base, y0, z - base, x + base, y0, z - base, col, 1.5);
    drawLine3(x + base, y0, z - base, x + base, y0, z + base, col, 1.5);
    drawLine3(x + base, y0, z + base, x - base, y0, z + base, col, 1.5);
    drawLine3(x - base, y0, z + base, x - base, y0, z - base, col, 1.5);

    drawLine3(x - base, y0, z - base, x - base, y1, z - base, col, 1.5);
    drawLine3(x + base, y0, z - base, x + base, y1, z - base, col, 1.5);
    drawLine3(x + base, y0, z + base, x + base, y1, z + base, col, 1.5);
    drawLine3(x - base, y0, z + base, x - base, y1, z + base, col, 1.5);

    drawLine3(x - base, y1, z - base, x + base, y1, z - base, col, 1.5);
    drawLine3(x + base, y1, z - base, x + base, y1, z + base, col, 1.5);
    drawLine3(x + base, y1, z + base, x - base, y1, z + base, col, 1.5);
    drawLine3(x - base, y1, z + base, x - base, y1, z - base, col, 1.5);

    drawLine3(x, y1, z, x, y1 - h * 0.45, z, COL_GUN, 2);
  }

  /** Minimal TIE: cross + hex wing outline (wireframe). */
  function drawTie(t) {
    var s = t.s;
    var x = t.x;
    var y = t.y;
    var z = t.z;
    var c = COL_TIE;
    drawLine3(x - s * 2, y, z, x + s * 2, y, z, c, 1.5);
    drawLine3(x, y - s, z, x, y + s, z, c, 1.5);
    drawLine3(x - s * 2, y - s, z, x - s * 2, y + s, z, c, 1);
    drawLine3(x + s * 2, y - s, z, x + s * 2, y + s, z, c, 1);
    drawLine3(x - s * 2, y - s, z, x - s * 0.4, y, z, c, 1);
    drawLine3(x - s * 2, y + s, z, x - s * 0.4, y, z, c, 1);
    drawLine3(x + s * 2, y - s, z, x + s * 0.4, y, z, c, 1);
    drawLine3(x + s * 2, y + s, z, x + s * 0.4, y, z, c, 1);
  }

  function drawTrenchStub() {
    var z;
    for (z = Z_FAR; z >= Z_NEAR + 1; z -= 5) {
      var zz = z - (gridScroll % 5);
      if (zz < Z_NEAR || zz > Z_FAR) {
        continue;
      }
      drawLine3(-8, -6, zz, -8, 6, zz, COL_TRENCH, 1);
      drawLine3(8, -6, zz, 8, 6, zz, COL_TRENCH, 1);
      drawLine3(-8, 6, zz, 8, 6, zz, COL_TRENCH, 1);
      drawLine3(-8, -6, zz, 8, -6, zz, COL_TRENCH, 1);
    }
    drawLine3(-8, -6, Z_NEAR + 1, -8, -6, Z_FAR, COL_TRENCH, 1);
    drawLine3(8, -6, Z_NEAR + 1, 8, -6, Z_FAR, COL_TRENCH, 1);
    drawLine3(-8, 6, Z_NEAR + 1, -8, 6, Z_FAR, COL_TRENCH, 1);
    drawLine3(8, 6, Z_NEAR + 1, 8, 6, Z_FAR, COL_TRENCH, 1);
  }

  function spawnTurret(z) {
    turrets.push({
      x: (Math.random() - 0.5) * 28,
      z: z,
      h: 3 + Math.random() * 4,
    });
  }

  function spawnTie(z) {
    ties.push({
      x: (Math.random() - 0.5) * 20,
      y: -2 + (Math.random() - 0.5) * 6,
      z: z,
      s: 1.2,
      vx: (Math.random() - 0.5) * 4,
    });
  }

  function resetSurface() {
    turrets = [];
    ties = [];
    gridScroll = 0;
    var i;
    for (i = 0; i < 8; i++) {
      spawnTurret(20 + i * 10);
    }
  }

  function resetDogfight() {
    ties = [];
    turrets = [];
    var i;
    for (i = 0; i < 6; i++) {
      spawnTie(30 + i * 12);
    }
  }

  function resetTrench() {
    turrets = [];
    ties = [];
    gridScroll = 0;
  }

  function setState(next) {
    state = next;
    stateLabel.textContent = "STATE: " + state;
    if (state === STATE_MENU) {
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
    if (state === STATE_SURFACE) {
      resetSurface();
    } else if (state === STATE_DOGFIGHT) {
      resetDogfight();
    } else if (state === STATE_TRENCH) {
      resetTrench();
    }
  }

  function updateSurface(dt) {
    gridScroll += scrollSpeed * dt;
    var i;
    for (i = turrets.length - 1; i >= 0; i--) {
      turrets[i].z -= scrollSpeed * dt;
      if (turrets[i].z < Z_NEAR) {
        turrets[i].z = Z_FAR - Math.random() * 8;
        turrets[i].x = (Math.random() - 0.5) * 28;
        turrets[i].h = 3 + Math.random() * 4;
      }
    }
  }

  function updateDogfight(dt) {
    var i;
    for (i = ties.length - 1; i >= 0; i--) {
      var t = ties[i];
      t.z -= (12 + scrollSpeed * 0.3) * dt;
      t.x += t.vx * dt;
      t.y += Math.sin(gridScroll * 0.2 + i) * 2 * dt;
      if (t.z < Z_NEAR) {
        t.z = Z_FAR - Math.random() * 10;
        t.x = (Math.random() - 0.5) * 20;
        t.y = -2 + (Math.random() - 0.5) * 6;
      }
    }
    gridScroll += dt * 10;
  }

  function updateTrench(dt) {
    gridScroll += (scrollSpeed + 6) * dt;
  }

  /**
   * Collect drawable objects, sort far → near, draw.
   * Grid is drawn first (background), then sorted entities.
   */
  function drawSurface() {
    drawSurfaceGrid();

    var list = [];
    var i;
    for (i = 0; i < turrets.length; i++) {
      if (turrets[i].z >= Z_NEAR && turrets[i].z <= Z_FAR) {
        list.push({ kind: "turret", z: turrets[i].z, ref: turrets[i] });
      }
    }
    list.sort(function (a, b) {
      return b.z - a.z;
    });
    for (i = 0; i < list.length; i++) {
      drawTurret(list[i].ref);
    }
  }

  function drawDogfight() {
    var list = [];
    var i;
    for (i = 0; i < ties.length; i++) {
      if (ties[i].z >= Z_NEAR && ties[i].z <= Z_FAR) {
        list.push(ties[i]);
      }
    }
    list.sort(function (a, b) {
      return b.z - a.z;
    });
    for (i = 0; i < list.length; i++) {
      drawTie(list[i]);
    }
  }

  function drawCrosshair() {
    ctx.beginPath();
    ctx.strokeStyle = COL_HUD;
    ctx.lineWidth = 1;
    ctx.moveTo(CX - 10, CY);
    ctx.lineTo(CX - 3, CY);
    ctx.moveTo(CX + 3, CY);
    ctx.lineTo(CX + 10, CY);
    ctx.moveTo(CX, CY - 10);
    ctx.lineTo(CX, CY - 3);
    ctx.moveTo(CX, CY + 3);
    ctx.lineTo(CX, CY + 10);
    ctx.stroke();
  }

  function drawVanishingPointMark() {
    ctx.beginPath();
    ctx.strokeStyle = "#113311";
    ctx.lineWidth = 1;
    ctx.moveTo(CX - 4, CY);
    ctx.lineTo(CX + 4, CY);
    ctx.moveTo(CX, CY - 4);
    ctx.lineTo(CX, CY + 4);
    ctx.stroke();
  }

  function update(dt) {
    if (state === STATE_SURFACE) {
      updateSurface(dt);
    } else if (state === STATE_DOGFIGHT) {
      updateDogfight(dt);
    } else if (state === STATE_TRENCH) {
      updateTrench(dt);
    }
  }

  function draw() {
    if (state === STATE_MENU || state === STATE_GAME_OVER) {
      return;
    }
    clearScreen();
    drawVanishingPointMark();

    if (state === STATE_SURFACE) {
      drawSurface();
    } else if (state === STATE_DOGFIGHT) {
      drawDogfight();
    } else if (state === STATE_TRENCH) {
      drawTrenchStub();
    }

    drawCrosshair();
  }

  function loop(now) {
    if (!lastTime) {
      lastTime = now;
    }
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function startFromMenu() {
    setState(STATE_SURFACE);
  }

  btnStart.addEventListener("click", startFromMenu);
  btnStart.addEventListener("touchend", function (e) {
    e.preventDefault();
    startFromMenu();
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      setState(STATE_MENU);
      return;
    }
    if (state === STATE_MENU && (e.key === "Enter" || e.key === " ")) {
      startFromMenu();
      return;
    }
    if (e.key === "1") {
      setState(STATE_DOGFIGHT);
    } else if (e.key === "2") {
      setState(STATE_SURFACE);
    } else if (e.key === "3") {
      setState(STATE_TRENCH);
    } else if (e.key === "0") {
      setState(STATE_GAME_OVER);
      overlay.classList.remove("hidden");
      document.getElementById("overlay-title").textContent = "GAME OVER";
      document.getElementById("instructions").textContent =
        "Press START SURFACE or keys 1/2/3 to switch states.";
    }
  });

  setState(STATE_MENU);
  requestAnimationFrame(loop);
})();
