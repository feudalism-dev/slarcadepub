(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var btnStart = document.getElementById("btn-start");
  var btnNext = document.getElementById("btn-next");
  var btnQuit = document.getElementById("btn-quit");
  var hud = document.getElementById("hud");
  var personalEl = document.getElementById("personal-score");
  var unavailableEl = document.getElementById("scores-unavailable");
  var leaderboardEl = document.getElementById("leaderboard");
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

  var player = { x: W / 2 - 40, y: H - 56, w: 80, h: 60, speed: 5 };
  var bullets = [];
  var invaders = [];
  var invaderDir = 1;
  var invaderSpeed = 0.35;
  var invaderDrop = 18;

  var atlas = window.InvadersSprites;
  var spriteSheet = new Image();
  var spritesReady = false;
  spriteSheet.onload = function () {
    spritesReady = true;
  };
  spriteSheet.src = atlas.sheet;

  var bgImage = new Image();
  var bgReady = false;
  bgImage.onload = function () {
    bgReady = true;
  };
  bgImage.src = "background.jpg";

  var ROW_POINTS = [30, 20, 20, 10];
  var INVADER_DISPLAY = [
    { w: 44, h: 36 },
    { w: 48, h: 40 },
    { w: 52, h: 44 },
    { w: 56, h: 48 },
  ];
  var PLAYER_DISPLAY = { w: 80, h: 60 };

  function invaderTypeForRow(row) {
    return row;
  }

  function invaderSprite(row, frame, color) {
    var i;
    for (i = 0; i < atlas.invaders.length; i++) {
      var s = atlas.invaders[i];
      if (s.row === row && s.frame === frame && s.color === color) {
        return s;
      }
    }
    return atlas.invaders[0];
  }

  function drawSprite(src, dx, dy, dw, dh) {
    if (!spritesReady || !src) {
      return;
    }
    ctx.drawImage(spriteSheet, src.x, src.y, src.w, src.h, dx, dy, dw, dh);
  }

  function drawSpriteCentered(src, cx, cy, dw, dh) {
    drawSprite(src, cx - dw / 2, cy - dh / 2, dw, dh);
  }

  function initInvaders() {
    invaders = [];
    var row;
    var col;
    for (row = 0; row < 4; row++) {
      var disp = INVADER_DISPLAY[row];
      for (col = 0; col < 10; col++) {
        invaders.push({
          x: 48 + col * 56,
          y: 48 + row * 44,
          w: disp.w,
          h: disp.h,
          alive: true,
          row: row,
          type: invaderTypeForRow(row),
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

  function formatPersonal(scoreVal, enabled) {
    if (!enabled || !scoreVal) {
      return "Your personal high score: —";
    }
    return "Your personal high score: " + scoreVal;
  }

  function renderLeaderboard(data) {
    var enabled = !!data.scoresEnabled;
    personalEl.textContent = formatPersonal(data.personalScore || 0, enabled);

    if (!enabled || data.unavailableMessage) {
      unavailableEl.textContent =
        data.unavailableMessage || SLArcade.SCORES_UNAVAILABLE_MSG;
      unavailableEl.classList.remove("hidden");
      leaderboardEl.innerHTML = "";
      return;
    }

    unavailableEl.classList.add("hidden");
    leaderboardEl.innerHTML = "";
    var entries = data.entries || [];
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

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL INVADERS";
    instructionsEl.textContent =
      "Arrow keys or A/D to move. Space to fire.";
    endHintEl.textContent = "";
    btnStart.disabled = false;
    btnStart.textContent = "START";
    setOverlayButtons(true, false);
    setQuitVisible(false);
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
    setQuitVisible(true);
  }

  function updatePlaying() {
    frame++;
    animFrame++;

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
          if (invaders[i].y + invaders[i].h >= player.y) {
            gameOver();
            return;
          }
        }
      }
      invaderSpeed += 0.04;
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
    var frameIdx = Math.floor(animFrame / 40) % 2;
    var src = atlas.player[frameIdx] || atlas.player[0];
    var cx = player.x + player.w / 2;
    var cy = player.y + player.h / 2;
    drawSpriteCentered(src, cx, cy, PLAYER_DISPLAY.w, PLAYER_DISPLAY.h);
  }

  function drawInvader(inv) {
    var frameIdx = Math.floor(animFrame / 28) % 2;
    var src = invaderSprite(inv.type, frameIdx, 0);
    var cx = inv.x + inv.w / 2;
    var cy = inv.y + inv.h / 2;
    drawSpriteCentered(src, cx, cy, inv.w, inv.h);
  }

  function drawBullet(b) {
    if (!spritesReady) {
      ctx.fillStyle = "#8cf";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      return;
    }
    var src = atlas.bullet;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(
      spriteSheet,
      src.x,
      src.y,
      src.w,
      src.h,
      -8,
      -src.w * 0.45,
      16,
      src.w * 0.9
    );
    ctx.restore();
  }

  function drawOverlayBadge(kind) {
    var src = kind === "level" ? atlas.levelComplete : atlas.gameOver;
    if (!spritesReady || !src) {
      return;
    }
    drawSpriteCentered(src, W / 2, H * 0.38, 120, 130);
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

    if (phase === PHASE_LEVEL) {
      drawOverlayBadge("level");
    } else if (phase === PHASE_OVER) {
      drawOverlayBadge("over");
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
    btnStart.textContent = "SESSION ENDING…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setQuitVisible(false);

    SLArcade.submitScore(score)
      .then(function (result) {
        showMessages(result.messages || []);
        if (result.unavailableMessage) {
          unavailableEl.textContent = result.unavailableMessage;
          unavailableEl.classList.remove("hidden");
        }
        return refreshLeaderboard();
      })
      .then(function () {
        endHintEl.textContent =
          "Click the arcade cabinet in-world to play again.";
        setTimeout(function () {
          SLArcade.endSession().catch(function () {});
        }, 6000);
      })
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        setTimeout(function () {
          SLArcade.endSession().catch(function () {});
        }, 6000);
      });
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
    lives = 3;
    level = 1;
    frame = 0;
    animFrame = 0;
    showMessages([]);
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

  window.addEventListener("message", function () {
    syncPlayerLine();
    refreshLeaderboard();
  });

  syncPlayerLine();
  refreshLeaderboard();
  showMenuOverlay();
  requestAnimationFrame(loop);
})();
