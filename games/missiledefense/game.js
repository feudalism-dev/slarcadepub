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
  var CITY_BONUS_SCORES = [2000, 5000, 10000];
  var KILL_POINTS = 25;
  var SAUCER_POINTS = 125;
  var BOMBER_POINTS = 50;
  var SPLIT_CHANCE = 0.28;
  var SPLIT_CHANCE_WAVE1 = 0.1;
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
  var flyers = [];
  var waveSpawnsLeft = 0;
  var flyerSpawnsLeft = 0;
  var spawnTimer = 0;
  var spawnInterval = 55;
  var flyerSpawnTimer = 0;
  var flyerSpawnInterval = 320;
  var cityBonusesClaimed = 0;
  var bonusFlashTimer = 0;
  var bonusFlashText = "";

  var FLYER_SAUCER = "saucer";
  var FLYER_BOMBER = "bomber";

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

  function reviveOneCity() {
    var i;
    for (i = 0; i < cities.length; i++) {
      if (!cities[i].alive) {
        cities[i].alive = true;
        return true;
      }
    }
    return false;
  }

  function checkCityBonuses() {
    var i;
    for (i = cityBonusesClaimed; i < CITY_BONUS_SCORES.length; i++) {
      if (score < CITY_BONUS_SCORES[i]) {
        return;
      }
      cityBonusesClaimed = i + 1;
      if (reviveOneCity()) {
        bonusFlashText = "BONUS CITY — " + CITY_BONUS_SCORES[i] + " pts!";
        bonusFlashTimer = 150;
        updateHud();
      }
    }
  }

  function checkAllCitiesLost() {
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    if (aliveCities() > 0) {
      return;
    }
    gameOver("cities");
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
    var speed = 0.82 + (wave - 1) * 0.08 + Math.random() * 0.15;
    enemyMissiles.push({
      x: sx,
      y: sy,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      trail: [],
      split: true,
    });
  }

  function maxFlyersForWave() {
    if (wave < 3) {
      return 0;
    }
    if (wave < 6) {
      return 1;
    }
    return 2;
  }

  function flyerSpawnsForWave() {
    if (wave < 3) {
      return 0;
    }
    if (wave < 6) {
      return 1;
    }
    return 2;
  }

  function spawnFlyer() {
    if (flyerSpawnsLeft <= 0 || flyers.length >= maxFlyersForWave()) {
      return false;
    }
    var fromLeft = Math.random() < 0.5;
    var isSaucer = wave >= 6 && Math.random() < 0.38;
    var y = 44 + Math.random() * 48;
    var speed = isSaucer ? 2.1 + wave * 0.05 : 1.0 + wave * 0.04;
    if (!fromLeft) {
      speed = -speed;
    }
    var flyer = {
      type: isSaucer ? FLYER_SAUCER : FLYER_BOMBER,
      x: fromLeft ? -28 : W + 28,
      y: y,
      vx: speed,
      w: isSaucer ? 22 : 26,
      h: isSaucer ? 10 : 12,
      dropTimer: 60 + Math.floor(Math.random() * 50),
      dropInterval: Math.max(90, 150 - wave * 4),
      dropsLeft: isSaucer ? 0 : Math.min(3, 1 + Math.floor(wave / 4)),
    };
    flyers.push(flyer);
    return true;
  }

  function dropBombFromFlyer(f) {
    var target = pickTarget();
    var tx = target.x + target.w * 0.5;
    var ty = target.y + target.h * 0.5;
    var dx = tx - f.x;
    var dy = ty - f.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      len = 1;
    }
    var speed = 0.7 + (wave - 1) * 0.06 + Math.random() * 0.12;
    enemyMissiles.push({
      x: f.x,
      y: f.y + f.h * 0.5,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      trail: [],
      split: false,
    });
  }

  function destroyFlyerAt(i, x, y) {
    var f = flyers[i];
    score += f.type === FLYER_SAUCER ? SAUCER_POINTS : BOMBER_POINTS;
    flyers.splice(i, 1);
    addExplosion(x, y, f.type === FLYER_SAUCER ? 34 : EXP_MAX_R);
    updateHud();
    checkCityBonuses();
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
    if (m.split && Math.random() < (wave === 1 ? SPLIT_CHANCE_WAVE1 : SPLIT_CHANCE)) {
      splitMissile(m);
    }
    enemyMissiles.splice(i, 1);
    addExplosion(x, y, EXP_MAX_R);
    updateHud();
    checkCityBonuses();
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
    checkAllCitiesLost();
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
      for (j = flyers.length - 1; j >= 0; j--) {
        var f = flyers[j];
        var fx = f.x + f.w * 0.5;
        var fy = f.y + f.h * 0.5;
        if (dist(fx, fy, e.x, e.y) < e.r) {
          destroyFlyerAt(j, fx, fy);
        }
      }
    }
  }

  function updateFlyers() {
    var i;
    for (i = flyers.length - 1; i >= 0; i--) {
      var f = flyers[i];
      f.x += f.vx;
      if (f.type === FLYER_BOMBER && f.dropsLeft > 0) {
        f.dropTimer--;
        if (f.dropTimer <= 0) {
          dropBombFromFlyer(f);
          f.dropsLeft--;
          f.dropTimer = f.dropInterval;
        }
      }
      if (f.x < -40 || f.x > W + 40) {
        flyers.splice(i, 1);
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
    return 4 + (wave - 1) * 2;
  }

  function checkWaveComplete() {
    if (waveSpawnsLeft > 0) {
      return;
    }
    if (enemyMissiles.length > 0) {
      return;
    }
    if (flyers.length > 0) {
      return;
    }
    if (interceptors.length > 0 || explosions.length > 0) {
      return;
    }
    if (aliveCities() === 0) {
      gameOver("cities");
      return;
    }
    var bonus = aliveCities() * CITY_BONUS;
    score += bonus;
    checkCityBonuses();
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
    if (flyers.length > 0) {
      return;
    }
    if (totalAmmo() > 0) {
      return;
    }
    if (interceptors.length > 0 || explosions.length > 0) {
      return;
    }
    if (aliveCities() > 0) {
      gameOver("ammo");
    }
  }

  function updatePlaying() {
    frame++;

    if (bonusFlashTimer > 0) {
      bonusFlashTimer--;
      if (bonusFlashTimer === 0) {
        bonusFlashText = "";
        updateHud();
      }
    }

    if (waveSpawnsLeft > 0) {
      spawnTimer++;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnEnemy();
        waveSpawnsLeft--;
        spawnInterval = Math.max(28, spawnInterval - 1);
      }
    }

    if (wave >= 2 && flyerSpawnsLeft > 0) {
      flyerSpawnTimer++;
      if (flyerSpawnTimer >= flyerSpawnInterval) {
        flyerSpawnTimer = 0;
        if (spawnFlyer()) {
          flyerSpawnsLeft--;
        }
      }
    }

    updateFlyers();
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

  function drawFlyers() {
    var i;
    for (i = 0; i < flyers.length; i++) {
      var f = flyers[i];
      if (f.type === FLYER_SAUCER) {
        ctx.fillStyle = "#f6c";
        ctx.beginPath();
        ctx.ellipse(f.x + f.w * 0.5, f.y + f.h * 0.45, f.w * 0.5, f.h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8ef";
        ctx.fillRect(f.x + f.w * 0.35, f.y + f.h * 0.15, f.w * 0.3, 3);
        ctx.fillStyle = "#fff";
        ctx.fillRect(f.x + f.w * 0.42, f.y + f.h * 0.55, 4, 4);
        ctx.fillRect(f.x + f.w * 0.54, f.y + f.h * 0.55, 4, 4);
      } else {
        ctx.fillStyle = "#fa8";
        ctx.beginPath();
        ctx.moveTo(f.x + f.w * 0.5, f.y);
        ctx.lineTo(f.x + f.w, f.y + f.h);
        ctx.lineTo(f.x, f.y + f.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffc";
        ctx.fillRect(f.x + f.w * 0.38, f.y + f.h * 0.55, f.w * 0.24, 3);
      }
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
    drawFlyers();
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
    var line =
      "SCORE " +
      score +
      "   WAVE " +
      wave +
      "   CITIES " +
      aliveCities() +
      "/6   AMMO " +
      totalAmmo();
    if (bonusFlashTimer > 0) {
      line += "   |   " + bonusFlashText;
    }
    hud.textContent = line;
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL MISSILE DEFENSE";
    instructionsEl.textContent =
      "Click or tap to fire interceptors. Clear each wave to advance — bonus cities at 2,000 / 5,000 / 10,000 pts.";
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

  function gameOver(reason) {
    phase = PHASE_OVER;
    running = false;
    setPlayingPointer(false);
    overlay.classList.remove("hidden");
    if (reason === "cities") {
      overlayTitle.textContent = "YOU LOST";
      instructionsEl.textContent =
        "All cities destroyed. Final score: " + score + " — Wave " + wave;
    } else if (reason === "ammo") {
      overlayTitle.textContent = "GAME OVER";
      instructionsEl.textContent =
        "Out of ammunition. Final score: " + score + " — Wave " + wave;
    } else {
      overlayTitle.textContent = "GAME OVER";
      instructionsEl.textContent = "Final score: " + score + " — Wave " + wave;
    }
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
    flyers = [];
    waveSpawnsLeft = waveEnemyCount();
    flyerSpawnsLeft = flyerSpawnsForWave();
    spawnTimer = 0;
    spawnInterval = Math.max(32, 76 - wave * 5);
    flyerSpawnTimer = 0;
    flyerSpawnInterval = Math.max(220, 360 - wave * 15);
    updateHud();
    var hint =
      waveSpawnsLeft + " inbound tracks detected. Click to fire interceptors.";
    if (wave >= 2) {
      hint += " Bombers inbound.";
    }
    if (wave >= 4) {
      hint += " Saucers spotted — shoot for bonus points.";
    }
    beginReadyCountdown("WAVE " + wave, hint);
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    score = 0;
    wave = 1;
    frame = 0;
    cityBonusesClaimed = 0;
    bonusFlashTimer = 0;
    bonusFlashText = "";
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
    flyers = [];
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
