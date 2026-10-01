# Fathom

A 2D, frontend-only game for learning about ocean life. Instead of reading a wall of text, players pilot a submarine from the sunlit surface to the bottom of the Mariana Trench and discover real creatures along the way.

`index.html` holds two things:

1. **A playable prototype**: shoreline landing screen, auto-descent, WASD/arrow steering, sunlight falloff with headlights, real depth/pressure/temperature readouts, 15 real creatures to scan, sonar ping, zone banners, a surface debrief quiz and a field journal saved in `localStorage`.
2. **The solution blueprint**: problem statement, core loop, the five ocean zones, the full gamified feature set (tagged MVP / V1 / Later), screen flow, content model, technical architecture and roadmap.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrow keys | Steer the submarine |
| Shift | Boost |
| Space | Sonar ping |
| Touch: hold and drag | Steer toward your finger |

Rise back to the surface to end a dive.

## Content

Creature facts are simplified for play and should be checked against NOAA Ocean Exploration, MBARI, Smithsonian Ocean, WoRMS and the IUCN Red List before release.
