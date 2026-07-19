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

  // Fixed vertical arcade frame letterboxed in the square HUD
  var VIRTUAL_WIDTH = 224;
  var VIRTUAL_HEIGHT = 288;
  var W = VIRTUAL_WIDTH;
  var H = VIRTUAL_HEIGHT;
  var GROUND_Y = H - 22;
  var viewScale = 1;
  var viewOffsetX = 0;
  var viewOffsetY = 0;

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "levelComplete";
  var PHASE_OVER = "gameOver";

  var READY_FRAMES = 90;
  var AMMO_PER_BATTERY = 10;
  var CITY_BONUS = 100;
  var CITY_BONUS_EVERY = 10000;
  var CITY_SLOTS = 6;
  var KILL_POINTS = 25;
  var SAUCER_POINTS = 125;
  var BOMBER_POINTS = 50;
  var SPLIT_CHANCE_BASE = 0.12;
  var EXP_MAX_R = 22;
  var EXP_GROW = 0.9;
  var MISSILE_SPEED_BASE = 0.42;
  var MISSILE_SPEED_STEP = 0.055;
  var MISSILE_SPEED_CAP_WAVE = 6;
  var INTERCEPTOR_SPEED = 3.6;

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
  var spawnInterval = 90;
  var flyerSpawnTimer = 0;
  var flyerSpawnInterval = 360;
  var bonusCities = 0;
  var cityBonusesClaimed = 0;
  var bonusFlashTimer = 0;
  var bonusFlashText = "";

  var FLYER_SAUCER = "saucer";
  var FLYER_BOMBER = "bomber";

  var COL_GRID = "rgba(30, 82, 255, 0.15)";
  var COL_GROUND = "#1a8cff";
  var COL_CITY = "#00d4ff";
  var COL_CITY_FILL = "#0a2a38";
  var COL_CITY_DIM = "#1a4a66";
  var COL_TURRET = "#00ffc8";
  var COL_TURRET_FILL = "#1a222c";
  var COL_TURRET_EMPTY = "#3a5566";
  var COL_THREAT = "#ff4500";
  var COL_THREAT_SMART = "#ff0044";
  var COL_WARHEAD = "#ffff66";
  var COL_LOCK = "rgba(255, 255, 255, 0.22)";
  var COL_INTERCEPT = "#00ffcc";
  var COL_HOSTILE = "#ff2244";
  var GRID_SPACING = 40;
  var nextTrackId = 1;

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

  function resizeCanvas() {
    var displayW = canvas.clientWidth || window.innerWidth || VIRTUAL_WIDTH;
    var displayH = canvas.clientHeight || window.innerHeight || VIRTUAL_HEIGHT;
    if (displayW < 1) {
      displayW = VIRTUAL_WIDTH;
    }
    if (displayH < 1) {
      displayH = VIRTUAL_HEIGHT;
    }
    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }
    viewScale = Math.min(displayW / VIRTUAL_WIDTH, displayH / VIRTUAL_HEIGHT);
    viewOffsetX = (displayW - VIRTUAL_WIDTH * viewScale) / 2;
    viewOffsetY = (displayH - VIRTUAL_HEIGHT * viewScale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, displayW, displayH);
    ctx.translate(viewOffsetX, viewOffsetY);
    ctx.scale(viewScale, viewScale);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1 / viewScale;
    ctx.strokeRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
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
    var cityXs = [16, 44, 72, 132, 160, 188];
    var i;
    cities = [];
    for (i = 0; i < cityXs.length; i++) {
      var sid = i + 1;
      cities.push({
        x: cityXs[i],
        y: GROUND_Y - 12,
        w: 14,
        h: 12,
        alive: true,
        sectorId: "N-" + (sid < 10 ? "0" : "") + sid,
        label: "SECTOR",
      });
    }
    batteries = [
      { x: 112, y: GROUND_Y, ammo: AMMO_PER_BATTERY, maxAmmo: AMMO_PER_BATTERY, callsign: "BAT-C" },
      { x: 32, y: GROUND_Y, ammo: AMMO_PER_BATTERY, maxAmmo: AMMO_PER_BATTERY, callsign: "BAT-L" },
      { x: 192, y: GROUND_Y, ammo: AMMO_PER_BATTERY, maxAmmo: AMMO_PER_BATTERY, callsign: "BAT-R" },
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
    var nextAt = (cityBonusesClaimed + 1) * CITY_BONUS_EVERY;
    while (score >= nextAt) {
      cityBonusesClaimed++;
      bonusCities++;
      bonusFlashText = "BONUS CITY RESERVE +" + bonusCities + " (" + nextAt + ")";
      bonusFlashTimer = 150;
      nextAt = (cityBonusesClaimed + 1) * CITY_BONUS_EVERY;
      updateHud();
    }
  }

  function replenishCitiesFromReserve() {
    var revived = 0;
    while (aliveCities() < CITY_SLOTS && bonusCities > 0) {
      if (!reviveOneCity()) {
        break;
      }
      bonusCities--;
      revived++;
    }
    if (revived > 0) {
      bonusFlashText = "CITY RESERVE DEPLOYED ×" + revived;
      bonusFlashTimer = 140;
      updateHud();
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
    return { x: b.x, y: b.y, w: 4, h: 4, alive: true };
  }

  function cappedMissileSpeed() {
    var steps = wave - 1;
    if (steps > MISSILE_SPEED_CAP_WAVE - 1) {
      steps = MISSILE_SPEED_CAP_WAVE - 1;
    }
    return MISSILE_SPEED_BASE + steps * MISSILE_SPEED_STEP + Math.random() * 0.06;
  }

  function splitChanceForWave() {
    if (wave <= 1) {
      return 0.08;
    }
    var c = SPLIT_CHANCE_BASE + (wave - 2) * 0.035;
    if (c > 0.42) {
      c = 0.42;
    }
    return c;
  }

  function smartChanceForWave() {
    if (wave < 7) {
      return 0;
    }
    var c = 0.12 + (wave - 7) * 0.04;
    if (c > 0.45) {
      c = 0.45;
    }
    return c;
  }

  function spawnEnemy() {
    var target = pickTarget();
    var tx = target.x + target.w * 0.5;
    var ty = target.y + target.h * 0.5;
    var sx = 12 + Math.random() * (W - 24);
    var sy = -6;
    var dx = tx - sx;
    var dy = ty - sy;
    var len = Math.sqrt(dx * dx + dy * dy);
    var speed = cappedMissileSpeed();
    var isSmart = Math.random() < smartChanceForWave();
    enemyMissiles.push({
      x: sx,
      y: sy,
      startX: sx,
      startY: sy,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      split: true,
      smart: isSmart,
      targetX: tx,
      targetY: ty,
    });
  }

  function maxFlyersForWave() {
    if (wave < 4) {
      return 0;
    }
    if (wave < 7) {
      return 1;
    }
    if (wave < 11) {
      return 2;
    }
    if (wave < 16) {
      return 3;
    }
    return 4;
  }

  function flyerSpawnsForWave() {
    if (wave < 4) {
      return 0;
    }
    if (wave < 7) {
      return 1;
    }
    if (wave < 11) {
      return 2;
    }
    return Math.min(5, 2 + Math.floor((wave - 11) / 3));
  }

  function spawnFlyer() {
    if (flyerSpawnsLeft <= 0 || flyers.length >= maxFlyersForWave()) {
      return false;
    }
    var fromLeft = Math.random() < 0.5;
    var isSaucer = wave >= 7 && Math.random() < 0.35;
    var y = 28 + Math.random() * 36;
    var speed = isSaucer ? 1.15 + Math.min(0.35, wave * 0.015) : 0.7 + Math.min(0.25, wave * 0.012);
    if (!fromLeft) {
      speed = -speed;
    }
    var tid = nextTrackId++;
    if (nextTrackId > 99) {
      nextTrackId = 1;
    }
    var flyer = {
      type: isSaucer ? FLYER_SAUCER : FLYER_BOMBER,
      x: fromLeft ? -20 : W + 20,
      y: y,
      vx: speed,
      w: isSaucer ? 16 : 18,
      h: isSaucer ? 8 : 7,
      dropTimer: 50 + Math.floor(Math.random() * 40),
      dropInterval: Math.max(100, 160 - Math.min(40, wave * 2)),
      dropsLeft: isSaucer ? 0 : Math.min(4, 1 + Math.floor(wave / 5)),
      trackId: "TRK-" + (tid < 10 ? "0" : "") + tid,
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
    var speed = cappedMissileSpeed() * 0.9;
    enemyMissiles.push({
      x: f.x,
      y: f.y + f.h * 0.5,
      startX: f.x,
      startY: f.y + f.h * 0.5,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      split: false,
      smart: false,
      targetX: tx,
      targetY: ty,
    });
  }

  function destroyFlyerAt(i, x, y) {
    var f = flyers[i];
    score += f.type === FLYER_SAUCER ? SAUCER_POINTS : BOMBER_POINTS;
    flyers.splice(i, 1);
    addExplosion(x, y, f.type === FLYER_SAUCER ? 14 : EXP_MAX_R);
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
    if (ty > GROUND_Y - 12) {
      ty = GROUND_Y - 12;
    }
    if (ty < 24) {
      ty = 24;
    }
    var dx = tx - b.x;
    var dy = ty - b.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) {
      len = 1;
    }
    var speed = INTERCEPTOR_SPEED;
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
    var angles = [-0.4, 0.4];
    if (wave >= 9) {
      angles = [-0.5, 0, 0.5];
    }
    var i;
    var speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
    if (speed > cappedMissileSpeed() + 0.05) {
      speed = cappedMissileSpeed() + 0.05;
    }
    for (i = 0; i < angles.length; i++) {
      var base = Math.atan2(m.vy, m.vx) + angles[i];
      enemyMissiles.push({
        x: m.x,
        y: m.y,
        startX: m.x,
        startY: m.y,
        vx: Math.cos(base) * speed,
        vy: Math.sin(base) * speed,
        split: false,
        smart: false,
        targetX: m.targetX,
        targetY: m.targetY,
      });
    }
  }

  function destroyEnemyAt(i, x, y) {
    var m = enemyMissiles[i];
    score += KILL_POINTS;
    if (m.split && Math.random() < splitChanceForWave()) {
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
        if (dist(m.x, m.y, cx, cy) < 8) {
          cities[i].alive = false;
          addExplosion(cx, cy, 14);
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
      if (m.smart) {
        var tdx = m.targetX - m.x;
        var tdy = m.targetY - m.y;
        var tlen = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tlen > 1) {
          var spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
          m.vx = m.vx * 0.92 + (tdx / tlen) * spd * 0.08;
          m.vy = m.vy * 0.92 + (tdy / tlen) * spd * 0.08;
          var nlen = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
          if (nlen > 0.01) {
            m.vx = (m.vx / nlen) * spd;
            m.vy = (m.vy / nlen) * spd;
          }
        }
      }
      m.x += m.vx;
      m.y += m.vy;
      if (m.y > GROUND_Y + 8) {
        enemyMissiles.splice(i, 1);
      }
    }
    damageCities();
  }

  function waveEnemyCount() {
    // Slow ramp; soft cap — later waves add flyers / splits / smart bombs instead
    var n = 5 + Math.floor((wave - 1) * 0.55);
    if (n > 12) {
      n = 12;
    }
    return n;
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
      }
    }

    if (wave >= 4 && flyerSpawnsLeft > 0) {
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
        grabMediaFocus();
      }
      return;
    }
    if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    }
  }

  function drawTrail(trail, color, width) {
    if (!trail || trail.length < 2) {
      return;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1.5;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    var i;
    for (i = 1; i < trail.length; i++) {
      ctx.lineTo(trail[i].x, trail[i].y);
    }
    ctx.stroke();
  }

  function drawWarheadTip(x, y, vx, vy, fillColor) {
    var ang = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-2.5, 2.5);
    ctx.lineTo(-1, 0);
    ctx.lineTo(-2.5, -2.5);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  function drawCityWireframe(c) {
    var x = c.x;
    var y = c.y;
    var w = c.w;
    var h = c.h;
    // Dark cyan body fill
    ctx.fillStyle = COL_CITY_FILL;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x + 3, y + 4);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x + 6, y + 4);
    ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x + 8, y + 1);
    ctx.lineTo(x + 11, y + 1);
    ctx.lineTo(x + 11, y + 4);
    ctx.lineTo(x + w, y + 4);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    // Sharp cyan instrumentation outline
    ctx.strokeStyle = COL_CITY;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Active grid lights / windows
    ctx.fillStyle = "#ffe066";
    ctx.fillRect(x + 2, y + 6, 1, 1);
    ctx.fillRect(x + 4, y + 6, 1, 1);
    ctx.fillRect(x + 2, y + 8, 1, 1);
    ctx.fillRect(x + 4, y + 9, 1, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 9, y + 6, 1, 1);
    ctx.fillRect(x + 11, y + 6, 1, 1);
    ctx.fillRect(x + 9, y + 8, 1, 1);
    ctx.fillRect(x + 11, y + 9, 1, 1);
    ctx.fillStyle = "#7cf5ff";
    ctx.fillRect(x + 5, y + 2, 1, 1);
    ctx.fillRect(x + 9, y + 3, 1, 1);
  }

  function drawTurret(b) {
    var armed = b.ammo > 0;
    // Solid military slate core
    ctx.fillStyle = COL_TURRET_FILL;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 6);
    ctx.lineTo(b.x + 7, b.y + 2);
    ctx.lineTo(b.x + 5, b.y + 8);
    ctx.lineTo(b.x - 5, b.y + 8);
    ctx.lineTo(b.x - 7, b.y + 2);
    ctx.closePath();
    ctx.fill();
    // Tight cyan instrumentation edge
    ctx.strokeStyle = armed ? COL_TURRET : COL_TURRET_EMPTY;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Barrel assembly
    ctx.fillStyle = COL_TURRET_FILL;
    ctx.beginPath();
    ctx.moveTo(b.x - 1, b.y - 6);
    ctx.lineTo(b.x, b.y - 13);
    ctx.lineTo(b.x + 3, b.y - 10);
    ctx.lineTo(b.x + 1, b.y - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = armed ? COL_INTERCEPT : "#668899";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(b.ammo), b.x, b.y + 16);
  }

  function drawGround() {
    ctx.strokeStyle = COL_GROUND;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(26, 140, 255, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 3);
    ctx.lineTo(W, GROUND_Y + 3);
    ctx.stroke();

    var i;
    for (i = 0; i < cities.length; i++) {
      var c = cities[i];
      if (!c.alive) {
        ctx.strokeStyle = COL_CITY_DIM;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.x, GROUND_Y);
        ctx.lineTo(c.x + c.w, GROUND_Y);
        ctx.stroke();
        continue;
      }
      drawCityWireframe(c);
    }

    for (i = 0; i < batteries.length; i++) {
      drawTurret(batteries[i]);
    }
  }

  function drawExplosions() {
    var i;
    for (i = 0; i < explosions.length; i++) {
      var e = explosions[i];
      var r = Math.max(1, e.r);
      var fade = e.growing ? 1 : Math.max(0.15, e.r / e.maxR);

      ctx.beginPath();
      ctx.strokeStyle = "rgba(0, 255, 255, " + (0.2 * fade) + ")";
      ctx.lineWidth = 1.5;
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "rgba(0, 220, 255, " + (0.55 * fade) + ")";
      ctx.lineWidth = 1.5;
      ctx.arc(e.x, e.y, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = fade > 0.4 ? "#e8ffff" : "rgba(200, 255, 255, 0.7)";
      ctx.arc(e.x, e.y, Math.max(1, r * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFlyerTag(f) {
    var flash = Math.floor(frame / 8) % 2 === 0;
    if (!flash) {
      return;
    }
    var tagX = f.x + f.w + 2;
    var tagY = f.y - 2;
    if (tagX > W - 36) {
      tagX = f.x - 38;
    }
    ctx.strokeStyle = COL_HOSTILE;
    ctx.lineWidth = 1;
    ctx.strokeRect(tagX, tagY, 34, 11);
    ctx.fillStyle = COL_HOSTILE;
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText(f.trackId || "HOSTILE", tagX + 2, tagY + 9);
  }

  function drawFlyers() {
    var i;
    for (i = 0; i < flyers.length; i++) {
      var f = flyers[i];
      var cx = f.x + f.w * 0.5;
      var cy = f.y + f.h * 0.5;
      var facing = f.vx >= 0 ? 1 : -1;

      if (f.type === FLYER_SAUCER) {
        // Flat hexagonal stealth drone
        ctx.fillStyle = "#121820";
        ctx.strokeStyle = "#8899aa";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 8 * facing, cy);
        ctx.lineTo(cx - 4 * facing, cy - 3);
        ctx.lineTo(cx + 4 * facing, cy - 3);
        ctx.lineTo(cx + 8 * facing, cy);
        ctx.lineTo(cx + 4 * facing, cy + 3);
        ctx.lineTo(cx - 4 * facing, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COL_HOSTILE;
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      } else {
        // Sharp dark delta-wing
        ctx.fillStyle = "#0e141c";
        ctx.strokeStyle = "#667788";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + 9 * facing, cy);
        ctx.lineTo(cx - 7 * facing, cy - 4);
        ctx.lineTo(cx - 3 * facing, cy);
        ctx.lineTo(cx - 7 * facing, cy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COL_HOSTILE;
        ctx.fillRect(cx + 2 * facing - 1, cy - 1, 2, 2);
      }
      drawFlyerTag(f);
    }
  }

  function drawThreatLocks() {
    var i;
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = COL_LOCK;
    ctx.lineWidth = 1;
    for (i = 0; i < enemyMissiles.length; i++) {
      var m = enemyMissiles[i];
      if (m.targetX === undefined || m.targetY === undefined) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.targetX, m.targetY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawMissiles() {
    var i;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    drawThreatLocks();

    for (i = 0; i < enemyMissiles.length; i++) {
      var m = enemyMissiles[i];
      ctx.beginPath();
      ctx.strokeStyle = m.smart ? COL_THREAT_SMART : COL_THREAT;
      ctx.lineWidth = 1.5;
      ctx.moveTo(m.startX, m.startY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      drawWarheadTip(m.x, m.y, m.vx, m.vy, COL_WARHEAD);
    }

    for (i = 0; i < interceptors.length; i++) {
      var p = interceptors[i];
      drawTrail(p.trail, COL_INTERCEPT, 1.5);
      drawWarheadTip(p.x, p.y, p.vx, p.vy, "#ffffff");
    }
  }

  var starField = null;

  function ensureStarField() {
    if (starField) {
      return;
    }
    starField = [];
    var i;
    for (i = 0; i < 48; i++) {
      starField.push({
        x: Math.random() * W,
        y: Math.random() * (GROUND_Y - 6),
        s: Math.random() < 0.18 ? 2 : 1,
        bright: Math.random() < 0.22,
      });
    }
  }

  function drawRadarFrame() {
    var tick;
    var step = 20;
    ctx.strokeStyle = "rgba(100, 140, 200, 0.45)";
    ctx.fillStyle = "rgba(140, 180, 230, 0.55)";
    ctx.lineWidth = 1;
    ctx.font = "7px monospace";
    ctx.textAlign = "left";

    // Outer monitor frame
    ctx.strokeStyle = "rgba(80, 120, 180, 0.5)";
    ctx.strokeRect(0.5, 0.5, W - 1, GROUND_Y - 1);

    // Top / bottom latitude ticks + numbers
    for (tick = 0; tick <= W; tick += step) {
      ctx.beginPath();
      ctx.moveTo(tick, 0);
      ctx.lineTo(tick, 4);
      ctx.moveTo(tick, GROUND_Y);
      ctx.lineTo(tick, GROUND_Y - 4);
      ctx.stroke();
      if (tick > 0 && tick < W) {
        ctx.fillText(String(tick), tick + 1, 9);
      }
    }

    // Left / right longitude ticks + numbers
    ctx.textAlign = "left";
    for (tick = 0; tick <= GROUND_Y; tick += step) {
      ctx.beginPath();
      ctx.moveTo(0, tick);
      ctx.lineTo(4, tick);
      ctx.moveTo(W, tick);
      ctx.lineTo(W - 4, tick);
      ctx.stroke();
      if (tick > 8 && tick < GROUND_Y - 4) {
        ctx.fillText(String(tick), 5, tick + 3);
      }
    }

    // Corner crosshairs
    ctx.strokeStyle = "rgba(0, 220, 255, 0.55)";
    var corners = [
      [6, 6],
      [W - 6, 6],
      [6, GROUND_Y - 6],
      [W - 6, GROUND_Y - 6],
    ];
    var ci;
    for (ci = 0; ci < corners.length; ci++) {
      var cx = corners[ci][0];
      var cy = corners[ci][1];
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy + 4);
      ctx.stroke();
    }
  }

  function drawRadarGrid() {
    var g;
    ctx.strokeStyle = COL_GRID;
    ctx.lineWidth = 1;
    for (g = GRID_SPACING; g < W; g += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, GROUND_Y);
      ctx.stroke();
    }
    for (g = GRID_SPACING; g < GROUND_Y; g += GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(W, g);
      ctx.stroke();
    }
    drawRadarFrame();
  }

  function drawBackground() {
    ensureStarField();
    ctx.fillStyle = "#050a12";
    ctx.fillRect(0, 0, W, H);
    var i;
    for (i = 0; i < starField.length; i++) {
      var st = starField[i];
      ctx.fillStyle = st.bright ? "#c8d8f0" : "#4a5a78";
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    drawRadarGrid();
  }

  function draw() {
    resizeCanvas();
    drawBackground();
    drawGround();
    drawFlyers();
    drawMissiles();
    drawExplosions();
    if (phase === PHASE_READY && readyTimer > 0) {
      ctx.fillStyle = "rgba(5, 10, 18, 0.45)";
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
      "   SECTORS " +
      aliveCities() +
      "/" +
      CITY_SLOTS +
      "   RESERVE " +
      bonusCities +
      "   AMMO " +
      totalAmmo();
    if (bonusFlashTimer > 0) {
      line += "   |   " + bonusFlashText;
    }
    hud.textContent = line;
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "TACTICAL DEFENSE";
    instructionsEl.textContent =
      "Command console: click to fire interceptors. Infinite waves. Bonus city every " +
      CITY_BONUS_EVERY +
      " pts (held in reserve, deployed at wave start).";
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
      "Score: " +
      score +
      " (+" +
      bonus +
      " city bonus). Ammo refilled. City reserve: " +
      bonusCities +
      ".";
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
        "All strategic sectors destroyed. Final score: " + score + " — Wave " + wave;
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

    var recoveryTimer = setTimeout(function () {
      if (phase === PHASE_OVER && btnStart.disabled) {
        returnToStartScreen("Tap START to play again.");
      }
    }, 8000);

    function returnToStartScreen(hint) {
      clearTimeout(recoveryTimer);
      phase = PHASE_MENU;
      running = false;
      interceptors = [];
      explosions = [];
      enemyMissiles = [];
      flyers = [];
      setPlayingPointer(false);
      showMenuOverlay();
      if (hint) {
        endHintEl.textContent = hint;
      } else if (score > 0) {
        endHintEl.textContent = "Last score: " + score + " — tap START to play again.";
      }
      refreshLeaderboard();
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
        returnToStartScreen();
      })
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        returnToStartScreen("Score save timed out — tap START to play again.");
      });
  }

  function startWave() {
    interceptors = [];
    explosions = [];
    enemyMissiles = [];
    flyers = [];
    replenishCitiesFromReserve();
    waveSpawnsLeft = waveEnemyCount();
    flyerSpawnsLeft = flyerSpawnsForWave();
    spawnTimer = 0;
    spawnInterval = Math.max(72, 118 - wave * 2);
    flyerSpawnTimer = 0;
    flyerSpawnInterval = Math.max(280, 420 - wave * 6);
    updateHud();
    var hint =
      waveSpawnsLeft + " inbound tracks. Speed capped — later waves add bombers, splits & smart bombs.";
    if (wave >= 4) {
      hint += " Bombers inbound.";
    }
    if (wave >= 7) {
      hint += " Saucers & smart bombs active.";
    }
    beginReadyCountdown("WAVE " + wave, hint);
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    nextTrackId = 1;
    score = 0;
    wave = 1;
    frame = 0;
    bonusCities = 0;
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
    var sx = (cx - rect.left) * (canvas.width / rect.width);
    var sy = (cy - rect.top) * (canvas.height / rect.height);
    return {
      x: (sx - viewOffsetX) / viewScale,
      y: (sy - viewOffsetY) / viewScale,
    };
  }

  function onFire(ev) {
    grabMediaFocus();
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    ev.preventDefault();
    var p = canvasCoords(ev);
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
      return;
    }
    fireInterceptor(p.x, p.y);
  }

  function syncPlayerLine() {
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  window.addEventListener("click", grabMediaFocus);
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
