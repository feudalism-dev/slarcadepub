(function () {
  "use strict";

  SLArcade.registerGameId("slwars");

  var canvas = document.getElementById("game");
  var gameWrap = document.getElementById("game-wrap");
  var displayCtx = canvas.getContext("2d");
  displayCtx.imageSmoothingEnabled = false;
  var worldCanvas = document.createElement("canvas");
  worldCanvas.width = canvas.width;
  worldCanvas.height = canvas.height;
  var ctx = worldCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var btnStart = document.getElementById("btn-start");
  var btnNext = document.getElementById("btn-next");
  var btnQuit = document.getElementById("btn-quit");
  var btnLeaderboard = document.getElementById("btn-leaderboard");
  var btnModalClose = document.getElementById("btn-modal-close");
  var hud = document.getElementById("hud");
  var shieldFill = document.getElementById("shield-fill");
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
  var STAGE_SURFACE = "surface";
  var STAGE_TRENCH = "trench";
  var STAGE_EXPLODE = "explode";

  var READY_SEC = 2;
  var RESPAWN_SEC = 1.5;
  var STARTING_LIVES = 3;
  var LIFE_BONUS_SCORES = [3000, 8000, 15000];
  var CONTINUE_TIMEOUT_MS = 30000;

  var WIRE_GREEN = "#6f6";
  var WIRE_CYAN = "#7ef";
  var WIRE_DIM = "#264";
  var WIRE_RED = "#f55";
  var WIRE_YELLOW = "#fd6";
  var WIRE_MAGENTA = "#f6f";
  var WIRE_PINK = "#f8a";
  var WIRE_WHITE = "#fff";
  var WIRE_BLUE = "#68f";

  var keys = {};
  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var lives = 3;
  var wave = 1;
  var frame = 0;
  var gameTime = 0;
  var dt = 1 / 60;
  var lastFrameTime = 0;
  var readyTimer = 0;
  var playerInvuln = 0;
  var lifeBonusesClaimed = 0;
  var bonusFlashTimer = 0;
  var bonusFlashText = "";
  var continueDeadline = 0;
  var continueTimerId = null;
  var lastLeaderboardData = null;

  var stage = STAGE_BATTLE;
  var MAX_SHIELD = 6;
  var shieldSegments = 6;
  var shield = 100;
  var aimX = CX;
  var aimY = CY;
  var mouseTargetX = CX;
  var mouseTargetY = CY;
  var shipX = 0;
  var shipY = 0;
  var lastShot = 0;
  var fireCooldownMs = 110;

  var particles = [];
  var floatTexts = [];
  var shakeAmount = 0;
  var shakeX = 0;
  var shakeY = 0;
  var audioCtx = null;
  var audioReady = false;

  var stars = [];
  var ties = [];
  var bolts = [];
  var tieSpawnAcc = 0;
  var enemyShotAcc = 0;
  var towerSpawnAcc = 0;

  var approachTimer = 0;
  var surfaceKilled = 0;

  var TIE_EDGES = [
    [[0, 0, 12], [0, 0, -12]],
    [[-8, -8, 0], [8, 8, 0], [-8, 8, 0], [8, -8, 0], [-8, -8, 0]],
    [[-36, 0, 0], [36, 0, 0]],
    [[-36, 0, 0], [-36, 22, 0], [-12, 22, 0], [0, 12, 0]],
    [[0, 12, 0], [12, 22, 0], [36, 22, 0], [36, 0, 0]],
    [[-36, 0, 0], [-36, -22, 0], [-12, -22, 0], [0, -12, 0]],
    [[0, -12, 0], [12, -22, 0], [36, -22, 0], [36, 0, 0]],
    [[-16, 16, 0], [16, 16, 0], [16, -16, 0], [-16, -16, 0], [-16, 16, 0]],
    [[-20, 0, 6], [20, 0, 6], [20, 0, -6], [-20, 0, -6], [-20, 0, 6]],
  ];
  var trenchSpeed = 2.8;
  var towers = [];
  var exhaustVisible = false;
  var exhaustHit = false;
  var trenchRoll = 0;

  var explodeTimer = 0;
  var explodeScale = 1;
  var laserFlash = 0;
  var hitFlash = 0;
  var killFlash = [];
  var starbursts = [];
  var shipBank = 0;
  var hudHint = "";

  var surfaceTowers = [];
  var towersRemaining = 0;
  var surfaceScroll = 0;
  var surfaceTowerAcc = 0;
  var deathStarZ = 2200;

  var barricades = [];
  var barricadeAcc = 0;
  var trenchProgress = 0;
  var battleTimer = 0;
  var battleDuration = 42;
  var debris = [];
  var trenchShotsFired = 0;
  var surfaceHazards = [];
  var exhaustMissHandled = false;

  function setGameActive(active) {
    gameWrap.classList.toggle("game-active", !!active);
  }

  function ensureAudio() {
    if (audioReady) {
      return;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        return;
      }
      audioCtx = new AC();
      audioReady = true;
    } catch (e) {
      audioReady = false;
    }
  }

  function playTone(freq, dur, type, vol) {
    if (!audioCtx || !audioReady) {
      return;
    }
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.04;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    var t = audioCtx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  }

  function playLaserSound() {
    playTone(880, 0.06, "square", 0.035);
    playTone(440, 0.08, "sawtooth", 0.02);
  }

  function playHitSound() {
    playTone(120, 0.15, "sawtooth", 0.05);
  }

  function playKillSound() {
    playTone(660, 0.05, "square", 0.04);
    playTone(990, 0.08, "square", 0.03);
  }

  function playExplosionSound() {
    playTone(80, 0.35, "sawtooth", 0.06);
    playTone(40, 0.5, "square", 0.04);
  }

  function addShake(amount) {
    shakeAmount = Math.min(shakeAmount + amount, 16);
  }

  function spawnParticles(x, y, color, count, speed) {
    var i;
    for (i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.25 + Math.random() * 0.45,
        maxLife: 0.7,
        color: color,
        size: 1 + Math.random() * 2,
      });
    }
  }

  function spawnFloatText(x, y, text, color) {
    floatTexts.push({
      x: x,
      y: y,
      text: text,
      color: color || WIRE_YELLOW,
      life: 1.2,
    });
  }

  function updateParticles() {
    var i;
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (i = floatTexts.length - 1; i >= 0; i--) {
      var ft = floatTexts[i];
      ft.life -= dt;
      ft.y -= dt * 28;
      if (ft.life <= 0) {
        floatTexts.splice(i, 1);
      }
    }
    if (shakeAmount > 0) {
      shakeAmount -= dt * 22;
      if (shakeAmount < 0) {
        shakeAmount = 0;
      }
      shakeX = (Math.random() - 0.5) * shakeAmount;
      shakeY = (Math.random() - 0.5) * shakeAmount;
    } else {
      shakeX = 0;
      shakeY = 0;
    }
  }

  function drawParticles() {
    var i;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = "bold 13px Consolas, monospace";
    ctx.textAlign = "center";
    for (i = 0; i < floatTexts.length; i++) {
      var ft = floatTexts[i];
      ctx.globalAlpha = Math.min(1, ft.life);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function compositeToDisplay() {
    displayCtx.fillStyle = "#000";
    displayCtx.fillRect(0, 0, W, H);
    displayCtx.save();
    displayCtx.globalAlpha = 0.5;
    displayCtx.filter = "blur(3px)";
    displayCtx.drawImage(worldCanvas, shakeX, shakeY);
    displayCtx.restore();
    displayCtx.globalAlpha = 1;
    displayCtx.filter = "none";
    displayCtx.drawImage(worldCanvas, shakeX, shakeY);
    if (hitFlash > 0) {
      displayCtx.fillStyle = "rgba(255, 60, 60, " + hitFlash * 0.025 + ")";
      displayCtx.fillRect(0, 0, W, H);
    }
  }

  function dtScale(speedPerFrame) {
    return speedPerFrame * dt * 60;
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

  function fillPoly2D(pts, fill, stroke, width, glow) {
    if (pts.length < 3) {
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    var i;
    for (i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      strokeGlow(stroke, width || 1, glow || 4);
      ctx.stroke();
      clearGlow();
    }
  }

  function spawnDebris(wx, wy, wz, scale, color) {
    var i;
    for (i = 0; i < 8; i++) {
      debris.push({
        x: wx + (Math.random() - 0.5) * 20,
        y: wy + (Math.random() - 0.5) * 20,
        z: wz + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        vz: -2 - Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        scale: scale * (0.25 + Math.random() * 0.35),
        life: 0.9 + Math.random() * 0.5,
        maxLife: 1.4,
        color: color || WIRE_GREEN,
      });
    }
  }

  function updateDebris() {
    var i;
    var spd = dt * 60;
    for (i = debris.length - 1; i >= 0; i--) {
      var d = debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        debris.splice(i, 1);
        continue;
      }
      d.x += d.vx * spd;
      d.y += d.vy * spd;
      d.z += d.vz * spd;
      d.rot += d.vr * spd;
    }
  }

  function drawDebris() {
    var i;
    for (i = 0; i < debris.length; i++) {
      var d = debris[i];
      var a = d.life / d.maxLife;
      drawWireEdges(TIE_EDGES, d.x, d.y, d.z, d.scale * a, d.color, 6 * a);
    }
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
      s.z -= s.speed * speedMul * dt * 60;
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
    var center = project(0, 0, z);
    if (center && center.z > 1) {
      var rad = r * center.scale;
      var grd = ctx.createRadialGradient(center.x, center.y, rad * 0.1, center.x, center.y, rad);
      grd.addColorStop(0, "rgba(30, 50, 30, 0.85)");
      grd.addColorStop(0.7, "rgba(12, 28, 12, 0.55)");
      grd.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(center.x, center.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
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
      isVader: false,
    };
    if (Math.random() < 0.07 + wave * 0.012) {
      t.isVader = true;
      t.scale = 1.2;
      t.speed = 3.2 + wave * 0.25;
    }
    if (pattern === 1) {
      t.x = (Math.random() < 0.5 ? -1 : 1) * (280 + Math.random() * 120);
      t.vx = -t.x * 0.002;
    }
    ties.push(t);
  }

  function spawnStarburst(x, y, size) {
    var colors = [WIRE_WHITE, WIRE_YELLOW, WIRE_CYAN, WIRE_MAGENTA, WIRE_PINK, WIRE_RED];
    var rays = 14 + Math.floor(Math.random() * 6);
    var i;
    var pts = [];
    for (i = 0; i < rays; i++) {
      var a = (i / rays) * Math.PI * 2 + Math.random() * 0.2;
      var len = size * (0.6 + Math.random() * 0.7);
      pts.push({
        ax: x,
        ay: y,
        bx: x + Math.cos(a) * len,
        by: y + Math.sin(a) * len,
        color: colors[i % colors.length],
      });
    }
    starbursts.push({ pts: pts, life: 0.55, maxLife: 0.55 });
  }

  function updateStarbursts() {
    var i;
    for (i = starbursts.length - 1; i >= 0; i--) {
      starbursts[i].life -= dt;
      if (starbursts[i].life <= 0) {
        starbursts.splice(i, 1);
      }
    }
  }

  function drawStarbursts() {
    var i;
    var j;
    for (i = 0; i < starbursts.length; i++) {
      var sb = starbursts[i];
      var a = sb.life / sb.maxLife;
      for (j = 0; j < sb.pts.length; j++) {
        var p = sb.pts[j];
        strokeGlow(p.color, 2, 12 * a);
        ctx.beginPath();
        ctx.moveTo(p.ax, p.ay);
        ctx.lineTo(p.ax + (p.bx - p.ax) * a, p.ay + (p.by - p.ay) * a);
        ctx.stroke();
      }
      clearGlow();
    }
  }

  function projectGround(x, y, z) {
    if (z < 30) {
      return null;
    }
    var scale = FOV / z;
    var horizon = H * 0.36;
    return {
      x: CX + (x + shipBank * z * 0.06) * scale,
      y: horizon + (100 - y) * scale * 0.52,
      z: z,
      scale: scale,
    };
  }

  function spawnSurfaceTower() {
    var pts = towersRemaining > 3 ? 200 : 800;
    surfaceTowers.push({
      x: (Math.random() - 0.5) * 420,
      z: 750 + Math.random() * 350,
      h: 50 + Math.random() * 40,
      alive: true,
      fired: false,
      points: pts,
    });
  }

  function drawGroundGrid() {
    var horizon = H * 0.36;
    strokeGlow(WIRE_DIM, 1, 2);
    var i;
    for (i = 0; i < 8; i++) {
      var t = ((i * 90 + surfaceScroll * 2) % 600) / 600;
      var y = horizon + t * (H - horizon - 80);
      var spread = 80 + t * (W * 0.45);
      ctx.beginPath();
      ctx.moveTo(CX - spread + shipBank * 40, y);
      ctx.lineTo(CX + spread + shipBank * 40, y);
      ctx.stroke();
    }
    clearGlow();
  }

  function drawGroundTower(tw) {
    if (!tw.alive) {
      return;
    }
    var p = projectGround(tw.x, 0, tw.z);
    if (!p) {
      return;
    }
    var hw = 22 * p.scale;
    var hh = (tw.h + 30) * p.scale;
    var x = p.x;
    var y = p.y;
    ctx.fillStyle = "rgba(180, 150, 40, 0.35)";
    ctx.fillRect(x - hw, y - hh, hw * 2, hh);
    ctx.fillStyle = "rgba(80, 70, 20, 0.5)";
    ctx.fillRect(x - hw * 0.55, y - hh, hw * 1.1, hh * 0.35);
    strokeGlow(WIRE_YELLOW, 2, 10);
    ctx.strokeRect(x - hw, y - hh, hw * 2, hh);
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x + hw, y);
    ctx.stroke();
    strokeGlow(WIRE_WHITE, 1, 6);
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.6, y - hh);
    ctx.lineTo(x + hw * 0.6, y - hh);
    ctx.stroke();
    clearGlow();
  }

  function drawGroundHazard(hz) {
    var p = projectGround(hz.x, 0, hz.z);
    if (!p) {
      return;
    }
    var s = 18 * p.scale;
    strokeGlow(WIRE_RED, 1, 6);
    ctx.beginPath();
    ctx.moveTo(p.x - s, p.y);
    ctx.lineTo(p.x, p.y - s * 0.5);
    ctx.lineTo(p.x + s, p.y);
    ctx.closePath();
    ctx.stroke();
    clearGlow();
  }

  function spawnBarricade() {
    var lanes = [-1, 0, 1];
    var lane = lanes[Math.floor(Math.random() * lanes.length)];
    var colors = [WIRE_PINK, WIRE_YELLOW, WIRE_CYAN];
    barricades.push({
      z: 480 + Math.random() * 120,
      lane: lane,
      color: colors[Math.floor(Math.random() * colors.length)],
      alive: true,
      passed: false,
    });
  }

  function drawBarricade(b) {
    if (!b.alive) {
      return;
    }
    var p = project(b.lane * 70 + shipX, b.lane * 35, b.z);
    if (!p) {
      return;
    }
    var w = 90 * p.scale;
    var h = 50 * p.scale;
    ctx.fillStyle = b.color === WIRE_PINK ? "rgba(255,120,200,0.22)" : b.color === WIRE_YELLOW ? "rgba(255,200,60,0.2)" : "rgba(80,220,255,0.18)";
    ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
    strokeGlow(b.color, 2, 10);
    ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
    clearGlow();
  }

  function drawArcadeHud() {
    ctx.font = "bold 14px Consolas, monospace";
    ctx.fillStyle = WIRE_GREEN;
    ctx.fillText("SCORE", 14, 18);
    ctx.font = "16px Consolas, monospace";
    ctx.fillText(String(score), 14, 36);

    ctx.font = "bold 13px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText("SHIELD", CX, 16);
    var segs = shieldSegments;
    if (segs <= 0) {
      ctx.fillStyle = WIRE_RED;
      ctx.fillText("SHIELD GONE", CX, 34);
    } else {
      ctx.fillStyle = WIRE_GREEN;
      ctx.fillText(String(segs), CX, 34);
      strokeGlow(WIRE_YELLOW, 1, 4);
      ctx.beginPath();
      ctx.moveTo(CX - 50, 42);
      ctx.lineTo(CX + 50, 42);
      ctx.lineTo(CX + 38, 52);
      ctx.lineTo(CX - 38, 52);
      ctx.closePath();
      ctx.stroke();
      clearGlow();
      var i;
      for (i = 0; i < MAX_SHIELD; i++) {
        var sx = CX - 42 + i * 12;
        ctx.fillStyle = i < segs ? WIRE_YELLOW : WIRE_DIM;
        ctx.fillRect(sx, 44, 8, 6);
      }
    }

    ctx.textAlign = "right";
    ctx.fillStyle = WIRE_GREEN;
    ctx.fillText(String(wave) + " WAVE", W - 14, 18);
    if (stage === STAGE_SURFACE) {
      ctx.fillStyle = WIRE_RED;
      ctx.fillText("TOWERS " + towersRemaining, W - 14, 36);
    } else if (stage === STAGE_BATTLE) {
      var left = Math.max(0, Math.ceil(battleDuration - battleTimer));
      ctx.fillText("TIME " + left, W - 14, 36);
    } else if (stage === STAGE_TRENCH && exhaustVisible) {
      ctx.fillStyle = WIRE_RED;
      ctx.fillText("EXHAUST PORT", W - 14, 36);
    }

    ctx.textAlign = "center";
    if (hudHint) {
      ctx.fillStyle = WIRE_GREEN;
      ctx.fillText(hudHint, CX, 68);
    }
    ctx.textAlign = "left";
  }

  function tieScreenPos(t) {
    return project(t.x, t.y, t.z);
  }

  function screenHitRadius(base, p) {
    return base + (p ? p.scale * 12 : 0);
  }

  function fireLaser() {
    var now = performance.now();
    if (now - lastShot < fireCooldownMs) {
      return;
    }
    lastShot = now;
    laserFlash = 0.12;
    playLaserSound();

    var bi;
    for (bi = bolts.length - 1; bi >= 0; bi--) {
      var bolt = bolts[bi];
      var bdx = bolt.sx - aimX;
      var bdy = bolt.sy - aimY;
      if (bdx * bdx + bdy * bdy < 625) {
        bolts.splice(bi, 1);
        score += 50 + wave * 5;
        spawnStarburst(bolt.sx, bolt.sy, 14);
        spawnFloatText(bolt.sx, bolt.sy - 12, "+50", WIRE_CYAN);
        playKillSound();
        updateHud();
        return;
      }
    }

    if (stage === STAGE_TRENCH) {
      trenchShotsFired++;
    }

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
        var pts = best.isVader ? 2000 + wave * 200 : 100 + wave * 15;
        score += pts;
        hitFlash = 0.15;
        var tp = tieScreenPos(best);
        spawnStarburst(tp ? tp.x : aimX, tp ? tp.y : aimY, 28 + (tp ? tp.scale * 20 : 0));
        spawnDebris(best.x, best.y, best.z, best.scale, best.isVader ? WIRE_CYAN : WIRE_GREEN);
        spawnFloatText(aimX, aimY - 20, best.isVader ? "VADER +" + pts : "+" + pts, best.isVader ? WIRE_CYAN : WIRE_YELLOW);
        playKillSound();
        addShake(best.isVader ? 8 : 3);
        checkLifeBonuses();
        updateHud();
      }
      return;
    }

    if (stage === STAGE_SURFACE) {
      var j;
      for (j = 0; j < surfaceTowers.length; j++) {
        var gt = surfaceTowers[j];
        if (!gt.alive) {
          continue;
        }
        var gp = projectGround(gt.x, gt.h * 0.5, gt.z);
        if (!gp) {
          continue;
        }
        var gdx = gp.x - aimX;
        var gdy = gp.y - aimY;
        var gw = 26 * gp.scale;
        if (gdx * gdx + gdy * gdy < gw * gw) {
          gt.alive = false;
          surfaceKilled++;
          if (towersRemaining > 0) {
            towersRemaining--;
          }
          score += gt.points;
          hitFlash = 0.15;
          spawnStarburst(gp.x, gp.y - gw, 32);
          spawnDebris(gt.x, gt.h * 0.5, gt.z, 0.8, WIRE_YELLOW);
          spawnFloatText(gp.x, gp.y - 30, "+" + gt.points, WIRE_YELLOW);
          hudHint = gt.points >= 800 ? "800 POINTS NEXT TOWER" : "200 POINTS NEXT TOWER";
          playKillSound();
          addShake(4);
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
          hitFlash = 0.12;
          spawnStarburst(tp.x, tp.y, 24);
          playKillSound();
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
            var basePts = 5000 + wave * 500;
            score += basePts;
            if (trenchShotsFired <= 1) {
              score += 10000;
              spawnFloatText(aimX, aimY - 50, "USE THE FORCE!", WIRE_CYAN);
            }
            hitFlash = 0.5;
            spawnParticles(aimX, aimY, WIRE_RED, 40, 8);
            spawnStarburst(ex.x, ex.y, 40);
            spawnFloatText(aimX, aimY - 30, "BULLSEYE!", WIRE_RED);
            playExplosionSound();
            addShake(14);
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
      life: 1.4,
      mag: true,
    });
  }

  function spawnMagentaBolt(sx, sy) {
    var dx = aimX - sx;
    var dy = aimY - sy;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var spd = 4.5 + wave * 0.25;
    bolts.push({
      sx: sx,
      sy: sy,
      vx: (dx / len) * spd,
      vy: (dy / len) * spd,
      life: 1.6,
      mag: true,
    });
  }

  function damagePlayer(amount) {
    if (playerInvuln > 0) {
      return;
    }
    shieldSegments--;
    shield = (shieldSegments / MAX_SHIELD) * 100;
    hitFlash = 0.2;
    playerInvuln = 1.2;
    playHitSound();
    addShake(6);
    spawnParticles(aimX, aimY, WIRE_RED, 8, 5);
    if (shieldSegments <= 0) {
      shieldSegments = MAX_SHIELD;
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
      b.sx += b.vx * dt * 60;
      b.sy += b.vy * dt * 60;
      b.life -= dt;
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
    battleTimer += dt;
    tieSpawnAcc += dt;
    var spawnInterval = Math.max(0.35, 0.85 - wave * 0.04);
    if (tieSpawnAcc >= spawnInterval && aliveTies() < 8 + wave) {
      tieSpawnAcc = 0;
      spawnTie();
    }

    var i;
    for (i = ties.length - 1; i >= 0; i--) {
      var t = ties[i];
      if (!t.alive) {
        ties.splice(i, 1);
        continue;
      }
      var spd = dt * 60;
      if (t.pattern === 1) {
        t.x += t.vx * 2 * spd;
        t.y += Math.sin(gameTime * 3.6 + t.phase) * 2.2 * spd;
      } else if (t.pattern === 2) {
        t.x += Math.sin(gameTime * 3 + t.phase) * 2.5 * spd;
        t.y += Math.cos(gameTime * 2.4 + t.phase) * 1.8 * spd;
      } else {
        t.x += t.vx * spd;
        t.y += Math.sin(gameTime * 2.4 + t.phase) * 0.8 * spd;
      }
      t.z -= t.speed * spd;
      if (t.z < 25) {
        t.alive = false;
        damagePlayer(40);
      }
    }

    enemyShotAcc += dt;
    if (enemyShotAcc >= Math.max(0.35, 0.8 - wave * 0.05)) {
      enemyShotAcc = 0;
      tryEnemyShot();
    }

    updateBolts();

    if (battleTimer >= battleDuration) {
      if (wave <= 1) {
        beginTrench();
        hudHint = "WAVE 1 — STRAIGHT TO THE TRENCH!";
      } else {
        beginSurface();
      }
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

  function spawnSurfaceHazard() {
    surfaceHazards.push({
      x: (Math.random() - 0.5) * 500,
      z: 700 + Math.random() * 400,
      alive: true,
    });
  }

  function beginSurface() {
    stage = STAGE_SURFACE;
    approachTimer = 0;
    surfaceScroll = 0;
    surfaceKilled = 0;
    surfaceTowers = [];
    surfaceTowerAcc = 0;
    surfaceHazards = [];
    bolts = [];
    ties = [];
    deathStarZ = 2400;
    towersRemaining = 10 + wave * 3;
    hudHint = "200 POINTS NEXT TOWER";
    var i;
    for (i = 0; i < 5; i++) {
      spawnSurfaceTower();
    }
    for (i = 0; i < 4; i++) {
      spawnSurfaceHazard();
    }
  }

  function updateSurface() {
    approachTimer += dt * 60;
    surfaceScroll += dtScale(5 + wave * 0.4);
    shipBank = (aimX - CX) / CX;
    deathStarZ -= dtScale(3);

    surfaceTowerAcc += dt;
    if (surfaceTowerAcc >= Math.max(0.5, 1.2 - wave * 0.05)) {
      surfaceTowerAcc = 0;
      if (towersRemaining > 0 && surfaceTowers.length < 6) {
        spawnSurfaceTower();
      }
    }
    if (Math.random() < 0.02 * dt * 60) {
      spawnSurfaceHazard();
    }

    var i;
    var spd = dt * 60;
    for (i = surfaceHazards.length - 1; i >= 0; i--) {
      var hz = surfaceHazards[i];
      if (!hz.alive) {
        surfaceHazards.splice(i, 1);
        continue;
      }
      hz.z -= (5 + wave * 0.3) * spd;
      if (hz.z < 80) {
        var hp = projectGround(hz.x, 0, hz.z);
        if (hp) {
          var hdx = hp.x - aimX;
          var hdy = hp.y - aimY;
          if (hdx * hdx + hdy * hdy < 900) {
            damagePlayer(1);
          }
        }
      }
      if (hz.z < 10) {
        hz.alive = false;
      }
    }

    for (i = surfaceTowers.length - 1; i >= 0; i--) {
      var gt = surfaceTowers[i];
      if (!gt.alive) {
        surfaceTowers.splice(i, 1);
        continue;
      }
      gt.z -= (4.5 + wave * 0.35) * spd;
      if (gt.z < 120 && !gt.fired) {
        gt.fired = true;
        var gp = projectGround(gt.x, gt.h, gt.z);
        if (gp) {
          spawnMagentaBolt(gp.x, gp.y - 20 * gp.scale);
        }
      }
      if (gt.z < 20) {
        gt.alive = false;
        damagePlayer(15);
      }
    }

    updateBolts();

    if (towersRemaining <= 0 && surfaceTowers.length === 0) {
      beginTrench();
    }
  }

  function beginTrench() {
    stage = STAGE_TRENCH;
    trenchProgress = 0;
    towers = [];
    towerSpawnAcc = 0;
    exhaustVisible = false;
    exhaustHit = false;
    shipX = 0;
    shipY = 0;
    bolts = [];
    barricades = [];
    barricadeAcc = 0;
    trenchShotsFired = 0;
    exhaustMissHandled = false;
    hudHint = "FLY OVER / UNDER BARRICADES";
  }

  function retryTrench() {
    trenchProgress = 0;
    towers = [];
    towerSpawnAcc = 0;
    exhaustVisible = false;
    exhaustHit = false;
    exhaustMissHandled = false;
    bolts = [];
    barricades = [];
    barricadeAcc = 0;
    trenchShotsFired = 0;
    hudHint = "MISSED PORT — RETRY TRENCH";
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
    trenchProgress += dtScale(trenchSpeed + wave * 0.2);
    trenchRoll += dtScale(trenchSpeed * 0.8);

    var wallLimit = 95 - trenchProgress * 0.04;
    if (Math.abs(shipX) > wallLimit) {
      damagePlayer(35 * dt);
    }

    towerSpawnAcc += dt;
    if (towerSpawnAcc >= Math.max(0.3, 0.65 - wave * 0.04)) {
      towerSpawnAcc = 0;
      spawnTower();
    }

    barricadeAcc += dt;
    if (barricadeAcc >= Math.max(0.45, 0.9 - wave * 0.03)) {
      barricadeAcc = 0;
      spawnBarricade();
    }

    var i;
    var spd = dt * 60;
    for (i = barricades.length - 1; i >= 0; i--) {
      var b = barricades[i];
      if (!b.alive) {
        barricades.splice(i, 1);
        continue;
      }
      b.z -= (trenchSpeed + 1.5) * spd;
      if (b.z < 70 && !b.passed) {
        b.passed = true;
        var bp = project(b.lane * 70 + shipX, b.lane * 35, b.z);
        var targetY = bp ? bp.y : CY + b.lane * 40;
        if (Math.abs(aimY - targetY) < 42) {
          damagePlayer(28);
          spawnStarburst(aimX, aimY, 20);
        } else {
          score += 75;
          spawnFloatText(aimX, aimY - 16, "+75", WIRE_CYAN);
        }
      }
      if (b.z < 0) {
        b.alive = false;
      }
    }

    for (i = towers.length - 1; i >= 0; i--) {
      var tw = towers[i];
      if (!tw.alive) {
        towers.splice(i, 1);
        continue;
      }
      tw.z -= (trenchSpeed + 1.2) * spd;
      if (tw.z < 50 && !tw.fired) {
        tw.fired = true;
        spawnBolt(tw.x + shipX, tw.y + shipY, tw.z);
      }
      if (tw.z < 0) {
        tw.alive = false;
      }
    }

    updateBolts();

    if (trenchProgress > 560 && exhaustVisible && !exhaustHit && !exhaustMissHandled) {
      exhaustMissHandled = true;
      damagePlayer(1);
      retryTrench();
      return;
    }

    if (trenchProgress > 480) {
      exhaustVisible = true;
      if (!hudHint || hudHint.indexOf("MISSED") === 0) {
        hudHint = "FIRE PROTON TORPEDO AT EXHAUST PORT";
      }
    }
  }

  function beginExplosion() {
    stage = STAGE_EXPLODE;
    explodeTimer = 0;
    explodeScale = 1;
    running = false;
    setGameActive(false);
    playExplosionSound();
    addShake(10);
  }

  function updateExplosion() {
    explodeTimer += dt * 60;
    explodeScale += dt * 5.4;
    spawnParticles(
      CX + (Math.random() - 0.5) * 40,
      CY + (Math.random() - 0.5) * 40,
      Math.random() < 0.5 ? WIRE_RED : WIRE_YELLOW,
      2,
      6
    );
    if (explodeTimer > 130) {
      showMissionComplete();
    }
  }

  function updateFlightControl() {
    var rate = stage === STAGE_TRENCH ? 16 : 22;
    var k = 1 - Math.exp(-rate * dt);
    aimX += (mouseTargetX - aimX) * k;
    aimY += (mouseTargetY - aimY) * k;

    var keySpd = dtScale(9);
    if (keys.ArrowLeft || keys.a || keys.A) {
      mouseTargetX -= keySpd;
    }
    if (keys.ArrowRight || keys.d || keys.D) {
      mouseTargetX += keySpd;
    }
    if (keys.ArrowUp || keys.w || keys.W) {
      mouseTargetY -= keySpd;
    }
    if (keys.ArrowDown || keys.s || keys.S) {
      mouseTargetY += keySpd;
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
    if (stage === STAGE_SURFACE) {
      shipBank = (aimX - CX) / CX;
    }

    if (keys[" "] || keys.Spacebar) {
      fireLaser();
    }
  }

  function drawTie(t) {
    var col = WIRE_DIM;
    if (t.alive) {
      col = t.isVader ? WIRE_CYAN : WIRE_GREEN;
    }
    if (t.alive && t.z < 900) {
      var p = tieScreenPos(t);
      if (p) {
        var rad = (t.isVader ? 28 : 22) * p.scale;
        ctx.fillStyle = t.isVader ? "rgba(80,180,255,0.12)" : "rgba(60,255,80,0.1)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawWireEdges(TIE_EDGES, t.x, t.y, t.z, t.scale, col, t.isVader ? 12 : 8);
  }

  function drawSurfaceScene() {
    drawDeathStar(deathStarZ, WIRE_DIM);
    drawGroundGrid();
    var i;
    for (i = 0; i < surfaceHazards.length; i++) {
      drawGroundHazard(surfaceHazards[i]);
    }
    for (i = 0; i < surfaceTowers.length; i++) {
      drawGroundTower(surfaceTowers[i]);
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

    var floorPts = [
      { x: 0, y: H },
      { x: cx - half * 0.38, y: vanY },
      { x: cx + half * 0.38, y: vanY },
      { x: W, y: H },
    ];
    fillPoly2D(floorPts, "rgba(8, 24, 8, 0.55)", null);

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
        var r = 16 + Math.sin(gameTime * 15) * 4;
        ctx.fillStyle = "rgba(255, 60, 40, 0.35)";
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        ctx.fill();
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
    for (i = 0; i < bolts.length; i++) {
      var b = bolts[i];
      var col = b.mag ? WIRE_MAGENTA : WIRE_RED;
      ctx.fillStyle = b.mag ? "rgba(255,100,255,0.45)" : "rgba(255,80,60,0.4)";
      ctx.beginPath();
      ctx.arc(b.sx, b.sy, b.mag ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      strokeGlow(col, 2, 12);
      if (b.mag) {
        var j;
        for (j = 0; j < 8; j++) {
          var a = (j / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(b.sx, b.sy);
          ctx.lineTo(b.sx + Math.cos(a) * 10, b.sy + Math.sin(a) * 10);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy);
      ctx.lineTo(b.sx - b.vx * 4, b.sy - b.vy * 4);
      ctx.stroke();
      clearGlow();
    }
  }

  function drawCockpit() {
    strokeGlow(WIRE_RED, 2, 6);
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W * 0.12, H * 0.78);
    ctx.lineTo(W * 0.28, H * 0.72);
    ctx.stroke();
    strokeGlow(WIRE_BLUE, 2, 6);
    ctx.beginPath();
    ctx.moveTo(W, H);
    ctx.lineTo(W * 0.88, H * 0.78);
    ctx.lineTo(W * 0.72, H * 0.72);
    ctx.stroke();
    strokeGlow(WIRE_DIM, 1, 3);
    ctx.beginPath();
    ctx.moveTo(W * 0.12, H * 0.78);
    ctx.lineTo(W * 0.88, H * 0.78);
    ctx.stroke();
    clearGlow();
  }

  function drawCrosshair() {
    strokeGlow(WIRE_CYAN, 2, 10);
    var s = 10;
    ctx.beginPath();
    ctx.moveTo(aimX - s - 8, aimY);
    ctx.lineTo(aimX - 4, aimY);
    ctx.lineTo(aimX - 4, aimY - 4);
    ctx.lineTo(aimX, aimY - 4);
    ctx.lineTo(aimX, aimY - s - 8);
    ctx.moveTo(aimX + 4, aimY - 4);
    ctx.lineTo(aimX + s + 8, aimY);
    ctx.lineTo(aimX + 4, aimY);
    ctx.lineTo(aimX + 4, aimY + 4);
    ctx.lineTo(aimX, aimY + s + 8);
    ctx.lineTo(aimX, aimY + 4);
    ctx.lineTo(aimX - 4, aimY + 4);
    ctx.closePath();
    ctx.stroke();
    clearGlow();
  }

  function drawLaserBeam() {
    if (laserFlash <= 0) {
      return;
    }
    var alpha = Math.min(1, laserFlash / 0.12);
    strokeGlow("rgba(120,220,255," + alpha + ")", 2, 12);
    ctx.beginPath();
    ctx.moveTo(W * 0.28, H * 0.72);
    ctx.lineTo(aimX, aimY);
    ctx.moveTo(W * 0.72, H * 0.72);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
    clearGlow();
  }

  function drawKillFlashes() {
    var i;
    for (i = killFlash.length - 1; i >= 0; i--) {
      var k = killFlash[i];
      k.t -= dt * 60;
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
      displayCtx.fillStyle = "#000";
      displayCtx.fillRect(0, 0, W, H);
      return;
    }

    if (stage === STAGE_EXPLODE) {
      drawExplosion();
      drawParticles();
      compositeToDisplay();
      return;
    }

    var starSpeed = 1.2;
    if (stage === STAGE_SURFACE) {
      starSpeed = 2.2;
    }
    if (stage === STAGE_TRENCH) {
      starSpeed = 3.5;
    }
    drawStars(starSpeed);

    var i;
    if (stage === STAGE_BATTLE) {
      if (tiesKilled > tiesRequired * 0.5) {
        drawDeathStar(1400 + Math.sin(gameTime) * 20, WIRE_DIM);
      }
      ties.sort(function (a, b) {
        return b.z - a.z;
      });
      for (i = 0; i < ties.length; i++) {
        if (ties[i].alive) {
          drawTie(ties[i]);
        }
      }
    } else if (stage === STAGE_SURFACE) {
      drawSurfaceScene();
    } else if (stage === STAGE_TRENCH) {
      drawTrench();
      for (i = 0; i < barricades.length; i++) {
        drawBarricade(barricades[i]);
      }
      drawTowers();
    }

    drawBolts();
    drawDebris();
    drawCockpit();
    drawCrosshair();
    drawLaserBeam();
    drawStarbursts();
    drawKillFlashes();
    drawParticles();
    drawArcadeHud();
    compositeToDisplay();
  }

  function updatePlaying() {
    gameTime += dt;
    frame += dt * 60;
    if (playerInvuln > 0) {
      playerInvuln -= dt;
    }
    if (laserFlash > 0) {
      laserFlash -= dt;
    }
    if (hitFlash > 0) {
      hitFlash -= dt;
    }
    if (bonusFlashTimer > 0) {
      bonusFlashTimer -= dt;
      if (bonusFlashTimer <= 0) {
        bonusFlashText = "";
        updateHud();
      }
    }

    updateFlightControl();
    updateParticles();
    updateStarbursts();
    updateDebris();

    if (stage === STAGE_BATTLE) {
      updateBattle();
    } else if (stage === STAGE_SURFACE) {
      updateSurface();
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
      lives;
    if (bonusFlashTimer > 0) {
      line += "   |   " + bonusFlashText;
    }
    hud.textContent = line;
    if (shieldFill) {
      shieldFill.style.width = Math.max(0, Math.min(100, shield)) + "%";
    }
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
      bonusFlashTimer = 2.5;
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
    playerInvuln = RESPAWN_SEC;
    beginReadyCountdown("GET READY!", stageLabelHint() + " — stay on target!");
    readyTimer = READY_SEC;
  }

  function stageLabelHint() {
    if (stage === STAGE_BATTLE) {
      return "TIE fighter engagement";
    }
    if (stage === STAGE_SURFACE) {
      return "Death Star surface attack";
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
      "Inspired by the 1983 arcade classic — but smoother, sharper, and playable with a mouse. Survive the dogfight, blast towers on the surface, weave through trench barricades, and hit the exhaust port. Shoot enemy fireballs for bonus points.";
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
    readyTimer = READY_SEC;
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
    if (shieldSegments < MAX_SHIELD) {
      shieldSegments++;
      shield = (shieldSegments / MAX_SHIELD) * 100;
    }
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
    gameTime += dt;
    frame += dt * 60;
    readyTimer -= dt;
    if (readyTimer <= 0) {
      phase = PHASE_PLAYING;
      running = true;
      overlay.classList.add("hidden");
      setOverlayButtons(false, false);
      setQuitVisible(true);
      setGameActive(true);
      mouseTargetX = aimX;
      mouseTargetY = aimY;
    } else if (readyTimer <= 1) {
      overlayTitle.textContent = "GO!";
    }
  }

  function update(dtStep) {
    dt = dtStep;
    if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    } else if (phase === PHASE_READY) {
      updateReady();
    } else if (phase === PHASE_LEVEL && stage === STAGE_EXPLODE) {
      updateExplosion();
      updateParticles();
    }
  }

  function loop(now) {
    if (!lastFrameTime) {
      lastFrameTime = now;
    }
    var step = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    update(step);
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
    tieSpawnAcc = 0;
    enemyShotAcc = 0;
    approachTimer = 0;
    deathStarZ = 2400;
    surfaceTowers = [];
    surfaceKilled = 0;
    towersRemaining = 0;
    surfaceTowerAcc = 0;
    surfaceScroll = 0;
    barricades = [];
    barricadeAcc = 0;
    starbursts = [];
    shipBank = 0;
    hudHint = "";
    battleTimer = 0;
    battleDuration = 38 + waveNum * 4;
    debris = [];
    trenchShotsFired = 0;
    exhaustMissHandled = false;
    surfaceHazards = [];
    trenchProgress = 0;
    towers = [];
    towerSpawnAcc = 0;
    exhaustVisible = false;
    exhaustHit = false;
    explodeTimer = 0;
    killFlash = [];
    particles = [];
    floatTexts = [];
    shieldSegments = MAX_SHIELD;
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
    ensureAudio();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
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
      "Wave 1 — survive the TIE attack, then dive straight into the trench!"
    );
  }

  function nextMission() {
    wave++;
    resetMission(wave);
    startMissionAfterReady(
      "GET READY!",
      "Wave " + wave + " — surface towers, then the trench. Good luck, Red Five!"
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
