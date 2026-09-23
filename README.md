# Escape: Overdrive

A browser police-chase game inspired by Escape Road, built with Three.js. Every car, building, texture and sound is generated in code; there are no asset files.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Drive | W A S D / arrows | Left stick, RT / LT |
| Handbrake drift | Space | A |
| Nitro | Shift | B / RB |
| Camera (top-down / chase) | C | Y |
| Pause | Esc / P | Start |
| Mute | M | |

Touch controls appear automatically on phones and tablets.

## Features

- **7 buyable cars and 4 police/traffic types**, built from side-profile extrusions with wheel arches, glass cabins with pillars, fenders, wings and liveries. Paint is customizable.
- **4 maps:** Metro City (day), Neon Nights (rain), Dust Valley (desert), Frostbite (icy roads).
- **Procedural city:** downtown towers, midtown shops, suburbs, industrial yards, parks, plazas, a river with bridges, alleys, and breakable props.
- **Police AI:** A* route planning over the street grid, predictive pursuit, pinning a stopped player, ramming.
- **5 wanted levels:** interceptors, SWAT trucks, roadblocks with spike strips, and a helicopter with a searchlight.
- **Scoring:** near-miss combos, drift scoring, coins, and power-ups (nitro, repair, shield, EMP, magnet).
- **Presentation:** synthesized audio with music that builds with the wanted level, particles, skid marks, weather, bloom, and an x-ray cutout that shows the car behind buildings.
- **Performance:** adaptive resolution and three quality presets. Medium is the default and holds about 60 FPS on Intel integrated graphics.

## Layout

```
src/
  main.js       game loop, state machine, rules, camera, rendering
  carModels.js  procedural car builder
  city.js       city generator, road graph (A*), collision hash, cutout shader
  vehicle.js    arcade physics + collisions
  police.js     police AI, roadblocks, helicopter
  traffic.js    lane-following civilian traffic
  pickups.js    coins and power-ups
  effects.js    particles, skid marks, weather
  audio.js      WebAudio synth (engine, siren, SFX, adaptive music)
  ui.js / style.css / index.html   menus and HUD
dev/            headless test tools (screenshots, fast-forward simulation, FPS benchmark)
```
