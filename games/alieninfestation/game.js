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
  var TYPE_SATELLITE = 3;
  var TYPE_SCORPION = 4;

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
  var challengeStageIndex = 0;
  var challengeStageDef = null;
  var challengeGroupAlive = 0;
  var challengeGroupHits = 0;
  var challengeGroupBonusEarned = 0;
  var pendingCaptureAttach = false;

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

  var SATELLITE_FRAMES = [
    [
      [0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 4, 1, 1, 1, 1, 4, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 4, 1, 1, 3, 3, 1, 1, 4, 0, 0, 0, 0],
      [0, 0, 0, 4, 1, 1, 3, 3, 3, 3, 1, 1, 4, 0, 0, 0],
      [0, 0, 4, 1, 1, 3, 3, 1, 1, 3, 3, 1, 1, 4, 0, 0],
      [0, 4, 1, 1, 3, 3, 1, 1, 1, 1, 3, 3, 1, 1, 4, 0],
      [4, 1, 1, 3, 3, 1, 1, 4, 4, 1, 1, 3, 3, 1, 1, 4],
      [4, 1, 3, 3, 1, 1, 4, 4, 4, 4, 1, 1, 3, 3, 1, 4],
      [4, 1, 3, 3, 1, 1, 4, 4, 4, 4, 1, 1, 3, 3, 1, 4],
      [4, 1, 1, 3, 3, 1, 1, 4, 4, 1, 1, 3, 3, 1, 1, 4],
      [0, 4, 1, 1, 3, 3, 1, 1, 1, 1, 3, 3, 1, 1, 4, 0],
      [0, 0, 4, 1, 1, 3, 3, 1, 1, 3, 3, 1, 1, 4, 0, 0],
      [0, 0, 0, 4, 1, 1, 3, 3, 3, 3, 1, 1, 4, 0, 0, 0],
      [0, 0, 0, 0, 4, 1, 1, 3, 3, 1, 1, 4, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 4, 1, 1, 1, 1, 4, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 3, 1, 1, 1, 1, 3, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 3, 1, 1, 4, 4, 1, 1, 3, 0, 0, 0, 0],
      [0, 0, 0, 3, 1, 1, 4, 4, 4, 4, 1, 1, 3, 0, 0, 0],
      [0, 0, 3, 1, 1, 4, 4, 1, 1, 4, 4, 1, 1, 3, 0, 0],
      [0, 3, 1, 1, 4, 4, 1, 1, 1, 1, 4, 4, 1, 1, 3, 0],
      [3, 1, 1, 4, 4, 1, 1, 3, 3, 1, 1, 4, 4, 1, 1, 3],
      [3, 1, 4, 4, 1, 1, 3, 3, 3, 3, 1, 1, 4, 4, 1, 3],
      [3, 1, 4, 4, 1, 1, 3, 3, 3, 3, 1, 1, 4, 4, 1, 3],
      [3, 1, 1, 4, 4, 1, 1, 3, 3, 1, 1, 4, 4, 1, 1, 3],
      [0, 3, 1, 1, 4, 4, 1, 1, 1, 1, 4, 4, 1, 1, 3, 0],
      [0, 0, 3, 1, 1, 4, 4, 1, 1, 4, 4, 1, 1, 3, 0, 0],
      [0, 0, 0, 3, 1, 1, 4, 4, 4, 4, 1, 1, 3, 0, 0, 0],
      [0, 0, 0, 0, 3, 1, 1, 4, 4, 1, 1, 3, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 3, 1, 1, 1, 1, 3, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
    ],
  ];

  var SCORPION_FRAMES = [
    [
      [0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0],
      [0, 0, 0, 4, 4, 4, 0, 0, 0, 0, 4, 4, 4, 0, 0, 0],
      [0, 0, 4, 4, 2, 4, 4, 0, 0, 4, 4, 2, 4, 4, 0, 0],
      [0, 4, 4, 2, 2, 2, 4, 4, 4, 4, 2, 2, 2, 4, 4, 0],
      [4, 4, 2, 2, 1, 2, 2, 4, 4, 2, 2, 1, 2, 2, 4, 4],
      [4, 2, 2, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 2, 2, 4],
      [0, 4, 2, 2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 4, 0],
      [0, 0, 4, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 4, 0, 0],
      [0, 0, 0, 4, 4, 1, 1, 2, 2, 1, 1, 4, 4, 0, 0, 0],
      [0, 0, 0, 0, 2, 1, 2, 2, 2, 2, 1, 2, 0, 0, 0, 0],
      [0, 0, 0, 2, 2, 2, 0, 2, 2, 0, 2, 2, 2, 0, 0, 0],
      [0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0],
      [0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0],
      [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0],
      [0, 0, 4, 4, 4, 0, 0, 0, 0, 0, 0, 4, 4, 4, 0, 0],
      [0, 4, 4, 2, 4, 4, 0, 0, 0, 0, 4, 4, 2, 4, 4, 0],
      [4, 4, 2, 2, 2, 4, 4, 0, 0, 4, 4, 2, 2, 2, 4, 4],
      [4, 2, 2, 1, 2, 2, 4, 4, 4, 4, 2, 2, 1, 2, 2, 4],
      [0, 4, 2, 1, 1, 2, 2, 4, 4, 2, 2, 1, 1, 2, 4, 0],
      [0, 0, 4, 2, 1, 2, 1, 1, 1, 1, 2, 1, 2, 4, 0, 0],
      [0, 0, 0, 4, 2, 1, 1, 2, 2, 1, 1, 2, 4, 0, 0, 0],
      [0, 0, 0, 2, 4, 1, 2, 2, 2, 2, 1, 4, 2, 0, 0, 0],
      [0, 0, 2, 2, 2, 1, 0, 2, 2, 0, 1, 2, 2, 2, 0, 0],
      [0, 2, 2, 0, 0, 2, 0, 2, 2, 0, 2, 0, 0, 2, 2, 0],
      [2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 2],
      [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
  ];

  var ENEMY_SETS = [
    BOSS_FRAMES,
    GUARDIAN_FRAMES,
    DRONE_FRAMES,
    SATELLITE_FRAMES,
    SCORPION_FRAMES,
  ];

  var CHALLENGE_PALETTE_DRAGONFLY = {
    1: "#f4f7ff",
    2: "#21de73",
    3: "#147a3f",
    4: "#ffff66",
  };
  var CHALLENGE_PALETTE_MOSQUITO = {
    1: "#f4f7ff",
    2: "#de21c8",
    3: "#7a1470",
    4: "#ffcc66",
  };
  var CHALLENGE_PALETTE_ENTERPRISE = {
    1: "#dce6ff",
    2: "#6688cc",
    3: "#3344aa",
    4: "#ffffff",
  };

  // Eight rotating Challenging Stages (Galaga stages 3,7,11,..., then repeat)
  var CHALLENGE_STAGES = [
    {
      name: "BEES",
      groupBonus: 1000,
      mainType: TYPE_DRONE,
      palette: null,
      paths: ["sine_lr", "sine_lr", "sine_rl", "sine_lr", "arc_top"],
      bossGroup: 4,
    },
    {
      name: "BUTTERFLIES",
      groupBonus: 1000,
      mainType: TYPE_GUARDIAN,
      palette: null,
      paths: ["sine_rl", "loop_eight", "sine_rl", "loop_eight", "sine_lr"],
      bossGroup: 4,
    },
    {
      name: "DRAGONFLIES",
      groupBonus: 1500,
      mainType: TYPE_DRONE,
      palette: CHALLENGE_PALETTE_DRAGONFLY,
      paths: ["corkscrew", "corkscrew", "diagonal_x", "arc_top", "loop_eight"],
      bossGroup: 3,
    },
    {
      name: "MOSQUITOES",
      groupBonus: 1500,
      mainType: TYPE_GUARDIAN,
      palette: CHALLENGE_PALETTE_MOSQUITO,
      paths: ["diagonal_x", "sine_lr", "diagonal_x", "corkscrew", "column_drop"],
      bossGroup: 3,
    },
    {
      name: "SATELLITES",
      groupBonus: 2000,
      mainType: TYPE_SATELLITE,
      palette: null,
      paths: ["circle_out", "circle_out", "sine_rl", "circle_out", "arc_top"],
      bossGroup: 4,
    },
    {
      name: "SCORPIONS",
      groupBonus: 2000,
      mainType: TYPE_SCORPION,
      palette: null,
      paths: ["column_drop", "corkscrew", "column_drop", "loop_eight", "diagonal_x"],
      bossGroup: 2,
    },
    {
      name: "GALBOSSES",
      groupBonus: 3000,
      mainType: TYPE_BOSS,
      palette: null,
      paths: ["loop_eight", "arc_top", "sine_lr", "circle_out", "loop_eight"],
      bossGroup: -1,
    },
    {
      name: "FLAGSHIPS",
      groupBonus: 3000,
      mainType: TYPE_BOSS,
      palette: CHALLENGE_PALETTE_ENTERPRISE,
      paths: ["arc_top", "diagonal_x", "circle_out", "corkscrew", "column_drop"],
      bossGroup: -1,
    },
  ];

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

  function getChallengeStageIndex(n) {
    return Math.floor((n - 3) / 4) % CHALLENGE_STAGES.length;
  }

  function enemyPalette(e) {
    if (e.challengePalette) {
      return e.challengePalette;
    }
    if (e.type === TYPE_BOSS) {
      if (e.hp >= 2) {
        return BOSS_PALETTE_OK;
      }
      return BOSS_PALETTE_HURT;
    }
    if (e.type === TYPE_SATELLITE) {
      return {
        1: "#f4f7ff",
        2: "#de2121",
        3: "#33aaff",
        4: "#ffff66",
      };
    }
    if (e.type === TYPE_SCORPION) {
      return {
        1: "#ffffaa",
        2: "#deaa21",
        3: "#1b4cd3",
        4: "#ff6600",
      };
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
    if (e.type === TYPE_SATELLITE) {
      return "#33aaff";
    }
    if (e.type === TYPE_SCORPION) {
      return "#ff6600";
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
    challengeGroupAlive = 0;
    challengeGroupHits = 0;
    challengeGroupBonusEarned = 0;

    // Keep a captured fighter across waves (classic Galaga) — reattach to a boss later
    if (
      capturedShip &&
      (capturedShip.state === "orbit" || capturedShip.state === "hostile")
    ) {
      pendingCaptureAttach = true;
      capturedShip = {
        bossId: null,
        x: W / 2,
        y: 40,
        state: "orbit",
        fallT: 0,
        w: 16,
        h: 16,
      };
    } else if (capturedShip && capturedShip.state === "lifting") {
      capturedShip = null;
      pendingCaptureAttach = false;
    } else if (!capturedShip) {
      pendingCaptureAttach = false;
    }

    isChallenge = isChallengeWave(level);
    challengeStageIndex = isChallenge ? getChallengeStageIndex(level) : 0;
    challengeStageDef = isChallenge ? CHALLENGE_STAGES[challengeStageIndex] : null;
    applyWaveConfig(generateWave(level));
    convoySide = level % 2;

    if (isChallenge) {
      bannerText = "CHALLENGING STAGE — " + challengeStageDef.name;
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
    tryAttachPendingCapture();
  }

  function tryAttachPendingCapture() {
    if (!pendingCaptureAttach || dualFighter) {
      return;
    }
    var i;
    var boss = null;
    for (i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.alive && e.type === TYPE_BOSS && !e.hasCapture) {
        boss = e;
        break;
      }
    }
    if (!boss) {
      for (i = 0; i < enterQueue.length; i++) {
        if (enterQueue[i].type === TYPE_BOSS && !enterQueue[i].hasCapture) {
          boss = enterQueue[i];
          break;
        }
      }
    }
    if (!boss) {
      return;
    }
    if (!capturedShip) {
      capturedShip = {
        bossId: boss.id,
        x: boss.x,
        y: boss.y + boss.h * 0.9,
        state: "orbit",
        fallT: 0,
        w: 16,
        h: 16,
      };
    } else {
      capturedShip.bossId = boss.id;
      capturedShip.state = "orbit";
    }
    boss.hasCapture = true;
    pendingCaptureAttach = false;
  }

  function releaseEnterers() {
    if (!enterQueue.length) {
      tryAttachPendingCapture();
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
    tryAttachPendingCapture();
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

  function challengePathPoint(pathId, t, col, side) {
    var done = false;
    var x = 0;
    var y = 0;
    var stagger = col * 10;
    var tt = t - stagger;
    if (tt < 0) {
      return { x: side ? W + 40 : -40, y: 80, done: false, waiting: true };
    }

    if (pathId === "sine_lr" || pathId === "sine_rl") {
      var goRight = pathId === "sine_lr";
      if (side) {
        goRight = !goRight;
      }
      var speed = 2.35;
      var dist = tt * speed;
      if (goRight) {
        x = -40 + dist;
        done = x > W + 50;
      } else {
        x = W + 40 - dist;
        done = x < -50;
      }
      y = 95 + (col % 4) * 28 + Math.sin(tt * 0.09 + col) * (55 + col * 2);
    } else if (pathId === "loop_eight") {
      var ang = tt * 0.055;
      var cx = W * 0.5 + (side ? 28 : -28);
      var cy = 120 + (col % 3) * 18;
      x = cx + Math.sin(ang) * (70 + col * 3);
      y = cy + Math.sin(ang * 2) * 48;
      done = tt > 280;
    } else if (pathId === "corkscrew") {
      var cdir = side ? -1 : 1;
      x = (side ? W + 30 : -30) + cdir * tt * 1.7;
      y = 70 + col * 16 + Math.sin(tt * 0.2) * 42 + Math.cos(tt * 0.1) * 12;
      done = (cdir > 0 && x > W + 50) || (cdir < 0 && x < -50) || tt > 360;
    } else if (pathId === "diagonal_x") {
      var fromLeft = col % 2 === 0;
      if (side) {
        fromLeft = !fromLeft;
      }
      if (fromLeft) {
        x = -30 + tt * 2.4;
        y = 40 + col * 8 + tt * 0.85;
      } else {
        x = W + 30 - tt * 2.4;
        y = 40 + col * 8 + tt * 0.85;
      }
      done = y > H + 30 || x < -60 || x > W + 60 || tt > 300;
    } else if (pathId === "circle_out") {
      var spin = tt * 0.07;
      var rad = 12 + tt * 0.55;
      x = W * 0.5 + Math.cos(spin + col * 0.8) * rad;
      y = 110 + Math.sin(spin + col * 0.8) * rad * 0.75;
      done = rad > 160 || tt > 320;
    } else if (pathId === "arc_top") {
      var u = tt / 220;
      if (u > 1) {
        u = 1;
        done = true;
      }
      var sx = side ? W + 20 : -20;
      var ex = side ? -20 : W + 20;
      x = sx + (ex - sx) * u;
      y = 30 + Math.sin(u * Math.PI) * (140 + col * 6);
    } else if (pathId === "column_drop") {
      var lane = 28 + (col % 8) * 24;
      if (side) {
        lane = W - lane;
      }
      if (tt < 90) {
        x = lane;
        y = -20 + tt * 2.2;
      } else {
        var t2 = tt - 90;
        x = lane + Math.sin(t2 * 0.12 + col) * 36;
        y = 180 + Math.sin(t2 * 0.08) * 20;
        if (t2 > 100) {
          x += (side ? 1 : -1) * (t2 - 100) * 2.5;
        }
        done = x < -50 || x > W + 50 || tt > 340;
      }
    } else {
      x = -40 + tt * 2.2;
      y = 120 + Math.sin(tt * 0.08) * 40;
      done = x > W + 50;
    }

    if (tt > 400) {
      done = true;
    }
    return { x: x, y: y, done: done, waiting: false };
  }

  function noteChallengeEnemyGone(wasHit) {
    if (!isChallenge) {
      return;
    }
    challengeGroupAlive--;
    if (wasHit) {
      challengeGroupHits++;
    }
    if (challengeGroupAlive <= 0 && challengeGroupHits >= 8 && challengeStageDef) {
      var bonus = challengeStageDef.groupBonus;
      score += bonus;
      challengeGroupBonusEarned += bonus;
      if (score > highScore) {
        highScore = score;
      }
      checkLifeBonuses();
      updateHud();
      bannerText = "GROUP BONUS +" + bonus;
      bannerTimer = 90;
      challengeGroupHits = 0;
    }
  }

  function spawnChallengeGroup(g) {
    if (!challengeStageDef) {
      return;
    }
    var pathId = challengeStageDef.paths[g] || "sine_lr";
    var side = g % 2;
    var i;
    challengeGroupAlive = 8;
    challengeGroupHits = 0;
    for (i = 0; i < 8; i++) {
      var type = challengeStageDef.mainType;
      if (challengeStageDef.bossGroup === g && i < 4) {
        type = TYPE_BOSS;
      } else if (challengeStageDef.bossGroup === -1) {
        type = TYPE_BOSS;
      }
      var size = enemySpriteSize(type);
      var e = {
        id: "c" + challengeStageIndex + "_" + g + "_" + i,
        row: type,
        col: i,
        type: type,
        alive: true,
        hp: type === TYPE_BOSS ? 1 : 1,
        mode: MODE_CHALLENGE,
        homeX: 0,
        homeY: 0,
        x: side ? W + 40 : -40,
        y: 80,
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
        challengeT: 0,
        challengePath: {
          pathId: pathId,
          side: side,
        },
        challengePalette: challengeStageDef.palette,
        challengeNoted: false,
      };
      enemies.push(e);
    }
  }

  function updateChallengeEnemy(e) {
    e.challengeT++;
    var p = e.challengePath;
    var pt = challengePathPoint(p.pathId, e.challengeT, e.col, p.side);
    if (pt.waiting) {
      return;
    }
    e.x = pt.x;
    e.y = pt.y;
    if (pt.done) {
      e.alive = false;
      if (!e.challengeNoted) {
        e.challengeNoted = true;
        noteChallengeEnemyGone(false);
      }
    }
  }

  function tryStartDive() {
    if (isChallenge || !formationReady || enterQueue.length) {
      return;
    }
    if (diversActive() >= maxDivers) {
      return;
    }

    // Prefer sending the boss that holds your fighter — classic rescue dive
    var captureBoss = null;
    var fi;
    for (fi = 0; fi < enemies.length; fi++) {
      var fe = enemies[fi];
      if (
        fe.alive &&
        fe.mode === MODE_FORMATION &&
        fe.hasCapture &&
        fe.type === TYPE_BOSS
      ) {
        captureBoss = fe;
        break;
      }
    }
    if (captureBoss && Math.random() < 0.65) {
      beginEnemyDive(captureBoss, true);
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
    var i;
    for (i = 0; i < picked.length; i++) {
      var e = picked[i];
      var asRescue = !!e.hasCapture;
      beginEnemyDive(e, asRescue);
      if (
        e.type === TYPE_BOSS &&
        !e.hasCapture &&
        !capturedShip &&
        !dualFighter &&
        !pendingCaptureAttach &&
        Math.random() < 0.35
      ) {
        e.mode = MODE_TRACTOR;
        e.rescueDive = false;
      }
    }
  }

  function beginEnemyDive(e, asRescue) {
    var baseSp = waveConfig ? waveConfig.diveSpeed : BASE_DIVE_SPEED;
    e.mode = MODE_DIVING;
    e.diveT = 0;
    e.diveSpeed = baseSp + Math.random() * 0.7;
    e.diveAmp = 2.2 + Math.random() * 2.4;
    e.divePhase = Math.random() * Math.PI * 2;
    e.tractorActive = false;
    e.tractorT = 0;
    e.passFired = false;
    e.prevX = e.x;
    e.prevY = e.y;
    e.diveStartX = e.x;
    e.diveStartY = e.y;
    e.rescueDive = !!asRescue || !!e.hasCapture;
    if (e.rescueDive) {
      // Classic: peel toward the nearer side (or opposite of home bias)
      e.rescueSide = e.homeX < W * 0.5 ? -1 : 1;
      if (Math.random() < 0.35) {
        e.rescueSide = -e.rescueSide;
      }
      e.diveSpeed = baseSp * 0.9 + Math.random() * 0.35;
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
    if (
      capturedShip &&
      capturedShip.bossId === e.id &&
      capturedShip.state === "lifting"
    ) {
      e.tractorActive = true;
      e.x = e.homeX + Math.sin(animFrame / 10) * 4;
      e.y = H * 0.42 + Math.sin(animFrame / 14) * 2;
      return;
    }
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
    e.prevX = e.x;
    e.prevY = e.y;
    e.diveT++;
    if (e.rescueDive && e.hasCapture) {
      updateRescueDive(e);
    } else {
      e.y += e.diveSpeed;
      e.x =
        e.homeX +
        Math.sin(e.diveT / 6.5 + e.divePhase) * (12 + e.diveAmp * 4) +
        Math.sin(e.diveT / 18) * 5;
    }
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
      // Classic: captive stays with the boss and returns to formation
      e.mode = MODE_RETURNING;
      e.diveT = 0;
      e.y = -30;
      e.x = e.homeX;
      e.tractorActive = false;
      e.passFired = false;
      e.rescueDive = false;
    }
  }

  // Classic Galaga rescue swoop: peel to one side, one loop mid-screen, then exit
  function updateRescueDive(e) {
    var t = e.diveT;
    var side = e.rescueSide || 1;
    var sp = e.diveSpeed;
    var startX = e.diveStartX != null ? e.diveStartX : e.homeX;
    var startY = e.diveStartY != null ? e.diveStartY : e.homeY;

    // Steady descent with a temporary upward hitch during the loop
    var baseY = startY + t * sp;

    // Peel toward a side early, then hold
    var peel = side * Math.min(58, t * 2.1);

    // One full loop in the middle of the dive
    var loopX = 0;
    var loopY = 0;
    var loopStart = 38;
    var loopLen = 58;
    if (t > loopStart && t < loopStart + loopLen) {
      var u = (t - loopStart) / loopLen;
      var ang = u * Math.PI * 2;
      var R = 34;
      loopX = side * R * Math.sin(ang);
      loopY = -R * (1 - Math.cos(ang));
    }

    // After the loop, drift back slightly toward center-ish while still biased
    var settle = 0;
    if (t > loopStart + loopLen) {
      var s = Math.min(1, (t - loopStart - loopLen) / 40);
      settle = -peel * 0.25 * s;
    }

    e.x = startX + peel + loopX + settle;
    e.y = baseY + loopY;

    // Keep on-screen horizontally during the swoop
    if (e.x < 12) {
      e.x = 12;
    }
    if (e.x > W - 12) {
      e.x = W - 12;
    }
  }

  function updateReturning(e) {
    e.prevX = e.x;
    e.prevY = e.y;
    var dy = e.homeY - e.y;
    var dx = e.homeX + formationBob - e.x;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < e.diveSpeed * 1.5) {
      e.x = e.homeX;
      e.y = e.homeY;
      e.mode = MODE_FORMATION;
      e.rescueDive = false;
    } else {
      e.x += (dx / dist) * e.diveSpeed;
      e.y += (dy / dist) * e.diveSpeed;
    }
  }

  function updateCapturedShip() {
    if (!capturedShip) {
      return;
    }
    if (capturedShip.state === "lifting") {
      var liftBoss = findEnemyById(capturedShip.bossId);
      if (!liftBoss || !liftBoss.alive) {
        capturedShip = null;
        return;
      }
      var tx = liftBoss.x;
      var ty = liftBoss.y + liftBoss.h * 0.85;
      capturedShip.liftT++;
      capturedShip.x += (tx - capturedShip.x) * 0.12;
      capturedShip.y += (ty - capturedShip.y) * 0.12;
      // Spin / bob while riding the beam
      capturedShip.x += Math.sin(capturedShip.liftT * 0.45) * 1.2;
      if (
        Math.abs(capturedShip.x - tx) < 4 &&
        Math.abs(capturedShip.y - ty) < 4 &&
        capturedShip.liftT > 45
      ) {
        finishCaptureLift(liftBoss);
      }
      return;
    }
    if (capturedShip.state === "falling") {
      capturedShip.fallT++;
      capturedShip.y += 4.5;
      capturedShip.x += (player.x + player.w / 2 - capturedShip.x) * 0.05;
      if (capturedShip.y >= player.y - 8) {
        dualFighter = true;
        capturedShip = null;
        pendingCaptureAttach = false;
        bannerText = "DUAL FIGHTER!";
        bannerTimer = 90;
        bonusFlashText = "DUAL FIGHTER ASSEMBLED";
        bonusFlashTimer = 120;
        spawnBurst(player.x + player.w / 2, player.y, "#fff", 20);
      }
      return;
    }
    if (capturedShip.state === "hostile") {
      capturedShip.y += 2.4;
      capturedShip.x += Math.sin(capturedShip.fallT * 0.15) * 2.2;
      capturedShip.fallT++;
      if (capturedShip.y > H + 30) {
        capturedShip = null;
        pendingCaptureAttach = false;
      }
      return;
    }
    var boss = findEnemyById(capturedShip.bossId);
    if (!boss || !boss.alive) {
      if (pendingCaptureAttach) {
        return;
      }
      destroyCapturedShip(false);
      return;
    }
    // Formation: hang centered under boss.
    // Diving rescue: trail behind along the path so the captive swings clear
    // of a vertical shot at the boss (classic Galaga clear-shot window).
    if (boss.mode === MODE_DIVING || boss.mode === MODE_RETURNING) {
      var vx = boss.x - (boss.prevX != null ? boss.prevX : boss.x);
      var vy = boss.y - (boss.prevY != null ? boss.prevY : boss.y);
      var len = Math.sqrt(vx * vx + vy * vy);
      var trail = 18;
      var tx;
      var ty;
      if (len > 0.15) {
        tx = boss.x - (vx / len) * trail;
        ty = boss.y - (vy / len) * trail + 4;
      } else {
        var sideHang = boss.rescueSide || (boss.x < W * 0.5 ? -1 : 1);
        tx = boss.x - sideHang * 12;
        ty = boss.y + boss.h * 0.85;
      }
      // Lag follow — captive swings wide on turns/loops
      capturedShip.x += (tx - capturedShip.x) * 0.28;
      capturedShip.y += (ty - capturedShip.y) * 0.28;
    } else {
      capturedShip.x = boss.x;
      capturedShip.y = boss.y + boss.h * 0.9;
    }
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
    if (capturedShip || dualFighter || pendingCaptureAttach) {
      return;
    }
    // Classic: lose control and ride up the tractor beam
    capturedShip = {
      bossId: boss.id,
      x: player.x + player.w / 2,
      y: player.y + player.h / 2,
      state: "lifting",
      liftT: 0,
      fallT: 0,
      w: 16,
      h: 16,
    };
    boss.tractorActive = true;
    playerBullets = [];
    bannerText = "FIGHTER CAPTURED!";
    bannerTimer = 110;
    spawnBurst(player.x + player.w / 2, player.y, "#66ffcc", 12);
  }

  function finishCaptureLift(boss) {
    if (!capturedShip || capturedShip.state !== "lifting") {
      return;
    }
    capturedShip.state = "orbit";
    capturedShip.x = boss.x;
    capturedShip.y = boss.y + boss.h * 0.9;
    boss.hasCapture = true;
    boss.tractorActive = false;
    boss.mode = MODE_RETURNING;
    boss.diveT = 0;
    lives--;
    dualFighter = false;
    updateHud();
    if (lives <= 0) {
      gameOver();
      return;
    }
    player.x = W / 2 - player.w / 2;
    playerInvuln = RESPAWN_FRAMES + 30;
    bonusFlashText = "FIGHTER TAKEN — RESCUE IT!";
    bonusFlashTimer = 140;
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

  function convertCaptureToHostile(boss) {
    if (!capturedShip || capturedShip.bossId !== boss.id) {
      return;
    }
    if (capturedShip.state !== "orbit") {
      return;
    }
    boss.hasCapture = false;
    capturedShip.state = "hostile";
    capturedShip.bossId = null;
    capturedShip.fallT = 0;
    bannerText = "CAPTURED FIGHTER TURNED!";
    bannerTimer = 100;
    bonusFlashText = "IT ATTACKS — DON'T SHOOT YOUR RESERVE!";
    bonusFlashTimer = 140;
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
    pendingCaptureAttach = false;
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
    if (
      playerInvuln > 0 ||
      dualFighter ||
      capturedShip ||
      pendingCaptureAttach
    ) {
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
      var inBeamX = Math.abs(px - e.x) < 20;
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
    if (capturedShip && capturedShip.state === "lifting") {
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
    if (
      playerInvuln > 0 ||
      isChallenge ||
      (capturedShip && capturedShip.state === "lifting")
    ) {
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
      if (capturedShip && capturedShip.state === "hostile") {
        var hBox = {
          x: capturedShip.x - 8,
          y: capturedShip.y - 8,
          w: 16,
          h: 16,
        };
        if (rectsOverlap(hit, hBox)) {
          destroyCapturedShip(false);
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
      if (!e.challengeNoted) {
        e.challengeNoted = true;
        noteChallengeEnemyGone(true);
      }
    } else if (diving) {
      pts = PTS_DIVE_BY_TYPE[e.type] || 100;
    } else {
      pts = PTS_FORM_BY_TYPE[e.type] || 50;
    }
    if (e.hasCapture) {
      // Classic: diving boss → rescue dual; formation/return → hostile captive
      if (e.mode === MODE_DIVING) {
        releaseCapture(e);
        pts += 1000;
      } else {
        convertCaptureToHostile(e);
      }
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
      "Arrow keys / A·D move · Space or left-click fire. Enter a boss tractor beam to be captured — later shoot that diving boss (not your ship) for Dual Fighter. Challenging Stages cycle 8 classic patterns.";
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
    var stageName = challengeStageDef ? challengeStageDef.name : "BONUS";
    instructionsEl.textContent =
      stageName +
      " — Hits " +
      challengeHits +
      "/" +
      challengeTotal +
      " — Bonus +" +
      challengeBonus +
      (challengeGroupBonusEarned
        ? " — Groups +" + challengeGroupBonusEarned
        : "");
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

    if (capturedShip && capturedShip.state === "lifting") {
      // Classic Galaga: no control while riding the beam
    } else {
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
    }

    if (isChallenge) {
      challengeSpawnT++;
      if (challengeGroup < 5 && challengeSpawnT > 55 + challengeGroup * 100) {
        spawnChallengeGroup(challengeGroup);
        challengeGroup++;
      }
    } else {
      releaseEnterers();
      checkFormationReady();
      tryAttachPendingCapture();
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

    // Friendly-fire on captured fighter (orbit / hostile — not while falling/joining)
    if (
      capturedShip &&
      (capturedShip.state === "orbit" || capturedShip.state === "hostile")
    ) {
      for (i = playerBullets.length - 1; i >= 0; i--) {
        var bCap = playerBullets[i];
        var capBox = {
          x: capturedShip.x - 6,
          y: capturedShip.y - 6,
          w: 12,
          h: 12,
        };
        // While diving, shrink further so the trail offset opens a real boss shot
        if (capturedShip.state === "orbit") {
          var capBoss = findEnemyById(capturedShip.bossId);
          if (capBoss && capBoss.mode === MODE_DIVING) {
            capBox.x = capturedShip.x - 5;
            capBox.y = capturedShip.y - 5;
            capBox.w = 10;
            capBox.h = 10;
          }
        }
        if (rectsOverlap(bCap, capBox)) {
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
        bannerText =
          "CHALLENGING STAGE — " +
          (challengeStageDef ? challengeStageDef.name : "");
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
    if (capturedShip && capturedShip.state === "lifting") {
      return;
    }
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
    var frames = ENEMY_SETS[e.type] || ENEMY_SETS[TYPE_DRONE];
    var fi = Math.floor(animFrame / 18) % frames.length;
    var matrix = frames[fi];
    drawMatrixCentered(matrix, e.x, e.y, SPRITE_PX, enemyPalette(e));

    if (e.mode === MODE_TRACTOR && e.tractorActive) {
      var beamTop = e.y + e.h / 2;
      var beamBot = H - 16;
      var spin = animFrame * 0.22;
      var k;
      ctx.save();
      // Fan-shaped tractor beam (classic Galaga look)
      ctx.beginPath();
      ctx.moveTo(e.x - 6, beamTop);
      ctx.lineTo(e.x - 28, beamBot);
      ctx.lineTo(e.x + 28, beamBot);
      ctx.lineTo(e.x + 6, beamTop);
      ctx.closePath();
      ctx.fillStyle = "rgba(40,180,255,0.18)";
      ctx.fill();
      ctx.strokeStyle = "rgba(80,220,255,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
      for (k = 0; k < 6; k++) {
        var t = (k + 1) / 7;
        var half = 6 + t * 22;
        var yy = beamTop + (beamBot - beamTop) * t;
        var wob = Math.sin(spin + k) * 2;
        ctx.strokeStyle = "rgba(120,255,255," + (0.25 + (k % 2) * 0.2) + ")";
        ctx.beginPath();
        ctx.moveTo(e.x - half + wob, yy);
        ctx.lineTo(e.x + half + wob, yy);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawCaptured() {
    if (!capturedShip) {
      return;
    }
    if (!capturedShip.bossId && pendingCaptureAttach) {
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

    var recoveryTimer = setTimeout(function () {
      if (phase === PHASE_OVER && btnStart.disabled) {
        returnToStartScreen("Tap START to play again.");
      }
    }, 8000);

    function returnToStartScreen(hint) {
      clearTimeout(recoveryTimer);
      phase = PHASE_MENU;
      running = false;
      playerBullets = [];
      enemyBullets = [];
      particles = [];
      enemies = [];
      capturedShip = null;
      dualFighter = false;
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
          // Should not happen on HUD; if a cabinet still navigates, leave page alone.
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
    pendingCaptureAttach = false;
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
        ? "Challenging Stage — " +
            (challengeStageDef ? challengeStageDef.name : "BONUS") +
            "!"
        : "Wave 1 — alien convoy inbound!"
    );
  }

  function nextLevel() {
    level++;
    initFormation();
    var title = isChallenge ? "CHALLENGING STAGE" : "GET READY!";
    var hint;
    if (isChallenge) {
      hint =
        (challengeStageDef ? challengeStageDef.name : "BONUS") +
        " — no enemy fire. Clear each group for bonus; Perfect = 10,000!";
    } else if (pendingCaptureAttach || (capturedShip && capturedShip.state === "orbit")) {
      hint =
        "Wave " +
        level +
        " — shoot the diving boss holding your fighter to assemble Dual!";
    } else {
      hint = "Wave " + level + " — faster dives, denser fire!";
    }
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
