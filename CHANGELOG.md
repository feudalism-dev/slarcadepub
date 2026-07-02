# Changelog

## 1.0.0 — 2026-07-02

First complete release (**SL Invaders** + arcade platform).

### Platform
- MOAP arcade on GitHub Pages with JSONP ↔ LSL HTTP-IN API
- Two-script LSL split: `Arcade_Controller` (MOAP/session) + `Arcade_Scores` (Experience KV)
- Per-game score namespaces (`<gameId>_top10`, `<gameId>_personal_<uuid>`)
- HUD and cabinet modes; score save without HTTP-IN via MOAP URL reporting

### SL Invaders
- Procedural original pixel sprites (not Taito Space Invaders art)
- Lives, death pause with CONTINUE + 30s timeout, resume same wave/score/speed
- Bonus lives at 2,000 / 5,000 / 10,000 points
- Leaderboard on START screen + modal; personal best and high score
- Level progression with increasing invader speed
