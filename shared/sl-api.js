/**
 * SL Arcade — JSONP client for LSL HTTP-IN (MOAP / CEF 139)
 * Shared by every game under games/<id>/.
 */
(function (global) {
  "use strict";

  var SCORES_UNAVAILABLE_MSG =
    "Scores unavailable. High scores require a free HTTP-IN URL on this parcel (cabinet owner: check URL quota) and the Debauchery RPG experience allowed on this parcel/region. The game is fully playable without these, but you cannot save or view scores.";

  var session = {
    game: "",
    token: "",
    scores: false,
    name: "",
    avatar: "",
  };
  var apiBase = "";
  var urlSeedPersonal = -1;
  var urlSeedHigh = -1;
  var hudMode = false;

  function parseSeedInt(raw) {
    if (raw === "" || raw === undefined || raw === null) {
      return -1;
    }
    var n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) {
      return -1;
    }
    return n;
  }

  function leaderboardFromUrlSeed() {
    var entries = [];
    if (urlSeedHigh > 0) {
      entries.push({
        rank: 1,
        score: urlSeedHigh,
        name: "—",
        avatar: "",
      });
    }
    return {
      ok: true,
      scoresEnabled: true,
      personalScore: urlSeedPersonal > 0 ? urlSeedPersonal : 0,
      entries: entries,
      unavailableMessage: "",
    };
  }

  function validCallbackName(name) {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  function nextCallback() {
    return "slcb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
  }

  function jsonp(apiUrl, params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var cb = nextCallback();
      if (!validCallbackName(cb)) {
        reject(new Error("callback"));
        return;
      }

      var qs = "callback=" + encodeURIComponent(cb);
      var key;
      for (key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          if (params[key] === undefined || params[key] === null || params[key] === "") {
            continue;
          }
          qs +=
            "&" +
            encodeURIComponent(key) +
            "=" +
            encodeURIComponent(String(params[key]));
        }
      }

      var sep = apiUrl.indexOf("?") >= 0 ? "&" : "?";
      var url = apiUrl + sep + qs;
      var script = document.createElement("script");
      var timer = null;
      var done = false;

      function finish(err, data) {
        if (done) {
          return;
        }
        done = true;
        if (timer) {
          clearTimeout(timer);
        }
        delete global[cb];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      }

      global[cb] = function (data) {
        finish(null, data);
      };

      script.onerror = function () {
        finish(new Error("jsonp_failed"));
      };

      if (timeoutMs) {
        timer = setTimeout(function () {
          finish(new Error("timeout"));
        }, timeoutMs);
      }

      script.src = url;
      document.head.appendChild(script);
    });
  }

  function setSession(next) {
    session = {
      game: next.game || "",
      token: next.token || "",
      scores: !!next.scores,
      name: next.name || "",
      avatar: next.avatar || "",
    };
  }

  function setApiBase(url) {
    apiBase = url || "";
    if (apiBase && apiBase.charAt(apiBase.length - 1) !== "/") {
      apiBase += "/";
    }
  }

  function getSession() {
    return session;
  }

  function getApiBase() {
    return apiBase;
  }

  function apiParams(extra) {
    var p = { game: session.game };
    var key;
    for (key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) {
        p[key] = extra[key];
      }
    }
    return p;
  }

  function readQueryParam(name) {
    var search = global.location.search;
    if (!search || search.length < 2) {
      return "";
    }
    var key = name + "=";
    var parts = search.substring(1).split("&");
    var i;
    for (i = 0; i < parts.length; i++) {
      if (parts[i].indexOf(key) === 0) {
        return decodeURIComponent(parts[i].substring(key.length).replace(/\+/g, " "));
      }
    }
    return "";
  }

  function initFromMoapUrl() {
    var cap = readQueryParam("sl_cap");
    var game = readQueryParam("sl_game");
    var token = readQueryParam("sl_token");
    if (!cap && !game && !token) {
      return false;
    }
    if (cap) {
      setApiBase(cap);
    }
    setSession({
      game: game,
      token: token,
      scores: readQueryParam("sl_scores") === "1",
      name: readQueryParam("sl_name"),
      avatar: readQueryParam("sl_avatar"),
    });
    urlSeedPersonal = parseSeedInt(readQueryParam("sl_personal"));
    urlSeedHigh = parseSeedInt(readQueryParam("sl_high"));
    hudMode = readQueryParam("sl_hud") === "1";
    return true;
  }

  function isHudMode() {
    return hudMode;
  }

  function canEndSession() {
    return !!(apiBase && session.token);
  }

  function listenForSession() {
    global.addEventListener("message", function (ev) {
      if (!ev.data || ev.data.type !== "sl-session") {
        return;
      }
      if (ev.data.session) {
        setSession(ev.data.session);
      }
      if (ev.data.api) {
        setApiBase(ev.data.api);
      }
    });
  }

  function getLeaderboard() {
    if (!apiBase) {
      if (session.scores) {
        return Promise.resolve(leaderboardFromUrlSeed());
      }
      return Promise.resolve({
        ok: true,
        scoresEnabled: false,
        personalScore: 0,
        entries: [],
        unavailableMessage: SCORES_UNAVAILABLE_MSG,
      });
    }
    return jsonp(apiBase, apiParams({ action: "leaderboard" }), 20000);
  }

  function submitScore(score) {
    if (!apiBase) {
      if (session.scores) {
        return Promise.resolve({
          ok: true,
          saved: false,
          scoresEnabled: true,
          messages: [],
          unavailableMessage: "",
        });
      }
      return Promise.resolve({
        ok: true,
        saved: false,
        scoresEnabled: false,
        messages: [],
        unavailableMessage: SCORES_UNAVAILABLE_MSG,
      });
    }
    return jsonp(
      apiBase,
      apiParams({
        action: "submit",
        token: session.token,
        score: score,
      }),
      25000
    );
  }

  function endSession() {
    if (!apiBase || !session.token) {
      return Promise.resolve({ ok: true, ended: true });
    }
    return jsonp(
      apiBase,
      apiParams({
        action: "end",
        token: session.token,
      }),
      10000
    );
  }

  global.SLArcade = {
    SCORES_UNAVAILABLE_MSG: SCORES_UNAVAILABLE_MSG,
    listenForSession: listenForSession,
    setSession: setSession,
    setApiBase: setApiBase,
    getSession: getSession,
    getApiBase: getApiBase,
    isHudMode: isHudMode,
    canEndSession: canEndSession,
    getLeaderboard: getLeaderboard,
    submitScore: submitScore,
    endSession: endSession,
    initFromMoapUrl: initFromMoapUrl,
  };

  initFromMoapUrl();
  listenForSession();
})(typeof window !== "undefined" ? window : globalThis);
