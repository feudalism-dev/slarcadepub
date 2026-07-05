(function () {
  "use strict";

  SLArcade.registerGameId("galaslian");

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

  var READY_FRAMES = 120;
  var RESPAWN_FRAMES = 90;
  var STARTING_LIVES = 3;
  var LIFE_BONUS_SCORES = [2000, 5000, 10000];
  var CONTINUE_TIMEOUT_MS = 30000;

  var MODE_FORMATION = "formation";
  var MODE_DIVING = "diving";
  var MODE_RETURNING = "returning";

  var ROW_POINTS = [150, 100, 80, 60];
  var ROW_COLS = [4, 10, 10, 10];
  var ENEMY_PIXEL = [4, 3, 3, 3];

  var keys = {};
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

  var diveTimer = 0;
  var diveInterval = 150;
  var maxDivers = 1;
  var enemyShotTimer = 0;
  var enemyShotInterval = 140;
  var formationBob = 0;

  var player = { x: W / 2 - 22, y: H - 52, w: 44, h: 28, speed: 5.5 };
  var playerBullets = [];
  var enemyBullets = [];
  var enemies = [];

  var bgImage = new Image();
  var bgReady = false;
  bgImage.onload = function () {
    bgReady = true;
  };
  bgImage.src = "background.jpg";

  // Player — needle interceptor
  var PLAYER_SHIP = [
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 0, 1, 1, 1, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0, 0, 1, 0, 0],
  ];

  // Row 0 — Nova Commander (wide crest, original)
  var ENEMY_COMMANDER = [
    [
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 1, 1, 1, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    ],
    [
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
    ],
  ];

  // Row 1 — Comet Striker
  var ENEMY_STRIKER = [
    [
      [0, 0, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [0, 1, 0, 0, 0, 1, 0],
    ],
    [
      [0, 0, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 0],
      [1, 0, 0, 1, 0, 0, 1],
    ],
  ];

  // Row 2 — Pulse Skirmisher
  var ENEMY_SKIRMISHER = [
    [
      [0, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0],
      [1, 0, 0, 0, 1],
    ],
    [
      [0, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1],
      [0, 1, 0, 1, 0],
    ],
  ];

  // Row 3 — Dart Scout
  var ENEMY_SCOUT = [
    [
      [0, 1, 1, 0],
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [0, 1, 1, 0],
    ],
    [
      [0, 1, 1, 0],
      [1, 1, 1, 1],
      [0, 1, 1, 0],
      [1, 0, 0, 1],
    ],
  ];

  var ENEMY_SETS = [ENEMY_COMMANDER, ENEMY_STRIKER, ENEMY_SKIRMISHER, ENEMY_SCOUT];
  var lastLeaderboardData = null;

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
    drawPixelSprite(
      matrix,
      cx - size.w / 2,
      cy - size.h / 2,
      pixelSize,
      color
    );
  }

  function enemyFrames(type) {
    return ENEMY_SETS[type] || ENEMY_SCOUT;
  }

  function enemySpriteSize(type) {
    var px = ENEMY_PIXEL[type] || 3;
    return pixelSpriteSize(enemyFrames(type)[0], px);
  }

  function enemyColor(row, diving) {
    var hues = [300, 25, 195, 130];
    var hue = hues[row] || 200;
    if (diving) {
      hue = (hue + 40) % 360;
    }
    return "hsl(" + hue + ",85%," + (diving ? "62%" : "52%") + ")";
  }

  function levelParams() {
    maxDivers = 1 + Math.floor((level - 1) / 2);
    if (maxDivers > 3) {
      maxDivers = 3;
    }
    diveInterval = Math.max(55, 150 - (level - 1) * 12);
    enemyShotInterval = Math.max(70, 140 - (level - 1) * 8);
  }

  function initFormation() {
    enemies = [];
    var row;
    var col;
    for (row = 0; row < 4; row++) {
      var cols = ROW_COLS[row];
      var size = enemySpriteSize(row);
      var totalW = cols * 56;
      var startX = (W - totalW) / 2;
      for (col = 0; col < cols; col++) {
        var hx = startX + col * 56 + size.w / 2;
        var hy = 56 + row * 48 + size.h / 2;
        enemies.push({
          row: row,
          type: row,
          alive: true,
          mode: MODE_FORMATION,
          homeX: hx,
          homeY: hy,
          x: hx,
          y: hy,
          w: size.w,
          h: size.h,
          diveT: 0,
          diveAmp: 2.2 + row * 0.4,
          diveSpeed: 2.4 + level * 0.35,
        });
      }
    }
    diveTimer = 0;
    enemyShotTimer = 0;
    levelParams();
  }

  function aliveEnemies() {
    var n = 0;
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) {
        n++;
      }
    }
    return n;
  }

  function diversActive() {
    var n = 0;
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.alive && (e.mode === MODE_DIVING || e.mode === MODE_RETURNING)) {
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
    if (diversActive() >= maxDivers) {
      return;
    }
    var candidates = formationCandidates();
    if (!candidates.length) {
      return;
    }
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    pick.mode = MODE_DIVING;
    pick.diveT = 0;
    pick.diveSpeed = 2.4 + level * 0.35 + Math.random() * 0.8;
  }

  function tryEnemyShot() {
    var shooters = [];
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      if (e.mode === MODE_DIVING || e.mode === MODE_FORMATION) {
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
      vy: 3.2 + level * 0.25,
    });
  }

  function updateEnemies() {
    formationBob = Math.sin(animFrame / 40) * 2;
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      if (e.mode === MODE_FORMATION) {
        e.x = e.homeX + formationBob;
        e.y = e.homeY;
      } else if (e.mode === MODE_DIVING) {
        e.diveT++;
        e.y += e.diveSpeed;
        e.x = e.homeX + Math.sin(e.diveT / 8) * (18 + e.diveAmp * 6);
        if (e.y > H - 80) {
          e.mode = MODE_RETURNING;
          e.diveT = 0;
        }
      } else if (e.mode === MODE_RETURNING) {
        e.diveT++;
        var dy = e.homeY - e.y;
        var dx = e.homeX - e.x;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < e.diveSpeed * 1.5) {
          e.x = e.homeX;
          e.y = e.homeY;
          e.mode = MODE_FORMATION;
        } else {
          e.x += (dx / dist) * e.diveSpeed;
          e.y += (dy / dist) * e.diveSpeed;
        }
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

  function fire() {
    if (frame - lastShot < 14) {
      return;
    }
    lastShot = frame;
    playerBullets.push({
      x: player.x + player.w / 2 - 2,
      y: player.y - 8,
      w: 4,
      h: 12,
      vy: -9,
    });
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

  function updateHud() {
    var line = "SCORE " + score + "   WAVE " + level + "   LIVES " + lives;
    if (phase === PHASE_PLAYING && running) {
      line += "   ·   ESC = QUIT";
    }
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
      " remaining. Score " +
      score +
      " — Wave " +
      level +
      ". Formation holds — same wave continues.";
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
      "Wave " + level + " — watch for diving ships!"
    );
    readyTimer = RESPAWN_FRAMES;
  }

  function loseLife() {
    if (playerInvuln > 0 || phase !== PHASE_PLAYING) {
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
    if (playerInvuln > 0) {
      return;
    }
    var i;
    var hit = {
      x: player.x,
      y: player.y,
      w: player.w,
      h: player.h,
    };
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      var box = {
        x: e.x - e.w / 2,
        y: e.y - e.h / 2,
        w: e.w,
        h: e.h,
      };
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
    overlayTitle.textContent = "GALASLIAN";
    instructionsEl.textContent =
      "Dodge diving ships and their fire. Clear the formation to advance waves.";
    endHintEl.textContent = "";
    btnStart.disabled = false;
    btnStart.textContent = "START";
    setOverlayButtons(true, false);
    setStartScreenExtras(true);
    setQuitVisible(true);
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
    instructionsEl.textContent = hintText || "Formation inbound…";
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
    instructionsEl.textContent = "Score: " + score + " — the next formation dives faster.";
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
    if (keys[" "] || keys.Spacebar) {
      fire();
    }

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

    updateEnemies();

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
          e.alive = false;
          playerBullets.splice(i, 1);
          score += ROW_POINTS[e.row] || 50;
          checkLifeBonuses();
          updateHud();
          break;
        }
      }
    }

    checkPlayerHit();
    if (phase !== PHASE_PLAYING) {
      return;
    }

    if (aliveEnemies() === 0) {
      showLevelComplete();
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
    if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    } else if (phase === PHASE_READY) {
      updateReady();
    }
  }

  function drawPlayerShip() {
    if (playerInvuln > 0 && Math.floor(playerInvuln / 6) % 2 === 0) {
      return;
    }
    var cx = player.x + player.w / 2;
    var cy = player.y + player.h / 2;
    drawPixelSpriteCentered(PLAYER_SHIP, cx, cy, 4, "#6fc");
    ctx.fillStyle = "#aff";
    ctx.fillRect(cx - 1, player.y - 5, 2, 4);
  }

  function drawEnemy(e) {
    var frames = enemyFrames(e.type);
    var frameIdx = Math.floor(animFrame / 24) % 2;
    var matrix = frames[frameIdx];
    var px = ENEMY_PIXEL[e.type] || 3;
    var diving = e.mode === MODE_DIVING || e.mode === MODE_RETURNING;
    drawPixelSpriteCentered(matrix, e.x, e.y, px, enemyColor(e.row, diving));
  }

  function drawBackground() {
    if (!bgReady) {
      ctx.fillStyle = "#020208";
      ctx.fillRect(0, 0, W, H);
      return;
    }
    var iw = bgImage.width;
    var ih = bgImage.height;
    var scale = Math.max(W / iw, H / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (W - dw) / 2;
    var dy = (H - dh) / 2;
    ctx.drawImage(bgImage, dx, dy, dw, dh);
    ctx.fillStyle = "rgba(0, 8, 24, 0.22)";
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    drawBackground();
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) {
        drawEnemy(enemies[i]);
      }
    }
    if (phase !== PHASE_MENU && phase !== PHASE_OVER && phase !== PHASE_DIED) {
      drawPlayerShip();
    }
    ctx.fillStyle = "#8ef";
    for (i = 0; i < playerBullets.length; i++) {
      var pb = playerBullets[i];
      ctx.fillRect(pb.x, pb.y, pb.w, pb.h);
    }
    ctx.fillStyle = "#f84";
    for (i = 0; i < enemyBullets.length; i++) {
      var eb = enemyBullets[i];
      ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
    }
    if (phase === PHASE_READY && readyTimer > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 0, W, H);
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
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    initFormation();
    startLevelAfterReady("GET READY!", "Wave 1 — formation holding… for now.");
  }

  function nextLevel() {
    level++;
    initFormation();
    startLevelAfterReady(
      "GET READY!",
      "Wave " + level + " — more divers, faster shots!"
    );
  }

  function quitGame() {
    if (phase === PHASE_OVER) {
      return;
    }
    resetDeathContinue();
    if (phase === PHASE_MENU) {
      SLArcade.endSession().catch(function () {});
      return;
    }
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
