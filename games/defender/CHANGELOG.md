# SL Defender — Changelog

## v1.7 — True side-view ships

- Replaced Kenney top-down ships (rotated) with OpenGameArt “Space Ships (side scroller)” true side profiles
- Black backdrop keyed out + tight crop; ships face right natively

## v1.6 — Classic Defender carry / rescue

- Carry one civilian at a time (dangles under ship)
- Fly low to deposit = rescue points; fly too high = they fall
- Shoot a grabber → human falls; catch midair or they splat
- +100 grab, +500(+streak) on safe deposit

## v1.5 — Kenney sprite pack (real art)

- Replaced procedural diamonds/boxes/triangles with Kenney Space Shooter Redux (CC0) PNGs
- Real laser bolts (no colored rectangle wakes); fire hazards use flame sprites
- Danger telegraphs are striped WARNING zones with `!` — not filled damage circles/rects
- Credit: Kenney.nl

## v1.4 — Readable entity silhouettes

- Rebuilt ship / enemy / boss / civilian atlas: wings, claws, fins, pincers, mouths — no diamond/box/ellipse placeholders
- Larger on-screen entities; removed soft-glow wash that melted sprites into blobs

## v1.3 — Combat VFX + cockpit HUD

- Energy bolts with oriented lance sprites, motion wakes, muzzle flash, impact sparks/shards
- Particle kinds (spark / shard / streak / impact) replace plain colored dots
- Cockpit-style HUD (segment bars, zone phase tag, buff chips)

## v1.2 — Baked atlas + richer parallax

- High-res anti-aliased sprite atlas baked once at init (`render/atlas.js`)
- Renderer blits shaded ship/enemy/civilian/boss/bullet/pickup canvases
- 4–5 layer zone parallax (far hills, mid structures, haze motes, near props, ground rim)
- Removed unused CRT/pixel sprite modules

## v1.1 — Modern visual overhaul

- Removed low-res pixel atlas + CRT scanline pipeline
- Full-resolution stylized silhouettes (gradients, rim light, soft glow)
- Zone parallax skies/hills + modern glass HUD/overlay (Orbitron + Source Sans)
- FX intensity toggle replaces CRT contrast control

## v1.0 (Phase 6 — ship)

- Pixel-art sprite atlas + WebGL CRT phosphor/scanline post-process (2D fallback)
- Seven-zone infinite palette with bosses, hazards, enemies, and boss drop pairs
- Offensive/defensive pickup catalog + telegraphs + dynamic difficulty
- Meta progression (`defender/v1/<uuid>`) with localStorage degraded mode
- Milestone unlocks (start tier, +HP, dodge×3, calm start)
- WebAudio SFX stubs; mute + CRT contrast accessibility toggles
- Particle/bullet caps for MOAP frame stability

## Platform notes

- Recompile `Arcade_Scores.lsl` + `Arcade_Http.lsl` for `load_meta` / `persist_meta`
- Cabinet `GAME_ID` must be `defender`
- Serve from `pub/` (or GitHub Pages mirror); do not open HTML as `file://`
