import { Engine } from "./engine/Engine.js";
import { Renderer } from "./render/Renderer.js";
import { Input } from "./input/Input.js";
import { MenuState } from "./states/MenuState.js";
import { createDogfightState } from "./states/DogfightState.js";

/**
 * Bootstrap: SLArcade cabinet shell + Phase 1 engine.
 */
(function boot() {
  "use strict";

  if (typeof SLArcade !== "undefined" && SLArcade.registerGameId) {
    SLArcade.registerGameId("slwars");
  }

  const canvas = document.getElementById("game");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const instructionsEl = document.getElementById("instructions");
  const playerLine = document.getElementById("player-line");
  const btnStart = document.getElementById("btn-start");
  const btnQuit = document.getElementById("btn-quit");
  const btnLeaderboard = document.getElementById("btn-leaderboard");
  const btnModalClose = document.getElementById("btn-modal-close");
  const startScoresEl = document.getElementById("start-scores");
  const personalEl = document.getElementById("personal-score");
  const highScoreEl = document.getElementById("high-score");
  const unavailableEl = document.getElementById("scores-unavailable");
  const leaderboardEl = document.getElementById("leaderboard");
  const leaderboardModal = document.getElementById("leaderboard-modal");
  const endHintEl = document.getElementById("end-hint");
  const stateLabel = document.getElementById("state-label");

  const engine = new Engine(canvas);
  engine.renderer = new Renderer(engine.ctx, engine.width, engine.height);

  const input = new Input(canvas);
  input.bind();

  engine.registerState("menu", MenuState);
  engine.registerState("dogfight", createDogfightState(input));

  let lastLeaderboardData = null;
  let playing = false;

  function setLabel(text) {
    if (stateLabel) {
      stateLabel.textContent = text;
    }
  }

  function syncPlayerLine() {
    if (typeof SLArcade === "undefined") {
      return;
    }
    const s = SLArcade.getSession();
    if (s.name) {
      playerLine.textContent = `Player: ${s.name}`;
    }
  }

  function updateStartScores(data) {
    const enabled = !!data.scoresEnabled;
    personalEl.textContent =
      !enabled || !data.personalScore
        ? "Your top score: —"
        : `Your top score: ${data.personalScore}`;
    highScoreEl.textContent =
      !enabled || !data.entries || !data.entries.length
        ? "High score: —"
        : `High score: ${data.entries[0].score}`;
    if (!enabled || data.unavailableMessage) {
      unavailableEl.textContent =
        data.unavailableMessage ||
        (SLArcade && SLArcade.SCORES_UNAVAILABLE_MSG) ||
        "Scores unavailable.";
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
    if (!entries || !entries.length) {
      const empty = document.createElement("li");
      empty.textContent = "No scores yet — be the first!";
      leaderboardEl.appendChild(empty);
      return;
    }
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const li = document.createElement("li");
      li.innerHTML = `<span class="rank">${e.rank}.</span><span class="name"></span><span class="score"></span>`;
      li.querySelector(".name").textContent = e.name;
      li.querySelector(".score").textContent = String(e.score);
      leaderboardEl.appendChild(li);
    }
  }

  function refreshLeaderboard() {
    if (typeof SLArcade === "undefined" || !SLArcade.getLeaderboard) {
      return Promise.resolve();
    }
    return SLArcade.getLeaderboard()
      .then((data) => {
        lastLeaderboardData = data;
        updateStartScores(data);
        renderLeaderboardList(data.entries || []);
      })
      .catch(() => {
        unavailableEl.textContent =
          (SLArcade && SLArcade.SCORES_UNAVAILABLE_MSG) ||
          "Scores unavailable.";
        unavailableEl.classList.remove("hidden");
        startScoresEl.classList.add("hidden");
        btnLeaderboard.classList.add("hidden");
      });
  }

  function showMenu() {
    playing = false;
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "SL WARS";
    instructionsEl.textContent =
      "Phase 1 dogfight: mouse banks the ship (world shifts). Starfield rush + TIE attack runs. Esc quits.";
    endHintEl.textContent = "";
    btnStart.textContent = "START DOGFIGHT";
    btnStart.disabled = false;
    btnQuit.classList.add("hidden");
    setLabel("STATE: MENU");
    engine.setState("menu");
    if (lastLeaderboardData) {
      updateStartScores(lastLeaderboardData);
    }
  }

  function startDogfight() {
    playing = true;
    overlay.classList.add("hidden");
    btnQuit.classList.remove("hidden");
    setLabel("STATE: DOGFIGHT");
    engine.setState("dogfight");
  }

  function quitToMenu() {
    if (typeof SLArcade !== "undefined" && SLArcade.endSession) {
      SLArcade.endSession().catch(() => {});
    }
    showMenu();
  }

  btnStart.addEventListener("click", startDogfight);
  btnQuit.addEventListener("click", quitToMenu);
  btnLeaderboard.addEventListener("click", () => {
    if (lastLeaderboardData) {
      renderLeaderboardList(lastLeaderboardData.entries || []);
    }
    leaderboardModal.classList.remove("hidden");
  });
  btnModalClose.addEventListener("click", () => {
    leaderboardModal.classList.add("hidden");
  });
  leaderboardModal.addEventListener("click", (e) => {
    if (e.target === leaderboardModal) {
      leaderboardModal.classList.add("hidden");
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      quitToMenu();
    }
  });

  window.addEventListener("message", () => {
    syncPlayerLine();
    refreshLeaderboard();
  });

  syncPlayerLine();
  refreshLeaderboard();
  showMenu();
  engine.start();
})();
