# Adding a new arcade game

Each game is a self-contained folder under `games/<id>/` with its own URL:

```
https://feudalism-dev.github.io/slarcadepub/games/<id>/
```

## Games

| ID | Title | LSL scripts |
|----|-------|-------------|
| `invaders` | SL Invaders | `Arcade_Controller.lsl` + `Arcade_Scores.lsl` |
| `galaslian` | GalaSLian | `Galaslian_Controller.lsl` + `Galaslian_Scores.lsl` |
| `missiledefense` | SL Missile Defense | `MissileDefense_Controller.lsl` + `MissileDefense_Scores.lsl` |
| `munchman` | Munchman | `Munchman_Controller.lsl` + `Munchman_Scores.lsl` |

## Checklist

1. **Create** `games/<id>/` with at minimum:
   - `index.html`
   - `game.json` — `{ "id": "<id>", "title": "..." }` (must match folder name and LSL `GAME_ID`)
   - game scripts and styles
   - `<script src="../../shared/sl-api.js"></script>` in `index.html`

2. **Register** the game in `games/manifest.json`:
   ```json
   {
     "id": "mygame",
     "title": "My Game",
     "description": "Short blurb for the hub picker.",
     "url": "games/mygame/",
     "status": "available"
   }
   ```

3. **Experience KV keys** (managed by LSL, per game id):
   - `<id>_top10` — global top 10
   - `<id>_personal_<avatar-uuid>` — personal best

4. **In-world cabinet** — duplicate the MOAP prim and edit the top of `Arcade_Controller.lsl`:
   ```lsl
   string GAME_ID = "mygame";
   string GAME_TITLE = "My Game";
   ```

5. **Use shared API** in your game — register the same id as LSL `GAME_ID` / `game.json`:
   ```javascript
   SLArcade.registerGameId("mygame"); // first line of your game script
   SLArcade.getLeaderboard().then(renderBoard);
   SLArcade.submitScore(finalScore).then(showResults);
   SLArcade.endSession(); // when done
   ```

   Scores are stored per game in Experience KV:
   - `<id>_top10` — that game's global top 10 only
   - `<id>_personal_<avatar-uuid>` — that player's best for that game only

   Invaders and a future pinball game never share the same leaderboard keys.

## Hub picker (later)

Set `GAME_ID = "hub"` on a prim to load `/` (arcade picker). The hub reads `games/manifest.json` and links to each game URL. Per-game cabinets use `GAME_ID = "<id>"` directly.

## Local testing without Second Life

Open a game URL in a desktop browser. Without MOAP bootstrap, `SLArcade` runs in offline mode (no scores). For UI work this is sufficient.
