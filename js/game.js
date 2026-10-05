/* Fathom game engine: camera, submarine, lighting, scanning, sonar, rendering. */
(() => {
const F = window.Fathom, S = F.sprites, Wd = F.world, A = F.audio, TAU = F.TAU;
const G = F.game = { state: 'menu', night: false, touch: { x: 0, y: 0, boost: false } };

const view = document.getElementById('view'), ctx = view.getContext('2d', { alpha: false });
const fx = document.getElementById('fx'), fctx = fx.getContext('2d');
// Darkness is drawn as a dithered black mask on its own small canvas, so the main
// canvas never has to be read back from the GPU.
const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
let W = 480, H = 300, SCALE = 3, DPR = 1, maskImg = null, mask32 = null;
let lm = new Float32Array(1);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
let autoBump = 0, needsRender = true, fxDirty = false;
const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

G.resize = () => {
  const s = F.save.settings, iw = Math.max(320, window.innerWidth || 0), ih = Math.max(240, window.innerHeight || 0);
  SCALE = s.pixel === 'auto' ? F.clamp(Math.round(Math.min(iw / 460, ih / 280)) + autoBump, 2, 7) : +s.pixel;
  W = Math.ceil(iw / SCALE); H = Math.ceil(ih / SCALE);
  view.width = W; view.height = H; view.style.width = W * SCALE + 'px'; view.style.height = H * SCALE + 'px';
  DPR = Math.min(1.5, window.devicePixelRatio || 1);
  fx.width = Math.round(iw * DPR); fx.height = Math.round(ih * DPR); fx.style.width = iw + 'px'; fx.style.height = ih + 'px';
  mask.width = W; mask.height = H; maskImg = mctx.createImageData(W, H); mask32 = new Uint32Array(maskImg.data.buffer);
  lm = new Float32Array(W * H);
  ctx.imageSmoothingEnabled = false;
  skyStrips = {}; terrainCache.clear();
  G.W = W; G.H = H; G.SCALE = SCALE; needsRender = true;
};

/* ---------- cached backgrounds ---------- */
const WORLD_PAD = 80;
const waterStrips = {};
let skyStrips = {};
function waterStrip(night) {
  if (waterStrips[night]) return waterStrips[night];
  const c = document.createElement('canvas'); c.width = 1; c.height = F.WORLD_BOTTOM + WORLD_PAD; const g = c.getContext('2d');
  for (let y = 0; y < c.height; y++) { g.fillStyle = rgb(waterRGB(F.metersAt(y), night)); g.fillRect(0, y, 1, 1); }
  return waterStrips[night] = c;
}
const SKY = { day: [[86, 160, 208], [214, 236, 240]], night: [[6, 12, 28], [28, 44, 74]] };
function skyStrip(night) {
  if (skyStrips[night]) return skyStrips[night];
  const [top, bot] = SKY[night ? 'night' : 'day'], h = Math.ceil(H * .56) + 8;
  const c = document.createElement('canvas'); c.width = 1; c.height = h; const g = c.getContext('2d');
  for (let y = 0; y < h; y++) { const q = Math.floor(F.clamp(y / (H * .56), 0, 1) * 12) / 12; g.fillStyle = rgb(top.map((v, i) => v + (bot[i] - v) * q)); g.fillRect(0, y, 1, 1); }
  return skyStrips[night] = c;
}
let islands = null;
function islandStrip() {
  if (islands) return islands;
  const x0 = Math.floor(F.WORLD_X[0] * .25) - 20, w = Math.ceil((F.WORLD_X[1] - F.WORLD_X[0]) * .25) + 1200;
  const make = col => { const c = document.createElement('canvas'); c.width = w; c.height = 12; const g = c.getContext('2d'); g.fillStyle = col;
    for (let x = 0; x < w; x++) { const wx = x + x0; const h = Math.round(Math.max(0, Math.sin(wx * .011) * 7 + Math.sin(wx * .037) * 3 - 3)); if (h > 0) g.fillRect(x, 12 - h, 1, h); }
    return c; };
  return islands = { x0, day: make('#7fa9b6'), night: make('#18263a') };
}
// Terrain is baked into 128 px chunks the first time they come into view.
const CH = 128, terrainCache = new Map();
function terrainChunk(ix, iy) {
  const key = ix + ',' + iy;
  if (terrainCache.has(key)) return terrainCache.get(key);
  const X0 = ix * CH, Y0 = iy * CH;
  let any = false;
  for (let x = 0; x < CH; x += 4) if (F.floorY(X0 + x) - 2 < Y0 + CH) { any = true; break; }
  let c = null;
  if (any) {
    c = document.createElement('canvas'); c.width = CH; c.height = CH; const g = c.getContext('2d');
    for (let x = 0; x < CH; x++) {
      const wx = X0 + x, fys = Math.round(F.floorY(wx)) - Y0;
      if (fys >= CH) continue;
      const m = F.floorM(wx), col = floorColor(m, wx), ys = Math.max(0, fys);
      g.fillStyle = rgb(col); g.fillRect(x, ys, 1, CH - ys);
      if (fys >= 0) { g.fillStyle = rgb(col.map(v => Math.min(255, v * 1.35 + 10))); g.fillRect(x, fys, 1, 1); if (m < 0 && m > -20) { g.fillStyle = '#5f9a44'; g.fillRect(x, fys, 1, 2); } }
      for (let j = 0; j < 3; j++) { const yy = fys + 3 + Math.floor(F.hash(wx, j) * 40); if (yy >= 0 && yy < CH) { g.fillStyle = rgb(col.map(v => v * (F.hash(wx, j + 9) < .5 ? .75 : 1.2))); g.fillRect(x, yy, 1, 1); } }
    }
  }
  if (terrainCache.size > 260) terrainCache.delete(terrainCache.keys().next().value);
  terrainCache.set(key, c);
  return c;
}
// Kelp sway frames, cached per height bucket and phase step.
const kelpCache = new Map(), KELP_STEPS = 12;
function kelpFrame(h, step) {
  const key = h + ':' + step;
  if (kelpCache.has(key)) return kelpCache.get(key);
  const c = document.createElement('canvas'); c.width = 24; c.height = h + 4; const g = c.getContext('2d');
  const ph = step / KELP_STEPS * TAU, base = h + 2, ox = 12;
  for (let i = 0; i < h; i++) { const k = i / h, px = Math.round(ox + Math.sin(ph + k * 2.4) * 6 * k);
    g.fillStyle = '#6f6a22'; g.fillRect(px, base - i, 1, 1);
    if (i % 7 === 3) { const s = (i % 14 === 3) ? 1 : -1; g.fillStyle = '#8f8a2c'; g.fillRect(px + (s > 0 ? 1 : -4), base - i, 4, 1); g.fillRect(px + (s > 0 ? 2 : -3), base - i - 1, 2, 1); g.fillStyle = '#c9a83a'; g.fillRect(px, base - i - 1, 1, 1); } }
  kelpCache.set(key, c);
  return c;
}

/* ---------- state ---------- */
const sub = G.sub = { x: 10, y: 2, vx: 0, vy: 0, face: 1, frame: 0, lights: false, battery: 100, hull: 100, aim: 0 };
let camX = -W / 2, camY = -H * .56, t = 0, last = performance.now(), stateT = 0, shake = 0;
let session = null, zoneNow = 0, ping = null, pingCd = 0, scanT = null, scanP = 0, warnT = 0, hudT = 0, dustT = 0;
let mouse = { x: 0, y: 0, active: 0 };
const keys = new Set();
const bubbles = [], dust = [], sparks = [], smoke = [];
const snow = Array.from({ length: 170 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() }));
const clouds = Array.from({ length: 7 }, (_, i) => ({ seed: i, x: i * 170 + Math.random() * 80, y: .1 + Math.random() * .32, v: 2 + Math.random() * 3 }));
const birds = Array.from({ length: 6 }, (_, i) => ({ x: Math.random() * 600, y: .2 + Math.random() * .2, v: 10 + Math.random() * 6, ph: Math.random() * 6 }));
const MILESTONES = [
  { m: 40, text: '40 m · the usual limit for recreational scuba divers' },
  { m: 100, text: '100 m · water pressure is now 11 times the surface' },
  { m: 1000, text: '1,000 m · pressure is 100 times the surface' },
  { m: 2500, text: '2,500 m · hydrothermal vents erupt on ridges at this depth' },
  { m: 3682, text: '3,682 m · the average depth of the world ocean' },
  { m: 8849, text: '8,849 m · Mount Everest would only just fit in the water above you' },
];

const setState = s => { G.state = s; stateT = 0; needsRender = true; F.emit('state', s); };

/* ---------- dive lifecycle ---------- */
G.toMenu = () => {
  setState('menu'); sub.x = 10; sub.vx = sub.vy = 0; sub.face = 1; sub.lights = false;
  Wd.build(Date.now() & 0xffff, G.night);
  A.setMode('menu'); A.setDepth(0, false);
};
G.startDive = (night) => {
  G.night = !!night;
  Wd.build((Date.now() * 7) & 0xffffff, G.night);
  session = G.session = { start: performance.now(), maxDepth: 0, newIds: [], studied: [], scannedIds: new Set(), landmarks: [], rp: 0, milestones: new Set(), night: G.night, reason: null, achievements: [] };
  sub.x = 10; sub.y = 3; sub.vx = 0; sub.vy = 30; sub.face = 1; sub.hull = 100;
  sub.battery = 100; sub.lights = false; zoneNow = 0; ping = null; pingCd = 0; scanT = null; scanP = 0;
  bubbles.length = 0; sparks.length = 0;
  // Count the dive as soon as it starts, so closing the tab mid-dive still records it.
  F.save.dives++; if (G.night) F.save.nightDives++; F.persist();
  setState('intro'); A.play('splash'); A.setMode('dive');
  for (let i = 0; i < 26; i++) bubbles.push({ x: sub.x + (Math.random() - .5) * 30, y: sub.y + Math.random() * 10, r: Math.random() < .3 ? 2 : 1, life: 1 + Math.random() });
};
// Write the current dive's depth record and play time into the save. Called every few
// seconds while diving, when the tab is hidden or closed, and when the dive ends.
function saveDiveProgress() {
  if (!session) return;
  const s = F.save, now = performance.now();
  s.maxDepth = Math.max(s.maxDepth, session.maxDepth);
  s.playSeconds += (now - (session.savedAt || session.start)) / 1000; session.savedAt = now;
  F.persist();
}
let autosaveT = 0;
const flush = () => { if (session && ['intro', 'play', 'paused', 'emergency'].includes(G.state)) saveDiveProgress(); else F.persist(); };
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
G.pause = () => { if (G.state === 'play' || G.state === 'intro') { G.prevState = G.state; setState('paused'); } };
G.resume = () => { if (G.state === 'paused') { setState(G.prevState || 'play'); last = performance.now(); } };
G.endDive = (reason = 'surface') => {
  if (!session) return;
  session.reason = reason; session.seconds = (performance.now() - session.start) / 1000;
  saveDiveProgress();
  session.achievements.push(...F.checkAchievements());
  G.scanTarget = null; setState('debrief'); A.play('surface'); A.setMode('menu'); A.setDepth(0, false);
  sub.lights = false; sub.vx = sub.vy = 0;
  F.emit('diveEnd', session);
};
G.hullRating = () => F.hullRating();

/* ---------- input ---------- */
const KEYS = { w: 'u', arrowup: 'u', s: 'd', arrowdown: 'd', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if (G.state === 'play' || G.state === 'intro') {
    if (KEYS[k]) { keys.add(KEYS[k]); e.preventDefault(); }
    if (k === 'shift') keys.add('b');
    if (k === ' ') { G.ping(); e.preventDefault(); }
    if (k === 'l' || k === 'f') G.toggleLights();
  }
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (KEYS[k]) keys.delete(KEYS[k]); if (k === 'shift') keys.delete('b'); });
addEventListener('blur', () => keys.clear());
view.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX / SCALE; mouse.y = e.clientY / SCALE; mouse.active = 2.5; } });
view.addEventListener('pointerleave', () => { mouse.active = 0; });

