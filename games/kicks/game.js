(function () {
  "use strict";

  SLArcade.registerGameId("kicks");

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

  var WORLD = 600;
  var COLS = 60;
  var ROWS = 60;
  var CELL = WORLD / COLS;

  var EMPTY = 0;
  var CLAIMED = 1;
  var DRAWING = 2;

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "level";
  var PHASE_OVER = "gameOver";

  var READY_FRAMES = 70;
  var START_LIVES = 3;
  var LIFE_EVERY = 50000;
  var SPARX_TIMER_MAX = 37 * 60;

  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var highScore = 0;
  var lives = START_LIVES;
  var level = 1;
  var frame = 0;
  var readyTimer = 0;
  var lastLeaderboardData = null;
  var lifeBonuses = 0;
  var scoreMult = 1;
  var fillPct = 0;
  var targetPct = 75;
  var banner = "";
  var bannerT = 0;

  var field = [];
  var px = 0;
  var py = 0;
  var drawing = false;
  var drawSlow = false;
  var stix = [];
  var stixAllSlow = true;
  var fuseOn = false;
  var fuseIndex = 0;
  var moveCool = 0;
  var invuln = 0;
  var fuseIdle = 0;
  var FUSE_GRACE = 22;
  var BOOST_MAX = 100;
  var BOOST_DRAIN = 1.35;
  var BOOST_RECHARGE = 0.7;
  var boost = BOOST_MAX;

  var qixes = [];
  var sparx = [];
  var sparxTimer = SPARX_TIMER_MAX;
  var sparxTimerMax = SPARX_TIMER_MAX;
  var superSparx = false;
  var sparxUnlocked = true;

  var keys = {};
  var aiming = false;
  var aimDx = 0;
  var aimDy = 0;
  var revealImg = null;
  var revealReady = false;
  var imgCfg = {
    provider: "loremflickr",
    category: "space,cyberpunk",
    maturity: "general",
    custom: "",
    seed: "1",
  };
  var catalogCache = null;
  var loopAlive = false;

  function queryParam(name, fallback) {
    try {
      var search = window.location.search || "";
      if (search.charAt(0) === "?") {
        search = search.substring(1);
      }
      var parts = search.split("&");
      var i;
      for (i = 0; i < parts.length; i++) {
        if (!parts[i]) {
          continue;
        }
        var eq = parts[i].indexOf("=");
        var k;
        var v;
        if (eq < 0) {
          k = decodeURIComponent(parts[i]);
          v = "";
        } else {
          k = decodeURIComponent(parts[i].substring(0, eq));
          v = decodeURIComponent(parts[i].substring(eq + 1));
        }
        if (k === name) {
          return v;
        }
      }
    } catch (e) {}
    return fallback;
  }

  function parseImgConfig() {
    imgCfg.provider = (queryParam("img_provider", "loremflickr") || "loremflickr").toLowerCase();
    imgCfg.category = queryParam("img_category", "space,cyberpunk") || "space,cyberpunk";
    imgCfg.maturity = (queryParam("img_maturity", "general") || "general").toLowerCase();
    imgCfg.custom = queryParam("img_custom", "") || "";
    imgCfg.seed =
      queryParam("img_seed", "") || String(Math.floor(Math.random() * 999999));
    if (imgCfg.maturity !== "adult" && imgCfg.maturity !== "moderate") {
      imgCfg.maturity = "general";
    }
  }

  function categoryTagPath() {
    var tags = String(imgCfg.category || "")
      .split(",")
      .map(function (s) {
        return s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      })
      .filter(Boolean);
    if (!tags.length) {
      tags = ["nature"];
    }
    // LoremFlickr: /width/height/tag1,tag2
    return tags.slice(0, 3).join(",");
  }

  function freshImageSeed() {
    return String(
      Math.floor(Math.random() * 900000) +
        1000 +
        (level || 1) * 7919 +
        (Date.now() % 100000)
    );
  }

  function maturityRank(m) {
    if (m === "adult") {
      return 2;
    }
    if (m === "moderate") {
      return 1;
    }
    return 0;
  }

  function pickCatalogUrl(data) {
    var tags = imgCfg.category
      .split(",")
      .map(function (s) {
        return s.trim().toLowerCase();
      })
      .filter(Boolean);
    var maxM = maturityRank(imgCfg.maturity);
    var pool = (data.images || []).filter(function (img) {
      if (maturityRank(img.maturity || "general") > maxM) {
        return false;
      }
      if (!tags.length) {
        return true;
      }
      var cats = (img.category || []).map(function (c) {
        return String(c).toLowerCase();
      });
      var i;
      for (i = 0; i < tags.length; i++) {
        if (cats.indexOf(tags[i]) >= 0) {
          return true;
        }
      }
      return false;
    });
    if (!pool.length) {
      pool = (data.images || []).filter(function (img) {
        return maturityRank(img.maturity || "general") <= maxM;
      });
    }
    if (!pool.length) {
      return null;
    }
    var idx = Math.abs(parseInt(imgCfg.seed, 10) || 0) % pool.length;
    return pool[idx].url;
  }

  function resolveImageUrl() {
    if (imgCfg.provider === "custom" && imgCfg.custom) {
      return imgCfg.custom;
    }
    // Category + random remote image each seed (default)
    if (
      imgCfg.provider === "loremflickr" ||
      imgCfg.provider === "flickr" ||
      imgCfg.provider === "random"
    ) {
      var tags = categoryTagPath();
      return (
        "https://loremflickr.com/600/600/" +
        tags +
        "?lock=" +
        encodeURIComponent(imgCfg.seed)
      );
    }
    if (imgCfg.provider === "picsum") {
      return "https://picsum.photos/seed/kicks" + imgCfg.seed + "/600/600";
    }
    if (imgCfg.provider === "catalog") {
      return null;
    }
    // Unknown provider → treat as loremflickr
    var fallbackTags = categoryTagPath();
    return (
      "https://loremflickr.com/600/600/" +
      fallbackTags +
      "?lock=" +
      encodeURIComponent(imgCfg.seed)
    );
  }

  function loadRevealImage() {
    revealReady = false;
    var direct = resolveImageUrl();
    function useUrl(url) {
      if (!url) {
        revealReady = false;
        revealImg = null;
        return;
      }
      var triedNoCors = false;
      function bind(img, withCors) {
        revealImg = img;
        if (withCors) {
          img.crossOrigin = "anonymous";
        }
        img.onload = function () {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            revealReady = true;
          } else {
            revealReady = false;
          }
        };
        img.onerror = function () {
          if (withCors && !triedNoCors) {
            triedNoCors = true;
            bind(new Image(), false);
            return;
          }
          revealReady = false;
        };
        img.src = url;
      }
      bind(new Image(), true);
    }
    if (direct) {
      useUrl(direct);
      return;
    }
    if (catalogCache) {
      useUrl(pickCatalogUrl(catalogCache));
      return;
    }
    fetch("catalog.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        catalogCache = data;
        useUrl(pickCatalogUrl(data));
      })
      .catch(function () {
        useUrl(
          "https://loremflickr.com/600/600/" +
            categoryTagPath() +
            "?lock=" +
            encodeURIComponent(imgCfg.seed)
        );
      });
  }

  function resizeCanvas() {
    var dw = canvas.clientWidth || window.innerWidth || WORLD;
    var dh = canvas.clientHeight || window.innerHeight || WORLD;
    if (dw < 1) {
      dw = WORLD;
    }
    if (dh < 1) {
      dh = WORLD;
    }
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
  }

  function idx(x, y) {
    return y * COLS + x;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS;
  }

  function isClaimed(x, y) {
    return inBounds(x, y) && field[idx(x, y)] === CLAIMED;
  }

  function isOpen(x, y) {
    return inBounds(x, y) && field[idx(x, y)] === EMPTY;
  }

  function neighborIsDraw(x, y) {
    return inBounds(x, y) && field[idx(x, y)] === DRAWING;
  }

  // Classic Qix: walk only edges — outer frame + shoreline next to open/stix.
  // Filled image interior is NOT a path (prevents "overrun under the image").
  function isWalkable(x, y) {
    if (!isClaimed(x, y)) {
      return false;
    }
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
      return true;
    }
    return (
      isOpen(x + 1, y) ||
      isOpen(x - 1, y) ||
      isOpen(x, y + 1) ||
      isOpen(x, y - 1) ||
      neighborIsDraw(x + 1, y) ||
      neighborIsDraw(x - 1, y) ||
      neighborIsDraw(x, y + 1) ||
      neighborIsDraw(x, y - 1)
    );
  }

  function nearestWalkable(fromX, fromY) {
    if (isWalkable(fromX, fromY)) {
      return { x: fromX, y: fromY };
    }
    var best = null;
    var bestD = 1e9;
    var bestPri = 99;
    var x;
    var y;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        if (!isWalkable(x, y)) {
          continue;
        }
        var touchesOpen =
          isOpen(x + 1, y) ||
          isOpen(x - 1, y) ||
          isOpen(x, y + 1) ||
          isOpen(x, y - 1);
        var pri = touchesOpen ? 0 : 1;
        var d = Math.abs(x - fromX) + Math.abs(y - fromY);
        if (pri < bestPri || (pri === bestPri && d < bestD)) {
          bestPri = pri;
          bestD = d;
          best = { x: x, y: y };
        }
      }
    }
    if (!best) {
      return { x: Math.floor(COLS / 2), y: 0 };
    }
    return best;
  }

  function pickRespawnCell() {
    // Prefer a wall that still borders open territory (the "live" edge).
    var shore = [];
    var outer = [];
    var x;
    var y;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        if (!isWalkable(x, y)) {
          continue;
        }
        if (
          isOpen(x + 1, y) ||
          isOpen(x - 1, y) ||
          isOpen(x, y + 1) ||
          isOpen(x, y - 1)
        ) {
          shore.push({ x: x, y: y });
        } else {
          outer.push({ x: x, y: y });
        }
      }
    }
    var pool = shore.length ? shore : outer;
    if (!pool.length) {
      return { x: Math.floor(COLS / 2), y: 0 };
    }
    return pool[(Math.random() * pool.length) | 0];
  }

  function sanitizePlayer() {
    if (!inBounds(px, py)) {
      px = Math.floor(COLS / 2);
      py = 0;
    }
    if (drawing) {
      if (!stix.length) {
        drawing = false;
        fuseOn = false;
      } else {
        var tip = stix[stix.length - 1];
        var onTip = px === tip.x && py === tip.y;
        var onDraw = field[idx(px, py)] === DRAWING;
        var onClaim = isWalkable(px, py);
        if (!onTip && !onDraw && !onClaim) {
          px = tip.x;
          py = tip.y;
        }
      }
    }
    if (!drawing && !isWalkable(px, py)) {
      var snap = nearestWalkable(px, py);
      px = snap.x;
      py = snap.y;
      stix = [];
      fuseOn = false;
      fuseIdle = 0;
    }
  }

  function initField() {
    field = new Array(COLS * ROWS);
    var x;
    var y;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
          field[idx(x, y)] = CLAIMED;
        } else {
          field[idx(x, y)] = EMPTY;
        }
      }
    }
    px = Math.floor(COLS / 2);
    py = 0;
    drawing = false;
    stix = [];
    stixAllSlow = true;
    fuseOn = false;
    fuseIndex = 0;
    boost = BOOST_MAX;
    fillPct = calcFillPct();
  }

  function wantsBoost() {
    return !!(keys.x || keys.X || keys.fast || keys.boost);
  }

  function usingBoost() {
    return wantsBoost() && boost > 0;
  }

  function boostBar() {
    var n = Math.max(0, Math.min(10, Math.round((boost / BOOST_MAX) * 10)));
    var i;
    var s = "";
    for (i = 0; i < 10; i++) {
      s += i < n ? "█" : "░";
    }
    return s;
  }

  function calcFillPct() {
    var claimed = 0;
    var playable = (COLS - 2) * (ROWS - 2);
    var i;
    for (i = 0; i < field.length; i++) {
      var x = i % COLS;
      var y = (i / COLS) | 0;
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        continue;
      }
      if (field[i] === CLAIMED) {
        claimed++;
      }
    }
    if (playable <= 0) {
      return 100;
    }
    return Math.floor((claimed / playable) * 1000) / 10;
  }

  function levelTarget(n) {
    var t = 75 + Math.floor((n - 1) / 3);
    if (t > 90) {
      t = 90;
    }
    return t;
  }

  function qixCountForLevel(n) {
    if (n >= 3) {
      return 2;
    }
    return 1;
  }

  function spawnQixes() {
    qixes = [];
    var n = qixCountForLevel(level);
    var i;
    for (i = 0; i < n; i++) {
      qixes.push({
        x: COLS * 0.3 + i * 12 + Math.random() * 8,
        y: ROWS * 0.35 + Math.random() * 10,
        vx: (Math.random() < 0.5 ? -1 : 1) * (0.12 + level * 0.015),
        vy: (Math.random() < 0.5 ? -1 : 1) * (0.12 + level * 0.015),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function sparxMoveEvery() {
    // Early levels: slow patrol. Later: faster. Super Sparx move every frame.
    if (level <= 2) {
      return 4;
    }
    if (level <= 5) {
      return 3;
    }
    if (level <= 8) {
      return 2;
    }
    return 1;
  }

  function spawnSparxPair() {
    sparx.push({
      x: 0,
      y: 0,
      dir: 0,
      super: superSparx,
      cool: 0,
    });
    sparx.push({
      x: COLS - 1,
      y: 0,
      dir: 1,
      super: superSparx,
      cool: 2,
    });
  }

  function resetSparx() {
    sparx = [];
    superSparx = false;
    sparxUnlocked = true;
    // First pair after a short grace so you can leave the spawn edge
    sparxTimerMax = Math.max(8 * 60, 14 * 60 - level * 30);
    sparxTimer = sparxTimerMax;
  }

  function playTip() {
    if (drawing) {
      if (usingBoost()) {
        return "BOOST on — release Space for slow (2×). Close line on a white border";
      }
      return "Keep moving — close your line on a white border to claim";
    }
    if (!sparx.length) {
      return (
        "Walk borders, cut into dark to claim. Sparx arrive when the bottom bar empties. Need " +
        targetPct +
        "%"
      );
    }
    if (fillPct + 0.05 < targetPct) {
      return (
        "On borders you're safe from the Qix. Sparx (purple) hurt on borders. Need " +
        targetPct +
        "%"
      );
    }
    return "Target reached — finishing level…";
  }

  function updateHud() {
    hud.textContent =
      "SCORE " +
      score +
      "   HI " +
      highScore +
      "   LIVES " +
      lives +
      "   LV " +
      level +
      "\nFILL " +
      fillPct.toFixed(1) +
      "% / " +
      targetPct +
      "%   ×" +
      scoreMult +
      (drawing ? (drawSlow ? "   SLOW" : "   BOOST") : "   SAFE") +
      "   BOOST " +
      boostBar() +
      "\n" +
      playTip() +
      (bannerT > 0 ? "\n" + banner : "");
  }

  function setOverlayButtons(showStart, showNext) {
    btnStart.classList.toggle("hidden", !showStart);
    btnNext.classList.toggle("hidden", !showNext);
  }

  function setQuitVisible(v) {
    btnQuit.classList.toggle("hidden", !v);
  }

  function setStartScreenExtras(v) {
    startScoresEl.classList.toggle("hidden", !v);
    btnLeaderboard.classList.toggle("hidden", !v);
    if (!v) {
      leaderboardModal.classList.add("hidden");
    }
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlay.classList.remove("level-clear");
    overlayTitle.textContent = "KICKS";
    instructionsEl.textContent =
      "HOW TO PLAY\n" +
      "• Walk the white borders freely (safe from the Qix) — left/right/around as you like.\n" +
      "• When ready, hold toward the DARK (into the open field) to start drawing a line.\n" +
      "• From the top edge that means Down; from a side edge it means toward the middle.\n" +
      "• Close the line back onto any white border to claim that area and reveal the image.\n" +
      "• Bottom red bar = when purple Sparx appear (slow at first; deadly on borders).\n" +
      "• Space = boost. After a clear, view the full image then tap NEXT LEVEL.\n" +
      "Goal: reach the FILL % target.";
    endHintEl.textContent = "";
    btnStart.disabled = false;
    btnStart.textContent = "START";
    setOverlayButtons(true, false);
    setStartScreenExtras(true);
    setQuitVisible(false);
    setTouchPadVisible(false);
    if (lastLeaderboardData) {
      updateStartScores(lastLeaderboardData);
    }
  }

  function beginReady(title, hint) {
    phase = PHASE_READY;
    running = false;
    readyTimer = READY_FRAMES;
    overlay.classList.remove("hidden");
    overlay.classList.remove("level-clear");
    overlayTitle.textContent = title || "GET READY";
    instructionsEl.textContent = hint || "";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function revealFullImage() {
    var i;
    for (i = 0; i < field.length; i++) {
      field[i] = CLAIMED;
    }
    drawing = false;
    stix = [];
    fuseOn = false;
    sparx = [];
    fillPct = 100;
  }

  function showLevelClear(overPct, splitBonus) {
    var shownFill = fillPct;
    phase = PHASE_LEVEL;
    running = false;
    setTouchPadVisible(false);
    revealFullImage();
    overlay.classList.remove("hidden");
    overlay.classList.add("level-clear");
    overlayTitle.textContent = splitBonus ? "QIX SPLIT!" : "LEVEL CLEAR";
    var msg =
      "Fill " +
      shownFill.toFixed(1) +
      "% — Target " +
      targetPct +
      "%";
    if (overPct > 0) {
      msg += " — Overage +" + overPct * 1000;
    }
    if (splitBonus) {
      msg += " — Multiplier now ×" + scoreMult;
    }
    instructionsEl.textContent = msg;
    endHintEl.textContent = "Full image revealed — tap NEXT LEVEL when ready.";
    btnNext.textContent = "NEXT LEVEL";
    setOverlayButtons(false, true);
    setStartScreenExtras(false);
    setQuitVisible(true);
    updateHud();
  }

  function cellCenter(x, y) {
    return { x: (x + 0.5) * CELL, y: (y + 0.5) * CELL };
  }

  function tryMove(dx, dy) {
    if (moveCool > 0) {
      return;
    }
    var nx = px + dx;
    var ny = py + dy;
    if (!inBounds(nx, ny)) {
      return;
    }

    // Safe border walk (not drawing)
    if (!drawing && isWalkable(nx, ny)) {
      px = nx;
      py = ny;
      moveCool = 2;
      fuseOn = false;
      sanitizePlayer();
      return;
    }

    // Leave border into dark → start slow draw (boost optional)
    if (!drawing) {
      if (!isWalkable(px, py) || !isOpen(nx, ny)) {
        return;
      }
      drawing = true;
      stix = [{ x: px, y: py }];
      stixAllSlow = true;
      fuseOn = false;
      fuseIndex = 0;
      fuseIdle = 0;
    }

    if (nx === px && ny === py) {
      return;
    }
    // No reverse along stix
    if (stix.length >= 2) {
      var prev = stix[stix.length - 2];
      if (prev.x === nx && prev.y === ny) {
        return;
      }
    }
    // Rejoining your own line closes the loop (the "wall" you just drew)
    var i;
    for (i = 0; i < stix.length; i++) {
      if (stix[i].x === nx && stix[i].y === ny) {
        if (stix.length > 2) {
          px = nx;
          py = ny;
          completeClaim();
          moveCool = 3;
          fuseIdle = 0;
          sanitizePlayer();
        }
        return;
      }
    }

    drawSlow = !usingBoost();

    if (isOpen(nx, ny)) {
      // Cap path length so a runaway line cannot desync the cursor
      if (stix.length > (COLS + ROWS) * 4) {
        fuseOn = true;
        return;
      }
      if (!drawSlow) {
        stixAllSlow = false;
      }
      field[idx(nx, ny)] = DRAWING;
      stix.push({ x: nx, y: ny });
      px = nx;
      py = ny;
      moveCool = drawSlow ? 3 : 2;
      fuseOn = false;
      fuseIdle = 0;
      sanitizePlayer();
      return;
    }

    // Hit any claimed edge wall → close & claim (cannot enter filled interior)
    if (isWalkable(nx, ny) && drawing && stix.length > 1) {
      stix.push({ x: nx, y: ny });
      px = nx;
      py = ny;
      completeClaim();
      moveCool = 3;
      fuseIdle = 0;
      sanitizePlayer();
      return;
    }

    // Blocked (including filled interior under the image)
    sanitizePlayer();
  }

  function flood(sx, sy, mark) {
    if (!isOpen(sx, sy) && field[idx(sx, sy)] !== DRAWING) {
      return 0;
    }
    var stack = [[sx, sy]];
    var count = 0;
    var seen = {};
    while (stack.length) {
      var p = stack.pop();
      var x = p[0];
      var y = p[1];
      var k = x + "," + y;
      if (seen[k]) {
        continue;
      }
      if (!inBounds(x, y)) {
        continue;
      }
      if (field[idx(x, y)] !== EMPTY && field[idx(x, y)] !== DRAWING) {
        continue;
      }
      seen[k] = 1;
      mark.push({ x: x, y: y });
      count++;
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
    return count;
  }

  function qixCell(q) {
    return { x: Math.floor(q.x), y: Math.floor(q.y) };
  }

  function completeClaim() {
    var i;
    // Convert DRAWING to temporary wall for flood
    for (i = 0; i < stix.length; i++) {
      var s = stix[i];
      if (field[idx(s.x, s.y)] === DRAWING) {
        field[idx(s.x, s.y)] = CLAIMED;
      }
    }

    // Find open regions
    var regions = [];
    var visited = {};
    var x;
    var y;
    for (y = 1; y < ROWS - 1; y++) {
      for (x = 1; x < COLS - 1; x++) {
        if (field[idx(x, y)] !== EMPTY) {
          continue;
        }
        var key = x + "," + y;
        if (visited[key]) {
          continue;
        }
        var cells = [];
        floodRegion(x, y, cells, visited);
        if (cells.length) {
          regions.push(cells);
        }
      }
    }

    var qixRegions = {};
    for (i = 0; i < qixes.length; i++) {
      var qc = qixCell(qixes[i]);
      var r;
      for (r = 0; r < regions.length; r++) {
        var hit = false;
        var j;
        for (j = 0; j < regions[r].length; j++) {
          if (regions[r][j].x === qc.x && regions[r][j].y === qc.y) {
            hit = true;
            break;
          }
        }
        if (hit) {
          qixRegions[r] = true;
        }
      }
    }

    var claimedCells = 0;
    for (i = 0; i < regions.length; i++) {
      if (qixRegions[i]) {
        continue;
      }
      var c;
      for (c = 0; c < regions[i].length; c++) {
        field[idx(regions[i][c].x, regions[i][c].y)] = CLAIMED;
        claimedCells++;
      }
    }

    // Clear any leftover DRAWING
    for (i = 0; i < field.length; i++) {
      if (field[i] === DRAWING) {
        field[i] = EMPTY;
      }
    }

    var pctGain =
      Math.floor((claimedCells / ((COLS - 2) * (ROWS - 2))) * 1000) / 10;
    var base = stixAllSlow ? 200 : 100;
    var pts = Math.floor(base * pctGain * scoreMult);
    score += pts;
    if (score > highScore) {
      highScore = score;
    }
    checkLifeBonus();
    banner =
      "+" +
      pts +
      (stixAllSlow ? " SLOW" : " FAST") +
      " — keep claiming until " +
      targetPct +
      "%";
    bannerT = 110;

    drawing = false;
    stix = [];
    fuseOn = false;
    fuseIdle = 0;
    fillPct = calcFillPct();
    // Stay on a real edge after the fill, not inside the image
    if (!isWalkable(px, py)) {
      var edge = pickRespawnCell();
      px = edge.x;
      py = edge.y;
    }
    updateHud();

    // Dual Qix split?
    if (qixes.length >= 2 && regions.length >= 2) {
      var occupied = 0;
      for (i = 0; i < regions.length; i++) {
        if (qixRegions[i]) {
          occupied++;
        }
      }
      if (occupied >= 2) {
        if (scoreMult < 9) {
          scoreMult++;
        }
        banner = "QIX SPLIT — MULTIPLIER ×" + scoreMult;
        bannerT = 120;
        showLevelClear(0, true);
        return;
      }
    }

    if (fillPct >= targetPct) {
      var over = Math.floor(fillPct - targetPct);
      if (over < 0) {
        over = 0;
      }
      score += over * 1000;
      if (fillPct >= 99) {
        score += 25000;
      }
      if (score > highScore) {
        highScore = score;
      }
      checkLifeBonus();
      showLevelClear(over, false);
    }
  }

  function floodRegion(sx, sy, out, visited) {
    var stack = [[sx, sy]];
    while (stack.length) {
      var p = stack.pop();
      var x = p[0];
      var y = p[1];
      var k = x + "," + y;
      if (visited[k]) {
        continue;
      }
      if (!inBounds(x, y) || field[idx(x, y)] !== EMPTY) {
        continue;
      }
      visited[k] = 1;
      out.push({ x: x, y: y });
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  function checkLifeBonus() {
    var earned = Math.floor(score / LIFE_EVERY);
    if (earned > lifeBonuses) {
      lives += earned - lifeBonuses;
      lifeBonuses = earned;
      banner = "EXTRA LIFE!";
      bannerT = 100;
    }
  }

  function killPlayer(reason) {
    if (invuln > 0 || phase !== PHASE_PLAYING) {
      return;
    }
    // Clear stix
    var i;
    for (i = 0; i < field.length; i++) {
      if (field[i] === DRAWING) {
        field[i] = EMPTY;
      }
    }
    drawing = false;
    stix = [];
    fuseOn = false;
    lives--;
    banner = reason || "HIT!";
    bannerT = 100;
    updateHud();
    if (lives <= 0) {
      gameOver();
      return;
    }
    // Respawn on a remaining wall that still borders open space
    var spawn = pickRespawnCell();
    px = spawn.x;
    py = spawn.y;
    invuln = 180;
    banner = "Back on the wall — cut into the dark when ready";
    bannerT = 120;
  }

  function updateQix(q) {
    q.phase += 0.08;
    q.x += q.vx;
    q.y += q.vy;
    var cx = Math.floor(q.x);
    var cy = Math.floor(q.y);
    if (!isOpen(cx, cy)) {
      q.x -= q.vx;
      q.y -= q.vy;
      if (Math.random() < 0.5) {
        q.vx = -q.vx;
      } else {
        q.vy = -q.vy;
      }
      if (Math.random() < 0.2) {
        q.vx += (Math.random() - 0.5) * 0.04;
        q.vy += (Math.random() - 0.5) * 0.04;
      }
    }
    // Stay in open
    cx = Math.floor(q.x);
    cy = Math.floor(q.y);
    if (!isOpen(cx, cy)) {
      q.x = COLS * 0.5;
      q.y = ROWS * 0.5;
      while (!isOpen(Math.floor(q.x), Math.floor(q.y))) {
        q.x = 2 + Math.random() * (COLS - 4);
        q.y = 2 + Math.random() * (ROWS - 4);
      }
    }
  }

  function perimeterNeighbors(x, y) {
    var dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    var out = [];
    var i;
    for (i = 0; i < 4; i++) {
      var nx = x + dirs[i][0];
      var ny = y + dirs[i][1];
      if (!isWalkable(nx, ny)) {
        continue;
      }
      // Prefer cells adjacent to open/drawing
      var edge =
        isOpen(nx + 1, ny) ||
        isOpen(nx - 1, ny) ||
        isOpen(nx, ny + 1) ||
        isOpen(nx, ny - 1) ||
        field[idx(nx, ny)] === CLAIMED;
      if (edge) {
        out.push({ x: nx, y: ny });
      }
    }
    if (!out.length) {
      for (i = 0; i < 4; i++) {
        var ax = x + dirs[i][0];
        var ay = y + dirs[i][1];
        if (isWalkable(ax, ay)) {
          out.push({ x: ax, y: ay });
        }
      }
    }
    return out;
  }

  function updateSparxEntity(s) {
    if (s.cool > 0) {
      s.cool--;
      return;
    }
    s.cool = s.super ? 0 : sparxMoveEvery() - 1;

    var opts = perimeterNeighbors(s.x, s.y);
    if (!opts.length) {
      return;
    }
    // Mostly patrol; light chase so they are avoidable
    var best = opts[(Math.random() * opts.length) | 0];
    if (Math.random() < 0.3) {
      var bestD = 1e9;
      var i;
      for (i = 0; i < opts.length; i++) {
        var scoreD = Math.abs(opts[i].x - px) + Math.abs(opts[i].y - py);
        if (scoreD < bestD) {
          bestD = scoreD;
          best = opts[i];
        }
      }
    }
    s.x = best.x;
    s.y = best.y;
    if (s.super && drawing) {
      var j;
      for (j = 0; j < stix.length; j++) {
        if (Math.abs(stix[j].x - s.x) + Math.abs(stix[j].y - s.y) <= 1) {
          if (stix[j].x === px && stix[j].y === py) {
            killPlayer("SUPER SPARX!");
            return;
          }
        }
      }
    }
  }

  function segmentHitsQix() {
    if (!drawing || !stix.length) {
      return false;
    }
    var i;
    var q;
    for (q = 0; q < qixes.length; q++) {
      var qx = qixes[q].x;
      var qy = qixes[q].y;
      for (i = 0; i < stix.length; i++) {
        var sx = stix[i].x + 0.5;
        var sy = stix[i].y + 0.5;
        if (Math.abs(sx - qx) < 0.85 && Math.abs(sy - qy) < 0.85) {
          return true;
        }
      }
      if (drawing && Math.abs(px + 0.5 - qx) < 0.9 && Math.abs(py + 0.5 - qy) < 0.9) {
        return true;
      }
    }
    return false;
  }

  function updatePlaying() {
    frame++;
    if (moveCool > 0) {
      moveCool--;
    }
    if (invuln > 0) {
      invuln--;
    }
    if (bannerT > 0) {
      bannerT--;
    }

    if (drawing && usingBoost()) {
      boost = Math.max(0, boost - BOOST_DRAIN);
    } else if (!drawing) {
      boost = Math.min(BOOST_MAX, boost + BOOST_RECHARGE);
    }

    var dx = 0;
    var dy = 0;
    // Prefer vertical when leaving the top/bottom edge so "down into dark" wins in SL/CEF.
    if (keys.ArrowDown || keys.down || keys.s || keys.S) {
      dy = 1;
    } else if (keys.ArrowUp || keys.up || keys.w || keys.W) {
      dy = -1;
    } else if (keys.ArrowLeft || keys.left || keys.a || keys.A) {
      dx = -1;
    } else if (keys.ArrowRight || keys.right || keys.d || keys.D) {
      dx = 1;
    }
    if (!dx && !dy && aiming) {
      dx = aimDx;
      dy = aimDy;
    }
    if (dx || dy) {
      tryMove(dx, dy);
      if (drawing) {
        fuseIdle = 0;
      }
    } else if (drawing) {
      // Brief pause is OK (keyboard/CEF stutter); fuse starts after grace.
      fuseIdle++;
      if (fuseIdle >= FUSE_GRACE) {
        fuseOn = true;
      }
    } else {
      fuseIdle = 0;
    }

    if (fuseOn && drawing) {
      fuseIndex += 0.35;
      if (fuseIndex >= stix.length) {
        killPlayer("FUSE!");
      }
    } else if (!drawing) {
      fuseIndex = 0;
      fuseIdle = 0;
    }

    var qi;
    for (qi = 0; qi < qixes.length; qi++) {
      updateQix(qixes[qi]);
    }
    if (segmentHitsQix()) {
      killPlayer("QIX!");
      return;
    }

    sparxTimer--;
    if (sparxTimer <= 0) {
      sparxTimerMax = Math.max(16 * 60, SPARX_TIMER_MAX - level * 90);
      sparxTimer = sparxTimerMax;
      if (sparx.length >= 4) {
        superSparx = true;
        var si;
        for (si = 0; si < sparx.length; si++) {
          sparx[si].super = true;
        }
        banner = "SUPER SPARX!";
        bannerT = 100;
      } else {
        var hadSparx = sparx.length > 0;
        spawnSparxPair();
        if (!hadSparx) {
          banner = "SPARX! Purple dots on the border — avoid them";
          bannerT = 140;
        }
      }
    }
    for (qi = 0; qi < sparx.length; qi++) {
      updateSparxEntity(sparx[qi]);
      if (sparx[qi].x === px && sparx[qi].y === py && invuln <= 0) {
        killPlayer("SPARX!");
        return;
      }
    }

    fillPct = calcFillPct();
    updateHud();
  }

  function drawWorld() {
    resizeCanvas();
    var scale = Math.min(canvas.width / WORLD, canvas.height / WORLD);
    var ox = (canvas.width - WORLD * scale) / 2;
    var oy = (canvas.height - WORLD * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#04060e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    // Unclaimed fog base
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, WORLD, WORLD);

    // Reveal image under claimed cells (full image on level-clear)
    var x;
    var y;
    var drewReveal = false;
    var showFullArt = phase === PHASE_LEVEL;
    if (
      revealReady &&
      revealImg &&
      revealImg.naturalWidth > 0 &&
      revealImg.naturalHeight > 0
    ) {
      try {
        if (showFullArt) {
          ctx.drawImage(revealImg, 0, 0, WORLD, WORLD);
          drewReveal = true;
        } else {
          ctx.save();
          ctx.beginPath();
          for (y = 0; y < ROWS; y++) {
            for (x = 0; x < COLS; x++) {
              if (field[idx(x, y)] === CLAIMED) {
                ctx.rect(x * CELL, y * CELL, CELL + 0.5, CELL + 0.5);
              }
            }
          }
          ctx.clip();
          ctx.drawImage(revealImg, 0, 0, WORLD, WORLD);
          ctx.fillStyle = "rgba(61, 240, 255, 0.06)";
          ctx.fillRect(0, 0, WORLD, WORLD);
          ctx.restore();
          drewReveal = true;
        }
      } catch (drawErr) {
        drewReveal = false;
      }
    }
    if (!drewReveal) {
      ctx.fillStyle = "#152238";
      for (y = 0; y < ROWS; y++) {
        for (x = 0; x < COLS; x++) {
          if (field[idx(x, y)] === CLAIMED) {
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
        }
      }
    }

    // Level-clear: show only the full artwork until NEXT LEVEL
    if (showFullArt) {
      return;
    }

    // Bright edge on claim/open boundary so the walkable path stays visible
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.25;
    for (y = 0; y < ROWS; y++) {
      for (x = 0; x < COLS; x++) {
        if (field[idx(x, y)] !== CLAIMED) {
          continue;
        }
        if (isOpen(x + 1, y) || isOpen(x - 1, y) || isOpen(x, y + 1) || isOpen(x, y - 1)) {
          ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
        }
      }
    }

    // Grid haze on open
    ctx.strokeStyle = "rgba(80, 120, 180, 0.12)";
    ctx.lineWidth = 1;
    for (x = 0; x <= COLS; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, WORLD);
      ctx.stroke();
    }
    for (y = 0; y <= ROWS; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(WORLD, y * CELL);
      ctx.stroke();
    }

    // Active stix
    if (stix.length) {
      ctx.strokeStyle = stixAllSlow ? "#ffb84a" : "#3df0ff";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      var p0 = cellCenter(stix[0].x, stix[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (x = 1; x < stix.length; x++) {
        var p = cellCenter(stix[x].x, stix[x].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo((px + 0.5) * CELL, (py + 0.5) * CELL);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Fuse
    if (fuseOn && stix.length) {
      var fi = Math.min(stix.length - 1, Math.floor(fuseIndex));
      var f = cellCenter(stix[fi].x, stix[fi].y);
      ctx.fillStyle = "#ff4d6d";
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Qix — modern ribbon geometry
    for (y = 0; y < qixes.length; y++) {
      drawQix(qixes[y]);
    }

    // Sparx
    for (x = 0; x < sparx.length; x++) {
      var sp = sparx[x];
      var sc = cellCenter(sp.x, sp.y);
      ctx.fillStyle = sp.super ? "#ff4d6d" : "#a78bfa";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(sc.x, sc.y - 4);
      ctx.lineTo(sc.x + 4, sc.y);
      ctx.lineTo(sc.x, sc.y + 4);
      ctx.lineTo(sc.x - 4, sc.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Coach: pulse arrow into open space when SAFE on an edge
    if (
      phase === PHASE_PLAYING &&
      !drawing &&
      fillPct < targetPct &&
      Math.floor(frame / 18) % 2 === 0
    ) {
      var coach = null;
      if (isOpen(px, py + 1)) {
        coach = { x: 0, y: 1 };
      } else if (isOpen(px, py - 1)) {
        coach = { x: 0, y: -1 };
      } else if (isOpen(px + 1, py)) {
        coach = { x: 1, y: 0 };
      } else if (isOpen(px - 1, py)) {
        coach = { x: -1, y: 0 };
      }
      if (coach) {
        var cc = cellCenter(px, py);
        ctx.strokeStyle = "#ffb84a";
        ctx.fillStyle = "#ffb84a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cc.x, cc.y);
        ctx.lineTo(cc.x + coach.x * 22, cc.y + coach.y * 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cc.x + coach.x * 26, cc.y + coach.y * 26);
        ctx.lineTo(
          cc.x + coach.x * 14 - coach.y * 7,
          cc.y + coach.y * 14 + coach.x * 7
        );
        ctx.lineTo(
          cc.x + coach.x * 14 + coach.y * 7,
          cc.y + coach.y * 14 - coach.x * 7
        );
        ctx.closePath();
        ctx.fill();
        ctx.font = "bold 11px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CUT IN", cc.x + coach.x * 38, cc.y + coach.y * 38 + 4);
      }
    }

    // Player cursor — always visible (invuln pulses alpha, never fully hides)
    sanitizePlayer();
    var pc = cellCenter(px, py);
    var pulse =
      invuln > 0 ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(invuln * 0.35)) : 1;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(pc.x, pc.y - 9);
    ctx.lineTo(pc.x + 9, pc.y);
    ctx.lineTo(pc.x, pc.y + 9);
    ctx.lineTo(pc.x - 9, pc.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = drawing ? (drawSlow ? "#ffb84a" : "#3df0ff") : "#ffffff";
    ctx.fillStyle = drawing
      ? drawSlow
        ? "rgba(255,184,74,0.55)"
        : "rgba(61,240,255,0.5)"
      : "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(pc.x, pc.y - 7);
    ctx.lineTo(pc.x + 7, pc.y);
    ctx.lineTo(pc.x, pc.y + 7);
    ctx.lineTo(pc.x - 7, pc.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;

    // Sparx meter along bottom (keep top edge clear for the player cursor)
    var meterW = WORLD * 0.5;
    var meterX = (WORLD - meterW) / 2;
    var meterY = WORLD - 18;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(meterX - 2, meterY - 2, meterW + 4, 16);
    ctx.fillStyle = "rgba(40,12,18,0.9)";
    ctx.fillRect(meterX, meterY + 6, meterW, 6);
    ctx.fillStyle = superSparx ? "#ff4d6d" : "#ff6b6b";
    var meterFill = meterW * (sparxTimer / Math.max(1, sparxTimerMax));
    if (meterFill < 0) {
      meterFill = 0;
    }
    if (meterFill > meterW) {
      meterFill = meterW;
    }
    if (meterFill > 0) {
      ctx.fillRect(meterX, meterY + 6, meterFill, 6);
    }
    ctx.fillStyle = "#ffb4b4";
    ctx.font = "bold 9px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      sparx.length ? "NEXT SPARX" : "SPARX ARRIVE WHEN EMPTY",
      WORLD * 0.5,
      meterY + 5
    );
  }

  function drawQix(q) {
    var cx = q.x * CELL;
    var cy = q.y * CELL;
    var t = q.phase;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "rgba(167, 139, 250, 0.9)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#a78bfa";
    ctx.shadowBlur = 12;
    var k;
    for (k = 0; k < 5; k++) {
      var a0 = t + k * 1.1;
      var r0 = 10 + k * 3;
      var r1 = 18 + k * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
      ctx.lineTo(Math.cos(a0 + 0.8) * r1, Math.sin(a0 + 1.2) * r1);
      ctx.lineTo(Math.cos(a0 + 1.7) * r0, Math.sin(a0 + 2.1) * r0);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(61, 240, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function startLevel() {
    targetPct = levelTarget(level);
    initField();
    spawnQixes();
    resetSparx();
    // New random remote image every level (provider uses seed + CATEGORY tags)
    imgCfg.seed = freshImageSeed();
    loadRevealImage();
    fillPct = calcFillPct();
    updateHud();
    beginReady(
      "LEVEL " + level,
      "Walk borders, then cut into the dark to draw. Claim " +
        targetPct +
        "%. Sparx = top bar. Space = boost. ×" +
        scoreMult
    );
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    score = 0;
    lives = START_LIVES;
    level = 1;
    lifeBonuses = 0;
    scoreMult = 1;
    frame = 0;
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    startLevel();
    ensureLoop();
  }

  function nextLevel() {
    level++;
    startLevel();
  }

  function returnToStartScreen(hint) {
    phase = PHASE_MENU;
    running = false;
    setTouchPadVisible(false);
    showMenuOverlay();
    if (hint) {
      endHintEl.textContent = hint;
    } else if (score > 0) {
      endHintEl.textContent = "Last score: " + score + " — tap START to play again.";
    }
  }

  function gameOver() {
    phase = PHASE_OVER;
    running = false;
    setTouchPadVisible(false);
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GAME OVER";
    instructionsEl.textContent = "Final score: " + score + " — Level " + level;
    btnStart.textContent = "SAVING…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(false);
    // Stay on this MOAP page — never endSession/clear media or navigate away.
    SLArcade.submitScore(score)
      .then(function (result) {
        showMessages((result && result.messages) || []);
        if (result && result.unavailableMessage) {
          unavailableEl.textContent = result.unavailableMessage;
          unavailableEl.classList.remove("hidden");
        }
        return refreshLeaderboard();
      })
      .then(function () {
        returnToStartScreen("Last score: " + score + " — tap START to play again.");
      })
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        returnToStartScreen("Score save timed out — tap START to play again.");
      });
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    returnToStartScreen();
  }

  function showMessages(list) {
    messagesEl.innerHTML = "";
    var i;
    for (i = 0; i < list.length; i++) {
      var d = document.createElement("div");
      d.textContent = list[i];
      messagesEl.appendChild(d);
    }
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
    if (data.entries && data.entries[0]) {
      highScore = Math.max(highScore, data.entries[0].score || 0);
    }
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

  function refreshLeaderboard() {
    return SLArcade.getLeaderboard().then(function (data) {
      lastLeaderboardData = data;
      updateStartScores(data);
      renderLeaderboardList(data.entries || []);
      return data;
    });
  }

  function renderLeaderboardList(entries) {
    leaderboardEl.innerHTML = "";
    var i;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="rank">' +
        e.rank +
        '.</span><span class="name"></span><span class="score"></span>';
      li.querySelector(".name").textContent = e.name;
      li.querySelector(".score").textContent = String(e.score);
      leaderboardEl.appendChild(li);
    }
  }

  function syncPlayerLine() {
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  function setTouchPadVisible(visible) {
    var pad = document.getElementById("touch-pad");
    if (!pad) {
      return;
    }
    pad.classList.toggle("hidden", !visible);
  }

  function grabFocus() {
    try {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
      window.focus();
      if (!canvas.getAttribute("tabindex")) {
        canvas.setAttribute("tabindex", "0");
      }
      canvas.focus();
      if (document.body) {
        if (!document.body.getAttribute("tabindex")) {
          document.body.setAttribute("tabindex", "0");
        }
      }
    } catch (e) {}
  }

  function setKeyFromEvent(e, isDown) {
    var code = e.code || "";
    var key = e.key || "";
    var kc = e.keyCode || e.which || 0;

    if (
      code === "ArrowLeft" ||
      key === "ArrowLeft" ||
      key === "Left" ||
      kc === 37
    ) {
      keys.ArrowLeft = isDown;
      keys.left = isDown;
    }
    if (
      code === "ArrowRight" ||
      key === "ArrowRight" ||
      key === "Right" ||
      kc === 39
    ) {
      keys.ArrowRight = isDown;
      keys.right = isDown;
    }
    if (code === "ArrowUp" || key === "ArrowUp" || key === "Up" || kc === 38) {
      keys.ArrowUp = isDown;
      keys.up = isDown;
    }
    if (
      code === "ArrowDown" ||
      key === "ArrowDown" ||
      key === "Down" ||
      kc === 40
    ) {
      keys.ArrowDown = isDown;
      keys.down = isDown;
    }
    if (code === "KeyA" || key === "a" || key === "A" || kc === 65) {
      keys.a = isDown;
      keys.A = isDown;
    }
    if (code === "KeyD" || key === "d" || key === "D" || kc === 68) {
      keys.d = isDown;
      keys.D = isDown;
    }
    if (code === "KeyW" || key === "w" || key === "W" || kc === 87) {
      keys.w = isDown;
      keys.W = isDown;
    }
    if (code === "KeyS" || key === "s" || key === "S" || kc === 83) {
      keys.s = isDown;
      keys.S = isDown;
    }
    if (code === "KeyZ" || key === "z" || key === "Z" || kc === 90) {
      keys.z = isDown;
      keys.Z = isDown;
    }
    if (code === "KeyX" || key === "x" || key === "X" || kc === 88) {
      keys.x = isDown;
      keys.X = isDown;
    }
    if (code === "Space" || key === " " || key === "Spacebar" || kc === 32) {
      keys.boost = isDown;
      keys.fast = isDown;
      keys.x = isDown;
      keys.X = isDown;
    }
    if (code === "Escape" || key === "Escape" || key === "Esc" || kc === 27) {
      if (isDown) {
        quitGame();
      }
    }
  }

  function isNavKey(e) {
    var code = e.code || "";
    if (
      code.indexOf("Arrow") === 0 ||
      code === "KeyW" ||
      code === "KeyA" ||
      code === "KeyS" ||
      code === "KeyD" ||
      code === "KeyZ" ||
      code === "KeyX" ||
      code === "Space"
    ) {
      return true;
    }
    var kc = e.keyCode || e.which || 0;
    return (
      kc === 32 ||
      kc === 37 ||
      kc === 38 ||
      kc === 39 ||
      kc === 40 ||
      kc === 65 ||
      kc === 68 ||
      kc === 83 ||
      kc === 87 ||
      kc === 88 ||
      kc === 90
    );
  }

  function handleKeyDown(e) {
    setKeyFromEvent(e, true);
    if (isNavKey(e)) {
      e.preventDefault();
    }
  }

  function handleKeyUp(e) {
    setKeyFromEvent(e, false);
    if (isNavKey(e)) {
      e.preventDefault();
    }
  }

  function bindPadButton(el, onDown, onUp) {
    if (!el) {
      return;
    }
    function down(ev) {
      ev.preventDefault();
      onDown();
      el.classList.add("held");
    }
    function up(ev) {
      if (ev) {
        ev.preventDefault();
      }
      onUp();
      el.classList.remove("held");
    }
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("mouseleave", up);
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });
  }

  function worldFromClient(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var dw = rect.width || 1;
    var dh = rect.height || 1;
    var scale = Math.min(dw / WORLD, dh / WORLD);
    var ox = (dw - WORLD * scale) / 2;
    var oy = (dh - WORLD * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  function updateAimFromClient(clientX, clientY) {
    var w = worldFromClient(clientX, clientY);
    var pcx = (px + 0.5) * CELL;
    var pcy = (py + 0.5) * CELL;
    var dx = w.x - pcx;
    var dy = w.y - pcy;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      aimDx = 0;
      aimDy = 0;
      return;
    }
    if (Math.abs(dy) >= Math.abs(dx)) {
      aimDx = 0;
      aimDy = dy > 0 ? 1 : -1;
    } else {
      aimDx = dx > 0 ? 1 : -1;
      aimDy = 0;
    }
  }

  function setupPointerAim() {
    function down(ev) {
      if (phase !== PHASE_PLAYING) {
        return;
      }
      var t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      aiming = true;
      updateAimFromClient(t.clientX, t.clientY);
      grabFocus();
      if (ev.cancelable) {
        ev.preventDefault();
      }
    }
    function move(ev) {
      if (!aiming) {
        return;
      }
      var t = ev.touches && ev.touches[0] ? ev.touches[0] : ev;
      updateAimFromClient(t.clientX, t.clientY);
      if (ev.cancelable) {
        ev.preventDefault();
      }
    }
    function up(ev) {
      aiming = false;
      aimDx = 0;
      aimDy = 0;
      if (ev && ev.cancelable) {
        ev.preventDefault();
      }
    }
    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up, { passive: false });
    canvas.addEventListener("touchcancel", up, { passive: false });
  }

  function setupTouchPad() {
    bindPadButton(
      document.getElementById("pad-up"),
      function () {
        keys.up = true;
        keys.ArrowUp = true;
      },
      function () {
        keys.up = false;
        keys.ArrowUp = false;
      }
    );
    bindPadButton(
      document.getElementById("pad-down"),
      function () {
        keys.down = true;
        keys.ArrowDown = true;
      },
      function () {
        keys.down = false;
        keys.ArrowDown = false;
      }
    );
    bindPadButton(
      document.getElementById("pad-left"),
      function () {
        keys.left = true;
        keys.ArrowLeft = true;
      },
      function () {
        keys.left = false;
        keys.ArrowLeft = false;
      }
    );
    bindPadButton(
      document.getElementById("pad-right"),
      function () {
        keys.right = true;
        keys.ArrowRight = true;
      },
      function () {
        keys.right = false;
        keys.ArrowRight = false;
      }
    );
    bindPadButton(
      document.getElementById("pad-boost"),
      function () {
        keys.fast = true;
        keys.boost = true;
        keys.x = true;
        keys.X = true;
      },
      function () {
        keys.fast = false;
        keys.boost = false;
        keys.x = false;
        keys.X = false;
      }
    );
  }

  function ensureLoop() {
    if (loopAlive) {
      return;
    }
    loopAlive = true;
    requestAnimationFrame(loop);
  }

  function loop() {
    try {
      if (phase === PHASE_READY) {
        readyTimer--;
        if (readyTimer <= 0) {
          phase = PHASE_PLAYING;
          running = true;
          overlay.classList.add("hidden");
          setQuitVisible(true);
          setTouchPadVisible(true);
          invuln = 180;
          grabFocus();
          banner = "Walk the border, then cut into the dark";
          bannerT = 160;
        } else if (readyTimer < 40) {
          overlayTitle.textContent = "GO!";
        }
      } else if (phase === PHASE_PLAYING && running) {
        updatePlaying();
      }
      drawWorld();
    } catch (loopErr) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("Kicks frame error", loopErr);
      }
    }
    requestAnimationFrame(loop);
  }

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
  btnLeaderboard.addEventListener("click", function () {
    leaderboardModal.classList.remove("hidden");
    refreshLeaderboard();
  });
  btnLeaderboard.addEventListener("touchend", function (e) {
    e.preventDefault();
    leaderboardModal.classList.remove("hidden");
    refreshLeaderboard();
  });
  btnModalClose.addEventListener("click", function () {
    leaderboardModal.classList.add("hidden");
  });
  window.addEventListener("click", grabFocus);
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);
  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("keyup", handleKeyUp, true);
  window.addEventListener("resize", resizeCanvas);
  setupPointerAim();
  setupTouchPad();
  setTouchPadVisible(false);

  parseImgConfig();
  initField();
  resizeCanvas();
  showMenuOverlay();
  syncPlayerLine();
  // Load art after first paint so a bad image URL cannot block menu/start
  setTimeout(function () {
    loadRevealImage();
  }, 50);
  refreshLeaderboard().catch(function () {});
  SLArcade.onSession(function () {
    syncPlayerLine();
    refreshLeaderboard().catch(function () {});
  });
  ensureLoop();
})();
