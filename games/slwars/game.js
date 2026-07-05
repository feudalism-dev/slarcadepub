(function () {
  "use strict";

  SLArcade.registerGameId("slwars");

  var canvas = document.getElementById("game");
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
  var FOV = 420;

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

  var WIRE_GREEN = "#5f8";
  var WIRE_CYAN = "#6ef";
  var WIRE_DIM = "#284";
  var WIRE_RED = "#f66";

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
  var lastShot = 0;
  var fireCooldown = 14;

  var stars = [];
  var ties = [];
  var tieSpawnTimer = 0;
  var tiesKilled = 0;
  var tiesRequired = 12;
  var enemyShotTimer = 0;

  var approachTimer = 0;
  var deathStarZ = 1800;

  var trenchProgress = 0;
  var trenchSpeed = 2.2;
  var trenchSway = 0;
  var towers = [];
  var towerSpawnTimer = 0;
  var exhaustVisible = false;
  var exhaustHit = false;

  var explodeTimer = 0;
  var explodeScale = 1;

  var laserFlash = 0;
  var hitFlash = 0;

  var TIE_EDGES = [
    [[0, 0, 8], [0, 0, -8]],
    [[-28, 0, 0], [28, 0, 0]],
    [[-28, 0, 0], [-28, 18, 0]],
    [[-28, 18, 0], [-8, 18, 0]],
    [[-8, 18, 0], [0, 8, 0]],
    [[0, 8, 0], [8, 18, 0]],
    [[8, 18, 0], [28, 18, 0]],
    [[28, 18, 0], [28, 0, 0]],
    [[-28, 0, 0], [-28, -18, 0]],
    [[-28, -18, 0], [-8, -18, 0]],
    [[-8, -18, 0], [0, -8, 0]],
    [[0, -8, 0], [8, -18, 0]],
    [[8, -18, 0], [28, -18, 0]],
    [[28, -18, 0], [28, 0, 0]],
    [[-12, 12, 0], [12, 12, 0]],
    [[12, 12, 0], [12, -12, 0]],
    [[12, -12, 0], [-12, -12, 0]],
    [[-12, -12, 0], [-12, 12, 0]],
  ];

  function initStars() {
    stars = [];
    var i;
    for (i = 0; i < 120; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1200,
        z: 80 + Math.random() * 2000,
        speed: 4 + Math.random() * 10,
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

  function drawLine3D(x1, y1, z1, x2, y2, z2, color, width) {
    var a = project(x1, y1, z1);
    var b = project(x2, y2, z2);
    if (!a || !b) {
      return;
    }
    if (a.z < 1 || b.z < 1) {
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function drawWireEdges(edges, ox, oy, oz, scale, color) {
    var i;
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      drawLine3D(
        ox + e[0][0] * scale,
        oy + e[0][1] * scale,
        oz + e[0][2] * scale,
        ox + e[1][0] * scale,
        oy + e[1][1] * scale,
        oz + e[1][2] * scale,
        color,
        1
      );
    }
  }

  function drawStars(speedMul) {
    var i;
    ctx.fillStyle = "#fff";
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z -= s.speed * speedMul;
      if (s.z < 1) {
        s.z = 1200 + Math.random() * 800;
        s.x = (Math.random() - 0.5) * 1600;
        s.y = (Math.random() - 0.5) * 1200;
      }
      var p = project(s.x, s.y, s.z);
      if (p) {
        var sz = Math.max(1, 3 - s.z / 600);
        ctx.globalAlpha = Math.min(1, 1.4 - s.z / 1200);
        ctx.fillRect(p.x, p.y, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDeathStar(z, color) {
    var r = 120;
    var segs = 12;
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
        drawLine3D(x1, y1, z + z1p, x2, y2, z + z2p, color, 1);
        drawLine3D(x2, y2, z + z2p, x3, y3, z + z3p, color, 1);
      }
    }
    drawLine3D(-40, 20, z + 100, 40, 20, z + 100, color, 2);
    drawLine3D(-40, 20, z + 100, 0, -30, z + 130, color, 2);
    drawLine3D(40, 20, z + 100, 0, -30, z + 130, color, 2);
    drawLine3D(0, -30, z + 130, 0, -30, z + 160, WIRE_RED, 2);
  }

  function spawnTie() {
    ties.push({
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 280,
      z: 900 + Math.random() * 700,
      vx: (Math.random() - 0.5) * 1.2,
      vy: Math.sin(frame * 0.05) * 0.4,
      speed: 3.5 + wave * 0.35,
      alive: true,
      scale: 1,
    });
  }

  function tieScreenPos(t) {
    return project(t.x, t.y, t.z);
  }

  function fireLaser() {
    if (frame - lastShot < fireCooldown) {
      return;
    }
    lastShot = frame;
    laserFlash = 8;

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
        var hitR = 28 + p.scale * 8;
        if (dx * dx + dy * dy < hitR * hitR && t.z < bestZ) {
          best = t;
          bestZ = t.z;
        }
      }
      if (best) {
        best.alive = false;
        tiesKilled++;
        score += 100 + wave * 10;
        hitFlash = 6;
        checkLifeBonuses();
        updateHud();
      }
      return;
    }

    if (stage === STAGE_TRENCH) {
      var j;
      for (j = 0; j < towers.length; j++) {
        var tw = towers[j];
        if (!tw.alive) {
          continue;
        }
        var tp = project(tw.x, tw.y, tw.z);
        if (!tp) {
          continue;
        }
        var tdx = tp.x - aimX;
        var tdy = tp.y - aimY;
        if (tdx * tdx + tdy * tdy < 900) {
          tw.alive = false;
          score += 250;
          hitFlash = 6;
          updateHud();
          return;
        }
      }
      if (exhaustVisible && !exhaustHit) {
        var ex = project(0, -20, 180 - trenchProgress * 0.15);
        if (ex) {
          var edx = ex.x - aimX;
          var edy = ex.y - aimY;
          if (edx * edx + edy * edy < 400) {
            exhaustHit = true;
            score += 5000 + wave * 500;
            hitFlash = 20;
            updateHud();
            beginExplosion();
          }
        }
      }
    }
  }

  function damagePlayer(amount) {
    if (playerInvuln > 0) {
      return;
    }
    shield -= amount;
    hitFlash = 10;
    playerInvuln = 45;
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

  function tryEnemyShot() {
    if (stage !== STAGE_BATTLE || ties.length === 0) {
      return;
    }
    var candidates = [];
    var i;
    for (i = 0; i < ties.length; i++) {
      if (ties[i].alive && ties[i].z < 700) {
        candidates.push(ties[i]);
      }
    }
    if (!candidates.length) {
      return;
    }
    var t = candidates[Math.floor(Math.random() * candidates.length)];
    var p = tieScreenPos(t);
    if (!p) {
      return;
    }
    var dx = aimX - p.x;
    var dy = aimY - p.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 35) {
      damagePlayer(20 + wave * 2);
    }
  }

  function updateBattle() {
    tieSpawnTimer++;
    var spawnInterval = Math.max(25, 55 - wave * 3);
    if (tieSpawnTimer >= spawnInterval && tiesKilled + aliveTies() < tiesRequired + 4) {
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
      t.x += t.vx;
      t.y += t.vy + Math.sin(frame * 0.04 + i) * 0.15;
      t.z -= t.speed;
      if (t.z < 30) {
        t.alive = false;
        damagePlayer(35);
      }
    }

    enemyShotTimer++;
    if (enemyShotTimer >= Math.max(40, 90 - wave * 4)) {
      enemyShotTimer = 0;
      tryEnemyShot();
    }

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
    deathStarZ = 1600;
    ties = [];
    instructionsEl.textContent = "";
  }

  function updateApproach() {
    approachTimer++;
    deathStarZ -= 6 + wave * 0.5;
    if (approachTimer > 200 || deathStarZ < 250) {
      beginTrench();
    }
  }

  function beginTrench() {
    stage = STAGE_TRENCH;
    trenchProgress = 0;
    towers = [];
    towerSpawnTimer = 0;
    exhaustVisible = false;
    exhaustHit = false;
    trenchSway = 0;
  }

  function spawnTower() {
    var side = Math.random() < 0.5 ? -1 : 1;
    towers.push({
      x: side * (120 + Math.random() * 80),
      y: (Math.random() - 0.5) * 60,
      z: 400 + Math.random() * 200,
      alive: true,
      fired: false,
    });
  }

  function updateTrench() {
    trenchProgress += trenchSpeed + wave * 0.15;
    trenchSway = Math.sin(frame * 0.03) * (8 + wave);

    var wallLimit = 140 - trenchProgress * 0.08 + Math.abs(trenchSway);
    if (Math.abs(aimX - CX) > wallLimit) {
      damagePlayer(2);
    }

    towerSpawnTimer++;
    if (towerSpawnTimer >= Math.max(35, 70 - wave * 3)) {
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
      tw.z -= trenchSpeed + 1;
      if (tw.z < 40 && !tw.fired) {
        tw.fired = true;
        var tp = project(tw.x, tw.y, tw.z);
        if (tp) {
          var dx = aimX - tp.x;
          var dy = aimY - tp.y;
          if (dx * dx + dy * dy < 1600) {
            damagePlayer(25);
          }
        }
      }
      if (tw.z < 0) {
        tw.alive = false;
      }
    }

    if (trenchProgress > 520) {
      exhaustVisible = true;
    }

    if (shield > 0 && shield < 100 && frame % 30 === 0) {
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
  }

  function updateExplosion() {
    explodeTimer++;
    explodeScale += 0.08;
    if (explodeTimer > 120) {
      showMissionComplete();
    }
  }

  function drawTie(t) {
    var col = t.alive ? WIRE_GREEN : WIRE_DIM;
    drawWireEdges(TIE_EDGES, t.x, t.y, t.z, t.scale, col);
  }

  function drawTowers() {
    var i;
    for (i = 0; i < towers.length; i++) {
      var tw = towers[i];
      if (!tw.alive) {
        continue;
      }
      var s = 18;
      drawLine3D(tw.x - s, tw.y, tw.z, tw.x + s, tw.y, tw.z, WIRE_RED, 2);
      drawLine3D(tw.x, tw.y - s, tw.z, tw.x, tw.y + s, tw.z, WIRE_RED, 2);
      drawLine3D(tw.x, tw.y, tw.z, tw.x, tw.y, tw.z + s * 2, WIRE_RED, 2);
      drawLine3D(tw.x - s, tw.y, tw.z + s, tw.x + s, tw.y, tw.z + s, WIRE_CYAN, 1);
    }
  }

  function drawTrench() {
    var prog = trenchProgress;
    var vanY = CY - 40;
    var spread = 280 - prog * 0.15;
    var sway = trenchSway;

    ctx.strokeStyle = WIRE_GREEN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(CX + sway - spread * 0.35, vanY);
    ctx.moveTo(W, H);
    ctx.lineTo(CX + sway + spread * 0.35, vanY);
    ctx.stroke();

    ctx.strokeStyle = WIRE_DIM;
    ctx.lineWidth = 1;
    var i;
    for (i = 0; i < 14; i++) {
      var t = ((i * 47 + prog * 2) % 400) / 400;
      var y = H - t * (H - vanY);
      var half = spread * 0.35 * (1 - t) + 20;
      ctx.beginPath();
      ctx.moveTo(CX + sway - half, y);
      ctx.lineTo(CX + sway + half, y);
      ctx.stroke();
    }

    if (exhaustVisible && !exhaustHit) {
      var ex = project(0, -20, 180 - prog * 0.15);
      if (ex) {
        ctx.strokeStyle = WIRE_RED;
        ctx.lineWidth = 2;
        var r = 14 + Math.sin(frame * 0.2) * 3;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ex.x - r, ex.y);
        ctx.lineTo(ex.x + r, ex.y);
        ctx.moveTo(ex.x, ex.y - r);
        ctx.lineTo(ex.x, ex.y + r);
        ctx.stroke();
      }
    }
  }

  function drawCockpit() {
    ctx.strokeStyle = WIRE_DIM;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W * 0.22, H * 0.72);
    ctx.lineTo(W * 0.78, H * 0.72);
    ctx.lineTo(W, H);
    ctx.stroke();

    ctx.strokeStyle = WIRE_GREEN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.22, H * 0.72);
    ctx.lineTo(W * 0.78, H * 0.72);
    ctx.stroke();
  }

  function drawCrosshair() {
    ctx.strokeStyle = WIRE_CYAN;
    ctx.lineWidth = 1;
    var r = 14;
    ctx.beginPath();
    ctx.arc(aimX, aimY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aimX - r - 6, aimY);
    ctx.lineTo(aimX - 4, aimY);
    ctx.moveTo(aimX + 4, aimY);
    ctx.lineTo(aimX + r + 6, aimY);
    ctx.moveTo(aimX, aimY - r - 6);
    ctx.lineTo(aimX, aimY - 4);
    ctx.moveTo(aimX, aimY + 4);
    ctx.lineTo(aimX, aimY + r + 6);
    ctx.stroke();
  }

  function drawLaserBeam() {
    if (laserFlash <= 0) {
      return;
    }
    laserFlash--;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX, H - 20);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
  }

  function drawStageLabel() {
    var label = "";
    if (stage === STAGE_BATTLE) {
      label = "TIE FIGHTERS — " + tiesKilled + "/" + tiesRequired;
    } else if (stage === STAGE_APPROACH) {
      label = "DEATH STAR APPROACH";
    } else if (stage === STAGE_TRENCH) {
      label = "TRENCH RUN";
    } else if (stage === STAGE_EXPLODE) {
      label = "IMPACT!";
    }
    ctx.fillStyle = WIRE_CYAN;
    ctx.font = "14px monospace";
    ctx.fillText(label, 12, H - 14);
  }

  function drawExplosion() {
    drawStars(3);
    var r = 80 * explodeScale;
    ctx.strokeStyle = WIRE_RED;
    ctx.lineWidth = 2;
    var i;
    for (i = 0; i < 16; i++) {
      var a = (i / 16) * Math.PI * 2 + explodeTimer * 0.05;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.strokeStyle = WIRE_GREEN;
    ctx.beginPath();
    ctx.arc(CX, CY, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
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

    drawStars(stage === STAGE_APPROACH ? 2.5 : 1.2);

    if (stage === STAGE_BATTLE) {
      var i;
      for (i = 0; i < ties.length; i++) {
        if (ties[i].alive) {
          drawTie(ties[i]);
        }
      }
    } else if (stage === STAGE_APPROACH) {
      drawDeathStar(deathStarZ, WIRE_GREEN);
    } else if (stage === STAGE_TRENCH) {
      drawTrench();
      drawTowers();
    }

    drawCockpit();
    drawCrosshair();
    drawLaserBeam();
    drawStageLabel();

    if (hitFlash > 0) {
      hitFlash--;
      ctx.fillStyle = "rgba(255, 80, 80, 0.25)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function updateAim() {
    var speed = 5.5;
    if (keys.ArrowLeft || keys.a || keys.A) {
      aimX -= speed;
    }
    if (keys.ArrowRight || keys.d || keys.D) {
      aimX += speed;
    }
    if (keys.ArrowUp || keys.w || keys.W) {
      aimY -= speed;
    }
    if (keys.ArrowDown || keys.s || keys.S) {
      aimY += speed;
    }
    if (aimX < 40) {
      aimX = 40;
    }
    if (aimX > W - 40) {
      aimX = W - 40;
    }
    if (aimY < 40) {
      aimY = 40;
    }
    if (aimY > H - 80) {
      aimY = H - 80;
    }
    if (keys[" "] || keys.Spacebar) {
      fireLaser();
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

    updateAim();

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
      ". Mission continues from the last stage.";
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
    beginReadyCountdown(
      "GET READY!",
      stageLabelHint() + " — stay on target!"
    );
    readyTimer = RESPAWN_FRAMES;
  }

  function stageLabelHint() {
    if (stage === STAGE_BATTLE) {
      return "TIE fighter engagement";
    }
    if (stage === STAGE_APPROACH) {
      return "Death Star approach";
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
      "Vector wireframe battle. Clear the TIE fighters, survive the trench, and fire into the exhaust port.";
    endHintEl.textContent = "";
    btnStart.disabled = false;
    btnStart.textContent = "START";
    setOverlayButtons(true, false);
    setStartScreenExtras(true);
    setQuitVisible(false);
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
  }

  function showMissionComplete() {
    phase = PHASE_LEVEL;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "DEATH STAR DESTROYED!";
    instructionsEl.textContent =
      "Great shot! Score: " + score + " — the Empire will send reinforcements.";
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
    tiesKilled = 0;
    tiesRequired = 10 + waveNum * 3;
    tieSpawnTimer = 0;
    enemyShotTimer = 0;
    approachTimer = 0;
    deathStarZ = 1600;
    trenchProgress = 0;
    towers = [];
    towerSpawnTimer = 0;
    exhaustVisible = false;
    exhaustHit = false;
    explodeTimer = 0;
    shield = 100;
    aimX = CX;
    aimY = CY;
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
      "Wave 1 — destroy TIE fighters, then attack the Death Star!"
    );
  }

  function nextMission() {
    wave++;
    resetMission(wave);
    startMissionAfterReady(
      "GET READY!",
      "Wave " + wave + " — faster fighters, tighter trench!"
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
