/* Fathom UI: menus, HUD, field guide, hangar, awards, settings, debrief. */
(() => {
const F = window.Fathom, G = F.game, A = F.audio, S = F.sprites;
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const body = document.body;
const total = F.SPECIES.length;
let night = false;

/* ---------- modals ---------- */
const stack = [];
const MODALS = ['menu', 'guide', 'hangar', 'achievements', 'settings', 'help', 'about', 'debrief'];
const renderers = {};
function open(name) {
  const m = $('m-' + name); if (!m) return;
  if (G.state === 'play' || G.state === 'intro' || G.state === 'emergency') G.pause();
  const top = stack[stack.length - 1];
  if (top === name) return;
  if (top) $('m-' + top).hidden = true;
  const i = stack.indexOf(name); if (i >= 0) stack.splice(i, 1);
  stack.push(name);
  if (renderers[name]) renderers[name]();
  m.hidden = false;
  const f = m.querySelector('[autofocus], .x, button'); if (f) f.focus({ preventScroll: true });
}
function close() {
  const top = stack.pop(); if (!top) return;
  $('m-' + top).hidden = true;
  const prev = stack[stack.length - 1];
  if (prev) { if (renderers[prev]) renderers[prev](); $('m-' + prev).hidden = false; }
  else if (G.state === 'paused') G.resume();
  refreshTitle();
}
function closeAll() { while (stack.length) $('m-' + stack.pop()).hidden = true; }
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) { open(o.dataset.open); return; }
  if (e.target.closest('[data-close]')) { close(); return; }
  if (e.target.classList.contains('modal') && stack[stack.length - 1] !== 'debrief') close();
});
document.addEventListener('click', e => { if (e.target.closest('button')) A.play('click'); }, true);
document.addEventListener('pointerover', e => { const b = e.target.closest('.btn, .tile, .card, .icon-btn'); if (b && !b.contains(e.relatedTarget)) A.play('hover'); });

/* ---------- keyboard ---------- */
addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (stack.length) { if (stack[stack.length - 1] !== 'debrief') close(); }
    else open('menu');
    e.preventDefault();
  } else if (k === 'j' && !stack.includes('guide')) { open('guide'); }
  else if (k === 'm') toggleMute();
  else if ((k === 'enter') && G.state === 'menu' && !stack.length && document.activeElement === document.body) beginDive();
});
F.on('pauseRequest', () => stack.length && stack[stack.length - 1] !== 'debrief' ? close() : open('menu'));

/* ---------- audio unlock ---------- */
const unlock = () => { A.init(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
function toggleMute() { const s = F.save.settings; s.muted = !s.muted; F.persist(); A.init(); A.apply(); $('btnSound').setAttribute('aria-pressed', String(s.muted)); $('btnSound').textContent = s.muted ? '×' : '♪'; }
$('btnSound').addEventListener('click', toggleMute);
$('btnFull').addEventListener('click', () => { const d = document; if (d.fullscreenElement) d.exitFullscreen?.(); else d.documentElement.requestFullscreen?.().catch(() => {}); });
const topIsClosable = () => stack.length && stack[stack.length - 1] !== 'debrief';
$('btnMenu').addEventListener('click', () => topIsClosable() ? close() : open('menu'));
$('btnPause').addEventListener('click', () => open('menu'));

/* ---------- title screen ---------- */
document.querySelectorAll('.seg-b').forEach(b => b.addEventListener('click', () => {
  night = b.dataset.night === '1';
  document.querySelectorAll('.seg-b').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  G.night = night; body.classList.toggle('night', night); F.world.build(5, night);
}));
function beginDive() { closeAll(); A.init(); G.startDive(night); }
$('btnDive').addEventListener('click', beginDive);
$('mDive').addEventListener('click', beginDive);
$('mResume').addEventListener('click', close);
$('mEnd').addEventListener('click', () => { closeAll(); G.resume(); G.endDive('surface'); });
$('dAgain').addEventListener('click', beginDive);
$('dMenu').addEventListener('click', () => { closeAll(); G.toMenu(); });

function refreshTitle() {
  const s = F.save;
  $('statline').innerHTML = `<span>Dives <b>${s.dives}</b></span><span>Logged <b>${F.loggedCount()}/${total}</b></span><span>Deepest <b>${F.fmt(s.maxDepth)} m</b></span><span>RP <b>${F.fmt(s.rp)}</b></span><button class="savelink" data-open="save" type="button">⇩ Save link</button>`;
  const d = F.dailyGoal();
  const card = $('dailyCard');
  card.classList.toggle('done', !!d.done);
  card.innerHTML = `<div class="kicker">${d.done ? '✓ Daily done' : 'Daily'}</div><p>${esc(d.text)}</p><span class="rw">+${d.reward} RP</span><div class="prog">${Array.from({ length: d.n }, (_, i) => `<i class="${i < d.progress ? 'on' : ''}"></i>`).join('')}</div>`;
  $('hLogged').textContent = `${F.loggedCount()} / ${total} logged`;
  const paused = G.state === 'paused';
  $('mResume').hidden = !paused; $('mEnd').hidden = !paused; $('mDive').hidden = paused || G.state !== 'menu' && G.state !== 'debrief';
}

/* ---------- state changes ---------- */
F.on('state', s => {
  const diving = ['intro', 'play', 'paused', 'emergency'].includes(s);
  body.classList.toggle('playing', diving);
  $('title').hidden = s !== 'menu';
  $('hud').hidden = !diving;
  const touch = diving && matchMedia('(pointer: coarse)').matches;
  $('touch').hidden = !touch; body.classList.toggle('touch', touch);
  if (s === 'intro') { $('hint').hidden = true; }
  if (s === 'menu') refreshTitle();
});
F.on('controlsOn', () => {
  if (!F.save.settings.hints) return;
  const touch = matchMedia('(pointer: coarse)').matches;
  hint(touch ? 'Joystick to steer · Ping finds hidden animals · Rise to the surface to end the dive' : 'WASD or arrows to steer · Shift boost · Space sonar · Mouse aims lights · Rise to the surface to end', 9000);
});
let hintT;
function hint(text, ms) { const h = $('hint'); h.textContent = text; h.hidden = false; clearTimeout(hintT); hintT = setTimeout(() => h.hidden = true, ms); }

/* ---------- HUD ---------- */
const gz = $('gaugeZones');
F.ZONES.forEach(z => { const i = el('i'); i.style.flex = z.px; i.style.background = z.color; gz.appendChild(i); });
const segs = (id, n = 12) => { const b = $(id); b.innerHTML = '<i></i>'.repeat(n); return b; };
const bBat = segs('bBattery'), bHull = segs('bHull');
const setBar = (b, v) => { const n = b.children.length, on = Math.ceil(v / 100 * n); [...b.children].forEach((c, i) => c.classList.toggle('on', i < on)); b.classList.toggle('low', v < 35); b.classList.toggle('crit', v < 15); };
const radar = $('radar');
F.on('hud', h => {
  $('hDepth').textContent = F.fmt(h.m);
  const z = F.ZONES[h.zi]; $('hZone').textContent = z.name; $('hZone').style.color = z.color;
  $('hPress').textContent = (h.pressure < 100 ? h.pressure.toFixed(1) : F.fmt(h.pressure)) + ' atm';
  $('hTemp').textContent = h.temp.toFixed(1) + ' °C';
  $('hSun').textContent = h.sun >= 1 ? Math.round(h.sun) + '%' : h.sun > .01 ? '<1%' : 'None';
  const ex = F.save.settings.explorer;
  setBar(bBat, ex ? 100 : h.battery); setBar(bHull, h.hull);
  $('hLights').textContent = h.lights ? 'ON' : 'OFF';
  const pos = y => (y / F.WORLD_BOTTOM * 100) + '%';
  $('gNow').style.top = pos(Math.max(0, h.y)); $('gMax').style.top = pos(F.yAt(h.maxDepth));
  const hr = F.hullRating(); $('gHull').hidden = hr >= 10935; $('gHull').style.top = pos(F.yAt(hr));
  $('btnPing').classList.toggle('cool', h.pingCd > 0);
  G.drawRadar(radar);
});
$('btnPing').addEventListener('click', () => G.ping());

/* banners, toasts, cards */
let bannerT;
F.on('zone', ({ zi, down }) => {
  const z = F.ZONES[zi];
  $('bzName').textContent = z.name; $('bzName').style.color = z.color;
  $('bzRange').textContent = `${z.sci} · ${F.fmt(z.top)}–${F.fmt(z.bot)} m`;
  $('bzText').textContent = down ? z.blurb : 'Rising back toward the light.';
  const b = $('banner'); b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 4800);
});
const shownOnce = new Set();
function toast(text, kind = 'info', ms = 4200) {
  const t = el('div', 'toast ' + kind); t.textContent = text; $('toasts').appendChild(t);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 600); }, ms);
}
F.on('toast', ({ text, kind, once }) => { if (once) { if (shownOnce.has(once)) return; shownOnce.add(once); } toast(text, kind, kind === 'milestone' ? 5500 : 4200); });
F.on('fps', v => { if (F.save.settings.showFps) $('fps').textContent = v + ' FPS · ' + G.W + '×' + G.H + ' @' + G.SCALE + 'x'; });
F.on('lights', on => { $('tLights').classList.toggle('on', on); });

