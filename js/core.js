/* Fathom core: math, world scale, save data, settings, upgrades, achievements. */
(() => {
const F = window.Fathom = {};
F.TAU = Math.PI * 2;
F.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
F.lerp = (a, b, t) => a + (b - a) * t;
F.fmt = n => Math.round(n).toLocaleString('en-US');
F.rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
F.hash = (x, y) => { let h = (x | 0) * 374761393 + (y | 0) * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
F.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/* ---------- ocean zones and the compressed depth scale ----------
   Each zone gets a similar amount of screen distance; the HUD always shows true metres. */
F.ZONES = [
  { key: 'epi',    name: 'Sunlight Zone', sci: 'Epipelagic',    top: 0,    bot: 200,   px: 560, color: '#62c6e8', blurb: 'Enough light for algae to grow. Most ocean life you know lives here.' },
  { key: 'meso',   name: 'Twilight Zone', sci: 'Mesopelagic',   top: 200,  bot: 1000,  px: 760, color: '#4a8fd0', blurb: 'Sunlight fades to a dim blue. Plants cannot grow, and many animals make their own light.' },
  { key: 'bathy',  name: 'Midnight Zone', sci: 'Bathypelagic',  top: 1000, bot: 4000,  px: 860, color: '#8580e6', blurb: 'Total darkness. The only light down here is made by animals.' },
  { key: 'abysso', name: 'The Abyss',     sci: 'Abyssopelagic', top: 4000, bot: 6000,  px: 560, color: '#b277d6', blurb: 'Near-freezing water and crushing pressure. Food is scarce, so most life here scavenges.' },
  { key: 'hadal',  name: 'Hadal Zone',    sci: 'Hadalpelagic',  top: 6000, bot: 10935, px: 760, color: '#e86fa8', blurb: 'Deep ocean trenches, named after Hades, Greek god of the underworld.' },
];
let acc = 0; F.ZONES.forEach(z => { z.pxTop = acc; acc += z.px; });
F.WORLD_BOTTOM = acc;
F.WORLD_X = [-1800, 1800];
const ABOVE = F.ZONES[0].px / F.ZONES[0].bot;
F.metersAt = y => {
  if (y <= 0) return y / ABOVE;
  for (const z of F.ZONES) if (y <= z.pxTop + z.px) return z.top + (y - z.pxTop) / z.px * (z.bot - z.top);
  return 10935;
};
F.yAt = m => {
  if (m <= 0) return m * ABOVE;
  for (const z of F.ZONES) if (m <= z.bot) return z.pxTop + (m - z.top) / (z.bot - z.top) * z.px;
  return F.WORLD_BOTTOM;
};
F.zoneIdx = m => { for (let i = 0; i < F.ZONES.length; i++) if (m < F.ZONES[i].bot) return i; return F.ZONES.length - 1; };
F.ambient = m => m <= 0 ? 1 : Math.max(0, Math.exp(-m / 115));
F.sunPct = m => 100 * Math.exp(-Math.max(0, m) / 43.4);  // ~1% left at 200 m in clear water
const TEMP = [[0, 24], [100, 19], [200, 14], [1000, 4.5], [4000, 2], [6000, 1.5], [10935, 2.5]];
F.temp = m => { m = Math.max(0, m); for (let i = 1; i < TEMP.length; i++) if (m <= TEMP[i][0]) { const [a, va] = TEMP[i - 1], [b, vb] = TEMP[i]; return va + (vb - va) * (m - a) / (b - a); } return 2.5; };
F.pressure = m => 1 + Math.max(0, m) / 10.06;

/* ---------- seafloor profile (x in world px, depth in metres) ---------- */
F.FLOOR = [
  [-1800, -22], [-1765, -8], [-1740, 0], [-1700, 6], [-1640, 12], [-1560, 17], [-1460, 24], [-1400, 30], [-1330, 42],
  [-1270, 110], [-1200, 380], [-1120, 800], [-1030, 1350], [-930, 2050], [-830, 2750], [-760, 3120], [-640, 3700],
  [-520, 3950], [-420, 4300], [-300, 4620], [-210, 5300], [-140, 7000], [-90, 9200], [-45, 10935], [45, 10935],
  [90, 9300], [150, 7200], [215, 5300], [320, 4720], [560, 4800], [800, 4680], [950, 4050], [1080, 3350], [1200, 2700],
  [1260, 2520], [1400, 2530], [1480, 2800], [1580, 3400], [1700, 4100], [1800, 4400],
];
F.floorM = x => {
  const P = F.FLOOR;
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [a, ma] = P[i - 1], [b, mb] = P[i]; return ma + (mb - ma) * (x - a) / (b - a); }
  return P[P.length - 1][1];
};
F.floorY = x => F.yAt(F.floorM(x)) + (F.hash(x | 0, 7) < .2 ? 1 : 0);

/* ---------- storage ---------- */
const KEY = 'fathom.save.v2';
F.defaultSettings = () => ({
  master: .8, music: .55, sfx: .8, ambience: .7, muted: false,
  pixel: 'auto', scanlines: true, showFps: false, shake: true, reducedMotion: false,
  explorer: false, labels: true, hints: true, autoLights: true,
  largeText: false, contrast: false, online: true,
});
F.defaultSave = () => ({
  v: 2, rp: 0, rpTotal: 0, dives: 0, nightDives: 0, maxDepth: 0, pings: 0, quizRight: 0, playSeconds: 0,
  logged: {}, landmarks: {}, achievements: {}, upgrades: { hull: 0, battery: 0, lights: 0, sonar: 0, thrusters: 0, scanner: 0 },
  daily: null, seenIntro: false, settings: F.defaultSettings(),
});
F.load = () => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const d = F.defaultSave();
  if (!s || typeof s !== 'object') return d;
  return { ...d, ...s, upgrades: { ...d.upgrades, ...(s.upgrades || {}) }, settings: { ...d.settings, ...(s.settings || {}) } };
};
F.storageOK = (() => { try { localStorage.setItem(KEY + '.test', '1'); localStorage.removeItem(KEY + '.test'); return true; } catch (e) { return false; } })();
F.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(F.save)); F.lastSaved = Date.now(); } catch (e) { F.storageOK = false; } };
F.save = F.load();