G.toggleLights = () => { if (sub.battery <= 0 && !F.save.settings.explorer) return; sub.lights = !sub.lights; sub.manualLights = true; A.play('lights', sub.lights); F.emit('lights', sub.lights); };
G.ping = () => {
  if (G.state !== 'play' || pingCd > 0) return;
  if (!F.save.settings.explorer) { if (sub.battery < 5) { F.emit('toast', { text: 'Battery too low for sonar. Surface to recharge.', kind: 'warn' }); A.play('error'); return; } sub.battery -= 5; }
  ping = { r: 0, max: F.up('sonar'), age: 0 }; pingCd = 2.8;
  F.save.pings++; F.persist(); A.play('ping'); F.dailyEvent({ type: 'ping' });
  for (const c of Wd.creatures) { const [x, y] = Wd.pos(c); const d = Math.hypot(x - sub.x, y - sub.y); if (d < ping.max) c.ping = 5 + d / 300; }
  F.checkAchievements();
};

function pad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp) return null;
  const dz = v => Math.abs(v) < .18 ? 0 : v;
  const b = i => gp.buttons[i] && gp.buttons[i].pressed;
  if (b(0) && !pad.a) G.ping(); pad.a = b(0);
  if (b(2) && !pad.x) G.toggleLights(); pad.x = b(2);
  if (b(9) && !pad.st) F.emit('pauseRequest'); pad.st = b(9);
  return { x: dz(gp.axes[0]), y: dz(gp.axes[1]), boost: b(7) || b(5) };
}

