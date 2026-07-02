(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var overlay = document.getElementById("overlay");
  var btnStart = document.getElementById("btn-start");
  var hud = document.getElementById("hud");
  var personalEl = document.getElementById("personal-score");
  var unavailableEl = document.getElementById("scores-unavailable");
  var leaderboardEl = document.getElementById("leaderboard");
  var messagesEl = document.getElementById("game-messages");
  var playerLine = document.getElementById("player-line");

  var W = canvas.width;
  var H = canvas.height;

  var keys = {};
  var running = false;
  var score = 0;
  var lives = 3;
  var frame = 0;
  var lastShot = 0;

  var player = { x: W / 2 - 16, y: H - 48, w: 32, h: 16, speed: 5 };
  var bullets = [];
  var invaders = [];
  var invaderDir = 1;
  var invaderSpeed = 0.35;
  var invaderDrop = 18;

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
        });
      }
    }
    invaderDir = 1;
    invaderSpeed = 0.35;
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
    if (!enabled) {
      return "Your personal high score: —";
    }
    if (!scoreVal) {
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
      li.innerHTML =
        '<span class="rank">' +
        e.rank +
        ".</span><span class="name"></span><span class="score"></span>";
      li.querySelector(".name").textContent = e.name;
      li.querySelector(".score").textContent = String(e.score);
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
    hud.textContent = "SCORE " + score + "   LIVES " + lives;
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

  function update() {
    if (!running) {
      return;
    }
    frame++;

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
          score += 100;
          updateHud();
          break;
        }
      }
    }

    if (aliveInvaders() === 0) {
      initInvaders();
      invaderSpeed += 0.15;
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#3f8";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    ctx.fillStyle = "#f55";
    var i;
    for (i = 0; i < invaders.length; i++) {
      if (invaders[i].alive) {
        ctx.fillRect(invaders[i].x, invaders[i].y, invaders[i].w, invaders[i].h);
      }
    }

    ctx.fillStyle = "#ff8";
    for (i = 0; i < bullets.length; i++) {
      ctx.fillRect(bullets[i].x, bullets[i].y, bullets[i].w, bullets[i].h);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    overlay.classList.remove("hidden");
    btnStart.textContent = "SESSION ENDING…";
    btnStart.disabled = true;
    overlay.querySelector("p:nth-of-type(1)").textContent =
      "Game Over — Score: " + score;

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
        overlay.querySelector("p:nth-of-type(2)").textContent =
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

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    score = 0;
    lives = 3;
    frame = 0;
    bullets = [];
    player.x = W / 2 - 16;
    initInvaders();
    updateHud();
    running = true;
    overlay.classList.add("hidden");
    btnStart.disabled = false;
    btnStart.textContent = "START";
    overlay.querySelector("p:nth-of-type(1)").textContent =
      "Arrow keys or A/D to move. Space to fire.";
    showMessages([]);
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
  });
  window.addEventListener("keyup", function (e) {
    keys[e.key] = false;
  });

  btnStart.addEventListener("click", startGame);

  window.addEventListener("message", function () {
    syncPlayerLine();
    refreshLeaderboard();
  });

  syncPlayerLine();
  refreshLeaderboard();
  requestAnimationFrame(loop);
})();