// Ask the browser not to clear our storage when space runs low (no prompt in Chrome/Edge/Safari).
F.protectStorage = async () => {
  try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) {}
  try { F.storageProtected = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch (e) { F.storageProtected = false; }
  return F.storageProtected;
};

/* ---------- tiny event bus ---------- */
const handlers = {};
F.on = (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn);
F.emit = (ev, data) => (handlers[ev] || []).forEach(fn => fn(data));

/* ---------- species ---------- */
F.SPECIES = (window.FATHOM_SPECIES || []).map(s => ({ ...s, zi: F.zoneIdx(s.m) }));
F.LANDMARKS = window.FATHOM_LANDMARKS || [];
F.byId = Object.fromEntries(F.SPECIES.map(s => [s.id, s]));
F.RARITY = {
  common:    { label: 'Common',    rp: 10, color: '#a9bcc2' },
  uncommon:  { label: 'Uncommon',  rp: 20, color: '#6fd3ff' },
  rare:      { label: 'Rare',      rp: 40, color: '#c99bff' },
  legendary: { label: 'Legendary', rp: 80, color: '#ffb547' },
};
F.STUDY_SCANS = 3;
F.isLogged = id => !!F.save.logged[id];
F.loggedCount = () => Object.keys(F.save.logged).filter(id => F.byId[id]).length;
F.studiedCount = () => Object.entries(F.save.logged).filter(([id, r]) => F.byId[id] && r.scans >= F.STUDY_SCANS).length;

