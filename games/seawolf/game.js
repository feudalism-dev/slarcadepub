(function () {
  "use strict";

  SLArcade.registerGameId("seawolf");

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

  // Full-bleed 600×600 world — scaled to fill the entire canvas (no letterbox bars)
  var WORLD = 600;
  var W = WORLD;
  var H = WORLD;
  var HORIZON_Y = 210;
  var SUB_Y = H - 36;
  var TORPEDO_START_Y = H - 70;
  var scaleX = 1;
  var scaleY = 1;

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_OVER = "gameOver";

  var READY_FRAMES = 75;
  var TUBE_COUNT = 5;
  var RELOAD_FRAMES = 95;
  var TORPEDO_SPEED = 4.2;
  var PATROL_SECONDS = 90;
  var MAX_HULL = 3;
  var AIM_MIN = 40;
  var AIM_MAX = W - 40;

  var SHIP_FREIGHTER = "freighter";
  var SHIP_DESTROYER = "destroyer";
  var SHIP_PT = "pt";
  var SHIP_COMMAND = "command";

  var COL_CYAN = "#00e8ff";
  var COL_CYAN_DIM = "rgba(0, 232, 255, 0.35)";
  var COL_OCEAN_TOP = "#0a2a48";
  var COL_OCEAN_BOT = "#021018";
  var COL_SKY = "#050d18";
  var COL_HORIZON = "#3a90c8";
  var COL_SHIP = "#c8e8ff";
  var COL_SHIP_CMD = "#ffe066";
  var COL_TORP = "#7cf5ff";
  var COL_BLAST = "#ff6644";
  var COL_DEPTH = "#ff4466";
  var COL_HUD = "#9ad8ff";

  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var sessionHigh = 0;
  var shipsSunk = 0;
  var wave = 1;
  var frame = 0;
  var readyTimer = 0;
  var patrolFramesLeft = 0;
  var hull = MAX_HULL;
  var lastLeaderboardData = null;

  var aimX = W * 0.5;
  var keysLeft = false;
  var keysRight = false;

  var ships = [];
  var torpedoes = [];
  var depthCharges = [];
  var explosions = [];
  var floatScores = [];
  var tubes = [];
  var spawnTimer = 0;
  var spawnInterval = 90;
  var commandSpawnTimer = 0;

  var SHIP_DEFS = {};
  SHIP_DEFS[SHIP_FREIGHTER] = { speed: 0.55, score: 100, w: 78, h: 18, color: COL_SHIP };
  SHIP_DEFS[SHIP_DESTROYER] = { speed: 1.05, score: 250, w: 62, h: 16, color: "#b8d4ff" };
  SHIP_DEFS[SHIP_PT] = { speed: 1.85, score: 500, w: 40, h: 12, color: "#a0fff0" };
  SHIP_DEFS[SHIP_COMMAND] = { speed: 2.55, score: 1000, w: 28, h: 10, color: COL_SHIP_CMD };

  function setOverlayButtons(showStart, showNext) {
    btnStart.classList.toggle("hidden", !showStart);
    btnNext.classList.toggle("hidden", !showNext);
  }

  function setStartScreenExtras(visible) {
    startScoresEl.classList.toggle("hidden", !visible);
    btnLeaderboard.classList.toggle("hidden", !visible);
    if (!visible) {
      closeLeaderboardModal();
    }
  }

  function setQuitVisible(visible) {
    btnQuit.classList.toggle("hidden", !visible);
  }

  function setPlayingPointer(playing) {
    gameWrap.classList.toggle("playing", playing);
  }

  function clamp(v, lo, hi) {
    if (v < lo) {
      return lo;
    }
    if (v > hi) {
      return hi;
    }
    return v;
  }

  function randRange(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function resizeCanvas() {
    var displayW = window.innerWidth || canvas.clientWidth || WORLD;
    var displayH = window.innerHeight || canvas.clientHeight || WORLD;
    if (displayW < 1) {
      displayW = WORLD;
    }
    if (displayH < 1) {
      displayH = WORLD;
    }
    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }
    scaleX = canvas.width / WORLD;
    scaleY = canvas.height / WORLD;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COL_SKY;
    ctx.fillRect(0, 0, displayW, displayH);
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  }

  function grabMediaFocus() {
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      window.focus();
      if (document.body) {
        if (!document.body.getAttribute("tabindex")) {
          document.body.setAttribute("tabindex", "0");
        }
        document.body.focus();
      }
    } catch (err) {}
  }

  function resetTubes() {
    tubes = [];
    var i;
    for (i = 0; i < TUBE_COUNT; i++) {
      tubes.push({ ready: true, reload: 0 });
    }
  }

  function tubesReadyCount() {
    var n = 0;
    var i;
    for (i = 0; i < tubes.length; i++) {
      if (tubes[i].ready) {
        n++;
      }
    }
    return n;
  }

  function difficultyTier() {
    var elapsed = PATROL_SECONDS * 60 - patrolFramesLeft;
    return 1 + Math.floor(elapsed / (18 * 60));
  }

  function shipTypesForTier(tier) {
    if (tier <= 1) {
      return [SHIP_FREIGHTER, SHIP_FREIGHTER, SHIP_DESTROYER];
    }
    if (tier === 2) {
      return [SHIP_FREIGHTER, SHIP_DESTROYER, SHIP_DESTROYER, SHIP_PT];
    }
    if (tier === 3) {
      return [SHIP_DESTROYER, SHIP_PT, SHIP_PT, SHIP_FREIGHTER];
    }
    return [SHIP_PT, SHIP_DESTROYER, SHIP_PT, SHIP_FREIGHTER, SHIP_DESTROYER];
  }

  function spawnShip(forcedType) {
    var tier = difficultyTier();
    var type = forcedType || pick(shipTypesForTier(tier));
    var def = SHIP_DEFS[type];
    var fromLeft = Math.random() < 0.5;
    var speedMul = 1 + (tier - 1) * 0.12;
    var dir = fromLeft ? 1 : -1;
    var ship = {
      type: type,
      x: fromLeft ? -def.w - 10 : W + def.w + 10,
      y: HORIZON_Y - 8 - randRange(0, 28),
      w: def.w,
      h: def.h,
      vx: dir * def.speed * speedMul,
      score: def.score,
      color: def.color,
      alive: true,
      dropTimer: type === SHIP_DESTROYER ? ((90 + Math.random() * 140) | 0) : -1,
    };
    ships.push(ship);
  }

  function fireTorpedo() {
    var i;
    for (i = 0; i < tubes.length; i++) {
      if (tubes[i].ready) {
        tubes[i].ready = false;
        tubes[i].reload = RELOAD_FRAMES;
        torpedoes.push({
          x: aimX,
          y: TORPEDO_START_Y,
          vy: -TORPEDO_SPEED,
          trail: [],
          alive: true,
        });
        return true;
      }
    }
    return false;
  }

  function spawnExplosion(x, y, r, color) {
    explosions.push({
      x: x,
      y: y,
      r: 4,
      maxR: r || 28,
      life: 22,
      color: color || COL_BLAST,
    });
  }

  function spawnFloatScore(x, y, pts) {
    floatScores.push({
      x: x,
      y: y,
      text: "+" + pts,
      life: 48,
    });
  }

  function hitTestShip(torp, ship) {
    var left = ship.x - ship.w * 0.5;
    var right = ship.x + ship.w * 0.5;
    var top = ship.y - ship.h;
    var bot = ship.y + 4;
    return torp.x >= left && torp.x <= right && torp.y >= top && torp.y <= bot;
  }

  function updateTubes() {
    var i;
    for (i = 0; i < tubes.length; i++) {
      if (!tubes[i].ready) {
        tubes[i].reload -= 1;
        if (tubes[i].reload <= 0) {
          tubes[i].ready = true;
          tubes[i].reload = 0;
        }
      }
    }
  }

  function updateShips() {
    var i;
    for (i = ships.length - 1; i >= 0; i--) {
      var s = ships[i];
      if (!s.alive) {
        ships.splice(i, 1);
      } else {
        s.x += s.vx;
        if (s.dropTimer > 0) {
          s.dropTimer -= 1;
          if (s.dropTimer === 0 && s.x > 40 && s.x < W - 40) {
            depthCharges.push({
              x: s.x,
              y: HORIZON_Y + 6,
              vy: 1.35 + Math.random() * 0.4,
              alive: true,
            });
            s.dropTimer = (160 + Math.random() * 200) | 0;
          }
        }
        if (s.x < -s.w - 40 || s.x > W + s.w + 40) {
          ships.splice(i, 1);
        }
      }
    }
  }

  function updateTorpedoes() {
    var i;
    var j;
    for (i = torpedoes.length - 1; i >= 0; i--) {
      var t = torpedoes[i];
      if (!t.alive) {
        torpedoes.splice(i, 1);
      } else {
        t.trail.push({ x: t.x, y: t.y });
        if (t.trail.length > 14) {
          t.trail.shift();
        }
        t.y += t.vy;
        for (j = 0; j < ships.length; j++) {
          var ship = ships[j];
          if (ship.alive && hitTestShip(t, ship)) {
            ship.alive = false;
            t.alive = false;
            score += ship.score;
            shipsSunk += 1;
            if (score > sessionHigh) {
              sessionHigh = score;
            }
            spawnExplosion(ship.x, ship.y - ship.h * 0.4, 34, COL_BLAST);
            spawnFloatScore(ship.x, ship.y - 24, ship.score);
            break;
          }
        }
        if (t.alive && t.y < HORIZON_Y - 40) {
          t.alive = false;
          spawnExplosion(t.x, HORIZON_Y - 8, 12, COL_CYAN);
        }
        if (!t.alive) {
          torpedoes.splice(i, 1);
        }
      }
    }
  }

  function updateDepthCharges() {
    var i;
    for (i = depthCharges.length - 1; i >= 0; i--) {
      var d = depthCharges[i];
      if (!d.alive) {
        depthCharges.splice(i, 1);
      } else {
        d.y += d.vy;
        if (d.y >= SUB_Y - 8) {
          var dx = d.x - W * 0.5;
          if (dx * dx < 55 * 55) {
            hull -= 1;
            spawnExplosion(W * 0.5, SUB_Y - 10, 40, COL_DEPTH);
            d.alive = false;
            if (hull <= 0) {
              gameOver("hull");
              return;
            }
          } else {
            spawnExplosion(d.x, d.y, 16, COL_DEPTH);
            d.alive = false;
          }
        }
        if (!d.alive) {
          depthCharges.splice(i, 1);
        }
      }
    }
  }

  function updateExplosions() {
    var i;
    for (i = explosions.length - 1; i >= 0; i--) {
      var e = explosions[i];
      e.life -= 1;
      e.r += (e.maxR - e.r) * 0.22;
      if (e.life <= 0) {
        explosions.splice(i, 1);
      }
    }
  }

  function updateFloatScores() {
    var i;
    for (i = floatScores.length - 1; i >= 0; i--) {
      var f = floatScores[i];
      f.y -= 0.6;
      f.life -= 1;
      if (f.life <= 0) {
        floatScores.splice(i, 1);
      }
    }
  }

  function updateSpawning() {
    var tier = difficultyTier();
    spawnInterval = Math.max(38, 100 - tier * 10);
    spawnTimer -= 1;
    if (spawnTimer <= 0) {
      spawnShip();
      if (tier >= 3 && Math.random() < 0.28) {
        spawnShip();
      }
      spawnTimer = spawnInterval + ((Math.random() * 20) | 0);
    }
    commandSpawnTimer -= 1;
    if (commandSpawnTimer <= 0 && tier >= 2) {
      spawnShip(SHIP_COMMAND);
      commandSpawnTimer = (420 - tier * 40) | 0;
    }
  }

  function updateAimFromKeys() {
    if (keysLeft) {
      aimX -= 4.5;
    }
    if (keysRight) {
      aimX += 4.5;
    }
    aimX = clamp(aimX, AIM_MIN, AIM_MAX);
  }

  function updatePlaying() {
    frame += 1;
    patrolFramesLeft -= 1;
    if (patrolFramesLeft <= 0) {
      gameOver("time");
      return;
    }
    updateAimFromKeys();
    updateTubes();
    updateSpawning();
    updateShips();
    updateTorpedoes();
    updateDepthCharges();
    updateExplosions();
    updateFloatScores();
    updateHud();
  }

  function drawBackground() {
    ctx.fillStyle = COL_SKY;
    ctx.fillRect(0, 0, W, HORIZON_Y);

    var grad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    grad.addColorStop(0, COL_OCEAN_TOP);
    grad.addColorStop(1, COL_OCEAN_BOT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    ctx.strokeStyle = COL_HORIZON;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    ctx.lineTo(W, HORIZON_Y);
    ctx.stroke();

    // subtle wave ticks
    ctx.strokeStyle = "rgba(60, 160, 200, 0.18)";
    ctx.lineWidth = 1;
    var wy;
    for (wy = HORIZON_Y + 28; wy < H - 50; wy += 36) {
      ctx.beginPath();
      var wx;
      for (wx = 0; wx <= W; wx += 20) {
        var amp = 2.5 * Math.sin((wx + frame * 1.2) * 0.04 + wy * 0.02);
        if (wx === 0) {
          ctx.moveTo(wx, wy + amp);
        } else {
          ctx.lineTo(wx, wy + amp);
        }
      }
      ctx.stroke();
    }

    // tactical grid faint
    ctx.strokeStyle = "rgba(40, 120, 180, 0.08)";
    var gx;
    for (gx = 0; gx <= W; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, HORIZON_Y);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
  }

  function drawShip(s) {
    var x = s.x;
    var y = s.y;
    var hw = s.w * 0.5;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = "rgba(10, 30, 50, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (s.type === SHIP_FREIGHTER) {
      ctx.moveTo(x - hw, y);
      ctx.lineTo(x - hw + 8, y - s.h);
      ctx.lineTo(x + hw - 10, y - s.h);
      ctx.lineTo(x + hw, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(x - 10, y - s.h - 10, 14, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 6, y - s.h - 10);
      ctx.lineTo(x + 6, y - s.h - 22);
      ctx.stroke();
    } else if (s.type === SHIP_DESTROYER) {
      ctx.moveTo(x - hw, y);
      ctx.lineTo(x - hw + 14, y - s.h);
      ctx.lineTo(x + hw - 6, y - s.h * 0.85);
      ctx.lineTo(x + hw, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 6, y - s.h);
      ctx.lineTo(x - 6, y - s.h - 16);
      ctx.lineTo(x + 10, y - s.h - 8);
      ctx.stroke();
    } else if (s.type === SHIP_PT) {
      ctx.moveTo(x - hw, y);
      ctx.lineTo(x - hw * 0.2, y - s.h);
      ctx.lineTo(x + hw, y - s.h * 0.45);
      ctx.lineTo(x + hw * 0.7, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // command boat — small diamond hull
      ctx.moveTo(x - hw, y - s.h * 0.3);
      ctx.lineTo(x, y - s.h);
      ctx.lineTo(x + hw, y - s.h * 0.3);
      ctx.lineTo(x, y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COL_SHIP_CMD;
      ctx.fillRect(x - 2, y - s.h - 6, 4, 4);
    }
  }

  function drawTorpedo(t) {
    var i;
    for (i = 0; i < t.trail.length; i++) {
      var p = t.trail[i];
      var a = (i + 1) / (t.trail.length + 1);
      ctx.strokeStyle = "rgba(124, 245, 255," + (a * 0.55).toFixed(2) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + 6);
      ctx.stroke();
    }
    ctx.strokeStyle = COL_TORP;
    ctx.fillStyle = COL_TORP;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 10);
    ctx.lineTo(t.x - 3, t.y + 4);
    ctx.lineTo(t.x + 3, t.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawDepthCharge(d) {
    ctx.strokeStyle = COL_DEPTH;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 8);
    ctx.lineTo(d.x, d.y + 8);
    ctx.stroke();
  }

  function drawExplosion(e) {
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawFloatScore(f) {
    ctx.fillStyle = "rgba(255, 210, 124," + (f.life / 48).toFixed(2) + ")";
    ctx.font = "12px Segoe UI, Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
  }

  function drawCrosshair() {
    var x = aimX;
    var y = HORIZON_Y - 36;
    ctx.strokeStyle = COL_CYAN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 26, y);
    ctx.lineTo(x - 10, y);
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 26, y);
    ctx.moveTo(x, y - 26);
    ctx.lineTo(x, y - 10);
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x, y + 26);
    ctx.stroke();

    // aim line down into water
    ctx.strokeStyle = COL_CYAN_DIM;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y + 28);
    ctx.lineTo(x, TORPEDO_START_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawSubSilhouette() {
    var cx = W * 0.5;
    var y = SUB_Y;
    ctx.strokeStyle = COL_CYAN;
    ctx.fillStyle = "rgba(0, 40, 60, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 40, y);
    ctx.quadraticCurveTo(cx, y + 18, cx + 40, y);
    ctx.quadraticCurveTo(cx, y - 14, cx - 40, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(cx - 6, y - 22, 12, 12);
    ctx.stroke();
  }

  function drawTubeHud() {
    var i;
    var baseX = W - 28;
    var baseY = 28;
    ctx.strokeStyle = COL_HUD;
    ctx.fillStyle = COL_HUD;
    ctx.font = "11px Segoe UI, Tahoma, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("TUBES", baseX + 8, baseY - 10);
    for (i = 0; i < tubes.length; i++) {
      var tx = baseX - i * 18;
      var ty = baseY;
      if (tubes[i].ready) {
        ctx.strokeStyle = COL_TORP;
        ctx.fillStyle = "rgba(124, 245, 255, 0.35)";
      } else {
        ctx.strokeStyle = "rgba(100, 140, 160, 0.55)";
        ctx.fillStyle = "rgba(20, 40, 50, 0.5)";
      }
      ctx.beginPath();
      ctx.moveTo(tx, ty - 10);
      ctx.lineTo(tx - 3, ty + 6);
      ctx.lineTo(tx + 3, ty + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (!tubes[i].ready) {
        var pct = 1 - tubes[i].reload / RELOAD_FRAMES;
        ctx.fillStyle = "rgba(0, 232, 255, 0.55)";
        ctx.fillRect(tx - 5, ty + 10, 10 * pct, 3);
      }
    }
  }

  function drawCornerHud() {
    ctx.fillStyle = COL_HUD;
    ctx.font = "13px Segoe UI, Tahoma, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("SCORE  " + score, 14, 24);
    ctx.textAlign = "left";
    ctx.fillText("SUNK  " + shipsSunk, 14, H - 18);
    ctx.textAlign = "right";
    ctx.fillText("HIGH  " + sessionHigh, W - 14, H - 18);

    var secs = Math.max(0, Math.ceil(patrolFramesLeft / 60));
    ctx.textAlign = "center";
    ctx.fillText("PATROL  " + secs + "s", W * 0.5, 24);

    var hi;
    ctx.textAlign = "left";
    ctx.fillText("HULL", 14, 46);
    for (hi = 0; hi < MAX_HULL; hi++) {
      ctx.strokeStyle = hi < hull ? COL_CYAN : "rgba(80, 100, 120, 0.45)";
      ctx.beginPath();
      ctx.arc(62 + hi * 16, 42, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawScene() {
    resizeCanvas();
    drawBackground();

    var i;
    for (i = 0; i < ships.length; i++) {
      drawShip(ships[i]);
    }
    for (i = 0; i < torpedoes.length; i++) {
      drawTorpedo(torpedoes[i]);
    }
    for (i = 0; i < depthCharges.length; i++) {
      drawDepthCharge(depthCharges[i]);
    }
    for (i = 0; i < explosions.length; i++) {
      drawExplosion(explosions[i]);
    }
    for (i = 0; i < floatScores.length; i++) {
      drawFloatScore(floatScores[i]);
    }

    drawSubSilhouette();
    if (phase === PHASE_PLAYING || phase === PHASE_READY) {
      drawCrosshair();
      drawTubeHud();
      drawCornerHud();
    }
  }

  function updateHud() {
    var secs = Math.max(0, Math.ceil(patrolFramesLeft / 60));
    hud.textContent =
      "SCORE " +
      score +
      "   TUBES " +
      tubesReadyCount() +
      "/" +
      TUBE_COUNT +
      "   SUNK " +
      shipsSunk +
      "   TIME " +
      secs +
      "s   HULL " +
      hull;
  }

  function clearWorld() {
    ships = [];
    torpedoes = [];
    depthCharges = [];
    explosions = [];
    floatScores = [];
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SEA WOLF";
    if (SLArcade.isHudMode()) {
      instructionsEl.textContent =
        "HUD mode: move the periscope with the mouse (or ←/→). Click or Space to fire. Lead ships — torpedoes travel straight up. Five tubes reload one at a time. Avoid depth charges.";
    } else {
      instructionsEl.textContent =
        "Cabinet mode: aim with the mouse, click or Space to fire. Lead moving ships. Five tubes. 90-second patrol. Touch the prim in-world to start a session.";
    }
    endHintEl.textContent = "";
    btnStart.disabled = false;
    btnStart.textContent = "START";
    setOverlayButtons(true, false);
    setStartScreenExtras(true);
    setQuitVisible(false);
    setPlayingPointer(false);
    if (lastLeaderboardData) {
      updateStartScores(lastLeaderboardData);
    }
  }

  function beginReadyCountdown(titleText, hintText) {
    phase = PHASE_READY;
    running = false;
    readyTimer = READY_FRAMES;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = titleText || "DIVE!";
    instructionsEl.textContent = hintText || "Raising periscope…";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
    setPlayingPointer(false);
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
    if (data.entries && data.entries.length && data.entries[0].score > sessionHigh) {
      sessionHigh = data.entries[0].score;
    }
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

  function gameOver(reason) {
    if (phase === PHASE_OVER) {
      return;
    }
    phase = PHASE_OVER;
    running = false;
    setPlayingPointer(false);
    overlay.classList.remove("hidden");
    if (reason === "hull") {
      overlayTitle.textContent = "HULL BREACHED";
      instructionsEl.textContent =
        "Depth charge hit. Final score: " + score + " — Ships sunk: " + shipsSunk;
    } else if (reason === "time") {
      overlayTitle.textContent = "PATROL COMPLETE";
      instructionsEl.textContent =
        "Time expired. Final score: " + score + " — Ships sunk: " + shipsSunk;
    } else {
      overlayTitle.textContent = "GAME OVER";
      instructionsEl.textContent =
        "Final score: " + score + " — Ships sunk: " + shipsSunk;
    }
    btnStart.textContent = "SAVING…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(false);

    var hudMode = SLArcade.isHudMode();
    var canEndCabinet = SLArcade.canEndSession() && !hudMode;
    var recoveryTimer = setTimeout(function () {
      if (phase === PHASE_OVER && btnStart.disabled) {
        if (hudMode) {
          returnToStartScreen("Tap START to play again.");
        } else {
          enablePlayAgain("Tap PLAY AGAIN, or click the cabinet in-world for a new session.");
        }
      }
    }, 8000);

    function returnToStartScreen(hint) {
      clearTimeout(recoveryTimer);
      phase = PHASE_MENU;
      running = false;
      clearWorld();
      setPlayingPointer(false);
      showMenuOverlay();
      if (hint) {
        endHintEl.textContent = hint;
      } else if (score > 0) {
        endHintEl.textContent = "Last score: " + score + " — tap START to play again.";
      }
      refreshLeaderboard();
    }

    function enablePlayAgain(hint) {
      btnStart.textContent = "PLAY AGAIN";
      btnStart.disabled = false;
      endHintEl.textContent = hint || "Tap PLAY AGAIN for another run.";
    }

    function finishCabinetGameOver() {
      clearTimeout(recoveryTimer);
      if (canEndCabinet) {
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
      .then(function () {
        if (hudMode) {
          returnToStartScreen();
        } else {
          finishCabinetGameOver();
        }
      })
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        if (hudMode) {
          returnToStartScreen("Score save timed out — tap START to play again.");
        } else {
          clearTimeout(recoveryTimer);
          enablePlayAgain("Score save timed out — you can still play again.");
        }
      });
  }

  function startPatrol() {
    clearWorld();
    resetTubes();
    aimX = W * 0.5;
    hull = MAX_HULL;
    patrolFramesLeft = PATROL_SECONDS * 60;
    spawnTimer = 40;
    commandSpawnTimer = 280;
    spawnInterval = 90;
    updateHud();
    beginReadyCountdown(
      "PATROL " + wave,
      "Freighters 100 · Destroyers 250 · PT boats 500 · Command boat 1000. Lead your shots."
    );
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    score = 0;
    shipsSunk = 0;
    wave = 1;
    frame = 0;
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    startPatrol();
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    phase = PHASE_MENU;
    running = false;
    clearWorld();
    setPlayingPointer(false);
    showMessages([]);
    showMenuOverlay();
    if (!SLArcade.isHudMode()) {
      SLArcade.endSession().catch(function () {});
    }
  }

  function canvasCoords(ev) {
    var rect = canvas.getBoundingClientRect();
    var cx;
    var cy;
    if (ev.touches && ev.touches.length) {
      cx = ev.touches[0].clientX;
      cy = ev.touches[0].clientY;
    } else {
      cx = ev.clientX;
      cy = ev.clientY;
    }
    var sx = (cx - rect.left) * (canvas.width / rect.width);
    var sy = (cy - rect.top) * (canvas.height / rect.height);
    return {
      x: sx / scaleX,
      y: sy / scaleY,
    };
  }

  function onPointerMove(ev) {
    if (phase !== PHASE_PLAYING && phase !== PHASE_READY) {
      return;
    }
    var p = canvasCoords(ev);
    aimX = clamp(p.x, AIM_MIN, AIM_MAX);
  }

  function onFire(ev) {
    grabMediaFocus();
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    if (ev && ev.preventDefault) {
      ev.preventDefault();
    }
    if (ev && (ev.clientX !== undefined || (ev.touches && ev.touches.length))) {
      var p = canvasCoords(ev);
      aimX = clamp(p.x, AIM_MIN, AIM_MAX);
    }
    fireTorpedo();
  }

  function syncPlayerLine() {
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  function loop() {
    if (phase === PHASE_READY) {
      readyTimer -= 1;
      if (readyTimer <= 0) {
        phase = PHASE_PLAYING;
        running = true;
        overlay.classList.add("hidden");
        setPlayingPointer(true);
        setQuitVisible(true);
        grabMediaFocus();
      }
    } else if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    }
    drawScene();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("click", grabMediaFocus);
  canvas.addEventListener("mousedown", onFire);
  canvas.addEventListener("touchstart", onFire, { passive: false });
  canvas.addEventListener("mousemove", onPointerMove);
  canvas.addEventListener("touchmove", onPointerMove, { passive: true });
  window.addEventListener("mousemove", function (ev) {
    if (phase === PHASE_PLAYING || phase === PHASE_READY) {
      onPointerMove(ev);
    }
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && phase !== PHASE_MENU && phase !== PHASE_OVER) {
      quitGame();
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
    if (e.key === " " || e.code === "Space") {
      onFire(e);
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      keysLeft = false;
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      keysRight = false;
    }
  });

  btnStart.addEventListener("click", startGame);
  btnStart.addEventListener("touchend", function (e) {
    e.preventDefault();
    startGame();
  });
  btnNext.addEventListener("click", startGame);
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

  syncPlayerLine();
  refreshLeaderboard();
  if (SLArcade.isPendingMoapSave()) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SAVING SCORE";
    instructionsEl.textContent = "Writing your score to the leaderboard…";
    btnStart.textContent = "PLEASE WAIT…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
  } else {
    showMenuOverlay();
  }
  requestAnimationFrame(loop);
})();
