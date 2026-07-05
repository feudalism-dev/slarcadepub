/**
 * SL Wars — clean slate.
 * Cabinet wiring (SLArcade + LSL controller/scores) only.
 * Gameplay will be built from scratch.
 */
(function () {
  "use strict";

  SLArcade.registerGameId("slwars");

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var instructionsEl = document.getElementById("instructions");
  var playerLine = document.getElementById("player-line");
  var btnStart = document.getElementById("btn-start");
  var btnQuit = document.getElementById("btn-quit");
  var btnLeaderboard = document.getElementById("btn-leaderboard");
  var btnModalClose = document.getElementById("btn-modal-close");
  var startScoresEl = document.getElementById("start-scores");
  var personalEl = document.getElementById("personal-score");
  var highScoreEl = document.getElementById("high-score");
  var unavailableEl = document.getElementById("scores-unavailable");
  var leaderboardEl = document.getElementById("leaderboard");
  var leaderboardModal = document.getElementById("leaderboard-modal");
  var endHintEl = document.getElementById("end-hint");

  var W = canvas.width;
  var H = canvas.height;
  var lastLeaderboardData = null;

  function clearScreen() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
  }

  function syncPlayerLine() {
    var s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = "Player: " + s.name;
    }
  }

  function updateStartScores(data) {
    var enabled = !!data.scoresEnabled;
    if (!enabled || !data.personalScore) {
      personalEl.textContent = "Your top score: —";
    } else {
      personalEl.textContent = "Your top score: " + data.personalScore;
    }
    if (!enabled || !data.entries || !data.entries.length) {
      highScoreEl.textContent = "High score: —";
    } else {
      highScoreEl.textContent = "High score: " + data.entries[0].score;
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
    btnLeaderboard.classList.remove("hidden");
  }

  function renderLeaderboardList(entries) {
    leaderboardEl.innerHTML = "";
    var i;
    if (!entries || !entries.length) {
      var empty = document.createElement("li");
      empty.textContent = "No scores yet — be the first!";
      leaderboardEl.appendChild(empty);
      return;
    }
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
  }

  function refreshLeaderboard() {
    return SLArcade.getLeaderboard()
      .then(function (data) {
        lastLeaderboardData = data;
        updateStartScores(data);
        renderLeaderboardList(data.entries || []);
      })
      .catch(function () {
        unavailableEl.textContent = SLArcade.SCORES_UNAVAILABLE_MSG;
        unavailableEl.classList.remove("hidden");
        startScoresEl.classList.add("hidden");
        btnLeaderboard.classList.add("hidden");
      });
  }

  function showMenu() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL WARS";
    instructionsEl.textContent = "Clean slate. Game design pending.";
    endHintEl.textContent = "";
    btnStart.textContent = "START";
    btnStart.disabled = false;
    btnQuit.classList.add("hidden");
    if (lastLeaderboardData) {
      updateStartScores(lastLeaderboardData);
    }
  }

  function onStart() {
    instructionsEl.textContent =
      "No gameplay yet — waiting for the new design. Esc or QUIT returns to menu.";
    overlayTitle.textContent = "STANDBY";
    btnQuit.classList.remove("hidden");
  }

  function onQuit() {
    showMenu();
    SLArcade.endSession().catch(function () {});
  }

  btnStart.addEventListener("click", onStart);
  btnQuit.addEventListener("click", onQuit);
  btnLeaderboard.addEventListener("click", function () {
    if (lastLeaderboardData) {
      renderLeaderboardList(lastLeaderboardData.entries || []);
    }
    leaderboardModal.classList.remove("hidden");
  });
  btnModalClose.addEventListener("click", function () {
    leaderboardModal.classList.add("hidden");
  });
  leaderboardModal.addEventListener("click", function (e) {
    if (e.target === leaderboardModal) {
      leaderboardModal.classList.add("hidden");
    }
  });

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      onQuit();
    }
  });

  window.addEventListener("message", function () {
    syncPlayerLine();
    refreshLeaderboard();
  });

  clearScreen();
  syncPlayerLine();
  refreshLeaderboard();
  showMenu();
})();