/* ---------- hangar upgrades ---------- */
F.UPGRADES = [
  { id: 'hull', name: 'Pressure hull', unit: 'm rating', desc: 'How deep the sub can safely go. Past the rating the hull starts to fail.',
    levels: [
      { v: 1000,  c: 0,   note: 'Steel sphere' },
      { v: 2000,  c: 60,  note: 'Thick steel' },
      { v: 4500,  c: 150, note: "Titanium. Alvin's rating before its 2022 refit" },
      { v: 6500,  c: 300, note: "Titanium II. Alvin's rating since 2022" },
      { v: 11000, c: 520, note: 'Full ocean depth, like DSV Limiting Factor' } ] },
  { id: 'battery', name: 'Battery', unit: 'charge', desc: 'Powers lights, sonar and boost. Recharges at the surface.',
    levels: [ { v: 120, c: 0 }, { v: 200, c: 50 }, { v: 330, c: 120 }, { v: 520, c: 240 } ] },
  { id: 'lights', name: 'Headlights', unit: 'px range', desc: 'How far the light cone reaches in the dark.',
    levels: [ { v: 92, c: 0 }, { v: 116, c: 40 }, { v: 142, c: 100 }, { v: 172, c: 200 } ] },
  { id: 'sonar', name: 'Sonar', unit: 'px range', desc: 'Ping range for revealing animals you have not logged yet.',
    levels: [ { v: 200, c: 0 }, { v: 300, c: 40 }, { v: 420, c: 110 }, { v: 560, c: 220 } ] },
  { id: 'thrusters', name: 'Thrusters', unit: 'speed', desc: 'Cruising speed. Boost doubles it.',
    levels: [ { v: 54, c: 0 }, { v: 64, c: 40 }, { v: 76, c: 100 }, { v: 90, c: 200 } ] },
  { id: 'scanner', name: 'Scanner', unit: 's per scan', desc: 'Time needed to log an animal.',
    levels: [ { v: 1.8, c: 0 }, { v: 1.4, c: 40 }, { v: 1.05, c: 100 }, { v: .75, c: 200 } ] },
];
F.up = id => { const u = F.UPGRADES.find(x => x.id === id); return u.levels[Math.min(F.save.upgrades[id] || 0, u.levels.length - 1)].v; };
F.hullRating = () => F.save.settings.explorer ? 11000 : F.up('hull');

