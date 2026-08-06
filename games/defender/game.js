(function () {
  "use strict";

  if (typeof SLArcade === "undefined") {
    window.SLArcade = {
      SCORES_UNAVAILABLE_MSG: "Scores unavailable (offline).",
      registerGameId: function () {},
      getSession: function () {
        return { name: "", token: "", scores: false };
      },
      getLeaderboard: function () {
        return Promise.resolve({
          ok: true,
          scoresEnabled: false,
          personalScore: 0,
          entries: [],
          unavailableMessage: "Scores unavailable (offline).",
        });
      },
      submitScore: function () {
        return Promise.resolve({ ok: true, saved: false, messages: [] });
      },
      endSession: function () {
        return Promise.resolve({ ok: true, ended: true });
      },
      loadMeta: function () {
        return Promise.resolve({ ok: true, scoresEnabled: false, meta: "" });
      },
      persistMeta: function () {
        return Promise.resolve({ ok: true, saved: false });
      },
      isHudMode: function () {
        return false;
      },
      canEndSession: function () {
        return false;
      },
      isPendingMoapSave: function () {
        return false;
      },
    };
  }

  SLArcade.registerGameId("defender");

  var canvas = document.getElementById("game");
  // Full-res modern renderer owns the 2D context.
  var R = window.DefenderRender;
  if (!R) {
    throw new Error("DefenderRender missing — load render/renderer.js before game.js");
  }
  var renderInfo = R.init(canvas);
  if (typeof console !== "undefined" && console.log) {
    console.log("Defender render mode:", renderInfo.mode);
  }

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
  var modeHint = document.getElementById("mode-hint");
  var modeSelect = document.getElementById("mode-select");

  var W = canvas.width;
  var H = canvas.height;
  var GROUND_Y = H - 70;
  var CIV_H = 24;
  /** If ship rises above this Y while carrying, human falls. */
  var CARRY_MAX_ALT = 72;
  /** Ship bottom at/below this → auto safe-drop (rescue). */
  var CARRY_SAFE_BOTTOM = GROUND_Y - 38;
  var FALL_GRAVITY = 560;

  var PHASE_MENU = "menu";
  var PHASE_PLAYING = "playing";
  var PHASE_OVER = "gameOver";

  var TICK = 1 / 60;
  var SHIP_SPEED = 240;
  var DODGE_SPEED_MULT = 2.5;
  var DODGE_DURATION = 0.2;
  var DODGE_RECHARGE = 5;
  var DODGE_MAX_BASE = 2;
  var RESCUES_PER_TIER = 5;
  var MAX_TIER = 5;
  var INVULN_AFTER_HIT = 0.75;
  var ZONE_DURATION = 40;
  var BREATHER_TIME = 3.5;
  var PARTICLE_CAP = 120;
  var BULLET_CAP = 80;
  var TELE_EARLY = 0.4;
  var TELE_MID = 0.4;
  var TELE_IMMINENT = 0.2;

  var MODES = {
    casual: {
      label: "Casual",
      hint: "Casual — softer pressure, more pickups. No leaderboard submit.",
      hp: 5,
      dStart: 0.2,
      dCap: 0.6,
      spawnMult: 0.7,
      pickupMult: 1.45,
      grabSpeed: 80,
      submit: false,
    },
    arcade: {
      label: "Arcade",
      hint: "Arcade — standard Defender pressure. Scores submit.",
      hp: 3,
      dStart: 0.35,
      dCap: 1,
      spawnMult: 1,
      pickupMult: 1,
      grabSpeed: 95,
      submit: true,
    },
    hardcore: {
      label: "Hardcore",
      hint: "Hardcore — brutal pressure, rarer pickups. Scores submit.",
      hp: 2,
      dStart: 0.5,
      dCap: 1,
      spawnMult: 1.35,
      pickupMult: 0.65,
      grabSpeed: 115,
      submit: true,
    },
  };

  var OFFENSIVE = {
    rapid_overdrive: { name: "RAPID", duration: 10, color: "#ffe066", shape: "angular" },
    spread_shot: { name: "SPREAD", duration: 15, color: "#66ff99", shape: "angular" },
    scatter_rail: { name: "SCATTER", duration: 15, color: "#88ff66", shape: "angular" },
    beam_lance: { name: "BEAM", duration: 12, color: "#66ccff", shape: "angular" },
    plasma_burst: { name: "PLASMA", duration: 8, color: "#cc66ff", shape: "angular" },
    homing_missiles: { name: "HOMING", duration: 18, color: "#ffaa66", shape: "angular" },
    arc_cannon: { name: "ARC", duration: 14, color: "#aaffff", shape: "angular" },
    temporal_spike: { name: "SPIKE", duration: 12, color: "#ff66aa", shape: "angular" },
    null_beam: { name: "NULL", duration: 12, color: "#8866ff", shape: "angular" },
    apex_surge: { name: "APEX", duration: 16, color: "#ffe0a0", shape: "angular" },
  };
  var DEFENSIVE = {
    dodge_recharge: { name: "DODGE+", duration: 8, color: "#88ffcc", shape: "rounded" },
    micro_shield: { name: "SHIELD", duration: 6, color: "#aaccff", shape: "rounded" },
    hazard_immunity: { name: "HAZ-IMM", duration: 8, color: "#ffcc88", shape: "rounded" },
    rescue_magnet: { name: "MAGNET", duration: 8, color: "#88ff88", shape: "rounded" },
    panic_suppressor: { name: "CALM", duration: 10, color: "#ddeeff", shape: "rounded" },
    gravity_stabilizer: { name: "STABIL", duration: 8, color: "#ccbbff", shape: "rounded" },
    apex_barrier: { name: "BARRIER", duration: 10, color: "#ffddaa", shape: "rounded" },
  };
  var OFF_IDS = Object.keys(OFFENSIVE);
  var DEF_IDS = Object.keys(DEFENSIVE);

  // Seven zone identities rotate; depth raises D via combat loop.
  var ZONE_META = [
    {
      name: "THE BREACH",
      visual: "breach",
      bossId: "breaker",
      bossName: "THE BREAKER",
      drops: { offensive: "scatter_rail", defensive: "dodge_recharge" },
      color: "#c05030",
      baseHp: 42,
      civMax: 10,
      civFlavor: "panic",
    },
    {
      name: "FLOODED DISTRICT",
      visual: "flooded",
      bossId: "tide_maw",
      bossName: "TIDE MAW",
      drops: { offensive: "beam_lance", defensive: "hazard_immunity" },
      color: "#2aa8c8",
      baseHp: 50,
      civMax: 8,
      civFlavor: "trapped",
    },
    {
      name: "FURNACE CORRIDOR",
      visual: "furnace",
      bossId: "pyre_warden",
      bossName: "PYRE WARDEN",
      drops: { offensive: "plasma_burst", defensive: "panic_suppressor" },
      color: "#ff6622",
      baseHp: 55,
      civMax: 5,
      civFlavor: "scarce",
    },
    {
      name: "GLASS LABYRINTH",
      visual: "glass",
      bossId: "spectral_shard",
      bossName: "SPECTRAL SHARD",
      drops: { offensive: "arc_cannon", defensive: "micro_shield" },
      color: "#88e0ff",
      baseHp: 58,
      civMax: 7,
      civFlavor: "disoriented",
    },
    {
      name: "SPORE EXPANSE",
      visual: "spore",
      bossId: "bloom_titan",
      bossName: "BLOOM TITAN",
      drops: { offensive: "temporal_spike", defensive: "rescue_magnet" },
      color: "#66cc66",
      baseHp: 62,
      civMax: 7,
      civFlavor: "infected",
    },
    {
      name: "NULL FIELD",
      visual: "null",
      bossId: "the_silence",
      bossName: "THE SILENCE",
      drops: { offensive: "null_beam", defensive: "gravity_stabilizer" },
      color: "#6644aa",
      baseHp: 66,
      civMax: 4,
      civFlavor: "silent",
    },
    {
      name: "APEX GATE",
      visual: "apex",
      bossId: "apex_entity",
      bossName: "APEX ENTITY",
      drops: { offensive: "apex_surge", defensive: "apex_barrier" },
      color: "#ffe066",
      baseHp: 75,
      civMax: 9,
      civFlavor: "critical",
    },
  ];

  function zoneMeta() {
    return ZONE_META[(zoneIndex - 1) % ZONE_META.length];
  }

  function zoneVisual() {
    return zoneMeta().visual;
  }

  var keys = {};
  var mouseDown = false;
  var phase = PHASE_MENU;
  var running = false;
  var score = 0;
  var sessionHigh = 0;
  var lastLeaderboardData = null;
  var selectedMode = "arcade";

  try {
    var savedMode = localStorage.getItem("defender_mode");
    if (savedMode && MODES[savedMode]) {
      selectedMode = savedMode;
    }
  } catch (e) {}

  var accum = 0;
  var lastTs = 0;
  var scrollX = 0;
  var D = 0.35;
  var dTimer = 0;
  var zoneIndex = 1;
  var zoneTimer = 0;
  var zoneName = "THE BREACH";
  var zonePhase = "combat"; // combat | boss | breather
  var breatherTimer = 0;
  var bossesDefeated = 0;
  var boss = null;
  var rescueStreak = 0;
  var nextScorePickup = 2500;
  var metrics = { kills: 0, rescues: 0, losses: 0, damage: 0, windowWindow: 0 };

  var starsFar = [];
  var starsNear = [];
  var bullets = [];
  var civilians = [];
  var enemies = [];
  var hazards = [];
  var telegraphs = [];
  var particles = [];
  var pickups = [];

  var spawnCivTimer = 0;
  var spawnGrabTimer = 0;
  var spawnHazardTimer = 0;
  var spawnRusherTimer = 0;
  var spawnPickupTimer = 0;
  var nextId = 1;

  var player = {
    x: 0,
    y: 0,
    w: 52,
    h: 26,
    facing: 1,
    hp: 3,
    maxHp: 3,
    tier: 1,
    rescues: 0,
    rescueProgress: 0,
    invuln: 0,
    dodgeCharges: 2,
    dodgeMax: 2,
    dodgeRecharge: 0,
    dodgeTimer: 0,
    dodgeDx: 0,
    dodgeDy: 0,
    fireCooldown: 0,
    muzzle: 0,
    muzzleX: 0,
    muzzleY: 0,
    offensive: null,
    defensives: [],
    shieldHits: 0,
    carryId: 0,
    /** After pickup, must leave the deposit band before low set-down counts as rescue. */
    carryDidLift: false,
  };

  function mode() {
    return MODES[selectedMode] || MODES.arcade;
  }

  function uid() {
    nextId += 1;
    return nextId;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
  }

  function hasDef(id) {
    var i;
    for (i = 0; i < player.defensives.length; i++) {
      if (player.defensives[i].id === id && player.defensives[i].time > 0) {
        return true;
      }
    }
    return false;
  }

  function tierStats(tier) {
    var t = clamp(tier, 1, MAX_TIER) - 1;
    return {
      cooldown: 0.14 * Math.pow(0.92, t),
      bulletSpeed: 480 + t * 35,
      damage: 1,
      spread: 0.04 * t,
      extra: t >= 2 ? 1 : 0,
    };
  }

  function seedStars() {
    starsFar = [];
    starsNear = [];
    var i;
    for (i = 0; i < 48; i++) {
      starsFar.push({ x: rand(0, W), y: rand(0, H * 0.75), s: rand(0.6, 1.4) });
    }
    for (i = 0; i < 28; i++) {
      starsNear.push({ x: rand(0, W), y: rand(0, H * 0.75), s: rand(1.4, 2.4) });
    }
  }

  function setOverlayButtons(showStart, showNext) {
    btnStart.classList.toggle("hidden", !showStart);
    btnNext.classList.toggle("hidden", !showNext);
  }

  function setStartScreenExtras(visible) {
    startScoresEl.classList.toggle("hidden", !visible);
    btnLeaderboard.classList.toggle("hidden", !visible);
    if (modeSelect) {
      modeSelect.classList.toggle("hidden", !visible);
    }
    if (modeHint) {
      modeHint.classList.toggle("hidden", !visible);
    }
    if (!visible) {
      closeLeaderboardModal();
    }
  }

  function showOverlay(title, hint) {
    overlayTitle.textContent = title;
    endHintEl.textContent = hint || "";
    overlay.classList.remove("hidden");
    overlay.style.display = "";
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    overlay.style.display = "none";
  }

  function closeLeaderboardModal() {
    leaderboardModal.classList.add("hidden");
  }

  function openLeaderboardModal() {
    leaderboardModal.classList.remove("hidden");
  }

  function showMessages(list) {
    messagesEl.innerHTML = "";
    if (!list || !list.length) {
      return;
    }
    var i;
    for (i = 0; i < list.length; i++) {
      var p = document.createElement("p");
      p.className = "msg";
      p.textContent = list[i];
      messagesEl.appendChild(p);
    }
  }

  function syncModeUI() {
    var buttons = document.querySelectorAll(".mode-btn");
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("active", buttons[i].getAttribute("data-mode") === selectedMode);
    }
    if (modeHint && MODES[selectedMode]) {
      modeHint.textContent = MODES[selectedMode].hint;
    }
  }

  function selectMode(id) {
    if (!MODES[id]) {
      return;
    }
    selectedMode = id;
    try {
      localStorage.setItem("defender_mode", id);
    } catch (e) {}
    syncModeUI();
  }

  function renderLeaderboard(data) {
    lastLeaderboardData = data || null;
    unavailableEl.classList.add("hidden");
    startScoresEl.classList.remove("hidden");
    var personal = data && typeof data.personalScore === "number" ? data.personalScore : 0;
    personalEl.textContent = "Your top score: " + (personal > 0 ? personal : "—");
    var entries = (data && data.entries) || [];
    var top = entries.length ? entries[0].score : 0;
    highScoreEl.textContent = "High score: " + (top > 0 ? top : "—");
    leaderboardEl.innerHTML = "";
    var i;
    for (i = 0; i < entries.length; i++) {
      var e = entries[i];
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="rank">' +
        (e.rank || i + 1) +
        '</span><span class="name">' +
        (e.name || "—") +
        '</span><span class="score">' +
        (e.score || 0) +
        "</span>";
      leaderboardEl.appendChild(li);
    }
    if (data && data.scoresEnabled === false && data.unavailableMessage) {
      unavailableEl.textContent = data.unavailableMessage;
      unavailableEl.classList.remove("hidden");
      startScoresEl.classList.add("hidden");
    }
  }

  function refreshScores() {
    return SLArcade.getLeaderboard()
      .then(renderLeaderboard)
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        startScoresEl.classList.add("hidden");
      });
  }

  function updatePlayerLine() {
    var s = SLArcade.getSession ? SLArcade.getSession() : null;
    playerLine.textContent = s && s.name ? "Player: " + s.name : "Player: local";
  }

  function addScore(n) {
    score += n;
    if (score > sessionHigh) {
      sessionHigh = score;
    }
  }

  function spawnParticle(x, y, color, life, opts) {
    if (particles.length >= PARTICLE_CAP) {
      particles.splice(0, particles.length - PARTICLE_CAP + 8);
    }
    opts = opts || {};
    var ang = opts.angle != null ? opts.angle : rand(0, Math.PI * 2);
    var spd = opts.speed != null ? opts.speed : rand(40, 140);
    particles.push({
      x: x,
      y: y,
      vx: opts.vx != null ? opts.vx : Math.cos(ang) * spd,
      vy: opts.vy != null ? opts.vy : Math.sin(ang) * spd,
      life: life || 0.35,
      maxLife: life || 0.35,
      color: color || "#ff8844",
      kind: opts.kind || "glow",
      size: opts.size != null ? opts.size : 1,
      rot: opts.rot != null ? opts.rot : ang,
      spin: opts.spin != null ? opts.spin : rand(-6, 6),
    });
  }

  function spawnBurst(x, y, color, count, kind) {
    var i;
    var n = count || 6;
    for (i = 0; i < n; i++) {
      spawnParticle(x, y, color, rand(0.18, 0.45), {
        kind: kind || (i === 0 ? "impact" : "spark"),
        size: kind === "impact" ? 1.1 : rand(0.6, 1.4),
        speed: rand(80, 220),
        angle: (i / n) * Math.PI * 2 + rand(-0.2, 0.2),
      });
    }
    if (kind !== "impact") {
      spawnParticle(x, y, color, 0.22, { kind: "impact", size: 0.85, speed: 0, vx: 0, vy: 0 });
    }
  }

  function spawnMuzzle(ox, oy, dir) {
    player.muzzle = 0.08;
    player.muzzleX = ox;
    player.muzzleY = oy;
    var i;
    for (i = 0; i < 4; i++) {
      spawnParticle(ox, oy, i < 2 ? "#fff8d0" : "#ffb040", 0.12 + i * 0.03, {
        kind: "spark",
        size: 0.7 + i * 0.15,
        vx: dir * rand(120, 280),
        vy: rand(-60, 60),
        rot: dir > 0 ? 0 : Math.PI,
      });
    }
  }

  function sfx(id) {
    if (window.DefenderAudio) {
      DefenderAudio.play(id);
    }
  }

  function startTelegraph(ownerKind, ownerId, shape, x, y, w, h, onExecute) {
    if (ownerKind === "boss") {
      sfx("tele");
    }
    telegraphs.push({
      id: uid(),
      ownerKind: ownerKind,
      ownerId: ownerId,
      shape: shape,
      x: x,
      y: y,
      w: w,
      h: h,
      age: 0,
      total: TELE_EARLY + TELE_MID + TELE_IMMINENT,
      onExecute: onExecute,
      done: false,
    });
  }

  function telePhase(t) {
    if (t < TELE_EARLY) {
      return { name: "early", color: "#ffe066", alpha: 0.4 };
    }
    if (t < TELE_EARLY + TELE_MID) {
      return { name: "mid", color: "#ff9944", alpha: 0.7 };
    }
    if (t < TELE_EARLY + TELE_MID + TELE_IMMINENT) {
      return { name: "imminent", color: "#ff3344", alpha: 1 };
    }
    return { name: "execute", color: "#ffffff", alpha: 1 };
  }

  function spawnWorldPickup(family, id, x, y, decay) {
    var def = family === "offensive" ? OFFENSIVE[id] : DEFENSIVE[id];
    if (!def) {
      return;
    }
    pickups.push({
      id: uid(),
      family: family,
      typeId: id,
      x: x,
      y: y,
      w: family === "offensive" ? 18 : 16,
      h: family === "offensive" ? 18 : 16,
      decay: decay == null ? 12 : decay,
      pulse: 0,
    });
  }

  function spawnRandomPickup(x, y) {
    if (Math.random() < 0.55) {
      spawnWorldPickup("offensive", OFF_IDS[(Math.random() * OFF_IDS.length) | 0], x, y, 14);
    } else {
      spawnWorldPickup("defensive", DEF_IDS[(Math.random() * DEF_IDS.length) | 0], x, y, 14);
    }
  }

  function activatePickup(p) {
    sfx("pickup");
    if (p.family === "offensive") {
      var od = OFFENSIVE[p.typeId];
      player.offensive = { id: p.typeId, time: od.duration, max: od.duration };
      for (var i = 0; i < 10; i++) {
        spawnParticle(p.x, p.y, od.color, 0.4);
      }
    } else {
      var dd = DEFENSIVE[p.typeId];
      player.defensives.push({ id: p.typeId, time: dd.duration, max: dd.duration });
      if (p.typeId === "micro_shield") {
        player.shieldHits = Math.max(player.shieldHits, 1);
      }
      if (p.typeId === "apex_barrier") {
        player.shieldHits = Math.max(player.shieldHits, 2);
      }
      if (p.typeId === "dodge_recharge") {
        player.dodgeCharges = Math.min(player.dodgeMax, player.dodgeCharges + 1);
        player.dodgeRecharge = Math.min(player.dodgeRecharge, 1.5);
      }
      for (var j = 0; j < 8; j++) {
        spawnParticle(p.x, p.y, dd.color, 0.4);
      }
    }
  }

  function spawnCivilianCluster(cx) {
    var count = 2 + ((Math.random() * 3) | 0);
    var i;
    for (i = 0; i < count; i++) {
      civilians.push({
        id: uid(),
        x: cx + rand(-30, 30),
        y: GROUND_Y - CIV_H,
        w: 16,
        h: 24,
        state: "idle",
        panic: 0,
        vx: rand(-20, 20),
        vy: 0,
        carriedBy: 0,
      });
    }
  }

  function spawnCivilianIsolate() {
    civilians.push({
      id: uid(),
      x: rand(40, W - 40),
      y: GROUND_Y - CIV_H,
      w: 16,
      h: 24,
      state: "idle",
      panic: 0,
      vx: rand(-25, 25),
      vy: 0,
      carriedBy: 0,
    });
  }

  function spawnGrabber() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "grabber",
      x: side < 0 ? -30 : W + 30,
      y: rand(80, GROUND_Y - 80),
      w: 40,
      h: 32,
      hp: 2,
      state: "seek",
      targetId: 0,
      carryId: 0,
      ascendSpeed: 50 + D * 25,
      speed: mode().grabSpeed * (0.85 + D * 0.3),
    });
  }

  function spawnRusher() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "rusher",
      x: side < 0 ? -24 : W + 24,
      y: rand(60, GROUND_Y - 100),
      w: 36,
      h: 20,
      hp: 1,
      vx: side * (130 + D * 40),
      state: "fly",
      carryId: 0,
    });
  }

  function spawnSwimmer() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "swimmer",
      x: side < 0 ? -28 : W + 28,
      y: GROUND_Y - 40 + rand(-20, 10),
      w: 40,
      h: 22,
      hp: 2,
      vx: side * (70 + D * 30),
      bob: rand(0, Math.PI * 2),
      state: "swim",
      carryId: 0,
    });
  }

  function spawnLunger() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "lunger",
      x: side < 0 ? -30 : W + 30,
      y: rand(100, GROUND_Y - 90),
      w: 36,
      h: 22,
      hp: 2,
      state: "stalk",
      wind: 0,
      carryId: 0,
      speed: 60,
    });
  }

  function spawnBurner() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "burner",
      x: side < 0 ? -28 : W + 28,
      y: rand(70, GROUND_Y - 120),
      w: 38,
      h: 24,
      hp: 2,
      vx: side * (90 + D * 30),
      drip: rand(0.8, 1.6),
      state: "fly",
      carryId: 0,
    });
  }

  function spawnHeatRunner() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "heat_runner",
      x: side < 0 ? -30 : W + 30,
      y: GROUND_Y - 22,
      w: 36,
      h: 22,
      hp: 1,
      vx: side * (180 + D * 50),
      state: "run",
      carryId: 0,
    });
  }

  function spawnSteamStriker() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "steam_striker",
      x: side < 0 ? -30 : W + 30,
      y: rand(90, GROUND_Y - 90),
      w: 36,
      h: 22,
      hp: 2,
      state: "stalk",
      wind: 0,
      carryId: 0,
      speed: 70,
    });
  }

  function spawnSlicer() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "slicer",
      x: side < 0 ? -24 : W + 24,
      y: rand(60, GROUND_Y - 100),
      w: 36,
      h: 22,
      hp: 1,
      vx: side * (150 + D * 40),
      vy: rand(-80, 80),
      state: "zip",
      carryId: 0,
    });
  }

  function spawnMirrorClone() {
    enemies.push({
      id: uid(),
      type: "mirror_clone",
      x: W - 60,
      y: player.y,
      w: 40,
      h: 24,
      hp: 2,
      state: "mirror",
      mirrorT: 1.1,
      carryId: 0,
      speed: 160 + D * 40,
    });
  }

  function spawnPrismDancer() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "prism_dancer",
      x: side < 0 ? -28 : W + 28,
      y: rand(80, GROUND_Y - 100),
      w: 32,
      h: 32,
      hp: 2,
      bob: rand(0, Math.PI * 2),
      vx: side * (100 + D * 35),
      state: "dance",
      carryId: 0,
    });
  }

  function spawnMutator() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "mutator",
      x: side < 0 ? -28 : W + 28,
      y: rand(100, GROUND_Y - 80),
      w: 36,
      h: 36,
      hp: 2,
      state: "seek",
      carryId: 0,
      speed: 70 + D * 25,
      infectCd: 0,
    });
  }

  function spawnCorruptor() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "corruptor",
      x: side < 0 ? -30 : W + 30,
      y: rand(80, GROUND_Y - 90),
      w: 40,
      h: 32,
      hp: 2,
      state: "seek",
      targetId: 0,
      carryId: 0,
      ascendSpeed: 45 + D * 20,
      speed: mode().grabSpeed * 0.85 * (0.85 + D * 0.3),
    });
  }

  function spawnSporeHulk() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "spore_hulk",
      x: side < 0 ? -40 : W + 40,
      y: rand(100, GROUND_Y - 110),
      w: 48,
      h: 40,
      hp: 4,
      state: "lumber",
      carryId: 0,
      speed: 55 + D * 20,
    });
  }

  function spawnPhaser() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "phaser",
      x: side < 0 ? -28 : W + 28,
      y: rand(70, GROUND_Y - 100),
      w: 34,
      h: 28,
      hp: 2,
      state: "drift",
      blink: rand(0.6, 1.4),
      carryId: 0,
      speed: 90,
    });
  }

  function spawnBlinker() {
    enemies.push({
      id: uid(),
      type: "blinker",
      x: rand(80, W - 80),
      y: rand(60, GROUND_Y - 100),
      w: 30,
      h: 30,
      hp: 1,
      state: "blink",
      blink: rand(0.4, 0.9),
      carryId: 0,
    });
  }

  function spawnVoidStalker() {
    var side = Math.random() < 0.5 ? -1 : 1;
    enemies.push({
      id: uid(),
      type: "void_stalker",
      x: side < 0 ? -30 : W + 30,
      y: rand(80, GROUND_Y - 90),
      w: 40,
      h: 32,
      hp: 3,
      state: "stalk",
      carryId: 0,
      speed: 100 + D * 30,
      home: 0,
    });
  }

  function spawnZoneEnemy() {
    var vis = zoneVisual();
    var r = Math.random();
    if (vis === "breach") {
      spawnRusher();
    } else if (vis === "flooded") {
      if (r < 0.55) {
        spawnSwimmer();
      } else {
        spawnLunger();
      }
    } else if (vis === "furnace") {
      if (r < 0.34) {
        spawnBurner();
      } else if (r < 0.67) {
        spawnHeatRunner();
      } else {
        spawnSteamStriker();
      }
    } else if (vis === "glass") {
      if (r < 0.34) {
        spawnSlicer();
      } else if (r < 0.67) {
        spawnMirrorClone();
      } else {
        spawnPrismDancer();
      }
    } else if (vis === "spore") {
      if (r < 0.34) {
        spawnMutator();
      } else if (r < 0.67) {
        spawnCorruptor();
      } else {
        spawnSporeHulk();
      }
    } else if (vis === "null") {
      if (r < 0.34) {
        spawnPhaser();
      } else if (r < 0.67) {
        spawnBlinker();
      } else {
        spawnVoidStalker();
      }
    } else {
      // Apex Gate — mixed palette
      var mix = [
        spawnRusher,
        spawnSwimmer,
        spawnLunger,
        spawnBurner,
        spawnSlicer,
        spawnMutator,
        spawnPhaser,
        spawnSporeHulk,
      ];
      mix[(Math.random() * mix.length) | 0]();
    }
  }

  function spawnFlameJetHazard() {
    var hx = rand(80, W - 80);
    var hw = 28;
    var hh = 110;
    var hy = GROUND_Y - hh;
    var hid = uid();
    startTelegraph("hazard", hid, "line", hx, hy, hw, hh, function () {
      hazards.push({
        id: hid,
        type: "flame_jet",
        x: hx,
        y: hy,
        w: hw,
        h: hh,
        life: 3.5,
        dmgCooldown: 0,
        drop: Math.random() < 0.3,
      });
    });
  }

  function spawnSteamHazard() {
    var hx = rand(60, W - 60);
    var hy = rand(80, GROUND_Y - 80);
    var hw = 70;
    var hh = 48;
    var hid = uid();
    startTelegraph("hazard", hid, "circle", hx, hy, hw, hh, function () {
      hazards.push({
        id: hid,
        type: "steam",
        x: hx,
        y: hy,
        w: hw,
        h: hh,
        life: 3.2,
        dmgCooldown: 0,
        drop: Math.random() < 0.28,
      });
    });
  }

  function spawnLaserHazard() {
    var hy = rand(70, GROUND_Y - 60);
    var hh = 14;
    var hid = uid();
    startTelegraph("hazard", hid, "line", 20, hy, W - 40, hh, function () {
      hazards.push({
        id: hid,
        type: "laser",
        x: 20,
        y: hy,
        w: W - 40,
        h: hh,
        life: 2.4,
        dmgCooldown: 0,
        drop: Math.random() < 0.25,
      });
    });
  }

  function spawnSporeCloudHazard() {
    var hx = rand(60, W - 60);
    var hy = rand(70, GROUND_Y - 90);
    var hw = 90;
    var hh = 70;
    var hid = uid();
    startTelegraph("hazard", hid, "circle", hx, hy, hw, hh, function () {
      hazards.push({
        id: hid,
        type: "spore",
        x: hx,
        y: hy,
        w: hw,
        h: hh,
        life: 5.0,
        dmgCooldown: 0,
        drop: Math.random() < 0.35,
      });
    });
  }

  function spawnGravityWellHazard() {
    var hx = rand(100, W - 100);
    var hy = rand(90, GROUND_Y - 100);
    var hw = 80;
    var hh = 80;
    var hid = uid();
    startTelegraph("hazard", hid, "circle", hx, hy, hw, hh, function () {
      hazards.push({
        id: hid,
        type: "well",
        x: hx,
        y: hy,
        w: hw,
        h: hh,
        life: 4.5,
        dmgCooldown: 0,
        drop: Math.random() < 0.3,
      });
    });
  }

  function spawnZoneHazard() {
    var vis = zoneVisual();
    var r = Math.random();
    if (vis === "breach") {
      spawnFireHazard();
    } else if (vis === "flooded") {
      spawnPuddleHazard();
    } else if (vis === "furnace") {
      if (r < 0.55) {
        spawnFlameJetHazard();
      } else {
        spawnSteamHazard();
      }
    } else if (vis === "glass") {
      spawnLaserHazard();
    } else if (vis === "spore") {
      spawnSporeCloudHazard();
    } else if (vis === "null") {
      spawnGravityWellHazard();
    } else {
      var mix = [
        spawnFireHazard,
        spawnPuddleHazard,
        spawnFlameJetHazard,
        spawnLaserHazard,
        spawnSporeCloudHazard,
        spawnGravityWellHazard,
      ];
      mix[(Math.random() * mix.length) | 0]();
    }
  }

  function spawnMutant(x, y) {
    enemies.push({
      id: uid(),
      type: "mutant",
      x: x,
      y: y,
      w: 36,
      h: 36,
      hp: 2,
      state: "chase",
      carryId: 0,
      speed: 120 + D * 40,
    });
  }

  function spawnFireHazard() {
    var hx = rand(60, W - 60);
    var hy = GROUND_Y - 8;
    var hw = 48;
    var hh = 28;
    var hid = uid();
    startTelegraph("hazard", hid, "circle", hx - hw * 0.5, hy - hh, hw, hh, function () {
      hazards.push({
        id: hid,
        type: "fire",
        x: hx - hw * 0.5,
        y: hy - hh,
        w: hw,
        h: hh,
        life: 4.5,
        dmgCooldown: 0,
        drop: Math.random() < 0.35,
      });
    });
  }

  function spawnPuddleHazard() {
    var hx = rand(60, W - 60);
    var hy = GROUND_Y - 6;
    var hw = 56;
    var hh = 22;
    var hid = uid();
    startTelegraph("hazard", hid, "circle", hx - hw * 0.5, hy - hh, hw, hh, function () {
      hazards.push({
        id: hid,
        type: "puddle",
        x: hx - hw * 0.5,
        y: hy - hh,
        w: hw,
        h: hh,
        life: 5.5,
        dmgCooldown: 0,
        drop: Math.random() < 0.4,
      });
    });
  }

  function findCivilian(id) {
    var i;
    for (i = 0; i < civilians.length; i++) {
      if (civilians[i].id === id) {
        return civilians[i];
      }
    }
    return null;
  }

  function nearestFreeCivilian(ex, ey) {
    var best = null;
    var bestD = 1e12;
    var i;
    for (i = 0; i < civilians.length; i++) {
      var c = civilians[i];
      if (
        c.carriedBy ||
        c.state === "rescued" ||
        c.state === "player_carry" ||
        c.state === "falling"
      ) {
        continue;
      }
      var d = dist2(ex, ey, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  function canPlayerPickUp() {
    return !player.carryId;
  }

  function clearEnemyCarryOf(c) {
    var i;
    for (i = 0; i < enemies.length; i++) {
      if (enemies[i].carryId === c.id) {
        enemies[i].carryId = 0;
        if (enemies[i].state === "carry" || enemies[i].state === "ascend") {
          enemies[i].state = "seek";
        }
      }
    }
  }

  function removeCivilian(c) {
    var i;
    if (player.carryId === c.id) {
      player.carryId = 0;
      player.carryDidLift = false;
    }
    clearEnemyCarryOf(c);
    for (i = 0; i < civilians.length; i++) {
      if (civilians[i].id === c.id) {
        civilians.splice(i, 1);
        return;
      }
    }
  }

  /** Safe ground deposit after player carry — this is a Rescue. */
  function completeRescue(c) {
    player.rescues += 1;
    player.rescueProgress += 1;
    rescueStreak += 1;
    metrics.rescues += 1;
    addScore(500 + rescueStreak * 25);
    sfx("rescue");
    spawnBurst(c.x + c.w * 0.5, c.y + c.h * 0.5, "#88ffaa", 6, "spark");
    if (player.rescueProgress >= RESCUES_PER_TIER && player.tier < MAX_TIER) {
      player.rescueProgress = 0;
      player.tier += 1;
      addScore(250);
    }
    if (rescueStreak > 0 && rescueStreak % 3 === 0) {
      spawnWorldPickup(
        "defensive",
        pick(DEF_IDS),
        clamp(player.x + player.facing * 50, 30, W - 30),
        player.y,
        10
      );
    }
    removeCivilian(c);
  }

  function pickUpCivilian(c) {
    if (!canPlayerPickUp()) {
      return false;
    }
    if (c.state === "carried" && c.carriedBy) {
      return false;
    }
    clearEnemyCarryOf(c);
    c.carriedBy = 0;
    c.state = "player_carry";
    c.vy = 0;
    c.panic = 0;
    player.carryId = c.id;
    // Midair catch is already above the deposit band → armed to set down.
    // Ground scoop must climb first or next-frame auto-deposit would fake an instant rescue.
    player.carryDidLift = player.y + player.h < CARRY_SAFE_BOTTOM;
    addScore(100);
    sfx("rescue");
    spawnParticle(c.x, c.y, "#aaffcc", 0.25, { kind: "spark", size: 0.8, speed: 40 });
    return true;
  }

  function depositCivilian(c) {
    c.x = clamp(player.x + player.w * 0.5 - c.w * 0.5, 10, W - 20);
    c.y = GROUND_Y - CIV_H;
    c.vy = 0;
    c.carriedBy = 0;
    player.carryId = 0;
    player.carryDidLift = false;
    completeRescue(c);
  }

  function startCivilianFall(c, x, y) {
    clearEnemyCarryOf(c);
    if (player.carryId === c.id) {
      player.carryId = 0;
    }
    player.carryDidLift = false;
    c.carriedBy = 0;
    c.state = "falling";
    c.vy = 60;
    if (x != null) {
      c.x = x;
    }
    if (y != null) {
      c.y = y;
    }
  }

  function splatCivilian(c) {
    metrics.losses += 1;
    rescueStreak = 0;
    sfx("damage");
    spawnBurst(c.x + c.w * 0.5, GROUND_Y - 8, "#ff6688", 10, "spark");
    removeCivilian(c);
  }

  function damagePlayer(amount) {
    if (player.dodgeTimer > 0 || player.invuln > 0) {
      return;
    }
    if (player.shieldHits > 0) {
      player.shieldHits -= 1;
      player.invuln = 0.35;
      spawnParticle(player.x + player.w * 0.5, player.y, "#aaccff", 0.4);
      sfx("hit");
      return;
    }
    player.hp -= amount;
    player.invuln = INVULN_AFTER_HIT;
    metrics.damage += amount;
    sfx("damage");
    var i;
    for (i = 0; i < 8; i++) {
      spawnParticle(player.x + player.w * 0.5, player.y + player.h * 0.5, "#ff6688", 0.4);
    }
    if (player.hp <= 0) {
      player.hp = 0;
      endRun(false);
    }
  }

  function rescueCivilian(c) {
    // Legacy name — rescue is complete deposit after carry
    completeRescue(c);
  }

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  function killEnemy(e, award) {
    var i;
    if (e.carryId) {
      var c = findCivilian(e.carryId);
      if (c) {
        startCivilianFall(c, e.x + e.w * 0.3, e.y + e.h);
      }
      e.carryId = 0;
    }
    spawnBurst(
      e.x + e.w * 0.5,
      e.y + e.h * 0.5,
      e.type === "mutant" ? "#cc66ff" : e.type === "swimmer" ? "#66ddff" : "#ffaa66",
      8,
      "spark"
    );
    for (i = 0; i < 4; i++) {
      spawnParticle(e.x + e.w * 0.5, e.y + e.h * 0.5, "#ffe8a0", 0.28, {
        kind: "shard",
        size: rand(0.7, 1.3),
        speed: rand(60, 180),
      });
    }
    if (award) {
      metrics.kills += 1;
      sfx("hit");
      if (e.type === "mutant") {
        addScore(250);
      } else if (e.type === "grabber") {
        addScore(e.state === "carry" || e.state === "ascend" ? 400 : 150);
      } else if (e.type === "lunger" || e.type === "swimmer") {
        addScore(175);
      } else {
        addScore(100);
      }
      // Enemy drop chance
      if (e.type === "grabber" && Math.random() < 0.22) {
        spawnWorldPickup("offensive", "spread_shot", e.x, e.y, 10);
      }
      if ((e.type === "swimmer" || e.type === "lunger") && Math.random() < 0.18) {
        spawnWorldPickup("offensive", "beam_lance", e.x, e.y, 10);
      }
      if ((e.type === "burner" || e.type === "heat_runner") && Math.random() < 0.2) {
        spawnWorldPickup("offensive", "plasma_burst", e.x, e.y, 10);
      }
      if ((e.type === "slicer" || e.type === "prism_dancer") && Math.random() < 0.2) {
        spawnWorldPickup("offensive", "arc_cannon", e.x, e.y, 10);
      }
      if ((e.type === "mutator" || e.type === "spore_hulk") && Math.random() < 0.2) {
        spawnWorldPickup("offensive", "temporal_spike", e.x, e.y, 10);
      }
      if ((e.type === "phaser" || e.type === "void_stalker") && Math.random() < 0.2) {
        spawnWorldPickup("offensive", "null_beam", e.x, e.y, 10);
      }
    }
    e.hp = 0;
  }

  function tryDodge() {
    if (player.dodgeTimer > 0 || player.dodgeCharges < 1) {
      return;
    }
    var ax = 0;
    var ay = 0;
    if (keys.ArrowLeft || keys.a || keys.A) {
      ax -= 1;
    }
    if (keys.ArrowRight || keys.d || keys.D) {
      ax += 1;
    }
    if (keys.ArrowUp || keys.w || keys.W) {
      ay -= 1;
    }
    if (keys.ArrowDown || keys.s || keys.S) {
      ay += 1;
    }
    if (ax === 0 && ay === 0) {
      ax = player.facing;
    }
    var len = Math.sqrt(ax * ax + ay * ay) || 1;
    player.dodgeDx = ax / len;
    player.dodgeDy = ay / len;
    player.dodgeTimer = DODGE_DURATION;
    player.dodgeCharges -= 1;
    sfx("dodge");
    if (player.dodgeCharges < player.dodgeMax && player.dodgeRecharge <= 0) {
      player.dodgeRecharge = hasDef("dodge_recharge") ? DODGE_RECHARGE * 0.45 : DODGE_RECHARGE;
    }
  }

  function wantFire() {
    return !!(keys[" "] || keys.Spacebar || keys.z || keys.Z || mouseDown);
  }

  function pushBullet(b) {
    if (bullets.length >= BULLET_CAP) {
      bullets.splice(0, 12);
    }
    bullets.push(b);
  }

  function tryFire() {
    if (player.dodgeTimer > 0 || player.fireCooldown > 0) {
      return;
    }
    var st = tierStats(player.tier);
    var off = player.offensive ? player.offensive.id : null;
    var dir = player.facing;
    var ox = player.x + (dir > 0 ? player.w : 0);
    var oy = player.y + player.h * 0.5;
    sfx("fire");
    spawnMuzzle(ox, oy, dir);

    if (off === "rapid_overdrive") {
      player.fireCooldown = 0.05;
      pushBullet({ x: ox, y: oy, vx: 620 * dir, vy: 0, dmg: 1, life: 1.0, pierce: 0 });
    } else if (off === "spread_shot" || off === "scatter_rail") {
      player.fireCooldown = 0.16;
      var k;
      for (k = -2; k <= 2; k++) {
        pushBullet({
          x: ox,
          y: oy,
          vx: 500 * dir,
          vy: k * 70,
          dmg: 1,
          life: 1.1,
          pierce: 0,
        });
      }
    } else if (off === "beam_lance") {
      player.fireCooldown = 0.08;
      pushBullet({
        x: ox,
        y: oy,
        vx: 700 * dir,
        vy: 0,
        dmg: 1,
        life: 0.9,
        pierce: 3,
        beam: true,
      });
    } else if (off === "plasma_burst") {
      player.fireCooldown = 0.28;
      pushBullet({
        x: ox,
        y: oy,
        vx: 280 * dir,
        vy: 0,
        dmg: 2,
        life: 0.55,
        pierce: 0,
        aoe: 36,
      });
    } else if (off === "homing_missiles") {
      player.fireCooldown = 0.22;
      pushBullet({
        x: ox,
        y: oy,
        vx: 320 * dir,
        vy: rand(-40, 40),
        dmg: 1,
        life: 1.4,
        pierce: 0,
        homing: true,
      });
    } else if (off === "arc_cannon") {
      player.fireCooldown = 0.18;
      pushBullet({
        x: ox,
        y: oy,
        vx: 560 * dir,
        vy: 0,
        dmg: 1,
        life: 1.0,
        pierce: 1,
        arc: true,
        beam: true,
      });
    } else if (off === "temporal_spike") {
      player.fireCooldown = 0.09;
      pushBullet({
        x: ox,
        y: oy,
        vx: 640 * dir,
        vy: 0,
        dmg: 2,
        life: 0.7,
        pierce: 0,
      });
    } else if (off === "null_beam") {
      player.fireCooldown = 0.07;
      pushBullet({
        x: ox,
        y: oy,
        vx: 720 * dir,
        vy: 0,
        dmg: 1,
        life: 1.0,
        pierce: 5,
        beam: true,
      });
    } else if (off === "apex_surge") {
      player.fireCooldown = 0.12;
      var k;
      for (k = -1; k <= 1; k++) {
        pushBullet({
          x: ox,
          y: oy,
          vx: 580 * dir,
          vy: k * 55,
          dmg: 1,
          life: 1.0,
          pierce: 1,
          beam: k === 0,
        });
      }
    } else {
      player.fireCooldown = st.cooldown;
      var shots = 1 + st.extra;
      var i;
      for (i = 0; i < shots; i++) {
        var spread = (i - (shots - 1) * 0.5) * st.spread;
        pushBullet({
          x: ox,
          y: oy + spread * 40,
          vx: st.bulletSpeed * dir,
          vy: spread * st.bulletSpeed * 0.35,
          dmg: st.damage,
          life: 1.2,
          pierce: 0,
        });
      }
    }
  }

  function enterZone(idx) {
    zoneIndex = idx;
    zoneTimer = 0;
    zonePhase = "combat";
    breatherTimer = 0;
    boss = null;
    var zm = zoneMeta();
    zoneName = zm.name;
    sfx("ui");
    spawnCivilianCluster(W * 0.6);
  }

  function bossMaxHp() {
    var zm = zoneMeta();
    var cycle = Math.floor((zoneIndex - 1) / ZONE_META.length);
    var casualFactor = selectedMode === "casual" ? 0.75 : selectedMode === "hardcore" ? 1.2 : 1;
    return Math.floor(zm.baseHp * (1 + D * 0.85) * (1 + cycle * 0.2) * casualFactor);
  }

  function spawnBoss() {
    var zm = zoneMeta();
    var hp = bossMaxHp();
    boss = {
      id: uid(),
      type: zm.bossId,
      name: zm.bossName,
      x: W * 0.72,
      y: H * 0.38,
      w: bossSize(zm.bossId).w,
      h: bossSize(zm.bossId).h,
      hp: hp,
      maxHp: hp,
      color: zm.color,
      cd: 1.2,
      moveT: 0,
      attack: "idle",
      drops: zm.drops,
      flash: 0,
    };
    zonePhase = "boss";
    sfx("boss");
    // Clear clutter for readable open-zone fight; keep civilians
    enemies = enemies.filter(function (e) {
      return e.type === "grabber" && e.carryId;
    });
    hazards = [];
    // Leave existing telegraphs to finish naturally
  }

  function bossSize(id) {
    if (id === "breaker") {
      return { w: 110, h: 86 };
    }
    if (id === "tide_maw") {
      return { w: 120, h: 78 };
    }
    if (id === "pyre_warden") {
      return { w: 112, h: 88 };
    }
    if (id === "spectral_shard") {
      return { w: 96, h: 100 };
    }
    if (id === "bloom_titan") {
      return { w: 120, h: 100 };
    }
    if (id === "the_silence") {
      return { w: 100, h: 100 };
    }
    return { w: 128, h: 100 };
  }

  function bossStartFlameBurst() {
    if (!boss) {
      return;
    }
    var cx = clamp(player.x + player.w * 0.5 - 44, 40, W - 100);
    var cy = clamp(player.y + player.h * 0.5 - 44, 40, GROUND_Y - 100);
    var size = 96;
    boss.attack = "flame";
    boss.cd = 2.1;
    startTelegraph("boss", boss.id, "circle", cx, cy, size, size, function () {
      bossHitPlayerRect(cx, cy, size, size);
      var i;
      for (i = 0; i < 18; i++) {
        spawnParticle(cx + size * 0.5, cy + size * 0.5, "#ff6622", 0.4);
      }
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartHeatWave() {
    if (!boss) {
      return;
    }
    var hy = clamp(player.y - 10, 40, GROUND_Y - 60);
    boss.attack = "heatwave";
    boss.cd = 2.3;
    startTelegraph("boss", boss.id, "line", 30, hy, W - 60, 36, function () {
      bossHitPlayerRect(30, hy, W - 60, 36);
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartArcSlice() {
    if (!boss) {
      return;
    }
    var dir = player.x < boss.x ? -1 : 1;
    var lx = dir < 0 ? boss.x - 200 : boss.x + boss.w;
    var ly = boss.y;
    boss.attack = "arc";
    boss.cd = 1.9;
    startTelegraph("boss", boss.id, "line", lx, ly, dir < 0 ? -200 : 200, 50, function () {
      bossHitPlayerRect(dir < 0 ? lx - 200 : lx, ly, 200, 50);
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartPrismScatter() {
    if (!boss) {
      return;
    }
    var spots = [
      { x: clamp(player.x - 20, 40, W - 80), y: clamp(player.y - 20, 40, GROUND_Y - 80) },
      { x: clamp(player.x + 80, 40, W - 80), y: clamp(player.y - 60, 40, GROUND_Y - 80) },
      { x: clamp(player.x - 60, 40, W - 80), y: clamp(player.y + 50, 40, GROUND_Y - 80) },
    ];
    boss.attack = "prism";
    boss.cd = 2.4;
    var done = 0;
    var i;
    for (i = 0; i < spots.length; i++) {
      (function (s) {
        startTelegraph("boss", boss.id, "circle", s.x, s.y, 56, 56, function () {
          bossHitPlayerRect(s.x, s.y, 56, 56);
          done += 1;
          if (done >= spots.length && boss) {
            boss.attack = "idle";
          }
        });
      })(spots[i]);
    }
  }

  function bossStartSporeEruption() {
    if (!boss) {
      return;
    }
    var gx = clamp(player.x - 30, 40, W - 160);
    var gy = clamp(player.y - 30, 40, GROUND_Y - 160);
    boss.attack = "spore";
    boss.cd = 2.5;
    var cells = [
      { x: gx, y: gy },
      { x: gx + 70, y: gy },
      { x: gx, y: gy + 70 },
      { x: gx + 70, y: gy + 70 },
    ];
    var done = 0;
    var i;
    for (i = 0; i < cells.length; i++) {
      (function (c) {
        startTelegraph("boss", boss.id, "circle", c.x, c.y, 60, 60, function () {
          bossHitPlayerRect(c.x, c.y, 60, 60);
          done += 1;
          if (done >= cells.length && boss) {
            boss.attack = "idle";
          }
        });
      })(cells[i]);
    }
  }

  function bossStartVineLash() {
    if (!boss) {
      return;
    }
    var dir = player.x < boss.x ? -1 : 1;
    var lx = dir < 0 ? boss.x - 240 : boss.x + boss.w;
    var ly = boss.y + boss.h * 0.4;
    boss.attack = "vine";
    boss.cd = 2.1;
    startTelegraph("boss", boss.id, "line", lx, ly, dir < 0 ? -240 : 240, 22, function () {
      bossHitPlayerRect(dir < 0 ? lx - 240 : lx, ly, 240, 22);
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartVoidPulse() {
    if (!boss) {
      return;
    }
    var cx = clamp(player.x + player.w * 0.5 - 50, 40, W - 110);
    var cy = clamp(player.y + player.h * 0.5 - 50, 40, GROUND_Y - 110);
    var size = 100;
    boss.attack = "void";
    boss.cd = 2.2;
    startTelegraph("boss", boss.id, "circle", cx, cy, size, size, function () {
      bossHitPlayerRect(cx, cy, size, size);
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartGravityWell() {
    if (!boss) {
      return;
    }
    var cx = clamp(player.x - 20, 60, W - 120);
    var cy = clamp(player.y - 20, 60, GROUND_Y - 120);
    boss.attack = "gravity";
    boss.cd = 2.4;
    startTelegraph("boss", boss.id, "circle", cx, cy, 90, 90, function () {
      hazards.push({
        id: uid(),
        type: "well",
        x: cx,
        y: cy,
        w: 90,
        h: 90,
        life: 2.8,
        dmgCooldown: 0,
        drop: false,
      });
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossPickAttack() {
    if (!boss) {
      return;
    }
    var t = boss.type;
    var r = Math.random();
    if (t === "breaker") {
      if (r < 0.5) {
        bossStartLineSlam();
      } else {
        bossStartCircleStomp();
      }
    } else if (t === "tide_maw") {
      if (r < 0.55) {
        bossStartConeSurge();
      } else {
        bossStartWavePush();
      }
    } else if (t === "pyre_warden") {
      if (r < 0.55) {
        bossStartFlameBurst();
      } else {
        bossStartHeatWave();
      }
    } else if (t === "spectral_shard") {
      if (r < 0.5) {
        bossStartArcSlice();
      } else {
        bossStartPrismScatter();
      }
    } else if (t === "bloom_titan") {
      if (r < 0.55) {
        bossStartSporeEruption();
      } else {
        bossStartVineLash();
      }
    } else if (t === "the_silence") {
      if (r < 0.5) {
        bossStartVoidPulse();
      } else {
        bossStartGravityWell();
      }
    } else {
      // Apex Entity — modular mix
      var mods = [
        bossStartLineSlam,
        bossStartCircleStomp,
        bossStartConeSurge,
        bossStartFlameBurst,
        bossStartPrismScatter,
        bossStartSporeEruption,
        bossStartVoidPulse,
        bossStartVineLash,
      ];
      mods[(Math.random() * mods.length) | 0]();
    }
  }

  function bossHitPlayerRect(x, y, w, h) {
    if (player.dodgeTimer > 0) {
      return;
    }
    if (aabb(player.x, player.y, player.w, player.h, x, y, w, h)) {
      damagePlayer(1);
    }
  }

  function bossStartLineSlam() {
    if (!boss) {
      return;
    }
    var dir = player.x < boss.x ? -1 : 1;
    var lx = dir < 0 ? boss.x - 220 : boss.x + boss.w;
    var lw = 220;
    var ly = boss.y + boss.h * 0.35;
    var lh = 28;
    boss.attack = "line";
    boss.cd = 2.0;
    startTelegraph("boss", boss.id, "line", lx, ly, dir < 0 ? -lw : lw, lh, function () {
      bossHitPlayerRect(dir < 0 ? lx - lw : lx, ly, lw, lh);
      var i;
      for (i = 0; i < 12; i++) {
        spawnParticle(lx + rand(0, lw) * (dir < 0 ? -1 : 1), ly + lh * 0.5, "#ff8844", 0.35);
      }
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartCircleStomp() {
    if (!boss) {
      return;
    }
    var cx = clamp(player.x + player.w * 0.5 - 40, 40, W - 100);
    var cy = clamp(player.y + player.h * 0.5 - 40, 40, GROUND_Y - 100);
    var size = 88;
    boss.attack = "circle";
    boss.cd = 2.2;
    startTelegraph("boss", boss.id, "circle", cx, cy, size, size, function () {
      bossHitPlayerRect(cx, cy, size, size);
      var i;
      for (i = 0; i < 16; i++) {
        spawnParticle(cx + size * 0.5, cy + size * 0.5, "#ffaa66", 0.4);
      }
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartConeSurge() {
    if (!boss) {
      return;
    }
    var dir = player.x < boss.x ? -1 : 1;
    var cx = dir < 0 ? boss.x - 160 : boss.x + boss.w;
    var cy = boss.y + 4;
    var cw = 160;
    var ch = 70;
    boss.attack = "cone";
    boss.cd = 2.0;
    startTelegraph("boss", boss.id, "line", cx, cy, dir < 0 ? -cw : cw, ch, function () {
      bossHitPlayerRect(dir < 0 ? cx - cw : cx, cy, cw, ch);
      var i;
      for (i = 0; i < 14; i++) {
        spawnParticle(cx + rand(0, cw) * (dir > 0 ? 1 : -1), cy + rand(0, ch), "#66ddff", 0.35);
      }
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function bossStartWavePush() {
    if (!boss) {
      return;
    }
    var wy = GROUND_Y - 70;
    var wh = 50;
    boss.attack = "wave";
    boss.cd = 2.3;
    startTelegraph("boss", boss.id, "circle", 40, wy, W - 80, wh, function () {
      bossHitPlayerRect(40, wy, W - 80, wh);
      // Mild push upward if hit
      if (aabb(player.x, player.y, player.w, player.h, 40, wy, W - 80, wh) && player.dodgeTimer <= 0) {
        player.y = clamp(player.y - 40, 8, GROUND_Y - player.h);
      }
      if (boss) {
        boss.attack = "idle";
      }
    });
  }

  function onBossDeath() {
    if (!boss) {
      return;
    }
    var bx = boss.x + boss.w * 0.5;
    var by = boss.y + boss.h * 0.5;
    var drops = boss.drops;
    var i;
    for (i = 0; i < 24; i++) {
      spawnParticle(bx, by, boss.color, 0.55);
    }
    spawnWorldPickup("offensive", drops.offensive, bx - 30, by - 10, 18);
    spawnWorldPickup("defensive", drops.defensive, bx + 20, by + 10, 18);
    addScore(5000 * zoneIndex);
    bossesDefeated += 1;
    sfx("boss_die");
    boss = null;
    zonePhase = "breather";
    breatherTimer = BREATHER_TIME;
    D = clamp(D * 0.92, 0, mode().dCap);
  }

  function updateBoss(dt) {
    if (!boss) {
      return;
    }
    if (boss.flash > 0) {
      boss.flash -= dt;
    }
    boss.moveT += dt;
    boss.cd -= dt;

    // Movement modules by boss identity
    if (boss.type === "breaker") {
      boss.x += Math.sin(boss.moveT * 0.6) * 28 * dt;
      boss.y += Math.cos(boss.moveT * 0.45) * 18 * dt;
    } else if (boss.type === "tide_maw") {
      boss.x += Math.sin(boss.moveT * 0.9) * 55 * dt;
      boss.y += Math.sin(boss.moveT * 1.3) * 30 * dt;
    } else if (boss.type === "pyre_warden") {
      boss.x += Math.sin(boss.moveT * 1.1) * 36 * dt;
      boss.y += Math.sin(boss.moveT * 2.2) * 22 * dt;
    } else if (boss.type === "spectral_shard") {
      boss.x += Math.sin(boss.moveT * 1.6) * 70 * dt;
      boss.y += Math.cos(boss.moveT * 1.9) * 45 * dt;
    } else if (boss.type === "bloom_titan") {
      boss.x += Math.sin(boss.moveT * 0.5) * 22 * dt;
      boss.y += Math.cos(boss.moveT * 0.4) * 14 * dt;
    } else if (boss.type === "the_silence") {
      if (boss.blink == null) {
        boss.blink = 1.8;
      }
      boss.blink -= dt;
      if (boss.blink <= 0) {
        boss.x = clamp(player.x + rand(-120, 120), W * 0.35, W - boss.w - 20);
        boss.y = clamp(player.y + rand(-80, 80), 50, GROUND_Y - boss.h - 30);
        boss.blink = rand(1.4, 2.2);
      } else {
        boss.x += Math.sin(boss.moveT) * 20 * dt;
        boss.y += Math.cos(boss.moveT * 0.7) * 16 * dt;
      }
    } else {
      boss.x += Math.sin(boss.moveT * 1.2) * 50 * dt;
      boss.y += Math.cos(boss.moveT * 0.9) * 35 * dt;
    }
    boss.x = clamp(boss.x, W * 0.35, W - boss.w - 20);
    boss.y = clamp(boss.y, 50, GROUND_Y - boss.h - 30);

    // Contact damage
    if (
      player.dodgeTimer <= 0 &&
      aabb(player.x, player.y, player.w, player.h, boss.x, boss.y, boss.w, boss.h)
    ) {
      damagePlayer(1);
    }

    if (boss.cd <= 0 && boss.attack === "idle") {
      bossPickAttack();
    }

    if (boss.hp <= 0) {
      onBossDeath();
    }
  }

  function damageBoss(amount) {
    if (!boss || zonePhase !== "boss") {
      return;
    }
    boss.hp -= amount;
    boss.flash = 0.12;
    if (boss.hp <= 0) {
      boss.hp = 0;
      onBossDeath();
    }
  }

  function resetRun() {
    var m = mode();
    var meta = window.DefenderMeta ? DefenderMeta.get() : null;
    var power = !!m.submit;
    var bonus = window.DefenderMeta
      ? DefenderMeta.startBonuses(meta, power)
      : { tier: 1, maxHpBonus: 0, dodgeMax: DODGE_MAX_BASE, calmStart: false };
    score = 0;
    scrollX = 0;
    D = m.dStart;
    dTimer = 0;
    rescueStreak = 0;
    nextScorePickup = 2500;
    metrics = { kills: 0, rescues: 0, losses: 0, damage: 0, timeWindow: 0 };
    bullets = [];
    civilians = [];
    enemies = [];
    hazards = [];
    telegraphs = [];
    particles = [];
    pickups = [];
    boss = null;
    bossesDefeated = 0;
    zonePhase = "combat";
    breatherTimer = 0;
    spawnCivTimer = 0.5;
    spawnGrabTimer = 2;
    spawnHazardTimer = 3;
    spawnRusherTimer = 1.5;
    spawnPickupTimer = 4;
    player.x = W * 0.2;
    player.y = H * 0.45;
    player.facing = 1;
    player.maxHp = m.hp + bonus.maxHpBonus;
    player.hp = player.maxHp;
    player.tier = bonus.tier;
    player.rescues = 0;
    player.rescueProgress = 0;
    player.invuln = 0;
    player.dodgeMax = bonus.dodgeMax;
    player.dodgeCharges = player.dodgeMax;
    player.dodgeRecharge = 0;
    player.dodgeTimer = 0;
    player.fireCooldown = 0;
    player.muzzle = 0;
    player.offensive = null;
    player.defensives = [];
    player.shieldHits = 0;
    player.carryId = 0;
    player.carryDidLift = false;
    if (bonus.calmStart) {
      player.defensives.push({ id: "panic_suppressor", time: 8, max: 8 });
    }
    seedStars();
    enterZone(1);
    spawnCivilianIsolate();
    spawnWorldPickup("offensive", "spread_shot", W * 0.7, H * 0.4, 16);
    updateHud();
  }

  function updateHud() {
    var hpBars = "";
    var i;
    for (i = 0; i < player.maxHp; i++) {
      hpBars +=
        '<i class="hud-seg' +
        (i < player.hp ? " on" : "") +
        '"></i>';
    }
    var dodgeBars = "";
    for (i = 0; i < player.dodgeMax; i++) {
      dodgeBars +=
        '<i class="hud-seg dodge' +
        (i < player.dodgeCharges ? " on" : "") +
        '"></i>';
    }
    var gun = player.offensive ? OFFENSIVE[player.offensive.id].name : "TIER " + player.tier;
    var defs = "";
    for (i = 0; i < player.defensives.length; i++) {
      if (player.defensives[i].time > 0) {
        defs +=
          '<span class="hud-chip">' + DEFENSIVE[player.defensives[i].id].name + "</span>";
      }
    }
    var status = zoneName;
    var phaseTag = "";
    if (zonePhase === "boss" && boss) {
      phaseTag = "BOSS";
      status += " · " + boss.hp + "/" + boss.maxHp;
    } else if (zonePhase === "breather") {
      phaseTag = "CLEAR";
    } else {
      phaseTag = "COMBAT";
    }
    hud.innerHTML =
      '<div class="hud-panel">' +
      '<div class="hud-top">' +
      '<div class="hud-score-block"><span class="hud-kicker">SCORE</span><strong class="hud-score-val">' +
      score +
      "</strong></div>" +
      '<div class="hud-zone-block"><span class="hud-kicker">' +
      phaseTag +
      '</span><strong class="hud-zone-val">' +
      status +
      "</strong></div>" +
      "</div>" +
      '<div class="hud-meters">' +
      '<div class="hud-meter"><span class="hud-kicker">HULL</span><div class="hud-bar">' +
      hpBars +
      "</div></div>" +
      '<div class="hud-meter"><span class="hud-kicker">DODGE</span><div class="hud-bar">' +
      dodgeBars +
      "</div></div>" +
      "</div>" +
      '<div class="hud-foot">' +
      '<span class="hud-stat"><em>RESCUES</em> ' +
      player.rescues +
      "</span>" +
      '<span class="hud-stat"><em>GUN</em> ' +
      gun +
      "</span>" +
      (defs ? '<span class="hud-buffs">' + defs + "</span>" : "") +
      "</div></div>";
  }

  function updateDifficulty(dt) {
    dTimer += dt;
    metrics.timeWindow += dt;
    if (dTimer < 2) {
      return;
    }
    dTimer = 0;
    var m = mode();
    var killRate = metrics.kills / Math.max(metrics.timeWindow, 0.1);
    var expected = 0.55 + D * 0.45;
    D += (killRate - expected) * 0.04;
    D -= metrics.damage * 0.07;
    D += metrics.rescues * 0.02;
    D -= metrics.losses * 0.09;
    if (player.offensive) {
      D += 0.012;
    }
    // Soft floor so early game still has pressure after a rough streak
    var floor = m.dStart * 0.55;
    D = clamp(D, floor, m.dCap);
    metrics.kills = 0;
    metrics.rescues = 0;
    metrics.losses = 0;
    metrics.damage = 0;
    metrics.timeWindow = 0;
  }

  function updatePickups(dt) {
    var i;
    // Active effect timers
    if (player.offensive) {
      player.offensive.time -= dt;
      if (player.offensive.time <= 0) {
        player.offensive = null;
      }
    }
    for (i = player.defensives.length - 1; i >= 0; i--) {
      player.defensives[i].time -= dt;
      if (player.defensives[i].time <= 0) {
        if (player.defensives[i].id === "micro_shield") {
          player.shieldHits = 0;
        }
        player.defensives.splice(i, 1);
      }
    }

    for (i = pickups.length - 1; i >= 0; i--) {
      var p = pickups[i];
      p.decay -= dt;
      p.pulse += dt;
      if (p.decay <= 0) {
        pickups.splice(i, 1);
        continue;
      }
      if (aabb(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) {
        activatePickup(p);
        pickups.splice(i, 1);
      }
    }

    if (score >= nextScorePickup) {
      spawnRandomPickup(clamp(player.x + 120, 40, W - 40), clamp(player.y - 20, 40, GROUND_Y - 40));
      nextScorePickup += 2500;
    }
  }

  function updateTelegraphs(dt) {
    var i;
    for (i = telegraphs.length - 1; i >= 0; i--) {
      var t = telegraphs[i];
      t.age += dt;
      if (!t.done && t.age >= t.total) {
        t.done = true;
        if (t.onExecute) {
          t.onExecute();
        }
        telegraphs.splice(i, 1);
      }
    }
  }

  function rescueRadius() {
    return hasDef("rescue_magnet") ? 22 : 0;
  }

  function panicRadius() {
    var base = hasDef("panic_suppressor") ? 70 : 120;
    return base + D * 40;
  }

  function updateCivilians(dt) {
    var i;
    var pad = rescueRadius();
    for (i = civilians.length - 1; i >= 0; i--) {
      var c = civilians[i];
      if (c.state === "rescued") {
        civilians.splice(i, 1);
        continue;
      }

      // Dangling under player ship
      if (c.state === "player_carry") {
        c.x = player.x + player.w * 0.5 - c.w * 0.5;
        c.y = player.y + player.h + 2;
        if (player.y < CARRY_MAX_ALT) {
          startCivilianFall(c, c.x, c.y);
        } else if (player.y + player.h < CARRY_SAFE_BOTTOM) {
          player.carryDidLift = true;
        } else if (player.carryDidLift && player.y + player.h >= CARRY_SAFE_BOTTOM) {
          depositCivilian(c);
        }
        continue;
      }

      // Falling after drop / enemy kill — catch midair or splat
      if (c.state === "falling") {
        c.vy += FALL_GRAVITY * dt;
        c.y += c.vy * dt;
        if (
          canPlayerPickUp() &&
          aabb(
            player.x - pad,
            player.y - pad,
            player.w + pad * 2,
            player.h + pad * 2,
            c.x,
            c.y,
            c.w,
            c.h
          )
        ) {
          pickUpCivilian(c);
          continue;
        }
        if (c.y + c.h >= GROUND_Y) {
          splatCivilian(c);
          continue;
        }
        continue;
      }

      // Held by enemy — enemy update owns position
      if (c.carriedBy) {
        continue;
      }

      var threatNear = false;
      var j;
      var pr = panicRadius();
      for (j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (
          (e.type === "grabber" || e.type === "lunger" || e.type === "corruptor") &&
          dist2(e.x, e.y, c.x, c.y) < pr * pr
        ) {
          threatNear = true;
          break;
        }
      }

      if (threatNear) {
        c.state = "panic";
        c.panic = Math.max(c.panic, 1.2);
      }

      if (c.panic > 0) {
        c.panic -= dt;
        c.vx += rand(-80, 80) * dt;
        c.vx = clamp(c.vx, -70, 70);
        if (c.panic <= 0) {
          c.state = "idle";
        }
      } else {
        c.vx += rand(-15, 15) * dt;
        c.vx = clamp(c.vx, -25, 25);
      }

      c.x += c.vx * dt;
      c.y = GROUND_Y - CIV_H;
      if (c.x < 10) {
        c.x = 10;
        c.vx = Math.abs(c.vx);
      }
      if (c.x > W - 20) {
        c.x = W - 20;
        c.vx = -Math.abs(c.vx);
      }

      // Touch on ground (or with magnet) → pick up (not instant rescue)
      if (
        canPlayerPickUp() &&
        aabb(
          player.x - pad,
          player.y - pad,
          player.w + pad * 2,
          player.h + pad * 2,
          c.x,
          c.y,
          c.w,
          c.h
        )
      ) {
        pickUpCivilian(c);
      }
    }
  }

  function updateEnemies(dt) {
    var i;
    for (i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e.hp <= 0) {
        enemies.splice(i, 1);
        continue;
      }

      if (e.type === "rusher") {
        e.x += e.vx * dt;
        if (e.x < -40 || e.x > W + 40) {
          enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === "swimmer") {
        e.bob += dt * 3;
        e.x += e.vx * dt;
        e.y = GROUND_Y - 36 + Math.sin(e.bob) * 10;
        if (e.x < -40 || e.x > W + 40) {
          enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === "lunger") {
        if (e.state === "stalk") {
          var lx = player.x - e.x;
          var ly = player.y - e.y;
          var ll = Math.sqrt(lx * lx + ly * ly) || 1;
          e.x += (lx / ll) * e.speed * dt;
          e.y += (ly / ll) * e.speed * 0.5 * dt;
          if (ll < 160) {
            e.state = "windup";
            e.wind = 0;
            startTelegraph("enemy", e.id, "line", e.x, e.y - 6, 80 * (lx > 0 ? 1 : -1) || 80, 12, null);
          }
        } else if (e.state === "windup") {
          e.wind += dt;
          if (e.wind >= 1.0) {
            e.state = "lunge";
            e.vx = (player.x < e.x ? -1 : 1) * (280 + D * 60);
            e.vy = (player.y - e.y) * 1.2;
            e.lungeLife = 0.35;
          }
        } else if (e.state === "lunge") {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.lungeLife -= dt;
          if (e.lungeLife <= 0) {
            e.state = "stalk";
          }
        }
      } else if (e.type === "mutant") {
        var mx = player.x + player.w * 0.5 - (e.x + e.w * 0.5);
        var my = player.y + player.h * 0.5 - (e.y + e.h * 0.5);
        var ml = Math.sqrt(mx * mx + my * my) || 1;
        e.x += (mx / ml) * e.speed * dt;
        e.y += (my / ml) * e.speed * dt;
      } else if (e.type === "grabber") {
        if (e.state === "seek") {
          var tgt = nearestFreeCivilian(e.x, e.y);
          if (tgt) {
            e.targetId = tgt.id;
            var dx = tgt.x - e.x;
            var dy = tgt.y - e.y;
            var dl = Math.sqrt(dx * dx + dy * dy) || 1;
            e.x += (dx / dl) * e.speed * dt;
            e.y += (dy / dl) * e.speed * dt;
            if (dl < 18) {
              e.state = "carry";
              e.carryId = tgt.id;
              tgt.carriedBy = e.id;
              tgt.state = "carried";
            }
          } else {
            e.x += (player.x < e.x ? -1 : 1) * 40 * dt;
          }
        } else if (e.state === "carry" || e.state === "ascend") {
          e.state = "ascend";
          e.y -= e.ascendSpeed * dt;
          var carried = findCivilian(e.carryId);
          if (carried) {
            carried.x = e.x + 8;
            carried.y = e.y + e.h;
          }
          if (e.y < -30) {
            if (carried) {
              spawnMutant(clamp(e.x, 40, W - 40), 60);
              metrics.losses += 1;
              rescueStreak = 0;
              var ci;
              for (ci = 0; ci < civilians.length; ci++) {
                if (civilians[ci].id === carried.id) {
                  civilians.splice(ci, 1);
                  break;
                }
              }
            }
            enemies.splice(i, 1);
            continue;
          }
        }
      } else if (e.type === "burner") {
        e.x += e.vx * dt;
        e.drip -= dt;
        if (e.drip <= 0 && hazards.length < 4) {
          hazards.push({
            id: uid(),
            type: "fire",
            x: e.x,
            y: GROUND_Y - 28,
            w: 36,
            h: 28,
            life: 2.2,
            dmgCooldown: 0,
            drop: false,
          });
          e.drip = rand(1.2, 2.0);
        }
        if (e.x < -50 || e.x > W + 50) {
          enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === "heat_runner") {
        e.x += e.vx * dt;
        e.y = GROUND_Y - 22;
        if (e.x < -50 || e.x > W + 50) {
          enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === "steam_striker") {
        if (e.state === "stalk") {
          var sx = player.x - e.x;
          var sy = player.y - e.y;
          var sl = Math.sqrt(sx * sx + sy * sy) || 1;
          e.x += (sx / sl) * e.speed * dt;
          e.y += (sy / sl) * e.speed * 0.45 * dt;
          if (sl < 150) {
            e.state = "windup";
            e.wind = 0;
            startTelegraph("enemy", e.id, "circle", e.x - 10, e.y - 10, 40, 40, null);
          }
        } else if (e.state === "windup") {
          e.wind += dt;
          if (e.wind >= 1.0) {
            e.state = "lunge";
            e.vx = (player.x < e.x ? -1 : 1) * (260 + D * 50);
            e.vy = (player.y - e.y) * 1.1;
            e.lungeLife = 0.32;
          }
        } else if (e.state === "lunge") {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.lungeLife -= dt;
          if (e.lungeLife <= 0) {
            e.state = "stalk";
          }
        }
      } else if (e.type === "slicer") {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.y < 40 || e.y > GROUND_Y - 40) {
          e.vy *= -1;
        }
        if (e.x < -50 || e.x > W + 50) {
          enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === "mirror_clone") {
        if (e.state === "mirror") {
          e.y += (player.y - e.y) * 3 * dt;
          e.mirrorT -= dt;
          if (e.mirrorT <= 0) {
            e.state = "charge";
            e.vx = (player.x < e.x ? -1 : 1) * e.speed;
          }
        } else {
          e.x += e.vx * dt;
          if (e.x < -50 || e.x > W + 50) {
            enemies.splice(i, 1);
            continue;
          }
        }
      } else if (e.type === "prism_dancer") {
        e.bob += dt * 5;
        e.x += e.vx * dt;
        e.y += Math.sin(e.bob) * 90 * dt;
        e.y = clamp(e.y, 40, GROUND_Y - 40);
        if (e.x < -50 || e.x > W + 50) {
          enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === "mutator") {
        var ux = player.x - e.x;
        var uy = player.y - e.y;
        var ul = Math.sqrt(ux * ux + uy * uy) || 1;
        e.x += (ux / ul) * e.speed * dt;
        e.y += (uy / ul) * e.speed * 0.7 * dt;
        e.infectCd -= dt;
        if (e.infectCd <= 0) {
          var ci;
          for (ci = 0; ci < civilians.length; ci++) {
            var cv = civilians[ci];
            if (
              !cv.carriedBy &&
              cv.state !== "player_carry" &&
              cv.state !== "falling" &&
              dist2(e.x, e.y, cv.x, cv.y) < 90 * 90
            ) {
              cv.panic = Math.max(cv.panic, 2.0);
              cv.state = "panic";
            }
          }
          e.infectCd = 1.4;
        }
      } else if (e.type === "corruptor") {
        if (e.state === "seek") {
          var ct = nearestFreeCivilian(e.x, e.y);
          if (ct) {
            e.targetId = ct.id;
            var cdx = ct.x - e.x;
            var cdy = ct.y - e.y;
            var cdl = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
            e.x += (cdx / cdl) * e.speed * dt;
            e.y += (cdy / cdl) * e.speed * dt;
            if (cdl < 18) {
              e.state = "ascend";
              e.carryId = ct.id;
              ct.carriedBy = e.id;
              ct.state = "carried";
            }
          } else {
            e.x += (player.x < e.x ? -1 : 1) * 35 * dt;
          }
        } else if (e.state === "ascend") {
          e.y -= e.ascendSpeed * dt;
          var carriedC = findCivilian(e.carryId);
          if (carriedC) {
            carriedC.x = e.x + 8;
            carriedC.y = e.y + e.h;
          }
          if (e.y < -30) {
            if (carriedC) {
              spawnMutant(clamp(e.x, 40, W - 40), 60);
              metrics.losses += 1;
              rescueStreak = 0;
              var cii;
              for (cii = 0; cii < civilians.length; cii++) {
                if (civilians[cii].id === carriedC.id) {
                  civilians.splice(cii, 1);
                  break;
                }
              }
            }
            enemies.splice(i, 1);
            continue;
          }
        }
      } else if (e.type === "spore_hulk") {
        var hx = player.x - e.x;
        var hy = player.y - e.y;
        var hl = Math.sqrt(hx * hx + hy * hy) || 1;
        e.x += (hx / hl) * e.speed * dt;
        e.y += (hy / hl) * e.speed * 0.6 * dt;
      } else if (e.type === "phaser") {
        e.blink -= dt;
        if (e.blink <= 0) {
          e.x = clamp(player.x + rand(-100, 100), 40, W - 40);
          e.y = clamp(player.y + rand(-60, 60), 40, GROUND_Y - 40);
          e.blink = rand(0.9, 1.6);
        } else {
          var px = player.x - e.x;
          var py = player.y - e.y;
          var pl = Math.sqrt(px * px + py * py) || 1;
          e.x += (px / pl) * e.speed * 0.35 * dt;
          e.y += (py / pl) * e.speed * 0.35 * dt;
        }
      } else if (e.type === "blinker") {
        e.blink -= dt;
        if (e.blink <= 0) {
          e.x = clamp(e.x + rand(-140, 140), 40, W - 40);
          e.y = clamp(e.y + rand(-100, 100), 40, GROUND_Y - 40);
          e.blink = rand(0.5, 1.0);
        }
      } else if (e.type === "void_stalker") {
        e.home += dt;
        if (e.home < 1.2) {
          e.x += (player.x < e.x ? -1 : 1) * 40 * dt;
        } else {
          var vx = player.x - e.x;
          var vy = player.y - e.y;
          var vl = Math.sqrt(vx * vx + vy * vy) || 1;
          e.x += (vx / vl) * e.speed * dt;
          e.y += (vy / vl) * e.speed * dt;
        }
      }

      if (
        player.dodgeTimer <= 0 &&
        aabb(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)
      ) {
        damagePlayer(1);
      }
    }
  }

  function updateHazards(dt) {
    var i;
    for (i = hazards.length - 1; i >= 0; i--) {
      var h = hazards[i];
      h.life -= dt;
      h.dmgCooldown -= dt;
      if (h.life <= 0) {
        if (h.drop) {
          spawnRandomPickup(h.x + h.w * 0.5, h.y);
        }
        hazards.splice(i, 1);
        continue;
      }

      // Gravity wells pull unless stabilized
      if (h.type === "well" && player.dodgeTimer <= 0 && !hasDef("gravity_stabilizer")) {
        var cx = h.x + h.w * 0.5;
        var cy = h.y + h.h * 0.5;
        var dx = cx - (player.x + player.w * 0.5);
        var dy = cy - (player.y + player.h * 0.5);
        var dl = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dl < 160) {
          player.x += (dx / dl) * 140 * dt;
          player.y += (dy / dl) * 140 * dt;
        }
      }

      var immune = hasDef("hazard_immunity");
      if (
        !immune &&
        h.dmgCooldown <= 0 &&
        player.dodgeTimer <= 0 &&
        aabb(player.x, player.y, player.w, player.h, h.x, h.y, h.w, h.h)
      ) {
        damagePlayer(1);
        h.dmgCooldown = h.type === "spore" ? 0.7 : 0.55;
      }
      if (Math.random() < 0.06) {
        var col = "#ff6622";
        if (h.type === "puddle") {
          col = "#66ddff";
        } else if (h.type === "laser") {
          col = "#88e0ff";
        } else if (h.type === "spore") {
          col = "#66cc66";
        } else if (h.type === "well" || h.type === "steam") {
          col = h.type === "well" ? "#8866cc" : "#ddeeff";
        } else if (h.type === "flame_jet") {
          col = "#ff8844";
        }
        spawnParticle(h.x + rand(0, h.w), h.y + rand(0, h.h * 0.5), col, 0.25);
      }
    }
  }

  function updateBullets(dt) {
    var i;
    var j;
    for (i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      if (b.homing) {
        var best = null;
        var bestD = 1e12;
        var ei;
        for (ei = 0; ei < enemies.length; ei++) {
          if (enemies[ei].hp <= 0) {
            continue;
          }
          var ed = dist2(b.x, b.y, enemies[ei].x, enemies[ei].y);
          if (ed < bestD) {
            bestD = ed;
            best = enemies[ei];
          }
        }
        if (boss && zonePhase === "boss") {
          var bd = dist2(b.x, b.y, boss.x + boss.w * 0.5, boss.y + boss.h * 0.5);
          if (bd < bestD) {
            bestD = bd;
            best = { x: boss.x + boss.w * 0.5, y: boss.y + boss.h * 0.5, w: 1, h: 1 };
          }
        }
        if (best) {
          var hx = best.x + best.w * 0.5 - b.x;
          var hy = best.y + best.h * 0.5 - b.y;
          var hl = Math.sqrt(hx * hx + hy * hy) || 1;
          b.vx += (hx / hl) * 520 * dt;
          b.vy += (hy / hl) * 520 * dt;
          var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
          b.vx = (b.vx / sp) * 360;
          b.vy = (b.vy / sp) * 360;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -30 || b.x > W + 30 || b.y < -20 || b.y > H + 20) {
        bullets.splice(i, 1);
        continue;
      }
      var hit = false;
      for (j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (e.hp <= 0) {
          continue;
        }
        if (aabb(b.x - 4, b.y - 2, 8, 4, e.x, e.y, e.w, e.h)) {
          e.hp -= b.dmg;
          hit = true;
          if (b.arc) {
            var ak;
            for (ak = 0; ak < enemies.length; ak++) {
              var ae = enemies[ak];
              if (ae === e || ae.hp <= 0) {
                continue;
              }
              if (dist2(e.x, e.y, ae.x, ae.y) < 120 * 120) {
                ae.hp -= 1;
                spawnParticle(ae.x, ae.y, "#aaffff", 0.3);
                break;
              }
            }
          }
          if (b.aoe) {
            var jj;
            for (jj = 0; jj < enemies.length; jj++) {
              var o = enemies[jj];
              if (o.hp <= 0 || o.id === e.id) {
                continue;
              }
              if (dist2(b.x, b.y, o.x + o.w * 0.5, o.y + o.h * 0.5) < b.aoe * b.aoe) {
                o.hp -= 1;
                if (o.hp <= 0) {
                  killEnemy(o, true);
                }
              }
            }
            spawnBurst(b.x, b.y, "#cc88ff", 10, "spark");
          }
          if (e.hp <= 0) {
            killEnemy(e, true);
          } else {
            spawnBurst(b.x, b.y, "#ffe080", 4, "spark");
          }
          if (b.pierce && b.pierce > 0) {
            b.pierce -= 1;
            hit = false;
          } else {
            bullets.splice(i, 1);
          }
          break;
        }
      }
      if (hit || i >= bullets.length) {
        continue;
      }
      if (boss && zonePhase === "boss" && aabb(b.x - 4, b.y - 2, 8, 4, boss.x, boss.y, boss.w, boss.h)) {
        damageBoss(b.dmg + (b.aoe ? 1 : 0));
        if (b.aoe) {
          spawnBurst(b.x, b.y, "#cc88ff", 10, "spark");
        } else {
          spawnBurst(b.x, b.y, "#ffe080", 5, "spark");
        }
        if (!(b.pierce && b.pierce > 0)) {
          bullets.splice(i, 1);
        } else {
          b.pierce -= 1;
        }
      }
    }
  }

  function updateParticles(dt) {
    var i;
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === "shard" ? 180 : 40) * dt;
      p.vx *= 0.98;
      if (p.spin) {
        p.rot = (p.rot || 0) + p.spin * dt;
      }
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function updateSpawns(dt) {
    if (zonePhase === "boss" || zonePhase === "breather") {
      // Minimal pressure during boss / breather — no new rushers/hazards
      spawnCivTimer -= dt;
      if (spawnCivTimer <= 0) {
        if (civilians.length < 6) {
          spawnCivilianIsolate();
        }
        spawnCivTimer = rand(5, 8);
      }
      return;
    }

    var m = mode();
    var sm = m.spawnMult * (0.75 + D * 0.7);
    var pm = m.pickupMult * (1.3 - D * 0.6);

    spawnCivTimer -= dt;
    spawnGrabTimer -= dt * sm;
    spawnHazardTimer -= dt * (0.8 + D * 0.5);
    spawnRusherTimer -= dt * sm;
    spawnPickupTimer -= dt * pm;

    var zm = zoneMeta();
    var civCap = zm.civMax || 8;
    if (spawnCivTimer <= 0) {
      if (civilians.length < civCap) {
        if (Math.random() < 0.45) {
          spawnCivilianCluster(rand(80, W - 80));
        } else {
          spawnCivilianIsolate();
        }
      }
      spawnCivTimer = zm.civFlavor === "scarce" || zm.civFlavor === "silent" ? rand(6, 10) : rand(4, 7);
    }
    if (spawnGrabTimer <= 0) {
      var grabs = enemies.filter(function (e) {
        return e.type === "grabber" || e.type === "corruptor";
      }).length;
      if (grabs < 2 + (D > 0.6 ? 1 : 0)) {
        if (zoneVisual() === "spore" && Math.random() < 0.5) {
          spawnCorruptor();
        } else if (zoneVisual() !== "null") {
          spawnGrabber();
        }
      }
      spawnGrabTimer = rand(3.5, 6);
    }
    if (spawnRusherTimer <= 0) {
      spawnZoneEnemy();
      spawnRusherTimer = rand(2.0, 4.0);
    }
    if (spawnHazardTimer <= 0) {
      if (hazards.length + telegraphs.length < 3) {
        spawnZoneHazard();
      }
      spawnHazardTimer = rand(4.5, 7.5);
    }
    if (spawnPickupTimer <= 0) {
      if (pickups.length < 3) {
        spawnRandomPickup(rand(80, W - 80), rand(60, GROUND_Y - 80));
      }
      spawnPickupTimer = rand(7, 12);
    }
  }

  function updateZones(dt) {
    if (zonePhase === "breather") {
      breatherTimer -= dt;
      if (breatherTimer <= 0) {
        enterZone(zoneIndex + 1);
        spawnCivilianIsolate();
      }
      return;
    }

    if (zonePhase === "boss") {
      return;
    }

    // combat
    zoneTimer += dt;
    if (zoneTimer >= ZONE_DURATION && !boss) {
      spawnBoss();
    }
  }

  function updatePlayer(dt) {
    if (player.invuln > 0) {
      player.invuln -= dt;
    }
    if (player.fireCooldown > 0) {
      player.fireCooldown -= dt;
    }
    if (player.muzzle > 0) {
      player.muzzle -= dt;
    }

    var rechargeRate = hasDef("dodge_recharge") ? 1.8 : 1;
    if (player.dodgeCharges < player.dodgeMax) {
      if (player.dodgeRecharge > 0) {
        player.dodgeRecharge -= dt * rechargeRate;
        if (player.dodgeRecharge <= 0) {
          player.dodgeCharges += 1;
          if (player.dodgeCharges < player.dodgeMax) {
            player.dodgeRecharge = DODGE_RECHARGE;
          }
        }
      }
    }

    if (player.dodgeTimer > 0) {
      player.dodgeTimer -= dt;
      var spd = SHIP_SPEED * DODGE_SPEED_MULT;
      player.x += player.dodgeDx * spd * dt;
      player.y += player.dodgeDy * spd * dt;
    } else {
      var ax = 0;
      var ay = 0;
      if (keys.ArrowLeft || keys.a || keys.A) {
        ax -= 1;
      }
      if (keys.ArrowRight || keys.d || keys.D) {
        ax += 1;
      }
      if (keys.ArrowUp || keys.w || keys.W) {
        ay -= 1;
      }
      if (keys.ArrowDown || keys.s || keys.S) {
        ay += 1;
      }
      if (ax !== 0 && ay !== 0) {
        var inv = 1 / Math.sqrt(2);
        ax *= inv;
        ay *= inv;
      }
      player.x += ax * SHIP_SPEED * dt;
      player.y += ay * SHIP_SPEED * dt;
      if (ax !== 0) {
        player.facing = ax > 0 ? 1 : -1;
      }
      if (wantFire()) {
        tryFire();
      }
    }

    player.x = clamp(player.x, 8, W - player.w - 8);
    player.y = clamp(player.y, 8, GROUND_Y - player.h - 4);
  }

  function updatePlaying(dt) {
    scrollX += 90 * dt;
    var i;
    for (i = 0; i < starsFar.length; i++) {
      starsFar[i].x -= 28 * dt;
      if (starsFar[i].x < 0) {
        starsFar[i].x += W;
        starsFar[i].y = rand(0, H * 0.75);
      }
    }
    for (i = 0; i < starsNear.length; i++) {
      starsNear[i].x -= 70 * dt;
      if (starsNear[i].x < 0) {
        starsNear[i].x += W;
        starsNear[i].y = rand(0, H * 0.75);
      }
    }

    updatePlayer(dt);
    updateTelegraphs(dt);
    updateSpawns(dt);
    updateZones(dt);
    updateBoss(dt);
    updateCivilians(dt);
    updateEnemies(dt);
    updateHazards(dt);
    updateBullets(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateDifficulty(dt);
    updateHud();
  }

  function draw() {
    var i;
    R.beginFrame(scrollX, zoneVisual());
    R.drawStars(starsFar, starsNear);
    R.drawGround(GROUND_Y);
    if (phase === PHASE_PLAYING) {
      for (i = 0; i < telegraphs.length; i++) {
        R.drawTelegraph(telegraphs[i], telePhase(telegraphs[i].age));
      }
      for (i = 0; i < hazards.length; i++) {
        R.drawHazard(hazards[i]);
      }
      for (i = 0; i < pickups.length; i++) {
        R.drawPickup(pickups[i]);
      }
      for (i = 0; i < civilians.length; i++) {
        if (civilians[i].state !== "rescued") {
          R.drawCivilian(civilians[i]);
        }
      }
      for (i = 0; i < enemies.length; i++) {
        R.drawEnemy(enemies[i]);
      }
      if (boss) {
        R.drawBoss(boss);
      }
      for (i = 0; i < bullets.length; i++) {
        R.drawBullet(bullets[i]);
      }
      R.drawShip(player);
      if (player.muzzle > 0 && R.drawMuzzle) {
        R.drawMuzzle(player.muzzleX, player.muzzleY, player.facing, player.muzzle);
      }
      for (i = 0; i < particles.length; i++) {
        R.drawParticle(particles[i]);
      }
    } else {
      R.drawShip(player);
    }
    R.endFrame();
  }

  function fixedUpdate(dt) {
    if (phase === PHASE_PLAYING) {
      updatePlaying(dt);
    }
  }

  function frame(ts) {
    if (!running) {
      return;
    }
    if (!lastTs) {
      lastTs = ts;
    }
    var frameDt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    accum += frameDt;
    while (accum >= TICK) {
      fixedUpdate(TICK);
      accum -= TICK;
    }
    draw();
    requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running) {
      return;
    }
    running = true;
    lastTs = 0;
    accum = 0;
    requestAnimationFrame(frame);
  }

  function startGame() {
    try {
      if (window.DefenderAudio) {
        DefenderAudio.unlock();
      }
      showMessages([]);
      resetRun();
      phase = PHASE_PLAYING;
      hideOverlay();
      btnQuit.classList.remove("hidden");
      setStartScreenExtras(false);
      setOverlayButtons(false, false);
      canvas.style.pointerEvents = "auto";
      startLoop();
      draw();
    } catch (err) {
      if (typeof console !== "undefined" && console.error) {
        console.error("Defender startGame failed:", err);
      }
      alert("Start failed: " + (err && err.message ? err.message : err));
    }
  }

  window.DefenderStart = startGame;
  window.DefenderDebug = {
    spawnBoss: spawnBoss,
    enterZone: enterZone,
    skipToBoss: function () {
      zoneTimer = ZONE_DURATION;
      spawnBoss();
    },
    getBoss: function () {
      return boss;
    },
    getPhase: function () {
      return zonePhase;
    },
    getZone: function () {
      return { index: zoneIndex, name: zoneName, visual: zoneVisual() };
    },
  };

  function endRun(fromQuit) {
    if (phase !== PHASE_PLAYING) {
      return;
    }
    var finalScore = score;
    var m = mode();
    var earnedUnlocks = [];
    if (window.DefenderMeta) {
      earnedUnlocks = DefenderMeta.applyRun(
        DefenderMeta.get(),
        {
          score: finalScore,
          zoneIndex: zoneIndex,
          rescues: player.rescues,
          bosses: bossesDefeated,
        },
        !!m.submit
      );
      DefenderMeta.set(DefenderMeta.get());
      DefenderMeta.saveToCloud().catch(function () {});
    }
    phase = PHASE_OVER;
    btnQuit.classList.add("hidden");
    canvas.style.pointerEvents = "none";
    setStartScreenExtras(true);
    setOverlayButtons(true, true);
    var summary =
      m.label +
      " · Score " +
      finalScore +
      " · Zone " +
      zoneIndex +
      " · Rescues " +
      player.rescues +
      " · Bosses " +
      bossesDefeated;
    if (window.DefenderMeta) {
      var meta = DefenderMeta.get();
      summary += " · Best " + meta.best_score + " / Z" + meta.best_zone;
    }
    showOverlay(fromQuit ? "RUN ENDED" : "SHIP DESTROYED", summary);
    instructionsEl.textContent =
      "WASD/arrows · Space/Z fire · Shift/X dodge · carry 1 civilian · set down low to rescue.";
    endHintEl.textContent = fromQuit
      ? ""
      : "Survive ~40s then fight the zone boss. Drops appear instantly — fly into them.";
    var msgs = [];
    if (earnedUnlocks.length && window.DefenderMeta) {
      msgs.push("Unlocked: " + DefenderMeta.unlockLabels(earnedUnlocks).join(", "));
    }
    if (!m.submit && finalScore > 0) {
      msgs.push("Casual mode — score not submitted; cosmetics progress saved locally.");
    }
    showMessages(msgs);
    SLArcade.endSession();
    if (finalScore > 0 && m.submit) {
      SLArcade.submitScore(finalScore)
        .then(function (result) {
          if (result && result.pendingMoapReport) {
            return;
          }
          var more = (result && result.messages) || [];
          if (earnedUnlocks.length && window.DefenderMeta) {
            more = ["Unlocked: " + DefenderMeta.unlockLabels(earnedUnlocks).join(", ")].concat(more);
          }
          showMessages(more);
          return refreshScores();
        })
        .catch(function () {});
    } else {
      refreshScores();
    }
    draw();
  }

  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (
      e.key === " " ||
      e.key === "Spacebar" ||
      e.key === "Shift" ||
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight"
    ) {
      e.preventDefault();
    }
    if ((e.key === "Shift" || e.key === "x" || e.key === "X") && phase === PHASE_PLAYING) {
      tryDodge();
    }
    if (e.key === "Escape") {
      if (phase === PHASE_PLAYING) {
        endRun(true);
      } else if (!leaderboardModal.classList.contains("hidden")) {
        closeLeaderboardModal();
      }
    }
    if (e.key === "Enter" && (phase === PHASE_MENU || phase === PHASE_OVER)) {
      if (!overlay.classList.contains("hidden")) {
        startGame();
      }
    }
  });

  window.addEventListener("keyup", function (e) {
    keys[e.key] = false;
  });

  window.addEventListener("blur", function () {
    keys = {};
    mouseDown = false;
  });

  canvas.addEventListener("mousedown", function (e) {
    if (phase === PHASE_PLAYING) {
      mouseDown = true;
      e.preventDefault();
    }
  });
  window.addEventListener("mouseup", function () {
    mouseDown = false;
  });

  btnStart.addEventListener("click", function (e) {
    e.preventDefault();
    startGame();
  });
  btnStart.addEventListener("touchend", function (e) {
    e.preventDefault();
    startGame();
  });
  btnNext.addEventListener("click", function (e) {
    e.preventDefault();
    startGame();
  });
  btnQuit.addEventListener("click", function () {
    endRun(true);
  });

  btnLeaderboard.addEventListener("click", function () {
    if (lastLeaderboardData) {
      renderLeaderboard(lastLeaderboardData);
    }
    openLeaderboardModal();
    refreshScores();
  });
  btnModalClose.addEventListener("click", closeLeaderboardModal);

  if (modeSelect) {
    modeSelect.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-mode")) {
        selectMode(t.getAttribute("data-mode"));
      }
    });
  }

  // Boot
  var lowFx = false;
  try {
    lowFx = localStorage.getItem("defender_fx") === "low";
  } catch (e) {}

  function syncMuteUI() {
    var btn = document.getElementById("btn-mute");
    if (!btn || !window.DefenderAudio) {
      return;
    }
    var on = !DefenderAudio.isMuted();
    btn.textContent = on ? "SOUND ON" : "SOUND OFF";
    if (on) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  function applyFx(low) {
    lowFx = !!low;
    try {
      localStorage.setItem("defender_fx", lowFx ? "low" : "full");
    } catch (e2) {}
    if (R && R.setFxIntensity) {
      R.setFxIntensity(lowFx ? 0.35 : 1);
    }
    var btn = document.getElementById("btn-fx");
    if (btn) {
      btn.textContent = lowFx ? "FX LOW" : "FX FULL";
      if (lowFx) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  }

  var btnMute = document.getElementById("btn-mute");
  if (btnMute) {
    btnMute.addEventListener("click", function () {
      if (!window.DefenderAudio) {
        return;
      }
      DefenderAudio.setMuted(!DefenderAudio.isMuted());
      syncMuteUI();
      sfx("ui");
    });
  }
  var btnFx = document.getElementById("btn-fx");
  if (btnFx) {
    btnFx.addEventListener("click", function () {
      applyFx(!lowFx);
      sfx("ui");
    });
  }
  syncMuteUI();
  applyFx(lowFx);

  syncModeUI();
  instructionsEl.textContent =
    "WASD/arrows · Space/Z fire · Shift/X dodge · carry 1 civilian · set down low to rescue.";
  seedStars();
  player.x = W * 0.2;
  player.y = H * 0.45;
  setOverlayButtons(true, false);
  setStartScreenExtras(true);
  showOverlay("SL DEFENDER", "Rescue under pressure · Seven zones · Infinite run");
  updatePlayerLine();
  updateHud();
  draw();
  refreshScores();
  if (window.DefenderMeta) {
    DefenderMeta.loadFromCloud().then(function (meta) {
      var line = "Best " + meta.best_score + " · Zone " + meta.best_zone + " · Rescues " + meta.total_rescues;
      if (meta.unlocks && meta.unlocks.length) {
        line += " · Unlocks " + meta.unlocks.length;
      }
      endHintEl.textContent = line;
    });
  }
  startLoop();
})();
