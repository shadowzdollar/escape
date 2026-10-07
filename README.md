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
| Fire vehicle weapons (war vehicles, armed boats, stolen tank) | Left click / J / Ctrl, mouse aims the turret | Right click (auto-aim); hold left click when stopped to get out |
| All controls in-game | H (also CONTROLS in the menu and pause screen) | |
| Camera / pause / mute | C / Esc / M | Hold both clicks = pause |

## Features

- **Story mode, "The Long Road":** an Assassin's Creed style campaign of 12 sequences (The Heist, Neon Blood, The Commissioner's Dogs, Dust and Iron, Whiteout, Sands of Giza, The River War, Blackout, Scorched Earth, Cold Steel, The Commissioner, The Architect).
  - **Size:** 120 story missions plus 240 side contracts, 360 missions in all. Story missions have 4–8 objectives each, with preparation, the main job and an aftermath.
  - **Objectives:** stealth assassinations with guards who grow suspicious, silent takedowns (F next to a guard or target), tailing, car chases, stealing and delivering vehicles, defending zones against waves, gang fights, planting charges, synchronizing viewpoints, meeting contacts, races, boat runs, helicopter and tank hunts.
  - **Story and dialogue:** fully voiced subtitles (browser speech; can be turned off with Settings → Story voices), a briefing screen and mission title cards.
  - **No wanted stars:** each objective sets the police response itself.
  - **Checkpoints:** every objective is a checkpoint. When you fail, retry from the checkpoint or restart.
  - **Difficulty:** rises through the story and with your rank (1–50, earned from XP). It affects police numbers, enemy health, aim and damage, guard perception and time limits.
  - **Rewards:** missions pay coins and unlock vehicles (cars, war vehicles, boats).
  - **Trophies:** 13.
- **On foot:** jump out at any speed (bailing out at speed makes you tumble), carjack any car (traffic, police, even tanks), run, sprint on stamina, jump, and swim the river. When your car is wrecked you bail out and keep going.
- **Combat:** pistol, SMG and rocket launcher on foot; car-mounted machine guns and auto-lock rockets from power-ups. Shoot officers, police cars and tanks, and shoot helicopters out of the sky. Officers leave their cars, chase you with guns and arrest you if they catch you.
- **Realistic city (Quaternius CC0 models):**
  - **Trees:** textured trees with leaf cut-outs, plus autumn maples, pines and palms.
  - **Parks:** flower beds, ferns, grass, rocks and clipped hedges.
  - **Old town:** a district of European townhouse blocks built around green courtyards.
  - **Street details:** streetlights, hydrants, bins, dumpsters, trash bags, chain-link fences, rooftop AC units, antennas and water towers.
  - **Facades:** office facades have glossy, reflective windows set back behind sills and floor ledges.
  - **Performance:** a distance LOD swaps in simplified models far away, and shadows are drawn from cheap copies. Rebuild the kit with `node dev/pack-city.mjs <folder of .glb files>`.
- **War vehicles (Garage → WAR VEHICLES):** RHINO armoured 4x4 with a roof machine-gun turret, WARHOG technical with a rocket pod and machine gun, GHOST interceptor with homing missiles, and the GOLIATH main battle tank (cannon + coax gun, 1200 armour). Turrets follow the mouse or lock on to targets ahead. A stolen police tank gets a working cannon too.
- **Boats (Garage → BOATS):** speedboat (free), PATROL BOAT with a bow machine gun, and GUNBOAT with twin rocket pods and a deck gun. The boat you pick waits at the nearest river bank (cyan ▲ on the minimap).
- **Movement:** faster running (jog 7.5 m/s, sprint 11 m/s), a front-crawl swim with strokes and splashes, and animated car doors that open when you get in, drag the driver out, or step out.
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