const discQ = []; let discBusy = false;
function showDisc(item) { discQ.push(item); if (!discBusy) nextDisc(); }
function nextDisc() {
  const it = discQ.shift(); if (!it) { discBusy = false; return; }
  discBusy = true;
  const d = $('disc'), r = F.RARITY[it.sp.rarity];
  d.style.setProperty('--rc', r.color);
  $('discHead').textContent = it.head;
  S.thumb(it.sp, $('discArt'), { maxScale: 4 });
  $('discName').textContent = it.sp.name; $('discSci').textContent = it.sp.sci;
  $('discRar').textContent = r.label; $('discRar').style.color = r.color;
  $('discFact').textContent = it.sp.fact;
  $('discFoot').textContent = it.foot;
  d.classList.add('show');
  setTimeout(() => { d.classList.remove('show'); setTimeout(nextDisc, 400); }, 6000);
}
F.on('discover', ({ sp, depth }) => { showDisc({ sp, head: 'New species logged', foot: `+${F.RARITY[sp.rarity].rp} RP · logged at ${F.fmt(depth)} m · press J for field guide` }); $('hLogged').textContent = `${F.loggedCount()} / ${total} logged`; });
F.on('study', ({ sp, rec }) => toast(rec.scans >= F.STUDY_SCANS ? `${sp.name} fully studied! +15 RP` : `Studied ${sp.name} · ${rec.scans}/${F.STUDY_SCANS} scans`, rec.scans >= F.STUDY_SCANS ? 'good' : 'info'));
F.on('landmark', ({ lmk, first }) => toast(`◇ ${lmk.name}${first ? ' · +30 RP' : ''} — ${lmk.fact}`, 'good', 8000));

const awardQ = []; let awardBusy = false;
function award(icon, small, title) { awardQ.push({ icon, small, title }); if (!awardBusy) nextAward(); }
function nextAward() {
  const a = awardQ.shift(); if (!a) { awardBusy = false; return; }
  awardBusy = true; const w = $('award');
  w.innerHTML = `<div class="ai">${esc(a.icon)}</div><div><small>${esc(a.small)}</small><b>${esc(a.title)}</b></div>`;
  w.classList.add('show'); A.play('achievement');
  setTimeout(() => { w.classList.remove('show'); setTimeout(nextAward, 450); }, 3200);
}
F.on('achievement', a => award(a.icon, 'Award unlocked', a.name));
F.on('daily', d => award('D', `Daily expedition · +${d.reward} RP`, d.text));

