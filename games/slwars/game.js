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
  var stars = [];
  var gridScroll = 0;
  var dogfightTime = 0;

  /** Mouse aim (screen space) and smoothed camera lean (opposite drift). */
  var mouseX = CX;
  var mouseY = CY;
  var aimX = CX;
  var aimY = CY;
  var leanX = 0;
  var leanY = 0;

  /** Dogfight allows z down to this so fighters can fly past / over the camera. */
  var Z_FLY = 0.25;

  /**
   * Project world (x, y, z) → screen.
   * minZ defaults to Z_NEAR; dogfight uses Z_FLY so ships can pass the camera.
   * Camera lean is applied so the world drifts opposite the mouse.
   */
  function project(x, y, z, minZ) {
    var zMin = minZ === undefined ? Z_NEAR : minZ;
    if (z < zMin || z > Z_FAR) {
      return null;
    }
    return {
      x: (x / z) * PERSPECTIVE + CX + leanX,
      y: (y / z) * PERSPECTIVE + CY + leanY,
      z: z,
      scale: PERSPECTIVE / z,
    };
  }

  /** Draw a world-space line segment if either end is visible. */
  function drawLine3(x1, y1, z1, x2, y2, z2, color, width, minZ) {
    var zMin = minZ === undefined ? Z_NEAR : minZ;
    var a = project(x1, y1, z1, zMin);
    var b = project(x2, y2, z2, zMin);
    if (!a && !b) {
      return;
    }
    if (!a) {
      a = clipToNear(x1, y1, z1, x2, y2, z2, zMin);
    }
    if (!b) {
      b = clipToNear(x2, y2, z2, x1, y1, z1, zMin);
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

  /** Simple near-plane clip for a segment that straddles the min z plane. */
  function clipToNear(xOut, yOut, zOut, xIn, yIn, zIn, minZ) {
    var zMin = minZ === undefined ? Z_NEAR : minZ;
    if (zIn < zMin || zIn > Z_FAR) {
      return null;
    }
    if (zOut === zIn) {
      return project(xIn, yIn, zIn, zMin);
    }
    var t = (zMin - zOut) / (zIn - zOut);
    if (t < 0 || t > 1) {
      return null;
    }
    return project(
      xOut + (xIn - xOut) * t,
      yOut + (yIn - yOut) * t,
      zMin,
      zMin
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

  /**
   * Vertex-based TIE wireframe (wings, pod, pylons).
   * World size is fixed in `s`; screen size is PERSPECTIVE / z via project().
   */
  function drawTie(t) {
    var s = t.s;
    var x = t.x;
    var y = t.y;
    var z = t.z;
    var c = COL_TIE;
    var v = [
      { x: -s * 2, y: -s },
      { x: s * 2, y: -s },
      { x: -s * 2, y: s },
      { x: s * 2, y: s },
      { x: -s * 2, y: -s },
      { x: -s * 2, y: s },
      { x: s * 2, y: -s },
      { x: s * 2, y: s },
      { x: -s * 0.5, y: -s * 0.5 },
      { x: s * 0.5, y: -s * 0.5 },
      { x: s * 0.5, y: -s * 0.5 },
      { x: s * 0.5, y: s * 0.5 },
      { x: s * 0.5, y: s * 0.5 },
      { x: -s * 0.5, y: s * 0.5 },
      { x: -s * 0.5, y: s * 0.5 },
      { x: -s * 0.5, y: -s * 0.5 },
      { x: -s * 0.5, y: 0 },
      { x: -s * 2, y: 0 },
      { x: s * 0.5, y: 0 },
      { x: s * 2, y: 0 },
    ];
    var i;
    var p1;
    var p2;

    ctx.beginPath();
    ctx.strokeStyle = c;
    ctx.lineWidth = z < 8 ? 2 : 1.5;
    for (i = 0; i < v.length; i += 2) {
      p1 = project(x + v[i].x, y + v[i].y, z, Z_FLY);
      p2 = project(x + v[i + 1].x, y + v[i + 1].y, z, Z_FLY);
      if (p1 && p2) {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
    }
    ctx.stroke();
  }

  /** Starfield: points rush from horizon (high z) toward camera (low z). */
  function initStars() {
    stars = [];
    var i;
    for (i = 0; i < 120; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 60,
        y: (Math.random() - 0.5) * 40,
        z: Z_NEAR + Math.random() * (Z_FAR - Z_NEAR),
      });
    }
  }

  function updateStars(dt, speed) {
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z -= speed * dt * (0.6 + (Z_FAR - s.z) / Z_FAR);
      if (s.z < Z_FLY) {
        s.z = Z_FAR - Math.random() * 8;
        s.x = (Math.random() - 0.5) * 60;
        s.y = (Math.random() - 0.5) * 40;
      }
    }
  }

  function drawStars() {
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      var p = project(s.x, s.y, s.z, Z_FLY);
      if (!p) {
        continue;
      }
      var bright = 1 - s.z / Z_FAR;
      var size = 1 + bright * 2;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(200,255,200," + (0.25 + bright * 0.75) + ")";
      ctx.lineWidth = size;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + 1 + bright * 4);
      ctx.stroke();
    }
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

  /**
   * Spawn a TIE on an attack run: periphery at the horizon, arc through
   * center, then bank past the camera.
   */
  function spawnTie(z) {
    var side = Math.random() < 0.5 ? -1 : 1;
    var startZ = z === undefined ? Z_FAR : z;
    var entryX = side * (14 + Math.random() * 18);
    var entryY = (Math.random() - 0.5) * 14;
    ties.push({
      entryX: entryX,
      entryY: entryY,
      exitX: -side * (6 + Math.random() * 12),
      exitY: entryY - (8 + Math.random() * 6),
      curveAmp: (10 + Math.random() * 12) * (Math.random() < 0.5 ? -1 : 1),
      curveAmpY: 4 + Math.random() * 6,
      x: entryX,
      y: entryY,
      z: startZ,
      startZ: startZ,
      s: 1.1 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      freq: 1.4 + Math.random() * 1.8,
      speed: 26 + Math.random() * 16,
      age: 0,
      past: false,
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
    dogfightTime = 0;
    leanX = 0;
    leanY = 0;
    aimX = CX;
    aimY = CY;
    mouseX = CX;
    mouseY = CY;
    initStars();
    var i;
    for (i = 0; i < 8; i++) {
      spawnTie(25 + i * (Z_FAR - 25) / 8);
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

  function updateCamera(dt) {
    var k = 1 - Math.exp(-10 * dt);
    aimX += (mouseX - aimX) * k;
    aimY += (mouseY - aimY) * k;

    var nx = (aimX - CX) / CX;
    var ny = (aimY - CY) / CY;
    if (nx > 1) {
      nx = 1;
    }
    if (nx < -1) {
      nx = -1;
    }
    if (ny > 1) {
      ny = 1;
    }
    if (ny < -1) {
      ny = -1;
    }

    var targetLeanX = -nx * 28;
    var targetLeanY = -ny * 18;
    var lk = 1 - Math.exp(-6 * dt);
    leanX += (targetLeanX - leanX) * lk;
    leanY += (targetLeanY - leanY) * lk;
  }

  function updateDogfight(dt) {
    dogfightTime += dt;
    updateCamera(dt);
    updateStars(dt, 55);

    var i;
    for (i = ties.length - 1; i >= 0; i--) {
      var t = ties[i];
      t.age += dt;
      t.z -= t.speed * dt;

      // progress 0 at horizon, 1 at the camera — attack run arc
      var progress = 1 - t.z / t.startZ;
      if (progress < 0) {
        progress = 0;
      }
      if (progress > 1) {
        progress = 1;
      }

      // Periphery → center (sin peak mid-run) → exit bank past player
      var arc = Math.sin(progress * Math.PI);
      t.x =
        t.entryX * (1 - progress) +
        t.exitX * progress +
        arc * t.curveAmp +
        Math.sin(t.age * t.freq + t.phase) * (2 + arc * 3);
      t.y =
        t.entryY * (1 - progress) +
        t.exitY * progress +
        arc * t.curveAmpY * 0.35 +
        Math.sin(t.age * t.freq * 0.8 + t.phase * 1.3) * (1.5 + arc * 2);

      // Close-range banking: player lean pulls near targets (maneuvering feel)
      if (t.z < 15) {
        var close = (15 - t.z) / 15;
        t.x += (leanX / PERSPECTIVE) * t.z * 0.55 * close;
        t.y += (leanY / PERSPECTIVE) * t.z * 0.55 * close;
        t.past = true;
      }

      // Fly over / past — recycle at horizon
      if (t.z < Z_FLY) {
        ties.splice(i, 1);
        spawnTie(Z_FAR - Math.random() * 12);
      }
    }

    while (ties.length < 8) {
      spawnTie(Z_FAR - Math.random() * 20);
    }
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
    drawStars();

    var list = [];
    var i;
    for (i = 0; i < ties.length; i++) {
      if (ties[i].z >= Z_FLY && ties[i].z <= Z_FAR) {
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

  /**
   * Crosshair follows the mouse slightly; scene lean is the opposite drift
   * applied inside project(), so the world banks under the reticle.
   */
  function drawCrosshair() {
    var nx = (aimX - CX) / CX;
    var ny = (aimY - CY) / CY;
    var hx = CX + nx * 36;
    var hy = CY + ny * 28;

    ctx.beginPath();
    ctx.strokeStyle = COL_HUD;
    ctx.lineWidth = 1.5;
    ctx.moveTo(hx - 12, hy);
    ctx.lineTo(hx - 4, hy);
    ctx.moveTo(hx + 4, hy);
    ctx.lineTo(hx + 12, hy);
    ctx.moveTo(hx, hy - 12);
    ctx.lineTo(hx, hy - 4);
    ctx.moveTo(hx, hy + 4);
    ctx.lineTo(hx, hy + 12);
    ctx.stroke();
  }

  function drawVanishingPointMark() {
    ctx.beginPath();
    ctx.strokeStyle = "#113311";
    ctx.lineWidth = 1;
    ctx.moveTo(CX - 4 + leanX, CY + leanY);
    ctx.lineTo(CX + 4 + leanX, CY + leanY);
    ctx.moveTo(CX + leanX, CY - 4 + leanY);
    ctx.lineTo(CX + leanX, CY + 4 + leanY);
    ctx.stroke();
  }

  function pointerToCanvas(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return { x: CX, y: CY };
    }
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function onPointerMove(e) {
    var p = pointerToCanvas(e.clientX, e.clientY);
    mouseX = p.x;
    mouseY = p.y;
  }

  function update(dt) {
    if (state === STATE_SURFACE) {
      leanX = 0;
      leanY = 0;
      updateSurface(dt);
    } else if (state === STATE_DOGFIGHT) {
      updateDogfight(dt);
    } else if (state === STATE_TRENCH) {
      leanX = 0;
      leanY = 0;
      updateTrench(dt);
    }
  }

  function draw() {
    if (state === STATE_MENU || state === STATE_GAME_OVER) {
      return;
    }
    clearScreen();

    if (state === STATE_SURFACE) {
      drawVanishingPointMark();
      drawSurface();
      drawCrosshair();
    } else if (state === STATE_DOGFIGHT) {
      drawDogfight();
      drawCrosshair();
    } else if (state === STATE_TRENCH) {
      drawVanishingPointMark();
      drawTrenchStub();
      drawCrosshair();
    }
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
    setState(STATE_DOGFIGHT);
  }

  btnStart.addEventListener("click", startFromMenu);
  btnStart.addEventListener("touchend", function (e) {
    e.preventDefault();
    startFromMenu();
  });

  canvas.addEventListener("mousemove", onPointerMove);
  canvas.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches.length) {
        onPointerMove(e.touches[0]);
        e.preventDefault();
      }
    },
    { passive: false }
  );

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
        "START or key 1 = dogfight, 2 = surface, 3 = trench.";
    }
  });

  initStars();
  setState(STATE_MENU);
  requestAnimationFrame(loop);
})();
