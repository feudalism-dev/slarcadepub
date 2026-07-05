(function () {
  "use strict";

  SLArcade.registerGameId("slwars");

  var canvas = document.getElementById("game");
  var gameWrap = document.getElementById("game-wrap");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var btnStart = document.getElementById("btn-start");
  var btnNext = document.getElementById("btn-next");
  var btnQuit = document.getElementById("btn-quit");
  var btnLeaderboard = document.getElementById("btn-leaderboard");
  var btnModalClose = document.getElementById("btn-modal-close");
  var hud = document.getElementById("hud");
  var startScoresEl = document.getElementById("start-scores");
  var personalEl = document.getElementById("personal-score");
  var highScoreEl = document.getElementById("high-score");
  var unavailableEl = document.getElementById("scores-unavailable");
  var leaderboardEl = document.getElementById("leaderboard");
  var leaderboardModal = document.getElementById("leaderboard-modal");
  var messagesEl = document.getElementById("game-messages");
  var playerLine = document.getElementById("player-line");
  var instructionsEl = document.getElementById("instructions");
  var endHintEl = document.getElementById("end-hint");

  var W = canvas.width;
  var H = canvas.height;
  var CX = W / 2;
  var CY = H / 2;
  var FOV = 440;

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "levelComplete";
  var PHASE_DIED = "died";
  var PHASE_OVER = "gameOver";

  var STAGE_BATTLE = "battle";
  var STAGE_APPROACH = "approach";
  var STAGE_TRENCH = "trench";
  var STAGE_EXPLODE = "explode";

  var READY_FRAMES = 120;
  var RESPAWN_FRAMES = 90;
  var STARTING_LIVES = 3;
  var LIFE_BONUS_SCORES = [3000, 8000, 15000];
  var CONTINUE_TIMEOUT_MS = 30000;

  var WIRE_GREEN = "#6f6";
  var WIRE_CYAN = "#7ef";
  var WIRE_DIM = "#264";
  var WIRE_RED = "#f55";
  var WIRE_YELLOW = "#fd6";

  var keys = {};
  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var lives = 3;
  var wave = 1;
  var frame = 0;
  var readyTimer = 0;
  var playerInvuln = 0;
  var lifeBonusesClaimed = 0;
  var bonusFlashTimer = 0;
  var bonusFlashText = "";
  var continueDeadline = 0;
  var continueTimerId = null;
  var lastLeaderboardData = null;

  var stage = STAGE_BATTLE;
  var shield = 100;
  var aimX = CX;
  var aimY = CY;
  var mouseTargetX = CX;
  var mouseTargetY = CY;
  var shipX = 0;
  var shipY = 0;
  var lastShot = 0;
  var fireCooldown = 10;

  var stars = [];
  var ties = [];
  var bolts = [];
  var tieSpawnTimer = 0;
  var tiesKilled = 0;
  var tiesRequired = 12;
  var enemyShotTimer = 0;

  var approachTimer = 0;
  var deathStarZ = 1800;
  var surfaceTargets = [];
  var surfaceKilled = 0;
  var surfaceRequired = 6;

  var trenchProgress = 0;
  var trenchSpeed = 2.8;
  var towers = [];
  var towerSpawnTimer = 0;
  var exhaustVisible = false;
  var exhaustHit = false;
  var trenchRoll = 0;

  var explodeTimer = 0;
  var explodeScale = 1;
  var laserFlash = 0;
  var hitFlash = 0;
  var killFlash = [];

  var TIE_EDGES = [
    [[0, 0, 10], [0, 0, -10]],
    [[-32, 0, 0], [32, 0, 0]],
    [[-32, 0, 0], [-32, 20, 0], [-10, 20, 0], [0, 10, 0]],
    [[0, 10, 0], [10, 20, 0], [32, 20, 0], [32, 0, 0]],
    [[-32, 0, 0], [-32, -20, 0], [-10, -20, 0], [0, -10, 0]],
    [[0, -10, 0], [10, -20, 0], [32, -20, 0], [32, 0, 0]],
    [[-14, 14, 0], [14, 14, 0], [14, -14, 0], [-14, -14, 0], [-14, 14, 0]],
  ];

  function setGameActive(active) {
    gameWrap.classList.toggle("game-active", !!active);
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
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    var p = pointerToCanvas(e.clientX, e.clientY);
    mouseTargetX = p.x;
    mouseTargetY = p.y;
  }

  function onPointerDown(e) {
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    onPointerMove(e);
    fireLaser();
    e.preventDefault();
  }

  function initStars() {
    stars = [];
    var i;
    for (i = 0; i < 160; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 1400,
        z: 60 + Math.random() * 2200,
        speed: 5 + Math.random() * 14,
      });
    }
  }

  function project(x, y, z) {
    if (z < 1) {
      return null;
    }
    var scale = FOV / z;
    return {
      x: CX + x * scale,
      y: CY - y * scale,
      z: z,
      scale: scale,
    };
  }

  function strokeGlow(color, width, glow) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow || 6;
  }

  function clearGlow() {
    ctx.shadowBlur = 0;
  }

  function drawLine3D(x1, y1, z1, x2, y2, z2, color, width, glow) {
    var a = project(x1, y1, z1);
    var b = project(x2, y2, z2);
    if (!a || !b || a.z < 1 || b.z < 1) {
      return;
    }
    strokeGlow(color, width || 1, glow);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    clearGlow();
  }

  function drawPoly3D(points, color, width, glow) {
    var i;
    if (points.length < 2) {
      return;
    }
    strokeGlow(color, width || 1, glow);
    ctx.beginPath();
    for (i = 0; i < points.length; i++) {
      var p = project(points[i][0], points[i][1], points[i][2]);
      if (!p) {
        clearGlow();
        return;
      }
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    clearGlow();
  }

  function drawWireEdges(edges, ox, oy, oz, scale, color, glow) {
    var i;
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (e.length === 2) {
        drawLine3D(
          ox + e[0][0] * scale,
          oy + e[0][1] * scale,
          oz + e[0][2] * scale,
          ox + e[1][0] * scale,
          oy + e[1][1] * scale,
          oz + e[1][2] * scale,
          color,
          1.2,
          glow
        );
      } else {
        var pts = [];
        var j;
        for (j = 0; j < e.length; j++) {
          pts.push([
            ox + e[j][0] * scale,
            oy + e[j][1] * scale,
            oz + e[j][2] * scale,
          ]);
        }
        drawPoly3D(pts, color, 1.2, glow);
      }
    }
  }

  function drawStars(speedMul) {
    var i;
    ctx.fillStyle = "#fff";
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z -= s.speed * speedMul;
      if (s.z < 1) {
        s.z = 1400 + Math.random() * 900;
        s.x = (Math.random() - 0.5) * 2000;
        s.y = (Math.random() - 0.5) * 1400;
      }
      var p = project(s.x, s.y, s.z);
      if (p) {
        var streak = speedMul > 1.8;
        ctx.globalAlpha = Math.min(1, 1.5 - s.z / 1400);
        if (streak) {
          strokeGlow("#fff", 1, 2);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + 8 + speedMul * 2);
          ctx.stroke();
          clearGlow();
        } else {
          ctx.fillRect(p.x, p.y, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDeathStar(z, color) {
    var r = 130;
    var segs = 14;
    var i;
    var j;
    for (i = 0; i < segs; i++) {
      var a1 = (i / segs) * Math.PI * 2;
      var a2 = ((i + 1) / segs) * Math.PI * 2;
      for (j = 0; j < segs / 2; j++) {
        var lat1 = (j / (segs / 2)) * Math.PI - Math.PI / 2;
        var lat2 = ((j + 1) / (segs / 2)) * Math.PI - Math.PI / 2;
        var x1 = Math.cos(lat1) * Math.cos(a1) * r;
        var y1 = Math.sin(lat1) * r;
        var z1p = Math.cos(lat1) * Math.sin(a1) * r;
        var x2 = Math.cos(lat1) * Math.cos(a2) * r;
        var y2 = Math.sin(lat1) * r;
        var z2p = Math.cos(lat1) * Math.sin(a2) * r;
        var x3 = Math.cos(lat2) * Math.cos(a2) * r;
        var y3 = Math.sin(lat2) * r;
        var z3p = Math.cos(lat2) * Math.sin(a2) * r;
        drawLine3D(x1, y1, z + z1p, x2, y2, z + z2p, color, 1, 4);
        drawLine3D(x2, y2, z + z2p, x3, y3, z + z3p, color, 1, 4);
      }
    }
    drawLine3D(-50, 25, z + 110, 50, 25, z + 110, color, 2, 6);
    drawLine3D(-50, 25, z + 110, 0, -35, z + 145, color, 2, 6);
    drawLine3D(50, 25, z + 110, 0, -35, z + 145, color, 2, 6);
    drawLine3D(0, -35, z + 145, 0, -35, z + 175, WIRE_RED, 2, 8);
  }

  function spawnTie() {
    var pattern = Math.floor(Math.random() * 3);
    var t = {
      x: (Math.random() - 0.5) * 600,
      y: (Math.random() - 0.5) * 320,
      z: 1000 + Math.random() * 800,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      speed: 4 + wave * 0.4,
      alive: true,
      scale: 1,
      pattern: pattern,
      phase: Math.random() * Math.PI * 2,
    };
    if (pattern === 1) {
      t.x = (Math.random() < 0.5 ? -1 : 1) * (280 + Math.random() * 120);
      t.vx = -t.x * 0.002;
    }
    ties.push(t);
  }

  function spawnSurfaceTarget() {
    var ang = Math.random() * Math.PI * 2;
    var lat = (Math.random() - 0.3) * Math.PI * 0.55;
    var r = 130;
    surfaceTargets.push({
      lx: Math.cos(lat) * Math.cos(ang) * r,
      ly: Math.sin(lat) * r,
      lz: Math.cos(lat) * Math.sin(ang) * r,
      alive: true,
    });
  }

  function tieScreenPos(t) {
    return project(t.x, t.y, t.z);
  }

  function screenHitRadius(base, p) {
    return base + (p ? p.scale * 12 : 0);
  }

  function fireLaser() {
    if (frame - lastShot < fireCooldown) {
      return;
    }
    lastShot = frame;
    laserFlash = 10;

    if (stage === STAGE_BATTLE) {
      var best = null;
      var bestZ = 99999;
      var i;
      for (i = 0; i < ties.length; i++) {
        var t = ties[i];
        if (!t.alive) {
          continue;
        }
        var p = tieScreenPos(t);
        if (!p) {
          continue;
        }
        var dx = p.x - aimX;
        var dy = p.y - aimY;
        var hitR = screenHitRadius(22, p);
        if (dx * dx + dy * dy < hitR * hitR && t.z < bestZ) {
          best = t;
          bestZ = t.z;
        }
      }
      if (best) {
        best.alive = false;
        tiesKilled++;
        score += 100 + wave * 15;
        hitFlash = 8;
        killFlash.push({ x: aimX, y: aimY, t: 12 });
        checkLifeBonuses();
        updateHud();
      }
      return;
    }

    if (stage === STAGE_APPROACH) {
      var j;
      for (j = 0; j < surfaceTargets.length; j++) {
        var st = surfaceTargets[j];
        if (!st.alive) {
          continue;
        }
        var sp = project(st.lx, st.ly, deathStarZ + st.lz);
        if (!sp) {
          continue;
        }
        var sdx = sp.x - aimX;
        var sdy = sp.y - aimY;
        if (sdx * sdx + sdy * sdy < 400) {
          st.alive = false;
          surfaceKilled++;
          score += 200;
          hitFlash = 6;
          killFlash.push({ x: aimX, y: aimY, t: 10 });
          updateHud();
          return;
        }
      }
      return;
    }

    if (stage === STAGE_TRENCH) {
      var k;
      for (k = 0; k < towers.length; k++) {
        var tw = towers[k];
        if (!tw.alive) {
          continue;
        }
        var tp = project(tw.x + shipX, tw.y + shipY, tw.z);
        if (!tp) {
          continue;
        }
        var tdx = tp.x - aimX;
        var tdy = tp.y - aimY;
        if (tdx * tdx + tdy * tdy < 700) {
          tw.alive = false;
          score += 300;
          hitFlash = 6;
          killFlash.push({ x: aimX, y: aimY, t: 10 });
          updateHud();
          return;
        }
      }
      if (exhaustVisible && !exhaustHit) {
        var ex = project(shipX, shipY - 30, 120);
        if (ex) {
          var edx = ex.x - aimX;
          var edy = ex.y - aimY;
          if (edx * edx + edy * edy < 350) {
            exhaustHit = true;
            score += 5000 + wave * 500;
            hitFlash = 24;
            updateHud();
            beginExplosion();
          }
        }
      }
    }
  }

  function spawnBolt(fromX, fromY, fromZ) {
    var p = project(fromX, fromY, fromZ);
    if (!p) {
      return;
    }
    var dx = aimX - p.x;
    var dy = aimY - p.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var spd = 5 + wave * 0.3;
    bolts.push({
      sx: p.x,
      sy: p.y,
      vx: (dx / len) * spd,
      vy: (dy / len) * spd,
      life: 90,
    });
  }

  function damagePlayer(amount) {
    if (playerInvuln > 0) {
      return;
    }
    shield -= amount;
    hitFlash = 12;
    playerInvuln = 50;
    if (shield <= 0) {
      shield = 100;
      lives--;
      updateHud();
      if (lives <= 0) {
        gameOver();
        return;
      }
      showDeathContinue();
    }
    updateHud();
  }

  function updateBolts() {
    var i;
    for (i = bolts.length - 1; i >= 0; i--) {
      var b = bolts[i];
      b.sx += b.vx;
      b.sy += b.vy;
      b.life--;
      if (b.life <= 0) {
        bolts.splice(i, 1);
        continue;
      }
      var dx = b.sx - aimX;
      var dy = b.sy - aimY;
      if (dx * dx + dy * dy < 100) {
        bolts.splice(i, 1);
        damagePlayer(18 + wave * 2);
      }
    }
  }

  function tryEnemyShot() {
    if (stage !== STAGE_BATTLE || ties.length === 0) {
      return;
    }
    var candidates = [];
    var i;
    for (i = 0; i < ties.length; i++) {
      if (ties[i].alive && ties[i].z < 750) {
        candidates.push(ties[i]);
      }
    }
    if (!candidates.length) {
      return;
    }
    var t = candidates[Math.floor(Math.random() * candidates.length)];
    spawnBolt(t.x, t.y, t.z);
  }

  function updateBattle() {
    tieSpawnTimer++;
    var spawnInterval = Math.max(22, 50 - wave * 3);
    if (tieSpawnTimer >= spawnInterval && tiesKilled + aliveTies() < tiesRequired + 5) {
      tieSpawnTimer = 0;
      spawnTie();
    }

    var i;
    for (i = ties.length - 1; i >= 0; i--) {
      var t = ties[i];
      if (!t.alive) {
        ties.splice(i, 1);
        continue;
      }
      if (t.pattern === 1) {
        t.x += t.vx * 2;
        t.y += Math.sin(frame * 0.06 + t.phase) * 2.2;
      } else if (t.pattern === 2) {
        t.x += Math.sin(frame * 0.05 + t.phase) * 2.5;
        t.y += Math.cos(frame * 0.04 + t.phase) * 1.8;
      } else {
        t.x += t.vx;
        t.y += Math.sin(frame * 0.04 + t.phase) * 0.8;
      }
      t.z -= t.speed;
      if (t.z < 25) {
        t.alive = false;
        damagePlayer(40);
      }
    }

    enemyShotTimer++;
    if (enemyShotTimer >= Math.max(35, 80 - wave * 5)) {
      enemyShotTimer = 0;
      tryEnemyShot();
    }

    updateBolts();

    if (tiesKilled >= tiesRequired && aliveTies() === 0) {
      beginApproach();
    }
  }

  function aliveTies() {
    var n = 0;
    var i;
    for (i = 0; i < ties.length; i++) {
      if (ties[i].alive) {
        n++;
      }
    }
    return n;
  }

  function beginApproach() {
    stage = STAGE_APPROACH;
    approachTimer = 0;
    deathStarZ = 1700;
    ties = [];
    bolts = [];
    surfaceTargets = [];
    surfaceKilled = 0;
    surfaceRequired = 5 + wave;
    var i;
    for (i = 0; i < surfaceRequired + 3; i++) {
      spawnSurfaceTarget();
    }
  }

  function updateApproach() {
    approachTimer++;
    deathStarZ -= 5 + wave * 0.4;
    var i;
    for (i = surfaceTargets.length - 1; i >= 0; i--) {
      if (!surfaceTargets[i].alive) {
        surfaceTargets.splice(i, 1);
      }
    }
    if (surfaceKilled >= surfaceRequired || approachTimer > 280) {
      if (deathStarZ < 320 || approachTimer > 280) {
        beginTrench();
      }
    }
  }

  function beginTrench() {
    stage = STAGE_TRENCH;
    trenchProgress = 0;
    towers = [];
    towerSpawnTimer = 0;
    exhaustVisible = false;
    exhaustHit = false;
    shipX = 0;
    shipY = 0;
    bolts = [];
  }

  function spawnTower() {
    var side = Math.random() < 0.5 ? -1 : 1;
    towers.push({
      x: side * (100 + Math.random() * 90),
      y: (Math.random() - 0.5) * 50,
      z: 450 + Math.random() * 180,
      alive: true,
      fired: false,
    });
  }

  function updateTrench() {
    trenchProgress += trenchSpeed + wave * 0.2;
    trenchRoll += trenchSpeed * 0.8;

    var wallLimit = 95 - trenchProgress * 0.04;
    if (Math.abs(shipX) > wallLimit) {
      damagePlayer(3);
    }

    towerSpawnTimer++;
    if (towerSpawnTimer >= Math.max(30, 65 - wave * 4)) {
      towerSpawnTimer = 0;
      spawnTower();
    }

    var i;
    for (i = towers.length - 1; i >= 0; i--) {
      var tw = towers[i];
      if (!tw.alive) {
        towers.splice(i, 1);
        continue;
      }
      tw.z -= trenchSpeed + 1.2;
      if (tw.z < 50 && !tw.fired) {
        tw.fired = true;
        spawnBolt(tw.x + shipX, tw.y + shipY, tw.z);
      }
      if (tw.z < 0) {
        tw.alive = false;
      }
    }

    updateBolts();

    if (trenchProgress > 480) {
      exhaustVisible = true;
    }

    if (shield > 0 && shield < 100 && frame % 25 === 0) {
      shield += 1;
      if (shield > 100) {
        shield = 100;
      }
      updateHud();
    }
  }

  function beginExplosion() {
    stage = STAGE_EXPLODE;
    explodeTimer = 0;
    explodeScale = 1;
    running = false;
    setGameActive(false);
  }

  function updateExplosion() {
    explodeTimer++;
    explodeScale += 0.09;
    if (explodeTimer > 130) {
      showMissionComplete();
    }
  }

  function updateFlightControl() {
    var smooth = stage === STAGE_TRENCH ? 0.22 : 0.3;
    aimX += (mouseTargetX - aimX) * smooth;
    aimY += (mouseTargetY - aimY) * smooth;

    if (keys.ArrowLeft || keys.a || keys.A) {
      mouseTargetX -= 8;
    }
    if (keys.ArrowRight || keys.d || keys.D) {
      mouseTargetX += 8;
    }
    if (keys.ArrowUp || keys.w || keys.W) {
      mouseTargetY -= 8;
    }
    if (keys.ArrowDown || keys.s || keys.S) {
      mouseTargetY += 8;
    }

    if (aimX < 30) {
      aimX = 30;
    }
    if (aimX > W - 30) {
      aimX = W - 30;
    }
    if (aimY < 30) {
      aimY = 30;
    }
    if (aimY > H - 70) {
      aimY = H - 70;
    }
    mouseTargetX = aimX;
    mouseTargetY = aimY;

    if (stage === STAGE_TRENCH) {
      shipX = ((aimX - CX) / CX) * 110;
      shipY = ((CY - aimY) / CY) * 55;
    }

    if (keys[" "] || keys.Spacebar) {
      fireLaser();
    }
  }

  function drawTie(t) {
    var col = t.alive ? WIRE_GREEN : WIRE_DIM;
    drawWireEdges(TIE_EDGES, t.x, t.y, t.z, t.scale, col, 8);
  }

  function drawSurfaceTargets() {
    var i;
    for (i = 0; i < surfaceTargets.length; i++) {
      var st = surfaceTargets[i];
      if (!st.alive) {
        continue;
      }
      var s = 14;
      drawLine3D(st.lx - s, st.ly, deathStarZ + st.lz, st.lx + s, st.ly, deathStarZ + st.lz, WIRE_RED, 2, 8);
      drawLine3D(st.lx, st.ly - s, deathStarZ + st.lz, st.lx, st.ly + s, deathStarZ + st.lz, WIRE_RED, 2, 8);
      drawLine3D(st.lx, st.ly, deathStarZ + st.lz, st.lx, st.ly, deathStarZ + st.lz + s, WIRE_YELLOW, 2, 6);
    }
  }

  function drawTowers() {
    var i;
    for (i = 0; i < towers.length; i++) {
      var tw = towers[i];
      if (!tw.alive) {
        continue;
      }
      var ox = tw.x + shipX;
      var oy = tw.y + shipY;
      var s = 20;
      drawLine3D(ox - s, oy, tw.z, ox + s, oy, tw.z, WIRE_RED, 2, 8);
      drawLine3D(ox, oy - s, tw.z, ox, oy + s, tw.z, WIRE_RED, 2, 8);
      drawLine3D(ox, oy, tw.z, ox, oy, tw.z + s * 2.5, WIRE_RED, 2, 8);
      drawLine3D(ox - s, oy, tw.z + s, ox + s, oy, tw.z + s, WIRE_CYAN, 1, 4);
    }
  }

  function drawTrench() {
    var prog = trenchProgress;
    var vanY = CY - 50;
    var half = 300 - prog * 0.12;
    var cx = CX + shipX * 0.4;

    strokeGlow(WIRE_GREEN, 2, 8);
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(cx - half * 0.38, vanY);
    ctx.moveTo(W, H);
    ctx.lineTo(cx + half * 0.38, vanY);
    ctx.stroke();
    clearGlow();

    strokeGlow(WIRE_DIM, 1, 3);
    var i;
    for (i = 0; i < 18; i++) {
      var t = ((i * 53 + trenchRoll) % 420) / 420;
      var y = H - t * (H - vanY);
      var w = half * 0.38 * (1 - t) + 18;
      ctx.beginPath();
      ctx.moveTo(cx - w, y);
      ctx.lineTo(cx + w, y);
      ctx.stroke();
    }
    clearGlow();

    strokeGlow(WIRE_DIM, 1, 2);
    for (i = 0; i < 10; i++) {
      var u = ((i * 80 + trenchRoll * 1.4) % 500) / 500;
      var y2 = H - u * (H - vanY);
      var w2 = half * 0.38 * (1 - u) + 18;
      ctx.beginPath();
      ctx.moveTo(cx - w2, y2);
      ctx.lineTo(cx - w2 * 0.15, vanY);
      ctx.moveTo(cx + w2, y2);
      ctx.lineTo(cx + w2 * 0.15, vanY);
      ctx.stroke();
    }
    clearGlow();

    if (exhaustVisible && !exhaustHit) {
      var ex = project(shipX, shipY - 30, 120);
      if (ex) {
        var r = 16 + Math.sin(frame * 0.25) * 4;
        strokeGlow(WIRE_RED, 2, 12);
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex.x - r, ex.y);
        ctx.lineTo(ex.x + r, ex.y);
        ctx.moveTo(ex.x, ex.y - r);
        ctx.lineTo(ex.x, ex.y + r);
        ctx.stroke();
        clearGlow();
        ctx.fillStyle = WIRE_YELLOW;
        ctx.font = "12px monospace";
        ctx.fillText("FIRE ON TARGET", ex.x - 52, ex.y - r - 8);
      }
    }
  }

  function drawBolts() {
    var i;
    strokeGlow(WIRE_RED, 2, 10);
    for (i = 0; i < bolts.length; i++) {
      var b = bolts[i];
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy);
      ctx.lineTo(b.sx - b.vx * 3, b.sy - b.vy * 3);
      ctx.stroke();
    }
    clearGlow();
  }

  function drawCockpit() {
    strokeGlow(WIRE_DIM, 2, 4);
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W * 0.18, H * 0.7);
    ctx.lineTo(W * 0.82, H * 0.7);
    ctx.lineTo(W, H);
    ctx.stroke();
    strokeGlow(WIRE_GREEN, 1, 3);
    ctx.beginPath();
    ctx.moveTo(W * 0.18, H * 0.7);
    ctx.lineTo(W * 0.82, H * 0.7);
    ctx.stroke();
    clearGlow();
  }

  function drawCrosshair() {
    strokeGlow(WIRE_CYAN, 1, 8);
    var r = 16;
    ctx.beginPath();
    ctx.arc(aimX, aimY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aimX - r - 8, aimY);
    ctx.lineTo(aimX - 5, aimY);
    ctx.moveTo(aimX + 5, aimY);
    ctx.lineTo(aimX + r + 8, aimY);
    ctx.moveTo(aimX, aimY - r - 8);
    ctx.lineTo(aimX, aimY - 5);
    ctx.moveTo(aimX, aimY + 5);
    ctx.lineTo(aimX, aimY + r + 8);
    ctx.stroke();
    clearGlow();
  }

  function drawLaserBeam() {
    if (laserFlash <= 0) {
      return;
    }
    laserFlash--;
    strokeGlow("#fff", 3, 14);
    ctx.beginPath();
    ctx.moveTo(CX, H - 24);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
    clearGlow();
  }

  function drawKillFlashes() {
    var i;
    for (i = killFlash.length - 1; i >= 0; i--) {
      var k = killFlash[i];
      k.t--;
      if (k.t <= 0) {
        killFlash.splice(i, 1);
        continue;
      }
      strokeGlow(WIRE_YELLOW, 2, 12);
      ctx.beginPath();
      ctx.arc(k.x, k.y, 18 - k.t, 0, Math.PI * 2);
      ctx.stroke();
      clearGlow();
    }
  }

  function drawStageLabel() {
    var label = "";
    if (stage === STAGE_BATTLE) {
      label = "FIGHTERS: " + tiesKilled + "/" + tiesRequired;
    } else if (stage === STAGE_APPROACH) {
      label = "APPROACH — TARGETS: " + surfaceKilled + "/" + surfaceRequired;
    } else if (stage === STAGE_TRENCH) {
      label = "TRENCH RUN — AUTO THRUST";
    } else if (stage === STAGE_EXPLODE) {
      label = "IMPACT!";
    }
    ctx.fillStyle = WIRE_CYAN;
    ctx.font = "13px monospace";
    ctx.fillText(label, 12, H - 12);
  }

  function drawExplosion() {
    drawStars(4);
    var r = 90 * explodeScale;
    var i;
    strokeGlow(WIRE_RED, 2, 14);
    for (i = 0; i < 20; i++) {
      var a = (i / 20) * Math.PI * 2 + explodeTimer * 0.06;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
      ctx.stroke();
    }
    clearGlow();
    strokeGlow(WIRE_GREEN, 2, 10);
    ctx.beginPath();
    ctx.arc(CX, CY, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    clearGlow();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    if (phase !== PHASE_PLAYING && phase !== PHASE_READY) {
      return;
    }

    if (stage === STAGE_EXPLODE) {
      drawExplosion();
      return;
    }

    var starSpeed = 1.2;
    if (stage === STAGE_APPROACH) {
      starSpeed = 2.8;
    }
    if (stage === STAGE_TRENCH) {
      starSpeed = 3.5;
    }
    drawStars(starSpeed);

    if (stage === STAGE_BATTLE) {
      var i;
      ties.sort(function (a, b) {
        return b.z - a.z;
      });
      for (i = 0; i < ties.length; i++) {
        if (ties[i].alive) {
          drawTie(ties[i]);
        }
      }
    } else if (stage === STAGE_APPROACH) {
      drawDeathStar(deathStarZ, WIRE_GREEN);
      drawSurfaceTargets();
    } else if (stage === STAGE_TRENCH) {
      drawTrench();
      drawTowers();
    }

    drawBolts();
    drawCockpit();
    drawCrosshair();
    drawLaserBeam();
    drawKillFlashes();
    drawStageLabel();

    if (hitFlash > 0) {
      hitFlash--;
      ctx.fillStyle = "rgba(255, 60, 60, 0.28)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function updatePlaying() {
    frame++;
    if (playerInvuln > 0) {
      playerInvuln--;
    }
    if (bonusFlashTimer > 0) {
      bonusFlashTimer--;
      if (bonusFlashTimer === 0) {
        bonusFlashText = "";
        updateHud();
      }
    }

    updateFlightControl();

    if (stage === STAGE_BATTLE) {
      updateBattle();
    } else if (stage === STAGE_APPROACH) {
      updateApproach();
    } else if (stage === STAGE_TRENCH) {
      updateTrench();
    } else if (stage === STAGE_EXPLODE) {
      updateExplosion();
    }
  }

  function updateHud() {
    var line =
      "SCORE " +
      score +
      "   WAVE " +
      wave +
      "   LIVES " +
      lives +
      "   SHIELD " +
      shield;
    if (bonusFlashTimer > 0) {
      line += "   |   " + bonusFlashText;
    }
    hud.textContent = line;
  }

  function checkLifeBonuses() {
    var i;
    for (i = lifeBonusesClaimed; i < LIFE_BONUS_SCORES.length; i++) {
      if (score < LIFE_BONUS_SCORES[i]) {
        return;
      }
      lives++;
      lifeBonusesClaimed = i + 1;
      bonusFlashText = "EXTRA LIFE — " + LIFE_BONUS_SCORES[i] + " pts!";
      bonusFlashTimer = 150;
      updateHud();
    }
  }

  function clearContinueTimer() {
    if (continueTimerId !== null) {
      clearInterval(continueTimerId);
      continueTimerId = null;
    }
  }

  function resetDeathContinue() {
    clearContinueTimer();
    continueDeadline = 0;
  }

  function tickDeathTimer() {
    if (phase !== PHASE_DIED) {
      resetDeathContinue();
      return;
    }
    var leftMs = continueDeadline - Date.now();
    if (leftMs <= 0) {
      resetDeathContinue();
      endHintEl.textContent = "Time's up!";
      gameOver();
      return;
    }
    var leftSec = Math.ceil(leftMs / 1000);
    endHintEl.textContent =
      "Continue within " + leftSec + " second" + (leftSec === 1 ? "" : "s") + "…";
  }

  function showDeathContinue() {
    phase = PHASE_DIED;
    running = false;
    setGameActive(false);
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "DIRECT HIT!";
    instructionsEl.textContent =
      "You have " +
      lives +
      (lives === 1 ? " life" : " lives") +
      " remaining. Score " +
      score +
      " — Wave " +
      wave +
      ".";
    btnStart.textContent = "CONTINUE";
    btnStart.disabled = false;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
    clearContinueTimer();
    continueDeadline = Date.now() + CONTINUE_TIMEOUT_MS;
    tickDeathTimer();
    continueTimerId = setInterval(tickDeathTimer, 250);
  }

  function continueAfterDeath() {
    if (phase !== PHASE_DIED) {
      return;
    }
    resetDeathContinue();
    playerInvuln = RESPAWN_FRAMES;
    beginReadyCountdown("GET READY!", stageLabelHint() + " — stay on target!");
    readyTimer = RESPAWN_FRAMES;
  }

  function stageLabelHint() {
    if (stage === STAGE_BATTLE) {
      return "TIE fighter engagement";
    }
    if (stage === STAGE_APPROACH) {
      return "Death Star surface run";
    }
    if (stage === STAGE_TRENCH) {
      return "Trench run";
    }
    return "Mission " + wave;
  }

  function setOverlayButtons(showStart, showNext) {
    btnStart.classList.toggle("hidden", !showStart);
    btnNext.classList.toggle("hidden", !showNext);
  }

  function setQuitVisible(visible) {
    btnQuit.classList.toggle("hidden", !visible);
  }

  function setStartScreenExtras(visible) {
    startScoresEl.classList.toggle("hidden", !visible);
    btnLeaderboard.classList.toggle("hidden", !visible);
    if (!visible) {
      closeLeaderboardModal();
    }
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL WARS";
    instructionsEl.textContent =
      "Arcade-style vector combat. Mouse = flight yoke. Click or Space = fire lasers. Forward flight is automatic — no thrust control, just like the original cabinet.";
    endHintEl.textContent = "";
    btnStart.disabled = false;
    btnStart.textContent = "START";
    setOverlayButtons(true, false);
    setStartScreenExtras(true);
    setQuitVisible(false);
    setGameActive(false);
    if (lastLeaderboardData) {
      updateStartScores(lastLeaderboardData);
    }
  }

  function beginReadyCountdown(titleText, hintText) {
    phase = PHASE_READY;
    running = false;
    readyTimer = READY_FRAMES;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = titleText || "GET READY!";
    instructionsEl.textContent = hintText || "Red Five standing by…";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
    setGameActive(false);
  }

  function showMissionComplete() {
    phase = PHASE_LEVEL;
    running = false;
    setGameActive(false);
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "DEATH STAR DESTROYED!";
    instructionsEl.textContent =
      "Great shot, Red Five! Score: " + score + " — the Empire will send reinforcements.";
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT MISSION";
    setOverlayButtons(false, true);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function formatTopScore(scoreVal, enabled) {
    if (!enabled || !scoreVal) {
      return "Your top score: —";
    }
    return "Your top score: " + scoreVal;
  }

  function formatHighScore(entries, enabled) {
    if (!enabled || !entries || !entries.length) {
      return "High score: —";
    }
    return "High score: " + entries[0].score;
  }

  function updateStartScores(data) {
    var enabled = !!data.scoresEnabled;
    personalEl.textContent = formatTopScore(data.personalScore || 0, enabled);
    highScoreEl.textContent = formatHighScore(data.entries || [], enabled);
    if (!enabled || data.unavailableMessage) {
      unavailableEl.textContent =
        data.unavailableMessage || SLArcade.SCORES_UNAVAILABLE_MSG;
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
    if (!entries.length) {
      var empty = document.createElement("li");
      empty.textContent = "No scores yet — be the first!";
      leaderboardEl.appendChild(empty);
    }
  }

  function renderLeaderboard(data) {
    lastLeaderboardData = data;
    updateStartScores(data);
    renderLeaderboardList(data.entries || []);
  }

  function refreshLeaderboard() {
    return SLArcade.getLeaderboard()
      .then(renderLeaderboard)
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        startScoresEl.classList.add("hidden");
      });
  }

  function openLeaderboardModal() {
    if (lastLeaderboardData) {
      renderLeaderboardList(lastLeaderboardData.entries || []);
    }
    leaderboardModal.classList.remove("hidden");
  }

  function closeLeaderboardModal() {
    leaderboardModal.classList.add("hidden");
  }

  function showMessages(list) {
    messagesEl.innerHTML = "";
    if (!list || !list.length) {
      return;
    }
    var i;
    for (i = 0; i < list.length; i++) {
      var div = document.createElement("div");
      div.className = "msg";
      div.textContent = list[i];
      messagesEl.appendChild(div);
    }
  }

  function updateReady() {
    frame++;
    readyTimer--;
    if (readyTimer <= 0) {
      phase = PHASE_PLAYING;
      running = true;
      overlay.classList.add("hidden");
      setOverlayButtons(false, false);
      setQuitVisible(true);
      setGameActive(true);
      mouseTargetX = aimX;
      mouseTargetY = aimY;
    } else if (readyTimer <= 60) {
      overlayTitle.textContent = "GO!";
    }
  }

  function update() {
    if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    } else if (phase === PHASE_READY) {
      updateReady();
    } else if (phase === PHASE_LEVEL && stage === STAGE_EXPLODE) {
      updateExplosion();
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  function enablePlayAgain(hint) {
    btnStart.textContent = "PLAY AGAIN";
    btnStart.disabled = false;
    endHintEl.textContent = hint || "Tap PLAY AGAIN for another run.";
  }

  function gameOver() {
    resetDeathContinue();
    phase = PHASE_OVER;
    running = false;
    setGameActive(false);
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GAME OVER";
    instructionsEl.textContent = "Final score: " + score;
    btnStart.textContent = "SAVING…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(false);

    var canEnd = SLArcade.canEndSession() && !SLArcade.isHudMode();
    var recoveryTimer = setTimeout(function () {
      if (phase === PHASE_OVER && btnStart.disabled) {
        enablePlayAgain("Tap PLAY AGAIN to continue.");
      }
    }, 8000);

    function finishGameOver() {
      clearTimeout(recoveryTimer);
      if (canEnd) {
        btnStart.textContent = "SESSION ENDING…";
        btnStart.disabled = true;
        endHintEl.textContent =
          "Click the arcade cabinet in-world to play again.";
        setTimeout(function () {
          SLArcade.endSession().catch(function () {
            enablePlayAgain("Session could not end — tap PLAY AGAIN.");
          });
        }, 2000);
        return;
      }
      enablePlayAgain("Tap PLAY AGAIN for another run.");
    }

    SLArcade.submitScore(score)
      .then(function (result) {
        if (result && result.pendingMoapReport) {
          return;
        }
        showMessages(result.messages || []);
        if (result.unavailableMessage) {
          unavailableEl.textContent = result.unavailableMessage;
          unavailableEl.classList.remove("hidden");
        }
        return refreshLeaderboard();
      })
      .then(finishGameOver)
      .catch(function () {
        clearTimeout(recoveryTimer);
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        enablePlayAgain("Score save timed out — you can still play again.");
      });
  }

  function resetMission(waveNum) {
    stage = STAGE_BATTLE;
    ties = [];
    bolts = [];
    tiesKilled = 0;
    tiesRequired = 10 + waveNum * 3;
    tieSpawnTimer = 0;
    enemyShotTimer = 0;
    approachTimer = 0;
    deathStarZ = 1700;
    surfaceTargets = [];
    surfaceKilled = 0;
    trenchProgress = 0;
    towers = [];
    towerSpawnTimer = 0;
    exhaustVisible = false;
    exhaustHit = false;
    explodeTimer = 0;
    killFlash = [];
    shield = 100;
    aimX = CX;
    aimY = CY;
    mouseTargetX = CX;
    mouseTargetY = CY;
    shipX = 0;
    shipY = 0;
    initStars();
  }

  function startMissionAfterReady(title, hint) {
    updateHud();
    beginReadyCountdown(title, hint);
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    if (phase === PHASE_DIED) {
      continueAfterDeath();
      return;
    }
    if (phase === PHASE_OVER) {
      showMenuOverlay();
      phase = PHASE_MENU;
      return;
    }
    resetDeathContinue();
    score = 0;
    lives = STARTING_LIVES;
    wave = 1;
    frame = 0;
    playerInvuln = 0;
    lifeBonusesClaimed = 0;
    bonusFlashTimer = 0;
    bonusFlashText = "";
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    resetMission(wave);
    startMissionAfterReady(
      "GET READY!",
      "Wave 1 — clear the TIE fighters, then attack the Death Star!"
    );
  }

  function nextMission() {
    wave++;
    resetMission(wave);
    startMissionAfterReady(
      "GET READY!",
      "Wave " + wave + " — tighter trench, faster fighters!"
    );
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    resetDeathContinue();
    phase = PHASE_MENU;
    running = false;
    ties = [];
    towers = [];
    bolts = [];
    showMessages([]);
    showMenuOverlay();
    SLArcade.endSession().catch(function () {});
  }

  function syncPlayerLine() {
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
    }
    if (e.key === "Escape" && phase !== PHASE_MENU && phase !== PHASE_OVER) {
      quitGame();
    }
    if (
      (e.key === "Enter" || e.key === " ") &&
      phase === PHASE_DIED &&
      !btnStart.disabled
    ) {
      e.preventDefault();
      continueAfterDeath();
    }
  });
  window.addEventListener("keyup", function (e) {
    keys[e.key] = false;
  });

  canvas.addEventListener("mousemove", onPointerMove);
  canvas.addEventListener("mousedown", onPointerDown);
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
  canvas.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches.length) {
        onPointerDown(e.touches[0]);
        e.preventDefault();
      }
    },
    { passive: false }
  );

  btnStart.addEventListener("click", startGame);
  btnStart.addEventListener("touchend", function (e) {
    e.preventDefault();
    startGame();
  });
  btnNext.addEventListener("click", nextMission);
  btnNext.addEventListener("touchend", function (e) {
    e.preventDefault();
    nextMission();
  });
  btnQuit.addEventListener("click", quitGame);
  btnQuit.addEventListener("touchend", function (e) {
    e.preventDefault();
    quitGame();
  });
  btnLeaderboard.addEventListener("click", openLeaderboardModal);
  btnLeaderboard.addEventListener("touchend", function (e) {
    e.preventDefault();
    openLeaderboardModal();
  });
  btnModalClose.addEventListener("click", closeLeaderboardModal);
  btnModalClose.addEventListener("touchend", function (e) {
    e.preventDefault();
    closeLeaderboardModal();
  });
  leaderboardModal.addEventListener("click", function (e) {
    if (e.target === leaderboardModal) {
      closeLeaderboardModal();
    }
  });

  window.addEventListener("message", function () {
    syncPlayerLine();
    refreshLeaderboard();
  });

  initStars();
  syncPlayerLine();
  refreshLeaderboard();
  showMenuOverlay();
  phase = PHASE_MENU;
  loop();
})();
