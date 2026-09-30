# Escape: Overdrive

A browser police-chase game inspired by Escape Road, built with Three.js. Every car, building, texture and sound is generated in code; there are no asset files.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## Controls

| Action | Keyboard / mouse | Arduino joystick |
|---|---|---|
| Drive | W A S D / arrows | Left stick steers, right stick gas / brake |
| Handbrake drift / Nitro | Space / Shift | Click left / click right |
| Get out / steal a car or boat | F (or E) | Hold right-click (in a car, off the gas) / right-click (on foot) |
| Move on foot | W A S D (camera-relative) | Left stick (push fully to sprint) |
| Sprint / jump | Shift / Space | Full left stick / click left |
| Aim + shoot | Mouse + left click, or J (auto-aim) | Right stick (twin-stick aim and fire) |
| Switch weapon | Q | |
| Camera / pause / mute | C / Esc / M | Hold both clicks = pause |

## Features

- **Story mode:** 5 missions (The Getaway, Shake Them Off, Neon Heist, Cold War, Pharaoh's Escape) with objectives, timers, capped wanted levels, star ratings, prize money, car unlocks, and each mission unlocking the next. 13 trophies.
- **On foot:** jump out at any speed (bailing out at speed makes you tumble), carjack any car (traffic, police, even tanks), run, sprint on stamina, jump, and swim the river. When your car is wrecked you bail out and keep going.
- **Combat:** pistol, SMG and rocket launcher on foot; car-mounted machine guns and auto-lock rockets from power-ups. Shoot officers, police cars and tanks, and shoot helicopters out of the sky. Officers leave their cars, chase you with guns and arrest you if they catch you.
- **Water:** steal a docked speedboat, get chased by police boats, and see feluccas on the Nile.
- **Giza map:** sandstone city with domes and minarets, three stepped pyramids, the Sphinx, dunes, and an airstrip with the escape plane.
- **24 cars:** 12 new real-world-inspired cars (fictional names), modern and classic, with chrome bumpers, tail fins and two-tone paint.
- **Realism pass:** asphalt grain and wet puddles at night, parked cars, working traffic lights, color grading, ambient occlusion (High), and sky-lit reflections.
- **Human sounds:** footsteps, breathing, screams, police shouts (browser speech), radio chatter, crowd murmur and horns.

- **7 buyable cars and 4 police/traffic types**, built from side-profile extrusions with wheel arches, glass cabins with pillars, fenders, wings and liveries. Paint is customizable.
- **4 maps:** Metro City (day), Neon Nights (rain), Dust Valley (desert), Frostbite (icy roads).
- **Procedural city:** downtown towers, midtown shops, suburbs, industrial yards, parks, plazas, a river with bridges, alleys, and breakable props.
- **Opening cinematic:** a bank heist. The robber runs out of the First National Bank with the money, the alarm rings, bystanders flee, police arrive, and the chase begins. It can be skipped, and turned off in Settings.
- **Real human characters:** people near the camera are rigged 3D humans with motion-captured animation (walk, run, idle, wave, talk, roll, hit, fall and get back up). The robber and soldiers use them too. Distant and seated people use a lightweight procedural body. Models: Quaternius, CC0.
- **Pedestrians:** animated people walk the sidewalks, cross at crosswalks, wait for cars, dodge cars coming at them, and get knocked down and back up when hit (−100 score, more heat). Traffic stops for them.
- **Police AI:** A* route planning over the street grid, predictive pursuit, pinning a stopped player, ramming.
- **Military escalation:** at 6★ tanks do the shooting, with fortified roadblocks (tanks, barriers, spikes, soldiers) plus chasing tanks, up to 5 at once. At 7★ a fleet of 5 attack helicopters fires homing missiles and drops bombs. Every shot is telegraphed with a red laser or target ring, blasts knock cars and people around, and they leave scorch marks.
- **7 wanted levels:** interceptors, police roadblocks with spike strips, a police helicopter with a searchlight, SWAT trucks (5★), army tanks (6★), attack helicopters (7★).
- **Scoring:** near-miss combos, drift scoring, coins, and power-ups (nitro, repair, shield, EMP, magnet).
- **Presentation:** synthesized audio with music that builds with the wanted level, particles, skid marks, weather, bloom, and an x-ray cutout that shows the car behind buildings.
- **Performance:** adaptive resolution and three quality presets. Medium is the default: about 45–60 FPS on Intel integrated graphics in normal chases, and about 40 FPS in full 7★ battles.

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