/* ---------- achievements ---------- */
const countIn = (pred) => Object.keys(F.save.logged).filter(id => F.byId[id] && pred(F.byId[id])).length;
const hasAll = ids => ids.every(id => F.save.logged[id]);
F.ACHIEVEMENTS = [
  { id: 'first-splash', icon: '~', name: 'First Splash', desc: 'Make your first dive.', check: s => s.dives >= 1 },
  { id: 'first-contact', icon: '!', name: 'First Contact', desc: 'Log your first species.', check: () => F.loggedCount() >= 1 },
  { id: 'twilight', icon: '▼', name: 'Twilight Diver', desc: 'Reach 200 m.', check: s => s.maxDepth >= 200 },
  { id: 'midnight', icon: '▼', name: 'Midnight Explorer', desc: 'Reach 1,000 m.', check: s => s.maxDepth >= 1000 },
  { id: 'abyss', icon: '▼', name: 'Into the Abyss', desc: 'Reach 4,000 m.', check: s => s.maxDepth >= 4000 },
  { id: 'hadal', icon: '▼', name: 'Hadal Pioneer', desc: 'Reach 6,000 m.', check: s => s.maxDepth >= 6000 },
  { id: 'challenger', icon: '★', name: 'Full Ocean Depth', desc: 'Touch the floor of the Challenger Deep.', check: s => !!s.landmarks.challenger },
  { id: 'log-10', icon: '10', name: 'Field Biologist', desc: 'Log 10 species.', goal: 10, prog: () => F.loggedCount(), check: () => F.loggedCount() >= 10 },
  { id: 'log-30', icon: '30', name: 'Naturalist', desc: 'Log 30 species.', goal: 30, prog: () => F.loggedCount(), check: () => F.loggedCount() >= 30 },
  { id: 'log-60', icon: '60', name: 'Marine Biologist', desc: 'Log 60 species.', goal: 60, prog: () => F.loggedCount(), check: () => F.loggedCount() >= 60 },
  { id: 'log-100', icon: '100', name: 'Living Encyclopedia', desc: 'Log 100 species.', goal: 100, prog: () => F.loggedCount(), check: () => F.loggedCount() >= 100 },
  { id: 'log-all', icon: '∞', name: 'Complete Census', desc: 'Log every species in the field guide.', goal: () => F.SPECIES.length, prog: () => F.loggedCount(), check: () => F.loggedCount() >= F.SPECIES.length },
  { id: 'glow-10', icon: '✦', name: 'Glow Collector', desc: 'Log 10 animals that make their own light.', goal: 10, prog: () => countIn(s => s.glow), check: () => countIn(s => s.glow) >= 10 },
  { id: 'giants', icon: 'W', name: 'Gentle Giants', desc: 'Log the blue whale, whale shark, humpback and sperm whale.', check: () => hasAll(['blue-whale', 'whale-shark', 'humpback', 'sperm-whale']) },
  { id: 'reef', icon: 'R', name: 'Reef Keeper', desc: 'Log 12 coral reef species.', goal: 12, prog: () => countIn(s => s.hab === 'reef'), check: () => countIn(s => s.hab === 'reef') >= 12 },
  { id: 'vents', icon: 'V', name: 'Vent Hunter', desc: 'Log 5 hydrothermal vent species.', goal: 5, prog: () => countIn(s => s.hab === 'vent'), check: () => countIn(s => s.hab === 'vent') >= 5 },
  { id: 'fossils', icon: 'F', name: 'Living Fossils', desc: 'Log the coelacanth, chambered nautilus and frilled shark.', check: () => hasAll(['coelacanth', 'nautilus', 'frilled-shark']) },
  { id: 'cephalopods', icon: 'C', name: 'Eight Arms, Ten Arms', desc: 'Log 10 octopuses, squid and their relatives.', goal: 10, prog: () => countIn(s => /octopus|squid|nautilus/.test(s.art.t)), check: () => countIn(s => /octopus|squid|nautilus/.test(s.art.t)) >= 10 },
  { id: 'legend', icon: '◆', name: 'Legendary Find', desc: 'Log a legendary species.', check: () => countIn(s => s.rarity === 'legendary') >= 1 },
  { id: 'night', icon: '☾', name: 'Night Shift', desc: 'Complete a night dive.', check: s => s.nightDives >= 1 },
  { id: 'study-10', icon: 'S', name: 'Studious', desc: 'Study 10 species (3 scans each).', goal: 10, prog: () => F.studiedCount(), check: () => F.studiedCount() >= 10 },
  { id: 'landmarks', icon: 'L', name: 'Cartographer', desc: 'Visit every landmark.', goal: () => F.LANDMARKS.length, prog: s => Object.keys(s.landmarks).length, check: s => Object.keys(s.landmarks).length >= F.LANDMARKS.length },
  { id: 'quiz-10', icon: '?', name: 'Sharp Memory', desc: 'Answer 10 debrief questions correctly.', goal: 10, prog: s => s.quizRight, check: s => s.quizRight >= 10 },
  { id: 'sonar-50', icon: ')', name: 'Echo Location', desc: 'Send 50 sonar pings.', goal: 50, prog: s => s.pings, check: s => s.pings >= 50 },
  { id: 'daily', icon: 'D', name: 'Daily Diver', desc: 'Complete a daily expedition.', check: s => !!(s.daily && s.daily.done) || !!s.achievements.daily },
  { id: 'max-hull', icon: 'H', name: 'Full Ocean Depth Hull', desc: 'Upgrade the pressure hull to its final level.', check: s => s.upgrades.hull >= 4 },
];
F.checkAchievements = () => {
  const got = [];
  for (const a of F.ACHIEVEMENTS) {
    if (F.save.achievements[a.id]) continue;
    let ok = false; try { ok = a.check(F.save); } catch (e) {}
    if (ok) { F.save.achievements[a.id] = F.today(); got.push(a); }
  }
  if (got.length) { F.persist(); got.forEach(a => F.emit('achievement', a)); }
  return got;
};

