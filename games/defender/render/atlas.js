/**
 * Defender atlas
 * - Ships: OpenGameArt "Space Ships (side scroller)" — true side profiles
 * - FX / pickups / bg: Kenney Space Shooter Redux (CC0)
 */
(function (global) {
  "use strict";

  var BASE = "assets/sprites/";
  var atlas = {};
  var ready = false;
  var readyPromise = null;

  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    return { c: c, g: g };
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      img.src = BASE + src;
    });
  }

  function flipH(src) {
    var m = makeCanvas(src.width, src.height);
    m.g.translate(src.width, 0);
    m.g.scale(-1, 1);
    m.g.drawImage(src, 0, 0);
    return m.c;
  }

  function copyImg(img) {
    var m = makeCanvas(img.width, img.height);
    m.g.drawImage(img, 0, 0);
    return m.c;
  }

  /**
   * Side-ship PNGs ship with solid black backdrop — key it out and tight-crop.
   */
  function sideShip(img) {
    var m = makeCanvas(img.width, img.height);
    m.g.drawImage(img, 0, 0);
    var data = m.g.getImageData(0, 0, m.c.width, m.c.height);
    var px = data.data;
    var i;
    var minX = m.c.width;
    var minY = m.c.height;
    var maxX = 0;
    var maxY = 0;
    for (i = 0; i < px.length; i += 4) {
      var r = px[i];
      var g = px[i + 1];
      var b = px[i + 2];
      if (r < 12 && g < 12 && b < 12) {
        px[i + 3] = 0;
      } else {
        var x = (i / 4) % m.c.width;
        var y = ((i / 4) / m.c.width) | 0;
        if (x < minX) {
          minX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
    m.g.putImageData(data, 0, 0);
    if (maxX <= minX || maxY <= minY) {
      return m.c;
    }
    var pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(m.c.width - 1, maxX + pad);
    maxY = Math.min(m.c.height - 1, maxY + pad);
    var cw = maxX - minX + 1;
    var ch = maxY - minY + 1;
    var cropped = makeCanvas(cw, ch);
    cropped.g.drawImage(m.c, minX, minY, cw, ch, 0, 0, cw, ch);
    return cropped.c;
  }

  /** Tapered bolt — reads as a laser lance, not a rectangle bar. */
  function bakeBoltCanvas(core, tip, w, h) {
    var m = makeCanvas(w, h);
    var g = m.g;
    var cy = h * 0.5;
    g.shadowColor = core;
    g.shadowBlur = 8;
    var grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.2, core);
    grad.addColorStop(0.7, tip);
    grad.addColorStop(1, "#ffffff");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(w - 2, cy);
    g.lineTo(w * 0.55, cy - h * 0.35);
    g.lineTo(4, cy - 1);
    g.lineTo(0, cy);
    g.lineTo(4, cy + 1);
    g.lineTo(w * 0.55, cy + h * 0.35);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(w - 5, cy, Math.max(2, h * 0.22), 0, Math.PI * 2);
    g.fill();
    return m.c;
  }

  /** Civilian: clearer human figure for ground rescues. */
  function bakeCivilian(panic) {
    var m = makeCanvas(48, 72);
    var g = m.g;
    var skin = panic ? "#ffd0a0" : "#f2dcc4";
    var shirt = panic ? "#e06040" : "#3d7ea8";
    var pants = "#2c3340";
    var cx = 24;

    g.fillStyle = "rgba(0,0,0,0.35)";
    g.beginPath();
    g.ellipse(cx, 66, 12, 3.5, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = "#1a1e24";
    g.fillRect(cx - 10, 60, 8, 5);
    g.fillRect(cx + 2, 60, 8, 5);

    g.fillStyle = pants;
    g.fillRect(cx - 8, 42, 6, 20);
    g.fillRect(cx + 2, 42, 6, 20);

    var tg = g.createLinearGradient(cx - 10, 22, cx + 10, 44);
    tg.addColorStop(0, shirt);
    tg.addColorStop(1, panic ? "#902818" : "#245070");
    g.fillStyle = tg;
    g.beginPath();
    g.moveTo(cx - 10, 24);
    g.lineTo(cx + 10, 24);
    g.lineTo(cx + 9, 44);
    g.lineTo(cx - 9, 44);
    g.closePath();
    g.fill();

    g.fillStyle = shirt;
    if (panic) {
      g.fillRect(cx - 16, 20, 6, 16);
      g.fillRect(cx + 10, 20, 6, 16);
      g.fillStyle = skin;
      g.beginPath();
      g.arc(cx - 13, 18, 3.5, 0, Math.PI * 2);
      g.arc(cx + 13, 18, 3.5, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(cx - 14, 26, 5, 14);
      g.fillRect(cx + 9, 26, 5, 14);
      g.fillStyle = skin;
      g.beginPath();
      g.arc(cx - 11, 42, 3.2, 0, Math.PI * 2);
      g.arc(cx + 11, 42, 3.2, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = skin;
    g.beginPath();
    g.arc(cx, 16, 9, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 1.5;
    g.stroke();

    g.fillStyle = panic ? "#4a2818" : "#2a2218";
    g.beginPath();
    g.ellipse(cx, 11, 9, 5, 0, Math.PI, 0);
    g.fill();

    g.fillStyle = "#1a1010";
    g.fillRect(cx - 5, 15, 2.5, 2.5);
    g.fillRect(cx + 2.5, 15, 2.5, 2.5);

    if (panic) {
      g.fillStyle = "#ff3355";
      g.beginPath();
      g.arc(cx, 4, 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.font = "bold 8px sans-serif";
      g.textAlign = "center";
      g.fillText("!", cx, 6);
    }
    return m.c;
  }

  function mapFrom(imgs) {
    // True side-profile ships (face right) — no top-down rotate
    atlas.ship = sideShip(imgs.player);
    atlas.shipFlip = flipH(atlas.ship);

    atlas.civilian = bakeCivilian(false);
    atlas.civilianPanic = bakeCivilian(true);

    atlas.grabber = sideShip(imgs.enemyRed);
    atlas.corruptor = sideShip(imgs.enemyGreen);
    atlas.rusher = sideShip(imgs.enemyOrange);
    atlas.lunger = sideShip(imgs.enemyOrange2);
    atlas.burner = sideShip(imgs.enemyRed2);
    atlas.swimmer = sideShip(imgs.enemyBlue);
    atlas.slicer = sideShip(imgs.enemyBlue2);
    atlas.prism = sideShip(imgs.enemyBlue);
    atlas.mirror = sideShip(imgs.enemyBlue2);
    atlas.mutant = sideShip(imgs.enemyGreen2);
    atlas.mutator = sideShip(imgs.enemyGreen);
    atlas.hulk = sideShip(imgs.enemyPurple);
    atlas.voidling = sideShip(imgs.enemyPurple2);

    atlas.breaker = sideShip(imgs.boss);
    atlas.tide = sideShip(imgs.enemyBlue2);
    atlas.pyre = sideShip(imgs.enemyRed2);
    atlas.shard = copyImg(imgs.meteorGrey);
    atlas.bloom = sideShip(imgs.enemyGreen2);
    atlas.silence = sideShip(imgs.enemyPurple);
    atlas.apex = sideShip(imgs.boss2);

    atlas.bullet = bakeBoltCanvas("#7cf0ff", "#ffffff", 48, 14);
    atlas.bulletBeam = bakeBoltCanvas("#66ccff", "#e8ffff", 64, 12);
    atlas.bulletPlasma = bakeBoltCanvas("#cc88ff", "#ffffff", 40, 18);
    atlas.bulletMissile = bakeBoltCanvas("#ff8844", "#ffe0a0", 44, 14);

    atlas.pickOff = copyImg(imgs.powerBolt);
    atlas.pickDef = copyImg(imgs.powerShield);

    atlas.muzzle = copyImg(imgs.fire0);
    atlas.impact = copyImg(imgs.star);
    atlas.spark = copyImg(imgs.speed);
    atlas.fire0 = copyImg(imgs.fire0);
    atlas.fire1 = copyImg(imgs.fire1);
    atlas.fire2 = copyImg(imgs.fire2);
    atlas.fire3 = copyImg(imgs.fire3);
    atlas.shieldFx = copyImg(imgs.shieldFx);
    atlas.meteor = copyImg(imgs.meteorBrown);
    atlas.laserBeam = copyImg(imgs.laserBlueBeam);
    atlas.bg = copyImg(imgs.bg);

    ready = true;
    return atlas;
  }

  function load() {
    if (readyPromise) {
      return readyPromise;
    }
    var names = {
      player: "side/player.png",
      enemyRed: "side/enemy_red.png",
      enemyRed2: "side/enemy_red2.png",
      enemyBlue: "side/enemy_blue.png",
      enemyBlue2: "side/enemy_blue2.png",
      enemyOrange: "side/enemy_orange.png",
      enemyOrange2: "side/enemy_orange2.png",
      enemyGreen: "side/enemy_green.png",
      enemyGreen2: "side/enemy_green2.png",
      enemyPurple: "side/enemy_purple.png",
      enemyPurple2: "side/enemy_purple2.png",
      boss: "side/boss.png",
      boss2: "side/boss2.png",
      powerBolt: "powerupRed_bolt.png",
      powerShield: "powerupBlue_shield.png",
      fire0: "fire00.png",
      fire1: "fire06.png",
      fire2: "fire12.png",
      fire3: "fire15.png",
      star: "star1.png",
      speed: "speed.png",
      shieldFx: "shield1.png",
      meteorBrown: "meteorBrown_big1.png",
      meteorGrey: "meteorGrey_big1.png",
      laserBlueBeam: "laserBlue08.png",
      bg: "bg_darkPurple.png",
    };
    var keys = Object.keys(names);
    readyPromise = Promise.all(
      keys.map(function (k) {
        return loadImage(names[k]).then(function (img) {
          return { k: k, img: img };
        });
      })
    ).then(function (list) {
      var imgs = {};
      var i;
      for (i = 0; i < list.length; i++) {
        imgs[list[i].k] = list[i].img;
      }
      return mapFrom(imgs);
    });
    return readyPromise;
  }

  function init() {
    load();
    return atlas;
  }

  global.DefenderAtlas = {
    init: init,
    load: load,
    isReady: function () {
      return ready;
    },
    get atlas() {
      return atlas;
    },
  };

  load().catch(function (err) {
    console.error("[DefenderAtlas]", err);
  });
})(typeof window !== "undefined" ? window : this);
