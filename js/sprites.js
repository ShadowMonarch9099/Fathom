/* Fathom sprites.
   Every creature is drawn once with vector shapes at its in-game pixel size, then "pixelated":
   alpha is snapped to hard edges, colours are posterised and a dark outline is added.
   Results are cached per species and animation frame. */
(() => {
const F = window.Fathom, TAU = F.TAU;
const S = F.sprites = {};
const FRAMES = 4;

/* ---------- colour helpers ---------- */
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const shade = (h, k) => { const [r, g, b] = hexRgb(h); const f = v => Math.max(0, Math.min(255, Math.round(k < 1 ? v * k : v + (255 - v) * (k - 1)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
S.shade = shade;

/* ---------- drawing helpers (g is centred, facing right) ---------- */
let g, glows;
const fill = c => { g.fillStyle = c; };
const ell = (x, y, rx, ry, c, rot = 0) => { fill(c); g.beginPath(); g.ellipse(x, y, Math.max(.4, rx), Math.max(.4, ry), rot, 0, TAU); g.fill(); };
const circ = (x, y, r, c) => ell(x, y, r, r, c);
const poly = (pts, c) => { fill(c); g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
const line = (pts, w, c, cap = 'round') => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = cap; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
const quad = (x0, y0, cx, cy, x1, y1, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); };
const px = (x, y, c, s = 1) => { fill(c); g.fillRect(Math.round(x), Math.round(y), s, s); };
const glow = (x, y, r, c) => glows.push({ x, y, r, c });
const eye = (x, y, r) => { if (r <= 0) return; circ(x, y, Math.max(.9, r), '#f4f7f5'); circ(x + r * .3, y, Math.max(.6, r * .6), '#0a1116'); };
const GLOW = { blue: '#7fd8ff', teal: '#7ff5d8', green: '#9dff9a', red: '#ff5a4a', pink: '#ff8fc0', violet: '#b9a0ff' };

/* ---------- archetypes ---------- */
const D = {};

D.fish = (L, a, p) => {
  const w = Math.sin(p * TAU), k = a.k;
  let h = (a.h || .32) * L, c1 = a.c1, c2 = a.c2 || shade(c1, 1.5);
  const bx = .06 * L, rx = .42 * L, ry = h / 2;
  if (k === 'flat') { ell(0, 0, .48 * L, ry, c1); spots(L, ry, c2, 7); eye(.3 * L, -ry * .6, .06 * L); eye(.36 * L, -ry * .2, .06 * L); fin(-.3 * L, -ry, .5 * L, .12 * L, shade(c1, .8)); return; }
  if (k === 'hatchet') {
    poly([[.42 * L, -.05 * L], [.2 * L, -.28 * L], [-.2 * L, -.25 * L], [-.3 * L, 0], [-.18 * L, .3 * L], [.25 * L, .22 * L]], c1);
    poly([[-.28 * L, 0], [-.48 * L, -.12 * L + w], [-.48 * L, .12 * L + w]], c2);
    for (let i = 0; i < 6; i++) glow(-.12 * L + i * .07 * L, .2 * L - Math.abs(i - 2.5) * .01 * L, 2, GLOW.blue);
    eye(.28 * L, -.1 * L, .1 * L); return;
  }
  if (k === 'blob') { ell(.05 * L, 0, .4 * L, .3 * L, c1); ell(.32 * L, .08 * L, .14 * L, .1 * L, c2); poly([[-.3 * L, 0], [-.5 * L, -.1 * L + w], [-.5 * L, .12 * L + w]], c1); eye(.2 * L, -.08 * L, .06 * L); return; }
  if (k === 'snail') { ell(.15 * L, 0, .3 * L, .22 * L, c1); poly([[0, -.2 * L], [-.5 * L, w * .05 * L], [0, .2 * L]], c1); ell(.2 * L, .06 * L, .2 * L, .1 * L, c2); eye(.32 * L, -.06 * L, .05 * L); return; }
  // tail
  const tx = bx - rx * .92, tc = shade(c1, .85);
  if (a.tail === 'round') ell(tx - .1 * L, w * .03 * L, .13 * L, ry * .75, tc);
  else if (a.tail === 'lunate') poly([[tx + .02 * L, 0], [tx - .2 * L, -ry * 1.3 + w], [tx - .1 * L, 0], [tx - .2 * L, ry * 1.3 + w]], tc);
  else if (a.tail === 'rat') { poly([[bx - rx * .3, -ry * .8], [bx - rx * 1.25, w * .04 * L], [bx - rx * .3, ry * .8]], c1); }
  else if (a.tail === 'coel') { poly([[tx, -ry * .5], [tx - .18 * L, -ry * .8 + w], [tx - .18 * L, ry * .8 + w], [tx, ry * .5]], tc); ell(tx - .2 * L, w, .05 * L, .04 * L, tc); }
  else poly([[tx + .04 * L, 0], [tx - .16 * L, -ry * 1.05 + w], [tx - .07 * L, 0], [tx - .16 * L, ry * 1.05 + w]], tc);
  // dorsal + special fins
  if (a.fin === 'sail') poly([[.28 * L, -ry * .6], [.2 * L, -ry * 3.2], [-.1 * L, -ry * 3], [-.25 * L, -ry * .7]], shade(c1, 1.15));
  else if (a.fin === 'long') poly([[.3 * L, -ry * .9], [.2 * L, -ry * 1.5], [-.3 * L, -ry * 1.1], [-.32 * L, -ry * .5]], shade(c1, .9));
  else if (a.fin === 'streamer') { poly([[.15 * L, -ry * .8], [.02 * L, -ry * 1.6], [-.1 * L, -ry * .8]], '#111'); quad(.02 * L, -ry * 1.6, -.3 * L, -ry * 2.4 + w * 2, -.55 * L, -ry * 1.6, 1, '#eee8d0'); }
  else if (a.fin === 'spines') { for (let i = 0; i < 7; i++) line([[.2 * L - i * .07 * L, -ry * .6], [.18 * L - i * .09 * L, -ry * (1.6 + (i % 2) * .3)]], 1, c2); for (let i = 0; i < 5; i++) line([[.1 * L, ry * .2], [-.25 * L + i * .05 * L, ry * (1.8 + i * .1)]], 1, shade(c1, 1.2)); }
  else if (a.fin !== 'none') fin(.12 * L, -ry * .85, .22 * L, ry * .65, shade(c1, .85));
  if (a.fin === 'wing') poly([[.15 * L, 0], [-.2 * L, -ry * 2.2 - w], [-.3 * L, -ry * 1.6], [-.05 * L, ry * .1]], shade(c1, 1.25));
  if (a.fin === 'lobed') { ell(.05 * L, ry * .9, .07 * L, .04 * L, shade(c1, .8), .6); ell(-.15 * L, ry * .9, .07 * L, .04 * L, shade(c1, .8), .6); }
  // body
  const cy = k === 'swallower' ? .04 * L : 0;
  ell(bx, cy, rx, ry, c1);
  ell(bx + .02 * L, ry * .4 + cy, rx * .85, ry * .45, c2);
  if (k === 'swallower') ell(0, ry * .9, .2 * L, .14 * L, '#3a2a30');
  if (a.head === 'blunt') { fill(c1); g.fillRect(bx + rx * .55, -ry * .85, rx * .35, ry * 1.4); ell(bx + rx * .85, -ry * .1, rx * .12, ry * .75, c1); }
  if (a.head === 'bump') ell(bx + rx * .65, -ry * .7, rx * .28, ry * .45, shade(c1, 1.1));
  if (a.head === 'flat') ell(bx + rx * .6, 0, rx * .4, ry * .7, c1);
  // patterns (clipped to the body)
  g.save(); g.beginPath(); g.ellipse(bx, cy, rx, ry, 0, 0, TAU); g.clip();
  const pat = a.pattern;
  if (pat === 'bars') for (let i = 0; i < 5; i++) g.fillStyle = shade(c1, .55), g.fillRect(bx - rx * .6 + i * rx * .3, -ry * .8, Math.max(1, L * .03), ry * 1.5);
  if (pat === 'stripe') { fill('#16212a'); g.fillRect(bx - rx, -ry * .12, rx * 1.9, Math.max(1, ry * .3)); }
  if (pat === 'spots') spots(L, ry, a.c3 || shade(c1, 1.7), 9);
  if (pat === 'mottle') spots(L, ry, shade(c1, .6), 12);
  if (pat === 'clown') for (const x of [.32, .02, -.24]) { fill('#141414'); g.fillRect(bx + x * L - 1.5, -ry, 4, ry * 2); fill('#fbfbf8'); g.fillRect(bx + x * L - .5, -ry, 2, ry * 2); }
  if (pat === 'tang') { poly([[bx + rx * .5, -ry * .5], [bx - rx * .2, -ry * .3], [bx - rx * .8, -ry * .05], [bx - rx * .2, ry * .1], [bx + rx * .3, -ry * .05]], '#0b0f2a'); ell(tx - .06 * L, 0, .08 * L, ry * .5, a.c2); }
  if (pat === 'idol') { fill('#111'); g.fillRect(bx + .08 * L, -ry, .1 * L, ry * 2); g.fillRect(bx - .25 * L, -ry, .1 * L, ry * 2); ell(bx + rx * .8, ry * .2, rx * .18, ry * .2, '#e07a2a'); }
  if (pat === 'swirl') for (let i = 0; i < 4; i++) quad(bx - rx * .7 + i * rx * .4, -ry * .6, bx - rx * .5 + i * rx * .4, 0, bx - rx * .7 + i * rx * .4, ry * .6, 1, a.c2);
  g.restore();
  // photophores
  if (a.photo === 'row') for (let i = 0; i < 6; i++) glow(bx - rx * .7 + i * rx * .28, ry * .6, 1.6, GLOW.blue);
  if (a.photo === 'belly') for (let i = 0; i < 5; i++) glow(bx - rx * .6 + i * rx * .3, ry * .8, 1.5, GLOW.blue);
  // heads, mouths, specials
  const ex = bx + rx * .7, ey = -ry * .25, er = (a.eye == null ? 1 : a.eye) * Math.max(1, L * .045);
  if (a.bill) line([[bx + rx * .9, -ry * .1], [bx + rx + .38 * L, -ry * .05]], Math.max(1, L * .025), shade(c1, .8));
  if (a.barbel) line([[bx + rx * .85, ry * .5], [bx + rx * .85, ry * 1.1]], 1, c2);
  if (k === 'viper') { line([[bx + rx * .85, ry * .1], [bx + rx * 1.05, ry * 1.5]], 1, '#f4f2ea'); line([[bx + rx * .7, -ry * .2], [bx + rx * .95, -ry * 1.6]], 1, '#f4f2ea'); quad(bx + rx * .2, -ry, bx + .1 * L, -ry * 3, bx + rx * .9, -ry * 2.6, 1, c2); glow(bx + rx * .9, -ry * 2.6, 2, GLOW.blue); }
  if (k === 'loosejaw') { line([[bx + rx * .5, ry * .2], [bx + rx * 1.2, ry * .9]], 1.5, c2); glow(bx + rx * .55, -ry * .05, 2.4, GLOW.red); glow(bx + rx * .5, ry * .35, 1.8, GLOW.green); }
  if (k === 'fang') { for (const x of [.75, .9]) { line([[bx + rx * x, ry * .2], [bx + rx * x, -ry * .5]], 1, '#f4f2ea'); } }
  if (k === 'barreleye') { g.globalAlpha = .55; ell(bx + rx * .45, -ry * .55, rx * .55, ry * .75, '#bff5e6'); g.globalAlpha = 1; ell(bx + rx * .45, -ry * .55, rx * .1, ry * .35, '#4fe07a'); }
  if (k === 'tripod') { line([[bx - rx * .2, ry * .5], [bx - rx * .1, ry * 3]], 1, c2); line([[bx + rx * .3, ry * .5], [bx + rx * .35, ry * 3]], 1, c2); line([[tx, ry * .2], [tx - .05 * L, ry * 3]], 1, c2); }
  if (a.teeth && k !== 'viper' && k !== 'fang') { px(bx + rx * .9, ry * .05, '#f4f2ea'); px(bx + rx * .75, ry * .1, '#f4f2ea'); }
  if (a.finlets) for (let i = 0; i < 4; i++) px(tx + .05 * L + i * .05 * L, -ry * .55, a.c3 || '#e6c84a');
  eye(ex, ey, k === 'tripod' || k === 'snail' ? er * .5 : er);
};
function fin(x, y, w, h, c) { poly([[x + w * .5, y + h * .4], [x, y - h * .6], [x - w * .5, y + h * .4]], c); }
function spots(L, ry, c, n) { const r = F.rng(n * 97 + Math.round(L)); for (let i = 0; i < n; i++) px((r() - .5) * .7 * L, (r() - .5) * ry * 1.2, c, L > 40 ? 2 : 1); }

D.shark = (L, a, p) => {
  const w = Math.sin(p * TAU), c1 = a.c1, c2 = a.c2, k = a.k;
  const ry = (k === 'whale' || k === 'basking' || k === 'megamouth' || k === 'sleeper' ? .14 : .11) * L;
  // tail (heterocercal)
  poly([[-.38 * L, -ry * .3], [-.58 * L, -ry * 2.4 + w * 2], [-.5 * L, 0], [-.55 * L, ry * 1.2 + w]], shade(c1, .9));
  // dorsal + pectoral
  poly([[.05 * L, -ry * .8], [-.06 * L, -ry * (k === 'sleeper' ? 1.5 : 2.4)], [-.16 * L, -ry * .8]], shade(c1, .9));
  poly([[.12 * L, ry * .5], [-.06 * L, ry * 2.1], [.0 * L, ry * .5]], shade(c1, .85));
  poly([[-.3 * L, -ry * .5], [-.34 * L, -ry * 1.2], [-.38 * L, -ry * .4]], shade(c1, .9));
  // body
  g.fillStyle = c1; g.beginPath(); g.moveTo(-.48 * L, 0);
  g.quadraticCurveTo(-.2 * L, -ry * 1.2, .3 * L, -ry * .9);
  if (k === 'whale' || k === 'megamouth') g.quadraticCurveTo(.5 * L, -ry * .6, .5 * L, ry * .2); else g.quadraticCurveTo(.5 * L, -ry * .5, .52 * L, ry * .1);
  g.quadraticCurveTo(.3 * L, ry * 1.1, -.48 * L, 0); g.fill();
  g.fillStyle = c2; g.beginPath(); g.moveTo(-.4 * L, ry * .1); g.quadraticCurveTo(.1 * L, ry * 1.05, .48 * L, ry * .25); g.quadraticCurveTo(.1 * L, ry * .35, -.4 * L, ry * .1); g.fill();
  if (a.pattern === 'bars') for (let i = 0; i < 6; i++) { fill(shade(c1, .7)); g.fillRect(-.3 * L + i * .1 * L, -ry * .8, 1, ry * .8); }
  if (a.spots) spots(L * .8, ry, '#e8eef0', 22);
  if (a.tips) { px(-.06 * L, -ry * 2.3, '#fff', 2); px(-.57 * L, -ry * 2.3 + w * 2, '#fff', 2); }
  for (let i = 0; i < (k === 'basking' ? 5 : 3); i++) line([[.2 * L - i * .03 * L, -ry * (k === 'basking' ? .8 : .3)], [.19 * L - i * .03 * L, ry * .5]], 1, shade(c1, .6));
  if (k === 'hammer') { poly([[.44 * L, -ry * .2], [.5 * L, -ry * 1.6], [.55 * L, -ry * 1.6], [.55 * L, ry * .9], [.5 * L, ry * .9]], c1); eye(.52 * L, -ry * 1.4, 1); return; }
  if (k === 'goblin') { poly([[.45 * L, -ry * .5], [.68 * L, -ry * .2], [.45 * L, ry * .1]], shade(c1, 1.1)); poly([[.34 * L, ry * .5], [.48 * L, ry * .9], [.3 * L, ry * .9]], '#f4e6e0'); }
  if (k === 'basking' || k === 'megamouth') ell(.44 * L, ry * .35, .07 * L, ry * .45, '#1c1a1e');
  if (k === 'cookie') { fill(shade(c1, .5)); g.fillRect(.18 * L, -ry, 2, ry * 2); for (let i = 0; i < 6; i++) glow(-.3 * L + i * .1 * L, ry * .6, 1.4, GLOW.green); }
  eye(.38 * L, -ry * .3, Math.max(.9, L * .02 * (a.eye || 1)));
};

D.ray = (L, a, p) => {
  const f = Math.sin(p * TAU), c1 = a.c1;
  const span = .5 * L, tipY = f * .12 * L;
  line([[-.15 * L, 0], [-.75 * L, f * .02 * L]], Math.max(1, L * .015), shade(c1, .8));
  poly([[.25 * L, 0], [0, -span * .2], [-.1 * L, -span + tipY], [-.25 * L, -span * .2], [-.25 * L, span * .2], [-.1 * L, span - tipY], [0, span * .2]], c1);
  if (a.spots) spots(L * .6, span * .6, a.c2, 18);
  else { ell(-.05 * L, 0, .15 * L, .08 * L, shade(c1, 1.3)); }
  if (a.k === 'manta') { poly([[.24 * L, -.06 * L], [.36 * L, -.12 * L], [.3 * L, -.03 * L]], c1); poly([[.24 * L, .06 * L], [.36 * L, .12 * L], [.3 * L, .03 * L]], c1); }
  else poly([[.25 * L, -.04 * L], [.36 * L, 0], [.25 * L, .04 * L]], c1);
  eye(.2 * L, -.05 * L, 1); eye(.2 * L, .05 * L, 1);
};

D.eel = (L, a, p) => {
  const k = a.k, c1 = a.c1, c2 = a.c2 || shade(c1, 1.4);
  const n = 18, th = (k === 'moray' ? .1 : k === 'oar' ? .09 : k === 'hag' ? .08 : k === 'frill' ? .085 : k === 'snipe' ? .025 : .05) * L;
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([.42 * L - t * .95 * L, Math.sin(p * TAU - t * 5) * .06 * L * t]); }
  for (let i = n; i >= 0; i--) { const t = i / n, r = th * (k === 'gulper' ? (1 - t) * .9 + .1 : 1 - t * .7); circ(pts[i][0], pts[i][1], r, i % 2 && k === 'oar' ? shade(c1, 1.05) : c1); }
  if (k === 'oar') { for (let i = 0; i < n; i++) px(pts[i][0], pts[i][1] - th * 1.4, c2); line([[.42 * L, -th], [.5 * L, -th * 3.5]], 1, c2); }
  if (k === 'frill') { for (let i = 0; i < 3; i++) line([[.3 * L - i * 2, -th * .8], [.3 * L - i * 2, th * .8]], 1, shade(c1, 1.5)); poly([[.46 * L, -th * .6], [.52 * L, 0], [.46 * L, th * .6]], c1); }
  if (k === 'moray') { poly([[.5 * L, -th * .4], [.38 * L, th * .1], [.5 * L, th * .5]], '#1d1a10'); spots(L * .9, th * 2, shade(c1, 1.5), 16); }
  if (k === 'hag') { line([[.48 * L, 0], [.53 * L, -th * .5]], 1, c2); line([[.48 * L, th * .2], [.53 * L, th * .6]], 1, c2); }
  if (k === 'snipe') { quad(.42 * L, 0, .56 * L, -.03 * L, .62 * L, -.08 * L, 1, c1); quad(.42 * L, 0, .56 * L, .03 * L, .62 * L, .07 * L, 1, c1); }
  if (k === 'gulper') { poly([[.32 * L, -.03 * L], [.68 * L, -.24 * L], [.7 * L, -.2 * L], [.36 * L, .02 * L], [.7 * L, .2 * L], [.68 * L, .24 * L], [.32 * L, .06 * L]], c1); glow(pts[n][0], pts[n][1], 2.2, GLOW.pink); }
  eye(.38 * L, -th * .35, k === 'gulper' ? .8 : Math.max(.8, th * .35));
};

D.whale = (L, a, p) => {
  const k = a.k, c1 = a.c1, c2 = a.c2, w = Math.sin(p * TAU) * .05 * L;
  const ry = (k === 'sperm' ? .15 : k === 'dolphin' ? .1 : k === 'dugong' ? .13 : .11) * L;
  // tail stock + flukes
  g.fillStyle = c1; g.beginPath(); g.moveTo(-.1 * L, -ry * .9); g.quadraticCurveTo(-.35 * L, -ry * .5, -.45 * L, w); g.quadraticCurveTo(-.35 * L, ry * .4, -.1 * L, ry * .9); g.fill();
  poly([[-.43 * L, w], [-.56 * L, w - ry * .9], [-.52 * L, w], [-.56 * L, w + ry * .7]], shade(c1, .9));
  // body
  if (k === 'sperm') { g.fillStyle = c1; g.beginPath(); g.roundRect(-.15 * L, -ry, .65 * L, ry * 1.9, ry * .5); g.fill(); }
  else ell(.1 * L, 0, .42 * L, ry, c1);
  if (k === 'orca') { ell(.1 * L, ry * .45, .36 * L, ry * .45, c2); ell(.36 * L, -ry * .35, .06 * L, ry * .22, c2); poly([[.0, -ry * .8], [-.04 * L, -ry * 3.2], [-.1 * L, -ry * .8]], c1); }
  else if (k === 'dolphin') { ell(.1 * L, ry * .45, .34 * L, ry * .4, c2); poly([[.04 * L, -ry * .8], [-.06 * L, -ry * 2.1], [-.12 * L, -ry * .8]], c1); ell(.54 * L, ry * .2, .07 * L, ry * .25, c1); }
  else if (k === 'narwhal') { spots(L * .8, ry, shade(c1, .6), 18); line([[.5 * L, 0], [.95 * L, -.03 * L]], 1, '#efe8d2'); }
  else if (k === 'beaked') { ell(.52 * L, ry * .3, .06 * L, ry * .25, c1); for (let i = 0; i < 5; i++) line([[-.2 * L + i * .1 * L, -ry * .5], [-.15 * L + i * .1 * L, ry * .2]], 1, c2); }
  else if (k === 'dugong') { ell(.48 * L, ry * .3, .08 * L, ry * .6, shade(c1, .9)); }
  else if (k === 'sperm') { for (let i = 0; i < 4; i++) line([[-.1 * L + i * .1 * L, -ry * .9], [-.05 * L + i * .1 * L, -ry * .6]], 1, c2); line([[.15 * L, ry * .75], [.45 * L, ry * .75]], 1, c2); }
  else { ell(.12 * L, ry * .5, .32 * L, ry * .35, c2); for (let i = 0; i < 4; i++) line([[.42 * L - i * .06 * L, ry * .4], [.42 * L - i * .06 * L - .2 * L, ry * .6]], 1, shade(c1, .7)); poly([[-.18 * L, -ry * .8], [-.24 * L, -ry * 1.4], [-.28 * L, -ry * .8]], c1); }
  // flippers
  if (k === 'humpback') poly([[.2 * L, ry * .3], [-.15 * L, ry * 2.4 + w], [-.05 * L, ry * 2.3 + w], [.26 * L, ry * .3]], c2);
  else poly([[.24 * L, ry * .4], [.08 * L, ry * 1.6 + w * .5], [.16 * L, ry * .4]], shade(c1, .8));
  eye(k === 'sperm' ? .28 * L : .4 * L, k === 'sperm' ? ry * .3 : -ry * .05, Math.max(.8, L * .012));
};

D.seal = (L, a, p) => { const w = Math.sin(p * TAU) * .04 * L; ell(.05 * L, 0, .38 * L, .1 * L, a.c1); ell(.38 * L, -.02 * L, .1 * L, .07 * L, a.c2); poly([[-.3 * L, 0], [-.5 * L, -.07 * L + w], [-.5 * L, .07 * L + w]], shade(a.c1, .8)); poly([[.15 * L, .05 * L], [.0, .16 * L], [.08 * L, .05 * L]], shade(a.c1, .8)); eye(.42 * L, -.04 * L, 1); px(.48 * L, .0, '#222'); };
D.otter = (L, a, p) => { const w = Math.sin(p * TAU) * .03 * L; ell(0, 0, .3 * L, .09 * L, a.c1); ell(.32 * L, -.03 * L, .1 * L, .08 * L, a.c2); poly([[-.25 * L, -.02 * L], [-.55 * L, w], [-.25 * L, .05 * L]], a.c1); circ(.36 * L, -.1 * L, .025 * L, a.c1); eye(.36 * L, -.05 * L, 1); };
D.penguin = (L, a, p) => { const w = Math.sin(p * TAU) * .1 * L; ell(0, 0, .42 * L, .14 * L, a.c1); ell(.03 * L, .05 * L, .36 * L, .09 * L, a.c2); ell(.36 * L, -.02 * L, .1 * L, .08 * L, a.c1); ell(.28 * L, .02 * L, .04 * L, .05 * L, a.c3); poly([[.44 * L, -.02 * L], [.55 * L, .0], [.44 * L, .02 * L]], '#2a2a2a'); poly([[.1 * L, 0], [-.15 * L, .2 * L + w], [-.05 * L, .2 * L + w]], a.c1); poly([[-.4 * L, -.02 * L], [-.52 * L, .02 * L], [-.4 * L, .05 * L]], '#e8a040'); eye(.38 * L, -.04 * L, 1); };
D.turtle = (L, a, p) => {
  const f = Math.sin(p * TAU) * .5, c1 = a.c1, sk = a.k === 'leather' ? shade(c1, 1.2) : a.c2;
  [[.22 * L, .12 * L, f], [-.25 * L, .1 * L, -f * .6]].forEach(([x, y, r]) => { g.save(); g.translate(x, y); g.rotate(r + .5); ell(0, .12 * L, .06 * L, .18 * L, sk); g.restore(); });
  ell(.48 * L, -.03 * L, .1 * L, .07 * L, sk);
  g.fillStyle = c1; g.beginPath(); g.ellipse(0, 0, .4 * L, .2 * L, 0, Math.PI, TAU); g.ellipse(0, 0, .4 * L, .06 * L, 0, 0, Math.PI); g.fill();
  if (a.k === 'leather') for (let i = -2; i <= 2; i++) line([[i * .13 * L, -.18 * L + Math.abs(i) * .04 * L], [i * .16 * L, 0]], 1, shade(c1, 1.5));
  else if (a.pattern === 'mottle') spots(L * .6, .18 * L, a.c2, 14);
  else for (let i = -1; i <= 1; i++) line([[i * .14 * L, -.16 * L + Math.abs(i) * .03 * L], [i * .14 * L, 0]], 1, shade(c1, .7));
  g.save(); g.translate(.18 * L, -.02 * L); g.rotate(-f + .3); ell(0, -.1 * L, .05 * L, .16 * L, sk); g.restore();
  eye(.52 * L, -.05 * L, 1);
};
D.snake = (L, a, p) => { for (let i = 0; i <= 20; i++) { const t = i / 20; circ(.45 * L - t * .9 * L, Math.sin(p * TAU - t * 6) * .07 * L, .035 * L * (1 - t * .3), i % 4 < 2 ? a.c1 : a.c2); } poly([[-.45 * L, -.05 * L], [-.55 * L, Math.sin(p * TAU - 6) * .07 * L], [-.45 * L, .05 * L]], a.c1); eye(.47 * L, -.01 * L, 1); };
D.seahorse = (L, a, p) => {
  const c1 = a.c1, s = a.k === 'dragon';
  ell(0, -.05 * L, .1 * L, .2 * L, c1);
  ell(.05 * L, -.3 * L, .08 * L, .07 * L, c1);
  line([[.1 * L, -.3 * L], [.24 * L, -.28 * L]], Math.max(1, .04 * L), c1);
  quad(-.02 * L, .12 * L, -.05 * L, .4 * L, .08 * L, .38 * L, Math.max(1, .05 * L), c1);
  circ(.08 * L, .34 * L, .04 * L, c1);
  for (let i = 0; i < 6; i++) px(-.08 * L, -.2 * L + i * .06 * L, shade(c1, .7));
  if (s) for (const [x, y] of [[-.15, -.2], [.12, -.05], [-.16, .08], [.14, .18], [-.12, .3], [0, -.42]]) ell(x * L, y * L, .06 * L, .03 * L, a.c2, x * 3);
  eye(.07 * L, -.32 * L, 1);
};
D.mola = (L, a, p) => { const w = Math.sin(p * TAU) * .05 * L; poly([[.05 * L, -.2 * L], [-.05 * L, -.55 * L + w], [-.15 * L, -.2 * L]], a.c1); poly([[.05 * L, .2 * L], [-.05 * L, .55 * L - w], [-.15 * L, .2 * L]], a.c1); ell(0, 0, .4 * L, .3 * L, a.c1); ell(-.38 * L, 0, .05 * L, .24 * L, shade(a.c1, .8)); ell(.05 * L, .1 * L, .3 * L, .15 * L, a.c2); eye(.25 * L, -.05 * L, Math.max(1, .03 * L)); };

D.jelly = (L, a, p) => {
  const k = a.k, c1 = a.c1, c2 = a.c2 || shade(c1, 1.3), pul = 1 + Math.sin(p * TAU) * .08, R = .32 * L;
  const tent = (n, len, col, wid = 1) => { for (let i = 0; i < n; i++) { const x = -R * .85 + i * (R * 1.7 / (n - 1 || 1)); quad(x, R * .05, x + Math.sin(p * TAU + i) * .06 * L, len * .5, x + Math.sin(p * TAU + i + 1) * .08 * L, len, wid, col); } };
  if (k === 'manowar') { ell(0, -.12 * L, .3 * L, .12 * L, c1); poly([[-.2 * L, -.2 * L], [0, -.34 * L], [.2 * L, -.2 * L]], c2); g.globalAlpha = .8; tent(6, .7 * L, '#6a7fe0'); g.globalAlpha = 1; return; }
  if (k === 'lion') { tent(14, .85 * L, c2); }
  else if (k === 'box') { tent(4, .55 * L, shade(c1, .9)); }
  else if (k === 'bigred') { for (let i = 0; i < 4; i++) quad(-R * .5 + i * R * .33, R * .1, -R * .4 + i * R * .3, .4 * L, -R * .5 + i * R * .35 + Math.sin(p * TAU + i) * 2, .6 * L, Math.max(2, .06 * L), shade(c1, .8)); }
  else if (k === 'deepstaria') { }
  else if (k === 'moon') tent(12, .14 * L, shade(c1, .9));
  else tent(10, .42 * L, shade(c1, 1.2));
  g.save(); g.scale(1 / pul, pul);
  if (k === 'box') { g.fillStyle = c1; g.beginPath(); g.roundRect(-R, -R * 1.2, R * 2, R * 1.25, R * .3); g.fill(); }
  else if (k === 'helmet') { poly([[-R * .8, 0], [-R * .5, -R * 1.5], [0, -R * 1.9], [R * .5, -R * 1.5], [R * .8, 0]], c1); }
  else if (k === 'deepstaria') { g.fillStyle = c1; g.beginPath(); g.moveTo(-R * 1.4, R * .4); g.quadraticCurveTo(-R, -R * 1.4, 0, -R * 1.3); g.quadraticCurveTo(R, -R * 1.4, R * 1.4, R * .4); g.quadraticCurveTo(0, R * .1, -R * 1.4, R * .4); g.fill(); for (let i = 0; i < 5; i++) line([[-R * .9 + i * R * .45, -R], [-R * 1.1 + i * R * .55, R * .3]], 1, c2); }
  else { g.fillStyle = c1; g.beginPath(); g.arc(0, 0, R, Math.PI, TAU); g.quadraticCurveTo(0, R * .3, -R, 0); g.fill(); }
  g.restore();
  if (k === 'moon') for (let i = 0; i < 4; i++) { g.strokeStyle = '#e88ab8'; g.lineWidth = 1; g.beginPath(); g.arc(-R * .55 + i * R * .37, -R * .4, Math.max(1, R * .14), 0, TAU); g.stroke(); }
  if (k === 'lion') ell(0, -R * .3, R * .6, R * .3, c2);
  if (k === 'atolla') { ell(0, -R * .2, R * .7, R * .25, c2); for (let i = 0; i < 8; i++) glow(-R * .85 + i * R * .243, -R * .08 + Math.abs(i - 3.5) * .5, 1.8, GLOW.blue); }
  if (k === 'helmet') { ell(0, -R * .8, R * .35, R * .5, c2); glow(-R * .5, -R * .4, 1.5, GLOW.blue); glow(R * .5, -R * .4, 1.5, GLOW.blue); glow(0, -R * 1.4, 1.8, GLOW.blue); }
};
D.comb = (L, a, p) => {
  const R = .28 * L; ell(0, 0, R * .8, R * 1.2, a.c1);
  if (a.k === 'red') ell(0, R * .1, R * .45, R * .6, '#6a0a18');
  const cols = ['#ff5d6c', '#ffbe3b', '#6dff9a', '#59c8ff', '#b07dff'];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { const t = (i / 6 + p) % 1; const x = (-.6 + r * .4) * R * .8, y = -R + i * R * .38; px(x, y, cols[(i + r + Math.floor(p * 5)) % cols.length]); if (i === 2 && r % 2) glow(x, y, 1.4, cols[(r + 2) % 5]); }
};
D.siphon = (L, a, p) => {
  for (let i = 0; i < 3; i++) { g.globalAlpha = .85; ell(.42 * L - i * .06 * L, 0, .045 * L, .05 * L, a.c1); }
  g.globalAlpha = 1;
  for (let i = 0; i < 16; i++) { const x = .32 * L - i * .055 * L, y = Math.sin(p * TAU - i * .5) * .03 * L; px(x, y, a.c1, 2); line([[x, y], [x - .01 * L, y + .08 * L + Math.sin(i + p * TAU) * 2]], 1, a.c2); if (i % 3 === 0) glow(x, y, 1.6, GLOW.blue); }
};
D.squid = (L, a, p) => {
  const k = a.k, c1 = a.c1, c2 = a.c2 || shade(c1, 1.4), w = Math.sin(p * TAU), clear = a.clear;
  const mL = (k === 'cuttle' ? .5 : k === 'glass' ? .42 : .52) * L, mR = (k === 'cuttle' ? .15 : k === 'glass' ? .13 : .1) * L;
  const armC = shade(c1, .85);
  if (k === 'vampire') {
    g.fillStyle = c2; g.beginPath(); g.moveTo(.02 * L, -mR * 1.2); g.quadraticCurveTo(-.22 * L, -.34 * L - w * 2, -.4 * L, -.06 * L); g.lineTo(-.42 * L, .06 * L); g.quadraticCurveTo(-.22 * L, .34 * L + w * 2, .02 * L, mR * 1.2); g.fill();
    for (const y of [-.22, -.1, .1, .22]) line([[-.05 * L, y * .3 * L], [-.36 * L, y * L]], 1, shade(c1, .6));
    for (const y of [-.22, 0, .22]) glow(-.38 * L, y * L, 2, GLOW.blue);
  } else if (k === 'bigfin') {
    for (let i = 0; i < 5; i++) line([[0, (i - 2) * .02 * L], [-.08 * L, (i - 2) * .05 * L + .04 * L], [-.06 * L + (i - 2) * .03 * L, .65 * L + Math.sin(p * TAU + i) * 3]], 1, c2);
  } else {
    const len = (k === 'giant' || k === 'colossal' ? .5 : k === 'cuttle' ? .16 : .3) * L, n = k === 'cuttle' ? 6 : 8;
    for (let i = 0; i < n; i++) { const sy = (i - (n - 1) / 2); quad(0, sy * .012 * L, -len * .5, sy * .03 * L + w * 1.5, -len * (.85 + (i % 2) * .15), sy * .05 * L + Math.sin(p * TAU + i) * .03 * L, Math.max(1, .03 * L * (1 - Math.abs(sy) * .08)), armC); }
    if (k !== 'cuttle') for (const s of [-1, 1]) { const tl = len * (k === 'giant' || k === 'colossal' ? 1.6 : 1.35); quad(0, s * .01 * L, -tl * .5, s * .05 * L - w * 2, -tl, s * .04 * L, 1, armC); ell(-tl, s * .04 * L, Math.max(1, .03 * L), Math.max(1, .02 * L), armC); }
  }
  // fins near the tip, then the tapered mantle
  if (k === 'cuttle') ell(mL * .52, 0, mL * .56, mR * 1.25, shade(c1, .75));
  else poly([[mL * 1.02, 0], [mL * .78, -mR * (k === 'bigfin' ? 2.8 : 1.9) - w], [mL * .55, 0], [mL * .78, mR * (k === 'bigfin' ? 2.8 : 1.9) + w]], shade(c1, .8));
  if (clear) g.globalAlpha = .55;
  fill(c1); g.beginPath();
  if (k === 'cuttle') g.ellipse(mL * .52, 0, mL * .5, mR, 0, 0, TAU);
  else { g.moveTo(0, -mR); g.quadraticCurveTo(mL * .55, -mR * 1.15, mL * 1.04, 0); g.quadraticCurveTo(mL * .55, mR * 1.15, 0, mR); g.closePath(); }
  g.fill();
  if (!clear) { fill(c2); g.beginPath(); g.moveTo(.05 * L, -mR * .5); g.quadraticCurveTo(mL * .5, -mR * .75, mL * .9, -mR * .15); g.lineTo(.05 * L, -mR * .15); g.fill(); }
  g.globalAlpha = 1;
  if (clear) ell(mL * .4, 0, mL * .14, mR * .35, '#c49a6c');
  if (k === 'cuttle') spots(L * .5, mR, shade(c1, .6), 10);
  if (k === 'humboldt' || !k) spots(L * .45, mR, shade(c1, .7), 6);
  ell(0, 0, .08 * L, mR * .9, clear ? '#cfe4ea' : c1);
  if (k === 'cockeye') { eye(.01 * L, -mR * .45, Math.max(1.5, .07 * L)); eye(.02 * L, mR * .5, 1); for (let i = 0; i < 6; i++) glow(mL * (.2 + i * .12), (i % 2 ? -1 : 1) * mR * .5, 1.3, GLOW.blue); }
  else eye(.01 * L, -mR * .25, Math.max(1, (k === 'giant' || k === 'colossal' ? .065 : .045) * L));
  if (k === 'firefly') for (let i = 0; i < 8; i++) glow(mL * (.1 + i * .11), (i % 2 ? -1 : 1) * mR * .4, 1.3, GLOW.blue);
  if (k === 'glass') glow(.02 * L, mR * .4, 1.3, GLOW.blue);
  if (k === 'colossal') glow(.02 * L, mR * .55, 1.6, GLOW.blue);
  if (!k) glow(mL * .5, mR * .2, 1.4, GLOW.violet);
};
D.octopus = (L, a, p) => {
  const k = a.k, c1 = a.c1, c2 = a.c2 || shade(c1, 1.3), clear = a.clear, w = Math.sin(p * TAU);
  if (clear) g.globalAlpha = .6;
  for (let i = 0; i < 6; i++) { const x0 = -.15 * L + i * .06 * L; quad(x0, .02 * L, x0 + (i - 2.5) * .06 * L, .2 * L, x0 + (i - 2.5) * .1 * L + Math.sin(p * TAU + i) * .05 * L, (k === 'dumbo' ? .22 : .36) * L, Math.max(1, .045 * L * (k === 'dumbo' ? 1.4 : 1)), i % 2 ? c1 : shade(c1, .9)); }
  if (k === 'dumbo') { ell(-.2 * L, -.3 * L, .1 * L, .05 * L, c2, -.6 + w * .4); ell(.2 * L, -.3 * L, .1 * L, .05 * L, c2, .6 - w * .4); }
  ell(0, -.15 * L, .2 * L, .22 * L, c1);
  if (a.pattern === 'bands') for (let i = 0; i < 3; i++) { fill(c2); g.fillRect(-.18 * L, -.28 * L + i * .1 * L, .36 * L, Math.max(1, .03 * L)); }
  g.globalAlpha = 1;
  if (clear) { ell(0, -.12 * L, .06 * L, .08 * L, '#c49a6c'); }
  if (k === 'telescope') { line([[-.05 * L, -.2 * L], [-.05 * L, -.38 * L]], Math.max(1.5, .05 * L), '#3a2a2a'); line([[.05 * L, -.2 * L], [.05 * L, -.38 * L]], Math.max(1.5, .05 * L), '#3a2a2a'); return; }
  eye(-.07 * L, -.1 * L, Math.max(1, .035 * L)); eye(.07 * L, -.1 * L, Math.max(1, .035 * L));
};
D.nautilus = (L, a, p) => { const R = .28 * L; for (let i = 0; i < 6; i++) quad(.2 * L, .05 * L, .35 * L, .05 * L + (i - 3) * .03 * L, .45 * L, (i - 3) * .05 * L + Math.sin(p * TAU + i) * 2, 1, '#d8a888'); circ(0, 0, R, a.c1); for (let i = 0; i < 6; i++) { g.strokeStyle = a.c2; g.lineWidth = Math.max(1, .03 * L); g.beginPath(); g.arc(0, 0, R, -1.4 + i * .45, -1.1 + i * .45); g.lineTo(0, 0); g.stroke(); } circ(-.02 * L, .02 * L, R * .35, shade(a.c1, .8)); circ(.22 * L, 0, .06 * L, '#b88a6a'); eye(.24 * L, -.03 * L, 1); };
D.crab = (L, a, p) => {
  const k = a.k, c1 = a.c1, w = Math.sin(p * TAU) * .03 * L;
  const legs = k === 'spider' ? .48 : .22;
  for (let s of [-1, 1]) for (let i = 0; i < 4; i++) { const x0 = s * .06 * L, a0 = (i - 1.5) * .05 * L; line([[x0, a0 * .3], [s * legs * .55 * L, -.08 * L + i * .02 * L + w * s], [s * legs * L * (.85 + i * .04), .2 * L]], Math.max(1, .02 * L), k === 'yeti' ? shade(c1, .9) : c1); }
  ell(0, 0, (k === 'spider' ? .12 : .18) * L, (k === 'spider' ? .1 : .1) * L, c1);
  if (k === 'yeti') { for (const s of [-1, 1]) { line([[s * .12 * L, -.02 * L], [s * .32 * L, -.12 * L]], Math.max(2, .07 * L), a.c2); for (let i = 0; i < 6; i++) px(s * (.15 + i * .03) * L, -.1 * L - (i % 2) * 2, '#fffaf0'); } }
  else for (const s of [-1, 1]) { line([[s * .12 * L, -.02 * L], [s * .26 * L, -.1 * L]], Math.max(1, .03 * L), c1); ell(s * .28 * L, -.12 * L, .05 * L, .03 * L, a.c2 || shade(c1, 1.3)); }
  spots(L * .25, .08 * L, a.c2 || shade(c1, 1.3), 5); eye(-.03 * L, -.09 * L, 1); eye(.03 * L, -.09 * L, 1);
};
D.shrimp = (L, a, p) => {
  const k = a.k, c1 = a.c1, c2 = a.c2 || shade(c1, 1.3), w = Math.sin(p * TAU);
  if (k === 'copepod') { ell(.1 * L, 0, .25 * L, .14 * L, c1); poly([[-.12 * L, 0], [-.4 * L, -.05 * L], [-.4 * L, .05 * L]], c1); line([[.3 * L, -.05 * L], [.15 * L, -.45 * L + w]], 1, c1); line([[.3 * L, -.05 * L], [.5 * L, -.4 * L - w]], 1, c1); px(.32 * L, -.04 * L, '#e8304a'); return; }
  if (k === 'isopod') { for (let i = 0; i < 7; i++) ell(.3 * L - i * .1 * L, 0, .07 * L, .18 * L - Math.abs(i - 3) * .015 * L, i % 2 ? c1 : c2); for (let i = 0; i < 6; i++) line([[.28 * L - i * .1 * L, .15 * L], [.25 * L - i * .1 * L + w, .25 * L]], 1, c2); eye(.36 * L, -.04 * L, 1.2); return; }
  if (k === 'amphipod') { for (let i = 0; i < 8; i++) { const t = i / 7, an = -2.3 + t * 2.4; ell(Math.cos(an) * .28 * L, Math.sin(an) * .28 * L + .1 * L, .09 * L, .11 * L, i % 2 ? c1 : shade(c1, .9), an); } line([[.28 * L, -.05 * L], [.48 * L, -.25 * L]], 1, c1); eye(.24 * L, -.02 * L, 1); return; }
  const lob = k === 'lobster', mant = k === 'mantis';
  for (let i = 0; i < 6; i++) { const t = i / 5; ell(.15 * L - t * .5 * L, Math.sin(t * 1.4) * .08 * L * (lob ? .3 : 1), (.09 - t * .02) * L, (.11 - t * .03) * L, i % 2 ? c1 : shade(c1, .9)); }
  poly([[-.35 * L, .05 * L], [-.5 * L, -.04 * L + w], [-.48 * L, .14 * L + w]], c2);
  ell(.28 * L, -.01 * L, .14 * L, .09 * L, c1);
  for (let i = 0; i < 5; i++) line([[.18 * L - i * .1 * L, .08 * L], [.16 * L - i * .1 * L + w, .18 * L]], 1, shade(c1, .8));
  quad(.38 * L, -.05 * L, .6 * L, -.35 * L, lob ? .3 * L : .7 * L, -.25 * L, 1, c2);
  quad(.38 * L, -.03 * L, .6 * L, -.1 * L, .7 * L, .05 * L, 1, c2);
  if (mant) { ell(.42 * L, .02 * L, .06 * L, .04 * L, c2); ell(.4 * L, -.1 * L, .04 * L, .04 * L, '#3a7ae0'); }
  if (k === 'pistol') ell(.45 * L, .05 * L, .12 * L, .06 * L, shade(c1, 1.2));
  if (lob) for (let i = 0; i < 6; i++) px(.1 * L - i * .08 * L, -.08 * L, c2);
  if (k === 'krill') for (let i = 0; i < 4; i++) glow(.2 * L - i * .14 * L, .1 * L, 1.3, GLOW.blue);
  eye(.38 * L, -.06 * L, Math.max(1, .05 * L));
};
D.star = (L, a, p) => {
  const k = a.k, c1 = a.c1, n = k === 'crown' ? 13 : 5, R = .45 * L;
  if (k === 'brittle') { for (let i = 0; i < 5; i++) { const an = Math.PI + i * Math.PI / 4.5 + .1; const pts = []; for (let j = 0; j <= 8; j++) { const t = j / 8; pts.push([Math.cos(an) * R * t + Math.sin(p * TAU + i + t * 4) * .03 * L, Math.min(.04 * L, Math.sin(an) * R * t * .4) + t * t * .02 * L]); } line(pts, Math.max(1, .035 * L), c1); } ell(0, 0, .1 * L, .05 * L, shade(c1, .9)); return; }
  for (let i = 0; i < n; i++) { const an = Math.PI + (i + .5) * Math.PI / n; poly([[Math.cos(an - .2) * .12 * L, 0], [Math.cos(an) * R, Math.min(0, Math.sin(an)) * R * .35 - .02 * L], [Math.cos(an + .2) * .12 * L, 0]], i % 2 ? c1 : shade(c1, .9)); }
  ell(0, -.03 * L, .16 * L, .07 * L, c1);
  if (k === 'crown') for (let i = 0; i < 14; i++) px((i / 13 - .5) * .8 * L, -.06 * L - (i % 3), a.c2);
};
D.urchin = (L, a) => { for (let i = 0; i <= 12; i++) { const an = Math.PI + i * Math.PI / 12; line([[Math.cos(an) * .15 * L, Math.sin(an) * .12 * L], [Math.cos(an) * .45 * L, Math.sin(an) * .4 * L]], 1, shade(a.c1, 1.2)); } g.fillStyle = a.c1; g.beginPath(); g.ellipse(0, 0, .22 * L, .18 * L, 0, Math.PI, TAU); g.fill(); g.fillRect(-.22 * L, -1, .44 * L, 2); };
D.cucumber = (L, a, p) => {
  const w = Math.sin(p * TAU);
  if (a.k === 'swim') { g.globalAlpha = .75; ell(0, 0, .3 * L, .16 * L, a.c1); poly([[.2 * L, -.1 * L], [.4 * L, -.32 * L + w * 2], [.1 * L, -.12 * L]], a.c2); poly([[-.25 * L, .05 * L], [-.45 * L, .2 * L - w * 2], [-.2 * L, .12 * L]], a.c2); g.globalAlpha = 1; ell(0, 0, .14 * L, .06 * L, '#9a2a3a'); for (let i = 0; i < 4; i++) glow(-.2 * L + i * .13 * L, -.06 * L, 1.4, GLOW.blue); return; }
  for (let i = 0; i < 5; i++) line([[-.25 * L + i * .12 * L, .1 * L], [-.27 * L + i * .12 * L + w, .25 * L]], Math.max(1, .05 * L), a.c1);
  g.globalAlpha = .9; ell(0, 0, .38 * L, .16 * L, a.c1); g.globalAlpha = 1;
  for (const x of [.15, .25]) line([[x * L, -.12 * L], [(x + .05) * L, -.3 * L + w]], Math.max(1, .04 * L), a.c2);
  ell(.05 * L, .02 * L, .22 * L, .06 * L, shade(a.c1, .85));
};
D.coral = (L, a, p) => {
  const k = a.k, c1 = a.c1, c2 = a.c2;
  if (k === 'brain') { g.fillStyle = c1; g.beginPath(); g.ellipse(0, .25 * L, .45 * L, .38 * L, 0, Math.PI, TAU); g.fill(); for (let i = 0; i < 6; i++) quad(-.38 * L + i * .14 * L, .2 * L, -.32 * L + i * .14 * L, -.05 * L, -.24 * L + i * .14 * L, .2 * L, 1, c2); return; }
  const r = F.rng(k === 'deep' ? 11 : 5);
  const branch = (x, y, an, len, d) => { if (d > 4 || len < 2) return; const x2 = x + Math.cos(an) * len, y2 = y + Math.sin(an) * len; line([[x, y], [x2, y2]], Math.max(1, (5 - d) * .02 * L), d > 2 ? c2 : c1); if (k === 'deep' && d > 2) px(x2, y2, c2, 2); branch(x2, y2, an - .4 - r() * .3, len * .75, d + 1); branch(x2, y2, an + .4 + r() * .3, len * .72, d + 1); };
  branch(0, .35 * L, -Math.PI / 2, .22 * L, 0);
  if (k === 'stag') { branch(-.15 * L, .35 * L, -Math.PI / 2 - .5, .16 * L, 1); branch(.15 * L, .35 * L, -Math.PI / 2 + .5, .16 * L, 1); }
};
D.anemone = (L, a, p) => { ell(0, .25 * L, .18 * L, .14 * L, a.c1); for (let i = 0; i < 14; i++) { const x = -.3 * L + i * .045 * L; quad(x * .6, .14 * L, x + Math.sin(p * TAU + i) * .04 * L, -.05 * L, x * 1.3 + Math.sin(p * TAU + i * 1.3) * .06 * L, -.25 * L - (i % 3) * .03 * L, Math.max(1, .04 * L), i % 2 ? a.c2 : shade(a.c2, .9)); } };
D.sponge = (L, a, p) => {
  if (a.k === 'harp') { line([[-.4 * L, .35 * L], [.4 * L, .35 * L]], 1, a.c1); for (let i = 0; i < 7; i++) { const x = -.36 * L + i * .12 * L; line([[x, .35 * L], [x, -.3 * L]], 1, a.c1); circ(x, -.32 * L, 1.2, a.c2); } line([[0, .35 * L], [0, .45 * L]], 1, a.c1); return; }
  g.fillStyle = a.c1; g.beginPath(); g.moveTo(-.05 * L, .45 * L); g.quadraticCurveTo(-.2 * L, 0, -.12 * L, -.42 * L); g.lineTo(.12 * L, -.42 * L); g.quadraticCurveTo(.2 * L, 0, .05 * L, .45 * L); g.fill();
  for (let i = 0; i < 6; i++) line([[-.13 * L, -.35 * L + i * .13 * L], [.13 * L, -.3 * L + i * .13 * L]], 1, shade(a.c1, .8));
  for (let i = 0; i < 3; i++) line([[-.08 * L + i * .08 * L, -.42 * L], [-.06 * L + i * .06 * L, .4 * L]], 1, shade(a.c1, .8));
};
D.worm = (L, a, p) => {
  const k = a.k, w = Math.sin(p * TAU);
  if (k === 'xmas') { ell(0, .32 * L, .3 * L, .1 * L, '#8a7a5a'); for (const s of [-1, 1]) for (let i = 0; i < 5; i++) ell(s * .1 * L, .2 * L - i * .1 * L, (.12 - i * .02) * L, .04 * L, i % 2 ? a.c1 : shade(a.c1, 1.3)); return; }
  if (k === 'zombie') { for (let i = 0; i < 3; i++) { line([[(i - 1) * .2 * L, .4 * L], [(i - 1) * .2 * L + w, 0]], 1, '#f0e0d0'); circ((i - 1) * .2 * L + w, -.05 * L, .1 * L, a.c1); } return; }
  const n = k === 'tube' ? 1 : 1;
  for (let i = 0; i < n; i++) {
    g.fillStyle = a.c1; g.fillRect(-.06 * L, -.2 * L, .12 * L, .65 * L);
    if (k === 'tube') { ell(w * .5, -.28 * L, .09 * L, .14 * L, a.c2); }
    else for (let j = 0; j < 5; j++) line([[0, -.2 * L], [(j - 2) * .06 * L + w, -.36 * L]], 1, a.c2);
  }
};
D.snail = (L, a, p) => {
  const k = a.k, w = Math.sin(p * TAU);
  if (k === 'angel') { g.globalAlpha = .85; ell(0, 0, .12 * L, .3 * L, a.c1); ell(-.15 * L, -.1 * L, .15 * L, .06 * L, a.c1, -.5 - w * .5); ell(.15 * L, -.1 * L, .15 * L, .06 * L, a.c1, .5 + w * .5); g.globalAlpha = 1; ell(0, .05 * L, .05 * L, .1 * L, a.c2); return; }
  if (k === 'butterfly') { ell(-.18 * L, -.15 * L, .2 * L, .08 * L, '#f0e6d0', -.4 - w * .5); ell(.18 * L, -.15 * L, .2 * L, .08 * L, '#f0e6d0', .4 + w * .5); circ(0, .05 * L, .18 * L, a.c1); circ(0, .05 * L, .08 * L, shade(a.c1, .7)); return; }
  if (k === 'dancer') { g.fillStyle = a.c1; g.beginPath(); g.moveTo(.45 * L, 0); for (let i = 0; i <= 10; i++) { const t = i / 10; g.lineTo(.45 * L - t * .9 * L, -.12 * L - Math.sin(p * TAU + t * 8) * .07 * L); } for (let i = 10; i >= 0; i--) { const t = i / 10; g.lineTo(.45 * L - t * .9 * L, .1 * L + Math.sin(p * TAU + t * 8 + 1) * .07 * L); } g.fill(); ell(0, 0, .35 * L, .06 * L, a.c2); return; }
  ell(0, .15 * L, .32 * L, .1 * L, a.c2); circ(-.04 * L, -.05 * L, .22 * L, a.c1); g.strokeStyle = a.c2; g.lineWidth = 1; g.beginPath(); g.arc(-.04 * L, -.05 * L, .12 * L, 0, 5); g.stroke(); for (let i = 0; i < 6; i++) px(-.25 * L + i * .1 * L, .2 * L, '#111');
};
D.clam = (L, a, p) => { const o = (Math.sin(p * TAU) + 1) * .03 * L; g.fillStyle = a.c1; g.beginPath(); for (let i = 0; i <= 8; i++) { const x = -.45 * L + i * .1125 * L; g.lineTo(x, -.02 * L - o - (i % 2) * .06 * L); } g.lineTo(.45 * L, .3 * L); g.lineTo(-.45 * L, .3 * L); g.fill(); ell(0, -.05 * L - o, .4 * L, .05 * L + o, a.c2); spots(L * .7, .04 * L, '#b8f0ff', 8); };
D.kelp = (L, a, p) => {
  const H = L; let x = 0, y = H * .5; const pts = [[0, y]];
  for (let i = 1; i <= 12; i++) { const t = i / 12; x = Math.sin(p * TAU + t * 2) * .08 * H * t; y = H * .5 - t * H; pts.push([x, y]); }
  line(pts, Math.max(1, .02 * H), a.c1);
  pts.forEach(([x, y], i) => { if (i && i % 2 === 0) { const s = i % 4 ? 1 : -1; ell(x + s * .06 * H, y + .02 * H, .07 * H, .02 * H, a.c2, s * .5); circ(x + s * .015 * H, y, 1.2, '#d9b84a'); } });
};
D.plankton = (L, a, p) => { if (a.k === 'diatom') { ell(0, 0, .45 * L, .22 * L, a.c1); line([[-.3 * L, 0], [.3 * L, 0]], 1, shade(a.c1, .7)); return; } circ(0, 0, .4 * L, a.c1); glow(0, 0, 2, GLOW.blue); };
D.salp = (L, a, p) => { g.globalAlpha = .65; for (let i = 0; i < 3; i++) { g.fillStyle = a.c1; g.beginPath(); g.roundRect(.25 * L - i * .26 * L, -.1 * L + i * .03 * L, .24 * L, .2 * L, .08 * L); g.fill(); } g.globalAlpha = 1; for (let i = 0; i < 3; i++) { ell(.3 * L - i * .26 * L, i * .03 * L, .03 * L, .03 * L, '#e08a3a'); for (let j = 0; j < 3; j++) px(.28 * L - i * .26 * L + j * .05 * L, -.08 * L + i * .03 * L, shade(a.c1, .7)); } };
D.pyrosome = (L, a, p) => { g.fillStyle = a.c1; g.beginPath(); g.moveTo(.45 * L, -.08 * L); g.lineTo(-.45 * L, -.14 * L); g.quadraticCurveTo(-.5 * L, 0, -.45 * L, .14 * L); g.lineTo(.45 * L, .08 * L); g.fill(); for (let i = 0; i < 8; i++) { const x = -.38 * L + i * .1 * L; px(x, -.06 * L, shade(a.c1, .7)); px(x + .04 * L, .05 * L, shade(a.c1, .7)); if ((i + Math.floor(p * 4)) % 3 === 0) glow(x, 0, 2, GLOW.teal); } };
D.larvacean = (L, a, p) => { g.globalAlpha = .4; ell(0, 0, .45 * L, .38 * L, a.c1); g.globalAlpha = .6; ell(0, 0, .2 * L, .16 * L, a.c1); g.globalAlpha = 1; ell(.02 * L, 0, .05 * L, .03 * L, a.c2); quad(-.02 * L, 0, -.08 * L, Math.sin(p * TAU) * .04 * L, -.14 * L, 0, 1, '#f0f0f0'); };
D.seaspider = (L, a, p) => { for (let i = 0; i < 8; i++) { const s = i < 4 ? -1 : 1, j = i % 4, w = Math.sin(p * TAU + i) * .02 * L; line([[0, 0], [s * (.15 + j * .04) * L, -.2 * L + w], [s * (.32 + j * .04) * L, .3 * L]], 1, a.c1); } ell(0, 0, .06 * L, .04 * L, a.c1); line([[.05 * L, 0], [.12 * L, .03 * L]], 1, a.c1); };
D.blob = (L, a) => { const r = F.rng(31); for (let i = 0; i < 9; i++) circ((r() - .5) * .5 * L, .2 * L - r() * .3 * L, (.12 + r() * .12) * L, i % 2 ? a.c1 : a.c2); g.fillStyle = a.c1; g.fillRect(-.3 * L, .25 * L, .6 * L, .12 * L); };
D.angler = (L, a, p) => {
  const c1 = a.c1, w = Math.sin(p * TAU);
  poly([[-.25 * L, 0], [-.48 * L, -.16 * L + w], [-.48 * L, .16 * L + w]], shade(c1, .9));
  circ(0, 0, .3 * L, c1);
  poly([[.32 * L, -.05 * L], [.08 * L, .08 * L], [.3 * L, .22 * L]], '#120c0a');
  for (let i = 0; i < 4; i++) { px(.12 * L + i * .05 * L, .06 * L + i * .01 * L, '#f4efe6'); px(.12 * L + i * .05 * L, .18 * L - i * .005 * L, '#f4efe6'); }
  quad(.05 * L, -.28 * L, .28 * L, -.62 * L, .42 * L, -.36 * L + w, 1, a.c2);
  circ(.42 * L, -.36 * L + w, 1.6, '#c8ffef'); glow(.42 * L, -.36 * L + w, 3.2, GLOW.teal);
  eye(.15 * L, -.1 * L, 1);
};

/* ---------- pixelation ---------- */
function pixelate(cv, clear) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  const im = c.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    d[i + 3] = clear ? (a < 45 ? 0 : a < 175 ? 160 : 245) : (a < 100 ? 0 : 255);
    d[i] = d[i] & 0xF8; d[i + 1] = d[i + 1] & 0xF8; d[i + 2] = d[i + 2] & 0xF8;
  }
  const A = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) A[i] = d[i * 4 + 3];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (A[i]) continue;
    let n = -1;
    if (x > 0 && A[i - 1]) n = i - 1; else if (x < w - 1 && A[i + 1]) n = i + 1; else if (y > 0 && A[i - w]) n = i - w; else if (y < h - 1 && A[i + w]) n = i + w;
    if (n >= 0) { const o = i * 4, s = n * 4; d[o] = d[s] * .22 + 4; d[o + 1] = d[s + 1] * .22 + 8; d[o + 2] = d[s + 2] * .22 + 12; d[o + 3] = clear ? 170 : 255; }
  }
  c.putImageData(im, 0, 0);
  // crop to content
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { c: cv, w: 1, h: 1, ax: 0, ay: 0 };
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(cv, -x0, -y0);
  return { c: out, w: out.width, h: out.height, ax: w / 2 - x0, ay: h / 2 - y0 };
}

S.sizeFor = sp => sp.art.size || Math.round(F.clamp(5 + 17 * Math.log10(1 + sp.cm / 2), 6, 72) * (sp.art.t === 'kelp' ? 1.6 : 1));

const cache = new Map();
function render(art, L, frame) {
  const pad = Math.ceil(L * 2.4) + 10;
  const cv = document.createElement('canvas'); cv.width = cv.height = pad;
  g = cv.getContext('2d'); glows = [];
  g.translate(pad / 2, pad / 2);
  (D[art.t] || D.fish)(L, art, frame / FRAMES);
  const sp = pixelate(cv, art.clear);
  sp.glows = glows.map(o => ({ x: Math.round(o.x), y: Math.round(o.y), r: o.r, c: o.c }));
  return sp;
}
S.get = (sp, frame = 0) => {
  const key = sp.id + ':' + frame;
  let s = cache.get(key);
  if (!s) { s = render(sp.art, S.sizeFor(sp), frame); cache.set(key, s); }
  return s;
};
S.FRAMES = FRAMES;

/* Draw a species into a UI canvas, scaled up with crisp pixels. */
S.thumb = (sp, cv, { silhouette = false, frame = 1, maxScale = 6 } = {}) => {
  const s = S.get(sp, frame), c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = false;
  const k = Math.max(1, Math.min(maxScale, Math.floor(Math.min((cv.width - 4) / s.w, (cv.height - 4) / s.h))));
  const x = Math.round((cv.width - s.w * k) / 2), y = Math.round((cv.height - s.h * k) / 2);
  c.drawImage(s.c, x, y, s.w * k, s.h * k);
  if (silhouette) { c.globalCompositeOperation = 'source-in'; c.fillStyle = '#1d3440'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-over'; }
  else if (sp.glow) { s.glows.forEach(o => { c.fillStyle = o.c; c.fillRect(x + (s.ax + o.x) * k, y + (s.ay + o.y) * k, k, k); }); }
};

/* ---------- props: submarine, ship, scenery ---------- */
const prop = (key, w, h, fn) => { if (cache.has(key)) return cache.get(key); const cv = document.createElement('canvas'); cv.width = w * 2 + 8; cv.height = h * 2 + 8; g = cv.getContext('2d'); glows = []; g.translate(cv.width / 2, cv.height / 2); fn(); const s = pixelate(cv, false); s.glows = glows; cache.set(key, s); return s; };

S.sub = frame => prop('sub' + frame, 34, 20, () => {
  const pr = [0, .6, 1, .6][frame];
  line([[-17, 0], [-21, 0]], 2, '#2b3a42');
  ell(-22, 0, 1.2, 1 + pr * 4, '#9fb0b8');
  poly([[-12, -3], [-18, -8], [-9, -4]], '#c26a12'); poly([[-12, 3], [-18, 8], [-9, 4]], '#c26a12');
  ell(0, 0, 17, 7.5, '#f2a83a'); ell(0, -2.5, 15, 3.5, '#ffc55e'); ell(0, 4, 14, 2.5, '#d4831f');
  g.fillStyle = '#e99a2c'; g.beginPath(); g.roundRect(-6, -12, 11, 6, 2); g.fill();
  line([[-1, -12], [-1, -16], [3, -16]], 1, '#38464e');
  for (const [x, r] of [[8, 3.6], [-1, 2.4], [-8, 2.4]]) { circ(x, 0, r + 1, '#7a4a10'); circ(x, 0, r, '#18323e'); }
  px(8, -2, '#9be6ff', 2);
  circ(16, 3, 1.8, '#5a6870'); line([[10, 6], [15, 10]], 1, '#38464e'); line([[15, 10], [19, 9]], 1, '#38464e');
});
S.ship = () => prop('ship', 96, 40, () => {
  poly([[-46, -2], [44, -2], [38, 10], [-40, 10]], '#1f3446');
  g.fillStyle = '#ffb547'; g.fillRect(-44, 2, 86, 2);
  g.fillStyle = '#e9edf0'; g.fillRect(-10, -14, 30, 12); g.fillRect(-2, -20, 18, 6);
  g.fillStyle = '#1f3446'; for (let i = 0; i < 5; i++) g.fillRect(-7 + i * 6, -11, 3, 3); g.fillRect(1, -18, 12, 2);
  line([[10, -20], [10, -30]], 1, '#38464e'); line([[6, -27], [14, -27]], 1, '#38464e');
  line([[-40, -2], [-34, -24], [-26, -24], [-22, -2]], 2, '#ffb547'); line([[-30, -24], [-30, -12]], 1, '#a0aab0');
  g.fillStyle = '#c64a3a'; g.fillRect(28, -8, 6, 6);
});
S.cloud = seed => prop('cloud' + seed, 70, 22, () => { const r = F.rng(seed * 13 + 1); for (let i = 0; i < 8; i++) circ((r() - .5) * 46, (r() - .3) * 6, 6 + r() * 7, i < 3 ? '#e9f3f6' : '#ffffff'); g.fillStyle = '#d4e6ee'; g.fillRect(-26, 5, 52, 3); });
S.bird = frame => prop('bird' + frame, 8, 5, () => { const u = frame % 2 ? -2 : 1; line([[-4, u], [-1, 0], [0, 1], [1, 0], [4, u]], 1.2, '#20333f'); });
S.smoker = (h, seed) => prop('smoker' + h + ':' + seed, 16, h, () => { const r = F.rng(seed); g.fillStyle = '#2c2522'; g.beginPath(); g.moveTo(-6, h / 2); for (let i = 0; i <= 8; i++) g.lineTo(-6 + i * .4 + (r() - .5) * 2, h / 2 - i * h / 8); for (let i = 8; i >= 0; i--) g.lineTo(6 - i * .4 + (r() - .5) * 2, h / 2 - i * h / 8); g.fill(); for (let i = 0; i < 6; i++) px((r() - .5) * 8, h / 2 - r() * h, '#a0522d', 2); px(-1, -h / 2 + 1, '#ff8a3a', 2); });
S.skeleton = () => prop('skeleton', 80, 24, () => { line([[-36, 6], [36, 6]], 3, '#e8e2d4'); for (let i = 0; i < 9; i++) quad(-24 + i * 6, 6, -26 + i * 6, -8, -18 + i * 6, -10, 2, '#ddd6c4'); ell(34, 2, 7, 6, '#ece6d8'); px(36, 1, '#2a2a2a', 2); });
S.wreck = () => prop('wreck', 120, 44, () => { poly([[-58, 14], [-50, -6], [52, -10], [58, 14]], '#4a3e36'); poly([[-30, -6], [-24, -18], [10, -18], [16, -8]], '#3e342e'); g.fillStyle = '#2a221e'; for (let i = 0; i < 8; i++) g.fillRect(-44 + i * 11, 0, 4, 4); line([[-6, -18], [-2, -38]], 2, '#3e342e'); line([[22, -10], [30, -28]], 2, '#3e342e'); g.fillStyle = '#6a5a4a'; for (let i = 0; i < 20; i++) px(-56 + i * 6, 12 - (i % 3), '#7a4a2a', 2); });
S.rock = seed => prop('rock' + seed, 24, 14, () => { const r = F.rng(seed + 3); for (let i = 0; i < 5; i++) ell((r() - .5) * 14, 4 - r() * 6, 5 + r() * 5, 3 + r() * 3, i % 2 ? '#3d3a3e' : '#4a464a'); });
S.grass = (seed, h) => prop('grass' + seed + ':' + h, 6, h, () => { const r = F.rng(seed); for (let i = 0; i < 4; i++) quad(-2 + i, h / 2, -2 + i + (r() - .5) * 4, 0, -2 + i + (r() - .5) * 6, -h / 2 + r() * 4, 1, i % 2 ? '#4f8a3a' : '#6aa04a'); });
S.lighthouse = () => prop('lighthouse', 12, 40, () => { poly([[-5, 20], [-3, -14], [3, -14], [5, 20]], '#eef0ea'); for (const y of [-6, 6]) { g.fillStyle = '#d14a3a'; g.fillRect(-5, y, 10, 5); } g.fillStyle = '#28323a'; g.fillRect(-4, -20, 8, 6); px(-2, -19, '#ffe08a', 4); poly([[-5, -20], [0, -24], [5, -20]], '#d14a3a'); });
S.palm = seed => prop('palm' + seed, 26, 36, () => { quad(0, 18, 3, 0, -2, -14, 2, '#7a5a3a'); for (let i = 0; i < 5; i++) { const an = -Math.PI + i * Math.PI / 4; quad(-2, -14, -2 + Math.cos(an) * 8, -18 + Math.sin(an) * 3, -2 + Math.cos(an) * 13, -10 + Math.abs(Math.cos(an)) * 2, 2, i % 2 ? '#3f7a3a' : '#4f9a42'); } });
})();