/* ---------- debrief ---------- */
F.on('diveEnd', sess => { open('debrief'); });
renderers.debrief = () => {
  const s = G.session; if (!s) return;
  const b = $('debriefBody'); b.innerHTML = '';
  $('dKicker').textContent = `Dive ${F.save.dives} report · ${s.night ? 'Night' : 'Day'} dive`;
  $('dT').textContent = s.reason === 'emergency' ? 'Emergency ascent' : 'Back on the surface';
  const mm = Math.floor(s.seconds / 60), ss = Math.floor(s.seconds % 60);
  b.appendChild(el('div', 'dstats', [
    [F.fmt(s.maxDepth) + ' m', 'Deepest point'], [`${mm}:${String(ss).padStart(2, '0')}`, 'Dive time'], [s.newIds.length, 'New species'], [s.studied.length, 'Fully studied'], ['+' + s.rp, 'RP earned'],
  ].map(([v, l]) => `<div class="dstat"><b>${v}</b><span>${l}</span></div>`).join('')));
  if (s.reason === 'emergency') b.appendChild(el('p', 'locked', `The hull is rated to ${F.fmt(F.hullRating())} m and started to fail. Your discoveries are safe. Upgrade the pressure hull in the hangar to go deeper.`));
  if (s.newIds.length) {
    const row = el('div', 'newrow');
    s.newIds.forEach(id => { const sp = F.byId[id]; const f = el('figure'); const c = el('canvas'); c.width = 96; c.height = 64; S.thumb(sp, c, { maxScale: 3 }); f.append(c, el('figcaption', '', esc(sp.name))); row.appendChild(f); });
    b.append(el('div', 'lbl', 'Logged this dive'), row);
  } else b.appendChild(el('p', 'muted', 'No new species this time. Hold still near a lit animal until the ring fills, and use sonar (Space) to find hidden ones.'));
  if (s.landmarks.length) b.appendChild(el('p', '', '<span class="lbl">Landmarks</span><br>' + s.landmarks.map(id => esc(F.LANDMARKS.find(l => l.id === id).name)).join(' · ')));
  if (s.achievements.length) b.appendChild(el('p', '', '<span class="lbl">Awards</span><br>' + s.achievements.map(a => '★ ' + esc(a.name)).join(' · ')));
  const d = F.dailyGoal();
  b.appendChild(el('p', 'muted small', `Daily expedition: ${esc(d.text)} — ${d.done ? 'complete ✓' : `${d.progress}/${d.n}`}`));
  if (F.loggedCount() - (F.save.backedUpAt || 0) >= 5) {
    const nudge = el('div', 'nudge', `<div><b>Don't lose your ${F.loggedCount()} species.</b><br><span class="muted small">Get a save link to keep your progress safe and continue on any device.</span></div>`);
    const sb = el('button', 'btn', '⇩ Get save link'); sb.type = 'button'; sb.dataset.open = 'save'; nudge.appendChild(sb); b.appendChild(nudge);
  }
  b.appendChild(quiz(s));
};

function quiz(s) {
  const box = el('div', 'quiz');
  let pool = [...new Set([...s.scannedIds])].map(id => F.byId[id]);
  if (!pool.length) pool = Object.keys(F.save.logged).map(id => F.byId[id]).filter(Boolean);
  if (!pool.length) { box.innerHTML = '<div class="lbl">Recall check</div><p class="qfb">Log a species and a quick question about it will appear here after your next dive.</p>'; return box; }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const qs = shuffle(pool.slice()).slice(0, 3).map(sp => {
    const kinds = ['fact', 'zone']; if (F.save.settings.online && sp.image) kinds.push('photo');
    return { sp, kind: kinds[Math.floor(Math.random() * kinds.length)] };
  });
  let i = 0, right = 0;
  const show = () => {
    const { sp, kind } = qs[i];
    box.innerHTML = `<div class="lbl">Recall check · question ${i + 1} of ${qs.length} · +10 RP each</div>`;
    let opts, prompt, isRight;
    if (kind === 'zone') {
      prompt = `<p class="q">Which ocean zone is the <b>${esc(sp.name)}</b> usually found in?</p>`;
      const others = shuffle(F.ZONES.map((z, j) => j).filter(j => j !== sp.zi)).slice(0, 2);
      opts = shuffle([sp.zi, ...others]).map(zi => ({ label: `${F.ZONES[zi].name} (${F.fmt(F.ZONES[zi].top)}–${F.fmt(F.ZONES[zi].bot)} m)`, ok: zi === sp.zi }));
    } else {
      const decoys = shuffle(F.SPECIES.filter(x => x !== sp && x.group === sp.group)).concat(shuffle(F.SPECIES.filter(x => x !== sp))).filter((x, j, a) => a.indexOf(x) === j).slice(0, 2);
      prompt = kind === 'photo' ? `<p class="q">Which animal is in this photo?</p><img class="photo" alt="Photo for the question" src="${esc(sp.image)}" referrerpolicy="no-referrer">` : `<p class="q">Which animal is this? <br><span class="muted">“${esc(sp.fact)}”</span></p>`;
      opts = shuffle([sp, ...decoys]).map(x => ({ label: x.name, sp: kind === 'fact' ? x : null, ok: x === sp }));
    }
    box.insertAdjacentHTML('beforeend', prompt);
    const grid = el('div', 'qopts'); box.appendChild(grid);
    const fb = el('p', 'qfb'); box.appendChild(fb);
    opts.forEach(o => {
      const btn = el('button', 'qopt'); btn.type = 'button';
      if (o.sp) { const c = el('canvas'); c.width = 120; c.height = 56; S.thumb(o.sp, c, { maxScale: 3 }); btn.appendChild(c); }
      btn.appendChild(el('span', '', esc(o.label)));
      btn.addEventListener('click', () => {
        if (grid.dataset.done) return; grid.dataset.done = 1;
        btn.classList.add(o.ok ? 'right' : 'wrong');
        grid.querySelectorAll('.qopt').forEach((b, j) => { if (opts[j].ok) b.classList.add('right'); });
        if (o.ok) { right++; F.save.quizRight++; F.save.rp += 10; F.save.rpTotal += 10; A.play('quizRight'); } else A.play('quizWrong');
        F.persist(); F.checkAchievements();
        fb.innerHTML = (o.ok ? '<b style="color:var(--good)">Correct.</b> ' : `<b style="color:var(--coral)">Not quite.</b> It was the ${esc(sp.name)}. `) + esc(kind === 'zone' ? `It lives around ${F.fmt(sp.m)} m.` : sp.fact);
        const nb = el('button', 'btn', i < qs.length - 1 ? 'Next question' : `Done · ${right}/${qs.length} correct`); nb.type = 'button';
        nb.addEventListener('click', () => { if (i < qs.length - 1) { i++; show(); } else box.innerHTML = `<div class="lbl">Recall check</div><p class="qfb">${right} of ${qs.length} correct · +${right * 10} RP</p>`; });
        box.appendChild(nb);
      });
      grid.appendChild(btn);
    });
  };
  show();
  return box;
}

