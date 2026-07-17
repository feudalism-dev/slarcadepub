(function () {
  "use strict";

  SLArcade.registerGameId("galactic");

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

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "levelComplete";
  var PHASE_DIED = "died";
  var PHASE_OVER = "gameOver";
  var PHASE_CHALLENGE_END = "challengeEnd";

  var MODE_ENTERING = "entering";
  var MODE_FORMATION = "formation";
  var MODE_DIVING = "diving";
  var MODE_RETURNING = "returning";
  var MODE_CHALLENGE = "challenge";
  var MODE_TRACTOR = "tractor";

  var READY_FRAMES = 120;
  var RESPAWN_FRAMES = 90;
  var STARTING_LIVES = 3;
  var LIFE_BONUS_SCORES = [3000, 7000, 15000, 30000];
  var CONTINUE_TIMEOUT_MS = 30000;
  var MAX_PLAYER_SHOTS = 2;
  var MAX_PLAYER_SHOTS_DUAL = 4;

  // Galaga-style formation: Boss / Butterfly / Bee
  var TYPE_BOSS = 0;
  var TYPE_BUTTERFLY = 1;
  var TYPE_BEE = 2;
  var ROW_TYPES = [TYPE_BOSS, TYPE_BUTTERFLY, TYPE_BUTTERFLY, TYPE_BEE, TYPE_BEE];
  var ROW_COLS = [4, 8, 8, 10, 10];
  var ROW_POINTS_FORM = [150, 80, 80, 50, 50];
  var ROW_POINTS_DIVE = [400, 160, 160, 100, 100];
  var ENEMY_PIXEL = [3, 3, 3];

  var keys = {};
  var mouseFire = false;
  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var lives = 3;
  var level = 1;
  var frame = 0;
  var lastShot = 0;
  var readyTimer = 0;
  var animFrame = 0;
  var playerInvuln = 0;
  var lifeBonusesClaimed = 0;
  var bonusFlashTimer = 0;
  var bonusFlashText = "";
  var continueDeadline = 0;
  var continueTimerId = null;
  var lastLeaderboardData = null;

  var isChallenge = false;
  var challengeHits = 0;
  var challengeTotal = 0;
  var challengeBonus = 0;
  var dualFighter = false;
  var captured = false;
  var capturedBoss = null;

  var diveTimer = 0;
  var diveInterval = 110;
  var maxDivers = 2;
  var enemyShotTimer = 0;
  var enemyShotInterval = 100;
  var formationBob = 0;
  var enterQueue = [];
  var enterTimer = 0;

  var player = { x: W / 2 - 18, y: H - 56, w: 36, h: 32, speed: 5.8 };
  var playerBullets = [];
  var enemyBullets = [];
  var enemies = [];
  var explosions = [];
  var stars = [];

  // Fighter — Galaga-style twin nacelle ship
  var PLAYER_SHIP = [
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 0, 1, 1, 1, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 1],
    [0, 0, 1, 0, 0, 0, 1, 0, 0],
  ];

  // Boss Galaga
  var ENEMY_BOSS = [
    [
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
      [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    ],
    [
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
    ],
  ];

  // Butterfly
  var ENEMY_BUTTERFLY = [
    [
      [1, 0, 0, 0, 0, 0, 1],
      [0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0, 1, 0],
      [1, 0, 0, 0, 0, 0, 1],
    ],
    [
      [0, 1, 0, 0, 0, 1, 0],
      [1, 1, 1, 0, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 0, 1, 0, 1, 0, 1],
      [0, 1, 0, 0, 0, 1, 0],
    ],
  ];

  // Bee
  var ENEMY_BEE = [
    [
      [0, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 0, 0, 1],
    ],
    [
      [0, 1, 1, 1, 0],
      [1, 0, 1, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
    ],
  ];

  var ENEMY_SETS = [ENEMY_BOSS, ENEMY_BUTTERFLY, ENEMY_BEE];

  function initStars() {
    stars = [];
    var i;
    for (i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 0.4 + Math.random() * 1.8,
        v: 0.3 + Math.random() * 1.4,
        a: 0.35 + Math.random() * 0.65,
      });
    }
  }
  initStars();

  function drawPixelSprite(matrix, x, y, pixelSize, color) {
    var r;
    var c;
    ctx.fillStyle = color;
    for (r = 0; r < matrix.length; r++) {
      for (c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] === 1) {
          ctx.fillRect(x + c * pixelSize, y + r * pixelSize, pixelSize, pixelSize);
        }
      }
    }
  }

  function pixelSpriteSize(matrix, pixelSize) {
    var maxW = 0;
    var i;
    for (i = 0; i < matrix.length; i++) {
      if (matrix[i].length > maxW) {
        maxW = matrix[i].length;
      }
    }
    return { w: maxW * pixelSize, h: matrix.length * pixelSize };
  }

  function drawPixelSpriteCentered(matrix, cx, cy, pixelSize, color) {
    var size = pixelSpriteSize(matrix, pixelSize);
    drawPixelSprite(matrix, cx - size.w / 2, cy - size.h / 2, pixelSize, color);
  }

  function enemyFrames(type) {
    return ENEMY_SETS[type] || ENEMY_BEE;
  }

  function enemySpriteSize(type) {
    var px = ENEMY_PIXEL[type] || 3;
    return pixelSpriteSize(enemyFrames(type)[0], px);
  }

  function enemyColor(type, diving) {
    if (type === TYPE_BOSS) {
      return diving ? "#ff6ad5" : "#e040a0";
    }
    if (type === TYPE_BUTTERFLY) {
      return diving ? "#ffd24a" : "#e8a820";
    }
    return diving ? "#6cf" : "#2a9";
  }

  function isChallengeLevel(n) {
    return n > 0 && n % 3 === 0;
  }

  function levelParams() {
    maxDivers = 1 + Math.floor(level / 2);
    if (maxDivers > 4) {
      maxDivers = 4;
    }
    diveInterval = Math.max(40, 120 - level * 8);
    enemyShotInterval = Math.max(55, 110 - level * 6);
  }

  function spawnExplosion(x, y, color) {
    explosions.push({ x: x, y: y, t: 0, color: color || "#fff" });
  }

  function buildFormationHomes() {
    var homes = [];
    var row;
    var col;
    for (row = 0; row < ROW_TYPES.length; row++) {
      var cols = ROW_COLS[row];
      var type = ROW_TYPES[row];
      var size = enemySpriteSize(type);
      var gap = type === TYPE_BOSS ? 64 : 52;
      var totalW = cols * gap;
      var startX = (W - totalW) / 2 + gap / 2;
      for (col = 0; col < cols; col++) {
        homes.push({
          row: row,
          type: type,
          homeX: startX + col * gap,
          homeY: 52 + row * 42 + size.h / 2,
          w: size.w,
          h: size.h,
        });
      }
    }
    return homes;
  }

  function pathEnter(side, index, home) {
    var fromLeft = side === 0;
    var startX = fromLeft ? -40 : W + 40;
    var startY = 40 + (index % 5) * 18;
    return {
      sx: startX,
      sy: startY,
      mx: fromLeft ? W * 0.35 : W * 0.65,
      my: 180 + (index % 3) * 40,
      ex: home.homeX,
      ey: home.homeY,
      t: 0,
      dur: 70 + (index % 4) * 8,
    };
  }

  function initFormation() {
    enemies = [];
    enterQueue = [];
    enterTimer = 0;
    diveTimer = 0;
    enemyShotTimer = 0;
    challengeHits = 0;
    challengeBonus = 0;
    isChallenge = isChallengeLevel(level);
    levelParams();

    var homes = buildFormationHomes();
    challengeTotal = homes.length;
    var i;
    for (i = 0; i < homes.length; i++) {
      var h = homes[i];
      var side = i % 2;
      var e = {
        row: h.row,
        type: h.type,
        alive: true,
        mode: isChallenge ? MODE_CHALLENGE : MODE_ENTERING,
        homeX: h.homeX,
        homeY: h.homeY,
        x: isChallenge ? -60 : h.homeX,
        y: isChallenge ? 80 : -40,
        w: h.w,
        h: h.h,
        diveT: 0,
        diveAmp: 2.4 + h.type * 0.5,
        diveSpeed: 2.6 + level * 0.3,
        path: null,
        challengeT: 0,
        challengeLane: i,
        hasCaptured: false,
      };
      if (!isChallenge) {
        e.path = pathEnter(side, i, h);
        e.x = e.path.sx;
        e.y = e.path.sy;
        enterQueue.push(e);
      } else {
        enemies.push(e);
      }
    }
    if (!isChallenge) {
      // Release in small convoys
      for (i = 0; i < Math.min(6, enterQueue.length); i++) {
        enemies.push(enterQueue.shift());
      }
    }
  }

  function releaseEnterers() {
    if (!enterQueue.length) {
      return;
    }
    enterTimer++;
    if (enterTimer < 18) {
      return;
    }
    enterTimer = 0;
    var n = Math.min(4, enterQueue.length);
    var i;
    for (i = 0; i < n; i++) {
      enemies.push(enterQueue.shift());
    }
  }

  function bezier3(p0, p1, p2, t) {
    var u = 1 - t;
    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
  }

  function updateEntering(e) {
    var p = e.path;
    if (!p) {
      e.mode = MODE_FORMATION;
      return;
    }
    p.t++;
    var t = p.t / p.dur;
    if (t >= 1) {
      e.x = e.homeX;
      e.y = e.homeY;
      e.mode = MODE_FORMATION;
      e.path = null;
      return;
    }
    e.x = bezier3(p.sx, p.mx, p.ex, t);
    e.y = bezier3(p.sy, p.my, p.ey, t);
  }

  function aliveEnemies() {
    var n = 0;
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) {
        n++;
      }
    }
    return n + enterQueue.length;
  }

  function diversActive() {
    var n = 0;
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.alive && (e.mode === MODE_DIVING || e.mode === MODE_RETURNING || e.mode === MODE_TRACTOR)) {
        n++;
      }
    }
    return n;
  }

  function formationCandidates() {
    var list = [];
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive && enemies[i].mode === MODE_FORMATION) {
        list.push(enemies[i]);
      }
    }
    return list;
  }

  function tryStartDive() {
    if (isChallenge || enterQueue.length) {
      return;
    }
    if (diversActive() >= maxDivers) {
      return;
    }
    var candidates = formationCandidates();
    if (!candidates.length) {
      return;
    }
    // Prefer lower rows slightly
    var weights = [];
    var i;
    var total = 0;
    for (i = 0; i < candidates.length; i++) {
      var w = 1 + candidates[i].row;
      weights.push(w);
      total += w;
    }
    var pick = Math.random() * total;
    var chosen = candidates[0];
    var i;
    for (i = 0; i < candidates.length; i++) {
      pick -= weights[i];
      if (pick <= 0) {
        chosen = candidates[i];
        break;
      }
    }
    chosen.mode = MODE_DIVING;
    chosen.diveT = 0;
    chosen.diveSpeed = 2.6 + level * 0.28 + Math.random() * 0.9;
    chosen.diveAmp = 2.2 + Math.random() * 2;
    // Boss tractor chance when player not dual and not already captured
    if (
      chosen.type === TYPE_BOSS &&
      !dualFighter &&
      !captured &&
      Math.random() < 0.28
    ) {
      chosen.mode = MODE_TRACTOR;
      chosen.diveT = 0;
    }
  }

  function tryEnemyShot() {
    if (isChallenge) {
      return;
    }
    var shooters = [];
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      if (e.mode === MODE_DIVING || e.mode === MODE_FORMATION || e.mode === MODE_TRACTOR) {
        shooters.push(e);
      }
    }
    if (!shooters.length) {
      return;
    }
    var s = shooters[Math.floor(Math.random() * shooters.length)];
    enemyBullets.push({
      x: s.x - 2,
      y: s.y + s.h / 2,
      w: 4,
      h: 10,
      vy: 3.4 + level * 0.22,
    });
  }

  function updateChallengeEnemy(e) {
    e.challengeT++;
    var lane = e.challengeLane;
    var wave = Math.floor(lane / 8);
    var t = e.challengeT * 0.04 + lane * 0.35;
    var baseY = 90 + wave * 70 + Math.sin(t) * 40;
    e.x = ((lane * 73 + e.challengeT * (1.8 + wave * 0.4)) % (W + 80)) - 40;
    e.y = baseY + Math.sin(t * 1.7) * 18;
    if (e.challengeT > 520) {
      e.alive = false;
    }
  }

  function updateEnemies() {
    formationBob = Math.sin(animFrame / 36) * 3;
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      if (e.mode === MODE_ENTERING) {
        updateEntering(e);
      } else if (e.mode === MODE_FORMATION) {
        e.x = e.homeX + formationBob;
        e.y = e.homeY;
      } else if (e.mode === MODE_DIVING || e.mode === MODE_TRACTOR) {
        e.diveT++;
        e.y += e.diveSpeed;
        e.x = e.homeX + Math.sin(e.diveT / 7) * (22 + e.diveAmp * 8);
        if (e.mode === MODE_TRACTOR && e.y > H * 0.55 && e.y < H - 100) {
          // tractor beam zone — pull player if overlapping X and not invuln
          if (
            !captured &&
            !dualFighter &&
            playerInvuln <= 0 &&
            Math.abs(e.x - (player.x + player.w / 2)) < 28
          ) {
            captured = true;
            capturedBoss = e;
            e.hasCaptured = true;
            dualFighter = false;
            spawnExplosion(player.x + player.w / 2, player.y, "#6fc");
            lives--;
            updateHud();
            if (lives <= 0) {
              gameOver();
              return;
            }
            playerInvuln = RESPAWN_FRAMES;
            player.x = W / 2 - player.w / 2;
            bonusFlashText = "FIGHTER CAPTURED!";
            bonusFlashTimer = 120;
          }
        }
        if (e.y > H + 30) {
          if (e.hasCaptured && capturedBoss === e) {
            // Escaped with captive — lose capture permanently this wave
            captured = false;
            capturedBoss = null;
            e.hasCaptured = false;
          }
          e.mode = MODE_RETURNING;
          e.diveT = 0;
          e.y = -20;
          e.x = e.homeX;
        }
      } else if (e.mode === MODE_RETURNING) {
        e.diveT++;
        var dy = e.homeY - e.y;
        var dx = e.homeX - e.x;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < e.diveSpeed * 1.6) {
          e.x = e.homeX;
          e.y = e.homeY;
          e.mode = MODE_FORMATION;
        } else {
          e.x += (dx / dist) * e.diveSpeed;
          e.y += (dy / dist) * e.diveSpeed;
        }
      } else if (e.mode === MODE_CHALLENGE) {
        updateChallengeEnemy(e);
      }
    }
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function maxShots() {
    if (dualFighter) {
      return MAX_PLAYER_SHOTS_DUAL;
    }
    return MAX_PLAYER_SHOTS;
  }

  function fire() {
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    if (frame - lastShot < 12) {
      return;
    }
    if (playerBullets.length >= maxShots()) {
      return;
    }
    lastShot = frame;
    var cx = player.x + player.w / 2;
    if (dualFighter) {
      playerBullets.push({ x: cx - 14, y: player.y - 6, w: 4, h: 12, vy: -10 });
      playerBullets.push({ x: cx + 10, y: player.y - 6, w: 4, h: 12, vy: -10 });
    } else {
      playerBullets.push({ x: cx - 2, y: player.y - 8, w: 4, h: 12, vy: -10 });
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
      bonusFlashText = "EXTRA LIFE — " + LIFE_BONUS_SCORES[i] + "!";
      bonusFlashTimer = 150;
      updateHud();
    }
  }

  function updateHud() {
    var dual = dualFighter ? "  DUAL" : "";
    var line =
      "SCORE " +
      score +
      "   WAVE " +
      level +
      (isChallenge ? " CHALLENGE" : "") +
      "   LIVES " +
      lives +
      dual;
    if (bonusFlashTimer > 0) {
      line += "   |   " + bonusFlashText;
    }
    hud.textContent = line;
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

  function showDeathContinue() {
    phase = PHASE_DIED;
    running = false;
    playerBullets = [];
    enemyBullets = [];
    player.x = W / 2 - player.w / 2;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "YOU DIED!";
    instructionsEl.textContent =
      "You have " +
      lives +
      (lives === 1 ? " life" : " lives") +
      " left. Score " +
      score +
      " — Wave " +
      level +
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
    beginReadyCountdown("GET READY!", "Wave " + level + " continues!");
    readyTimer = RESPAWN_FRAMES;
  }

  function loseLife() {
    if (playerInvuln > 0 || phase !== PHASE_PLAYING) {
      return;
    }
    if (dualFighter) {
      dualFighter = false;
      playerInvuln = 45;
      spawnExplosion(player.x + player.w / 2, player.y, "#6fc");
      bonusFlashText = "DUAL FIGHTER LOST!";
      bonusFlashTimer = 90;
      updateHud();
      return;
    }
    running = false;
    lives--;
    updateHud();
    if (lives <= 0) {
      gameOver();
      return;
    }
    showDeathContinue();
  }

  function checkPlayerHit() {
    if (playerInvuln > 0 || isChallenge) {
      return;
    }
    var i;
    var hit = { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 6 };
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      if (e.mode === MODE_ENTERING || e.mode === MODE_FORMATION) {
        continue;
      }
      var box = { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h };
      if (rectsOverlap(hit, box)) {
        loseLife();
        return;
      }
    }
    for (i = 0; i < enemyBullets.length; i++) {
      if (rectsOverlap(hit, enemyBullets[i])) {
        loseLife();
        return;
      }
    }
  }

  function killEnemy(e, divingPoints) {
    e.alive = false;
    spawnExplosion(e.x, e.y, enemyColor(e.type, true));
    var pts;
    if (isChallenge) {
      pts = 100 + e.type * 50;
      challengeHits++;
    } else if (divingPoints) {
      pts = ROW_POINTS_DIVE[e.row] || 100;
    } else {
      pts = ROW_POINTS_FORM[e.row] || 50;
    }
    // Rescue captured fighter
    if (e.hasCaptured && capturedBoss === e) {
      dualFighter = true;
      captured = false;
      capturedBoss = null;
      e.hasCaptured = false;
      bonusFlashText = "DUAL FIGHTER!";
      bonusFlashTimer = 140;
      pts += 1000;
    }
    score += pts;
    checkLifeBonuses();
    updateHud();
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GALACTIC";
    instructionsEl.textContent =
      "Arrow keys or A/D to move. Space or left-click to fire. Rescue a captured fighter for dual guns. Challenge stages every 3rd wave!";
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
    instructionsEl.textContent = hintText || "Convoy inbound…";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function showLevelComplete() {
    phase = PHASE_LEVEL;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "WAVE " + level + " CLEARED!";
    instructionsEl.textContent = "Score: " + score + " — next convoy is tougher.";
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT WAVE";
    setOverlayButtons(false, true);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function showChallengeComplete() {
    phase = PHASE_CHALLENGE_END;
    running = false;
    var perfect = challengeHits >= challengeTotal;
    if (perfect) {
      challengeBonus = 10000;
    } else {
      challengeBonus = challengeHits * 100;
    }
    score += challengeBonus;
    checkLifeBonuses();
    updateHud();
    overlay.classList.remove("hidden");
    overlayTitle.textContent = perfect ? "PERFECT!" : "CHALLENGE CLEAR!";
    instructionsEl.textContent =
      "Hits: " +
      challengeHits +
      "/" +
      challengeTotal +
      " — Bonus +" +
      challengeBonus;
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT WAVE";
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

  function updatePlaying() {
    frame++;
    animFrame++;

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

    if (keys.ArrowLeft || keys.a || keys.A) {
      player.x -= player.speed;
    }
    if (keys.ArrowRight || keys.d || keys.D) {
      player.x += player.speed;
    }
    if (player.x < 8) {
      player.x = 8;
    }
    if (player.x > W - player.w - 8) {
      player.x = W - player.w - 8;
    }
    if (keys[" "] || keys.Spacebar || mouseFire) {
      fire();
    }

    releaseEnterers();

    if (!isChallenge) {
      diveTimer++;
      if (diveTimer >= diveInterval) {
        diveTimer = 0;
        tryStartDive();
      }
      enemyShotTimer++;
      if (enemyShotTimer >= enemyShotInterval) {
        enemyShotTimer = 0;
        tryEnemyShot();
      }
    }

    updateEnemies();
    if (phase !== PHASE_PLAYING) {
      return;
    }

    var i;
    for (i = playerBullets.length - 1; i >= 0; i--) {
      playerBullets[i].y += playerBullets[i].vy;
      if (playerBullets[i].y < -20) {
        playerBullets.splice(i, 1);
      }
    }
    for (i = enemyBullets.length - 1; i >= 0; i--) {
      enemyBullets[i].y += enemyBullets[i].vy;
      if (enemyBullets[i].y > H + 20) {
        enemyBullets.splice(i, 1);
      }
    }

    for (i = explosions.length - 1; i >= 0; i--) {
      explosions[i].t++;
      if (explosions[i].t > 18) {
        explosions.splice(i, 1);
      }
    }

    for (i = playerBullets.length - 1; i >= 0; i--) {
      var b = playerBullets[i];
      var j;
      for (j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (!e.alive) {
          continue;
        }
        var box = {
          x: e.x - e.w / 2,
          y: e.y - e.h / 2,
          w: e.w,
          h: e.h,
        };
        if (rectsOverlap(b, box)) {
          var diving =
            e.mode === MODE_DIVING ||
            e.mode === MODE_RETURNING ||
            e.mode === MODE_TRACTOR;
          killEnemy(e, diving);
          playerBullets.splice(i, 1);
          j = enemies.length;
        }
      }
    }

    checkPlayerHit();
    if (phase !== PHASE_PLAYING) {
      return;
    }

    if (aliveEnemies() === 0) {
      if (isChallenge) {
        showChallengeComplete();
      } else {
        showLevelComplete();
      }
    }
  }

  function updateReady() {
    frame++;
    animFrame++;
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
    var si;
    for (si = 0; si < stars.length; si++) {
      stars[si].y += stars[si].v;
      if (stars[si].y > H) {
        stars[si].y = 0;
        stars[si].x = Math.random() * W;
      }
    }
    if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    } else if (phase === PHASE_READY) {
      updateReady();
    }
  }

  function drawStarfield() {
    ctx.fillStyle = "#020208";
    ctx.fillRect(0, 0, W, H);
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.fillStyle = "rgba(220,230,255," + s.a + ")";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }

  function drawPlayerShip() {
    if (playerInvuln > 0 && Math.floor(playerInvuln / 6) % 2 === 0) {
      return;
    }
    var cx = player.x + player.w / 2;
    var cy = player.y + player.h / 2;
    if (dualFighter) {
      drawPixelSpriteCentered(PLAYER_SHIP, cx - 16, cy, 3, "#6fc");
      drawPixelSpriteCentered(PLAYER_SHIP, cx + 16, cy, 3, "#6fc");
      ctx.fillStyle = "#aff";
      ctx.fillRect(cx - 17, player.y - 4, 2, 4);
      ctx.fillRect(cx + 15, player.y - 4, 2, 4);
    } else {
      drawPixelSpriteCentered(PLAYER_SHIP, cx, cy, 4, "#6fc");
      ctx.fillStyle = "#aff";
      ctx.fillRect(cx - 1, player.y - 5, 2, 4);
    }
  }

  function drawEnemy(e) {
    var frames = enemyFrames(e.type);
    var frameIdx = Math.floor(animFrame / 20) % 2;
    var matrix = frames[frameIdx];
    var px = ENEMY_PIXEL[e.type] || 3;
    var diving =
      e.mode === MODE_DIVING ||
      e.mode === MODE_RETURNING ||
      e.mode === MODE_TRACTOR ||
      e.mode === MODE_ENTERING;
    drawPixelSpriteCentered(matrix, e.x, e.y, px, enemyColor(e.type, diving));
    if (e.mode === MODE_TRACTOR && e.y > 120) {
      ctx.strokeStyle = "rgba(255,120,220,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.h / 2);
      ctx.lineTo(player.x + player.w / 2, player.y);
      ctx.stroke();
    }
    if (e.hasCaptured) {
      drawPixelSpriteCentered(PLAYER_SHIP, e.x, e.y + e.h * 0.7, 2, "#8fd");
    }
  }

  function drawExplosions() {
    var i;
    for (i = 0; i < explosions.length; i++) {
      var ex = explosions[i];
      var r = 4 + ex.t * 1.6;
      ctx.strokeStyle = ex.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function draw() {
    drawStarfield();
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) {
        drawEnemy(enemies[i]);
      }
    }
    if (phase !== PHASE_MENU && phase !== PHASE_OVER && phase !== PHASE_DIED) {
      drawPlayerShip();
    }
    ctx.fillStyle = "#9ef";
    for (i = 0; i < playerBullets.length; i++) {
      var pb = playerBullets[i];
      ctx.fillRect(pb.x, pb.y, pb.w, pb.h);
    }
    ctx.fillStyle = "#f84";
    for (i = 0; i < enemyBullets.length; i++) {
      var eb = enemyBullets[i];
      ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
    }
    drawExplosions();
    if (phase === PHASE_READY && readyTimer > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop() {
    try {
      update();
      draw();
    } catch (err) {
      console.error("Galactic loop error:", err);
    }
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
    instructionsEl.textContent = "Final score: " + score + " — Wave " + level;
    btnStart.textContent = "SAVING…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(false);

    var hudMode = SLArcade.isHudMode();
    var canEnd = SLArcade.canEndSession() && !hudMode;
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

  function startLevelAfterReady(title, hint) {
    playerBullets = [];
    enemyBullets = [];
    explosions = [];
    player.x = W / 2 - player.w / 2;
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
    resetDeathContinue();
    score = 0;
    lives = STARTING_LIVES;
    level = 1;
    frame = 0;
    animFrame = 0;
    playerInvuln = 0;
    lifeBonusesClaimed = 0;
    bonusFlashTimer = 0;
    bonusFlashText = "";
    dualFighter = false;
    captured = false;
    capturedBoss = null;
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    initFormation();
    startLevelAfterReady(
      "GET READY!",
      isChallenge
        ? "Challenge stage — shoot for bonus!"
        : "Wave 1 — convoy incoming!"
    );
  }

  function nextLevel() {
    level++;
    captured = false;
    capturedBoss = null;
    initFormation();
    var hint;
    if (isChallenge) {
      hint = "CHALLENGE STAGE — destroy as many as you can!";
    } else {
      hint = "Wave " + level + " — more divers, faster fire!";
    }
    startLevelAfterReady(isChallenge ? "CHALLENGE!" : "GET READY!", hint);
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    resetDeathContinue();
    phase = PHASE_MENU;
    running = false;
    playerBullets = [];
    enemyBullets = [];
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
      if (phase === PHASE_PLAYING && running) {
        fire();
      }
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

  window.addEventListener("mousedown", function (e) {
    if (e.button !== 0) {
      return;
    }
    if (overlay && !overlay.classList.contains("hidden")) {
      return;
    }
    if (leaderboardModal && !leaderboardModal.classList.contains("hidden")) {
      return;
    }
    mouseFire = true;
    if (phase === PHASE_PLAYING && running) {
      fire();
    }
  });
  window.addEventListener("mouseup", function (e) {
    if (e.button === 0) {
      mouseFire = false;
    }
  });

  btnStart.addEventListener("click", startGame);
  btnStart.addEventListener("touchend", function (e) {
    e.preventDefault();
    startGame();
  });
  btnNext.addEventListener("click", nextLevel);
  btnNext.addEventListener("touchend", function (e) {
    e.preventDefault();
    nextLevel();
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

  syncPlayerLine();
  refreshLeaderboard();
  if (SLArcade.isPendingMoapSave()) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SAVING SCORE";
    instructionsEl.textContent = "Writing your score to the leaderboard…";
    btnStart.disabled = true;
  } else {
    showMenuOverlay();
  }
  requestAnimationFrame(loop);
})();