/* ---------- update ---------- */
function update(dt) {
  t += dt; stateT += dt;
  if (G.state === 'paused') return;
  const set = F.save.settings, explorer = set.explorer;
  Wd.update(dt, t, sub, Math.hypot(sub.vx, sub.vy));
  if (mouse.active > 0) mouse.active -= dt;
  for (const c of Wd.creatures) if (c.ping > 0) c.ping -= dt;

  if (G.state === 'menu' || G.state === 'debrief') {
    sub.y = 2 + Math.sin(t * 1.6) * .8; sub.x = 10; sub.vx = sub.vy = 0; sub.face = 1;
    const tx = -W * .5 + 10 - (W > 520 ? W * .08 : 0), ty = -H * .56;
    camX += (tx - camX) * Math.min(1, dt * 2); camY += (ty - camY) * Math.min(1, dt * 2);
    particles(dt); return;
  }

  let ix = 0, iy = 0, boost = false;
  if (G.state === 'intro') {
    sub.vy += (46 - sub.vy) * Math.min(1, dt * 2);
    if (stateT > 2.2) { setState('play'); F.emit('controlsOn'); }
  } else if (G.state === 'play') {
    if (keys.has('l')) ix--; if (keys.has('r')) ix++; if (keys.has('u')) iy--; if (keys.has('d')) iy++;
    boost = keys.has('b');
    const gp = pad(); if (gp && (gp.x || gp.y)) { ix = gp.x; iy = gp.y; boost = boost || gp.boost; }
    if (G.touch.x || G.touch.y) { ix = G.touch.x; iy = G.touch.y; boost = boost || G.touch.boost; }
    const n = Math.hypot(ix, iy); if (n > 1) { ix /= n; iy /= n; }
  } else if (G.state === 'emergency') { iy = -1; ix = 0; }

  const flat = !explorer && sub.battery <= 0;
  let max = F.up('thrusters') * (boost && !flat ? 2 : 1) * (flat ? .55 : 1);
  if (G.state === 'emergency') max = 170;
  if (G.state !== 'intro') {
    sub.vx += (ix * max - sub.vx) * Math.min(1, dt * 2.4);
    sub.vy += (iy * max - sub.vy) * Math.min(1, dt * 2.4);
  }
  // facing: mouse aim wins when active, else movement
  if (mouse.active > 0 && G.state === 'play') { const mx = mouse.x + camX; sub.face = mx >= sub.x ? 1 : -1; }
  else if (Math.abs(ix) > .15) sub.face = Math.sign(ix);

  // move with terrain collision
  const r = 7;
  let nx = F.clamp(sub.x + sub.vx * dt, F.WORLD_X[0] + 20, F.WORLD_X[1] - 20);
  const fy = F.floorY(nx);
  if (sub.y + r > fy) { if (sub.y + r - fy < 5) sub.y = fy - r; else { nx = sub.x; sub.vx *= -.2; } }
  sub.x = nx;
  sub.y += sub.vy * dt;
  const fl = F.floorY(sub.x);
  if (sub.y + r > fl) { if (sub.vy > 40) { A.play('bump'); shake = .25; for (let i = 0; i < 10; i++) dust.push({ x: sub.x + (Math.random() - .5) * 20, y: fl - 1, vx: (Math.random() - .5) * 30, vy: -Math.random() * 20, life: 1.2 }); } sub.y = fl - r; sub.vy = Math.min(0, sub.vy); }
  if (sub.y < 1) { sub.y = 1; sub.vy = Math.max(0, sub.vy); if ((G.state === 'play' && stateT > 2.5 && iy < 0) || G.state === 'emergency') { G.endDive(G.state === 'emergency' ? 'emergency' : 'surface'); return; } }

  const m = Math.max(0, F.metersAt(sub.y));
  if (session) {
    if (m > session.maxDepth) { session.maxDepth = m; if (Math.floor(m / 50) !== Math.floor((m - 1) / 50)) F.dailyEvent({ type: 'depth', m }); }
    for (const ms of MILESTONES) if (m >= ms.m && !session.milestones.has(ms.m)) { session.milestones.add(ms.m); F.emit('toast', { text: ms.text, kind: 'milestone' }); }
  }
  const zi = F.zoneIdx(m);
  if (zi !== zoneNow && G.state === 'play') { F.emit('zone', { zi, down: zi > zoneNow }); if (zi > zoneNow) A.play('zone', zi); }
  zoneNow = zi;
  A.setDepth(m, true);

  // lights: automatic as the sunlight fades
  const amb = F.ambient(m) * (G.night ? .14 : 1);
  if (set.autoLights && !sub.manualLights && !flat) { const want = amb < .45; if (want !== sub.lights) { sub.lights = want; A.play('lights', want); F.emit('lights', want); if (want) F.emit('toast', { text: 'Sunlight is fading. Headlights on. Aim them with the mouse or by steering.', kind: 'info', once: 'lights' }); } }
  if (flat && sub.lights) { sub.lights = false; F.emit('lights', false); F.emit('toast', { text: 'Battery flat. Lights and sonar are off. Head for the surface.', kind: 'warn' }); }

  // battery
  if (!explorer) {
    const cap = F.up('battery');
    const drain = .12 + (sub.lights ? 1 : 0) + (boost ? 1.2 : 0);
    sub.battery = Math.max(0, sub.battery - drain * dt * 100 / cap);
  }
  // hull
  const rating = F.hullRating();
  if (m > rating * .92 && G.state === 'play') {
    warnT -= dt;
    if (m > rating) {
      sub.hull = Math.max(0, sub.hull - (8 + (m - rating) / rating * 120) * dt); shake = Math.max(shake, .12);
      if (warnT <= 0) { A.play('creak'); warnT = 1.4; F.emit('toast', { text: `Hull stress! Rated to ${F.fmt(rating)} m. Upgrade the hull in the hangar to go deeper.`, kind: 'danger', once: 'hull' + Math.floor(t / 6) }); }
      if (sub.hull <= 0) { setState('emergency'); F.emit('toast', { text: 'Hull failing. Emergency ascent!', kind: 'danger' }); A.play('warn'); }
    } else if (warnT <= 0) { A.play('warn'); warnT = 3; }
  } else if (sub.hull < 100 && m < rating * .85) sub.hull = Math.min(100, sub.hull + 3 * dt);

  pingCd = Math.max(0, pingCd - dt);
  if (ping) { ping.age += dt; ping.r = ping.age * 300; if (ping.r > ping.max + 40) ping = null; }
  shake = Math.max(0, shake - dt);

  // landmarks
  for (const lmk of F.LANDMARKS) {
    if (session.landmarks.includes(lmk.id)) continue;
    const ly = F.yAt(lmk.m), d = Math.hypot(lmk.x - sub.x, (ly - sub.y) * 1.2);
    if (d < (lmk.id === 'challenger' ? 40 : 60)) {
      session.landmarks.push(lmk.id);
      const first = !F.save.landmarks[lmk.id];
      if (first) { F.save.landmarks[lmk.id] = F.today(); F.save.rp += 30; F.save.rpTotal += 30; session.rp += 30; F.persist(); }
      F.emit('landmark', { lmk, first }); F.dailyEvent({ type: 'landmark' });
      session.achievements.push(...F.checkAchievements());
    }
  }

  // camera
  const tx = sub.x - W / 2, ty = sub.y - H * .46;
  const k = Math.min(1, dt * 3.2);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  camY = Math.min(camY, F.WORLD_BOTTOM + 30 - H);
  camX = F.clamp(camX, F.WORLD_X[0], F.WORLD_X[1] - W);

  // bubbles from the propeller
  const spd = Math.hypot(sub.vx, sub.vy);
  if (Math.random() < dt * (3 + spd * .12)) bubbles.push({ x: sub.x - sub.face * 20, y: sub.y + (Math.random() - .5) * 4, r: Math.random() < .2 ? 2 : 1, life: 1.6 });
  // night-time sea sparkle in the wake
  if (G.night && m < 40 && spd > 20 && Math.random() < dt * spd * .3) sparks.push({ x: sub.x - sub.face * 18 + (Math.random() - .5) * 10, y: sub.y + (Math.random() - .5) * 10, life: 1 });
  sub.frame = Math.floor(t * (6 + spd * .15)) % 4;
  particles(dt);
  if (G.state === 'play') scan(dt, spd);
  hudT -= dt; if (hudT <= 0) { hudT = .1; emitHud(m, zi, rating); }
  autosaveT -= dt; if (autosaveT <= 0) { autosaveT = 4; saveDiveProgress(); }
}

