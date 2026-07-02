(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
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

  var player = { x: W / 2 - 16, y: H - 48, w: 32, h: 16, speed: 5 };
  var bullets = [];
  var invaders = [];
  var invaderDir = 1;
  var invaderSpeed = 0.35;
  var invaderDrop = 18;

  var SPRITE_PLAYER = [
    "000010000",
    "000111000",
    "001111100",
    "011111110",
  ];

  var SPRITE_INVADER_A = [
    [
      "0010100100",
      "0001111000",
      "0011111100",
      "0110110110",
      "0111111110",
      "0010010100",
      "0110000110",
    ],
    [
      "0010100100",
      "1001111001",
      "1011111101",
      "1101110111",
      "1111111111",
      "1010000101",
      "1100000011",
    ],
  ];

  var SPRITE_INVADER_B = [
    [
      "0001110000",
      "0111111100",
      "1111111110",
      "1110101110",
      "1111111110",
      "0011111100",
      "0110000110",
    ],
    [
      "0001110000",
      "1101110110",
      "1111111110",
      "1111011110",
      "1111111110",
      "0111111100",
      "1100000011",
    ],
  ];

  var SPRITE_INVADER_C = [
    [
      "0000100000",
      "0001111000",
      "0111111110",
      "1101110110",
      "1111111110",
      "0110110110",
      "0110000110",
    ],
    [
      "0000100000",
      "1001111001",
      "1111111111",
      "1110101111",
      "1111111111",
      "1010110101",
      "1100000011",
    ],
  ];

  var ROW_POINTS = [30, 20, 20, 10];
  var ROW_TYPE = [0, 0, 1, 2];

  function invaderTypeForRow(row) {
    return ROW_TYPE[row] || 2;
  }

  function spriteSetForType(type) {
    if (type === 0) {
      return SPRITE_INVADER_A;
    }
    if (type === 1) {
      return SPRITE_INVADER_B;
    }
    return SPRITE_INVADER_C;
  }

  function parsePatternRow(row) {
    var out = [];
    var i;
    for (i = 0; i < row.length; i++) {
      out.push(row.charAt(i) === "1" ? 1 : 0);
    }
    return out;
  }

  function drawPattern(rows, x, y, px, color) {
    var ry;
    var rx;
    ctx.fillStyle = color;
    for (ry = 0; ry < rows.length; ry++) {
      var line = parsePatternRow(rows[ry]);
      for (rx = 0; rx < line.length; rx++) {
        if (line[rx]) {
          ctx.fillRect(x + rx * px, y + ry * px, px, px);
        }
      }
    }
  }

  function patternSize(rows, px) {
    var maxW = 0;
    var i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].length > maxW) {
        maxW = rows[i].length;
      }
    }
    return { w: maxW * px, h: rows.length * px };
  }

  function drawSpriteCentered(rows, cx, cy, px, color) {
    var size = patternSize(rows, px);
    drawPattern(rows, cx - size.w / 2, cy - size.h / 2, px, color);
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
    var typeHue = [160, 190, 280, 310];
    var baseHue = typeHue[inv.type + 1] || 310;
    var danger = clamp01((inv.y - 40) / (player.y - 120));
    var hue = lerp(baseHue, 4, danger * 0.92);
    var sat = lerp(72, 96, danger);
    var light = lerp(62, 48 + inv.type * 4, danger * 0.35);
    return "hsl(" + Math.round(hue) + "," + Math.round(sat) + "%," + Math.round(light) + "%)";
  }

  function initInvaders() {
    invaders = [];
    var row;
    var col;
    for (row = 0; row < 4; row++) {
      for (col = 0; col < 10; col++) {
        invaders.push({
          x: 48 + col * 56,
          y: 48 + row * 40,
          w: 36,
          h: 24,
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
    var px = 3;
    var cx = player.x + player.w / 2;
    var cy = player.y + player.h / 2 + 2;
    drawSpriteCentered(SPRITE_PLAYER, cx, cy, px, "#5f8");
    ctx.fillStyle = "#8fc";
    ctx.fillRect(player.x + player.w / 2 - 1, player.y - 4, 2, 4);
  }

  function drawInvader(inv) {
    var sets = spriteSetForType(inv.type);
    var frameIdx = Math.floor(animFrame / 28) % 2;
    var rows = sets[frameIdx];
    var px = 3;
    var cx = inv.x + inv.w / 2;
    var cy = inv.y + inv.h / 2;
    drawSpriteCentered(rows, cx, cy, px, invaderColor(inv));
  }

  function draw() {
    ctx.fillStyle = "#020208";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(80, 120, 255, 0.08)";
    var star;
    for (star = 0; star < 40; star++) {
      ctx.fillRect((star * 97) % W, (star * 53 + frame) % H, 2, 2);
    }

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
      ctx.fillRect(bullets[i].x, bullets[i].y, bullets[i].w, bullets[i].h);
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
    player.x = W / 2 - 16;
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
