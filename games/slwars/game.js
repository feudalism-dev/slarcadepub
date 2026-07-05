/**
 * SL Wars — Phase 1 dogfight (single-file bundle for CEF / MOAP cache-busting).
 * BUILD 24: projectVertex rotation matrix BEFORE perspective (tumbling 3D TIEs).
 */
(function () {
  "use strict";

  var BUILD_ID = "24-PROJECT-VERTEX";

  if (typeof SLArcade !== "undefined" && SLArcade.registerGameId) {
    SLArcade.registerGameId("slwars");
  }

  var PERSPECTIVE_FACTOR = 500;
  var Z_HORIZON = 1000;
  var Z_PLAYER = 0;
  /** Local model units → world units (large enough that rotation reads in depth). */
  var TIE_MODEL_SCALE = 42;
  var TIE_POOL_SIZE = 8;
  var ACTIVE_TIES = 3;
  var SPAWN_COOLDOWN = 1.4;
  var SPAWN_Z_MIN = 850;
  var SPAWN_Z_MAX = 1000;

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d", { alpha: false });
  var W = canvas.width;
  var H = canvas.height;
  var CX = W * 0.5;
  var CY = H * 0.5;

  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var instructionsEl = document.getElementById("instructions");
  var playerLine = document.getElementById("player-line");
  var btnStart = document.getElementById("btn-start");
  var btnQuit = document.getElementById("btn-quit");
  var btnLeaderboard = document.getElementById("btn-leaderboard");
  var btnModalClose = document.getElementById("btn-modal-close");
  var startScoresEl = document.getElementById("start-scores");
  var personalEl = document.getElementById("personal-score");
  var highScoreEl = document.getElementById("high-score");
  var unavailableEl = document.getElementById("scores-unavailable");
  var leaderboardEl = document.getElementById("leaderboard");
  var leaderboardModal = document.getElementById("leaderboard-modal");
  var endHintEl = document.getElementById("end-hint");
  var stateLabel = document.getElementById("state-label");

  // --- Camera ---
  var camX = 0;
  var camY = 0;
  var camTargetX = 0;
  var camTargetY = 0;

  function setSteer(nx, ny) {
    camTargetX = nx * 120;
    camTargetY = ny * 80;
  }

  function updateCamera(dt) {
    var k = 1 - Math.exp(-7 * dt);
    camX += (camTargetX - camX) * k;
    camY += (camTargetY - camY) * k;
  }

  function project(wx, wy, wz) {
    if (wz <= Z_PLAYER) {
      return null;
    }
    var scale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + wz);
    return {
      x: (wx - camX) * scale + CX,
      y: (wy - camY) * scale + CY,
      scale: scale,
    };
  }

  // --- Input ---
  var steerX = 0;
  var steerY = 0;

  function pointerToCanvas(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    var mx = ((clientX - rect.left) / rect.width) * W;
    var my = ((clientY - rect.top) / rect.height) * H;
    var nx = (mx / W) * 2 - 1;
    var ny = (my / H) * 2 - 1;
    if (nx > 1) nx = 1;
    if (nx < -1) nx = -1;
    if (ny > 1) ny = 1;
    if (ny < -1) ny = -1;
    steerX = nx;
    steerY = ny;
  }

  canvas.addEventListener("mousemove", function (e) {
    pointerToCanvas(e.clientX, e.clientY);
  });
  canvas.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches.length) {
        pointerToCanvas(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // --- Pool ---
  function createPool(factory, size) {
    var free = [];
    var active = [];
    var i;
    for (i = 0; i < size; i++) {
      free.push(factory());
    }
    return {
      active: active,
      acquire: function () {
        var obj = free.pop();
        if (!obj) {
          obj = factory();
        }
        obj.active = true;
        active.push(obj);
        return obj;
      },
      release: function (obj) {
        if (!obj.active) {
          return;
        }
        obj.active = false;
        var idx = active.indexOf(obj);
        if (idx >= 0) {
          active.splice(idx, 1);
        }
        free.push(obj);
      },
      releaseAll: function () {
        while (active.length) {
          var obj = active.pop();
          obj.active = false;
          free.push(obj);
        }
      },
    };
  }

  // --- Starfield ---
  var stars = [];
  function initStars() {
    stars = [];
    var i;
    for (i = 0; i < 160; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 500,
        z: 1 + Math.random() * (Z_HORIZON - 1),
      });
    }
  }

  function updateStars(dt) {
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z -= 420 * dt;
      if (s.z <= Z_PLAYER) {
        s.x = (Math.random() - 0.5) * 800;
        s.y = (Math.random() - 0.5) * 500;
        s.z = Z_HORIZON - Math.random() * 80;
      }
    }
  }

  function drawStars() {
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      var p = project(s.x, s.y, s.z);
      if (!p) {
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = "rgba(180,255,180," + (0.15 + p.scale * 0.85) + ")";
      ctx.lineWidth = 1 + p.scale * 2;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + 1 + p.scale * 8);
      ctx.stroke();
    }
  }

  // --- 3D TIE wireframe ---
  function buildTieWireframe() {
    var segs = [];
    function add(a, b) {
      segs.push({ p1: a, p2: b });
    }
    var podR = 1.0;
    var podZ = 0.7;
    var front = [];
    var back = [];
    var i;
    var j;
    var a;
    for (i = 0; i < 6; i++) {
      a = (i / 6) * Math.PI * 2;
      front.push([Math.cos(a) * podR, Math.sin(a) * podR, podZ]);
      back.push([Math.cos(a) * podR, Math.sin(a) * podR, -podZ]);
    }
    for (i = 0; i < 6; i++) {
      j = (i + 1) % 6;
      add(front[i], front[j]);
      add(back[i], back[j]);
      add(front[i], back[i]);
    }
    var eq = [];
    for (i = 0; i < 6; i++) {
      a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      eq.push([Math.cos(a) * podR * 1.05, Math.sin(a) * podR * 1.05, 0]);
    }
    for (i = 0; i < 6; i++) {
      add(eq[i], eq[(i + 1) % 6]);
    }

    var wingX = 3.4;
    var wingR = 2.6;
    function wingHex(xSign) {
      var pts = [];
      for (i = 0; i < 6; i++) {
        a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push([xSign * wingX, Math.cos(a) * wingR, Math.sin(a) * wingR]);
      }
      for (i = 0; i < 6; i++) {
        add(pts[i], pts[(i + 1) % 6]);
      }
      add(pts[0], pts[3]);
      add(pts[1], pts[4]);
      add(pts[2], pts[5]);
      return pts;
    }
    var left = wingHex(-1);
    var right = wingHex(1);
    var hubL = [-wingX * 0.55, 0, 0];
    var hubR = [wingX * 0.55, 0, 0];
    add([-podR, 0, 0], hubL);
    add(hubL, left[2]);
    add(hubL, left[5]);
    add([podR, 0, 0], hubR);
    add(hubR, right[2]);
    add(hubR, right[5]);
    add([0, podR * 0.4, 0], hubL);
    add([0, -podR * 0.4, 0], hubL);
    add([0, podR * 0.4, 0], hubR);
    add([0, -podR * 0.4, 0], hubR);
    return segs;
  }

  var TIE_FIGHTER_WIREFRAME = buildTieWireframe();

  /**
   * Transforms a local 3D vertex into a 2D screen coordinate.
   * 1. Scale model-space point
   * 2. Rotate by fighter.rx / ry / rz (tumbling)
   * 3. Translate to fighter world position (x, y, z)
   * 4. Perspective: scale = PF / (PF + worldZ)
   *
   * @param {number[]|{x:number,y:number,z:number}} v local vertex
   * @param {object} fighter
   * @returns {{x:number,y:number,scale:number}|null}
   */
  function projectVertex(v, fighter) {
    var lx = (v.x !== undefined ? v.x : v[0]) * TIE_MODEL_SCALE;
    var ly = (v.y !== undefined ? v.y : v[1]) * TIE_MODEL_SCALE;
    var lz = (v.z !== undefined ? v.z : v[2]) * TIE_MODEL_SCALE;

    // 1. Rotation matrices (Y → X → Z) — not a static screen-locked mesh
    var cy = Math.cos(fighter.ry);
    var sy = Math.sin(fighter.ry);
    var rx = lx * cy - lz * sy;
    var rz = lx * sy + lz * cy;
    var ry = ly;

    var cx = Math.cos(fighter.rx);
    var sx = Math.sin(fighter.rx);
    var rry = ry * cx - rz * sx;
    var rrz = ry * sx + rz * cx;
    var rrx = rx;

    var cz = Math.cos(fighter.rz);
    var sz = Math.sin(fighter.rz);
    var fx = rrx * cz - rry * sz;
    var fy = rrx * sz + rry * cz;
    var fz = rrz;

    // 2. Translate into world space (fighter position is the model origin)
    var worldX = fx + fighter.x;
    var worldY = fy + fighter.y;
    var worldZ = fz + fighter.z;

    // 3. Perspective projection (per-vertex Z, so near wing edges grow first)
    return project(worldX, worldY, worldZ);
  }

  function createTie() {
    return {
      active: false,
      x: 0,
      y: 0,
      z: Z_HORIZON,
      baseX: 0,
      baseY: 0,
      ampX: 0,
      ampY: 0,
      speed: 200,
      rx: 0,
      ry: 0,
      rz: 0,
      rotationSpeedX: 0,
      rotationSpeedY: 0,
      rotationSpeedZ: 0,
    };
  }

  function resetTie(t, z) {
    var side = Math.random() < 0.5 ? -1 : 1;
    t.z = z;
    t.baseX = side * (60 + Math.random() * 200);
    t.baseY = (Math.random() - 0.5) * 140;
    t.ampX = 40 + Math.random() * 60;
    t.ampY = 25 + Math.random() * 45;
    t.speed = 140 + Math.random() * 70;
    // Start at a random orientation so wings aren't always face-on
    t.rx = Math.random() * Math.PI * 2;
    t.ry = Math.random() * Math.PI * 2;
    t.rz = (Math.random() - 0.5) * 0.8;
    // Fast tumble — readable as 3D, not a locked billboard
    t.rotationSpeedX = (Math.random() - 0.5) * 3.5;
    t.rotationSpeedY = 1.8 + Math.random() * 2.8;
    t.rotationSpeedZ = (Math.random() - 0.5) * 2.2;
    t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
    t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;
    return t;
  }

  function updateTie(t, dt) {
    t.z -= t.speed * dt;
    t.x = t.baseX + Math.sin(t.z / 50) * t.ampX;
    t.y = t.baseY + Math.cos(t.z / 40) * t.ampY;
    t.rx += t.rotationSpeedX * dt;
    t.ry += t.rotationSpeedY * dt;
    t.rz += t.rotationSpeedZ * dt;
    return t.z <= Z_PLAYER;
  }

  /**
   * Draw TIE as 3D segments: each endpoint goes through projectVertex
   * (rotate → translate → perspective). Never a static 2D vertex map.
   */
  function drawTie(t) {
    var segs = TIE_FIGHTER_WIREFRAME;
    var centerScale = PERSPECTIVE_FACTOR / (PERSPECTIVE_FACTOR + t.z);
    var lw = centerScale > 0.4 ? 2 : 1.3;
    var i;
    ctx.beginPath();
    ctx.strokeStyle = "#66ff66";
    ctx.lineWidth = lw;
    for (i = 0; i < segs.length; i++) {
      var s = segs[i];
      var a = projectVertex(s.p1, t);
      var b = projectVertex(s.p2, t);
      if (!a || !b) {
        continue;
      }
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function drawCrosshair() {
    var hx = CX + camX * 0.08;
    var hy = CY + camY * 0.08;
    var s = 10;
    ctx.beginPath();
    ctx.strokeStyle = "#66ff66";
    ctx.lineWidth = 1.5;
    ctx.moveTo(hx - s, hy);
    ctx.lineTo(hx - 3, hy);
    ctx.moveTo(hx + 3, hy);
    ctx.lineTo(hx + s, hy);
    ctx.moveTo(hx, hy - s);
    ctx.lineTo(hx, hy - 3);
    ctx.moveTo(hx, hy + 3);
    ctx.lineTo(hx, hy + s);
    ctx.stroke();
  }

  // --- Dogfight state ---
  var ties = createPool(createTie, TIE_POOL_SIZE);
  var spawnTimer = 0;
  var drawList = [];
  var playing = false;
  var lastTime = 0;

  function trySpawn() {
    if (ties.active.length >= ACTIVE_TIES || spawnTimer > 0) {
      return;
    }
    var t = ties.acquire();
    resetTie(t, SPAWN_Z_MIN + Math.random() * (SPAWN_Z_MAX - SPAWN_Z_MIN));
    spawnTimer = SPAWN_COOLDOWN;
  }

  function enterDogfight() {
    playing = true;
    camX = 0;
    camY = 0;
    camTargetX = 0;
    camTargetY = 0;
    spawnTimer = 0;
    initStars();
    ties.releaseAll();
    var i;
    for (i = 0; i < ACTIVE_TIES; i++) {
      resetTie(
        ties.acquire(),
        SPAWN_Z_MIN + i * ((SPAWN_Z_MAX - SPAWN_Z_MIN) / ACTIVE_TIES)
      );
    }
    spawnTimer = SPAWN_COOLDOWN;
    overlay.classList.add("hidden");
    btnQuit.classList.remove("hidden");
    if (stateLabel) {
      stateLabel.textContent = "STATE: DOGFIGHT  BUILD " + BUILD_ID;
    }
  }

  function updateDogfight(dt) {
    setSteer(steerX, steerY);
    updateCamera(dt);
    updateStars(dt);
    if (spawnTimer > 0) {
      spawnTimer -= dt;
    }
    var i;
    for (i = ties.active.length - 1; i >= 0; i--) {
      var t = ties.active[i];
      if (updateTie(t, dt)) {
        ties.release(t);
      }
    }
    trySpawn();
  }

  function drawDogfight() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawStars();
    drawList.length = 0;
    var i;
    for (i = 0; i < ties.active.length; i++) {
      drawList.push(ties.active[i]);
    }
    drawList.sort(function (a, b) {
      return b.z - a.z;
    });
    for (i = 0; i < drawList.length; i++) {
      drawTie(drawList[i]);
    }
    drawCrosshair();
  }

  function loop(now) {
    if (!lastTime) {
      lastTime = now;
    }
    var dt = (now - lastTime) / 1000;
    if (dt > 0.05) {
      dt = 0.05;
    }
    lastTime = now;
    if (playing) {
      updateDogfight(dt);
      drawDogfight();
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(loop);
  }

  // --- Cabinet shell ---
  var lastLeaderboardData = null;

  function syncPlayerLine() {
    if (typeof SLArcade === "undefined") {
      return;
    }
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  function updateStartScores(data) {
    var enabled = !!data.scoresEnabled;
    personalEl.textContent =
      !enabled || !data.personalScore
        ? "Your top score: —"
        : "Your top score: " + data.personalScore;
    highScoreEl.textContent =
      !enabled || !data.entries || !data.entries.length
        ? "High score: —"
        : "High score: " + data.entries[0].score;
    if (!enabled || data.unavailableMessage) {
      unavailableEl.textContent =
        data.unavailableMessage ||
        (SLArcade && SLArcade.SCORES_UNAVAILABLE_MSG) ||
        "Scores unavailable.";
      unavailableEl.classList.remove("hidden");
      startScoresEl.classList.add("hidden");
      btnLeaderboard.classList.add("hidden");
      return;
    }
    unavailableEl.classList.add("hidden");
    startScoresEl.classList.remove("hidden");
    btnLeaderboard.classList.remove("hidden");
  }

  function renderLeaderboardList(entries) {
    leaderboardEl.innerHTML = "";
    if (!entries || !entries.length) {
      var empty = document.createElement("li");
      empty.textContent = "No scores yet — be the first!";
      leaderboardEl.appendChild(empty);
      return;
    }
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
  }

  function refreshLeaderboard() {
    if (typeof SLArcade === "undefined" || !SLArcade.getLeaderboard) {
      return;
    }
    SLArcade.getLeaderboard()
      .then(function (data) {
        lastLeaderboardData = data;
        updateStartScores(data);
        renderLeaderboardList(data.entries || []);
      })
      .catch(function () {
        unavailableEl.textContent =
          (SLArcade && SLArcade.SCORES_UNAVAILABLE_MSG) ||
          "Scores unavailable.";
        unavailableEl.classList.remove("hidden");
        startScoresEl.classList.add("hidden");
        btnLeaderboard.classList.add("hidden");
      });
  }

  function showMenu() {
    playing = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL WARS";
    instructionsEl.textContent =
      "BUILD " +
      BUILD_ID +
      " — 3D rotating TIE wireframes. Mouse banks the ship. Esc quits.";
    endHintEl.textContent = "";
    btnStart.textContent = "START DOGFIGHT";
    btnStart.disabled = false;
    btnQuit.classList.add("hidden");
    if (stateLabel) {
      stateLabel.textContent = "STATE: MENU  BUILD " + BUILD_ID;
    }
    if (lastLeaderboardData) {
      updateStartScores(lastLeaderboardData);
    }
  }

  function quitToMenu() {
    if (typeof SLArcade !== "undefined" && SLArcade.endSession) {
      SLArcade.endSession().catch(function () {});
    }
    showMenu();
  }

  btnStart.addEventListener("click", enterDogfight);
  btnQuit.addEventListener("click", quitToMenu);
  btnLeaderboard.addEventListener("click", function () {
    if (lastLeaderboardData) {
      renderLeaderboardList(lastLeaderboardData.entries || []);
    }
    leaderboardModal.classList.remove("hidden");
  });
  btnModalClose.addEventListener("click", function () {
    leaderboardModal.classList.add("hidden");
  });
  leaderboardModal.addEventListener("click", function (e) {
    if (e.target === leaderboardModal) {
      leaderboardModal.classList.add("hidden");
    }
  });
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      quitToMenu();
    }
  });
  window.addEventListener("message", function () {
    syncPlayerLine();
    refreshLeaderboard();
  });

  syncPlayerLine();
  refreshLeaderboard();
  showMenu();
  requestAnimationFrame(loop);
})();
