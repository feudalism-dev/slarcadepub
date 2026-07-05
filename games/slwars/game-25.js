/**
 * SL Wars — Game Logic Layer on Engine (single-file bundle for CEF / MOAP).
 * BUILD 25: WaveManager, strafe paths, shields/hull, enemy fire, Vader boss.
 */
(function () {
  "use strict";

  var BUILD_ID = "25-GAME-LOGIC";

  if (typeof SLArcade !== "undefined" && SLArcade.registerGameId) {
    SLArcade.registerGameId("slwars");
  }

  var PERSPECTIVE_FACTOR = 500;
  var Z_HORIZON = 1000;
  var Z_PLAYER = 0;
  var TIE_MODEL_SCALE = 42;
  var TIE_POOL_SIZE = 10;
  var SPAWN_Z_MIN = 850;
  var SPAWN_Z_MAX = 1000;
  var KILLS_PER_WAVE = 10;
  var MAX_SHIELDS = 6;
  var MAX_HULL = 3;
  var FIRE_PROXIMITY_K = 90;
  var PHASE_DOGFIGHT = "DOGFIGHT";
  var PHASE_BOSS = "BOSS";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d", { alpha: false });
  var W = canvas.width;
  var H = canvas.height;
  var CX = W * 0.5;
  var CY = H * 0.5;

  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var instructionsEl = document.getElementById("instructions");
  var playerLine = document.getElementById("player-line");
  var btnStart = document.getElementById("btn-start");
  var btnQuit = document.getElementById("btn-quit");
  var btnLeaderboard = document.getElementById("btn-leaderboard");
  var btnModalClose = document.getElementById("btn-modal-close");
  var startScoresEl = document.getElementById("start-scores");
  var personalEl = document.getElementById("personal-score");
  var highScoreEl = document.getElementById("high-score");
  var unavailableEl = document.getElementById("scores-unavailable");
  var leaderboardEl = document.getElementById("leaderboard");
  var leaderboardModal = document.getElementById("leaderboard-modal");
  var endHintEl = document.getElementById("end-hint");
  var stateLabel = document.getElementById("state-label");

  // --- Camera ---
  var camX = 0;
  var camY = 0;
  var camTargetX = 0;
  var camTargetY = 0;

  function setSteer(nx, ny) {
    camTargetX = nx * 120;
    camTargetY = ny * 80;
  }

  function updateCamera(dt) {
    var k = 1 - Math.exp(-7 * dt);
    camX += (camTargetX - camX) * k;
    camY += (camTargetY - camY) * k;
  }

  function project(wx, wy, wz) {
    if (wz <= Z_PLAYER) {
      return null;
    }
    var scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + wz);
    return {
      x: (wx - camX) * scale + CX,
      y: (wy - camY) * scale + CY,
      scale: scale,
    };
  }

  function screenToWorldAtZ(sx, sy, wz) {
    var scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + wz);
    return {
      x: (sx - CX) / scale + camX,
      y: (sy - CY) / scale + camY,
    };
  }

  function crosshairScreen() {
    return { x: CX + camX * 0.08, y: CY + camY * 0.08 };
  }

  // --- Input ---
  var steerX = 0;
  var steerY = 0;
  var fireQueued = false;

  function pointerToCanvas(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    var mx = ((clientX - rect.left) / rect.width) * W;
    var my = ((clientY - rect.top) / rect.height) * H;
    var nx = (mx / W) * 2 - 1;
    var ny = (my / H) * 2 - 1;
    if (nx > 1) nx = 1;
    if (nx < -1) nx = -1;
    if (ny > 1) ny = 1;
    if (ny < -1) ny = -1;
    steerX = nx;
    steerY = ny;
  }

  canvas.addEventListener("mousemove", function (e) {
    pointerToCanvas(e.clientX, e.clientY);
  });
  canvas.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches.length) {
        pointerToCanvas(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    },
    { passive: false }
  );
  canvas.addEventListener("mousedown", function () {
    if (playing) {
      fireQueued = true;
    }
  });

  // --- Pool ---
  function createPool(factory, size) {
    var free = [];
    var active = [];
    var i;
    for (i = 0; i < size; i++) {
      free.push(factory());
    }
    return {
      active: active,
      acquire: function () {
        var obj = free.pop();
        if (!obj) {
          obj = factory();
        }
        obj.active = true;
        active.push(obj);
        return obj;
      },
      release: function (obj) {
        if (!obj.active) {
          return;
        }
        obj.active = false;
        var idx = active.indexOf(obj);
        if (idx >= 0) {
          active.splice(idx, 1);
        }
        free.push(obj);
      },
      releaseAll: function () {
        while (active.length) {
          var obj = active.pop();
          obj.active = false;
          free.push(obj);
        }
      },
    };
  }

  // --- Starfield ---
  var stars = [];
  function initStars() {
    stars = [];
    var i;
    for (i = 0; i < 160; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 500,
        z: 1 + Math.random() * (Z_HORIZON - 1),
      });
    }
  }

  function updateStars(dt) {
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z -= 420 * dt;
      if (s.z <= Z_PLAYER) {
        s.x = (Math.random() - 0.5) * 800;
        s.y = (Math.random() - 0.5) * 500;
        s.z = Z_HORIZON - Math.random() * 80;
      }
    }
  }

  function drawStars() {
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      var p = project(s.x, s.y, s.z);
      if (!p) {
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = "rgba(180,255,180," + (0.15 + p.scale * 0.85) + ")";
      ctx.lineWidth = 1 + p.scale * 2;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + 1 + p.scale * 8);
      ctx.stroke();
    }
  }

  // --- 3D TIE wireframe ---
  function buildTieWireframe() {
    var segs = [];
    function add(a, b) {
      segs.push({ p1: a, p2: b });
    }
    var podR = 1.0;
    var podZ = 0.7;
    var front = [];
    var back = [];
    var i;
    var j;
    var a;
    for (i = 0; i < 6; i++) {
      a = (i / 6) * Math.PI * 2;
      front.push([Math.cos(a) * podR, Math.sin(a) * podR, podZ]);
      back.push([Math.cos(a) * podR, Math.sin(a) * podR, -podZ]);
    }
    for (i = 0; i < 6; i++) {
      j = (i + 1) % 6;
      add(front[i], front[j]);
      add(back[i], back[j]);
      add(front[i], back[i]);
    }
    var eq = [];
    for (i = 0; i < 6; i++) {
      a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      eq.push([Math.cos(a) * podR * 1.05, Math.sin(a) * podR * 1.05, 0]);
    }
    for (i = 0; i < 6; i++) {
      add(eq[i], eq[(i + 1) % 6]);
    }

    var wingX = 3.4;
    var wingR = 2.6;
    function wingHex(xSign) {
      var pts = [];
      for (i = 0; i < 6; i++) {
        a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push([xSign * wingX, Math.cos(a) * wingR, Math.sin(a) * wingR]);
      }
      for (i = 0; i < 6; i++) {
        add(pts[i], pts[(i + 1) % 6]);
      }
      add(pts[0], pts[3]);
      add(pts[1], pts[4]);
      add(pts[2], pts[5]);
      return pts;
    }
    var left = wingHex(-1);
    var right = wingHex(1);
    var hubL = [-wingX * 0.55, 0, 0];
    var hubR = [wingX * 0.55, 0, 0];
    add([-podR, 0, 0], hubL);
    add(hubL, left[2]);
    add(hubL, left[5]);
    add([podR, 0, 0], hubR);
    add(hubR, right[2]);
    add(hubR, right[5]);
    add([0, podR * 0.4, 0], hubL);
    add([0, -podR * 0.4, 0], hubL);
    add([0, podR * 0.4, 0], hubR);
    add([0, -podR * 0.4, 0], hubR);
    return segs;
  }

  var TIE_FIGHTER_WIREFRAME = buildTieWireframe();

  function projectVertex(v, fighter) {
    var lx = (v.x !== undefined ? v.x : v[0]) * TIE_MODEL_SCALE;
    var ly = (v.y !== undefined ? v.y : v[1]) * TIE_MODEL_SCALE;
    var lz = (v.z !== undefined ? v.z : v[2]) * TIE_MODEL_SCALE;

    var cy = Math.cos(fighter.ry);
    var sy = Math.sin(fighter.ry);
    var rx = lx * cy - lz * sy;
    var rz = lx * sy + lz * cy;
    var ry = ly;

    var cx = Math.cos(fighter.rx);
    var sx = Math.sin(fighter.rx);
    var rry = ry * cx - rz * sx;
    var rrz = ry * sx + rz * cx;
    var rrx = rx;

    var cz = Math.cos(fighter.rz);
    var sz = Math.sin(fighter.rz);
    var fx = rrx * cz - rry * sz;
    var fy = rrx * sz + rry * cz;
    var fz = rrz;

    var worldX = fx + fighter.x;
    var worldY = fy + fighter.y;
    var worldZ = fz + fighter.z;

    return project(worldX, worldY, worldZ);
  }

  // ========================================================================
  // GAME LOGIC LAYER
  // ========================================================================

  /** WaveManager — escalates enemySpeed and spawnRate every 10 kills. */
  function createWaveManager() {
    return {
      wave: 1,
      killsThisWave: 0,
      totalKills: 0,
      enemySpeed: 160,
      spawnCooldown: 1.4,
      maxActive: 3,
      phase: PHASE_DOGFIGHT,
      bossDefeated: false,
      reset: function () {
        this.wave = 1;
        this.killsThisWave = 0;
        this.totalKills = 0;
        this.enemySpeed = 160;
        this.spawnCooldown = 1.4;
        this.maxActive = 3;
        this.phase = PHASE_DOGFIGHT;
        this.bossDefeated = false;
      },
      recordKill: function (isVader) {
        if (isVader) {
          this.bossDefeated = true;
          this.phase = PHASE_DOGFIGHT;
          this.wave = 4;
          this.killsThisWave = 0;
          this.enemySpeed += 40;
          this.spawnCooldown = Math.max(0.5, this.spawnCooldown - 0.15);
          return { bossDefeated: true };
        }
        this.totalKills++;
        this.killsThisWave++;
        if (this.killsThisWave < KILLS_PER_WAVE) {
          return {};
        }
        this.killsThisWave = 0;
        if (this.wave >= 3 && !this.bossDefeated) {
          this.phase = PHASE_BOSS;
          return { bossStart: true };
        }
        this.wave++;
        this.enemySpeed += 28;
        this.spawnCooldown = Math.max(0.5, this.spawnCooldown - 0.12);
        this.maxActive = Math.min(6, this.maxActive + 1);
        return { waveUp: true, wave: this.wave };
      },
    };
  }

  /** Player shields + hull with brief invulnerability after hits. */
  function createPlayerHealth() {
    return {
      shields: MAX_SHIELDS,
      hull: MAX_HULL,
      invuln: 0,
      flash: 0,
      reset: function () {
        this.shields = MAX_SHIELDS;
        this.hull = MAX_HULL;
        this.invuln = 0;
        this.flash = 0;
      },
      update: function (dt) {
        if (this.invuln > 0) {
          this.invuln -= dt;
        }
        if (this.flash > 0) {
          this.flash -= dt;
        }
      },
      isDead: function () {
        return this.hull <= 0;
      },
      takeDamage: function (amount) {
        if (this.invuln > 0 || this.isDead()) {
          return false;
        }
        var i;
        for (i = 0; i < amount; i++) {
          if (this.shields > 0) {
            this.shields--;
          } else if (this.hull > 0) {
            this.hull--;
          }
        }
        this.invuln = 1.1;
        this.flash = 0.35;
        return true;
      },
    };
  }

  /**
   * Enemy fire hit probability ∝ 1/z (proximity).
   * Returns true when the shot connects.
   */
  function rollEnemyHit(z) {
    if (z <= 30 || z > 700) {
      return false;
    }
    var hitChance = FIRE_PROXIMITY_K / z;
    if (hitChance > 0.88) {
      hitChance = 0.88;
    }
    return Math.random() < hitChance;
  }

  // --- Entities ---
  function createTie() {
    return {
      active: false,
      isVader: false,
      hp: 1,
      x: 0,
      y: 0,
      z: Z_HORIZON,
      entryZ: Z_HORIZON,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      speed: 200,
      rx: 0,
      ry: 0,
      rz: 0,
      rotationSpeedX: 0,
      rotationSpeedY: 0,
      rotationSpeedZ: 0,
      fireAcc: 0,
      dodgePhase: 0,
      dodgeAmp: 0,
      lastShotFlash: 0,
    };
  }

  function strafeProgress(t) {
    var p = 1 - t.z / t.entryZ;
    if (p < 0) {
      p = 0;
    }
    if (p > 1) {
      p = 1;
    }
    return p;
  }

  function applyStrafePosition(t) {
    var p = strafeProgress(t);
    t.x = t.startX + (t.endX - t.startX) * p;
    t.y = t.startY + (t.endY - t.startY) * p;
  }

  function resetTieStrafe(t, waveMgr) {
    var side = Math.random() < 0.5 ? -1 : 1;
    t.isVader = false;
    t.hp = 1;
    t.entryZ = SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN);
    t.z = t.entryZ;
    t.startX = side * (180 + Math.random() * 120);
    t.startY = (Math.random() - 0.5) * 200;
    t.endX = -side * (40 + Math.random() * 160);
    t.endY = (Math.random() - 0.5) * 160;
    t.speed = waveMgr.enemySpeed + Math.random() * 35;
    t.rx = Math.random() * Math.PI * 2;
    t.ry = Math.random() * Math.PI * 2;
    t.rz = (Math.random() - 0.5) * 0.8;
    t.rotationSpeedX = (Math.random() - 0.5) * 3.5;
    t.rotationSpeedY = 1.8 + Math.random() * 2.8;
    t.rotationSpeedZ = (Math.random() - 0.5) * 2.2;
    t.fireAcc = Math.random() * 0.5;
    t.dodgePhase = 0;
    t.dodgeAmp = 0;
    t.lastShotFlash = 0;
    applyStrafePosition(t);
    return t;
  }

  function resetVader(t, waveMgr) {
    t.isVader = true;
    t.hp = 14;
    t.entryZ = 920;
    t.z = t.entryZ;
    t.startX = -220;
    t.startY = -60;
    t.endX = 220;
    t.endY = 60;
    t.speed = 310 + waveMgr.wave * 8;
    t.rx = 0;
    t.ry = Math.PI;
    t.rz = 0;
    t.rotationSpeedX = 0.6;
    t.rotationSpeedY = 2.4;
    t.rotationSpeedZ = 0.4;
    t.fireAcc = 0;
    t.dodgePhase = Math.random() * Math.PI * 2;
    t.dodgeAmp = 110;
    t.lastShotFlash = 0;
    applyStrafePosition(t);
    return t;
  }

  function updateVaderDodge(t, dt, aimWx, aimWy) {
    applyStrafePosition(t);
    t.dodgePhase += dt * 5.2;
    var dodgeX = Math.sin(t.dodgePhase) * t.dodgeAmp;
    var dodgeY = Math.cos(t.dodgePhase * 1.31) * (t.dodgeAmp * 0.75);
    var awayX = t.x - aimWx;
    var awayY = t.y - aimWy;
    var len = Math.sqrt(awayX * awayX + awayY * awayY);
    if (len < 1) {
      len = 1;
    }
    t.x = t.x + dodgeX * dt * 0.55 + (awayX / len) * 95 * dt;
    t.y = t.y + dodgeY * dt * 0.55 + (awayY / len) * 95 * dt;
  }

  function updateTie(t, dt, waveMgr, health, aimWx, aimWy) {
    t.z -= t.speed * dt;
    if (t.isVader) {
      updateVaderDodge(t, dt, aimWx, aimWy);
    } else {
      applyStrafePosition(t);
    }
    t.rx += t.rotationSpeedX * dt;
    t.ry += t.rotationSpeedY * dt;
    t.rz += t.rotationSpeedZ * dt;

    if (t.z > 35 && t.z < 620 && !health.isDead()) {
      t.fireAcc += dt;
      var fireInterval = t.isVader ? 0.45 : 0.85;
      if (t.fireAcc >= fireInterval) {
        t.fireAcc = 0;
        if (rollEnemyHit(t.z)) {
          health.takeDamage(1);
          t.lastShotFlash = 0.12;
        }
      }
    }
    if (t.lastShotFlash > 0) {
      t.lastShotFlash -= dt;
    }
    return t.z <= Z_PLAYER;
  }

  function drawTie(t) {
    var segs = TIE_FIGHTER_WIREFRAME;
    var centerScale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + t.z);
    var lw = centerScale > 0.4 ? 2 : 1.3;
    var i;
    var color = t.isVader ? "#66ccff" : "#66ff66";
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i];
      var a = projectVertex(s.p1, t);
      var b = projectVertex(s.p2, t);
      if (!a || !b) {
        continue;
      }
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    if (t.isVader) {
      var c = project(t.x, t.y, t.z);
      if (c) {
        ctx.fillStyle = "rgba(100,200,255,0.35)";
        ctx.font = "bold 11px Consolas, monospace";
        ctx.fillText("VADER", c.x - 22, c.y - 18 * c.scale);
      }
    }
    if (t.lastShotFlash > 0) {
      var p = project(t.x, t.y, t.z);
      if (p) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,120,80,0.9)";
        ctx.lineWidth = 2;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(CX, CY);
        ctx.stroke();
      }
    }
  }

  function drawCrosshair() {
    var ch = crosshairScreen();
    var hx = ch.x;
    var hy = ch.y;
    var s = 10;
    ctx.beginPath();
    ctx.strokeStyle = "#66ff66";
    ctx.lineWidth = 1.5;
    ctx.moveTo(hx - s, hy);
    ctx.lineTo(hx - 3, hy);
    ctx.moveTo(hx + 3, hy);
    ctx.lineTo(hx + s, hy);
    ctx.moveTo(hx, hy - s);
    ctx.lineTo(hx, hy - 3);
    ctx.moveTo(hx, hy + 3);
    ctx.lineTo(hx, hy + s);
    ctx.stroke();
  }

  function drawHud(waveMgr, health, score) {
    var x = 10;
    var y = 18;
    ctx.font = "12px Consolas, monospace";
    ctx.fillStyle = "#66ff66";
    if (waveMgr.phase === PHASE_BOSS) {
      ctx.fillStyle = "#88ddff";
      ctx.fillText("BOSS — DARTH VADER", x, y);
      y += 16;
    } else {
      ctx.fillText("WAVE " + waveMgr.wave, x, y);
      y += 16;
      ctx.fillText(
        "KILLS " + waveMgr.killsThisWave + "/" + KILLS_PER_WAVE,
        x,
        y
      );
      y += 16;
    }
    ctx.fillText("SCORE " + score, x, y);
    y += 18;

    var i;
    ctx.fillStyle = "#4488ff";
    for (i = 0; i < MAX_SHIELDS; i++) {
      ctx.fillRect(x + i * 14, y, 10, 8);
    }
    for (i = 0; i < health.shields; i++) {
      ctx.fillStyle = "#66aaff";
      ctx.fillRect(x + i * 14, y, 10, 8);
    }
    y += 14;
    ctx.fillStyle = "#884422";
    for (i = 0; i < MAX_HULL; i++) {
      ctx.fillRect(x + i * 16, y, 12, 8);
    }
    for (i = 0; i < health.hull; i++) {
      ctx.fillStyle = "#ff6644";
      ctx.fillRect(x + i * 16, y, 12, 8);
    }
    if (health.flash > 0) {
      ctx.fillStyle = "rgba(255,40,40," + (health.flash * 1.8) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  // --- Dogfight state ---
  var ties = createPool(createTie, TIE_POOL_SIZE);
  var waveMgr = createWaveManager();
  var playerHealth = createPlayerHealth();
  var vader = null;
  var spawnTimer = 0;
  var drawList = [];
  var playing = false;
  var lastTime = 0;
  var score = 0;
  var fireCooldown = 0;
  var bossBanner = 0;

  function trySpawn() {
    if (waveMgr.phase === PHASE_BOSS) {
      return;
    }
    if (ties.active.length >= waveMgr.maxActive || spawnTimer > 0) {
      return;
    }
    var t = ties.acquire();
    resetTieStrafe(t, waveMgr);
    spawnTimer = waveMgr.spawnCooldown;
  }

  function spawnBoss() {
    ties.releaseAll();
    vader = ties.acquire();
    resetVader(vader, waveMgr);
    bossBanner = 3.5;
  }

  function onEnemyDestroyed(t, wasKill) {
    if (!wasKill) {
      return;
    }
    var result = waveMgr.recordKill(t.isVader);
    if (result.bossStart) {
      spawnBoss();
    }
    if (t.isVader) {
      vader = null;
      score += 2500;
    } else {
      score += 100 + waveMgr.wave * 10;
    }
  }

  function tryPlayerFire() {
    if (fireCooldown > 0) {
      return;
    }
    var ch = crosshairScreen();
    var best = null;
    var bestDist = 99999;
    var i;
    var list = ties.active;
    for (i = 0; i < list.length; i++) {
      var t = list[i];
      var p = project(t.x, t.y, t.z);
      if (!p) {
        continue;
      }
      var dx = p.x - ch.x;
      var dy = p.y - ch.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var radius = 26 * p.scale + (t.isVader ? 22 : 0);
      if (dist < radius && dist < bestDist) {
        best = t;
        bestDist = dist;
      }
    }
    if (!best) {
      return;
    }
    fireCooldown = 0.2;
    if (best.isVader) {
      best.hp--;
      if (best.hp <= 0) {
        onEnemyDestroyed(best, true);
        ties.release(best);
      } else {
        score += 50;
      }
    } else {
      onEnemyDestroyed(best, true);
      ties.release(best);
    }
  }

  function endDogfight() {
    playing = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GAME OVER";
    instructionsEl.textContent =
      "BUILD " + BUILD_ID + " — Final score: " + score;
    endHintEl.textContent =
      "Waves survived: " +
      (waveMgr.bossDefeated ? waveMgr.wave : Math.max(1, waveMgr.wave - 1)) +
      "  |  TIE kills: " +
      waveMgr.totalKills;
    btnStart.textContent = "PLAY AGAIN";
    btnQuit.classList.add("hidden");
    if (stateLabel) {
      stateLabel.textContent = "STATE: GAME OVER  BUILD " + BUILD_ID;
    }
    if (typeof SLArcade !== "undefined" && SLArcade.submitScore) {
      SLArcade.submitScore(score).catch(function () {});
    }
    refreshLeaderboard();
  }

  function enterDogfight() {
    playing = true;
    score = 0;
    fireCooldown = 0;
    bossBanner = 0;
    vader = null;
    camX = 0;
    camY = 0;
    camTargetX = 0;
    camTargetY = 0;
    spawnTimer = 0;
    waveMgr.reset();
    playerHealth.reset();
    initStars();
    ties.releaseAll();
    var i;
    for (i = 0; i < waveMgr.maxActive; i++) {
      resetTieStrafe(
        ties.acquire(),
        waveMgr
      );
      ties.active[i].z =
        SPAWN_Z_MIN + i * ((SPAWN_Z_MAX - SPAWN_Z_MIN) / waveMgr.maxActive);
      ties.active[i].entryZ = ties.active[i].z;
      applyStrafePosition(ties.active[i]);
    }
    spawnTimer = waveMgr.spawnCooldown;
    overlay.classList.add("hidden");
    btnQuit.classList.remove("hidden");
    if (stateLabel) {
      stateLabel.textContent = "STATE: DOGFIGHT  BUILD " + BUILD_ID;
    }
  }

  function updateDogfight(dt) {
    if (playerHealth.isDead()) {
      endDogfight();
      return;
    }
    setSteer(steerX, steerY);
    updateCamera(dt);
    updateStars(dt);
    playerHealth.update(dt);
    if (fireCooldown > 0) {
      fireCooldown -= dt;
    }
    if (bossBanner > 0) {
      bossBanner -= dt;
    }
    if (spawnTimer > 0) {
      spawnTimer -= dt;
    }
    if (fireQueued) {
      fireQueued = false;
      tryPlayerFire();
    }

    var ch = crosshairScreen();
    var aimAtBossZ = vader ? vader.z : 400;
    var aim = screenToWorldAtZ(ch.x, ch.y, aimAtBossZ);

    var i;
    for (i = ties.active.length - 1; i >= 0; i--) {
      var t = ties.active[i];
      if (updateTie(t, dt, waveMgr, playerHealth, aim.x, aim.y)) {
        ties.release(t);
        if (t === vader) {
          vader = null;
        }
      }
    }
    trySpawn();

    if (stateLabel) {
      var phaseLabel =
        waveMgr.phase === PHASE_BOSS ? "BOSS" : "DOGFIGHT W" + waveMgr.wave;
      stateLabel.textContent =
        "STATE: " + phaseLabel + "  BUILD " + BUILD_ID;
    }
  }

  function drawDogfight() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawStars();
    drawList.length = 0;
    var i;
    for (i = 0; i < ties.active.length; i++) {
      drawList.push(ties.active[i]);
    }
    drawList.sort(function (a, b) {
      return b.z - a.z;
    });
    for (i = 0; i < drawList.length; i++) {
      drawTie(drawList[i]);
    }
    drawCrosshair();
    drawHud(waveMgr, playerHealth, score);
    if (bossBanner > 0) {
      ctx.font = "bold 18px Consolas, monospace";
      ctx.fillStyle = "rgba(120,220,255," + Math.min(1, bossBanner) + ")";
      ctx.fillText("VADER INCOMING", CX - 72, CY - 40);
    }
  }

  function loop(now) {
    if (!lastTime) {
      lastTime = now;
    }
    var dt = (now - lastTime) / 1000;
    if (dt > 0.05) {
      dt = 0.05;
    }
    lastTime = now;
    if (playing) {
      updateDogfight(dt);
      drawDogfight();
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(loop);
  }

  // --- Cabinet shell ---
  var lastLeaderboardData = null;

  function syncPlayerLine() {
    if (typeof SLArcade === "undefined") {
      return;
    }
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  function updateStartScores(data) {
    var enabled = !!data.scoresEnabled;
    personalEl.textContent =
      !enabled || !data.personalScore
        ? "Your top score: —"
        : "Your top score: " + data.personalScore;
    highScoreEl.textContent =
      !enabled || !data.entries || !data.entries.length
        ? "High score: —"
        : "High score: " + data.entries[0].score;
    if (!enabled || data.unavailableMessage) {
      unavailableEl.textContent =
        data.unavailableMessage ||
        (SLArcade && SLArcade.SCORES_UNAVAILABLE_MSG) ||
        "Scores unavailable.";
      unavailableEl.classList.remove("hidden");
      startScoresEl.classList.add("hidden");
      btnLeaderboard.classList.add("hidden");
      return;
    }
    unavailableEl.classList.add("hidden");
    startScoresEl.classList.remove("hidden");
    btnLeaderboard.classList.remove("hidden");
  }

  function renderLeaderboardList(entries) {
    leaderboardEl.innerHTML = "";
    if (!entries || !entries.length) {
      var empty = document.createElement("li");
      empty.textContent = "No scores yet — be the first!";
      leaderboardEl.appendChild(empty);
      return;
    }
    var i;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      var li = document.createElement("li");
      var rankSpan = document.createElement("span");
      var nameSpan = document.createElement("span");
      var scoreSpan = document.createElement("span");
      rankSpan.className = "rank";
      nameSpan.className = "name";
      scoreSpan.className = "score";
      rankSpan.textContent = String(e.rank) + ".";
      nameSpan.textContent = e.name;
      scoreSpan.textContent = String(e.score);
      li.appendChild(rankSpan);
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      leaderboardEl.appendChild(li);
    }
  }

  function refreshLeaderboard() {
    if (typeof SLArcade === "undefined" || !SLArcade.getLeaderboard) {
      return;
    }
    SLArcade.getLeaderboard()
      .then(function (data) {
        lastLeaderboardData = data;
        updateStartScores(data);
        renderLeaderboardList(data.entries || []);
      })
      .catch(function () {
        unavailableEl.textContent =
          (SLArcade && SLArcade.SCORES_UNAVAILABLE_MSG) ||
          "Scores unavailable.";
        unavailableEl.classList.remove("hidden");
        startScoresEl.classList.add("hidden");
        btnLeaderboard.classList.add("hidden");
      });
  }

  function showMenu() {
    playing = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL WARS";
    instructionsEl.textContent =
      "BUILD " +
      BUILD_ID +
      " — Waves, strafe paths, shields/hull, Vader boss. Click to fire. Esc quits.";
    endHintEl.textContent = "";
    btnStart.textContent = "START DOGFIGHT";
    btnStart.disabled = false;
    btnQuit.classList.add("hidden");
    if (stateLabel) {
      stateLabel.textContent = "STATE: MENU  BUILD " + BUILD_ID;
    }
    if (lastLeaderboardData) {
      updateStartScores(lastLeaderboardData);
    }
  }

  function quitToMenu() {
    if (typeof SLArcade !== "undefined" && SLArcade.endSession) {
      SLArcade.endSession().catch(function () {});
    }
    showMenu();
  }

  btnStart.addEventListener("click", enterDogfight);
  btnQuit.addEventListener("click", quitToMenu);
  btnLeaderboard.addEventListener("click", function () {
    if (lastLeaderboardData) {
      renderLeaderboardList(lastLeaderboardData.entries || []);
    }
    leaderboardModal.classList.remove("hidden");
  });
  btnModalClose.addEventListener("click", function () {
    leaderboardModal.classList.add("hidden");
  });
  leaderboardModal.addEventListener("click", function (e) {
    if (e.target === leaderboardModal) {
      leaderboardModal.classList.add("hidden");
    }
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      quitToMenu();
    }
    if ((e.key === " " || e.key === "Spacebar") && playing) {
      fireQueued = true;
      e.preventDefault();
    }
  });
  window.addEventListener("message", function () {
    syncPlayerLine();
    refreshLeaderboard();
  });

  syncPlayerLine();
  refreshLeaderboard();
  showMenu();
  requestAnimationFrame(loop);
})();