function particles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y -= dt * 22; b.x += Math.sin(t * 5 + i) * .15; b.life -= dt; if (b.life <= 0 || b.y < 0) bubbles.splice(i, 1); }
  for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 15 * dt; d.life -= dt; if (d.life <= 0) dust.splice(i, 1); }
  for (let i = sparks.length - 1; i >= 0; i--) { sparks[i].life -= dt * .8; if (sparks[i].life <= 0) sparks.splice(i, 1); }
  if (Wd.smokers.length && Math.random() < dt * 20) { const s = Wd.smokers[Math.floor(Math.random() * Wd.smokers.length)]; if (Math.abs(s.x - sub.x) < W) smoke.push({ x: s.x, y: s.y, vx: (Math.random() - .5) * 6, life: 3 + Math.random() * 2 }); }
  for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.y -= dt * 14; s.x += s.vx * dt; s.vx *= .99; s.life -= dt; if (s.life <= 0) smoke.splice(i, 1); }
}

/* ---------- scanning ---------- */
function lightAt(x, y) { const sx = Math.round(x - camX), sy = Math.round(y - camY); if (sx < 0 || sy < 0 || sx >= W || sy >= H) return 0; return lm[sy * W + sx]; }
function scan(dt, spd) {
  let best = null, bd = 1e9;
  for (const c of Wd.creatures) {
    const rec = F.save.logged[c.sp.id];
    const want = !rec || (rec.scans < F.STUDY_SCANS && !session.scannedIds.has(c.sp.id));
    if (!want) continue;
    const [x, y] = Wd.pos(c), d = Math.hypot(x - sub.x, y - sub.y);
    const R = 30 + c.L * .55;
    if (d < R && d < bd + (rec ? 30 : 0)) { if (!best || !rec || F.save.logged[best.sp.id]) { bd = d; best = c; } }
  }
  if (best !== scanT) { scanT = best; scanP = 0; }
  G.scanTarget = scanT; G.scanProgress = scanP; G.scanIssue = null;
  if (!scanT) return;
  const [x, y] = Wd.pos(scanT);
  const lit = scanT.sp.glow || lightAt(x, y) > .3;
  if (!lit) { G.scanIssue = 'dark'; scanP = Math.max(0, scanP - dt); return; }
  if (scanT.flee > 0) { G.scanIssue = 'fled'; scanP = 0; return; }
  if (spd > 72) { G.scanIssue = 'fast'; scanP = Math.max(0, scanP - dt * .5); return; }
  const rec = F.save.logged[scanT.sp.id];
  const before = scanP;
  scanP += dt / (F.up('scanner') * (rec ? .6 : 1));
  if (Math.floor(before * 6) !== Math.floor(scanP * 6)) A.play('scantick', scanP);
  G.scanProgress = scanP;
  if (scanP >= 1) { complete(scanT); scanT = null; scanP = 0; }
}
function complete(c) {
  const sp = c.sp, s = F.save, m = Math.round(F.metersAt(c.y));
  let rec = s.logged[sp.id];
  const isNew = !rec;
  session.scannedIds.add(sp.id);
  if (isNew) {
    rec = s.logged[sp.id] = { scans: 1, first: F.today(), depth: m, night: G.night };
    const rp = F.RARITY[sp.rarity].rp; s.rp += rp; s.rpTotal += rp; session.rp += rp;
    session.newIds.push(sp.id);
    A.play('discover', sp.rarity);
  } else {
    rec.scans++;
    if (rec.scans === F.STUDY_SCANS) { s.rp += 15; s.rpTotal += 15; session.rp += 15; session.studied.push(sp.id); }
    A.play('study');
  }
  F.persist();
  F.emit(isNew ? 'discover' : 'study', { sp, rec, depth: m });
  F.dailyEvent({ type: 'scan', species: sp, isNew });
  session.achievements.push(...F.checkAchievements());
}