/* ---------- field guide ---------- */
const gf = { q: '', status: 'all', group: '', zones: new Set(), sel: null };
const groups = [...new Set(F.SPECIES.map(s => s.group))].sort();
groups.forEach(g => $('gGroup').appendChild(new Option(g, g)));
F.ZONES.forEach((z, i) => { const b = el('button', 'zchip', esc(z.name)); b.type = 'button'; b.style.setProperty('--zc', z.color); b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => { gf.zones.has(i) ? gf.zones.delete(i) : gf.zones.add(i); b.setAttribute('aria-pressed', String(gf.zones.has(i))); drawGrid(); }); $('gZones').appendChild(b); });
$('gSearch').addEventListener('input', e => { gf.q = e.target.value.trim().toLowerCase(); drawGrid(); });
$('gStatus').addEventListener('change', e => { gf.status = e.target.value; drawGrid(); });
$('gGroup').addEventListener('change', e => { gf.group = e.target.value; drawGrid(); });
document.querySelectorAll('[data-gtab]').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('[data-gtab]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
  const reg = t.dataset.gtab === 'register';
  $('guidePane').hidden = reg; $('registerPane').hidden = !reg;
  $('gT').textContent = reg ? 'World register' : 'Ocean field guide';
  if (reg) setTimeout(() => $('regQ').focus(), 0);
}));
renderers.guide = () => { $('gKicker').textContent = `Field guide · ${F.loggedCount()} of ${total} logged · ${F.studiedCount()} studied`; drawGrid(); drawDetail(); };

