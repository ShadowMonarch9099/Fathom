/* Fathom world: where every creature, landmark and piece of scenery is placed, and how creatures move. */
(() => {
const F = window.Fathom, S = F.sprites;
const W = F.world = { creatures: [], decor: [], smokers: [] };

const HAB = {
  seagrass: [-1735, -1690], reef: [-1690, -1450], kelp: [-1450, -1300], slope: [-1290, -760],
  whalefall: [-800, -740], vent: [1250, 1410], plain: [330, 900], trench: [-200, 200], open: [-1100, 1100], surface: [-1500, 1500],
};

// Pick an x in [a, b] where the floor depth is closest to m.
function floorX(m, a, b, r) {
  let best = [], bestCost = Infinity;
  for (let x = a; x <= b; x += 2) {
    const c = Math.abs(F.floorM(x) - m);
    if (c < bestCost - 2) { bestCost = c; best = [x]; } else if (c <= bestCost + Math.max(6, m * .08)) best.push(x);
  }
  return best[Math.floor(r() * best.length)] ?? (a + b) / 2;
}

W.build = (seed, night) => {
  const r = F.rng(seed);
  W.creatures = []; W.decor = []; W.smokers = []; W.night = night;
  for (const sp of F.SPECIES) {
    const m = night && sp.nightM != null ? sp.nightM : sp.m;
    const L = S.sizeFor(sp), spr = S.get(sp, 0);
    let x, y, range = 0, bob = 3;
    const hab = sp.hab;
    if (sp.benthic) {
      if (hab === 'trench') x = r() < .5 ? floorX(m, -215, -45, r) : floorX(m, 45, 215, r);
      else if (hab === 'plain') x = r() < .7 ? floorX(m, 330, 940, r) : floorX(m, -470, -290, r);
      else { const [a, b] = HAB[hab] || HAB.slope; x = floorX(m, a, b, r); }
      y = F.floorY(x) - (spr.h - spr.ay) + 1;
      bob = 0;
    } else if (hab === 'surface') {
      x = HAB.surface[0] + r() * (HAB.surface[1] - HAB.surface[0]); y = Math.max(2, F.yAt(m)) + 2; range = 120 + r() * 160; bob = 1;
    } else if (hab === 'reef' || hab === 'kelp' || hab === 'seagrass') {
      const [a, b] = HAB[hab]; x = a + r() * (b - a); y = Math.min(F.yAt(m), F.floorY(x) - L * .6 - 4); range = Math.min(60, (b - a) / 2); bob = 2;
    } else if (hab === 'slope') {
      x = floorX(m + 120, -1290, -700, r) + 30; y = F.yAt(m); range = 40 + r() * 40;
      y = Math.min(y, F.floorY(x) - L);
    } else if (hab === 'plain') {
      x = 330 + r() * 560; y = F.floorY(x) - 12 - r() * 20; range = 80;
    } else if (hab === 'trench') {
      x = (r() - .5) * 140; y = F.yAt(m); range = 30; y = Math.min(y, F.floorY(x) - L);
    } else {
      const wide = m < 200 ? [-1250, 1650] : m < 1000 ? [-950, 1150] : [-700, 1000];
      for (let i = 0; i < 20; i++) { x = wide[0] + r() * (wide[1] - wide[0]); if (F.floorM(x) > m + 60) break; }
      const z = F.ZONES[F.zoneIdx(m)];
      y = F.yAt(m) + (r() - .5) * z.px * .12; y = Math.max(8, y);
      range = 60 + r() * 140 + L;
    }
    const school = [];
    for (let i = 1; i < (sp.school || 1); i++) school.push([(r() - .5) * (L * 2.2 + 18), (r() - .5) * (L * 1.1 + 10), r() * 4]);
    const speed = F.clamp(L * .45, 4, 26) * (sp.art.t === 'jelly' || sp.art.t === 'siphon' || sp.art.t === 'salp' ? .3 : 1);
    W.creatures.push({ sp, L, hx: x, hy: y, x, y, range, bob, ph: r() * 6.28, speed, face: 1, frame: 0, school, flee: 0, fx: 0, fy: 0, studied: false, ping: 0 });
  }
  buildDecor(r);
};

function addDecor(spr, x, y, layer = 0, extra) { W.decor.push({ spr, x, y, layer, ...extra }); }
function onFloor(spr, x, sink = 1) { return F.floorY(x) - (spr.h - spr.ay) + sink; }

function buildDecor(r) {
  const deco = id => F.byId[id];
  // land: palms + lighthouse
  addDecor(S.lighthouse(), -1790, F.floorY(-1790) - 18, 0, { above: true });
  for (const x of [-1782, -1770, -1757]) { const p = S.palm(Math.abs(x)); addDecor(p, x, onFloor(p, x, 2), 0, { above: true }); }
  // seagrass
  for (let x = -1738; x < -1680; x += 3) { const s = S.grass(x, 8 + Math.floor(r() * 6)); addDecor(s, x, onFloor(s, x), 0, { sway: true }); }
  // reef: corals, sponges, anemones, rocks
  const reefIds = ['staghorn', 'brain-coral', 'anemone', 'giant-clam', 'staghorn', 'brain-coral'];
  for (let x = -1684; x < -1452; x += 9 + r() * 7) { const sp = deco(reefIds[Math.floor(r() * reefIds.length)]); const s = S.get(sp, Math.floor(r() * 4)); addDecor(s, x, onFloor(s, x, 2), 0, { tint: .82 }); }
  for (let x = -1680; x < -1450; x += 30 + r() * 30) { const s = S.rock(Math.floor(r() * 5)); addDecor(s, x, onFloor(s, x, 3)); }
  // kelp forest
  for (let x = -1446; x < -1300; x += 7 + r() * 6) { addDecor(null, x, F.floorY(x), -1, { kelp: true, h: 60 + r() * 50, ph: r() * 6 }); }
  // slope: rocks + cold-water coral + glass sponges
  for (let x = -1290; x < -700; x += 18 + r() * 28) { const m = F.floorM(x); let s;
    if (m > 250 && m < 1000 && r() < .5) s = S.get(deco('deep-coral'), Math.floor(r() * 4));
    else if (m > 400 && m < 1200 && r() < .25) s = S.get(deco('venus-basket'), 0);
    else s = S.rock(Math.floor(r() * 5));
    addDecor(s, x, onFloor(s, x, 3), 0, { tint: .8 }); }
  // whale fall + wreck
  const sk = S.skeleton(); addDecor(sk, -770, onFloor(sk, -770, 4), 0, { landmark: 'whalefall' });
  const wr = S.wreck(); addDecor(wr, -520, onFloor(wr, -520, 8), 0, { landmark: 'wreck' });
  // abyssal plain + trench rocks
  for (let x = -460; x < 950; x += 26 + r() * 40) { if (Math.abs(x) < 220) continue; const s = S.rock(Math.floor(r() * 5)); addDecor(s, x, onFloor(s, x, 3)); }
  // vent field
  for (let x = 1262; x < 1410; x += 18 + r() * 10) { const h = 18 + Math.floor(r() * 22); const s = S.smoker(h, Math.floor(x)); const y = onFloor(s, x, 2); addDecor(s, x, y); W.smokers.push({ x, y: y - s.ay + 1 }); }
  for (let x = 1265; x < 1410; x += 11 + r() * 9) { const s = S.get(deco('tube-worm'), Math.floor(r() * 4)); addDecor(s, x, onFloor(s, x, 2), 0, { tint: .85 }); }
  // ridge rocks
  for (let x = 950; x < 1800; x += 24 + r() * 30) { if (x > 1250 && x < 1410) continue; const s = S.rock(Math.floor(r() * 5)); addDecor(s, x, onFloor(s, x, 3)); }
  W.decor.sort((a, b) => a.layer - b.layer);
}

W.update = (dt, t, sub, subSpeed) => {
  for (const c of W.creatures) {
    if (c.range > 0) {
      const om = c.speed / Math.max(20, c.range);
      const nx = c.hx + Math.sin(t * om + c.ph) * c.range;
      const vx = Math.cos(t * om + c.ph);
      c.face = vx >= 0 ? 1 : -1;
      c.x = nx; c.y = c.hy + Math.sin(t * .7 + c.ph) * c.bob;
    }
    // shy animals dart away from a fast-moving sub
    if (!c.sp.benthic && c.L < 40) {
      const dx = c.x + c.fx - sub.x, dy = c.y + c.fy - sub.y, d = Math.hypot(dx, dy);
      if (d < 46 + c.L * .5 && subSpeed > 70) { c.flee = 1.6; const k = 80 / Math.max(8, d); c.fvx = dx * k; c.fvy = dy * k; }
    }
    if (c.flee > 0) { c.flee -= dt; c.fx += (c.fvx || 0) * dt; c.fy += (c.fvy || 0) * dt; c.face = (c.fvx || 0) >= 0 ? 1 : -1; }
    else { c.fx *= Math.pow(.25, dt); c.fy *= Math.pow(.25, dt); }
    if (!c.sp.benthic) { const fl = F.floorY(c.x + c.fx) - c.L * .4; if (c.y + c.fy > fl) c.fy = fl - c.y; if (c.y + c.fy < 3) c.fy = 3 - c.y; }
    const fps = c.sp.benthic ? 2 : 3 + Math.min(5, c.speed * .25);
    c.frame = Math.floor(t * fps + c.ph * 4) % S.FRAMES;
  }
};
W.pos = c => [c.x + c.fx, c.y + c.fy];
})();
