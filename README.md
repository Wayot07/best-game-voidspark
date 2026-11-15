# VOIDSPARK — Neon Arena

A neon twin-stick arena shooter for make.fun **best-game-01**. Fly a lone ship through
an endless void, chain kills into combos, and survive wave after wave of drifters,
weavers, splitters and dashers.

## How to play

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Fly |
| Mouse | Aim |
| Click / Space | Fire |
| Shift | Dash (brief invulnerability, 2.2 s cooldown) |
| P / Esc | Pause |
| M | Mute |

- **Goal:** survive as many waves as you can and chase the best score.
- **Combo:** kills within 2.5 s chain together; every 5 chained kills raises the score
  multiplier, up to x8. Taking a hit resets the combo.
- **Pickups:** destroyed enemies sometimes drop Shield (absorbs one hit), Rapid Fire,
  Spread Shot, or +1 Hull.
- **Waves:** each cleared wave pays a bonus and the next wave spawns faster, tougher
  enemies. Weavers shoot back from wave 2, splitters burst into mites from wave 3,
  dashers telegraph and lunge from wave 4.

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

No build step, no network requests: `game/index.html` and its ES modules are plain
static files, all sound is synthesized with WebAudio, and the best score is kept in
`localStorage`.

## Layout

- `game/index.html` — the page; `game/src/main.js` boots the loop.
- `game/src/config.js` — all tuning numbers and the palette.
- `game/src/world.js` — the rules: waves, enemies, collisions, score, combo.
- `game/src/render.js` — all drawing: starfield, HUD, title/pause/game-over screens.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — synthesized sound effects and bass music.
- `game/src/shots.js` — the staged screenshot scenes (`?shot=start|play|end`).
- `game/src/random.js` — the seeded RNG that makes games and screenshots repeatable.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`.