function drawGrid() {
  const grid = $('gGrid'); grid.innerHTML = '';
  const list = F.SPECIES.filter(sp => {
    const got = F.isLogged(sp.id);
    if (gf.status === 'logged' && !got) return false;
    if (gf.status === 'missing' && got) return false;
    if (gf.group && sp.group !== gf.group) return false;
    if (gf.zones.size && !gf.zones.has(sp.zi)) return false;
    if (gf.q) { const hay = (got ? sp.name + ' ' + sp.sci : '') + ' ' + sp.group + ' ' + F.ZONES[sp.zi].name; if (!hay.toLowerCase().includes(gf.q)) return false; }
    return true;
  }).sort((a, b) => a.m - b.m);
  if (!list.length) grid.appendChild(el('p', 'muted', 'Nothing matches those filters.'));
  for (const sp of list) {
    const rec = F.save.logged[sp.id], z = F.ZONES[sp.zi];
    const c = el('button', 'card' + (rec ? '' : ' missing')); c.type = 'button';
    c.style.setProperty('--zc', z.color); c.setAttribute('aria-pressed', String(gf.sel === sp.id));
    const cv = el('canvas'); cv.width = 120; cv.height = 64; c.appendChild(cv);
    c.appendChild(el('div', 'n', rec ? esc(sp.name) : 'Unknown species'));
    c.appendChild(el('div', 'd', `<span>~${F.fmt(sp.m)} m</span><i></i>`));
    if (rec && rec.scans >= F.STUDY_SCANS) c.appendChild(el('span', 'studied', '★'));
    c.addEventListener('click', () => { gf.sel = sp.id; grid.querySelectorAll('.card').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', 'true'); drawDetail(); });
    grid.appendChild(c);
    requestAnimationFrame(() => S.thumb(sp, cv, { silhouette: !rec, maxScale: 3 }));
  }
}

function speciesDetail(sp, target) {
  const rec = F.save.logged[sp.id], z = F.ZONES[sp.zi], r = F.RARITY[sp.rarity];
  target.innerHTML = '';
  target.classList.remove('empty');
  const back = el('button', 'btn', '← Back'); back.type = 'button'; back.style.alignSelf = 'flex-start'; back.addEventListener('click', () => target.classList.add('empty'));
  if (matchMedia('(max-width: 900px)').matches) target.appendChild(back);
  const art = el('div', 'art'); const cv = el('canvas'); cv.width = 360; cv.height = 150; art.appendChild(cv); target.appendChild(art);
  S.thumb(sp, cv, { silhouette: !rec, maxScale: 6 });
  if (!rec) {
    target.appendChild(el('div', '', `<div class="kicker" style="color:${z.color}">${esc(z.name)}</div><h3>Unknown species</h3>`));
    const tips = [`Look around ${F.fmt(sp.m)} m in the ${z.name}.`];
    if (sp.nightM != null) tips.push(`At night it rises to about ${F.fmt(sp.nightM)} m.`);
    if (sp.glow) tips.push('It makes its own light, so watch for a glow in the dark.');
    if (sp.benthic) tips.push('It lives on the seafloor.');
    const habs = { reef: 'Search the coral reef near the shore.', kelp: 'Search the kelp forest.', seagrass: 'Search the shallow seagrass by the beach.', vent: 'Search the black smoker field on the ridge to the east.', whalefall: 'Search the whale fall on the western slope.', slope: 'Search the continental slope to the west.', plain: 'Search the abyssal plain.', trench: 'Search the trench below the ship.', surface: 'It lives right at the surface.' };
    if (habs[sp.hab]) tips.push(habs[sp.hab]);
    if (F.yAt(sp.m) > F.yAt(F.hullRating())) tips.push(`Your hull is rated to ${F.fmt(F.hullRating())} m. Upgrade it to reach this depth.`);
    target.appendChild(el('div', 'locked', tips.map(esc).join('<br>')));
    return;
  }
  const head = el('div'); head.innerHTML = `<div class="kicker" style="color:${z.color}">${esc(z.name)} · <span style="color:${r.color}">${r.label}</span></div><h3>${esc(sp.name)}</h3><div class="sci">${esc(sp.acceptedName || sp.sci)}</div>`;
  target.appendChild(head);
  target.appendChild(el('p', 'hook', esc(sp.fact)));
  const facts = [
    ['Depth range', `${F.fmt(sp.range[0])}–${F.fmt(sp.range[1])} m`], ['You logged it at', `${F.fmt(rec.depth)} m${rec.night ? ' · night' : ''}`],
    ['Size', `up to ${sp.cm >= 100 ? (sp.cm / 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' m' : sp.cm + ' cm'}`], ['Diet', sp.diet],
    ['Group', sp.group], ['Makes light', sp.glow ? 'Yes' : 'No'],
    ['Study', rec.scans >= F.STUDY_SCANS ? '★ Studied' : `${rec.scans}/${F.STUDY_SCANS} scans`], ['OBIS records', sp.obisRecords != null ? F.fmt(sp.obisRecords) : '—'],
  ];
  target.appendChild(el('dl', 'facts', facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')));
  if (sp.taxonomy && sp.taxonomy.length) target.appendChild(el('div', 'muted small', esc(sp.taxonomy.join(' › '))));
  if (sp.summary) {
    const w = el('div', 'wiki');
    if (F.save.settings.online && sp.image) { const img = el('img'); img.alt = `Photo of ${sp.name}`; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = sp.image; img.onerror = () => img.remove(); w.appendChild(img); }
    w.appendChild(el('div', 'lbl', 'From Wikipedia'));
    w.appendChild(el('p', '', esc(sp.summary)));
    w.appendChild(el('div', 'src', 'Text: Wikipedia, CC BY-SA 4.0'));
    target.appendChild(w);
  }
  if (sp.depthHist) target.appendChild(histChart(sp.depthHist, sp.obisRecords));
  target.appendChild(links(sp.aphiaId, sp.wikiUrl, sp.sci));
}
function links(aphia, wikiUrl, sci) {
  const l = el('div', 'links-row');
  if (aphia) l.innerHTML += `<a href="https://www.marinespecies.org/aphia.php?p=taxdetails&id=${aphia}" target="_blank" rel="noopener">WoRMS ↗</a><a href="https://obis.org/taxon/${aphia}" target="_blank" rel="noopener">OBIS map ↗</a>`;
  if (wikiUrl) l.innerHTML += `<a href="${esc(wikiUrl)}" target="_blank" rel="noopener">Wikipedia ↗</a>`;
  return l;
}
function histChart(hist, records) {
  const wrap = el('div', 'chart');
  wrap.appendChild(el('div', 'lbl', `Where it has been recorded · ${records != null ? F.fmt(records) : ''} OBIS sightings by depth`));
  const cv = el('canvas'); wrap.appendChild(cv);
  requestAnimationFrame(() => {
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 360, h = 120;
    cv.width = w * dpr; cv.height = h * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
    let lastIdx = 0; hist.forEach((b, i) => { if (b[1] > 0) lastIdx = i; });
    const bins = hist.slice(0, Math.max(lastIdx + 1, 4));
    const max = Math.max(...bins.map(b => b[1]));
    const bw = (w - 44) / bins.length;
    c.font = '10px "IBM Plex Mono", monospace'; c.fillStyle = '#5d7680'; c.textAlign = 'right';
    bins.forEach(([from, n], i) => {
      const k = n ? Math.log10(n + 1) / Math.log10(max + 1) : 0, bh = Math.round(k * (h - 26));
      c.fillStyle = F.ZONES[F.zoneIdx(from)].color; c.globalAlpha = n ? .9 : .15;
      c.fillRect(Math.round(40 + i * bw), h - 16 - Math.max(1, bh), Math.max(1, Math.floor(bw) - 1), Math.max(1, bh));
    });
    c.globalAlpha = 1; c.fillStyle = '#8ba6ad'; c.textAlign = 'left';
    c.fillText('0 m', 40, h - 3); c.textAlign = 'right'; c.fillText(F.fmt(bins[bins.length - 1][0]) + ' m', w - 2, h - 3);
    c.save(); c.translate(10, h / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText('records (log)', 0, 0); c.restore();
  });
  return wrap;
}
function drawDetail() {
  const d = $('gDetail');
  const sp = gf.sel && F.byId[gf.sel];
  if (!sp) { d.classList.add('empty'); d.innerHTML = `<div class="lbl">How the field guide works</div><p class="muted">Every card is a real species. Silhouettes are animals you have not found yet; select one to get a hint about where to look.</p><p class="muted">Logged species unlock a Wikipedia summary, a photo and a chart of the depths where scientists have recorded them (from OBIS).</p><p class="muted">Use the <b>World register</b> tab to look up any of the 240,000+ marine species known to science.</p>`; d.classList.remove('empty'); return; }
  speciesDetail(sp, d);
}

/* World register (live) */
const regCache = new Map();
async function getJSON(url) {
  if (regCache.has(url)) return regCache.get(url);
  const r = await fetch(url); if (r.status === 204 || r.status === 404) return null; if (!r.ok) throw new Error(r.status);
  const j = await r.json(); regCache.set(url, j); return j;
}
$('regForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('regQ').value.trim(), out = $('regResults'); if (!q) return;
  if (!F.save.settings.online) { out.innerHTML = '<p class="locked">Online data is turned off. Turn it on in Settings → Data to search the register.</p>'; return; }
  out.innerHTML = '<p class="muted">Searching the World Register of Marine Species…</p>';
  const enc = encodeURIComponent(q);
  try {
    const [byVern, byName] = await Promise.all([
      getJSON(`https://www.marinespecies.org/rest/AphiaRecordsByVernacular/${enc}?like=true&offset=1`).catch(() => null),
      getJSON(`https://www.marinespecies.org/rest/AphiaRecordsByName/${enc}?like=true&marine_only=true&offset=1`).catch(() => null),
    ]);
    const seen = new Set();
    const recs = [...(byVern || []), ...(byName || [])].filter(r => r && r.status === 'accepted' && (r.isMarine === 1 || r.isMarine == null) && !seen.has(r.valid_AphiaID) && seen.add(r.valid_AphiaID)).slice(0, 40);
    out.innerHTML = '';
    if (!recs.length) { out.innerHTML = '<p class="muted">No accepted marine species found. Try a common name like "sea lion" or a scientific name like "Octopus".</p>'; return; }
    recs.forEach(r => {
      const inGame = F.SPECIES.find(s => s.aphiaId === r.valid_AphiaID);
      const b = el('button', 'reg-item'); b.type = 'button';
      b.innerHTML = `<i>${esc(r.valid_name || r.scientificname)}</i><small>${esc(r.rank || '')} · ${esc([r.class, r.family].filter(Boolean).join(' · '))}${inGame ? ' · in Fathom' : ''}</small>`;
      b.addEventListener('click', () => { out.querySelectorAll('.reg-item').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); regDetail(r, inGame); });
      out.appendChild(b);
    });
  } catch (err) { out.innerHTML = '<p class="locked">Could not reach the register. Check your internet connection and try again.</p>'; }
});
async function regDetail(r, inGame) {
  const d = $('regDetail'); d.classList.remove('empty');
  const name = r.valid_name || r.scientificname, enc = encodeURIComponent(name);
  d.innerHTML = `<div class="kicker">${esc(r.rank || 'Taxon')} · AphiaID ${r.valid_AphiaID}</div><h3><i>${esc(name)}</i></h3><div class="muted small">${esc([r.kingdom, r.phylum, r.class, r.order, r.family].filter(Boolean).join(' › '))}</div><p class="muted">Loading Wikipedia and OBIS…</p>`;
  if (inGame) { const b = el('button', 'btn', F.isLogged(inGame.id) ? `Open ${inGame.name} in the field guide` : 'This species is in Fathom · not logged yet'); b.type = 'button'; b.addEventListener('click', () => { gf.sel = inGame.id; document.querySelector('[data-gtab="guide"]').click(); drawGrid(); drawDetail(); }); d.appendChild(b); }
  const [wiki, stats, env] = await Promise.all([
    getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`).catch(() => null),
    getJSON(`https://api.obis.org/v3/statistics?scientificname=${enc}`).catch(() => null),
    getJSON(`https://api.obis.org/v3/statistics/env?scientificname=${enc}`).catch(() => null),
  ]);
  d.querySelector('p.muted:last-of-type')?.remove();
  if (wiki && wiki.extract && wiki.type !== 'disambiguation') {
    const w = el('div', 'wiki');
    if (wiki.thumbnail) { const img = el('img'); img.alt = `Photo of ${name}`; img.referrerPolicy = 'no-referrer'; img.src = wiki.thumbnail.source; w.appendChild(img); }
    w.appendChild(el('div', 'lbl', 'From Wikipedia')); w.appendChild(el('p', '', esc(wiki.extract))); w.appendChild(el('div', 'src', 'Text: Wikipedia, CC BY-SA 4.0'));
    d.appendChild(w);
  } else d.appendChild(el('p', 'muted', 'No Wikipedia article found for this name.'));
  if (env && env.depth && env.depth.some(b => b.records)) d.appendChild(histChart(env.depth.map(b => [b.from, b.records]), stats && stats.records));
  else if (stats) d.appendChild(el('p', 'muted', `${F.fmt(stats.records || 0)} OBIS records.`));
  d.appendChild(links(r.valid_AphiaID, wiki && wiki.content_urls ? wiki.content_urls.desktop.page : null, name));
}

/* ---------- hangar ---------- */
renderers.hangar = () => {
  $('hangarRP').textContent = `${F.fmt(F.save.rp)} RP`;
  const box = $('upgrades'); box.innerHTML = '';
  if (F.save.settings.explorer) box.appendChild(el('p', 'locked', 'Explorer mode is on, so depth and battery limits are off. Upgrades still apply to lights, sonar, thrusters and scanner.'));
  for (const u of F.UPGRADES) {
    const lv = F.save.upgrades[u.id] || 0, cur = u.levels[lv], nxt = u.levels[lv + 1];
    const fmtv = v => u.id === 'hull' ? `${F.fmt(v)} m` : u.id === 'scanner' ? `${v}s` : F.fmt(v);
    const card = el('div', 'up');
    card.innerHTML = `<div><h3>${esc(u.name)}</h3></div>
      <div class="val">Now <span>${fmtv(cur.v)}</span>${nxt ? ` → next <span>${fmtv(nxt.v)}</span>` : ' · maxed'}${cur.note ? ` · ${esc(cur.note)}` : ''}</div>
      <p>${esc(u.desc)}${nxt && nxt.note ? ` Next: ${esc(nxt.note)}.` : ''}</p>
      <div class="pips">${u.levels.map((_, i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</div>`;
    const b = el('button', 'btn' + (nxt && F.save.rp >= nxt.c ? ' primary' : ''), nxt ? `Upgrade · ${nxt.c} RP` : 'Maxed'); b.type = 'button';
    b.disabled = !nxt || F.save.rp < nxt.c;
    b.addEventListener('click', () => { if (!nxt || F.save.rp < nxt.c) return; F.save.rp -= nxt.c; F.save.upgrades[u.id] = lv + 1; F.persist(); A.play('upgrade'); F.checkAchievements(); renderers.hangar(); refreshTitle(); });
    card.appendChild(b);
    box.appendChild(card);
  }
};

/* ---------- achievements ---------- */
renderers.achievements = () => {
  const got = F.ACHIEVEMENTS.filter(a => F.save.achievements[a.id]).length;
  $('aKicker').textContent = `${got} of ${F.ACHIEVEMENTS.length} unlocked`;
  const box = $('achs'); box.innerHTML = '';
  for (const a of F.ACHIEVEMENTS) {
    const date = F.save.achievements[a.id];
    const goal = typeof a.goal === 'function' ? a.goal() : a.goal;
    const prog = a.prog ? Math.min(goal, a.prog(F.save)) : 0;
    const d = el('div', 'ach' + (date ? ' got' : ''));
    d.innerHTML = `<div class="ai">${esc(a.icon)}</div><div><b>${esc(a.name)}</b><span>${esc(a.desc)}${date ? ` · ${date}` : goal ? ` · ${prog}/${goal}` : ''}</span>${!date && goal ? `<div class="prog">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.floor(prog / goal * 10) ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`;
    box.appendChild(d);
  }
};

/* ---------- settings ---------- */
const SETTINGS = [
  ['Audio'],
  ['master', 'range', 'Master volume'], ['music', 'range', 'Music'], ['sfx', 'range', 'Sound effects'], ['ambience', 'range', 'Ocean ambience'], ['muted', 'switch', 'Mute everything', 'Shortcut: M'],
  ['Display'],
  ['pixel', 'choice', 'Pixel size', 'Bigger pixels look chunkier and run faster.', [['auto', 'Auto'], ['2', '2×'], ['3', '3×'], ['4', '4×']]],
  ['scanlines', 'switch', 'CRT scanlines', 'A subtle retro screen effect.'], ['showFps', 'switch', 'Show FPS', 'Frame rate counter at the top of the screen.'], ['shake', 'switch', 'Screen shake', 'When the hull is under stress or you bump the seafloor.'], ['reducedMotion', 'switch', 'Reduce motion', 'Calms menu animations.'],
  ['Gameplay'],
  ['explorer', 'switch', 'Explorer mode', 'No depth or battery limits. Good for classrooms and quick exploring.'], ['autoLights', 'switch', 'Automatic headlights', 'Switch lights on when sunlight fades.'], ['labels', 'switch', 'Name labels', 'Show names above species you have logged.'], ['hints', 'switch', 'Control hints', 'Show tips at the start of a dive.'],
  ['Accessibility'],
  ['largeText', 'switch', 'Larger text'], ['contrast', 'switch', 'High-contrast HUD', 'Solid black panels behind readouts.'],
  ['Data'],
  ['online', 'switch', 'Online field data', 'Load photos from Wikipedia and allow live searches of WoRMS and OBIS.'],
];
renderers.settings = () => {
  const box = $('settingsBody'), s = F.save.settings; box.innerHTML = '';
  for (const row of SETTINGS) {
    if (row.length === 1) { box.appendChild(el('h4', '', row[0])); continue; }
    const [key, type, label, desc, opts] = row;
    const r = el('div', 'srow'); r.appendChild(el('div', '', `<b>${label}</b>${desc ? `<p>${desc}</p>` : ''}`));
    let ctl;
    if (type === 'range') { ctl = el('input'); ctl.type = 'range'; ctl.min = 0; ctl.max = 1; ctl.step = .05; ctl.value = s[key]; ctl.id = 'set-' + key; ctl.setAttribute('aria-label', label); ctl.addEventListener('input', () => { s[key] = +ctl.value; applySettings(); }); }
    else if (type === 'switch') { ctl = el('button', 'switch', '<span></span>'); ctl.type = 'button'; ctl.setAttribute('role', 'switch'); ctl.setAttribute('aria-label', label); ctl.setAttribute('aria-checked', String(!!s[key])); ctl.firstChild.textContent = s[key] ? 'ON' : 'OFF'; ctl.addEventListener('click', () => { s[key] = !s[key]; ctl.setAttribute('aria-checked', String(s[key])); ctl.firstChild.textContent = s[key] ? 'ON' : 'OFF'; A.play('toggle', s[key]); applySettings(); }); }
    else { ctl = el('div', 'choice'); opts.forEach(([v, l]) => { const b = el('button', '', l); b.type = 'button'; b.setAttribute('aria-pressed', String(String(s[key]) === v)); b.addEventListener('click', () => { s[key] = v; ctl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); applySettings(); G.resize(); }); ctl.appendChild(b); }); }
    r.appendChild(ctl); box.appendChild(r);
  }
  // save management
  const data = el('div', 'data-box');
  const row = el('div', 'links-row');
  const sv = el('button', 'btn', 'Save link & backup'), rst = el('button', 'btn danger', 'Reset progress');
  [sv, rst].forEach(b => { b.type = 'button'; row.appendChild(b); });
  const msg = el('p', 'muted small');
  sv.addEventListener('click', () => open('save'));
  let armed = false;
  rst.addEventListener('click', () => { if (!armed) { armed = true; rst.textContent = 'Click again to erase everything'; setTimeout(() => { armed = false; rst.textContent = 'Reset progress'; }, 4000); return; } const keep = F.save.settings; F.save = F.defaultSave(); F.save.settings = keep; F.persist(); refreshTitle(); msg.textContent = 'Progress erased. Settings were kept.'; armed = false; rst.textContent = 'Reset progress'; });
  data.append(el('div', 'lbl', 'Progress saves automatically in this browser'), row, msg);
  box.appendChild(data);
};

/* ---------- save link, code and file ---------- */
const copyText = async (text, input, note) => {
  try { await navigator.clipboard.writeText(text); note.textContent = 'Copied ✓'; }
  catch (e) { input.focus(); input.select(); note.textContent = 'Press Ctrl+C (or long-press → Copy) to copy.'; }
  F.save.backedUpAt = F.loggedCount(); F.persist();
};
renderers.save = () => {
  const box = $('saveBody'), sum = F.saveSummary(F.save);
  const link = F.saveLink(), code = F.encodeSave();
  box.innerHTML = `
    <p class="muted">Your progress saves automatically in this browser. It can be lost in private windows, in apps like Instagram or WhatsApp, if browser data is cleared, or when you switch devices. A save link brings everything back on any device.</p>
    <div class="save-sum"><b>${sum.logged}/${total}</b> species · <b>${F.fmt(sum.rp)}</b> RP · <b>${sum.dives}</b> dives · deepest <b>${F.fmt(sum.maxDepth)} m</b></div>
    <div class="save-row"><div class="lbl">Your save link · bookmark it or send it to yourself</div>
      <div class="copy"><input id="saveLink" readonly value="${esc(link)}" aria-label="Save link"><button class="btn primary" id="copyLink" type="button">Copy link</button></div><p class="muted small" id="linkNote"></p></div>
    <div class="save-row"><div class="lbl">Save code · type it in on another device</div>
      <div class="copy"><input id="saveCode" readonly value="${esc(code)}" aria-label="Save code"><button class="btn" id="copyCode" type="button">Copy code</button></div><p class="muted small" id="codeNote"></p></div>
    <div class="save-row"><div class="lbl">Save file</div>
      <div class="links-row"><button class="btn" id="dlSave" type="button">Download save file</button><label class="btn" for="loadSave">Load save file</label><input id="loadSave" type="file" accept=".json,.txt,application/json,text/plain" hidden></div></div>
    <div class="save-row"><div class="lbl">Restore from a code or link</div>
      <div class="copy"><input id="restoreCode" placeholder="Paste a save code or link" aria-label="Save code to restore" autocomplete="off"><button class="btn" id="restoreBtn" type="button">Restore</button></div><p class="muted small" id="restoreNote"></p></div>
    <p class="muted small" id="protectNote"></p>`;
  $('copyLink').addEventListener('click', () => copyText(link, $('saveLink'), $('linkNote')));
  $('copyCode').addEventListener('click', () => copyText(code, $('saveCode'), $('codeNote')));
  $('dlSave').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ game: 'Fathom', code, saved: new Date().toISOString(), save: F.save }, null, 1)], { type: 'application/json' });
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `fathom-save-${F.today()}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); F.save.backedUpAt = F.loggedCount(); F.persist();
  });
  $('loadSave').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); const incoming = j.save && j.save.logged ? { ...F.defaultSave(), ...j.save } : F.decodeSave(j.code); askRestore(incoming); }
    catch (err) { $('restoreNote').textContent = 'That file is not a Fathom save.'; }
  });
  $('restoreBtn').addEventListener('click', () => {
    try { askRestore(F.decodeSave($('restoreCode').value)); }
    catch (err) { $('restoreNote').textContent = 'That code is not valid. Check it was copied completely.'; }
  });
  F.protectStorage().then(p => { const n = $('protectNote'); if (n) n.textContent = !F.storageOK ? '⚠ This browser is blocking storage (private mode?). Use the save link to keep your progress.' : p ? '✓ This browser has agreed to keep your save safe from automatic clean-up.' : ''; });
};
// Ask before applying a save from a link, code or file. Merging keeps the best of both.
let pendingRestore = null;
function askRestore(incoming) {
  pendingRestore = incoming;
  const a = F.saveSummary(F.save), b = F.saveSummary(incoming);
  $('restoreBody').innerHTML = `<p>This save has <b>${b.logged}</b> species, <b>${F.fmt(b.rp)}</b> RP and <b>${b.dives}</b> dives.</p>
    <p class="muted">This browser currently has ${a.logged} species, ${F.fmt(a.rp)} RP and ${a.dives} dives. Restoring combines both and keeps the best of each, so nothing is lost.</p>`;
  open('restore');
}
$('restoreYes').addEventListener('click', () => {
  if (!pendingRestore) return close();
  const settings = F.save.settings;
  F.save = { ...F.mergeSave(F.save, pendingRestore), settings };
  F.persist(); pendingRestore = null; closeAll(); refreshTitle(); F.checkAchievements();
  if (G.state === 'paused') G.resume();
  toast(`Progress restored · ${F.loggedCount()} species logged`, 'good', 5000);
});
$('restoreNo').addEventListener('click', () => { pendingRestore = null; close(); });
// Opened from a save link: offer to restore, then tidy the address bar.
function checkSaveLink() {
  const m = location.hash.match(/save=([A-Za-z0-9_-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const incoming = F.decodeSave(m[1]);
    if (F.encodeSave(F.mergeSave(F.save, incoming)) === F.encodeSave(F.save)) { toast('This save link is already up to date on this device.', 'good'); return; }
    askRestore(incoming);
  } catch (e) { toast('That save link is damaged or incomplete.', 'warn'); }
}
function applySettings() {
  const s = F.save.settings; F.persist();
  body.classList.toggle('no-crt', !s.scanlines);
  $('fps').hidden = !s.showFps;
  body.classList.toggle('reduced-motion', !!s.reducedMotion);
  body.classList.toggle('hud-contrast', !!s.contrast);
  document.documentElement.classList.toggle('large-text', !!s.largeText);
  $('btnSound').textContent = s.muted ? '×' : '♪'; $('btnSound').setAttribute('aria-pressed', String(s.muted));
  A.apply();
}

/* ---------- touch controls ---------- */
(() => {
  const stick = $('stick'), knob = $('knob'); let id = null;
  const move = e => { const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const R = r.width / 2, d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; G.touch.x = dx / R; G.touch.y = dy / R; };
  stick.addEventListener('pointerdown', e => { id = e.pointerId; stick.setPointerCapture(id); move(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = () => { id = null; knob.style.transform = ''; G.touch.x = G.touch.y = 0; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const boost = $('tBoost');
  boost.addEventListener('pointerdown', () => { G.touch.boost = true; boost.classList.add('on'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => boost.addEventListener(ev, () => { G.touch.boost = false; boost.classList.remove('on'); }));
  $('tLights').addEventListener('click', () => G.toggleLights());
  $('tPing').addEventListener('click', () => G.ping());
})();

/* ---------- boot ---------- */
S.prewarm(F.SPECIES.slice().sort((a, b) => a.m - b.m));
applySettings();
G.start();
G.toMenu();
refreshTitle();
F.checkAchievements();
checkSaveLink();
addEventListener('hashchange', checkSaveLink);
if (F.loggedCount() > 0) F.protectStorage();
F.on('discover', () => { if (F.loggedCount() === 1) F.protectStorage(); if (!F.storageOK && !shownOnce.has('nostore')) { shownOnce.add('nostore'); toast('This browser is not keeping your progress (private mode?). Open the menu → Save to get a save link.', 'warn', 8000); } });
})();
