/**
 * Defender — lightweight WebAudio SFX stubs (no asset files; MOAP-friendly)
 * Mute via DefenderAudio.setMuted / localStorage defender_mute.
 */
(function (global) {
  "use strict";

  var muted = false;
  var ctx = null;
  var master = null;

  try {
    muted = localStorage.getItem("defender_mute") === "1";
  } catch (e) {}

  function ensure() {
    if (muted) {
      return null;
    }
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) {
        return null;
      }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function beep(freq, dur, type, vol, slide) {
    var c = ensure();
    if (!c || !master) {
      return;
    }
    var t0 = c.currentTime;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol) {
    var c = ensure();
    if (!c || !master) {
      return;
    }
    var n = Math.max(1, (c.sampleRate * dur) | 0);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    for (i = 0; i < n; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    var src = c.createBufferSource();
    var g = c.createGain();
    src.buffer = buf;
    g.gain.value = vol || 0.12;
    src.connect(g);
    g.connect(master);
    src.start();
  }

  function setMuted(v) {
    muted = !!v;
    try {
      localStorage.setItem("defender_mute", muted ? "1" : "0");
    } catch (e) {}
    if (muted && ctx && ctx.state === "running") {
      ctx.suspend().catch(function () {});
    } else if (!muted) {
      ensure();
    }
  }

  function isMuted() {
    return muted;
  }

  function play(id) {
    if (muted) {
      return;
    }
    if (id === "fire") {
      beep(660, 0.05, "square", 0.12, 420);
    } else if (id === "hit") {
      noiseBurst(0.08, 0.14);
      beep(180, 0.1, "sawtooth", 0.1, 80);
    } else if (id === "rescue") {
      beep(520, 0.08, "triangle", 0.14);
      beep(780, 0.1, "triangle", 0.12);
    } else if (id === "pickup") {
      beep(440, 0.06, "square", 0.12, 880);
    } else if (id === "dodge") {
      beep(240, 0.07, "sine", 0.1, 120);
    } else if (id === "damage") {
      beep(140, 0.16, "sawtooth", 0.16, 60);
    } else if (id === "boss") {
      beep(90, 0.25, "sawtooth", 0.18, 55);
      noiseBurst(0.2, 0.1);
    } else if (id === "boss_die") {
      beep(200, 0.35, "triangle", 0.16, 60);
      beep(320, 0.4, "sine", 0.1, 40);
    } else if (id === "tele") {
      beep(300, 0.04, "sine", 0.06);
    } else if (id === "ui") {
      beep(500, 0.04, "square", 0.08);
    }
  }

  global.DefenderAudio = {
    play: play,
    setMuted: setMuted,
    isMuted: isMuted,
    unlock: ensure,
  };
})(typeof window !== "undefined" ? window : this);
