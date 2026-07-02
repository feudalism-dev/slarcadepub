(function () {
  "use strict";

  var listEl = document.getElementById("game-list");
  var subtitle = document.getElementById("hub-subtitle");

  function renderGames(games) {
    listEl.innerHTML = "";
    var available = 0;
    var i;
    for (i = 0; i < games.length; i++) {
      var g = games[i];
      if (g.status && g.status !== "available") {
        continue;
      }
      available++;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = g.url || "games/" + g.id + "/";
      a.innerHTML =
        '<div class="title"></div><div class="desc"></div>';
      a.querySelector(".title").textContent = g.title || g.id;
      a.querySelector(".desc").textContent =
        g.description || "Play " + (g.title || g.id);
      li.appendChild(a);
      listEl.appendChild(li);
    }
    if (subtitle) {
      subtitle.textContent =
        available === 1 ? "1 game available" : available + " games available";
    }
  }

  fetch("games/manifest.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      renderGames(data.games || []);
    })
    .catch(function () {
      if (subtitle) {
        subtitle.textContent = "Could not load game list";
      }
    });
})();