/* ---------- save codes ----------
   All progress packed into ~90 characters: a version byte, the species count, 2 bits per species
   (scans: 0 none, 1, 2, 3 = studied), landmark and award bitsets, upgrade levels, a few counters
   as varints, and a checksum. Species are encoded by position in the species list, so new
   species must always be appended to the end of tools/species.source.mjs. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const toB64 = bytes => { let s = '', i = 0; for (; i + 2 < bytes.length; i += 3) { const n = bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2]; s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + B64[n >> 6 & 63] + B64[n & 63]; }
  const r = bytes.length - i; if (r) { const n = bytes[i] << 16 | (r > 1 ? bytes[i + 1] << 8 : 0); s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (r > 1 ? B64[n >> 6 & 63] : ''); } return s; };
const fromB64 = s => { const out = []; let buf = 0, bits = 0; for (const ch of s) { const v = B64.indexOf(ch); if (v < 0) throw new Error('bad char'); buf = buf << 6 | v; bits += 6; if (bits >= 8) { bits -= 8; out.push(buf >> bits & 255); } } return out; };
const bitsOut = (bytes, flags) => { for (let i = 0; i < flags.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) if (flags[i + j]) b |= 1 << j; bytes.push(b); } };
const bitsIn = (bytes, pos, n) => { const f = []; for (let i = 0; i < n; i++) f.push(!!(bytes[pos + (i >> 3)] >> (i & 7) & 1)); return f; };
const varOut = (bytes, n) => { n = Math.max(0, Math.floor(n || 0)); do { let b = n & 127; n = Math.floor(n / 128); if (n) b |= 128; bytes.push(b); } while (n); };
const varIn = (bytes, p) => { let n = 0, mul = 1, b; do { b = bytes[p.i++]; if (b === undefined) throw new Error('short'); n += (b & 127) * mul; mul *= 128; } while (b & 128); return n; };
const COUNTERS = ['rp', 'rpTotal', 'dives', 'nightDives', 'maxDepth', 'pings', 'quizRight', 'playSeconds'];

F.encodeSave = (s = F.save) => {
  const bytes = [1], n = F.SPECIES.length;
  bytes.push(n & 255, n >> 8);
  const sc = []; F.SPECIES.forEach(sp => { const r = s.logged[sp.id]; const v = r ? Math.min(3, r.scans || 1) : 0; sc.push(!!(v & 1), !!(v & 2)); });
  bitsOut(bytes, sc);
  bitsOut(bytes, F.LANDMARKS.map(l => !!s.landmarks[l.id]));
  bitsOut(bytes, F.ACHIEVEMENTS.map(a => !!s.achievements[a.id]));
  F.UPGRADES.forEach(u => bytes.push(s.upgrades[u.id] || 0));
  COUNTERS.forEach(k => varOut(bytes, s[k]));
  bytes.push(bytes.reduce((a, b) => (a * 31 + b) & 255, 7));
  return toB64(bytes);
};
F.decodeSave = code => {
  const bytes = fromB64(String(code).trim().replace(/^.*[#&]save=/, '').replace(/[^A-Za-z0-9_-]/g, ''));
  const sum = bytes.pop();
  if (bytes.reduce((a, b) => (a * 31 + b) & 255, 7) !== sum) throw new Error('checksum');
  if (bytes[0] !== 1) throw new Error('version');
  const n = bytes[1] | bytes[2] << 8; let pos = 3;
  const sc = bitsIn(bytes, pos, n * 2); pos += Math.ceil(n * 2 / 8);
  const lm = bitsIn(bytes, pos, F.LANDMARKS.length); pos += Math.ceil(F.LANDMARKS.length / 8);
  const ac = bitsIn(bytes, pos, F.ACHIEVEMENTS.length); pos += Math.ceil(F.ACHIEVEMENTS.length / 8);
  const s = F.defaultSave(), today = F.today();
  for (let i = 0; i < Math.min(n, F.SPECIES.length); i++) { const v = (sc[i * 2] ? 1 : 0) | (sc[i * 2 + 1] ? 2 : 0); if (v) { const sp = F.SPECIES[i]; s.logged[sp.id] = { scans: v, first: today, depth: sp.m, night: false }; } }
  F.LANDMARKS.forEach((l, i) => { if (lm[i]) s.landmarks[l.id] = today; });
  F.ACHIEVEMENTS.forEach((a, i) => { if (ac[i]) s.achievements[a.id] = today; });
  F.UPGRADES.forEach(u => { s.upgrades[u.id] = Math.min(u.levels.length - 1, bytes[pos++] || 0); });
  const p = { i: pos }; COUNTERS.forEach(k => { s[k] = varIn(bytes, p); });
  return s;
};
// Combine two saves without losing anything: union of discoveries, best of every counter.
F.mergeSave = (a, b) => {
  const out = { ...a, logged: { ...a.logged }, landmarks: { ...b.landmarks, ...a.landmarks }, achievements: { ...b.achievements, ...a.achievements }, upgrades: { ...a.upgrades } };
  for (const [id, r] of Object.entries(b.logged)) { const mine = out.logged[id]; out.logged[id] = mine ? { ...mine, scans: Math.max(mine.scans, r.scans) } : { ...r }; }
  for (const k of Object.keys(out.upgrades)) out.upgrades[k] = Math.max(a.upgrades[k] || 0, b.upgrades[k] || 0);
  COUNTERS.forEach(k => { out[k] = Math.max(a[k] || 0, b[k] || 0); });
  return out;
};
F.saveSummary = s => ({ logged: Object.keys(s.logged).filter(id => F.byId[id]).length, rp: s.rp, dives: s.dives, maxDepth: s.maxDepth });
F.saveLink = () => location.origin + location.pathname + '#save=' + F.encodeSave();

/* ---------- daily expedition ---------- */
F.dailyGoal = () => {
  const date = F.today();
  if (F.save.daily && F.save.daily.date === date) return F.save.daily;
  const r = F.rng([...date].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const hull = F.hullRating();
  const groups = ['Fish', 'Mollusc', 'Cnidarian', 'Crustacean', 'Mammal', 'Shark & ray'];
  const zoneOk = F.ZONES.map((z, i) => i).filter(i => F.ZONES[i].top < hull);
  const pool = [
    () => { const zi = zoneOk[Math.floor(r() * zoneOk.length)]; return { kind: 'zone', zi, n: 3, text: `Scan 3 animals in the ${F.ZONES[zi].name}` }; },
    () => { const depths = [150, 400, 800, 1500, 3000, 5000, 8000].filter(d => d <= hull * .9); const d = depths[Math.floor(r() * depths.length)] || 150; return { kind: 'depth', m: d, n: 1, text: `Reach ${F.fmt(d)} m` }; },
    () => ({ kind: 'glow', n: 2, text: 'Scan 2 animals that make their own light' }),
    () => { const g = groups[Math.floor(r() * groups.length)]; return { kind: 'group', group: g, n: 2, text: `Scan 2 animals from the group: ${g}` }; },
    () => ({ kind: 'new', n: 2, text: 'Log 2 species you have never seen before' }),
    () => ({ kind: 'landmark', n: 1, text: 'Visit any landmark' }),
    () => ({ kind: 'ping', n: 10, text: 'Send 10 sonar pings' }),
  ];
  const g = pool[Math.floor(r() * pool.length)]();
  F.save.daily = { date, ...g, progress: 0, done: false, reward: 60 };
  F.persist();
  return F.save.daily;
};
F.dailyEvent = (ev) => {
  const d = F.dailyGoal();
  if (d.done) return;
  let inc = 0;
  if (ev.type === 'scan') {
    const sp = ev.species;
    if (d.kind === 'zone' && sp.zi === d.zi) inc = 1;
    if (d.kind === 'glow' && sp.glow) inc = 1;
    if (d.kind === 'group' && sp.group === d.group) inc = 1;
    if (d.kind === 'new' && ev.isNew) inc = 1;
  }
  if (ev.type === 'depth' && d.kind === 'depth' && ev.m >= d.m) { d.progress = 1; inc = 0; }
  if (ev.type === 'landmark' && d.kind === 'landmark') inc = 1;
  if (ev.type === 'ping' && d.kind === 'ping') inc = 1;
  d.progress = Math.min(d.n, d.progress + inc);
  if (d.progress >= d.n && !d.done) {
    d.done = true; F.save.rp += d.reward; F.save.rpTotal += d.reward;
    F.emit('daily', d);
  }
  F.persist();
};
})();
