(function () {
  "use strict";

  SLArcade.registerGameId("alieninfestation");

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

  // Authentic Galaga vertical aspect (3:4) — all gameplay uses these coords
  var VIRTUAL_WIDTH = 224;
  var VIRTUAL_HEIGHT = 288;
  var W = VIRTUAL_WIDTH;
  var H = VIRTUAL_HEIGHT;
  var viewScale = 1;
  var viewOffsetX = 0;
  var viewOffsetY = 0;

  var PHASE_MENU = "menu";
  var PHASE_READY = "ready";
  var PHASE_PLAYING = "playing";
  var PHASE_LEVEL = "levelComplete";
  var PHASE_DIED = "died";
  var PHASE_OVER = "gameOver";
  var PHASE_CHALLENGE_END = "challengeEnd";

  var MODE_ENTERING = "entering";
  var MODE_FORMATION = "formation";
  var MODE_DIVING = "diving";
  var MODE_RETURNING = "returning";
  var MODE_TRACTOR = "tractor";
  var MODE_CHALLENGE = "challenge";

  var TYPE_BOSS = 0;
  var TYPE_GUARDIAN = 1;
  var TYPE_DRONE = 2;

  var READY_FRAMES = 110;
  var RESPAWN_FRAMES = 90;
  var STARTING_LIVES = 3;
  var LIFE_BONUS_SCORES = [5000, 10000, 20000, 40000];
  var CONTINUE_TIMEOUT_MS = 30000;
  var SHOT_COOLDOWN = 11;
  var MAX_SHOTS = 2;
  var MAX_SHOTS_DUAL = 4;

  var PTS_FORM_BY_TYPE = [150, 80, 50];
  var PTS_DIVE_BY_TYPE = [400, 160, 100];
  var BASE_DIVE_SPEED = 1.15;
  var SPRITE_PX = 1;
  var waveConfig = null;
  var diveChance = 0.55;
  var maxEnemyBullets = 3;
  var dronePassFire = false;

  var keys = {};
  var mouseFire = false;
  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var highScore = 0;
  var lives = 3;
  var level = 1;
  var frame = 0;
  var lastShot = 0;
  var readyTimer = 0;
  var animFrame = 0;
  var playerInvuln = 0;
  var lifeBonusesClaimed = 0;
  var bonusFlashTimer = 0;
  var bonusFlashText = "";
  var continueDeadline = 0;
  var continueTimerId = null;
  var lastLeaderboardData = null;
  var bannerTimer = 0;
  var bannerText = "";

  var isChallenge = false;
  var challengeHits = 0;
  var challengeTotal = 40;
  var challengeBonus = 0;
  var challengeGroup = 0;
  var challengeSpawnT = 0;

  var dualFighter = false;
  var shotsFired = 0;
  var shotsHit = 0;

  var diveTimer = 0;
  var diveInterval = 100;
  var maxDivers = 2;
  var enemyShotTimer = 0;
  var enemyShotInterval = 95;
  var formationBob = 0;
  var formationReady = false;
  var enterQueue = [];
  var enterTimer = 0;
  var convoySide = 0;

  var player = {
    x: W / 2 - 8,
    y: H - 28,
    w: 16,
    h: 16,
    speed: 2.1,
  };
  var playerBullets = [];
  var enemyBullets = [];
  var enemies = [];
  var particles = [];
  var stars = [];
  var capturedShip = null;

  // 0: transparent, 1: white, 2: red, 3: blue, 4: yellow
  var SPRITE_PALETTE = {
    1: "#f4f7ff",
    2: "#de2121",
    3: "#1b4cd3",
    4: "#ffff00",
  };
  var BOSS_PALETTE_OK = {
    1: "#f4f7ff",
    2: "#de2121",
    3: "#00de73",
    4: "#ffff00",
  };
  var BOSS_PALETTE_HURT = {
    1: "#f4f7ff",
    2: "#de2121",
    3: "#0044ff",
    4: "#ffff00",
  };
  var CAPTURED_PALETTE = {
    1: "#de2121",
    2: "#a01818",
    3: "#1b4cd3",
    4: "#ffff00",
  };

  var PLAYER_SHIP = [
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 2, 1, 1, 2, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 2, 1, 1, 2, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 1, 1, 1],
    [1, 1, 0, 0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  ];

  var BOSS_FRAMES = [
    [
      [0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 3, 4, 4, 4, 4, 3, 3, 0, 0, 0, 0],
      [0, 0, 0, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 0, 0, 0],
      [0, 0, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 0, 0],
      [0, 3, 3, 1, 3, 4, 4, 4, 4, 4, 4, 3, 1, 3, 3, 0],
      [0, 3, 1, 1, 3, 3, 4, 4, 4, 4, 3, 3, 1, 1, 3, 0],
      [3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3],
      [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3],
      [3, 0, 0, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 0, 0, 3],
      [3, 0, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 0, 3],
      [0, 0, 3, 3, 4, 4, 0, 0, 0, 0, 4, 4, 3, 3, 0, 0],
      [0, 0, 3, 3, 4, 0, 0, 0, 0, 0, 0, 4, 3, 3, 0, 0],
      [0, 0, 0, 3, 4, 0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0],
      [0, 0, 0, 3, 4, 0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0],
      [0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 3, 3, 0, 0, 3, 3, 0, 0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 3, 4, 4, 4, 4, 3, 3, 0, 0, 0, 0],
      [0, 0, 0, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 0, 0, 0],
      [0, 0, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 0, 0],
      [0, 3, 3, 1, 3, 4, 4, 4, 4, 4, 4, 3, 1, 3, 3, 0],
      [3, 3, 1, 1, 3, 3, 4, 4, 4, 4, 3, 3, 1, 1, 3, 3],
      [3, 3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 3, 3],
      [3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3],
      [0, 3, 0, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 0, 3, 0],
      [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 0],
      [0, 0, 3, 3, 4, 4, 0, 0, 0, 0, 4, 4, 3, 3, 0, 0],
      [0, 0, 0, 3, 4, 0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0],
      [0, 0, 0, 3, 4, 0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0],
      [0, 0, 0, 0, 3, 4, 0, 0, 0, 0, 4, 3, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0],
    ],
  ];

  var GUARDIAN_FRAMES = [
    [
      [0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0],
      [0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0],
      [2, 2, 2, 2, 2, 0, 0, 1, 1, 0, 0, 2, 2, 2, 2, 2],
      [2, 2, 1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 1, 2, 2],
      [0, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 0],
      [0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0],
      [0, 0, 0, 2, 2, 4, 2, 2, 2, 2, 4, 2, 2, 0, 0, 0],
      [0, 0, 0, 0, 2, 2, 2, 1, 1, 2, 2, 2, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 2, 2, 2, 1, 1, 2, 2, 2, 0, 0, 0, 0],
      [0, 0, 0, 2, 2, 0, 2, 2, 2, 2, 0, 2, 2, 0, 0, 0],
      [0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0],
      [0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0],
      [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
      [0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0],
      [0, 2, 2, 2, 2, 2, 0, 1, 1, 0, 2, 2, 2, 2, 2, 0],
      [2, 2, 1, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 1, 2, 2],
      [2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2],
      [0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0],
      [0, 0, 2, 2, 4, 2, 2, 2, 2, 2, 2, 4, 2, 2, 0, 0],
      [0, 0, 0, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0],
      [0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0],
      [0, 0, 0, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0],
      [0, 0, 2, 2, 0, 2, 2, 2, 2, 2, 2, 0, 2, 2, 0, 0],
      [0, 2, 2, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 2, 2, 0],
      [2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
  ];

  var DRONE_FRAMES = [
    [
      [0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 3, 4, 4, 4, 4, 3, 3, 0, 0, 0, 0],
      [0, 0, 0, 3, 3, 4, 1, 4, 4, 1, 4, 3, 3, 0, 0, 0],
      [0, 0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 3, 0, 0],
      [0, 3, 3, 2, 3, 4, 4, 4, 4, 4, 4, 3, 2, 3, 3, 0],
      [0, 3, 2, 2, 3, 3, 4, 4, 4, 4, 3, 3, 2, 2, 3, 0],
      [3, 3, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3],
      [3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3],
      [3, 0, 0, 3, 3, 1, 1, 1, 1, 1, 1, 3, 3, 0, 0, 3],
      [3, 0, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 0, 3],
      [0, 0, 3, 3, 1, 1, 0, 0, 0, 0, 1, 1, 3, 3, 0, 0],
      [0, 0, 3, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 3, 0, 0],
      [0, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0, 0],
      [0, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 1, 3, 0, 0, 0],
      [0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 3, 3, 0, 0, 3, 3, 0, 0, 0, 0, 0],
    ],
  ];

  var ENEMY_SETS = [BOSS_FRAMES, GUARDIAN_FRAMES, DRONE_FRAMES];

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

  function initStars() {
    stars = [];
    var i;
    for (i = 0; i < 110; i++) {
      var layer = Math.floor(Math.random() * 3);
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: layer === 0 ? 1 : layer === 1 ? 1.5 : 2.2,
        v: layer === 0 ? 0.35 : layer === 1 ? 0.85 : 1.6,
        a: layer === 0 ? 0.35 : layer === 1 ? 0.6 : 0.95,
      });
    }
  }
  initStars();

  function isChallengeWave(n) {
    return n >= 3 && (n - 3) % 4 === 0;
  }

  function enemyPalette(e) {
    if (e.type === TYPE_BOSS) {
      if (e.hp >= 2) {
        return BOSS_PALETTE_OK;
      }
      return BOSS_PALETTE_HURT;
    }
    return SPRITE_PALETTE;
  }

  function enemyBurstColor(e) {
    if (e.type === TYPE_BOSS) {
      if (e.hp >= 2) {
        return "#00de73";
      }
      return "#0044ff";
    }
    if (e.type === TYPE_GUARDIAN) {
      return "#de2121";
    }
    return "#1b4cd3";
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

  function drawMatrix(matrix, x, y, pixelSize, colorMap) {
    var map = colorMap || SPRITE_PALETTE;
    var r;
    var c;
    for (r = 0; r < matrix.length; r++) {
      for (c = 0; c < matrix[r].length; c++) {
        var v = matrix[r][c];
        if (!v) {
          continue;
        }
        var col = map[v];
        if (!col) {
          continue;
        }
        ctx.fillStyle = col;
        ctx.fillRect(x + c * pixelSize, y + r * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  function drawMatrixCentered(matrix, cx, cy, pixelSize, colorMap) {
    var size = pixelSpriteSize(matrix, pixelSize);
    drawMatrix(matrix, cx - size.w / 2, cy - size.h / 2, pixelSize, colorMap);
  }

  function enemySpriteSize(type) {
    return pixelSpriteSize(ENEMY_SETS[type][0], SPRITE_PX);
  }

  function generateWave(waveNumber) {
    var rows = [];
    var n = waveNumber;
    if (n <= 1) {
      rows = [
        { type: TYPE_GUARDIAN, cols: 8 },
        { type: TYPE_DRONE, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
      ];
    } else if (n === 2) {
      rows = [
        { type: TYPE_GUARDIAN, cols: 8 },
        { type: TYPE_GUARDIAN, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
      ];
    } else if (n <= 4) {
      rows = [
        { type: TYPE_BOSS, cols: 2 },
        { type: TYPE_GUARDIAN, cols: 8 },
        { type: TYPE_GUARDIAN, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
      ];
    } else if (n <= 8) {
      rows = [
        { type: TYPE_BOSS, cols: 4 },
        { type: TYPE_GUARDIAN, cols: 8 },
        { type: TYPE_GUARDIAN, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
      ];
    } else {
      rows = [
        { type: TYPE_BOSS, cols: 4 },
        { type: TYPE_GUARDIAN, cols: 10 },
        { type: TYPE_GUARDIAN, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
        { type: TYPE_DRONE, cols: 10 },
      ];
    }

    var diveSpeed = BASE_DIVE_SPEED * (1 + n * 0.08);
    var maxBullets = 2 + Math.floor((n - 1) / 3);
    if (maxBullets > 8) {
      maxBullets = 8;
    }
    var chance = 0.4 + n * 0.045;
    if (chance > 0.92) {
      chance = 0.92;
    }
    var divers = 1 + Math.floor(n / 2);
    if (divers > 5) {
      divers = 5;
    }
    var diveIv = Math.max(28, 120 - n * 6);
    var shotIv = Math.max(40, 105 - n * 5);

    return {
      rows: rows,
      diveSpeed: diveSpeed,
      maxEnemyBullets: maxBullets,
      diveChance: chance,
      maxDivers: divers,
      diveInterval: diveIv,
      enemyShotInterval: shotIv,
      dronePassFire: n >= 5,
    };
  }

  function spawnBurst(x, y, color, count) {
    var i;
    var n = count || 14;
    for (i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var sp = 0.6 + Math.random() * 1.6;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 16 + Math.floor(Math.random() * 12),
        color: color,
        s: 1 + Math.random() * 1.2,
      });
    }
  }

  function applyWaveConfig(cfg) {
    waveConfig = cfg;
    maxDivers = cfg.maxDivers;
    diveInterval = cfg.diveInterval;
    enemyShotInterval = cfg.enemyShotInterval;
    diveChance = cfg.diveChance;
    maxEnemyBullets = cfg.maxEnemyBullets;
    dronePassFire = cfg.dronePassFire;
  }

  function buildHomes(cfg) {
    var homes = [];
    var row;
    var col;
    var rows = cfg.rows;
    for (row = 0; row < rows.length; row++) {
      var cols = rows[row].cols;
      var type = rows[row].type;
      var size = enemySpriteSize(type);
      var gap = type === TYPE_BOSS ? 22 : type === TYPE_GUARDIAN ? 20 : 18;
      var totalW = cols * gap;
      var startX = (W - totalW) / 2 + gap / 2;
      for (col = 0; col < cols; col++) {
        homes.push({
          row: row,
          col: col,
          type: type,
          homeX: startX + col * gap,
          homeY: 28 + row * 18 + size.h / 2,
          w: size.w,
          h: size.h,
        });
      }
    }
    return homes;
  }

  function makeEnterPath(index, home) {
    var pattern = index % 3;
    var fromLeft = convoySide === 0;
    var sx;
    var sy;
    var c1x;
    var c1y;
    var c2x;
    var c2y;
    if (pattern === 0) {
      sx = fromLeft ? -40 : W + 40;
      sy = 20 + (index % 6) * 10;
      c1x = fromLeft ? W * 0.25 : W * 0.75;
      c1y = 70 + (index % 4) * 16;
      c2x = fromLeft ? W * 0.55 : W * 0.45;
      c2y = 120;
    } else if (pattern === 1) {
      sx = W * 0.5 + (fromLeft ? -20 : 20);
      sy = -30 - (index % 5) * 8;
      c1x = fromLeft ? W * 0.15 : W * 0.85;
      c1y = 90;
      c2x = fromLeft ? W * 0.7 : W * 0.3;
      c2y = 140;
    } else {
      sx = fromLeft ? -30 : W + 30;
      sy = H * 0.35;
      c1x = fromLeft ? W * 0.4 : W * 0.6;
      c1y = 50;
      c2x = W * 0.5;
      c2y = 110;
    }
    return {
      sx: sx,
      sy: sy,
      c1x: c1x,
      c1y: c1y,
      c2x: c2x,
      c2y: c2y,
      ex: home.homeX,
      ey: home.homeY,
      t: 0,
      dur: 78 + (index % 5) * 6,
    };
  }

  function bezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return (
      u * u * u * p0 +
      3 * u * u * t * p1 +
      3 * u * t * t * p2 +
      t * t * t * p3
    );
  }

  function makeEnemy(home, entering) {
    var e = {
      id: Math.random().toString(36).slice(2, 9),
      row: home.row,
      col: home.col,
      type: home.type,
      alive: true,
      hp: home.type === TYPE_BOSS ? 2 : 1,
      mode: entering ? MODE_ENTERING : MODE_FORMATION,
      homeX: home.homeX,
      homeY: home.homeY,
      x: home.homeX,
      y: home.homeY,
      w: home.w,
      h: home.h,
      diveT: 0,
      diveAmp: 2.5 + Math.random() * 2,
      diveSpeed: waveConfig ? waveConfig.diveSpeed : BASE_DIVE_SPEED,
      divePhase: Math.random() * Math.PI * 2,
      path: null,
      tractorT: 0,
      tractorActive: false,
      hasCapture: false,
      passFired: false,
      challengeGroup: 0,
      challengeT: 0,
      challengePath: null,
    };
    return e;
  }

  function initFormation() {
    enemies = [];
    enterQueue = [];
    enterTimer = 0;
    diveTimer = 40;
    enemyShotTimer = 0;
    formationReady = false;
    challengeHits = 0;
    challengeGroup = 0;
    challengeSpawnT = 0;
    capturedShip = null;
    isChallenge = isChallengeWave(level);
    applyWaveConfig(generateWave(level));
    convoySide = level % 2;

    if (isChallenge) {
      bannerText = "CHALLENGING STAGE";
      bannerTimer = 150;
      return;
    }

    var homes = buildHomes(waveConfig);
    var i;
    for (i = 0; i < homes.length; i++) {
      var e = makeEnemy(homes[i], true);
      e.path = makeEnterPath(i, homes[i]);
      e.x = e.path.sx;
      e.y = e.path.sy;
      enterQueue.push(e);
    }
    for (i = 0; i < Math.min(8, enterQueue.length); i++) {
      enemies.push(enterQueue.shift());
    }
  }

  function releaseEnterers() {
    if (!enterQueue.length) {
      return;
    }
    enterTimer++;
    if (enterTimer < 16) {
      return;
    }
    enterTimer = 0;
    var n = Math.min(5, enterQueue.length);
    var i;
    for (i = 0; i < n; i++) {
      enemies.push(enterQueue.shift());
    }
  }

  function checkFormationReady() {
    if (formationReady || isChallenge || enterQueue.length) {
      return;
    }
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive && enemies[i].mode === MODE_ENTERING) {
        return;
      }
    }
    formationReady = true;
  }

  function aliveCount() {
    var n = enterQueue.length;
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) {
        n++;
      }
    }
    return n;
  }

  function diversActive() {
    var n = 0;
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (
        e.alive &&
        (e.mode === MODE_DIVING || e.mode === MODE_RETURNING || e.mode === MODE_TRACTOR)
      ) {
        n++;
      }
    }
    return n;
  }

  function formationCandidates() {
    var list = [];
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive && enemies[i].mode === MODE_FORMATION) {
        list.push(enemies[i]);
      }
    }
    return list;
  }

  function spawnChallengeGroup(g) {
    var i;
    for (i = 0; i < 8; i++) {
      var type = g % 3;
      var size = enemySpriteSize(type);
      var side = g % 2;
      var e = {
        id: "c" + g + "_" + i,
        row: type,
        col: i,
        type: type,
        alive: true,
        hp: 1,
        mode: MODE_CHALLENGE,
        homeX: 0,
        homeY: 0,
        x: side ? W + 40 : -40,
        y: 100 + g * 20,
        w: size.w,
        h: size.h,
        diveT: 0,
        diveAmp: 0,
        diveSpeed: 0,
        divePhase: 0,
        path: null,
        tractorT: 0,
        tractorActive: false,
        hasCapture: false,
        challengeGroup: g,
        challengeT: -i * 8,
        challengePath: {
          side: side,
          amp: 70 + g * 12,
          baseY: 110 + (g % 3) * 90,
          speed: 2.1 + g * 0.15,
        },
      };
      enemies.push(e);
    }
  }

  function updateChallengeEnemy(e) {
    e.challengeT++;
    if (e.challengeT < 0) {
      return;
    }
    var p = e.challengePath;
    var t = e.challengeT;
    var dir = p.side ? -1 : 1;
    e.x = (p.side ? W + 40 : -40) + dir * t * p.speed;
    e.y = p.baseY + Math.sin(t * 0.08 + e.col) * p.amp;
    if ((p.side && e.x < -60) || (!p.side && e.x > W + 60) || t > 420) {
      e.alive = false;
    }
  }

  function tryStartDive() {
    if (isChallenge || !formationReady || enterQueue.length) {
      return;
    }
    if (diversActive() >= maxDivers) {
      return;
    }
    if (Math.random() > diveChance) {
      return;
    }
    var candidates = formationCandidates();
    if (!candidates.length) {
      return;
    }
    var groupSize = 1;
    if (level >= 4 && Math.random() < 0.35) {
      groupSize = 2;
    }
    if (level >= 8 && Math.random() < 0.25) {
      groupSize = 3;
    }
    var picked = [];
    var safety = 0;
    while (picked.length < groupSize && candidates.length && safety < 20) {
      safety++;
      var idx = Math.floor(Math.random() * candidates.length);
      var c = candidates.splice(idx, 1)[0];
      picked.push(c);
    }
    var baseSp = waveConfig ? waveConfig.diveSpeed : BASE_DIVE_SPEED;
    var i;
    for (i = 0; i < picked.length; i++) {
      var e = picked[i];
      e.mode = MODE_DIVING;
      e.diveT = 0;
      e.diveSpeed = baseSp + Math.random() * 0.7;
      e.diveAmp = 2.2 + Math.random() * 2.4;
      e.divePhase = Math.random() * Math.PI * 2;
      e.tractorActive = false;
      e.tractorT = 0;
      e.passFired = false;
      if (
        e.type === TYPE_BOSS &&
        !e.hasCapture &&
        !capturedShip &&
        !dualFighter &&
        Math.random() < 0.35
      ) {
        e.mode = MODE_TRACTOR;
      }
    }
  }

  function fireEnemyBullet(s) {
    if (enemyBullets.length >= maxEnemyBullets) {
      return;
    }
    enemyBullets.push({
      x: s.x - 1,
      y: s.y + s.h / 2,
      w: 2,
      h: 5,
      vy: 1.5 + level * 0.08,
    });
  }

  function tryEnemyShot() {
    if (isChallenge) {
      return;
    }
    if (enemyBullets.length >= maxEnemyBullets) {
      return;
    }
    var shooters = [];
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      if (e.mode === MODE_DIVING || e.mode === MODE_TRACTOR) {
        shooters.push(e);
      } else if (e.mode === MODE_FORMATION && Math.random() < 0.12) {
        shooters.push(e);
      }
    }
    if (!shooters.length) {
      return;
    }
    fireEnemyBullet(shooters[Math.floor(Math.random() * shooters.length)]);
  }

  function updateEntering(e) {
    var p = e.path;
    p.t++;
    var t = p.t / p.dur;
    if (t >= 1) {
      e.x = e.homeX;
      e.y = e.homeY;
      e.mode = MODE_FORMATION;
      e.path = null;
      return;
    }
    e.x = bezier(p.sx, p.c1x, p.c2x, p.ex, t);
    e.y = bezier(p.sy, p.c1y, p.c2y, p.ey, t);
  }

  function updateTractor(e) {
    e.diveT++;
    if (!e.tractorActive) {
      e.y += e.diveSpeed * 0.85;
      e.x = e.homeX + Math.sin(e.diveT / 8 + e.divePhase) * 14;
      if (e.y >= H * 0.42) {
        e.tractorActive = true;
        e.tractorT = 0;
        e.y = H * 0.42;
      }
      return;
    }
    e.tractorT++;
    e.x = e.homeX + Math.sin(animFrame / 10) * 4;
    e.y = H * 0.42 + Math.sin(animFrame / 14) * 2;
    if (e.tractorT > 160) {
      e.mode = MODE_DIVING;
      e.tractorActive = false;
      e.diveT = 0;
    }
  }

  function updateDiving(e) {
    e.diveT++;
    e.y += e.diveSpeed;
    e.x =
      e.homeX +
      Math.sin(e.diveT / 6.5 + e.divePhase) * (12 + e.diveAmp * 4) +
      Math.sin(e.diveT / 18) * 5;
    if (
      dronePassFire &&
      e.type === TYPE_DRONE &&
      !e.passFired &&
      Math.abs(e.y - player.y) < 10
    ) {
      e.passFired = true;
      fireEnemyBullet(e);
    }
    if (e.y > H + 40) {
      if (e.hasCapture && capturedShip && capturedShip.bossId === e.id) {
        destroyCapturedShip(false);
      }
      e.mode = MODE_RETURNING;
      e.diveT = 0;
      e.y = -30;
      e.x = e.homeX;
      e.tractorActive = false;
      e.passFired = false;
    }
  }

  function updateReturning(e) {
    var dy = e.homeY - e.y;
    var dx = e.homeX + formationBob - e.x;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < e.diveSpeed * 1.5) {
      e.x = e.homeX;
      e.y = e.homeY;
      e.mode = MODE_FORMATION;
    } else {
      e.x += (dx / dist) * e.diveSpeed;
      e.y += (dy / dist) * e.diveSpeed;
    }
  }

  function updateCapturedShip() {
    if (!capturedShip) {
      return;
    }
    if (capturedShip.state === "falling") {
      capturedShip.fallT++;
      capturedShip.y += 4.5;
      capturedShip.x += (player.x + player.w / 2 - capturedShip.x) * 0.05;
      if (capturedShip.y >= player.y - 8) {
        dualFighter = true;
        capturedShip = null;
        bannerText = "DUAL FIGHTER!";
        bannerTimer = 90;
        bonusFlashText = "DUAL FIGHTER ASSEMBLED";
        bonusFlashTimer = 120;
        spawnBurst(player.x + player.w / 2, player.y, "#fff", 20);
      }
      return;
    }
    var boss = findEnemyById(capturedShip.bossId);
    if (!boss || !boss.alive) {
      destroyCapturedShip(false);
      return;
    }
    capturedShip.x = boss.x;
    capturedShip.y = boss.y + boss.h * 0.9;
  }

  function findEnemyById(id) {
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].id === id) {
        return enemies[i];
      }
    }
    return null;
  }

  function startCapture(boss) {
    if (capturedShip || dualFighter) {
      return;
    }
    // Kidnap: ship turns enemy-red and orbits the boss — not a collision death
    capturedShip = {
      bossId: boss.id,
      x: player.x + player.w / 2,
      y: player.y,
      state: "orbit",
      fallT: 0,
      w: 32,
      h: 32,
    };
    boss.hasCapture = true;
    boss.tractorActive = false;
    boss.mode = MODE_DIVING;
    boss.diveT = 0;
    lives--;
    dualFighter = false;
    playerBullets = [];
    updateHud();
    spawnBurst(player.x + player.w / 2, player.y, "#66ffcc", 18);
    bannerText = "FIGHTER CAPTURED!";
    bannerTimer = 110;
    if (lives <= 0) {
      gameOver();
      return;
    }
    player.x = W / 2 - player.w / 2;
    playerInvuln = RESPAWN_FRAMES + 30;
  }

  function releaseCapture(boss) {
    if (!capturedShip || capturedShip.bossId !== boss.id) {
      return;
    }
    if (capturedShip.state !== "orbit") {
      return;
    }
    boss.hasCapture = false;
    capturedShip.state = "falling";
    capturedShip.fallT = 0;
    capturedShip.x = boss.x;
    capturedShip.y = boss.y + boss.h * 0.9;
    score += 1000;
    updateHud();
  }

  function destroyCapturedShip(byFriendlyFire) {
    if (!capturedShip) {
      return;
    }
    var boss = findEnemyById(capturedShip.bossId);
    if (boss) {
      boss.hasCapture = false;
    }
    spawnBurst(capturedShip.x, capturedShip.y, "#f44", 16);
    capturedShip = null;
    if (byFriendlyFire) {
      bonusFlashText = "CAPTURED FIGHTER DESTROYED!";
      bonusFlashTimer = 130;
    }
  }

  function updateEnemies() {
    formationBob = formationReady ? Math.sin(animFrame / 38) * 6 : 0;
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) {
        continue;
      }
      if (e.mode === MODE_ENTERING) {
        updateEntering(e);
      } else if (e.mode === MODE_FORMATION) {
        e.x = e.homeX + formationBob;
        e.y = e.homeY;
      } else if (e.mode === MODE_TRACTOR) {
        updateTractor(e);
      } else if (e.mode === MODE_DIVING) {
        updateDiving(e);
      } else if (e.mode === MODE_RETURNING) {
        updateReturning(e);
      } else if (e.mode === MODE_CHALLENGE) {
        updateChallengeEnemy(e);
      }
    }
    updateCapturedShip();
  }

  function checkTractorHit() {
    if (playerInvuln > 0 || dualFighter || capturedShip) {
      return;
    }
    var i;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive || e.mode !== MODE_TRACTOR || !e.tractorActive) {
        continue;
      }
      var px = player.x + player.w / 2;
      var py = player.y + player.h / 2;
      var inBeamX = Math.abs(px - e.x) < 18;
      var inBeamY = py > e.y + e.h * 0.3 && py < H - 10;
      if (inBeamX && inBeamY) {
        startCapture(e);
        return;
      }
    }
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function maxShots() {
    return dualFighter ? MAX_SHOTS_DUAL : MAX_SHOTS;
  }

  function fire() {
    if (phase !== PHASE_PLAYING || !running) {
      return;
    }
    if (frame - lastShot < SHOT_COOLDOWN) {
      return;
    }
    if (playerBullets.length >= maxShots()) {
      return;
    }
    lastShot = frame;
    var cx = player.x + player.w / 2;
    if (dualFighter) {
      playerBullets.push({
        x: cx - 10,
        y: player.y - 4,
        w: 2,
        h: 6,
        vy: -5,
        side: "L",
      });
      playerBullets.push({
        x: cx + 8,
        y: player.y - 4,
        w: 2,
        h: 6,
        vy: -5,
        side: "R",
      });
      shotsFired += 2;
    } else {
      playerBullets.push({
        x: cx - 1,
        y: player.y - 5,
        w: 2,
        h: 6,
        vy: -5,
        side: "C",
      });
      shotsFired += 1;
    }
  }

  function checkLifeBonuses() {
    var i;
    for (i = lifeBonusesClaimed; i < LIFE_BONUS_SCORES.length; i++) {
      if (score < LIFE_BONUS_SCORES[i]) {
        return;
      }
      lives++;
      lifeBonusesClaimed = i + 1;
      bonusFlashText = "EXTRA LIFE!";
      bonusFlashTimer = 140;
      updateHud();
    }
  }

  function updateHud() {
    var dual = dualFighter ? "  DUAL" : "";
    var line =
      "SCORE " +
      score +
      "   HIGH " +
      highScore +
      "   WAVE " +
      level +
      (isChallenge ? " CHALLENGE" : "") +
      "   LIVES " +
      lives +
      dual;
    if (bonusFlashTimer > 0) {
      line += "   |   " + bonusFlashText;
    }
    hud.textContent = line;
  }

  function syncHighScoreFromData(data) {
    var best = 0;
    if (data && data.personalScore) {
      best = data.personalScore;
    }
    if (data && data.entries && data.entries.length) {
      if (data.entries[0].score > best) {
        best = data.entries[0].score;
      }
    }
    if (score > best) {
      best = score;
    }
    if (best > highScore) {
      highScore = best;
    }
  }

  function clearContinueTimer() {
    if (continueTimerId !== null) {
      clearInterval(continueTimerId);
      continueTimerId = null;
    }
  }

  function resetDeathContinue() {
    clearContinueTimer();
    continueDeadline = 0;
  }

  function tickDeathTimer() {
    if (phase !== PHASE_DIED) {
      resetDeathContinue();
      return;
    }
    var leftMs = continueDeadline - Date.now();
    if (leftMs <= 0) {
      resetDeathContinue();
      endHintEl.textContent = "Time's up!";
      gameOver();
      return;
    }
    var leftSec = Math.ceil(leftMs / 1000);
    endHintEl.textContent =
      "Continue within " + leftSec + " second" + (leftSec === 1 ? "" : "s") + "…";
  }

  function setOverlayButtons(showStart, showNext) {
    btnStart.classList.toggle("hidden", !showStart);
    btnNext.classList.toggle("hidden", !showNext);
  }

  function setQuitVisible(visible) {
    btnQuit.classList.toggle("hidden", !visible);
  }

  function setStartScreenExtras(visible) {
    startScoresEl.classList.toggle("hidden", !visible);
    btnLeaderboard.classList.toggle("hidden", !visible);
    if (!visible) {
      closeLeaderboardModal();
    }
  }

  function showDeathContinue() {
    phase = PHASE_DIED;
    running = false;
    playerBullets = [];
    enemyBullets = [];
    player.x = W / 2 - player.w / 2;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "FIGHTER DOWN!";
    instructionsEl.textContent =
      lives +
      (lives === 1 ? " life" : " lives") +
      " remaining — Wave " +
      level +
      " · Score " +
      score;
    btnStart.textContent = "CONTINUE";
    btnStart.disabled = false;
    setOverlayButtons(true, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
    clearContinueTimer();
    continueDeadline = Date.now() + CONTINUE_TIMEOUT_MS;
    tickDeathTimer();
    continueTimerId = setInterval(tickDeathTimer, 250);
  }

  function continueAfterDeath() {
    if (phase !== PHASE_DIED) {
      return;
    }
    resetDeathContinue();
    playerInvuln = RESPAWN_FRAMES;
    beginReadyCountdown("GET READY!", "Wave " + level + " continues!");
    readyTimer = RESPAWN_FRAMES;
  }

  function loseLife(side) {
    if (playerInvuln > 0 || phase !== PHASE_PLAYING) {
      return;
    }
    if (dualFighter) {
      dualFighter = false;
      playerInvuln = 50;
      spawnBurst(
        player.x + (side === "R" ? player.w * 0.75 : player.w * 0.25),
        player.y,
        "#6cf",
        16
      );
      bonusFlashText = "DUAL FIGHTER DAMAGED!";
      bonusFlashTimer = 90;
      updateHud();
      return;
    }
    running = false;
    lives--;
    spawnBurst(player.x + player.w / 2, player.y, "#fff", 22);
    updateHud();
    if (lives <= 0) {
      gameOver();
      return;
    }
    showDeathContinue();
  }

  function playerHitboxes() {
    if (dualFighter) {
      return [
        { x: player.x - 8, y: player.y + 2, w: 14, h: player.h - 3, side: "L" },
        { x: player.x + player.w - 6, y: player.y + 2, w: 14, h: player.h - 3, side: "R" },
      ];
    }
    return [{ x: player.x + 2, y: player.y + 2, w: player.w - 4, h: player.h - 3, side: "C" }];
  }

  function checkPlayerHit() {
    if (playerInvuln > 0 || isChallenge || capturedShip) {
      return;
    }
    var boxes = playerHitboxes();
    var bi;
    var i;
    for (bi = 0; bi < boxes.length; bi++) {
      var hit = boxes[bi];
      for (i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.alive) {
          continue;
        }
        // Tractor bosses kidnap via checkTractorHit — never treat as lethal contact
        if (
          e.mode === MODE_ENTERING ||
          e.mode === MODE_FORMATION ||
          e.mode === MODE_TRACTOR
        ) {
          continue;
        }
        var box = { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h };
        if (rectsOverlap(hit, box)) {
          loseLife(hit.side);
          return;
        }
      }
      for (i = 0; i < enemyBullets.length; i++) {
        if (rectsOverlap(hit, enemyBullets[i])) {
          enemyBullets.splice(i, 1);
          loseLife(hit.side);
          return;
        }
      }
    }
  }

  function damageEnemy(e, diving) {
    if (e.type === TYPE_BOSS && e.hp > 1) {
      e.hp = 1;
      spawnBurst(e.x, e.y, "#8cf", 8);
      shotsHit++;
      return false;
    }
    e.alive = false;
    spawnBurst(e.x, e.y, enemyBurstColor(e), 16);
    shotsHit++;
    var pts;
    if (isChallenge) {
      pts = 100 + e.type * 50;
      challengeHits++;
    } else if (diving) {
      pts = PTS_DIVE_BY_TYPE[e.type] || 100;
    } else {
      pts = PTS_FORM_BY_TYPE[e.type] || 50;
    }
    if (e.hasCapture) {
      releaseCapture(e);
      pts += 1000;
    }
    score += pts;
    if (score > highScore) {
      highScore = score;
    }
    checkLifeBonuses();
    updateHud();
    return true;
  }

  function showMenuOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "ALIEN INFESTATION";
    instructionsEl.style.whiteSpace = "";
    instructionsEl.textContent =
      "Arrow keys / A·D move · Space or left-click fire. Click the screen once so the HUD can take keyboard focus.";
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
    instructionsEl.textContent = hintText || "Convoy inbound…";
    endHintEl.textContent = "";
    setOverlayButtons(false, false);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function showLevelComplete() {
    phase = PHASE_LEVEL;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "WAVE " + level + " CLEARED!";
    instructionsEl.textContent = "Score: " + score + " — infestation intensifies.";
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT WAVE";
    setOverlayButtons(false, true);
    setStartScreenExtras(false);
    setQuitVisible(true);
  }

  function showChallengeComplete() {
    phase = PHASE_CHALLENGE_END;
    running = false;
    var perfect = challengeHits >= challengeTotal;
    challengeBonus = perfect ? 10000 : challengeHits * 100;
    score += challengeBonus;
    if (score > highScore) {
      highScore = score;
    }
    checkLifeBonuses();
    updateHud();
    overlay.classList.remove("hidden");
    overlayTitle.textContent = perfect ? "PERFECT!" : "CHALLENGING STAGE CLEAR";
    instructionsEl.textContent =
      "Hits " + challengeHits + "/" + challengeTotal + " — Bonus +" + challengeBonus;
    endHintEl.textContent = "";
    btnNext.textContent = "NEXT WAVE";
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
    syncHighScoreFromData(data);
    updateHud();
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

  function hitRatioPct() {
    if (shotsFired <= 0) {
      return 0;
    }
    return Math.floor((shotsHit / shotsFired) * 1000) / 10;
  }

  function updatePlaying() {
    frame++;
    animFrame++;

    if (playerInvuln > 0) {
      playerInvuln--;
    }
    if (bonusFlashTimer > 0) {
      bonusFlashTimer--;
    }
    if (bannerTimer > 0) {
      bannerTimer--;
    }

    if (keys.ArrowLeft || keys.left || keys.a || keys.A) {
      player.x -= player.speed;
    }
    if (keys.ArrowRight || keys.right || keys.d || keys.D) {
      player.x += player.speed;
    }
    var minX = dualFighter ? 10 : 4;
    var maxX = dualFighter ? W - player.w - 10 : W - player.w - 4;
    if (player.x < minX) {
      player.x = minX;
    }
    if (player.x > maxX) {
      player.x = maxX;
    }
    if (keys[" "] || keys.Spacebar || keys.Space || keys.shoot || mouseFire) {
      fire();
    }

    if (isChallenge) {
      challengeSpawnT++;
      if (challengeGroup < 5 && challengeSpawnT > 70 + challengeGroup * 90) {
        spawnChallengeGroup(challengeGroup);
        challengeGroup++;
      }
    } else {
      releaseEnterers();
      checkFormationReady();
      if (formationReady) {
        diveTimer++;
        if (diveTimer >= diveInterval) {
          diveTimer = 0;
          tryStartDive();
        }
        enemyShotTimer++;
        if (enemyShotTimer >= enemyShotInterval) {
          enemyShotTimer = 0;
          tryEnemyShot();
        }
      }
    }

    updateEnemies();
    if (phase !== PHASE_PLAYING) {
      return;
    }

    checkTractorHit();
    if (phase !== PHASE_PLAYING) {
      return;
    }

    var i;
    for (i = playerBullets.length - 1; i >= 0; i--) {
      playerBullets[i].y += playerBullets[i].vy;
      if (playerBullets[i].y < -20) {
        playerBullets.splice(i, 1);
      }
    }
    for (i = enemyBullets.length - 1; i >= 0; i--) {
      enemyBullets[i].y += enemyBullets[i].vy;
      if (enemyBullets[i].y > H + 20) {
        enemyBullets.splice(i, 1);
      }
    }
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // Friendly-fire on captured fighter
    if (capturedShip && capturedShip.state === "orbit") {
      for (i = playerBullets.length - 1; i >= 0; i--) {
        var bCap = playerBullets[i];
        var capBox = {
          x: capturedShip.x - 8,
          y: capturedShip.y - 8,
          w: 16,
          h: 16,
        };
        if (rectsOverlap(bCap, capBox)) {
          playerBullets.splice(i, 1);
          destroyCapturedShip(true);
          break;
        }
      }
    }
    if (capturedShip && capturedShip.state === "falling") {
      for (i = playerBullets.length - 1; i >= 0; i--) {
        var bFall = playerBullets[i];
        var fallBox = {
          x: capturedShip.x - 8,
          y: capturedShip.y - 8,
          w: 16,
          h: 16,
        };
        if (rectsOverlap(bFall, fallBox)) {
          playerBullets.splice(i, 1);
          destroyCapturedShip(true);
          break;
        }
      }
    }

    for (i = playerBullets.length - 1; i >= 0; i--) {
      var b = playerBullets[i];
      var j;
      for (j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (!e.alive) {
          continue;
        }
        var box = { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h };
        if (rectsOverlap(b, box)) {
          var diving =
            e.mode === MODE_DIVING ||
            e.mode === MODE_RETURNING ||
            e.mode === MODE_TRACTOR;
          damageEnemy(e, diving);
          playerBullets.splice(i, 1);
          j = enemies.length;
        }
      }
    }

    checkPlayerHit();
    if (phase !== PHASE_PLAYING) {
      return;
    }

    if (isChallenge) {
      if (challengeGroup >= 5 && aliveCount() === 0) {
        showChallengeComplete();
      }
    } else if (aliveCount() === 0) {
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
      grabMediaFocus();
      if (isChallenge) {
        bannerText = "CHALLENGING STAGE";
        bannerTimer = 120;
      }
    } else if (readyTimer <= 55) {
      overlayTitle.textContent = "GO!";
    }
  }

  function update() {
    var si;
    for (si = 0; si < stars.length; si++) {
      stars[si].y += stars[si].v;
      if (stars[si].y > H) {
        stars[si].y = 0;
        stars[si].x = Math.random() * W;
      }
    }
    if (phase === PHASE_PLAYING && running) {
      updatePlaying();
    } else if (phase === PHASE_READY) {
      updateReady();
    }
  }

  function drawStarfield() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    var i;
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.fillStyle = "rgba(200,220,255," + s.a + ")";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }

  function drawPlayerShip() {
    if (playerInvuln > 0 && Math.floor(playerInvuln / 5) % 2 === 0) {
      return;
    }
    var cx = player.x + player.w / 2;
    var cy = player.y + player.h / 2;
    if (dualFighter) {
      drawMatrixCentered(PLAYER_SHIP, cx - 10, cy, SPRITE_PX, SPRITE_PALETTE);
      drawMatrixCentered(PLAYER_SHIP, cx + 10, cy, SPRITE_PX, SPRITE_PALETTE);
    } else {
      drawMatrixCentered(PLAYER_SHIP, cx, cy, SPRITE_PX, SPRITE_PALETTE);
    }
  }

  function drawEnemy(e) {
    var frames = ENEMY_SETS[e.type];
    var fi = Math.floor(animFrame / 18) % frames.length;
    var matrix = frames[fi];
    drawMatrixCentered(matrix, e.x, e.y, SPRITE_PX, enemyPalette(e));

    if (e.mode === MODE_TRACTOR && e.tractorActive) {
      var beamH = H - e.y - 20;
      var spin = animFrame * 0.25;
      var k;
      ctx.save();
      for (k = 0; k < 8; k++) {
        var a = spin + (k * Math.PI) / 4;
        var ox = Math.cos(a) * 8;
        ctx.strokeStyle = "rgba(80,255,210," + (0.3 + (k % 2) * 0.25) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x + ox * 0.4, e.y + e.h / 2);
        ctx.lineTo(e.x + ox, e.y + beamH);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(60,255,200,0.12)";
      ctx.fillRect(e.x - 18, e.y + e.h / 2, 36, beamH);
      ctx.restore();
    }
  }

  function drawCaptured() {
    if (!capturedShip) {
      return;
    }
    drawMatrixCentered(
      PLAYER_SHIP,
      capturedShip.x,
      capturedShip.y,
      SPRITE_PX,
      CAPTURED_PALETTE
    );
  }

  function drawParticles() {
    var i;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life / 20);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawBanner() {
    if (bannerTimer <= 0 || !bannerText) {
      return;
    }
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(W * 0.1, H * 0.38, W * 0.8, 22);
    ctx.strokeStyle = "#7cf5ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(W * 0.1, H * 0.38, W * 0.8, 22);
    ctx.fillStyle = "#ffe066";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(bannerText, W / 2, H * 0.38 + 15);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawCrtOverlay() {
    var y;
    ctx.save();
    ctx.fillStyle = "rgba(24, 82, 165, 0.035)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    for (y = 0; y < H; y += 2) {
      ctx.fillRect(0, y, W, 1);
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.restore();
  }

  function draw() {
    resizeCanvas();
    drawStarfield();
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].alive) {
        drawEnemy(enemies[i]);
      }
    }
    drawCaptured();
    if (phase !== PHASE_MENU && phase !== PHASE_OVER && phase !== PHASE_DIED) {
      drawPlayerShip();
    }
    ctx.fillStyle = "#f4f7ff";
    for (i = 0; i < playerBullets.length; i++) {
      var pb = playerBullets[i];
      ctx.fillRect(pb.x, pb.y, pb.w, pb.h);
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(pb.x, pb.y, 1, 2);
      ctx.fillStyle = "#f4f7ff";
    }
    ctx.fillStyle = "#de2121";
    for (i = 0; i < enemyBullets.length; i++) {
      var eb = enemyBullets[i];
      ctx.fillRect(eb.x, eb.y, eb.w, eb.h);
    }
    drawParticles();
    drawBanner();
    if (phase === PHASE_READY && readyTimer > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, W, H);
    }
    drawCrtOverlay();
  }

  function loop() {
    try {
      update();
      draw();
    } catch (err) {
      console.error("Alien Infestation loop error:", err);
    }
    requestAnimationFrame(loop);
  }

  function enablePlayAgain(hint) {
    btnStart.textContent = "PLAY AGAIN";
    btnStart.disabled = false;
    endHintEl.textContent = hint || "Tap PLAY AGAIN for another run.";
  }

  function gameOver() {
    resetDeathContinue();
    phase = PHASE_OVER;
    running = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "GAME OVER";
    var ratio = hitRatioPct();
    instructionsEl.textContent =
      "Final score: " +
      score +
      " — Wave " +
      level +
      "\n\nSHOTS FIRED: " +
      shotsFired +
      "\nNUMBER OF HITS: " +
      shotsHit +
      "\nHIT-MISS RATIO: " +
      ratio +
      "%";
    instructionsEl.style.whiteSpace = "pre-line";
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

  function startLevelAfterReady(title, hint) {
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    player.x = W / 2 - player.w / 2;
    updateHud();
    beginReadyCountdown(title, hint);
  }

  function startGame() {
    if (btnStart.disabled) {
      return;
    }
    if (phase === PHASE_DIED) {
      continueAfterDeath();
      return;
    }
    resetDeathContinue();
    score = 0;
    lives = STARTING_LIVES;
    level = 1;
    frame = 0;
    animFrame = 0;
    playerInvuln = 0;
    lifeBonusesClaimed = 0;
    bonusFlashTimer = 0;
    bonusFlashText = "";
    dualFighter = false;
    capturedShip = null;
    shotsFired = 0;
    shotsHit = 0;
    instructionsEl.style.whiteSpace = "";
    showMessages([]);
    unavailableEl.classList.add("hidden");
    endHintEl.textContent = "";
    initFormation();
    startLevelAfterReady(
      "GET READY!",
      isChallenge
        ? "Challenging Stage — destroy the swarms!"
        : "Wave 1 — alien convoy inbound!"
    );
  }

  function nextLevel() {
    level++;
    initFormation();
    var title = isChallenge ? "CHALLENGING STAGE" : "GET READY!";
    var hint = isChallenge
      ? "No enemy fire — score a Perfect for 10,000!"
      : "Wave " + level + " — faster dives, denser fire!";
    startLevelAfterReady(title, hint);
  }

  function quitGame() {
    if (phase === PHASE_MENU || phase === PHASE_OVER) {
      return;
    }
    resetDeathContinue();
    phase = PHASE_MENU;
    running = false;
    playerBullets = [];
    enemyBullets = [];
    instructionsEl.style.whiteSpace = "";
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

  // SL CEF often mis-routes keyboard: prefer e.code, bind window+document, force focus on click.
  var lastDownStamp = -1;
  var lastDownId = "";
  var lastUpStamp = -1;
  var lastUpId = "";

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
    if (
      code === "ArrowUp" ||
      key === "ArrowUp" ||
      key === "Up" ||
      kc === 38
    ) {
      keys.ArrowUp = isDown;
    }
    if (
      code === "ArrowDown" ||
      key === "ArrowDown" ||
      key === "Down" ||
      kc === 40
    ) {
      keys.ArrowDown = isDown;
    }
    if (code === "Space" || key === " " || key === "Spacebar" || kc === 32) {
      keys[" "] = isDown;
      keys.Spacebar = isDown;
      keys.Space = isDown;
      keys.shoot = isDown;
    }
    if (code === "KeyA" || key === "a" || key === "A" || kc === 65) {
      keys.a = isDown;
      keys.A = isDown;
    }
    if (code === "KeyD" || key === "d" || key === "D" || kc === 68) {
      keys.d = isDown;
      keys.D = isDown;
    }
    if (code === "Escape" || key === "Escape" || kc === 27) {
      keys.Escape = isDown;
    }
    if (code === "Enter" || key === "Enter" || kc === 13) {
      keys.Enter = isDown;
    }
  }

  function isGameNavCode(e) {
    var code = e.code || "";
    if (
      code === "Space" ||
      code === "ArrowUp" ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight"
    ) {
      return true;
    }
    var kc = e.keyCode || e.which || 0;
    return kc === 32 || kc === 37 || kc === 38 || kc === 39 || kc === 40;
  }

  function handleKeyDown(e) {
    var id = e.code || e.key || String(e.keyCode || e.which || "");
    if (e.timeStamp === lastDownStamp && id === lastDownId) {
      return;
    }
    lastDownStamp = e.timeStamp;
    lastDownId = id;

    if (isGameNavCode(e)) {
      e.preventDefault();
    }

    setKeyFromEvent(e, true);

    if (keys.shoot || keys[" "] || keys.Space) {
      if (phase === PHASE_PLAYING && running) {
        fire();
      }
    }
    if (keys.Escape && phase !== PHASE_MENU && phase !== PHASE_OVER) {
      quitGame();
    }
    if (
      (keys.Enter || keys.shoot || keys[" "]) &&
      phase === PHASE_DIED &&
      !btnStart.disabled
    ) {
      e.preventDefault();
      continueAfterDeath();
    }
  }

  function handleKeyUp(e) {
    var id = e.code || e.key || String(e.keyCode || e.which || "");
    if (e.timeStamp === lastUpStamp && id === lastUpId) {
      return;
    }
    lastUpStamp = e.timeStamp;
    lastUpId = id;
    setKeyFromEvent(e, false);
  }

  window.addEventListener("click", grabMediaFocus);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  window.addEventListener("mousedown", function (e) {
    grabMediaFocus();
    if (e.button !== 0) {
      return;
    }
    if (overlay && !overlay.classList.contains("hidden")) {
      return;
    }
    if (leaderboardModal && !leaderboardModal.classList.contains("hidden")) {
      return;
    }
    mouseFire = true;
    if (phase === PHASE_PLAYING && running) {
      fire();
    }
  });
  window.addEventListener("mouseup", function (e) {
    if (e.button === 0) {
      mouseFire = false;
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
  updateHud();
  if (SLArcade.isPendingMoapSave()) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SAVING SCORE";
    instructionsEl.textContent = "Writing your score to the leaderboard…";
    btnStart.disabled = true;
  } else {
    showMenuOverlay();
  }
  requestAnimationFrame(loop);
})();
