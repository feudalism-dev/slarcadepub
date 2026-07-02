# slarcadepub

Public web assets for **SL Arcade** — multiple games, one GitHub Pages site.

**Live URL:** https://feudalism-dev.github.io/slarcadepub/

## Games

| URL | Game |
|-----|------|
| `/` | Arcade hub (game picker — use with `GAME_ID = "hub"`) |
| `/games/invaders/` | SL Invaders |

Each game has its own URL today. Duplicate an in-world cabinet prim and set `GAME_ID` in `Arcade_Controller.lsl` to match.

## Repository layout

```
index.html              Hub picker (reads games/manifest.json)
games/
  manifest.json         Catalog of all games
  README.md             How to add a new game
  invaders/             Game: SL Invaders
    index.html
    game.js
    style.css
shared/
  sl-api.js             JSONP client (every game includes this)
  hub.js / hub.css      Hub picker only
```

## MOAP setup (Second Life)

1. Drop `lsl/Arcade_Controller.lsl` into your MOAP prim.
2. Set **`GAME_ID`** and **`GAME_TITLE`** at the top of the script for this cabinet.
3. Compile **Mono**, enable **Use Experience** → **Debauchery RPG**.
4. MOAP whitelist: `https://feudalism-dev.github.io/slarcadepub/*`
5. Touch to play (face **4**). Additional touches ignored while in use.

## Deploying updates

Copy the contents of the local `pub/` folder to this repo's `main` branch root, then push.

## Adding a game

See [games/README.md](games/README.md).

## Private dev repo

LSL sources and docs live in `feudalism-dev/slarcade` (private).
