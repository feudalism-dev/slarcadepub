/**
 * Tempest — tube shooter for SL Arcade (inspired by Atari 1981 Tempest).
 * Fan recreation for educational / arcade use. Tempest is a trademark of Atari.
 *
 * Controls:
 *   ←/→ or A/D (hold) — move (left = CW, right = CCW)
 *   Space or mouse button — fire
 *   Z — Superzapper (full clear once per level, then one random)
 *   Esc — quit to menu
 */
(function () {
  "use strict";

  SLArcade.registerGameId("tempest");

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var wrap = document.getElementById("game-wrap");
  var hud = document.getElementById("hud");
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var instructionsEl = document.getElementById("instructions");
  var playerLine = document.getElementById("player-line");
  var personalEl = document.getElementById("personal-score");
  var highScoreEl = document.getElementById("high-score");
  var startScoresEl = document.querySelector(".start-scores");
  var unavailableEl = document.getElementById("scores-unavailable");
  var messagesEl = document.getElementById("game-messages");
  var endHintEl = document.getElementById("end-hint");
  var btnStart = document.getElementById("btn-start");
  var btnLeaderboard = document.getElementById("btn-leaderboard");
  var btnNext = document.getElementById("btn-next");
  var btnQuit = document.getElementById("btn-quit");
  var leaderboardModal = document.getElementById("leaderboard-modal");
  var leaderboardEl = document.getElementById("leaderboard");
  var btnModalClose = document.getElementById("btn-modal-close");

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "levelComplete";
  var PHASE_OVER = "gameOver";

  var WORLD = 768;
  var W = WORLD;
  var H = WORLD;
  var CX = W * 0.5;
  var CY = H * 0.5;

  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var level = 1;
  var lives = 3;
  var readyTimer = 0;
  var levelBanner = 0;
  var lastLeaderboardData = null;
  var firing = false;
  var fireCooldown = 0;
  var zapCharges = 2;
  var invuln = 0;
  var keysLeft = false;
  var keysRight = false;
  var MOVE_SPEED = 0.18; // lanes per frame while held

  var tube = null;
  var playerSeg = 0;
  var playerSegF = 0;
  var shots = [];
  var enemies = [];
  var spikes = [];
  var fx = [];
  var spawned = 0;
  var spawnQuota = 0;
  var spawnTimer = 0;

  var SCHEMES = [
    { tube: "#39f6ff", accent: "#ff4fd8", enemy: "#b44dff", hot: "#ffe066" },
    { tube: "#5cff7a", accent: "#ff6b3d", enemy: "#ff4fd8", hot: "#fff07a" },
    { tube: "#ff4fd8", accent: "#39f6ff", enemy: "#7aa0ff", hot: "#ffffff" },
    { tube: "#ffe066", accent: "#39f6ff", enemy: "#ff4fd8", hot: "#ffffff" },
    { tube: "#ffffff", accent: "#ff4fd8", enemy: "#39f6ff", hot: "#ffe066" },
  ];

  function scheme() {
    return SCHEMES[(level - 1) % SCHEMES.length];
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function wrapSeg(s, n) {
    var r = s % n;
    if (r < 0) {
      r += n;
    }
    return r;
  }

  function resizeCanvas() {
    var dw = window.innerWidth || canvas.clientWidth || WORLD;
    var dh = window.innerHeight || canvas.clientHeight || WORLD;
    var side = Math.max(1, Math.min(dw, dh));
    if (canvas.width !== WORLD || canvas.height !== WORLD) {
      canvas.width = WORLD;
      canvas.height = WORLD;
    }
    canvas.style.width = side + "px";
    canvas.style.height = side + "px";
  }

  // --- Tube geometry -------------------------------------------------------

  function polyRim(n, radius, rotation, bulge) {
    var pts = [];
    var i;
    for (i = 0; i < n; i++) {
      var a = rotation + (i / n) * Math.PI * 2;
      var r = radius * (1 + bulge * Math.sin(i * 3));
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  function shapeRim(kind, segments) {
    var n = segments;
    if (kind === "circle") {
      return polyRim(n, 1, -Math.PI / 2, 0);
    }
    if (kind === "square") {
      return polyRim(n, 1.05, Math.PI / n - Math.PI / 2, 0);
    }
    if (kind === "star") {
      var pts = [];
      var i;
      for (i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        var r = i % 2 === 0 ? 1.12 : 0.72;
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      return pts;
    }
    if (kind === "plus") {
      return polyRim(n, 1, -Math.PI / 2, 0.18);
    }
    if (kind === "peanut") {
      return polyRim(n, 1, -Math.PI / 2, 0.28);
    }
    if (kind === "vee") {
      // Open V — not closed
      var out = [];
      var j;
      for (j = 0; j < n; j++) {
        var t = j / (n - 1);
        var ang = lerp(-2.2, 2.2, t);
        out.push({ x: Math.sin(ang) * 1.05, y: -Math.cos(ang) * 0.55 - 0.35 });
      }
      return out;
    }
    if (kind === "flat") {
      var flat = [];
      var k;
      for (k = 0; k < n; k++) {
        flat.push({ x: lerp(-1.1, 1.1, k / (n - 1)), y: 0.85 });
      }
      return flat;
    }
    return polyRim(n, 1, -Math.PI / 2, 0);
  }

  var LEVEL_SHAPES = [
    "circle",
    "square",
    "plus",
    "star",
    "peanut",
    "vee",
    "flat",
    "circle",
    "star",
    "square",
    "plus",
    "peanut",
    "vee",
    "circle",
    "star",
    "flat",
  ];

  function makeTube(lvl) {
    var shape = LEVEL_SHAPES[(lvl - 1) % LEVEL_SHAPES.length];
    var closed = shape !== "vee" && shape !== "flat";
    var segs = closed ? 16 : 12;
    if (shape === "star") {
      segs = 16;
    }
    if (lvl >= 9 && closed) {
      segs = 18;
    }
    var rim = shapeRim(shape, segs);
    return {
      shape: shape,
      closed: closed,
      segments: segs,
      rim: rim,
      farScale: 0.18,
    };
  }

  function laneCorners(tub, seg) {
    var n = tub.segments;
    var a = tub.rim[seg];
    var b = tub.rim[tub.closed ? (seg + 1) % n : Math.min(seg + 1, n - 1)];
    if (!tub.closed && seg >= n - 1) {
      b = tub.rim[n - 1];
      a = tub.rim[n - 2];
    }
    return { a: a, b: b };
  }

  function project(tub, x, y, depth) {
    // depth 0 = rim (near), 1 = pit (far)
    var d = clamp(depth, 0, 1);
    var s = lerp(1, tub.farScale, d);
    var zPunch = lerp(0, 0.08, d);
    return {
      x: CX + x * (W * 0.38) * s,
      y: CY + y * (H * 0.38) * s + zPunch * H,
    };
  }

  function lanePoint(tub, seg, depth, across) {
    var c = laneCorners(tub, seg);
    var mx = lerp(c.a.x, c.b.x, across);
    var my = lerp(c.a.y, c.b.y, across);
    return project(tub, mx, my, depth);
  }

  // --- Entities ------------------------------------------------------------

  function spawnEnemy(type, seg, depth) {
    enemies.push({
      type: type,
      seg: seg,
      depth: depth == null ? 0.92 : depth,
      flipT: 0,
      flipDir: Math.random() < 0.5 ? 1 : -1,
      hp: type === "tanker" ? 2 : 1,
      shootT: 30 + Math.random() * 90,
      alive: true,
      points: type === "tanker" ? 200 : type === "fuseball" ? 350 : type === "spiker" ? 150 : 100,
    });
  }

  function enemySpeed() {
    return 0.0022 + level * 0.00028 + Math.min(0.002, spawned * 0.00002);
  }

  function pickEnemyType() {
    var r = Math.random();
    if (level >= 4 && r < 0.18) {
      return "tanker";
    }
    if (level >= 3 && r < 0.32) {
      return "spiker";
    }
    if (level >= 6 && r < 0.42) {
      return "fuseball";
    }
    return "flipper";
  }

  function fireShot() {
    if (fireCooldown > 0 || shots.length >= 8) {
      return;
    }
    fireCooldown = Math.max(5, 10 - Math.floor(level / 3));
    shots.push({
      seg: Math.round(playerSegF) % tube.segments,
      depth: 0.02,
      vy: 0.045 + Math.min(0.02, level * 0.0015),
      alive: true,
    });
  }

  function doZap() {
    if (zapCharges <= 0 || phase !== PHASE_PLAYING) {
      return;
    }
    if (zapCharges === 2) {
      var i;
      for (i = 0; i < enemies.length; i++) {
        if (enemies[i].alive) {
          score += enemies[i].points;
          fx.push({ x: 0, y: 0, seg: enemies[i].seg, depth: enemies[i].depth, life: 18 });
          enemies[i].alive = false;
        }
      }
      zapCharges = 1;
    } else {
      var alive = [];
      var j;
      for (j = 0; j < enemies.length; j++) {
        if (enemies[j].alive) {
          alive.push(enemies[j]);
        }
      }
      if (alive.length) {
        var e = alive[(Math.random() * alive.length) | 0];
        score += e.points;
        fx.push({ x: 0, y: 0, seg: e.seg, depth: e.depth, life: 18 });
        e.alive = false;
      }
      zapCharges = 0;
    }
  }

  function hitPlayer() {
    if (invuln > 0) {
      return;
    }
    lives -= 1;
    invuln = 90;
    if (lives <= 0) {
      gameOver();
    }
  }

  // --- Level flow ----------------------------------------------------------

  function resetLevelState() {
    tube = makeTube(level);
    playerSeg = 0;
    playerSegF = 0;
    shots = [];
    enemies = [];
    spikes = [];
    fx = [];
    spawned = 0;
    spawnQuota = 8 + level * 3 + Math.floor(level / 2) * 2;
    spawnTimer = 20;
    fireCooldown = 0;
    zapCharges = 2;
    invuln = 45;
    keysLeft = false;
    keysRight = false;
  }

  function beginReady(title, text) {
    phase = PHASE_READY;
    readyTimer = 70;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = title;
    instructionsEl.textContent = text;
    btnStart.classList.add("hidden");
    btnLeaderboard.classList.add("hidden");
    btnNext.classList.add("hidden");
    setQuitVisible(true);
  }

  function startLevel() {
    resetLevelState();
    beginReady(
      "LEVEL " + level,
      tube.shape.toUpperCase() +
        " tube — " +
        spawnQuota +
        " hostiles. Superzapper ready. Clear the pit."
    );
  }

  function nextLevel() {
    level += 1;
    levelBanner = 90;
    startLevel();
  }

  // --- Update --------------------------------------------------------------

  function updateEnemies() {
    var i;
    var spd = enemySpeed();
    for (i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (!e.alive) {
        enemies.splice(i, 1);
        continue;
      }
      if (e.type === "fuseball" && e.depth < 0.08) {
        e.seg = wrapSeg(e.seg + e.flipDir, tube.segments);
        if (!tube.closed) {
          if (e.seg <= 0 || e.seg >= tube.segments - 1) {
            e.flipDir *= -1;
            e.seg = clamp(e.seg, 0, tube.segments - 1);
          }
        }
      } else {
        e.depth -= spd * (e.type === "tanker" ? 0.75 : e.type === "spiker" ? 0.65 : 1);
      }

      if (e.type === "flipper" && e.depth < 0.35 && Math.random() < 0.02 + level * 0.002) {
        e.seg = wrapSeg(e.seg + (Math.random() < 0.5 ? 1 : -1), tube.segments);
        if (!tube.closed) {
          e.seg = clamp(e.seg, 0, tube.segments - 2);
        }
      }

      if (e.type === "spiker" && e.depth < 0.55 && Math.random() < 0.015) {
        spikes.push({
          seg: e.seg,
          top: e.depth,
          bot: Math.min(0.95, e.depth + 0.25),
          alive: true,
        });
      }

      if (e.depth <= 0) {
        if (Math.round(playerSegF) === e.seg || (e.type === "fuseball" && Math.abs(wrapDelta(e.seg, Math.round(playerSegF))) <= 1)) {
          hitPlayer();
        }
        if (e.type === "fuseball") {
          e.alive = false;
        } else {
          e.depth = 0.06;
          e.flipDir *= -1;
        }
      }
    }
  }

  function wrapDelta(a, b) {
    var d = a - b;
    if (tube.closed) {
      if (d > tube.segments / 2) {
        d -= tube.segments;
      }
      if (d < -tube.segments / 2) {
        d += tube.segments;
      }
    }
    return d;
  }

  function updateShots() {
    var i;
    var j;
    for (i = shots.length - 1; i >= 0; i--) {
      var s = shots[i];
      if (!s.alive) {
        shots.splice(i, 1);
        continue;
      }
      s.depth += s.vy;
      for (j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (!e.alive) {
          continue;
        }
        if (e.seg === s.seg && Math.abs(e.depth - s.depth) < 0.06) {
          e.hp -= 1;
          s.alive = false;
          if (e.hp <= 0) {
            score += e.points;
            fx.push({ seg: e.seg, depth: e.depth, life: 16 });
            e.alive = false;
            if (e.type === "tanker") {
              spawnEnemy("flipper", e.seg, e.depth);
              spawnEnemy("flipper", wrapSeg(e.seg + 1, tube.segments), e.depth);
            }
          }
          break;
        }
      }
      for (j = 0; j < spikes.length; j++) {
        var sp = spikes[j];
        if (!sp.alive) {
          continue;
        }
        if (sp.seg === s.seg && s.depth >= sp.top && s.depth <= sp.bot) {
          sp.bot = Math.max(sp.top, sp.bot - 0.12);
          s.alive = false;
          score += 10;
          if (sp.bot - sp.top < 0.05) {
            sp.alive = false;
          }
          break;
        }
      }
      if (s.depth > 1.05) {
        s.alive = false;
      }
    }
  }

  function updateSpikes() {
    var i;
    for (i = spikes.length - 1; i >= 0; i--) {
      if (!spikes[i].alive) {
        spikes.splice(i, 1);
      }
    }
  }

  function updateFx() {
    var i;
    for (i = fx.length - 1; i >= 0; i--) {
      fx[i].life -= 1;
      if (fx[i].life <= 0) {
        fx.splice(i, 1);
      }
    }
  }

  function updatePlayerMotion() {
    var step = 0;
    if (keysLeft) {
      // Left / A = clockwise
      step += MOVE_SPEED;
    }
    if (keysRight) {
      // Right / D = counterclockwise
      step -= MOVE_SPEED;
    }
    playerSegF += step;
    if (tube.closed) {
      playerSegF = wrapSeg(playerSegF, tube.segments);
    } else {
      playerSegF = clamp(playerSegF, 0, tube.segments - 2);
    }
    playerSeg = Math.round(playerSegF);
    if (!tube.closed) {
      playerSeg = clamp(playerSeg, 0, tube.segments - 2);
    } else {
      playerSeg = wrapSeg(playerSeg, tube.segments);
    }
  }

  function updatePlaying() {
    if (invuln > 0) {
      invuln -= 1;
    }
    if (fireCooldown > 0) {
      fireCooldown -= 1;
    }
    if (firing) {
      fireShot();
    }
    updatePlayerMotion();

    spawnTimer -= 1;
    if (spawnTimer <= 0 && spawned < spawnQuota) {
      var seg = (Math.random() * tube.segments) | 0;
      if (!tube.closed) {
        seg = (Math.random() * (tube.segments - 1)) | 0;
      }
      spawnEnemy(pickEnemyType(), seg, 0.88 + Math.random() * 0.1);
      spawned += 1;
      spawnTimer = Math.max(18, 55 - level * 2);
    }

    updateShots();
    updateEnemies();
    updateSpikes();
    updateFx();

    // Spike collision on rim
    var k;
    for (k = 0; k < spikes.length; k++) {
      var sp = spikes[k];
      if (sp.alive && sp.seg === playerSeg && sp.top <= 0.05 && invuln <= 0) {
        hitPlayer();
      }
    }

    if (spawned >= spawnQuota && enemies.length === 0) {
      phase = PHASE_LEVEL;
      levelBanner = 100;
      score += 500 + level * 100;
    }
    updateHud();
  }

  // --- Draw ----------------------------------------------------------------

  function drawGlowStroke(color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
  }

  function drawTube() {
    var col = scheme().tube;
    var n = tube.segments;
    var i;
    drawGlowStroke(col, 1.5);
    for (i = 0; i < (tube.closed ? n : n - 1); i++) {
      var c = laneCorners(tube, i);
      var n0 = project(tube, c.a.x, c.a.y, 0);
      var n1 = project(tube, c.b.x, c.b.y, 0);
      var f0 = project(tube, c.a.x, c.a.y, 1);
      var f1 = project(tube, c.b.x, c.b.y, 1);
      ctx.beginPath();
      ctx.moveTo(n0.x, n0.y);
      ctx.lineTo(n1.x, n1.y);
      ctx.lineTo(f1.x, f1.y);
      ctx.lineTo(f0.x, f0.y);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawPlayer() {
    if (invuln > 0 && (invuln & 2) === 0) {
      return;
    }
    var p0 = lanePoint(tube, playerSeg, 0, 0.15);
    var p1 = lanePoint(tube, playerSeg, 0, 0.85);
    var tip = lanePoint(tube, playerSeg, 0.07, 0.5);
    drawGlowStroke(scheme().accent, 2.2);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawShot(s) {
    var p = lanePoint(tube, s.seg, s.depth, 0.5);
    drawGlowStroke(scheme().hot, 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawEnemy(e) {
    var p = lanePoint(tube, e.seg, e.depth, 0.5);
    var col = scheme().enemy;
    if (e.type === "tanker") {
      col = scheme().hot;
    }
    if (e.type === "fuseball") {
      col = "#ffffff";
    }
    if (e.type === "spiker") {
      col = scheme().accent;
    }
    drawGlowStroke(col, 1.8);
    ctx.beginPath();
    if (e.type === "flipper") {
      ctx.moveTo(p.x, p.y - 7);
      ctx.lineTo(p.x + 8, p.y);
      ctx.lineTo(p.x, p.y + 7);
      ctx.lineTo(p.x - 8, p.y);
      ctx.closePath();
    } else if (e.type === "tanker") {
      ctx.rect(p.x - 7, p.y - 7, 14, 14);
    } else if (e.type === "fuseball") {
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    } else {
      ctx.moveTo(p.x, p.y - 8);
      ctx.lineTo(p.x + 5, p.y + 6);
      ctx.lineTo(p.x - 5, p.y + 6);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawSpike(sp) {
    var a = lanePoint(tube, sp.seg, sp.top, 0.5);
    var b = lanePoint(tube, sp.seg, sp.bot, 0.5);
    drawGlowStroke("#ff4466", 2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawFx(f) {
    var p = lanePoint(tube, f.seg, f.depth, 0.5);
    var r = (18 - f.life) * 1.4;
    drawGlowStroke(scheme().hot, 1.5);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawCursor() {
    // subtle rim marker
  }

  function drawScene() {
    resizeCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createRadialGradient(CX, CY, 20, CX, CY, W * 0.55);
    g.addColorStop(0, "#1a0530");
    g.addColorStop(1, "#020008");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (!tube) {
      return;
    }
    drawTube();
    var i;
    for (i = 0; i < spikes.length; i++) {
      drawSpike(spikes[i]);
    }
    for (i = 0; i < enemies.length; i++) {
      drawEnemy(enemies[i]);
    }
    for (i = 0; i < shots.length; i++) {
      drawShot(shots[i]);
    }
    for (i = 0; i < fx.length; i++) {
      drawFx(fx[i]);
    }
    if (phase === PHASE_PLAYING || phase === PHASE_READY || phase === PHASE_LEVEL) {
      drawPlayer();
    }
    if (phase === PHASE_LEVEL && levelBanner > 0) {
      ctx.fillStyle = "rgba(255,79,216,0.85)";
      ctx.font = "700 28px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "#39f6ff";
      ctx.shadowBlur = 16;
      ctx.fillText("LEVEL CLEAR", CX, CY);
      ctx.shadowBlur = 0;
    }
  }

  function updateHud() {
    hud.textContent =
      "SCORE " +
      score +
      "   LEVEL " +
      level +
      "   LIVES " +
      lives +
      "   ZAP " +
      zapCharges;
  }

  // --- UI / scores ---------------------------------------------------------

  function setPlayingPointer(on) {
    if (on) {
      wrap.classList.add("playing");
    } else {
      wrap.classList.remove("playing");
    }
  }

  function setQuitVisible(v) {
    if (v) {
      btnQuit.classList.remove("hidden");
    } else {
      btnQuit.classList.add("hidden");
    }
  }

  function setOverlayButtons(showStart, showNext) {
    if (showStart) {
      btnStart.classList.remove("hidden");
    } else {
      btnStart.classList.add("hidden");
    }
    if (showNext) {
      btnNext.classList.remove("hidden");
    } else {
      btnNext.classList.add("hidden");
    }
  }

  function setStartScreenExtras(show) {
    if (show) {
      startScoresEl.classList.remove("hidden");
      if (lastLeaderboardData && lastLeaderboardData.scoresEnabled) {
        btnLeaderboard.classList.remove("hidden");
      }
    } else {
      startScoresEl.classList.add("hidden");
      btnLeaderboard.classList.add("hidden");
    }
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "TEMPEST";
    instructionsEl.textContent =
      "Hold ←/→ or A/D to move (left = clockwise, right = counterclockwise). Space or click to fire. Z = Superzapper.";
    btnStart.textContent = "START";
    btnStart.disabled = false;
    setOverlayButtons(true, false);
    setStartScreenExtras(true);
    setQuitVisible(false);
    setPlayingPointer(false);
  }

  function syncPlayerLine() {
    var s = SLArcade.getSession();
    playerLine.textContent = "Player: " + (s.name || "…");
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
    if (phase === PHASE_MENU) {
      btnLeaderboard.classList.remove("hidden");
    }
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

  function showMessages(list) {
    messagesEl.innerHTML = "";
    if (!list || !list.length) {
      return;
    }
    var i;
    for (i = 0; i < list.length; i++) {
      var div = document.createElement("div");
      div.textContent = list[i];
      messagesEl.appendChild(div);
    }
  }

  function gameOver() {
    phase = PHASE_OVER;
    running = false;
    firing = false;
    setPlayingPointer(false);
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GAME OVER";
    instructionsEl.textContent = "Final score: " + score + " — Level " + level;
    btnStart.textContent = "SAVING…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(false);

    function returnToStartScreen(hint) {
      phase = PHASE_MENU;
      running = false;
      showMenuOverlay();
      if (hint) {
        endHintEl.textContent = hint;
      } else if (score > 0) {
        endHintEl.textContent = "Last score: " + score + " — tap START to play again.";
      }
      refreshLeaderboard();
    }

    SLArcade.submitScore(score)
      .then(function (result) {
        showMessages((result && result.messages) || []);
        if (result && result.unavailableMessage) {
          unavailableEl.textContent = result.unavailableMessage;
          unavailableEl.classList.remove("hidden");
        }
        return refreshLeaderboard();
      })
      .then(function () {
        returnToStartScreen();
      })
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        returnToStartScreen("Score save timed out — tap START to play again.");
      });
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    score = 0;
    level = 1;
    lives = 3;
    endHintEl.textContent = "";
    showMessages([]);
    unavailableEl.classList.add("hidden");
    running = true;
    setPlayingPointer(true);
    startLevel();
  }

  // --- Loop / input --------------------------------------------------------

  function loop() {
    if (phase === PHASE_READY) {
      readyTimer -= 1;
      if (readyTimer <= 0) {
        phase = PHASE_PLAYING;
        overlay.classList.add("hidden");
        setQuitVisible(true);
        setPlayingPointer(true);
      }
    } else if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    } else if (phase === PHASE_LEVEL) {
      levelBanner -= 1;
      if (levelBanner <= 0) {
        nextLevel();
      }
    }
    drawScene();
    requestAnimationFrame(loop);
  }

  function onPointerDown(e) {
    if (phase !== PHASE_PLAYING) {
      return;
    }
    if (e.button === 0) {
      firing = true;
      fireShot();
    }
  }

  function onPointerUp(e) {
    if (e.button === 0) {
      firing = false;
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && phase !== PHASE_MENU && phase !== PHASE_OVER) {
      phase = PHASE_MENU;
      running = false;
      firing = false;
      keysLeft = false;
      keysRight = false;
      showMenuOverlay();
      refreshLeaderboard();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      keysLeft = true;
      e.preventDefault();
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      keysRight = true;
      e.preventDefault();
    }
    if (phase !== PHASE_PLAYING) {
      return;
    }
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      firing = true;
      fireShot();
    }
    if (e.key === "z" || e.key === "Z") {
      doZap();
    }
  });

  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      keysLeft = false;
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      keysRight = false;
    }
    if (e.key === " " || e.code === "Space") {
      firing = false;
    }
  });

  btnStart.addEventListener("click", function () {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      startGame();
    }
  });
  btnNext.addEventListener("click", function () {
    if (phase === PHASE_LEVEL) {
      nextLevel();
    }
  });
  btnQuit.addEventListener("click", function () {
    phase = PHASE_MENU;
    running = false;
    firing = false;
    showMenuOverlay();
    refreshLeaderboard();
  });
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

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("message", function () {
    syncPlayerLine();
    refreshLeaderboard();
  });

  syncPlayerLine();
  showMenuOverlay();
  refreshLeaderboard();
  requestAnimationFrame(loop);
})();
