/**
 * Defender — meta progression (local cache + Experience KV via sl-api)
 * Wire format: v1|bestScore|bestZone|totalRescues|unlocksComma|flags|lastPlayed
 * Never blocks the simulation loop.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "defender_meta_v1";
  var FLAG_TUTORIAL = 1;
  var FLAG_HARD = 2;

  var UNLOCK_DEFS = {
    tier2: { label: "Start gun T2" },
    tier3: { label: "Start gun T3" },
    hp_plus: { label: "+1 max HP" },
    dodge3: { label: "Dodge charges ×3" },
    calm_start: { label: "Calm start" },
  };

  function defaultMeta() {
    return {
      schema_version: "v1",
      best_score: 0,
      best_zone: 0,
      total_rescues: 0,
      unlocks: [],
      flags: { tutorial_complete: false, hard_mode_unlocked: false },
      last_played: 0,
    };
  }

  function flagsToInt(flags) {
    var n = 0;
    if (flags && flags.tutorial_complete) {
      n |= FLAG_TUTORIAL;
    }
    if (flags && flags.hard_mode_unlocked) {
      n |= FLAG_HARD;
    }
    return n;
  }

  function flagsFromInt(n) {
    n = n | 0;
    return {
      tutorial_complete: !!(n & FLAG_TUTORIAL),
      hard_mode_unlocked: !!(n & FLAG_HARD),
    };
  }

  function encodeWire(m) {
    var unlocks = (m.unlocks || []).join(",");
    return [
      "v1",
      m.best_score | 0,
      m.best_zone | 0,
      m.total_rescues | 0,
      unlocks,
      flagsToInt(m.flags),
      m.last_played | 0,
    ].join("|");
  }

  function decodeWire(raw) {
    var m = defaultMeta();
    if (!raw || typeof raw !== "string") {
      return m;
    }
    var p = raw.split("|");
    if (p.length < 6 || p[0] !== "v1") {
      return m;
    }
    m.best_score = parseInt(p[1], 10) || 0;
    m.best_zone = parseInt(p[2], 10) || 0;
    m.total_rescues = parseInt(p[3], 10) || 0;
    m.unlocks = p[4] ? p[4].split(",").filter(Boolean) : [];
    m.flags = flagsFromInt(parseInt(p[5], 10) || 0);
    m.last_played = parseInt(p[6], 10) || 0;
    return m;
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return defaultMeta();
      }
      if (raw.charAt(0) === "{") {
        var j = JSON.parse(raw);
        var m = defaultMeta();
        m.best_score = j.best_score | 0;
        m.best_zone = j.best_zone | 0;
        m.total_rescues = j.total_rescues | 0;
        m.unlocks = Array.isArray(j.unlocks) ? j.unlocks.slice() : [];
        if (j.flags) {
          m.flags.tutorial_complete = !!j.flags.tutorial_complete;
          m.flags.hard_mode_unlocked = !!j.flags.hard_mode_unlocked;
        }
        m.last_played = j.last_played | 0;
        return m;
      }
      return decodeWire(raw);
    } catch (e) {
      return defaultMeta();
    }
  }

  function writeLocal(m) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
    } catch (e) {}
  }

  function hasUnlock(m, id) {
    return m.unlocks.indexOf(id) >= 0;
  }

  function addUnlock(m, id, earned) {
    if (!UNLOCK_DEFS[id] || hasUnlock(m, id)) {
      return;
    }
    m.unlocks.push(id);
    if (earned) {
      earned.push(id);
    }
  }

  /**
   * Milestone unlocks from a finished run.
   * power=true grants combat unlocks; false (Casual) only cosmetics/flags.
   */
  function applyRun(m, run, power) {
    var earned = [];
    if (run.score > m.best_score) {
      m.best_score = run.score | 0;
    }
    if (run.zoneIndex > m.best_zone) {
      m.best_zone = run.zoneIndex | 0;
    }
    m.total_rescues += run.rescues | 0;
    m.last_played = (Date.now() / 1000) | 0;
    m.flags.tutorial_complete = true;

    if (m.best_zone >= 3 || m.best_score >= 15000) {
      m.flags.hard_mode_unlocked = true;
    }

    if (power) {
      if (m.best_zone >= 2 || m.best_score >= 8000) {
        addUnlock(m, "tier2", earned);
      }
      if (m.best_zone >= 4 || m.best_score >= 25000) {
        addUnlock(m, "tier3", earned);
      }
      if (m.best_zone >= 3 || m.total_rescues >= 40) {
        addUnlock(m, "hp_plus", earned);
      }
      if (m.best_zone >= 5 || m.best_score >= 40000) {
        addUnlock(m, "dodge3", earned);
      }
      if (m.best_zone >= 6) {
        addUnlock(m, "calm_start", earned);
      }
    }

    return earned;
  }

  /** Bonuses applied at run start (Arcade/Hardcore only for power). */
  function startBonuses(m, power) {
    var b = { tier: 1, maxHpBonus: 0, dodgeMax: 2, calmStart: false };
    if (!power) {
      return b;
    }
    if (hasUnlock(m, "tier3")) {
      b.tier = 3;
    } else if (hasUnlock(m, "tier2")) {
      b.tier = 2;
    }
    if (hasUnlock(m, "hp_plus")) {
      b.maxHpBonus = 1;
    }
    if (hasUnlock(m, "dodge3")) {
      b.dodgeMax = 3;
    }
    if (hasUnlock(m, "calm_start")) {
      b.calmStart = true;
    }
    return b;
  }

  function unlockLabels(ids) {
    return (ids || [])
      .map(function (id) {
        return UNLOCK_DEFS[id] ? UNLOCK_DEFS[id].label : id;
      })
      .filter(Boolean);
  }

  var cache = readLocal();

  function get() {
    return cache;
  }

  function set(m) {
    cache = m;
    writeLocal(m);
  }

  function mergeRemote(wire) {
    if (!wire) {
      return cache;
    }
    var remote = decodeWire(wire);
    // Keep the stronger of local vs remote for each field
    if (remote.best_score > cache.best_score) {
      cache.best_score = remote.best_score;
    }
    if (remote.best_zone > cache.best_zone) {
      cache.best_zone = remote.best_zone;
    }
    if (remote.total_rescues > cache.total_rescues) {
      cache.total_rescues = remote.total_rescues;
    }
    var i;
    for (i = 0; i < remote.unlocks.length; i++) {
      if (!hasUnlock(cache, remote.unlocks[i])) {
        cache.unlocks.push(remote.unlocks[i]);
      }
    }
    if (remote.flags.tutorial_complete) {
      cache.flags.tutorial_complete = true;
    }
    if (remote.flags.hard_mode_unlocked) {
      cache.flags.hard_mode_unlocked = true;
    }
    if (remote.last_played > cache.last_played) {
      cache.last_played = remote.last_played;
    }
    writeLocal(cache);
    return cache;
  }

  function loadFromCloud() {
    if (!global.SLArcade || !SLArcade.loadMeta) {
      return Promise.resolve(cache);
    }
    return SLArcade.loadMeta()
      .then(function (data) {
        if (data && data.ok && data.meta) {
          mergeRemote(data.meta);
        }
        return cache;
      })
      .catch(function () {
        return cache;
      });
  }

  function saveToCloud() {
    writeLocal(cache);
    if (!global.SLArcade || !SLArcade.persistMeta) {
      return Promise.resolve({ ok: true, saved: false });
    }
    var wire = encodeWire(cache);
    return SLArcade.persistMeta(wire)
      .then(function (data) {
        return data || { ok: true, saved: false };
      })
      .catch(function () {
        return { ok: false, saved: false };
      });
  }

  global.DefenderMeta = {
    defaultMeta: defaultMeta,
    encodeWire: encodeWire,
    decodeWire: decodeWire,
    get: get,
    set: set,
    applyRun: applyRun,
    startBonuses: startBonuses,
    unlockLabels: unlockLabels,
    hasUnlock: hasUnlock,
    loadFromCloud: loadFromCloud,
    saveToCloud: saveToCloud,
    UNLOCK_DEFS: UNLOCK_DEFS,
  };
})(typeof window !== "undefined" ? window : this);
