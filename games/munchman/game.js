(function () {
  "use strict";

  SLArcade.registerGameId("munchman");

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

  var COLS = 28;
  var ROWS = 31;
  var TUNNEL_ROW = 14;
  var TUNNEL_LEFT_COL = 6;
  var TUNNEL_RIGHT_COL = 21;
  var PEN_ROW_TOP = 12;
  var PEN_ROW_MID = 15;
  var PEN_ROW_BOT = 17;
  var PEN_GATE_ROW = 10;
  var PEN_EXIT_ROW = 9;
  var PEN_COL_LEFT = 10;
  var PEN_COL_RIGHT = 17;
  var PEN_DOOR_COL = 13;
  var PLAYER_START_COL = 13;
  var PLAYER_START_ROW = 23;
  var GHOST_RELEASE_BASE_MS = 4000;
  var GHOST_RELEASE_STAGGER_MS = 2000;
  var BOTTOM_PAD = 4;
  var TOP_PAD = 18;
  var TILE_H = Math.floor((H - TOP_PAD - BOTTOM_PAD) / ROWS);
  var TILE_W = Math.floor(W / COLS);
  var TILE = Math.min(TILE_H, TILE_W);
  if (TILE < 8) {
    TILE = 8;
  }
  var MAZE_W = COLS * TILE;
  var MAZE_H = ROWS * TILE;
  var OFF_X = Math.floor((W - MAZE_W) / 2);
  var OFF_Y = TOP_PAD + Math.floor((H - TOP_PAD - BOTTOM_PAD - MAZE_H) / 2);
  var SNAP_THRESHOLD = 2;
  var MAX_FRAME_MS = 50;
  var PLAYER_PIXELS_PER_SEC = 60;
  var GHOST_PIXELS_PER_SEC = 55;
  var FRIGHTENED_PIXELS_PER_SEC = 40;
  var EATEN_GHOST_PIXELS_PER_SEC = 120;
  var WALL_COLOR = "#2121ff";
  var WALL_LINE = Math.max(1, Math.round(TILE * 0.14));
  var GATE_COLOR = "#ffb8ff";
  var PELLET_COLOR = "#ffb8ae";
  var READY_MS = 2000;

  var DIR_NONE = 0;
  var DIR_UP = 1;
  var DIR_LEFT = 2;
  var DIR_DOWN = 3;
  var DIR_RIGHT = 4;
  var DX = [0, 0, -1, 0, 1];
  var DY = [0, -1, 0, 1, 0];

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "levelComplete";
  var PHASE_DIED = "died";
  var PHASE_OVER = "gameOver";

  var MODE_SCATTER = "scatter";
  var MODE_CHASE = "chase";
  var MODE_FRIGHTENED = "frightened";

  var MODE_SCHEDULE = [
    { mode: MODE_SCATTER, ms: 7000 },
    { mode: MODE_CHASE, ms: 20000 },
    { mode: MODE_SCATTER, ms: 7000 },
    { mode: MODE_CHASE, ms: 20000 },
    { mode: MODE_SCATTER, ms: 5000 },
    { mode: MODE_CHASE, ms: 20000 },
    { mode: MODE_SCATTER, ms: 5000 },
    { mode: MODE_CHASE, ms: -1 },
  ];

  var READY_FRAMES = 120;
  var readyMs = 0;
  var STARTING_LIVES = 3;
  var CONTINUE_TIMEOUT_MS = 30000;
  var FRIGHTENED_MS = 6000;
  var DOT_POINTS = 10;
  var POWER_POINTS = 50;
  var GHOST_BASE_POINTS = 200;

  var MAZE_TEMPLATE = [
    "############################",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#o####.#####.##.#####.####o#",
    "#.####.#####.##.#####.####.#",
    "#..........................#",
    "#.####.##.########.##.####.#",
    "#.####.##.########.##.####.#",
    "#......##....##....##......#",
    "######.##### ## #####.######",
    "     #.##### -- #####.#     ",
    "     #.##    G    ##.#      ",
    "     #.## ######## ##.#     ",
    "######.## #      # ##.######",
    "      .   #      #   .      ",
    "######.## #      # ##.######",
    "     #.## ######## ##.#     ",
    "     #.##    G    ##.#      ",
    "     #.## ######## ##.#     ",
    "######.## ######## ##.######",
    "#............##............#",
    "#.####.#####.##.#####.####.#",
    "#.####.#####.##.#####.####.#",
    "#o..##................##..o#",
    "###.##.##.########.##.##.###",
    "###.##.##.########.##.##.###",
    "#......##....##....##......#",
    "#.##########.##.##########.#",
    "#.##########.##.##########.#",
    "#..........................#",
    "############################",
  ];

  var SCATTER_CORNERS = [
    { c: 1, r: 1 },
    { c: COLS - 2, r: 1 },
    { c: 1, r: ROWS - 2 },
    { c: COLS - 2, r: ROWS - 2 },
  ];

  var GHOST_COLORS = ["#f44", "#ffb8de", "#0ff", "#ffb852"];
  var GHOST_PEN_SLOTS = [
    { c: 13, r: 15 },
    { c: 11, r: 15 },
    { c: 15, r: 15 },
    { c: 13, r: 16 },
  ];
  var GHOST_NAMES = ["Crimson", "Rose", "Azure", "Amber"];

  var keys = {};
  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var lives = 3;
  var level = 1;
  var frame = 0;
  var readyTimer = 0;
  var animFrame = 0;
  var continueDeadline = 0;
  var continueTimerId = null;
  var lastLeaderboardData = null;

  var maze = [];
  var dotsLeft = 0;
  var player = null;
  var ghosts = [];
  var ghostMode = MODE_SCATTER;
  var modeScheduleIndex = 0;
  var modeElapsedMs = 0;
  var frightenedMs = 0;
  var lastFrameTime = 0;
  var ghostCombo = 0;
  var mouthFrame = 0;

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

  function tileAt(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
      return "#";
    }
    return maze[r][c];
  }

  function isWalkableTile(t) {
    return t !== "#" && t !== " ";
  }

  function isGateTile(t) {
    return t === "-";
  }

  function canWalkOn(grid, c, r, isPlayer) {
    if (r === TUNNEL_ROW && (c < 0 || c >= COLS)) {
      return true;
    }
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
      return false;
    }
    var t = grid[r][c];
    if (!isWalkableTile(t)) {
      return false;
    }
    if (isPlayer && (t === "G" || isGateTile(t) || isPenInterior(c, r))) {
      return false;
    }
    return true;
  }

  function canWalk(c, r) {
    return canWalkOn(maze, c, r, false);
  }

  function canPlayerWalk(c, r) {
    return canWalkOn(maze, c, r, true);
  }

  function mazeNeighborsOn(grid, c, r) {
    var out = [];
    var d;
    for (d = 1; d <= 4; d++) {
      var nc = c + DX[d];
      var nr = r + DY[d];
      if (r === TUNNEL_ROW && nr === r) {
        if (nc < 0) {
          nc = COLS - 1;
        } else if (nc >= COLS) {
          nc = 0;
        }
      }
      if (canWalkOn(grid, nc, nr, false)) {
        out.push({ c: nc, r: nr });
      }
    }
    return out;
  }

  function wrapCol(c) {
    if (c < 0) {
      return COLS - 1;
    }
    if (c >= COLS) {
      return 0;
    }
    return c;
  }

  function tileCenter(c, r) {
    return {
      x: OFF_X + c * TILE + TILE * 0.5,
      y: OFF_Y + r * TILE + TILE * 0.5,
    };
  }

  function cloneMaze() {
    var out = [];
    var r;
    var c;
    for (r = 0; r < ROWS; r++) {
      out.push(MAZE_TEMPLATE[r].split(""));
    }
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (isPenInterior(c, r) && (out[r][c] === "." || out[r][c] === "o")) {
          out[r][c] = "G";
        }
      }
    }
    var seen = {};
    var queue = [{ c: PLAYER_START_COL, r: PLAYER_START_ROW }];
    seen[PLAYER_START_COL + "," + PLAYER_START_ROW] = true;
    while (queue.length) {
      var cur = queue.shift();
      var nbrs = mazeNeighborsOn(out, cur.c, cur.r);
      var i;
      for (i = 0; i < nbrs.length; i++) {
        var n = nbrs[i];
        var key = n.c + "," + n.r;
        if (seen[key]) {
          continue;
        }
        seen[key] = true;
        queue.push(n);
      }
    }
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if ((out[r][c] === "." || out[r][c] === "o") && !seen[c + "," + r]) {
          out[r][c] = " ";
        }
      }
    }
    return out;
  }

  function mazeNeighbors(c, r) {
    return mazeNeighborsOn(maze, c, r);
  }

  function validateMazeTemplate() {
    var errors = [];
    var r;
    var c;
    if (MAZE_TEMPLATE.length !== ROWS) {
      errors.push("MAZE_TEMPLATE row count mismatch");
    }
    for (r = 0; r < MAZE_TEMPLATE.length; r++) {
      if (MAZE_TEMPLATE[r].length !== COLS) {
        errors.push("row " + r + " width " + MAZE_TEMPLATE[r].length);
      }
    }
    var mazeCheck = cloneMaze();
    var seen = {};
    var queue = [{ c: PLAYER_START_COL, r: PLAYER_START_ROW }];
    seen[PLAYER_START_COL + "," + PLAYER_START_ROW] = true;
    while (queue.length) {
      var cur = queue.shift();
      var nbrs = mazeNeighborsOn(mazeCheck, cur.c, cur.r);
      var i;
      for (i = 0; i < nbrs.length; i++) {
        var n = nbrs[i];
        var key = n.c + "," + n.r;
        if (seen[key]) {
          continue;
        }
        seen[key] = true;
        queue.push(n);
      }
    }
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var t = mazeCheck[r][c];
        if ((t === "." || t === "o") && !isPenInterior(c, r) && !seen[c + "," + r]) {
          errors.push("unreachable pellet " + c + "," + r);
        }
      }
    }
    if (MAZE_TEMPLATE[TUNNEL_ROW].charAt(TUNNEL_LEFT_COL) !== "." &&
        MAZE_TEMPLATE[TUNNEL_ROW].charAt(TUNNEL_RIGHT_COL) !== ".") {
      errors.push("tunnel row blocked");
    }
    if (errors.length) {
      console.error("Munchman maze validation failed:", errors);
    }
    return errors.length === 0;
  }

  function countDots() {
    var n = 0;
    var r;
    var c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (maze[r][c] === "." || maze[r][c] === "o") {
          n++;
        }
      }
    }
    return n;
  }

  function findStart(col, row, dir) {
    var p = tileCenter(col, row);
    return {
      c: col,
      r: row,
      x: p.x,
      y: p.y,
      dir: dir,
      nextDir: dir,
      speed: playerSpeed(),
    };
  }

  function playerSpeed() {
    return PLAYER_PIXELS_PER_SEC / 1000;
  }

  function ghostSpeed(frightened) {
    if (frightened) {
      return FRIGHTENED_PIXELS_PER_SEC / 1000;
    }
    return GHOST_PIXELS_PER_SEC / 1000;
  }

  function eatenGhostSpeed() {
    return EATEN_GHOST_PIXELS_PER_SEC / 1000;
  }

  function initLevel() {
    maze = cloneMaze();
    validateMazeTemplate();
    dotsLeft = countDots();
    player = findStart(PLAYER_START_COL, PLAYER_START_ROW, DIR_LEFT);
    ghosts = [
      makeGhost(GHOST_PEN_SLOTS[0].c, GHOST_PEN_SLOTS[0].r, DIR_UP, 0, true),
      makeGhost(GHOST_PEN_SLOTS[1].c, GHOST_PEN_SLOTS[1].r, DIR_UP, 1, true),
      makeGhost(GHOST_PEN_SLOTS[2].c, GHOST_PEN_SLOTS[2].r, DIR_UP, 2, true),
      makeGhost(GHOST_PEN_SLOTS[3].c, GHOST_PEN_SLOTS[3].r, DIR_UP, 3, true),
    ];
    ghostMode = MODE_SCATTER;
    modeScheduleIndex = 0;
    modeElapsedMs = 0;
    frightenedMs = 0;
    ghostCombo = 0;
  }

  function makeGhost(c, r, dir, idx, inPen) {
    var p = tileCenter(c, r);
    return {
      c: c,
      r: r,
      x: p.x,
      y: p.y,
      dir: dir,
      idx: idx,
      inPen: inPen,
      exiting: idx === 0,
      releaseTimer: idx === 0 ? 0 : GHOST_RELEASE_BASE_MS + (idx - 1) * GHOST_RELEASE_STAGGER_MS,
      eaten: false,
      speed: ghostSpeed(false),
    };
  }

  function isPenInterior(c, r) {
    if (r < PEN_ROW_TOP || r > PEN_ROW_BOT) {
      return false;
    }
    if (c < PEN_COL_LEFT || c > PEN_COL_RIGHT) {
      return false;
    }
    var t = tileAt(c, r);
    return t === "G" || isWalkableTile(t);
  }

  function validDirs(c, r, forbid, allowPen) {
    var out = [];
    var d;
    for (d = 1; d <= 4; d++) {
      if (d === forbid) {
        continue;
      }
      var nc = c + DX[d];
      var nr = r + DY[d];
      if (r === TUNNEL_ROW && nr === r) {
        if (d === DIR_LEFT && c === TUNNEL_LEFT_COL) {
          out.push(d);
          continue;
        }
        if (d === DIR_RIGHT && c === TUNNEL_RIGHT_COL) {
          out.push(d);
          continue;
        }
      }
      if (nc < 0 || nc >= COLS) {
        if (r === TUNNEL_ROW) {
          out.push(d);
        }
        continue;
      }
      if (!allowPen && (isPenInterior(nc, nr) || maze[nr][nc] === "G" || isGateTile(maze[nr][nc]))) {
        continue;
      }
      if (canWalk(nc, nr)) {
        out.push(d);
      }
    }
    return out;
  }

  function oppositeDir(d) {
    if (d === DIR_UP) {
      return DIR_DOWN;
    }
    if (d === DIR_DOWN) {
      return DIR_UP;
    }
    if (d === DIR_LEFT) {
      return DIR_RIGHT;
    }
    if (d === DIR_RIGHT) {
      return DIR_LEFT;
    }
    return DIR_NONE;
  }

  function dist2(c1, r1, c2, r2) {
    var dc = c1 - c2;
    var dr = r1 - r2;
    return dc * dc + dr * dr;
  }

  function pickGhostDir(g) {
    var allowPen = g.eaten || g.exiting || g.inPen;
    var forbidOpposite = oppositeDir(g.dir);
    var opts = validDirs(g.c, g.r, forbidOpposite, allowPen);
    if (!opts.length) {
      opts = validDirs(g.c, g.r, DIR_NONE, allowPen);
    }
    if (!opts.length) {
      return g.dir || DIR_LEFT;
    }
    if (opts.length === 1) {
      return opts[0];
    }

    if (frightenedMs > 0 && !g.eaten) {
      return opts[Math.floor(Math.random() * opts.length)];
    }

    if (g.exiting) {
      return DIR_UP;
    }

    var target;
    if (ghostMode === MODE_SCATTER) {
      target = SCATTER_CORNERS[g.idx];
    } else {
      target = { c: player.c, r: player.r };
      if (g.idx === 1) {
        var leadDir = player.dir || player.nextDir || DIR_LEFT;
        target = { c: player.c + DX[leadDir] * 4, r: player.r + DY[leadDir] * 4 };
      } else if (g.idx === 2) {
        target = { c: player.c, r: player.r };
      } else if (g.idx === 3) {
        if (dist2(g.c, g.r, player.c, player.r) > 36) {
          target = { c: player.c, r: player.r };
        } else {
          target = SCATTER_CORNERS[3];
        }
      }
    }

    var best = opts[0];
    var bestD = 1e9;
    var i;
    for (i = 0; i < opts.length; i++) {
      var nc = g.c + DX[opts[i]];
      var nr = g.r + DY[opts[i]];
      var d = dist2(nc, nr, target.c, target.r);
      if (d < bestD) {
        bestD = d;
        best = opts[i];
      } else if (d === bestD && opts[i] < best) {
        best = opts[i];
      }
    }
    return best;
  }

  function isAtTileCenter(actor) {
    var p = tileCenter(actor.c, actor.r);
    return Math.abs(actor.x - p.x) < 0.5 && Math.abs(actor.y - p.y) < 0.5;
  }

  function snapToCenter(actor) {
    var p = tileCenter(actor.c, actor.r);
    actor.x = p.x;
    actor.y = p.y;
  }

  function snapIfNearCenter(actor) {
    var p = tileCenter(actor.c, actor.r);
    if (Math.abs(actor.x - p.x) < SNAP_THRESHOLD) {
      actor.x = p.x;
    }
    if (Math.abs(actor.y - p.y) < SNAP_THRESHOLD) {
      actor.y = p.y;
    }
  }

  function actorCanWalk(c, r, isPlayer) {
    if (isPlayer) {
      return canPlayerWalk(c, r);
    }
    return canWalk(c, r);
  }

  function resolveNextTile(actor) {
    var nc = actor.c + DX[actor.dir];
    var nr = actor.r + DY[actor.dir];
    if (actor.r === TUNNEL_ROW && nr === actor.r) {
      if (actor.dir === DIR_LEFT && actor.c === TUNNEL_LEFT_COL) {
        return { c: TUNNEL_RIGHT_COL, r: nr };
      }
      if (actor.dir === DIR_RIGHT && actor.c === TUNNEL_RIGHT_COL) {
        return { c: TUNNEL_LEFT_COL, r: nr };
      }
      if (nc < 0 || nc >= COLS) {
        nc = wrapCol(nc);
      }
    }
    return { c: nc, r: nr };
  }

  function remainingToNextTile(actor) {
    var next = resolveNextTile(actor);
    var target = tileCenter(next.c, next.r);
    if (actor.dir === DIR_RIGHT) {
      return target.x - actor.x;
    }
    if (actor.dir === DIR_LEFT) {
      return actor.x - target.x;
    }
    if (actor.dir === DIR_DOWN) {
      return target.y - actor.y;
    }
    if (actor.dir === DIR_UP) {
      return actor.y - target.y;
    }
    return 0;
  }

  function resolveDirAtCenter(actor, isPlayer) {
    snapToCenter(actor);
    if (isPlayer) {
      if (actor.nextDir) {
        var turn = resolveNextTile({ c: actor.c, r: actor.r, dir: actor.nextDir });
        if (actorCanWalk(turn.c, turn.r, true)) {
          actor.dir = actor.nextDir;
          return;
        }
      }
      if (actor.dir) {
        var fwd = resolveNextTile(actor);
        if (!actorCanWalk(fwd.c, fwd.r, true)) {
          actor.dir = DIR_NONE;
        }
      } else if (actor.nextDir) {
        var start = resolveNextTile({ c: actor.c, r: actor.r, dir: actor.nextDir });
        if (actorCanWalk(start.c, start.r, true)) {
          actor.dir = actor.nextDir;
        }
      }
      return;
    }
    if (actor.exiting || actor.eaten) {
      actor.dir = DIR_UP;
      return;
    }
    actor.dir = pickGhostDir(actor);
    actor.speed = actor.eaten ? eatenGhostSpeed() : ghostSpeed(frightenedMs > 0);
  }

  function handleTunnelWrap(actor, isPlayer) {
    if (actor.r !== TUNNEL_ROW) {
      return false;
    }
    if (actor.dir === DIR_LEFT && actor.x < OFF_X - TILE * 0.5) {
      actor.c = COLS - 1;
      snapToCenter(actor);
      if (isPlayer) {
        eatAt(actor.c, actor.r);
      }
      return true;
    }
    if (actor.dir === DIR_RIGHT && actor.x > OFF_X + MAZE_W + TILE * 0.5) {
      actor.c = 0;
      snapToCenter(actor);
      if (isPlayer) {
        eatAt(actor.c, actor.r);
      }
      return true;
    }
    return false;
  }

  function moveActor(actor, isPlayer, elapsedMs) {
    var distLeft = actor.speed * elapsedMs;
    var safety = 0;

    while (distLeft > 0.01 && safety < 8) {
      safety++;

      if (handleTunnelWrap(actor, isPlayer)) {
        continue;
      }

      if (!actor.dir) {
        if (isAtTileCenter(actor)) {
          resolveDirAtCenter(actor, isPlayer);
        } else {
          snapIfNearCenter(actor);
          if (isAtTileCenter(actor)) {
            resolveDirAtCenter(actor, isPlayer);
          }
        }
        if (!actor.dir) {
          return;
        }
      }

      if (isAtTileCenter(actor)) {
        resolveDirAtCenter(actor, isPlayer);
        if (!actor.dir) {
          return;
        }
      } else {
        snapIfNearCenter(actor);
      }

      var next = resolveNextTile(actor);
      var nc = next.c;
      var nr = next.r;
      if (!actorCanWalk(nc, nr, isPlayer)) {
        snapToCenter(actor);
        actor.dir = DIR_NONE;
        return;
      }

      var step = remainingToNextTile(actor);
      if (step <= 0.01) {
        actor.c = nc;
        actor.r = nr;
        snapToCenter(actor);
        if (isPlayer) {
          eatAt(actor.c, actor.r);
        }
        continue;
      }

      if (distLeft >= step) {
        actor.c = nc;
        actor.r = nr;
        snapToCenter(actor);
        distLeft -= step;
        if (isPlayer) {
          eatAt(actor.c, actor.r);
        }
      } else {
        actor.x += DX[actor.dir] * distLeft;
        actor.y += DY[actor.dir] * distLeft;
        distLeft = 0;
      }
    }
  }

  function eatAt(c, r) {
    var t = maze[r][c];
    if (t === ".") {
      maze[r][c] = " ";
      score += DOT_POINTS;
      dotsLeft--;
      updateHud();
    } else if (t === "o") {
      maze[r][c] = " ";
      score += POWER_POINTS;
      dotsLeft--;
      frightenedMs = FRIGHTENED_MS;
      ghostCombo = 0;
      var i;
      for (i = 0; i < ghosts.length; i++) {
        if (!ghosts[i].eaten) {
          ghosts[i].dir = oppositeDir(ghosts[i].dir) || DIR_LEFT;
          ghosts[i].speed = ghostSpeed(true);
        }
      }
      updateHud();
    }
  }

  function reverseAllGhosts() {
    var i;
    for (i = 0; i < ghosts.length; i++) {
      if (!ghosts[i].eaten && !ghosts[i].inPen) {
        ghosts[i].dir = oppositeDir(ghosts[i].dir) || ghosts[i].dir;
      }
    }
  }

  function updateModeTimer(elapsedMs) {
    if (frightenedMs > 0) {
      frightenedMs -= elapsedMs;
      if (frightenedMs <= 0) {
        frightenedMs = 0;
        var i;
        for (i = 0; i < ghosts.length; i++) {
          if (!ghosts[i].eaten) {
            ghosts[i].speed = ghostSpeed(false);
          }
        }
      }
      return;
    }
    var entry = MODE_SCHEDULE[modeScheduleIndex];
    if (!entry) {
      return;
    }
    ghostMode = entry.mode;
    if (entry.ms < 0) {
      return;
    }
    modeElapsedMs += elapsedMs;
    if (modeElapsedMs >= entry.ms) {
      modeElapsedMs = 0;
      modeScheduleIndex++;
      entry = MODE_SCHEDULE[modeScheduleIndex];
      if (entry) {
        ghostMode = entry.mode;
        reverseAllGhosts();
      }
    }
  }

  function updateGhosts(elapsedMs) {
    var i;
    for (i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      if (g.eaten) {
        g.speed = eatenGhostSpeed();
        g.dir = DIR_UP;
        moveActor(g, false, elapsedMs);
        if (g.r <= PEN_ROW_MID && g.c >= PEN_DOOR_COL - 1 && g.c <= PEN_DOOR_COL + 1) {
          g.eaten = false;
          g.inPen = true;
          g.exiting = false;
          g.releaseTimer = GHOST_RELEASE_BASE_MS;
          var home = GHOST_PEN_SLOTS[g.idx];
          g.c = home.c;
          g.r = home.r;
          snapToCenter(g);
          g.speed = ghostSpeed(false);
        }
        continue;
      }
      if (g.inPen && !g.exiting) {
        g.releaseTimer -= elapsedMs;
        g.dir = DIR_NONE;
        var slot = GHOST_PEN_SLOTS[g.idx];
        g.c = slot.c;
        g.r = slot.r;
        snapToCenter(g);
        g.y += Math.sin(frame * 0.1 + g.idx * 1.7) * (TILE * 0.04);
        if (g.releaseTimer <= 0) {
          g.exiting = true;
          g.dir = DIR_UP;
          g.c = PEN_DOOR_COL;
        }
        continue;
      }
      if (g.inPen && g.exiting) {
        g.c = PEN_DOOR_COL;
        moveActor(g, false, elapsedMs);
        if (g.r <= PEN_EXIT_ROW) {
          g.inPen = false;
          g.exiting = false;
        }
        continue;
      }
      moveActor(g, false, elapsedMs);
    }
  }

  function checkCollisions() {
    var i;
    for (i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      if (g.inPen || g.eaten) {
        continue;
      }
      var d = Math.abs(g.x - player.x) + Math.abs(g.y - player.y);
      if (d > TILE * 0.55) {
        continue;
      }
      if (frightenedMs > 0 && !g.eaten) {
        g.eaten = true;
        ghostCombo++;
        score += GHOST_BASE_POINTS * Math.pow(2, ghostCombo - 1);
        g.dir = DIR_NONE;
        updateHud();
      } else if (!g.eaten) {
        playerDied();
        return;
      }
    }
  }

  function clearContinueTimer() {
    if (continueTimerId) {
      clearTimeout(continueTimerId);
      continueTimerId = null;
    }
  }

  function playerDied() {
    lives--;
    updateHud();
    if (lives <= 0) {
      gameOver();
      return;
    }
    phase = PHASE_DIED;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "MUNCHED!";
    instructionsEl.textContent = "Lives left: " + lives;
    btnStart.textContent = "CONTINUE";
    btnStart.disabled = false;
    endHintEl.textContent = "Press CONTINUE within 30 seconds.";
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
    continueDeadline = Date.now() + CONTINUE_TIMEOUT_MS;
    clearContinueTimer();
    continueTimerId = setTimeout(function () {
      if (phase === PHASE_DIED) {
        gameOver();
      }
    }, CONTINUE_TIMEOUT_MS);
  }

  function continueAfterDeath() {
    if (phase !== PHASE_DIED) {
      return;
    }
    clearContinueTimer();
    player = findStart(PLAYER_START_COL, PLAYER_START_ROW, DIR_LEFT);
    var i;
    for (i = 0; i < ghosts.length; i++) {
      ghosts[i] = makeGhost(
        GHOST_PEN_SLOTS[i].c,
        GHOST_PEN_SLOTS[i].r,
        DIR_UP,
        i,
        true
      );
    }
    frightenedMs = 0;
    ghostMode = MODE_SCATTER;
    modeScheduleIndex = 0;
    modeElapsedMs = 0;
    beginReadyCountdown("GET READY!", "Ghosts are hungry again…");
  }

  function checkLevelComplete() {
    if (dotsLeft <= 0) {
      running = false;
      showLevelComplete();
    }
  }

  function updatePlaying(elapsedMs) {
    frame++;
    animFrame++;
    if (animFrame % 6 === 0) {
      mouthFrame = 1 - mouthFrame;
    }

    if (player.dir === DIR_NONE && player.nextDir && isAtTileCenter(player)) {
      var boot = resolveNextTile({ c: player.c, r: player.r, dir: player.nextDir });
      if (canPlayerWalk(boot.c, boot.r)) {
        player.dir = player.nextDir;
      }
    }

    moveActor(player, true, elapsedMs);
    updateModeTimer(elapsedMs);
    updateGhosts(elapsedMs);
    checkCollisions();
    checkLevelComplete();
  }

  function update(elapsedMs) {
    if (phase === PHASE_READY) {
      readyMs -= elapsedMs;
      if (readyMs <= 0) {
        phase = PHASE_PLAYING;
        running = true;
        overlay.classList.add("hidden");
        setQuitVisible(true);
      }
      return;
    }
    if (phase === PHASE_PLAYING && running) {
      updatePlaying(elapsedMs);
    }
  }

  function isWallTile(t) {
    return t === "#";
  }

  function wallAt(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
      return true;
    }
    return isWallTile(maze[r][c]);
  }

  function drawMazeWalls() {
    var r;
    var c;
    var inset = WALL_LINE * 0.5;
    ctx.strokeStyle = WALL_COLOR;
    ctx.lineWidth = WALL_LINE;
    ctx.lineCap = "square";
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (!isWallTile(maze[r][c])) {
          continue;
        }
        var x = OFF_X + c * TILE;
        var y = OFF_Y + r * TILE;
        if (!wallAt(c, r - 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y + inset);
          ctx.lineTo(x + TILE, y + inset);
          ctx.stroke();
        }
        if (!wallAt(c, r + 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y + TILE - inset);
          ctx.lineTo(x + TILE, y + TILE - inset);
          ctx.stroke();
        }
        if (!wallAt(c - 1, r)) {
          ctx.beginPath();
          ctx.moveTo(x + inset, y);
          ctx.lineTo(x + inset, y + TILE);
          ctx.stroke();
        }
        if (!wallAt(c + 1, r)) {
          ctx.beginPath();
          ctx.moveTo(x + TILE - inset, y);
          ctx.lineTo(x + TILE - inset, y + TILE);
          ctx.stroke();
        }
      }
    }
  }

  function drawGhostGate() {
    var r;
    var c;
    ctx.strokeStyle = GATE_COLOR;
    ctx.lineWidth = Math.max(1, Math.round(TILE * 0.1));
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (!isGateTile(maze[r][c])) {
          continue;
        }
        var x = OFF_X + c * TILE;
        var y = OFF_Y + r * TILE + TILE * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + 2, y);
        ctx.lineTo(x + TILE - 2, y);
        ctx.stroke();
      }
    }
  }

  function drawPellets() {
    var r;
    var c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var t = maze[r][c];
        var x = OFF_X + c * TILE;
        var y = OFF_Y + r * TILE;
        if (t === ".") {
          var dot = Math.max(2, Math.round(TILE * 0.12));
          ctx.fillStyle = PELLET_COLOR;
          ctx.fillRect(
            x + Math.floor(TILE * 0.5) - Math.floor(dot * 0.5),
            y + Math.floor(TILE * 0.5) - Math.floor(dot * 0.5),
            dot,
            dot
          );
        } else if (t === "o") {
          ctx.fillStyle = PELLET_COLOR;
          ctx.beginPath();
          ctx.arc(
            x + TILE * 0.5,
            y + TILE * 0.5,
            Math.max(3, TILE * 0.18),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
  }

  function drawGhostHouseFloor() {
    var r;
    var c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (maze[r][c] !== "G") {
          continue;
        }
        var x = OFF_X + c * TILE;
        var y = OFF_Y + r * TILE;
        ctx.fillStyle = "#000";
        ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      }
    }
  }

  function drawMaze() {
    if (!maze.length) {
      return;
    }
    drawGhostHouseFloor();
    drawPellets();
    drawMazeWalls();
    drawGhostGate();
  }

  function drawPlayer() {
    var mouth = mouthFrame ? 0.25 : 0.55;
    var rot = 0;
    if (player.dir === DIR_LEFT) {
      rot = Math.PI;
    } else if (player.dir === DIR_UP) {
      rot = -Math.PI * 0.5;
    } else if (player.dir === DIR_DOWN) {
      rot = Math.PI * 0.5;
    }
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(rot);
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, TILE * 0.38, mouth * Math.PI, (2 - mouth) * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGhosts() {
    var i;
    for (i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      var radius = TILE * 0.34;
      if (frightenedMs > 0 && !g.eaten) {
        ctx.fillStyle = frightenedMs < 1500 && Math.floor(frame / 8) % 2 ? "#fff" : "#28f";
      } else if (g.eaten) {
        ctx.fillStyle = "#ccc";
        radius = TILE * 0.28;
      } else {
        ctx.fillStyle = GHOST_COLORS[g.idx];
      }
      var gy = g.y - 2;
      var feet = gy + radius * 0.9;
      ctx.beginPath();
      ctx.arc(g.x, gy, radius, Math.PI, 0);
      ctx.lineTo(g.x + radius, feet);
      ctx.lineTo(g.x + radius * 0.5, feet - 5);
      ctx.lineTo(g.x, feet + 1);
      ctx.lineTo(g.x - radius * 0.5, feet - 5);
      ctx.lineTo(g.x - radius, feet);
      ctx.closePath();
      ctx.fill();
      if (!g.eaten && !(frightenedMs > 0)) {
        var eye = Math.max(2, Math.floor(TILE * 0.14));
        ctx.fillStyle = "#fff";
        ctx.fillRect(g.x - eye * 1.5, g.y - eye, eye, eye + 1);
        ctx.fillRect(g.x + eye * 0.5, g.y - eye, eye, eye + 1);
        ctx.fillStyle = "#00f";
        ctx.fillRect(g.x - eye * 1.3, g.y - eye * 0.7, eye * 0.5, eye * 0.7);
        ctx.fillRect(g.x + eye * 0.7, g.y - eye * 0.7, eye * 0.5, eye * 0.7);
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (maze.length) {
      drawMaze();
    }
    if (phase !== PHASE_MENU && phase !== PHASE_OVER && player) {
      drawGhosts();
      drawPlayer();
    }
    if (phase === PHASE_READY && readyMs > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffe066";
      ctx.font = "bold " + Math.max(12, Math.round(TILE * 0.9)) + "px monospace";
      ctx.textAlign = "center";
      ctx.fillText("READY!", OFF_X + MAZE_W * 0.5, OFF_Y + TILE * (PEN_ROW_MID + 0.5));
      ctx.textAlign = "left";
    }
  }

  function loop(now) {
    if (!lastFrameTime) {
      lastFrameTime = now;
    }
    var elapsedMs = Math.min(MAX_FRAME_MS, now - lastFrameTime);
    lastFrameTime = now;
    try {
      update(elapsedMs);
      draw();
    } catch (err) {
      console.error("Munchman loop error:", err);
    }
    requestAnimationFrame(loop);
  }

  function updateHud() {
    hud.textContent =
      "SCORE " + score + "   LEVEL " + level + "   LIVES " + lives;
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "MUNCHMAN";
    instructionsEl.textContent =
      "Arrow keys or WASD to move. Eat all dots — power pellets let you munch ghosts!";
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
    readyMs = READY_MS;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = titleText || "GET READY!";
    instructionsEl.textContent = hintText || "Ghosts leave the pen one by one…";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function showLevelComplete() {
    phase = PHASE_LEVEL;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "LEVEL " + level + " CLEARED!";
    instructionsEl.textContent = "Score: " + score + " — ghosts speed up next maze.";
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT LEVEL";
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

  function enablePlayAgain(hint) {
    btnStart.textContent = "PLAY AGAIN";
    btnStart.disabled = false;
    endHintEl.textContent = hint || "Tap PLAY AGAIN for another run.";
  }

  function gameOver() {
    clearContinueTimer();
    phase = PHASE_OVER;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GAME OVER";
    instructionsEl.textContent = "Final score: " + score + " — Level " + level;
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

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    if (phase === PHASE_DIED) {
      continueAfterDeath();
      return;
    }
    clearContinueTimer();
    score = 0;
    lives = STARTING_LIVES;
    level = 1;
    frame = 0;
    animFrame = 0;
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    initLevel();
    updateHud();
    beginReadyCountdown("GET READY!", "Chomp all the dots — avoid the ghosts!");
  }

  function nextLevel() {
    level++;
    initLevel();
    updateHud();
    beginReadyCountdown(
      "LEVEL " + level,
      "Ghosts are faster — grab power pellets when you can!"
    );
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    clearContinueTimer();
    phase = PHASE_MENU;
    running = false;
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

  function keyToDir(key) {
    if (key === "ArrowUp" || key === "w" || key === "W") {
      return DIR_UP;
    }
    if (key === "ArrowDown" || key === "s" || key === "S") {
      return DIR_DOWN;
    }
    if (key === "ArrowLeft" || key === "a" || key === "A") {
      return DIR_LEFT;
    }
    if (key === "ArrowRight" || key === "d" || key === "D") {
      return DIR_RIGHT;
    }
    return DIR_NONE;
  }

  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    var dir = keyToDir(e.key);
    if (dir && player && (phase === PHASE_PLAYING || phase === PHASE_READY)) {
      player.nextDir = dir;
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
    btnStart.textContent = "PLEASE WAIT…";
    btnStart.disabled = true;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
  } else {
    showMenuOverlay();
  }
  requestAnimationFrame(loop);
})();
