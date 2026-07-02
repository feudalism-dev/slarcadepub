(function () {
  "use strict";

  SLArcade.registerGameId("invaders");

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
  var PHASE_OVER = "gameOver";

  var READY_FRAMES = 120;
  var RESPAWN_FRAMES = 90;
  var STARTING_LIVES = 3;

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

  var player = { x: W / 2 - 22, y: H - 52, w: 44, h: 28, speed: 5 };
  var bullets = [];
  var invaders = [];
  var invaderDir = 1;
  var invaderSpeed = 0.35;
  var invaderDrop = 18;

  var bgImage = new Image();
  var bgReady = false;
  bgImage.onload = function () {
    bgReady = true;
  };
  bgImage.src = "background.jpg";

  var ROW_POINTS = [30, 20, 20, 10];
  var INVADER_PIXEL = [3, 3, 3, 3];

  // SL Starfighter — compact wedge (11×8)
  var PLAYER_SHIP = [
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  ];

  // Row 0 — Prism Drone: floating crystal (not crab-shaped)
  var ALIEN_PRISM = [
    [
      [0, 0, 1, 0, 0, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0, 0],
      [0, 0, 1, 0, 1, 0, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 1, 0],
    ],
    [
      [0, 0, 1, 0, 0, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 0, 0],
      [1, 0, 0, 1, 0, 1, 0, 0, 1],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
    ],
  ];

  // Row 1 — Bolt Mite: asymmetric zig-scanner
  var ALIEN_BOLT = [
    [
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
      [0, 1, 1, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    ],
    [
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
      [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
    ],
  ];

  // Row 2 — Void Jelly: bell body with dangling tendrils
  var ALIEN_JELLY = [
    [
      [0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 1, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
    ],
    [
      [0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 1, 0, 1, 0, 1, 0, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 1],
      [0, 0, 1, 0, 0, 0, 1, 0, 0],
    ],
  ];

  // Row 3 — Hex Warden: wide armored hex (slow heavy row)
  var ALIEN_HEX = [
    [
      [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    ],
    [
      [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
      [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0],
      [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
    ],
  ];

  var ALIEN_SETS = [ALIEN_PRISM, ALIEN_BOLT, ALIEN_JELLY, ALIEN_HEX];

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

  function alienFrames(type) {
    return ALIEN_SETS[type] || ALIEN_PRISM;
  }

  function invaderSpriteSize(type) {
    var px = INVADER_PIXEL[type] || 3;
    var frames = alienFrames(type);
    return pixelSpriteSize(frames[0], px);
  }

  function clamp01(v) {
    if (v < 0) {
      return 0;
    }
    if (v > 1) {
      return 1;
    }
    return v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function invaderColor(inv) {
    var typeHue = [165, 200, 280, 32];
    var baseHue = typeHue[inv.type] || 200;
    var danger = clamp01((inv.y - 40) / (player.y - 120));
    var hue = lerp(baseHue, 6, danger * 0.85);
    var sat = lerp(70, 95, danger);
    var light = lerp(58, 46, danger * 0.4);
    return "hsl(" + Math.round(hue) + "," + Math.round(sat) + "%," + Math.round(light) + "%)";
  }

  function initInvaders() {
    invaders = [];
    var row;
    var col;
    for (row = 0; row < 4; row++) {
      var size = invaderSpriteSize(row);
      for (col = 0; col < 10; col++) {
        invaders.push({
          x: 48 + col * 56,
          y: 48 + row * 44,
          w: size.w,
          h: size.h,
          alive: true,
          row: row,
          type: row,
        });
      }
    }
    invaderDir = 1;
    invaderSpeed = 0.35 + (level - 1) * 0.12;
  }

  function aliveInvaders() {
    var n = 0;
    var i;
    for (i = 0; i < invaders.length; i++) {
      if (invaders[i].alive) {
        n++;
      }
    }
    return n;
  }

  var lastLeaderboardData = null;

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

  function renderLeaderboard(data) {
    lastLeaderboardData = data;
    updateStartScores(data);
    renderLeaderboardList(data.entries || []);
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

  function setStartScreenExtras(visible) {
    startScoresEl.classList.toggle("hidden", !visible);
    btnLeaderboard.classList.toggle("hidden", !visible);
    if (!visible) {
      closeLeaderboardModal();
    }
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

  function refreshLeaderboard() {
    return SLArcade.getLeaderboard()
      .then(renderLeaderboard)
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        startScoresEl.classList.add("hidden");
      });
  }

  function updateHud() {
    hud.textContent =
      "SCORE " + score + "   LEVEL " + level + "   LIVES " + lives;
  }

  function setOverlayButtons(showStart, showNext) {
    btnStart.classList.toggle("hidden", !showStart);
    btnNext.classList.toggle("hidden", !showNext);
  }

  function setQuitVisible(visible) {
    btnQuit.classList.toggle("hidden", !visible);
  }

  function showPendingSaveOverlay() {
    phase = PHASE_OVER;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SAVING SCORE";
    instructionsEl.textContent = "Writing your score to the leaderboard…";
    endHintEl.textContent = "This only takes a moment.";
    btnStart.textContent = "PLEASE WAIT…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(false);
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL INVADERS";
    instructionsEl.textContent =
      "Arrow keys or A/D to move. Space to fire.";
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
    instructionsEl.textContent =
      hintText || "Invaders are lining up… stand by!";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
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
    if (frame - lastShot < 12) {
      return;
    }
    lastShot = frame;
    bullets.push({
      x: player.x + player.w / 2 - 2,
      y: player.y - 8,
      w: 4,
      h: 12,
      vy: -8,
    });
  }

  function showLevelComplete() {
    phase = PHASE_LEVEL;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "LEVEL " + level + " COMPLETE!";
    instructionsEl.textContent = "Score: " + score + " — take a breath, then continue.";
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT LEVEL";
    setOverlayButtons(false, true);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function loseLife() {
    if (playerInvuln > 0 || phase !== PHASE_PLAYING) {
      return;
    }
    lives--;
    updateHud();
    bullets = [];
    if (lives <= 0) {
      gameOver();
      return;
    }
    player.x = W / 2 - player.w / 2;
    playerInvuln = RESPAWN_FRAMES;
    beginReadyCountdown(
      "SHIP HIT!",
      lives + (lives === 1 ? " life" : " lives") + " remaining — get back in there!"
    );
    readyTimer = RESPAWN_FRAMES;
  }

  function checkPlayerHit() {
    if (playerInvuln > 0) {
      return;
    }
    var i;
    for (i = 0; i < invaders.length; i++) {
      var inv = invaders[i];
      if (!inv.alive) {
        continue;
      }
      if (rectsOverlap(player, inv)) {
        loseLife();
        return;
      }
      if (inv.y + inv.h >= player.y) {
        loseLife();
        return;
      }
    }
  }

  function updatePlaying() {
    frame++;
    animFrame++;

    if (playerInvuln > 0) {
      playerInvuln--;
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

    var i;
    for (i = bullets.length - 1; i >= 0; i--) {
      bullets[i].y += bullets[i].vy;
      if (bullets[i].y < -20) {
        bullets.splice(i, 1);
      }
    }

    var edge = false;
    var minX = W;
    var maxX = 0;
    for (i = 0; i < invaders.length; i++) {
      if (!invaders[i].alive) {
        continue;
      }
      invaders[i].x += invaderDir * invaderSpeed;
      if (invaders[i].x < minX) {
        minX = invaders[i].x;
      }
      if (invaders[i].x + invaders[i].w > maxX) {
        maxX = invaders[i].x + invaders[i].w;
      }
    }
    if (minX < 16 || maxX > W - 16) {
      invaderDir = -invaderDir;
      edge = true;
    }
    if (edge) {
      for (i = 0; i < invaders.length; i++) {
        if (invaders[i].alive) {
          invaders[i].y += invaderDrop;
        }
      }
      invaderSpeed += 0.04;
      checkPlayerHit();
      if (phase !== PHASE_PLAYING) {
        return;
      }
    }

    checkPlayerHit();
    if (phase !== PHASE_PLAYING) {
      return;
    }

    for (i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      var j;
      for (j = 0; j < invaders.length; j++) {
        var inv = invaders[j];
        if (!inv.alive) {
          continue;
        }
        if (rectsOverlap(b, inv)) {
          inv.alive = false;
          bullets.splice(i, 1);
          score += ROW_POINTS[inv.row] || 10;
          updateHud();
          break;
        }
      }
    }

    if (aliveInvaders() === 0) {
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
    drawPixelSpriteCentered(PLAYER_SHIP, cx, cy, 4, "#6f9");
    ctx.fillStyle = "#9fd";
    ctx.fillRect(cx - 1, player.y - 5, 2, 4);
  }

  function drawInvader(inv) {
    var frames = alienFrames(inv.type);
    var frameIdx = Math.floor(animFrame / 28) % 2;
    var matrix = frames[frameIdx];
    var px = INVADER_PIXEL[inv.type] || 3;
    var cx = inv.x + inv.w / 2;
    var cy = inv.y + inv.h / 2;
    drawPixelSpriteCentered(matrix, cx, cy, px, invaderColor(inv));
  }

  function drawBullet(b) {
    ctx.fillStyle = "#8ef";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(b.x + 1, b.y + 2, b.w - 2, b.h - 4);
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
    ctx.fillStyle = "rgba(0, 8, 24, 0.18)";
    ctx.fillRect(0, 0, W, H);
  }

  function draw() {
    drawBackground();

    var i;
    for (i = 0; i < invaders.length; i++) {
      if (invaders[i].alive) {
        drawInvader(invaders[i]);
      }
    }

    if (phase !== PHASE_MENU && phase !== PHASE_OVER) {
      drawPlayerShip();
    }

    ctx.fillStyle = "#ff8";
    for (i = 0; i < bullets.length; i++) {
      drawBullet(bullets[i]);
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

  function gameOver() {
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
      enablePlayAgain("Tap PLAY AGAIN for another round.");
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

  function enablePlayAgain(hint) {
    btnStart.textContent = "PLAY AGAIN";
    btnStart.disabled = false;
    endHintEl.textContent = hint || "Tap PLAY AGAIN for another round.";
  }

  function startLevelAfterReady(title, hint) {
    bullets = [];
    player.x = W / 2 - player.w / 2;
    updateHud();
    beginReadyCountdown(title, hint);
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    score = 0;
    lives = STARTING_LIVES;
    level = 1;
    frame = 0;
    animFrame = 0;
    playerInvuln = 0;
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    initInvaders();
    startLevelAfterReady("GET READY!", "First wave incoming…");
  }

  function nextLevel() {
    level++;
    initInvaders();
    startLevelAfterReady(
      "GET READY!",
      "Level " + level + " — invaders move faster!"
    );
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    phase = PHASE_MENU;
    running = false;
    bullets = [];
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
    showPendingSaveOverlay();
  } else {
    showMenuOverlay();
  }
  requestAnimationFrame(loop);
})();