function emitHud(m, zi, rating) {
  F.emit('hud', { m, zi, rating, pressure: F.pressure(m), temp: F.temp(m), sun: F.sunPct(m) * (G.night ? 0 : 1), battery: sub.battery, hull: sub.hull, lights: sub.lights, pingCd, x: sub.x, y: sub.y, maxDepth: session ? session.maxDepth : 0, scanTarget: G.scanTarget, scanProgress: G.scanProgress, scanIssue: G.scanIssue, emergency: G.state === 'emergency' });
}

/* ---------- rendering ---------- */
const WATER = [[0, '#2f8fc0'], [30, '#1f74a8'], [120, '#145084'], [300, '#0c355e'], [700, '#082546'], [1500, '#051a35'], [4000, '#04112a'], [11000, '#020812']].map(([m, c]) => [m, c.match(/\w\w/g).map(h => parseInt(h, 16))]);
function waterRGB(m, night) {
  let c = WATER[WATER.length - 1][1];
  for (let i = 1; i < WATER.length; i++) if (m <= WATER[i][0]) { const [a, ca] = WATER[i - 1], [b, cb] = WATER[i], k = (m - a) / (b - a); c = ca.map((v, j) => v + (cb[j] - v) * k); break; }
  if (night) { const k = .32 + .68 * Math.min(1, m / 600); c = c.map(v => v * k); }
  return c;
}
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
function floorColor(m, x) {
  if (x > 1220 && x < 1460 && m > 2000) return [42, 34, 34];
  if (m < 0) return [214, 192, 130];
  if (m < 50) return [198, 172, 120];
  if (m < 400) return [112, 98, 80];
  if (m < 1500) return [72, 64, 60];
  if (m < 4000) return [56, 52, 52];
  return [46, 43, 46];
}

