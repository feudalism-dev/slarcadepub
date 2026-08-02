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

  // Audio system
  var audioCtx = null;
  var audioEnabled = false;
  var sonarPingInterval = null;
  var sonarBaseRate = 2.5; // seconds between pings
  var sonarMinRate = 0.4;

  // Classic/vector mode
  var classicMode = false;

  // Wave system
  var currentWave = 1;
  var waveShipsRemaining = 0;
  var waveComplete = false;
  var interWaveDelay = 0;
  var INTER_WAVE_FRAMES = 120; // 2 seconds at 60fps
  var waveFormations = [
    // Wave 1: 3 freighters
    [SHIP_FREIGHTER, SHIP_FREIGHTER, SHIP_FREIGHTER],
    // Wave 2: 2 freighters, 1 destroyer
    [SHIP_FREIGHTER, SHIP_FREIGHTER, SHIP_DESTROYER],
    // Wave 3: 1 freighter, 2 destroyers
    [SHIP_FREIGHTER, SHIP_DESTROYER, SHIP_DESTROYER],
    // Wave 4: 2 destroyers, 1 PT boat
    [SHIP_DESTROYER, SHIP_DESTROYER, SHIP_PT],
    // Wave 5: 1 destroyer, 2 PT boats
    [SHIP_DESTROYER, SHIP_PT, SHIP_PT],
    // Wave 6+: 3 PT boats, occasional command ship
    [SHIP_PT, SHIP_PT, SHIP_PT],
  ];

  var ships = [];
  var torpedoes = [];
  var depthCharges = [];
  var explosions = [];
  var floatScores = [];
  var tubes = [];
  var spawnTimer = 0;
  var spawnInterval = 90;
  var commandSpawnTimer = 0;
  var commandShipSpawnedThisWave = false;

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

  // Audio system
  function ensureAudioContext() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration, type, volume, startTime) {
    var ctx = ensureAudioContext();
    if (!ctx) return;
    var t = startTime !== undefined ? startTime : ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume || 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + (duration || 0.1));
  }

  function playSonarPing() {
    var ctx = ensureAudioContext();
    if (!ctx || !audioEnabled) return;
    var t = ctx.currentTime;
    // Ping: quick sweep down
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  function playTorpedoLaunch() {
    var ctx = ensureAudioContext();
    if (!ctx || !audioEnabled) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  function playExplosion(isDepthCharge) {
    var ctx = ensureAudioContext();
    if (!ctx || !audioEnabled) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = isDepthCharge ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(isDepthCharge ? 120 : 200, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + (isDepthCharge ? 0.4 : 0.25));
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isDepthCharge ? 0.5 : 0.3));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + (isDepthCharge ? 0.5 : 0.3));
  }

  function playHullHit() {
    var ctx = ensureAudioContext();
    if (!ctx || !audioEnabled) return;
    var t = ctx.currentTime;
    // Alarm: alternating high/low
    for (var i = 0; i < 3; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = i % 2 === 0 ? 600 : 300;
      gain.gain.setValueAtTime(0.15, t + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.1);
    }
  }

  function startSonarPingLoop() {
    if (sonarPingInterval) {
      clearInterval(sonarPingInterval);
    }
    if (!audioEnabled) return;
    var ping = function () {
      if (!audioEnabled || phase !== PHASE_PLAYING) return;
      playSonarPing();
      // Rate increases as time runs out
      var timeRatio = patrolFramesLeft / (PATROL_SECONDS * 60);
      var rate = sonarBaseRate - (sonarBaseRate - sonarMinRate) * (1 - timeRatio);
      sonarPingInterval = setTimeout(ping, rate * 1000);
    };
    ping();
  }

  function stopSonarPingLoop() {
    if (sonarPingInterval) {
      clearTimeout(sonarPingInterval);
      sonarPingInterval = null;
    }
  }

  function toggleClassicMode() {
    classicMode = !classicMode;
    document.documentElement.classList.toggle("classic", classicMode);
    var btn = document.getElementById("btn-classic-toggle");
    if (btn) {
      btn.textContent = classicMode ? "VECTOR" : "VECTOR";
      btn.title = classicMode ? "Switch to Modern Mode" : "Switch to Classic Vector Mode";
    }
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
    ctx.fillStyle = classicMode ? "#000800" : COL_SKY;
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
    // Tier increases with wave number
    return Math.min(4, 1 + Math.floor((currentWave - 1) / 2));
  }

  function getWaveFormation(wave) {
    var idx = Math.min(waveFormations.length - 1, wave - 1);
    return waveFormations[idx];
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
          alive: true,
        });
        playTorpedoLaunch();
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
            // Drop 3 depth charges in a spread pattern
            var spread = [-35, 0, 35];
            for (var si = 0; si < spread.length; si++) {
              depthCharges.push({
                x: s.x + spread[si],
                y: HORIZON_Y + 6,
                vy: 1.35 + Math.random() * 0.4,
                alive: true,
              });
            }
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
            playExplosion(false);
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
            playExplosion(true);
            playHullHit();
            d.alive = false;
            if (hull <= 0) {
              gameOver("hull");
              return;
            }
          } else {
            spawnExplosion(d.x, d.y, 16, COL_DEPTH);
            playExplosion(true);
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
    // Handle inter-wave delay
    if (interWaveDelay > 0) {
      interWaveDelay -= 1;
      if (interWaveDelay <= 0) {
        startNextWave();
      }
      return;
    }

    // Check if current wave is complete
    if (waveComplete) {
      waveComplete = false;
      interWaveDelay = INTER_WAVE_FRAMES;
      // Bonus for completing wave
      score += 500 * currentWave;
      spawnFloatScore(W * 0.5, HORIZON_Y - 40, "WAVE BONUS +" + (500 * currentWave));
      playExplosion(false);
      return;
    }

    // Spawn ships from current wave formation
    if (waveShipsRemaining > 0 && spawnTimer <= 0) {
      var formation = getWaveFormation(currentWave);
      var type = formation[formation.length - waveShipsRemaining];
      spawnShip(type);
      waveShipsRemaining -= 1;
      spawnTimer = 60 + (Math.random() * 60) | 0; // 1-2 seconds between ships in wave
    } else if (spawnTimer > 0) {
      spawnTimer -= 1;
    }

    // Check if all ships in wave have been spawned and all are gone
    if (waveShipsRemaining === 0 && ships.length === 0) {
      waveComplete = true;
    }

    // Command ship: 1 per wave after wave 2, spawns at random time
    if (currentWave >= 3 && !commandShipSpawnedThisWave && Math.random() < 0.001) {
      spawnShip(SHIP_COMMAND);
      commandShipSpawnedThisWave = true;
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
    var skyColor = classicMode ? "#000800" : COL_SKY;
    var oceanTop = classicMode ? "#003300" : COL_OCEAN_TOP;
    var oceanBot = classicMode ? "#001a00" : COL_OCEAN_BOT;
    var horizonColor = classicMode ? "#00aa00" : COL_HORIZON;

    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, W, HORIZON_Y);

    var grad = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    grad.addColorStop(0, oceanTop);
    grad.addColorStop(1, oceanBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

    ctx.strokeStyle = horizonColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    ctx.lineTo(W, HORIZON_Y);
    ctx.stroke();

    // subtle wave ticks
    ctx.strokeStyle = classicMode ? "rgba(0, 170, 0, 0.12)" : "rgba(60, 160, 200, 0.18)";
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
    ctx.strokeStyle = classicMode ? "rgba(0, 100, 0, 0.06)" : "rgba(40, 120, 180, 0.08)";
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
    var shipColor = s.color;
    var fillColor = classicMode ? "rgba(0, 20, 0, 0.5)" : "rgba(10, 30, 50, 0.55)";
    var strokeStyle = classicMode ? "#00ff00" : shipColor;
    
    if (classicMode) {
      strokeStyle = "#00ff00";
      if (s.type === SHIP_COMMAND) {
        strokeStyle = "#ffff00";
      }
    }
    
    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = classicMode ? 1 : 1.5;
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
      ctx.fillStyle = classicMode ? "#ffff00" : COL_SHIP_CMD;
      ctx.fillRect(x - 2, y - s.h - 6, 4, 4);
    }
  }

  function drawTorpedo(t) {
    var torpColor = classicMode ? "#00ff88" : COL_TORP;
    var trailColor = classicMode ? "rgba(0, 255, 136, 0.4)" : "rgba(124, 245, 255, 0.55)";
    
    // Draw dashed wake line from tube to torpedo
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = classicMode ? 1 : 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(t.x, TORPEDO_START_Y);
    ctx.lineTo(t.x, t.y + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = torpColor;
    ctx.fillStyle = torpColor;
    ctx.lineWidth = classicMode ? 1 : 1.5;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 10);
    ctx.lineTo(t.x - 3, t.y + 4);
    ctx.lineTo(t.x + 3, t.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawDepthCharge(d) {
    var dcColor = classicMode ? "#ff4400" : COL_DEPTH;
    ctx.strokeStyle = dcColor;
    ctx.lineWidth = classicMode ? 1 : 1.5;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 8);
    ctx.lineTo(d.x, d.y + 8);
    ctx.stroke();
    
    // Danger zone indicator (expanding ring)
    if (d.y > HORIZON_Y + 20) {
      var dangerRadius = 55 * (1 - (SUB_Y - 8 - d.y) / (SUB_Y - 8 - HORIZON_Y - 20));
      if (dangerRadius > 0 && dangerRadius < 55) {
        ctx.strokeStyle = classicMode ? "rgba(255, 68, 0, 0.4)" : "rgba(255, 68, 100, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(W * 0.5, SUB_Y - 10, dangerRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawExplosion(e) {
    var expColor = e.color;
    if (classicMode) {
      expColor = e.color === COL_DEPTH ? "#ff4400" : "#ff8800";
    }
    ctx.strokeStyle = expColor;
    ctx.lineWidth = classicMode ? 1.5 : 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawFloatScore(f) {
    var fsColor = classicMode ? "#ffff00" : "#ffd27c";
    ctx.fillStyle = fsColor.replace(")", "," + (f.life / 48).toFixed(2) + ")").replace("rgb", "rgba");
    if (classicMode) {
      ctx.fillStyle = "rgba(255, 255, 0," + (f.life / 48).toFixed(2) + ")";
    } else {
      ctx.fillStyle = "rgba(255, 210, 124," + (f.life / 48).toFixed(2) + ")";
    }
    ctx.font = "12px " + (classicMode ? "VT323" : "Segoe UI, Tahoma, sans-serif");
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
  }

  function drawCrosshair() {
    var x = aimX;
    var y = HORIZON_Y - 36;
    var crosshairColor = classicMode ? "#00ff00" : COL_CYAN;
    var crosshairDim = classicMode ? "rgba(0, 255, 0, 0.25)" : COL_CYAN_DIM;

    ctx.strokeStyle = crosshairColor;
    ctx.lineWidth = classicMode ? 1 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Stadia marks for lead estimation (at 10°, 20°, 30° angles)
    var stadiaAngles = [-0.52, -0.35, -0.17, 0.17, 0.35, 0.52]; // radians
    var stadiaRadius = 16;
    ctx.lineWidth = 1;
    for (var i = 0; i < stadiaAngles.length; i++) {
      var ang = stadiaAngles[i];
      var sx = x + Math.cos(ang) * stadiaRadius;
      var sy = y + Math.sin(ang) * stadiaRadius;
      var ex = x + Math.cos(ang) * (stadiaRadius + 6);
      var ey = y + Math.sin(ang) * (stadiaRadius + 6);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // Range tick marks on horizontal axis
    for (var tx = -26; tx <= 26; tx += 13) {
      if (tx === 0) continue;
      ctx.beginPath();
      ctx.moveTo(x + tx, y - 3);
      ctx.lineTo(x + tx, y + 3);
      ctx.stroke();
    }

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
    ctx.strokeStyle = crosshairDim;
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
    var subColor = classicMode ? "#00ff00" : COL_CYAN;
    var subFill = classicMode ? "rgba(0, 30, 0, 0.7)" : "rgba(0, 40, 60, 0.7)";
    ctx.strokeStyle = subColor;
    ctx.fillStyle = subFill;
    ctx.lineWidth = classicMode ? 1 : 1.5;
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
    var hudColor = classicMode ? "#00ff00" : COL_HUD;
    var torpColor = classicMode ? "#00ff88" : COL_TORP;
    var dimColor = classicMode ? "rgba(0, 100, 0, 0.5)" : "rgba(100, 140, 160, 0.55)";
    var fillReady = classicMode ? "rgba(0, 255, 136, 0.25)" : "rgba(124, 245, 255, 0.35)";
    var fillReload = classicMode ? "rgba(0, 30, 0, 0.5)" : "rgba(20, 40, 50, 0.5)";
    var reloadBarColor = classicMode ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 232, 255, 0.55)";
    
    ctx.strokeStyle = hudColor;
    ctx.fillStyle = hudColor;
    ctx.font = "11px " + (classicMode ? "VT323" : "Segoe UI, Tahoma, sans-serif");
    ctx.textAlign = "right";
    ctx.fillText("TUBES", baseX + 8, baseY - 10);
    for (i = 0; i < tubes.length; i++) {
      var tx = baseX - i * 18;
      var ty = baseY;
      if (tubes[i].ready) {
        ctx.strokeStyle = torpColor;
        ctx.fillStyle = fillReady;
      } else {
        ctx.strokeStyle = dimColor;
        ctx.fillStyle = fillReload;
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
        ctx.fillStyle = reloadBarColor;
        ctx.fillRect(tx - 5, ty + 10, 10 * pct, 3);
      }
    }
  }

  function drawCornerHud() {
    var hudColor = classicMode ? "#00ff00" : COL_HUD;
    ctx.fillStyle = hudColor;
    ctx.font = "13px " + (classicMode ? "VT323" : "Segoe UI, Tahoma, sans-serif");
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
      ctx.strokeStyle = hi < hull ? (classicMode ? "#00ff00" : COL_CYAN) : (classicMode ? "rgba(80, 100, 80, 0.4)" : "rgba(80, 100, 120, 0.45)");
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
    
    // Update top-center score display
    var scoreEl = document.getElementById("score-display");
    if (scoreEl) {
      scoreEl.textContent = "SCORE " + score;
    }
  }

  function clearWorld() {
    ships = [];
    torpedoes = [];
    depthCharges = [];
    explosions = [];
    floatScores = [];
    currentWave = 1;
    waveShipsRemaining = 0;
    waveComplete = false;
    interWaveDelay = 0;
    commandShipSpawnedThisWave = false;
  }

  function showMenuOverlay() {
    stopSonarPingLoop();
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
    stopSonarPingLoop();
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
    stopSonarPingLoop();
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

    var recoveryTimer = setTimeout(function () {
      if (phase === PHASE_OVER && btnStart.disabled) {
        returnToStartScreen("Tap START to play again.");
      }
    }, 8000);

    function returnToStartScreen(hint) {
      clearTimeout(recoveryTimer);
      stopSonarPingLoop();
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
        // Stay on MOAP — return to START (never endSession / clear media).
        returnToStartScreen();
      })
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        returnToStartScreen("Score save timed out — tap START to play again.");
      });
  }

  function startPatrol() {
    clearWorld();
    resetTubes();
    aimX = W * 0.5;
    hull = MAX_HULL;
    patrolFramesLeft = PATROL_SECONDS * 60;
    currentWave = 1;
    waveShipsRemaining = getWaveFormation(1).length;
    waveComplete = false;
    interWaveDelay = 0;
    commandShipSpawnedThisWave = false;
    spawnTimer = 30; // First ship spawns quickly
    updateHud();
    beginReadyCountdown(
      "PATROL " + currentWave,
      "Freighters 100 · Destroyers 250 · PT boats 500 · Command boat 1000. Lead your shots."
    );
    
    // Enable audio on first user interaction
    if (!audioEnabled) {
      audioEnabled = true;
      ensureAudioContext();
    }
  }

  function startNextWave() {
    currentWave += 1;
    waveShipsRemaining = getWaveFormation(currentWave).length;
    commandShipSpawnedThisWave = false;
    spawnTimer = 30;
    updateHud();
    beginReadyCountdown(
      "PATROL " + currentWave,
      "Wave " + currentWave + " incoming!"
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
    stopSonarPingLoop();
    phase = PHASE_MENU;
    running = false;
    clearWorld();
    setPlayingPointer(false);
    showMessages([]);
    showMenuOverlay();
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
        startSonarPingLoop();
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
  
  var btnClassicToggle = document.getElementById("btn-classic-toggle");
  if (btnClassicToggle) {
    btnClassicToggle.addEventListener("click", toggleClassicMode);
    btnClassicToggle.addEventListener("touchend", function (e) {
      e.preventDefault();
      toggleClassicMode();
    });
  }

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
