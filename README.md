# Fathom

A 2D pixel-art ocean exploration game that teaches marine biology without walls of text. Pilot a submarine from the sunlit surface to the bottom of the Mariana Trench, find and scan **141 real species**, and build your own field guide as you go.

Frontend only: plain HTML, CSS and JavaScript with no build step and no framework.

**Play it at [deepseadive.vercel.app](https://deepseadive.vercel.app/)**

## Run locally

Open `index.html` in a browser, or run the bundled static server:

```bash
node tools/serve.mjs
```

Then visit http://localhost:5173.

## What's in the game

- **Five real ocean zones**: Sunlight, Twilight, Midnight, Abyss and Hadal, with true depth, pressure, temperature and sunlight readouts.
- **A side-on ocean**: beach, seagrass, coral reef and kelp forest by the shore, the continental slope, a whale fall, a shipwreck, an abyssal plain, a hydrothermal vent field and the Challenger Deep trench.
- **Dithered pixel lighting**: sunlight fades with depth, the headlights cut a cone through the dark (aim them with the mouse), and bioluminescent animals glow on their own.
- **Scanning and studying**: hold still near a lit animal to log it. Scan it on three dives to study it. Fast movement scares small animals away.
- **Sonar and radar**: ping to reveal hidden animals and landmarks.
- **Hangar upgrades**: pressure hull (unlocks deeper zones), battery, headlights, sonar, thrusters and scanner, paid for with research points.
- **Field guide**: every species has a pixel sprite, a short fact, depth range, size and diet. Logged species unlock a Wikipedia summary and photo plus a chart of the depths where scientists have recorded them (OBIS).
- **World register**: search any of the 240,000+ marine species in WoRMS, with live Wikipedia and OBIS data.
- **Debrief quiz** after every dive (fact, zone and photo-ID questions), **26 awards**, a **daily expedition**, and **day and night dives** (some animals only rise to the surface after dark).
- **Synthesised audio**: generative music, ambience and effects made with Web Audio. No sound files.
- **Settings**: volumes, pixel size, CRT scanlines, screen shake, reduced motion, Explorer mode (no depth or battery limits), labels, larger text, high-contrast HUD, online data, and save export/import/reset.
- **Controls**: keyboard, mouse, gamepad and touch.

| Input | Action |
| --- | --- |
| W A S D / arrows | Steer |
| Shift | Boost |
| Space | Sonar ping |
| L | Headlights |
| Mouse | Aim headlights |
| J | Field guide |
| M | Mute |
| Esc | Pause / menu |

## Species data

`tools/species.source.mjs` holds the hand-written list: names, depths, habitats, one fact per species and pixel-art parameters. `tools/build-species.mjs` enriches it with:

- [WoRMS](https://www.marinespecies.org/): accepted names, AphiaIDs and classification (CC BY 4.0)
- [OBIS](https://obis.org/): sighting record counts and depth histograms (rarity is based on record counts)
- [Wikipedia](https://en.wikipedia.org/): summaries and photo links (CC BY-SA 4.0)

and writes `js/data/species.js`. To add a species, add an entry to the source file and run:

```bash
node tools/build-species.mjs
```

## Project layout

```
index.html            game shell, HUD and menus
css/style.css         UI styles
js/core.js            depth scale, terrain, save data, upgrades, awards, daily goals
js/audio.js           Web Audio music and effects
js/sprites.js         procedural pixel-art creatures and props
js/world.js           creature placement, scenery and behaviour
js/game.js            engine: camera, sub, lighting, scanning, sonar, rendering
js/ui.js              menus, HUD, field guide, hangar, awards, settings, debrief
js/data/species.js    generated species database
tools/                data build script and local server
docs/blueprint.html   original design blueprint
```

## Saving progress (no accounts, no database)

- Progress saves automatically to the browser's localStorage after every discovery, every few seconds while diving, and when the tab is hidden or closed.
- The game asks the browser to protect that storage from automatic clean-up (`navigator.storage.persist()`).
- **Save link / save code:** all progress is packed into an ~80–100 character code (species scans as 2 bits each, landmarks, awards, upgrades and counters, plus a checksum). Opening `https://deepseadive.vercel.app/#save=CODE` on any device offers to restore it. Restoring merges with what's already there and keeps the best of both.
- **Save file:** download and load a JSON backup from the Save panel.

Species are stored in save codes by their position in the list, so new species must always be appended to the end of `tools/species.source.mjs`.

---

© 2026 Kush Honkalse. All rights reserved.