function render() {
  const cx = Math.round(camX + (shake > 0 && F.save.settings.shake ? (Math.random() - .5) * 2 : 0)), cy = Math.round(camY + (shake > 0 && F.save.settings.shake ? (Math.random() - .5) * 2 : 0));
  const horizon = -cy;
  const night = G.night;
  // sky
  if (horizon > 0) {
    const [top, bot] = SKY[night ? 'night' : 'day'];
    const rows = Math.min(H, horizon + 4), s0 = Math.round(H * .56 - horizon), strip = skyStrip(night);
    if (s0 < 0) { ctx.fillStyle = rgb(top); ctx.fillRect(0, 0, W, Math.min(rows, -s0)); }
    const src0 = Math.max(0, s0), dst0 = src0 - s0, n = Math.min(rows - dst0, strip.height - src0);
    if (n > 0) ctx.drawImage(strip, 0, src0, 1, n, 0, dst0, W, n);
    if (night) {
      for (let i = 0; i < 90; i++) { const x = Math.floor(F.hash(i, 3) * W), y = Math.floor(F.hash(i, 9) * (horizon - 10)); if (y < horizon - 6) { ctx.fillStyle = F.hash(i, 5) < .2 ? '#ffffff' : '#9fb3d0'; if (Math.sin(t * 2 + i) > -.6) ctx.fillRect(x, y, 1, 1); } }
      circ(W * .8, horizon - H * .42, 9, '#e8ecdc'); circ(W * .8 + 3, horizon - H * .42 - 2, 8, rgb(top.map((v, i) => v + (bot[i] - v) * .25)));
    } else {
      circ(W * .8, horizon - H * .42, 16, 'rgba(255,240,190,.35)'); circ(W * .8, horizon - H * .42, 11, '#fff2c4');
    }
    // distant islands
    const isl = islandStrip();
    ctx.drawImage(night ? isl.night : isl.day, Math.round(isl.x0 - cx * .25), horizon - 12);
    for (const c of clouds) { const s = S.cloud(c.seed); const x = Math.round(((c.x + t * c.v - cx * .15) % (W + 160) + W + 160) % (W + 160) - 80), y = Math.round(horizon - H * .56 + c.y * H * .8); ctx.globalAlpha = night ? .25 : 1; ctx.drawImage(s.c, x, y); ctx.globalAlpha = 1; }
    if (!night) for (const b of birds) { const s = S.bird(Math.floor(t * 4 + b.ph) % 2); const x = Math.round(((b.x + t * b.v - cx * .3) % (W + 60) + W + 60) % (W + 60) - 30), y = Math.round(horizon - H * .56 + b.y * H * .8 + Math.sin(t + b.ph) * 3); ctx.drawImage(s.c, x, y); }
  }
  // water rows
  const y0 = Math.max(0, horizon);
  if (y0 < H) { const ws = waterStrip(night), sy = y0 + cy, n = Math.min(H - y0, ws.height - sy); if (n > 0) ctx.drawImage(ws, 0, sy, 1, n, 0, y0, W, n); }
  // light rays
  if (!night && cy < 400) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const x = ((i * 97 - cx * .5) % (W + 120) + W + 120) % (W + 120) - 60 + Math.sin(t * .4 + i) * 6; const a = .07 * (1 - Math.max(0, cy) / 400); ctx.fillStyle = `rgba(190,235,255,${a})`; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 10, y0); ctx.lineTo(x + 70, y0 + 260); ctx.lineTo(x + 46, y0 + 260); ctx.fill(); }
    ctx.restore();
  }
  // waves + foam
  if (horizon > -6 && horizon < H + 6) {
    const sky = night ? [28, 44, 74] : [214, 236, 240];
    for (let x = 0; x < W; x++) { const wv = Math.round(Math.sin((x + cx) * .05 + t * 1.6) * 1.2 + Math.sin((x + cx) * .13 - t * 2.3) * .8); const wy = horizon + wv;
      if (wv > 0) { ctx.fillStyle = rgb(sky); ctx.fillRect(x, horizon, 1, wv); }
      ctx.fillStyle = night ? '#4a6a88' : '#e9f7fb'; ctx.fillRect(x, wy, 1, 1); }
  }
  // world layer
  ctx.save(); ctx.translate(-cx, -cy);
  // kelp + decor
  for (const d of Wd.decor) {
    if (d.x < cx - 90 || d.x > cx + W + 90) continue;
    if (d.kelp) { drawKelp(d); continue; }
    const s = d.spr; const sx = Math.round(d.x - s.ax), sy = Math.round(d.y - s.ay);
    if (sy > cy + H + 10 || sy + s.h < cy - 10) continue;
    ctx.drawImage(s.c, sx, sy);
  }
  // smoke
  for (const s of smoke) { ctx.fillStyle = s.life > 2 ? '#1a1514' : '#2a2422'; const r = 2 + (5 - s.life) * .8; ctx.fillRect(Math.round(s.x - r / 2), Math.round(s.y), Math.round(r), Math.round(r)); }
  // terrain
  ctx.restore();
  for (let iy = Math.floor(cy / CH); iy * CH < cy + H; iy++) for (let ix = Math.floor(cx / CH); ix * CH < cx + W; ix++) {
    const c = terrainChunk(ix, iy); if (c) ctx.drawImage(c, ix * CH - cx, iy * CH - cy);
  }
  ctx.save(); ctx.translate(-cx, -cy);
  // creatures
  for (const c of Wd.creatures) {
    const [x, y] = Wd.pos(c);
    if (x < cx - 120 || x > cx + W + 120 || y < cy - 120 || y > cy + H + 120) continue;
    drawCreature(c, x, y, c.frame);
    for (const [ox, oy, ph] of c.school) drawCreature(c, x + ox, y + oy, (c.frame + Math.floor(ph)) % 4);
  }
  // land props
  // submarine
  const ss = S.sub(sub.frame);
  ctx.save(); ctx.translate(Math.round(sub.x), Math.round(sub.y)); ctx.scale(sub.face, 1); ctx.drawImage(ss.c, -ss.ax, -ss.ay); ctx.restore();
  // ship (menu / surface)
  if (horizon > -60) { const sh = S.ship(); ctx.drawImage(sh.c, Math.round(-70 - sh.ax), Math.round(-sh.ay + 8 + Math.sin(t * 1.3) * .8)); }
  // bubbles, dust, snow
  ctx.fillStyle = 'rgba(220,245,255,.7)';
  for (const b of bubbles) { if (b.r > 1) { ctx.fillRect(Math.round(b.x), Math.round(b.y) - 1, 1, 1); ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y), 1, 1); ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y), 1, 1); ctx.fillRect(Math.round(b.x), Math.round(b.y) + 1, 1, 1); } else ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); }
  ctx.fillStyle = '#8a7a66'; for (const d of dust) ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
  ctx.restore();
  const subM = F.metersAt(sub.y);
  if (cy > -H) for (const bright of [false, true]) { ctx.fillStyle = bright ? '#d8e2e6' : '#9fb0b8'; for (const p of snow) { if ((p.s > .7) !== bright) continue; const sx = Math.floor(((p.x * W * 1.2 - cx * (.6 + p.s * .4)) % W + W) % W), sy = Math.floor(((p.y * H + t * (3 + p.s * 4) - cy * (.6 + p.s * .4)) % H + H) % H); if (sy < horizon + 4) continue; ctx.fillRect(sx, sy, 1, 1); } }

  // lighting pass
  const dark = G.state !== 'menu' && (cy > 0 || night) && (F.ambient(F.metersAt(cy + H)) < .97 || night);
  const glowList = [];
  if (dark) {
    buildLightmap(cx, cy, horizon, night, glowList);
    applyLight();
  } else { lm.fill(1); collectGlows(cx, cy, glowList); }
  // emissive layer
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const gl of glowList) { const big = gl.r >= 2; ctx.fillStyle = gl.c; ctx.globalAlpha = gl.a * .22; ctx.fillRect(gl.x - 2, gl.y - 1, big ? 6 : 5, 3); ctx.fillRect(gl.x - 1, gl.y - 2, big ? 4 : 3, big ? 6 : 5); ctx.globalAlpha = gl.a * .55; ctx.fillRect(gl.x - 1, gl.y, big ? 4 : 3, 1); ctx.fillRect(gl.x, gl.y - 1, big ? 2 : 1, big ? 4 : 3); ctx.globalAlpha = gl.a; ctx.fillRect(gl.x, gl.y, big ? 2 : 1, big ? 2 : 1); }
  ctx.globalAlpha = 1;
  for (const s of sparks) { ctx.fillStyle = `rgba(110,240,255,${s.life})`; ctx.fillRect(Math.round(s.x - cx), Math.round(s.y - cy), 1, 1); }
  if (sub.lights) { const [nx, ny] = nose(); ctx.fillStyle = '#fff3c8'; ctx.fillRect(Math.round(nx - cx), Math.round(ny - cy), 1, 1); }
  ctx.restore();
  // world-space HUD (unlit): sonar, scan ring
  ctx.save(); ctx.translate(-cx, -cy);
  if (ping) { ctx.strokeStyle = `rgba(95,240,208,${Math.max(0, .7 - ping.r / ping.max * .6)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(sub.x), Math.round(sub.y), Math.round(ping.r), 0, TAU); ctx.stroke(); }
  for (const c of Wd.creatures) { if (c.ping > 0) { const [x, y] = Wd.pos(c); if (ping && Math.hypot(x - sub.x, y - sub.y) > ping.r) continue; if (F.save.logged[c.sp.id]) continue; const a = Math.min(1, c.ping / 2); const r = Math.round(4 + c.L * .35); ctx.fillStyle = `rgba(95,240,208,${a})`; bracket(Math.round(x), Math.round(y), r); } }
  if (G.state === 'play' && G.scanTarget) { const [x, y] = Wd.pos(G.scanTarget); const r = Math.round(10 + G.scanTarget.L * .45); ctx.fillStyle = G.scanIssue ? '#ffb547' : '#5ff0d0'; ringPixels(Math.round(x), Math.round(y), r, G.scanIssue ? 1 : G.scanProgress); }
  ctx.restore();
  // hi-res overlay: labels
  drawOverlay(cx, cy);
}

function circ(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), r, 0, TAU); ctx.fill(); }
function bracket(x, y, r) { const L = Math.max(2, Math.round(r * .5)); ctx.fillRect(x - r, y - r, L, 1); ctx.fillRect(x - r, y - r, 1, L); ctx.fillRect(x + r - L + 1, y - r, L, 1); ctx.fillRect(x + r, y - r, 1, L); ctx.fillRect(x - r, y + r, L, 1); ctx.fillRect(x - r, y + r - L + 1, 1, L); ctx.fillRect(x + r - L + 1, y + r, L, 1); ctx.fillRect(x + r, y + r - L + 1, 1, L); }
function ringPixels(x, y, r, p) { const n = Math.max(16, Math.round(r * 5)); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * TAU; if (i / n > p && (i % 3)) continue; ctx.globalAlpha = i / n <= p ? 1 : .35; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); } ctx.globalAlpha = 1; }

function drawCreature(c, x, y, frame) {
  const s = S.get(c.sp, frame);
  const sx = Math.round(x), sy = Math.round(y);
  if (c.face < 0) { ctx.save(); ctx.translate(sx, sy); ctx.scale(-1, 1); ctx.drawImage(s.c, -s.ax, -s.ay); ctx.restore(); }
  else ctx.drawImage(s.c, sx - s.ax, sy - s.ay);
}
function drawKelp(d) {
  const h = Math.round(d.h / 10) * 10, ph = ((t * .9 + d.ph) % TAU + TAU) % TAU;
  const fr = kelpFrame(h, Math.floor(ph / TAU * KELP_STEPS) % KELP_STEPS);
  ctx.drawImage(fr, Math.round(d.x) - 12, Math.round(d.y) - h - 2);
}
function nose() { return [sub.x + sub.face * 17, sub.y + 3]; }
function aimAngle() {
  const [nx, ny] = nose();
  let a;
  if (mouse.active > 0 && G.state === 'play') a = Math.atan2(mouse.y + camY - ny, mouse.x + camX - nx);
  else a = sub.face > 0 ? F.clamp(sub.vy / 160, -.6, .6) : Math.PI - F.clamp(sub.vy / 160, -.6, .6);
  // keep the beam in front of the sub
  if (sub.face > 0) a = F.clamp(a, -1.1, 1.1); else { a = (a + TAU) % TAU; a = F.clamp(a, Math.PI - 1.1, Math.PI + 1.1); }
  sub.aim += (a - sub.aim) * .25; if (Math.abs(a - sub.aim) > 2) sub.aim = a;
  return sub.aim;
}

function collectGlows(cx, cy, out) {
  for (const c of Wd.creatures) {
    if (!c.sp.glow) continue;
    const [x, y] = Wd.pos(c);
    if (x < cx - 60 || x > cx + W + 60 || y < cy - 60 || y > cy + H + 60) continue;
    const pts = [[x, y, c.frame]].concat(c.school.map(([ox, oy, ph]) => [x + ox, y + oy, (c.frame + Math.floor(ph)) % 4]));
    for (const [px, py, fr] of pts) {
      const s = S.get(c.sp, fr), pulse = .65 + .35 * Math.sin(t * 2.4 + c.ph + px * .1);
      for (const o of s.glows) out.push({ x: Math.round(px + o.x * c.face - cx), y: Math.round(py + o.y - cy), r: o.r, c: o.c, a: pulse });
    }
  }
}

function buildLightmap(cx, cy, horizon, night, glowList) {
  const n = night ? .12 : 1;
  for (let y = 0; y < H; y++) {
    const m = F.metersAt(y + cy), v = y < horizon ? (night ? .55 : 1) : Math.max(.075, F.ambient(m) * n + (night && m < 30 ? .05 : 0));
    lm.fill(v, y * W, (y + 1) * W);
  }
  const sx = sub.x - cx, sy = sub.y - cy;
  addPoint(sx, sy, 30, sub.lights ? .55 : .4);
  for (const s of Wd.smokers) { const x = s.x - cx, y = s.y - cy; if (x > -30 && x < W + 30 && y > -30 && y < H + 30) { addPoint(x, y, 26, .32 + Math.sin(t * 7 + s.x) * .05); glowList.push({ x: Math.round(x), y: Math.round(y), r: 1.5, c: '#ff8a3a', a: .7 + Math.sin(t * 9 + s.x) * .3 }); } }
  if (sub.lights) {
    const [nxw, nyw] = nose(), nx = nxw - cx, ny = nyw - cy, a = aimAngle();
    const R = F.up('lights') * (sub.battery < 15 && !F.save.settings.explorer ? .6 : 1), ca = Math.cos(a), sa = Math.sin(a), cosH = Math.cos(.46);
    const x0 = Math.max(0, Math.floor(nx - R)), x1 = Math.min(W - 1, Math.ceil(nx + R)), y0 = Math.max(0, Math.floor(ny - R)), y1 = Math.min(H - 1, Math.ceil(ny + R));
    for (let y = y0; y <= y1; y++) { const dy = y - ny; for (let x = x0; x <= x1; x++) { const dx = x - nx, d2 = dx * dx + dy * dy; if (d2 > R * R || d2 < 1) continue; const d = Math.sqrt(d2), cs = (dx * ca + dy * sa) / d; if (cs < cosH) continue; const edge = Math.min(1, (cs - cosH) / (1 - cosH) * 3); lm[y * W + x] += Math.pow(1 - d / R, .7) * edge * 1.15; } }
  }
  collectGlows(cx, cy, glowList);
  for (const gl of glowList) addPoint(gl.x, gl.y, gl.r * 4 + 5, .6 * gl.a);
  for (const s of sparks) addPoint(s.x - cx, s.y - cy, 4, .5 * s.life);
}
function addPoint(px, py, r, k) {
  const x0 = Math.max(0, Math.floor(px - r)), x1 = Math.min(W - 1, Math.ceil(px + r)), y0 = Math.max(0, Math.floor(py - r)), y1 = Math.min(H - 1, Math.ceil(py + r));
  const r2 = r * r, inv = 1 / r;
  for (let y = y0; y <= y1; y++) { const dy = y - py, row = y * W; for (let x = x0; x <= x1; x++) { const dx = x - px, d2 = dx * dx + dy * dy; if (d2 < r2) { const f = 1 - Math.sqrt(d2) * inv; lm[row + x] += k * f * f; } } }
}
// Turn the light map into a dithered darkness mask (black with alpha) and lay it over the scene.
const ALPHA = new Uint32Array(8);
for (let q = 0; q <= 7; q++) { const a = Math.round((1 - q / 7) * 255); ALPHA[q] = LITTLE ? (a << 24 | 12 << 16 | 6 << 8 | 2) >>> 0 : (2 << 24 | 6 << 16 | 12 << 8 | a) >>> 0; }
function applyLight() {
  const LV = 7, n = W * H;
  for (let y = 0; y < H; y++) { const by = (y & 3) * 4, row = y * W; for (let x = 0; x < W; x++) {
    const i = row + x, L = lm[i];
    mask32[i] = L >= 1 ? 0 : ALPHA[Math.min(LV, Math.floor(L * LV + BAYER[by + (x & 3)]))];
  } }
  mctx.putImageData(maskImg, 0, 0);
  ctx.drawImage(mask, 0, 0);
}

function drawOverlay(cx, cy) {
  const active = G.state === 'play' || G.state === 'emergency';
  if (!active) { if (fxDirty) { fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, fx.width, fx.height); fxDirty = false; } return; }
  fctx.setTransform(DPR, 0, 0, DPR, 0, 0); fctx.clearRect(0, 0, fx.width / DPR, fx.height / DPR); fxDirty = true;
  const set = F.save.settings, K = SCALE;
  fctx.font = `600 ${set.largeText ? 14 : 12}px "Silkscreen", "IBM Plex Mono", monospace`; fctx.textAlign = 'center';
  const tag = (txt, x, y, col, bg = 'rgba(6,16,22,.78)') => { const w = fctx.measureText(txt).width + 12; fctx.fillStyle = bg; fctx.fillRect(Math.round(x - w / 2), Math.round(y - 13), Math.round(w), 18); fctx.fillStyle = col; fctx.fillText(txt, Math.round(x), Math.round(y)); };
  if (set.labels) for (const c of Wd.creatures) {
    if (!F.save.logged[c.sp.id] || c === G.scanTarget) continue;
    const [x, y] = Wd.pos(c), d = Math.hypot(x - sub.x, y - sub.y);
    if (d > 110 || (lightAt(x, y) < .3 && !c.sp.glow)) continue;
    tag(c.sp.name, (x - cx) * K, (y - cy - c.L * .55 - 6) * K, 'rgba(225,240,240,.85)');
  }
  if (G.scanTarget) {
    const c = G.scanTarget, [x, y] = Wd.pos(c), rec = F.save.logged[c.sp.id];
    const msg = G.scanIssue === 'dark' ? 'Too dark · aim your lights' : G.scanIssue === 'fast' ? 'Slow down to scan' : G.scanIssue === 'fled' ? 'It darted away · approach slowly' : rec ? `Studying ${c.sp.name} ${rec.scans}/${F.STUDY_SCANS}` : 'Scanning unknown species…';
    tag(msg, (x - cx) * K, (y - cy - c.L * .5 - 14) * K, G.scanIssue ? '#ffb547' : '#5ff0d0');
  }
  // landmark markers after a ping
  if (ping) for (const l of F.LANDMARKS) { const ly = F.yAt(l.m); const d = Math.hypot(l.x - sub.x, ly - sub.y); if (d < ping.r && d < ping.max && !(session && session.landmarks.includes(l.id))) tag('◇ ' + l.name, (l.x - cx) * K, (ly - cy - 10) * K, '#ffb547'); }
}

/* ---------- radar for the HUD ---------- */
G.drawRadar = (cv) => {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, R = w / 2 - 3;
  c.clearRect(0, 0, w, h);
  c.fillStyle = 'rgba(4,18,24,.85)'; c.beginPath(); c.arc(w / 2, h / 2, R, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(95,240,208,.25)'; c.lineWidth = 1;
  for (const k of [.33, .66, 1]) { c.beginPath(); c.arc(w / 2, h / 2, R * k, 0, TAU); c.stroke(); }
  const range = F.up('sonar');
  // terrain contour
  c.fillStyle = 'rgba(120,110,95,.55)';
  for (let i = -R; i <= R; i += 2) { const wx = sub.x + i / R * range, fy = (F.floorY(wx) - sub.y) / range * R; if (fy < R) c.fillRect(w / 2 + i, h / 2 + Math.max(-R, fy), 2, R - Math.max(-R, fy)); }
  const sw = (t * 2) % TAU; c.strokeStyle = 'rgba(95,240,208,.5)'; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(sw) * R, h / 2 + Math.sin(sw) * R); c.stroke();
  for (const cr of Wd.creatures) { if (cr.ping <= 0 || F.save.logged[cr.sp.id]) continue; const [x, y] = Wd.pos(cr); const dx = (x - sub.x) / range * R, dy = (y - sub.y) / range * R; if (Math.hypot(dx, dy) > R) continue; c.fillStyle = `rgba(95,240,208,${Math.min(1, cr.ping / 2)})`; c.fillRect(Math.round(w / 2 + dx - 1), Math.round(h / 2 + dy - 1), 3, 3); }
  for (const l of F.LANDMARKS) { const dx = (l.x - sub.x) / range * R, dy = (F.yAt(l.m) - sub.y) / range * R; if (Math.hypot(dx, dy) > R) continue; c.fillStyle = '#ffb547'; c.fillRect(Math.round(w / 2 + dx - 2), Math.round(h / 2 + dy), 5, 1); c.fillRect(Math.round(w / 2 + dx), Math.round(h / 2 + dy - 2), 1, 5); }
  c.fillStyle = '#ffb547'; c.fillRect(w / 2 - 2, h / 2 - 1, 5, 3);
  c.save(); c.globalCompositeOperation = 'destination-in'; c.beginPath(); c.arc(w / 2, h / 2, R, 0, TAU); c.fill(); c.restore();
};

/* ---------- loop ---------- */
let slowT = 0, fpsAcc = 0, fpsN = 0, fpsT = 0;
G.fps = 0;
function frame(now) {
  const raw = (now - last) / 1000, dt = Math.min(.05, raw); last = now;
  try {
    update(dt);
    // While paused the scene is frozen, so draw it once and then rest.
    if (G.state !== 'paused' || needsRender) { render(); needsRender = false; }
  } catch (e) { console.error(e); }
  // FPS meter + automatic quality: if frames stay slow, use bigger pixels (fewer to draw).
  if (raw < .25) {
    fpsAcc += raw; fpsN++; fpsT += raw;
    if (fpsT >= .5) { G.fps = Math.round(fpsN / fpsAcc); fpsAcc = fpsN = fpsT = 0; F.emit('fps', G.fps); }
    if (G.state !== 'paused' && F.save.settings.pixel === 'auto' && autoBump < 2) {
      slowT = raw > 1 / 42 ? slowT + raw : Math.max(0, slowT - raw * .5);
      if (slowT > 3) { slowT = 0; autoBump++; G.resize(); }
    }
  }
  requestAnimationFrame(frame);
}
// Advance the simulation by a fixed amount of time (used for automated testing).
G.step = (seconds = 1) => { for (let i = 0; i < seconds * 60; i++) update(1 / 60); render(); };
G.start = () => { G.resize(); addEventListener('resize', G.resize); Wd.build(1, false); camX = -W / 2; camY = -H * .56; requestAnimationFrame(frame); };
})();
