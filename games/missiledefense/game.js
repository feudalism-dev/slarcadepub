(function () {
  "use strict";

  SLArcade.registerGameId("missiledefense");

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

  var W = canvas.width;
  var H = canvas.height;
  var GROUND_Y = H - 48;

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "levelComplete";
  var PHASE_OVER = "gameOver";

  var READY_FRAMES = 90;
  var AMMO_PER_BATTERY = 10;
  var CITY_BONUS = 100;
  var KILL_POINTS = 25;
  var SPLIT_CHANCE = 0.35;
  var EXP_MAX_R = 42;
  var EXP_GROW = 1.8;

  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var wave = 1;
  var frame = 0;
  var readyTimer = 0;
  var lastLeaderboardData = null;

  var cities = [];
  var batteries = [];
  var interceptors = [];
  var explosions = [];
  var enemyMissiles = [];
  var waveSpawnsLeft = 0;
  var spawnTimer = 0;
  var spawnInterval = 55;

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

  function dist(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function aliveCities() {
    var n = 0;
    var i;
    for (i = 0; i < cities.length; i++) {
      if (cities[i].alive) {
        n++;
      }
    }
    return n;
  }

  function totalAmmo() {
    var n = 0;
    var i;
    for (i = 0; i < batteries.length; i++) {
      n += batteries[i].ammo;
    }
    return n;
  }

  function initLayout() {
    var cityXs = [72, 168, 264, 504, 600, 696];
    var i;
    cities = [];
    for (i = 0; i < cityXs.length; i++) {
      cities.push({
        x: cityXs[i],
        y: GROUND_Y - 18,
        w: 36,
        h: 18,
        alive: true,
      });
    }
    batteries = [
      { x: 384, y: GROUND_Y, ammo: AMMO_PER_BATTERY, maxAmmo: AMMO_PER_BATTERY },
      { x: 120, y: GROUND_Y, ammo: AMMO_PER_BATTERY, maxAmmo: AMMO_PER_BATTERY },
      { x: 648, y: GROUND_Y, ammo: AMMO_PER_BATTERY, maxAmmo: AMMO_PER_BATTERY },
    ];
  }

  function refillAmmo() {
    var i;
    for (i = 0; i < batteries.length; i++) {
      batteries[i].ammo = batteries[i].maxAmmo;
    }
  }

  function pickTarget() {
    var alive = [];
    var i;
    for (i = 0; i < cities.length; i++) {
      if (cities[i].alive) {
        alive.push(cities[i]);
      }
    }
    if (alive.length) {
      return alive[Math.floor(Math.random() * alive.length)];
    }
    var b = batteries[Math.floor(Math.random() * batteries.length)];
    return { x: b.x, y: b.y, w: 8, h: 8, alive: true };
  }

  function spawnEnemy() {
    var target = pickTarget();
    var tx = target.x + target.w * 0.5;
    var ty = target.y + target.h * 0.5;
    var sx = 40 + Math.random() * (W - 80);
    var sy = -8;
    var dx = tx - sx;
    var dy = ty - sy;
    var len = Math.sqrt(dx * dx + dy * dy);
    var speed = 1.6 + wave * 0.12 + Math.random() * 0.4;
    enemyMissiles.push({
      x: sx,
      y: sy,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      trail: [],
      split: true,
    });
  }

  function nearestBattery(px) {
    var best = -1;
    var bestD = 1e9;
    var i;
    for (i = 0; i < batteries.length; i++) {
      if (batteries[i].ammo <= 0) {
        continue;
      }
      var d = Math.abs(batteries[i].x - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function fireInterceptor(px, py) {
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    var bi = nearestBattery(px);
    if (bi < 0) {
      return;
    }
    var b = batteries[bi];
    b.ammo--;
    var tx = px;
    var ty = py;
    if (ty > GROUND_Y - 20) {
      ty = GROUND_Y - 20;
    }
    if (ty < 40) {
      ty = 40;
    }
    var dx = tx - b.x;
    var dy = ty - b.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      len = 1;
    }
    var speed = 7.5;
    interceptors.push({
      x: b.x,
      y: b.y,
      tx: tx,
      ty: ty,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      trail: [{ x: b.x, y: b.y }],
    });
    updateHud();
  }

  function addExplosion(x, y, maxR) {
    explosions.push({
      x: x,
      y: y,
      r: 2,
      maxR: maxR || EXP_MAX_R,
      growing: true,
      age: 0,
    });
  }

  function splitMissile(m) {
    var angles = [-0.45, 0, 0.45];
    var i;
    var speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy) * 1.1;
    for (i = 0; i < angles.length; i++) {
      var base = Math.atan2(m.vy, m.vx) + angles[i];
      enemyMissiles.push({
        x: m.x,
        y: m.y,
        vx: Math.cos(base) * speed,
        vy: Math.sin(base) * speed,
        trail: [],
        split: false,
      });
    }
  }

  function destroyEnemyAt(i, x, y) {
    var m = enemyMissiles[i];
    score += KILL_POINTS;
    if (m.split && Math.random() < SPLIT_CHANCE) {
      splitMissile(m);
    }
    enemyMissiles.splice(i, 1);
    addExplosion(x, y, EXP_MAX_R);
    updateHud();
  }

  function damageCities() {
    var i;
    for (i = 0; i < cities.length; i++) {
      if (!cities[i].alive) {
        continue;
      }
      var cx = cities[i].x + cities[i].w * 0.5;
      var cy = cities[i].y + cities[i].h * 0.5;
      var j;
      for (j = enemyMissiles.length - 1; j >= 0; j--) {
        var m = enemyMissiles[j];
        if (dist(m.x, m.y, cx, cy) < 14) {
          cities[i].alive = false;
          addExplosion(cx, cy, 28);
          enemyMissiles.splice(j, 1);
        }
      }
    }
  }

  function updateExplosions() {
    var i;
    for (i = explosions.length - 1; i >= 0; i--) {
      var e = explosions[i];
      e.age++;
      if (e.age > 120) {
        explosions.splice(i, 1);
        continue;
      }
      if (e.growing) {
        e.r += EXP_GROW;
        if (e.r >= e.maxR) {
          e.growing = false;
        }
      } else {
        e.r -= EXP_GROW * 0.65;
        if (e.r <= 0) {
          explosions.splice(i, 1);
          continue;
        }
      }

      var j;
      for (j = enemyMissiles.length - 1; j >= 0; j--) {
        var m = enemyMissiles[j];
        if (dist(m.x, m.y, e.x, e.y) < e.r) {
          destroyEnemyAt(j, m.x, m.y);
        }
      }
    }
  }

  function updateInterceptors() {
    var i;
    for (i = interceptors.length - 1; i >= 0; i--) {
      var p = interceptors[i];
      var prevD = dist(p.x, p.y, p.tx, p.ty);
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 12) {
        p.trail.shift();
      }
      p.x += p.vx;
      p.y += p.vy;
      var d = dist(p.x, p.y, p.tx, p.ty);
      var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (d < speed + 2 || d > prevD || p.y < -20 || p.y > H + 20) {
        addExplosion(p.tx, p.ty, EXP_MAX_R);
        interceptors.splice(i, 1);
      }
    }
  }

  function updateEnemies() {
    var i;
    for (i = enemyMissiles.length - 1; i >= 0; i--) {
      var m = enemyMissiles[i];
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 14) {
        m.trail.shift();
      }
      m.x += m.vx;
      m.y += m.vy;
      if (m.y > GROUND_Y + 10) {
        enemyMissiles.splice(i, 1);
      }
    }
    damageCities();
  }

  function waveEnemyCount() {
    return 5 + (wave - 1) * 3;
  }

  function checkWaveComplete() {
    if (waveSpawnsLeft > 0) {
      return;
    }
    if (enemyMissiles.length > 0) {
      return;
    }
    if (interceptors.length > 0 || explosions.length > 0) {
      return;
    }
    if (aliveCities() === 0) {
      gameOver();
      return;
    }
    var bonus = aliveCities() * CITY_BONUS;
    score += bonus;
    running = false;
    setPlayingPointer(false);
    showWaveComplete(bonus);
  }

  function checkAmmoExhausted() {
    if (waveSpawnsLeft > 0) {
      return;
    }
    if (enemyMissiles.length > 0) {
      return;
    }
    if (totalAmmo() > 0) {
      return;
    }
    if (interceptors.length > 0 || explosions.length > 0) {
      return;
    }
    if (aliveCities() > 0) {
      gameOver();
    }
  }

  function updatePlaying() {
    frame++;

    if (waveSpawnsLeft > 0) {
      spawnTimer++;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnEnemy();
        waveSpawnsLeft--;
        spawnInterval = Math.max(18, spawnInterval - 1);
      }
    }

    updateInterceptors();
    updateEnemies();
    updateExplosions();
    checkWaveComplete();
    checkAmmoExhausted();
  }

  function update() {
    if (phase === PHASE_READY) {
      readyTimer--;
      if (readyTimer <= 0) {
        phase = PHASE_PLAYING;
        running = true;
        overlay.classList.add("hidden");
        setPlayingPointer(true);
        setQuitVisible(true);
      }
      return;
    }
    if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    }
  }

  function drawTrail(trail, color) {
    if (!trail || trail.length < 2) {
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    var i;
    for (i = 1; i < trail.length; i++) {
      ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();
  }

  function drawGround() {
    ctx.strokeStyle = "#3cf";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();

    var i;
    for (i = 0; i < cities.length; i++) {
      var c = cities[i];
      if (!c.alive) {
        continue;
      }
      ctx.fillStyle = "#5ef";
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillRect(c.x + 6, c.y - 10, 8, 10);
      ctx.fillRect(c.x + 22, c.y - 14, 8, 14);
    }

    for (i = 0; i < batteries.length; i++) {
      var b = batteries[i];
      ctx.fillStyle = b.ammo > 0 ? "#8ef" : "#444";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - 10, b.y + 16);
      ctx.lineTo(b.x + 10, b.y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#adf";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(b.ammo), b.x, b.y + 30);
    }
  }

  function drawExplosions() {
    var i;
    for (i = 0; i < explosions.length; i++) {
      var e = explosions[i];
      var alpha = e.growing ? 1 : e.r / e.maxR;
      ctx.strokeStyle = "rgba(255, 180, 60, " + alpha + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 240, 120, " + (alpha * 0.6) + ")";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMissiles() {
    var i;
    ctx.fillStyle = "#f84";
    for (i = 0; i < enemyMissiles.length; i++) {
      var m = enemyMissiles[i];
      drawTrail(m.trail, "rgba(255, 100, 80, 0.7)");
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#8ef";
    for (i = 0; i < interceptors.length; i++) {
      var p = interceptors[i];
      drawTrail(p.trail, "rgba(120, 220, 255, 0.8)");
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#020818");
    g.addColorStop(0.55, "#081028");
    g.addColorStop(1, "#0a0a12");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    var i;
    for (i = 0; i < 40; i++) {
      var sx = ((i * 97 + wave * 13) % W);
      var sy = ((i * 53) % (GROUND_Y - 40));
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  function draw() {
    drawBackground();
    drawGround();
    drawMissiles();
    drawExplosions();
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

  function updateHud() {
    hud.textContent =
      "SCORE " +
      score +
      "   WAVE " +
      wave +
      "   CITIES " +
      aliveCities() +
      "/6   AMMO " +
      totalAmmo();
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL MISSILE DEFENSE";
    instructionsEl.textContent =
      "Click or tap to launch interceptors from the nearest battery. Warheads split when destroyed — time your blasts!";
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
    overlayTitle.textContent = titleText || "INCOMING!";
    instructionsEl.textContent = hintText || "Hostiles launching from orbit…";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
    setPlayingPointer(false);
  }

  function showWaveComplete(bonus) {
    phase = PHASE_LEVEL;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "WAVE " + wave + " CLEARED";
    instructionsEl.textContent =
      "Score: " + score + " (+" + bonus + " city bonus). Ammo refilled.";
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT WAVE";
    setOverlayButtons(false, true);
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

  function enablePlayAgain(hint) {
    btnStart.textContent = "PLAY AGAIN";
    btnStart.disabled = false;
    endHintEl.textContent = hint || "Tap PLAY AGAIN for another run.";
  }

  function gameOver() {
    phase = PHASE_OVER;
    running = false;
    setPlayingPointer(false);
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GAME OVER";
    instructionsEl.textContent = "Final score: " + score + " — Wave " + wave;
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

  function startWave() {
    interceptors = [];
    explosions = [];
    enemyMissiles = [];
    waveSpawnsLeft = waveEnemyCount();
    spawnTimer = 0;
    spawnInterval = Math.max(22, 58 - wave * 3);
    updateHud();
    beginReadyCountdown(
      "WAVE " + wave,
      waveSpawnsLeft + " inbound tracks detected. Click to fire interceptors."
    );
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    score = 0;
    wave = 1;
    frame = 0;
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    initLayout();
    refillAmmo();
    startWave();
  }

  function nextLevel() {
    wave++;
    refillAmmo();
    startWave();
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    phase = PHASE_MENU;
    running = false;
    interceptors = [];
    explosions = [];
    enemyMissiles = [];
    setPlayingPointer(false);
    showMessages([]);
    showMenuOverlay();
    SLArcade.endSession().catch(function () {});
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
    return {
      x: ((cx - rect.left) / rect.width) * W,
      y: ((cy - rect.top) / rect.height) * H,
    };
  }

  function onFire(ev) {
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    ev.preventDefault();
    var p = canvasCoords(ev);
    fireInterceptor(p.x, p.y);
  }

  function syncPlayerLine() {
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  canvas.addEventListener("mousedown", onFire);
  canvas.addEventListener("touchstart", onFire, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && phase !== PHASE_MENU && phase !== PHASE_OVER) {
      quitGame();
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
    btnStart.textContent = "PLEASE WAIT…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
  } else {
    showMenuOverlay();
  }
  requestAnimationFrame(loop);
})();
