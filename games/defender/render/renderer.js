/**
 * Defender — modern stylized scene renderer
 * Full-res 960×540 + high-res baked atlas blits + multi-layer parallax.
 * World X → screen X via camera (camX) and wraparound map width (mapW).
 */
(function (global) {
  "use strict";

  var VIEW_W = 960;
  var VIEW_H = 540;
  /** Viewport aliases (kept for callers that expect WORLD_*). */
  var WORLD_W = VIEW_W;
  var WORLD_H = VIEW_H;

  var canvas = null;
  var ctx = null;
  var atlas = null;
  var camX = 0;
  var mapW = VIEW_W;
  var zoneVisual = "breach";
  var fxIntensity = 1;
  var farHills = [];
  var midSil = [];
  var nearProps = [];
  var hazeMotes = [];

  var ZONE_SKY = {
    breach: ["#060914", "#16101c", "#2c1810"],
    flooded: ["#040c16", "#0a2034", "#0c3a52"],
    furnace: ["#120606", "#28100a", "#3e1608"],
    glass: ["#060c18", "#0e2034", "#163848"],
    spore: ["#041008", "#0e241c", "#163a2c"],
    null: ["#03030a", "#0a071c", "#12082c"],
    apex: ["#0e0606", "#1c0e0c", "#2c1a14"],
  };

  var ZONE_GROUND = {
    breach: { fill: "#18110c", rim: "#5a3824", haze: "rgba(255,90,40,0.1)", mid: "rgba(40,20,12,0.55)" },
    flooded: { fill: "#082430", rim: "#1a7088", haze: "rgba(40,180,220,0.12)", mid: "rgba(8,40,56,0.55)" },
    furnace: { fill: "#220e06", rim: "#9a4820", haze: "rgba(255,100,30,0.14)", mid: "rgba(50,16,8,0.55)" },
    glass: { fill: "#0e1620", rim: "#48a0c0", haze: "rgba(120,220,255,0.1)", mid: "rgba(16,36,52,0.5)" },
    spore: { fill: "#0e1c16", rim: "#389858", haze: "rgba(80,220,120,0.12)", mid: "rgba(12,40,28,0.55)" },
    null: { fill: "#080614", rim: "#6040b0", haze: "rgba(120,60,220,0.12)", mid: "rgba(16,8,36,0.55)" },
    apex: { fill: "#1c1208", rim: "#b08038", haze: "rgba(255,200,80,0.12)", mid: "rgba(40,24,12,0.55)" },
  };

  function setMapWidth(w) {
    mapW = Math.max(1, w || VIEW_W);
  }

  function wrapMap(x) {
    var r = x % mapW;
    if (r < 0) {
      r += mapW;
    }
    return r;
  }

  /** World X → screen X relative to camera left edge (wrapped into [0, mapW)). */
  function relX(wx) {
    return wrapMap(wx - camX);
  }

  /**
   * Call fn(screenX) for each wrap copy of world-space span [wx, wx+ww]
   * that intersects the viewport.
   */
  function forVisibleX(wx, ww, fn) {
    var base = relX(wx);
    var copies = [base - mapW, base, base + mapW];
    var i;
    var sx;
    var span = ww || 0;
    for (i = 0; i < copies.length; i++) {
      sx = copies[i];
      if (sx + span > 0 && sx < VIEW_W) {
        fn(sx);
      }
    }
  }

  function seedParallax() {
    farHills = [];
    midSil = [];
    nearProps = [];
    hazeMotes = [];
    var i;
    for (i = 0; i < 16; i++) {
      farHills.push({
        x: i * 85 + Math.random() * 35,
        h: 50 + Math.random() * 90,
        w: 70 + Math.random() * 100,
      });
    }
    for (i = 0; i < 12; i++) {
      midSil.push({
        x: i * 110 + Math.random() * 40,
        h: 30 + Math.random() * 70,
        w: 28 + Math.random() * 50,
        windows: Math.random() > 0.45,
      });
    }
    for (i = 0; i < 10; i++) {
      nearProps.push({
        x: i * 130 + Math.random() * 50,
        kind: (Math.random() * 2) | 0,
        h: 16 + Math.random() * 28,
      });
    }
    for (i = 0; i < 24; i++) {
      hazeMotes.push({
        x: Math.random() * VIEW_W,
        y: 80 + Math.random() * 280,
        r: 1 + Math.random() * 2.5,
        a: 0.08 + Math.random() * 0.18,
        spd: 0.2 + Math.random() * 0.5,
      });
    }
  }

  function init(displayCanvas) {
    canvas = displayCanvas;
    ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    if (global.DefenderAtlas) {
      atlas = global.DefenderAtlas.init();
      if (global.DefenderAtlas.load) {
        global.DefenderAtlas.load().then(function (a) {
          atlas = a;
        });
      }
    }
    seedParallax();
    return {
      worldW: WORLD_W,
      worldH: WORLD_H,
      mode: "canvas2d-kenney",
    };
  }

  function setFxIntensity(v) {
    fxIntensity = Math.max(0, Math.min(1.5, v));
  }

  function softGlow(color, blur) {
    if (fxIntensity < 0.12) {
      ctx.shadowBlur = 0;
      return;
    }
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * fxIntensity;
  }

  function clearGlow() {
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  function blit(img, x, y, w, h, flip) {
    if (!img) {
      return;
    }
    if (flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
  }

  /** Draw sprite centered, preserving aspect (no pancake stretch). */
  function blitFit(img, cx, cy, maxW, maxH, flip) {
    if (!img) {
      return;
    }
    var iw = img.width || 1;
    var ih = img.height || 1;
    var scale = Math.min(maxW / iw, maxH / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    blit(img, cx - dw * 0.5, cy - dh * 0.5, dw, dh, flip);
  }

  /**
   * @param {number} cameraX world X of the left edge of the view (not a free-running timer)
   * @param {string} visual zone palette key
   */
  function beginFrame(cameraX, visual) {
    camX = cameraX || 0;
    zoneVisual = visual || "breach";
    var pal = ZONE_SKY[zoneVisual] || ZONE_SKY.breach;
    var zg = ZONE_GROUND[zoneVisual] || ZONE_GROUND.breach;

    // Kenney starfield background (tiled), then zone tint — parallax from camX
    if (atlas && atlas.bg) {
      var bw = atlas.bg.width;
      var bh = atlas.bg.height;
      var ox = -((camX * 0.15) % bw);
      var oy = 0;
      var tx;
      for (tx = ox - bw; tx < VIEW_W + bw; tx += bw) {
        ctx.drawImage(atlas.bg, tx, oy, bw, VIEW_H);
      }
      ctx.fillStyle = zg.haze;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, pal[0]);
      g.addColorStop(0.5, pal[1]);
      g.addColorStop(1, pal[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = zg.haze;
      ctx.fillRect(0, VIEW_H * 0.28, VIEW_W, VIEW_H * 0.35);
    }

    // Layer 1 — far hills
    var shiftFar = (camX * 0.12) % 1000;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    var i;
    for (i = 0; i < farHills.length; i++) {
      var h = farHills[i];
      var hx = ((h.x - shiftFar) % 1200 + 1200) % 1200 - 100;
      ctx.beginPath();
      ctx.moveTo(hx, VIEW_H * 0.58);
      ctx.bezierCurveTo(hx + h.w * 0.3, VIEW_H * 0.58 - h.h, hx + h.w * 0.7, VIEW_H * 0.58 - h.h * 0.7, hx + h.w, VIEW_H * 0.58);
      ctx.lineTo(hx + h.w, VIEW_H);
      ctx.lineTo(hx, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }

    // Layer 2 — mid silhouettes (structures)
    var shiftMid = (camX * 0.32) % 900;
    for (i = 0; i < midSil.length; i++) {
      var s = midSil[i];
      var sx2 = ((s.x - shiftMid) % 1100 + 1100) % 1100 - 60;
      var top = VIEW_H * 0.58 - s.h;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(sx2, top, s.w, s.h + VIEW_H * 0.42);
      if (s.windows) {
        ctx.fillStyle = zoneVisual === "furnace" ? "rgba(255,160,60,0.4)" : "rgba(180,220,255,0.22)";
        var wy;
        for (wy = top + 8; wy < top + s.h - 6; wy += 10) {
          ctx.fillRect(sx2 + 4, wy, 3, 3);
          ctx.fillRect(sx2 + s.w * 0.45, wy, 3, 3);
          if (s.w > 36) {
            ctx.fillRect(sx2 + s.w - 10, wy, 3, 3);
          }
        }
      }
    }

    // Layer 3 — floating haze motes
    var moteShift = camX * 0.08;
    for (i = 0; i < hazeMotes.length; i++) {
      var m = hazeMotes[i];
      var mx = ((m.x - moteShift * m.spd) % VIEW_W + VIEW_W) % VIEW_W;
      ctx.globalAlpha = m.a;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(mx, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(far, near) {
    // Kenney background already has a starfield
    if (atlas && atlas.bg) {
      return;
    }
    var i;
    ctx.fillStyle = "rgba(170,195,230,0.4)";
    for (i = 0; i < far.length; i++) {
      ctx.fillRect(far[i].x, far[i].y, Math.max(1, far[i].s), Math.max(1, far[i].s));
    }
    for (i = 0; i < near.length; i++) {
      softGlow("rgba(180,210,255,0.55)", 5);
      ctx.fillStyle = "rgba(230,240,255,0.9)";
      ctx.beginPath();
      ctx.arc(near[i].x, near[i].y, Math.max(1.3, near[i].s * 0.75), 0, Math.PI * 2);
      ctx.fill();
    }
    clearGlow();
  }

  function drawGround(groundY) {
    var zg = ZONE_GROUND[zoneVisual] || ZONE_GROUND.breach;
    var scrollX = camX;

    // Layer 4 — near props at 1:1 with camera
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    var i;
    for (i = 0; i < nearProps.length; i++) {
      var p = nearProps[i];
      var px = ((p.x - scrollX) % 1000 + 1000) % 1000 - 40;
      var py = groundY - p.h + 6;
      if (p.kind === 0) {
        ctx.fillRect(px, py, 10, p.h);
      } else {
        // Rock / debris hunk — never a pyramid triangle
        if (atlas && atlas.meteor) {
          blit(atlas.meteor, px, groundY - 14, 18, 14, false);
        } else {
          ctx.fillRect(px, groundY - 8, 16, 8);
        }
      }
    }

    ctx.fillStyle = zg.fill;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    var x;
    for (x = 0; x <= VIEW_W; x += 12) {
      var worldX = camX + x;
      var n = Math.sin(worldX * 0.011) * 12 + Math.sin(worldX * 0.029) * 7;
      ctx.lineTo(x, groundY + n * 0.2);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();

    // Crest rim
    ctx.strokeStyle = zg.rim;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (x = 0; x <= VIEW_W; x += 12) {
      var worldX2 = camX + x;
      var n2 = Math.sin(worldX2 * 0.011) * 12 + Math.sin(worldX2 * 0.029) * 7;
      if (x === 0) {
        ctx.moveTo(x, groundY + n2 * 0.2);
      } else {
        ctx.lineTo(x, groundY + n2 * 0.2);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Flooded reflection strip
    if (zoneVisual === "flooded") {
      ctx.fillStyle = "rgba(80,200,255,0.08)";
      ctx.fillRect(0, groundY + 8, VIEW_W, 18);
    }
  }

  function drawShip(player) {
    if (player.invuln > 0 && ((player.invuln * 20) | 0) % 2 === 0) {
      return;
    }
    var img = atlas ? (player.facing < 0 ? atlas.shipFlip : atlas.ship) : null;
    var cy = player.y + player.h * 0.5;
    var drawW = Math.max(player.w, 96);

    forVisibleX(player.x, drawW, function (sx) {
      var cx = sx + player.w * 0.5;

      if (player.dodgeTimer > 0 && img) {
        ctx.globalAlpha = 0.3;
        blitFit(img, cx - player.dodgeDx * 16, cy - player.dodgeDy * 10, 70, 70, false);
        ctx.globalAlpha = 0.55;
        blitFit(img, cx - player.dodgeDx * 8, cy - player.dodgeDy * 5, 70, 70, false);
        ctx.globalAlpha = 1;
      }

      if (img) {
        // Side profiles are wide — favor horizontal fit box
        blitFit(img, cx, cy, 96, 48, false);
      }

      if (player.shieldHits > 0 && atlas && atlas.shieldFx) {
        blitFit(atlas.shieldFx, cx, cy, 90, 90, false);
      } else if (player.shieldHits > 0) {
        ctx.strokeStyle = "rgba(170,210,255,0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 36, 36, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  function drawCivilian(c) {
    if (!atlas) {
      return;
    }
    var img = c.panic > 0 || c.state === "falling" ? atlas.civilianPanic : atlas.civilian;
    var cy = c.y + c.h * 0.5;

    forVisibleX(c.x, c.w, function (sx) {
      var cx = sx + c.w * 0.5;
      if (c.state === "player_carry") {
        // Tether cable in screen space after X conversion
        ctx.strokeStyle = "rgba(200,220,240,0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, c.y - 2);
        ctx.lineTo(cx, c.y - 14);
        ctx.stroke();
      }
      blitFit(img, cx, cy, 28, 40, false);
    });
  }

  function enemyImg(e) {
    if (!atlas) {
      return null;
    }
    if (e.type === "grabber") {
      return atlas.grabber;
    }
    if (e.type === "corruptor") {
      return atlas.corruptor;
    }
    if (e.type === "mutant") {
      return atlas.mutant;
    }
    if (e.type === "mutator") {
      return atlas.mutator;
    }
    if (e.type === "swimmer") {
      return atlas.swimmer;
    }
    if (e.type === "slicer") {
      return atlas.slicer;
    }
    if (e.type === "prism_dancer") {
      return atlas.prism;
    }
    if (e.type === "mirror_clone") {
      return atlas.mirror;
    }
    if (e.type === "spore_hulk") {
      return atlas.hulk;
    }
    if (e.type === "phaser" || e.type === "blinker" || e.type === "void_stalker") {
      return atlas.voidling;
    }
    if (e.type === "burner" || e.type === "heat_runner" || e.type === "steam_striker") {
      return atlas.burner;
    }
    if (e.type === "lunger") {
      return atlas.lunger;
    }
    return atlas.rusher;
  }

  function drawEnemy(e) {
    var img = enemyImg(e);
    var flip = (e.vx != null ? e.vx : 0) < 0;
    var sizeW = Math.max(e.w, 56) + 36;
    var sizeH = Math.max(e.h, 28) + 20;
    var cy = e.y + e.h * 0.5;

    forVisibleX(e.x, Math.max(e.w, sizeW), function (sx) {
      if (e.type === "blinker") {
        ctx.globalAlpha = 0.65;
      }
      if (img) {
        blitFit(img, sx + e.w * 0.5, cy, sizeW, sizeH, flip);
      }
      ctx.globalAlpha = 1;
    });
  }

  function bossImg(boss) {
    if (!atlas) {
      return null;
    }
    if (boss.type === "tide_maw") {
      return atlas.tide;
    }
    if (boss.type === "pyre_warden") {
      return atlas.pyre;
    }
    if (boss.type === "spectral_shard") {
      return atlas.shard;
    }
    if (boss.type === "bloom_titan") {
      return atlas.bloom;
    }
    if (boss.type === "the_silence") {
      return atlas.silence;
    }
    if (boss.type === "apex_entity") {
      return atlas.apex;
    }
    return atlas.breaker;
  }

  function drawBoss(boss) {
    if (!boss) {
      return;
    }
    var img = bossImg(boss);
    var sizeW = Math.max(boss.w, 100) + 40;
    var sizeH = Math.max(boss.h, 50) + 24;
    var cy = boss.y + boss.h * 0.5;
    var pct = boss.hp / boss.maxHp;

    forVisibleX(boss.x, Math.max(boss.w, sizeW), function (sx) {
      if (boss.flash > 0) {
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(boss.flash * 40);
      }
      if (img) {
        blitFit(img, sx + boss.w * 0.5, cy, sizeW, sizeH, false);
      }
      ctx.globalAlpha = 1;

      var barW = boss.w;
      ctx.fillStyle = "rgba(20,10,10,0.8)";
      ctx.fillRect(sx, boss.y - 16, barW, 7);
      var hg = ctx.createLinearGradient(sx, 0, sx + barW, 0);
      hg.addColorStop(0, "#ff4455");
      hg.addColorStop(1, "#ffcc66");
      ctx.fillStyle = hg;
      ctx.fillRect(sx, boss.y - 16, barW * pct, 7);
    });
  }

  function drawBullet(b) {
    var ang = Math.atan2(b.vy || 0, b.vx || 1);
    var img = atlas ? atlas.bullet : null;
    // Keep bolts compact — oversized lasers read as "rectangles"
    var bw = 28;
    var bh = 10;

    if (b.beam) {
      img = atlas ? atlas.bulletBeam : null;
      bw = 40;
      bh = 10;
    } else if (b.aoe) {
      img = atlas ? atlas.bulletPlasma : null;
      bw = 30;
      bh = 12;
    } else if (b.homing) {
      img = atlas ? atlas.bulletMissile : null;
      bw = 28;
      bh = 10;
    }

    forVisibleX(b.x - bw * 0.5, bw, function (sx) {
      var screenX = sx + bw * 0.5;
      ctx.save();
      ctx.translate(screenX, b.y);
      ctx.rotate(ang);
      if (img) {
        blit(img, -bw * 0.2, -bh * 0.5, bw, bh, false);
      } else {
        ctx.fillStyle = "#7cf0ff";
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-8, -2.5);
        ctx.lineTo(-8, 2.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawMuzzle(x, y, facing, life) {
    if (!atlas || !atlas.muzzle || life <= 0) {
      return;
    }
    var a = Math.max(0, Math.min(1, life * 14));
    forVisibleX(x - 14, 28, function (sx) {
      var screenX = sx + 14;
      ctx.save();
      ctx.globalAlpha = a;
      // Fire sprite is tall (16x40) — keep aspect, place at nose
      blitFit(atlas.muzzle, screenX + facing * 10, y, 28, 40, facing < 0);
      ctx.restore();
    });
  }

  function drawParticle(p) {
    var life = Math.max(0, Math.min(1, p.life / (p.maxLife || 0.35)));
    var sizeHint = Math.max(12, (p.size || 1) * 28);

    forVisibleX(p.x - sizeHint * 0.5, sizeHint, function (sx) {
      var screenX = sx + sizeHint * 0.5;
      ctx.save();
      ctx.globalAlpha = life;
      ctx.translate(screenX, p.y);
      if (p.rot) {
        ctx.rotate(p.rot);
      }

      if (p.kind === "impact" && atlas && atlas.impact) {
        var s = (p.size || 1) * 28 * (0.55 + 0.45 * (1 - life));
        blit(atlas.impact, -s * 0.5, -s * 0.5, s, s, false);
      } else if ((p.kind === "spark" || p.kind === "streak") && atlas && atlas.fire0) {
        var fw = (p.size || 1) * 18;
        blit(atlas.fire0, -fw * 0.5, -fw * 0.5, fw, fw, false);
      } else if (p.kind === "shard" && atlas && atlas.spark) {
        var sw = (p.size || 1) * 16;
        blit(atlas.spark, -sw * 0.5, -sw * 0.5, sw, sw, false);
      } else if (atlas && atlas.impact) {
        var ss = (p.size || 1) * 12;
        blit(atlas.impact, -ss * 0.5, -ss * 0.5, ss, ss, false);
      } else {
        ctx.fillStyle = p.color || "#ff8844";
        ctx.beginPath();
        ctx.arc(0, 0, 2 * (p.size || 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawPickup(p) {
    if (!atlas) {
      return;
    }
    var near = p.decay < 3;
    var pulse = 0.78 + 0.22 * Math.sin(p.pulse * (near ? 10 : 4));
    var img = p.family === "offensive" ? atlas.pickOff : atlas.pickDef;
    var cy = p.y + p.h * 0.5;

    forVisibleX(p.x, Math.max(p.w, 36), function (sx) {
      ctx.globalAlpha = pulse;
      blitFit(img, sx + p.w * 0.5, cy, 36, 36, false);
      ctx.globalAlpha = 1;
    });
  }

  /** Clamp a screen-space rect to the visible viewport; returns null if fully off. */
  function clampVisibleSpan(sx, w) {
    var x = sx;
    var dw = w;
    if (x < 0) {
      dw += x;
      x = 0;
    }
    if (x + dw > VIEW_W) {
      dw = VIEW_W - x;
    }
    if (dw <= 0) {
      return null;
    }
    return { x: x, w: dw };
  }

  function drawTelegraph(t, phase) {
    // WARNING placard — never a filled damage circle/rectangle that looks like an attack
    var ox = t.x;
    var y = t.y;
    var w = Math.abs(t.w);
    var h = t.h;
    if (t.w < 0) {
      ox = t.x + t.w;
    }
    var alpha = phase.alpha * 0.9;
    var col = phase.color || "#ffcc44";

    forVisibleX(ox, w, function (sx) {
      var span = clampVisibleSpan(sx, w);
      if (!span) {
        return;
      }
      var x = span.x;
      var dw = span.w;
      var cx = x + dw * 0.5;
      var cy = y + h * 0.5;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Outline only (dashed) — no filled "attack" shape
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      if (t.shape === "circle") {
        ctx.beginPath();
        ctx.ellipse(cx, cy, dw * 0.5, h * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, dw, h);
      }
      ctx.setLineDash([]);

      // Corner ticks so it reads as a marker, not a projectile
      ctx.lineWidth = 2.5;
      var tick = 8;
      ctx.beginPath();
      ctx.moveTo(x, y + tick);
      ctx.lineTo(x, y);
      ctx.lineTo(x + tick, y);
      ctx.moveTo(x + dw - tick, y);
      ctx.lineTo(x + dw, y);
      ctx.lineTo(x + dw, y + tick);
      ctx.moveTo(x + dw, y + h - tick);
      ctx.lineTo(x + dw, y + h);
      ctx.lineTo(x + dw - tick, y + h);
      ctx.moveTo(x + tick, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + h - tick);
      ctx.stroke();

      // Warning diamond placard in center
      var s = Math.min(22, Math.min(dw, h) * 0.35);
      ctx.fillStyle = "rgba(20,8,0,0.75)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = "bold 13px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", cx, cy + 1);
      ctx.restore();
    });
  }

  function fireFrame(seed) {
    if (!atlas) {
      return null;
    }
    var frames = [atlas.fire0, atlas.fire1, atlas.fire2, atlas.fire3];
    var idx = ((camX * 0.25 + (seed || 0)) | 0) % 4;
    if (idx < 0) {
      idx += 4;
    }
    return frames[idx] || atlas.fire0;
  }

  function drawHazard(h) {
    var y = h.y;
    var w = h.w;
    var hh = h.h;

    forVisibleX(h.x, w, function (sx) {
      var span = w > VIEW_W ? clampVisibleSpan(sx, w) : { x: sx, w: w };
      if (!span) {
        return;
      }
      var x = span.x;
      var dw = span.w;

      if (h.type === "fire" || h.type === "flame_jet") {
        // Stack natural-aspect fire sprites — never stretch into a rectangle
        var img = fireFrame(h.id || 0);
        if (img) {
          var size = Math.min(36, Math.max(22, dw));
          var cols = Math.max(1, Math.round(dw / (size * 0.7)));
          var c;
          for (c = 0; c < cols; c++) {
            var fx = x + (c + 0.5) * (dw / cols) - size * 0.5;
            var fy = y + hh - size;
            blit(img, fx, fy, size, size, false);
          }
        }
        return;
      }

      if (h.type === "laser") {
        // Thin laser line using bolt sprite tiled — not a fat glowing bar
        if (atlas && atlas.bullet) {
          var lx = x;
          while (lx < x + dw) {
            blit(atlas.bulletBeam || atlas.bullet, lx, y + hh * 0.35, 32, Math.max(6, hh * 0.3), false);
            lx += 28;
          }
        }
        return;
      }

      if (h.type === "steam") {
        ctx.globalAlpha = 0.5;
        if (atlas && atlas.shieldFx) {
          blit(atlas.shieldFx, x, y, dw, hh, false);
        }
        ctx.globalAlpha = 1;
        return;
      }

      if (h.type === "puddle") {
        ctx.fillStyle = "rgba(60,180,220,0.28)";
        ctx.beginPath();
        ctx.ellipse(x + dw * 0.5, y + hh * 0.8, dw * 0.48, hh * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(180,240,255,0.75)";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (atlas && atlas.impact) {
          blit(atlas.impact, x + dw * 0.5 - 8, y + hh * 0.55, 16, 16, false);
        }
        return;
      }

      if (h.type === "spore") {
        if (atlas && atlas.impact) {
          blit(atlas.impact, x, y, dw, hh, false);
        }
        return;
      }

      if (h.type === "well") {
        if (atlas && atlas.shieldFx) {
          blit(atlas.shieldFx, x - 4, y - 4, dw + 8, hh + 8, false);
        }
        return;
      }

      if (atlas && atlas.meteor) {
        blit(atlas.meteor, x, y, dw, hh, false);
      }
    });
  }

  function endFrame() {}

  global.DefenderRender = {
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    init: init,
    setMapWidth: setMapWidth,
    setFxIntensity: setFxIntensity,
    beginFrame: beginFrame,
    drawStars: drawStars,
    drawGround: drawGround,
    drawShip: drawShip,
    drawCivilian: drawCivilian,
    drawEnemy: drawEnemy,
    drawBoss: drawBoss,
    drawBullet: drawBullet,
    drawMuzzle: drawMuzzle,
    drawPickup: drawPickup,
    drawParticle: drawParticle,
    drawTelegraph: drawTelegraph,
    drawHazard: drawHazard,
    endFrame: endFrame,
  };
})(typeof window !== "undefined" ? window : this);
