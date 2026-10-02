/* Fathom audio: everything is synthesised with Web Audio, so there are no sound files to load. */
(() => {
const F = window.Fathom;
const A = F.audio = { ready: false };
let ctx, master, music, sfx, amb, delay, delayFb, delayWet, noiseBuf;
let ambSrc, ambFilter, ambGain, waveGain, droneA, droneB, droneFilter, droneGain;
let mode = 'menu', zone = 0, depth = 0, under = false, nextNoteAt = 0, schedTimer = null;

const SCALES = [ // pentatonic sets per zone, getting lower and sparser
  [57, 60, 62, 64, 67, 69, 72, 74],  // menu / sunlight
  [55, 57, 60, 62, 64, 67, 69],
  [50, 53, 55, 57, 60, 62],
  [45, 48, 50, 52, 55],
  [40, 43, 45, 47, 50],
];
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

A.init = () => {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3;
  master = ctx.createGain(); master.connect(comp); comp.connect(ctx.destination);
  music = ctx.createGain(); sfx = ctx.createGain(); amb = ctx.createGain();
  [music, sfx, amb].forEach(g => g.connect(master));
  // shared echo for music and some effects
  delay = ctx.createDelay(2); delay.delayTime.value = .42;
  delayFb = ctx.createGain(); delayFb.gain.value = .42;
  delayWet = ctx.createGain(); delayWet.gain.value = .5;
  const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
  delay.connect(dl); dl.connect(delayFb); delayFb.connect(delay); dl.connect(delayWet); delayWet.connect(music);
  // brown noise buffer
  const len = ctx.sampleRate * 4; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
  // ambience: filtered noise + slow wave swell
  ambSrc = ctx.createBufferSource(); ambSrc.buffer = noiseBuf; ambSrc.loop = true;
  ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 900;
  waveGain = ctx.createGain(); waveGain.gain.value = .5;
  const lfo = ctx.createOscillator(); lfo.frequency.value = .09; const lfoAmt = ctx.createGain(); lfoAmt.gain.value = .35;
  lfo.connect(lfoAmt); lfoAmt.connect(waveGain.gain); lfo.start();
  ambGain = ctx.createGain(); ambGain.gain.value = .6;
  ambSrc.connect(ambFilter); ambFilter.connect(waveGain); waveGain.connect(ambGain); ambGain.connect(amb); ambSrc.start();
  // low drone that follows depth
  droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 260; droneFilter.Q.value = 4;
  droneGain = ctx.createGain(); droneGain.gain.value = 0;
  droneA = ctx.createOscillator(); droneA.type = 'sawtooth'; droneB = ctx.createOscillator(); droneB.type = 'sawtooth';
  droneA.frequency.value = 55; droneB.frequency.value = 55.4;
  droneA.connect(droneFilter); droneB.connect(droneFilter); droneFilter.connect(droneGain); droneGain.connect(amb);
  droneA.start(); droneB.start();
  A.ready = true;
  A.apply();
  schedTimer = setInterval(schedule, 200);
};

A.apply = () => {
  if (!ctx) return;
  const s = F.save.settings, t = ctx.currentTime;
  master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, .05);
  music.gain.setTargetAtTime(s.music * .5, t, .1);
  sfx.gain.setTargetAtTime(s.sfx, t, .05);
  amb.gain.setTargetAtTime(s.ambience * .7, t, .1);
};

A.setMode = m => { mode = m; nextNoteAt = 0; };
A.setDepth = (m, isUnder) => {
  if (!ctx) return;
  depth = m; under = isUnder; zone = F.zoneIdx(m);
  const t = ctx.currentTime;
  ambFilter.frequency.setTargetAtTime(isUnder ? Math.max(120, 520 * Math.exp(-m / 900)) : 1100, t, .4);
  waveGain.gain.setTargetAtTime(isUnder ? .25 : .55, t, .4);
  droneGain.gain.setTargetAtTime(isUnder ? Math.min(.06, .015 + m / 60000) : 0, t, 1);
  const base = [55, 49, 41.2, 36.7, 32.7][zone];
  droneA.frequency.setTargetAtTime(base, t, 2); droneB.frequency.setTargetAtTime(base * 1.006, t, 2);
  droneFilter.frequency.setTargetAtTime(isUnder ? 140 + 260 * Math.exp(-m / 2500) : 200, t, 1);
};

function voice(freq, when, dur, vol, type = 'sine', dest = music, echo = true) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = type; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2.001;
  f.type = 'lowpass'; f.frequency.value = 1800;
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(vol, when + Math.min(.5, dur * .3));
  g.gain.exponentialRampToValueAtTime(.0001, when + dur);
  const g2 = ctx.createGain(); g2.gain.value = .25;
  o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(dest); if (echo) g.connect(delay);
  o.start(when); o2.start(when); o.stop(when + dur + .05); o2.stop(when + dur + .05);
}

function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (nextNoteAt < now) nextNoteAt = now + .1;
  while (nextNoteAt < now + .6) {
    const sc = SCALES[mode === 'menu' ? 0 : zone];
    const sparse = mode === 'menu' ? .7 : [.55, .45, .35, .28, .22][zone];
    if (Math.random() < sparse) {
      const n = sc[Math.floor(Math.random() * sc.length)];
      voice(mtof(n), nextNoteAt, 2.6 + Math.random() * 2, .07, mode === 'menu' ? 'triangle' : 'sine');
      if (Math.random() < .25) voice(mtof(n - 12), nextNoteAt, 4, .05, 'sine');
    }
    nextNoteAt += mode === 'menu' ? .55 : .8 + zone * .15;
  }
}

function noise(when, dur, vol, freq, q = 1, type = 'bandpass', dest = sfx) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(.0001, when + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(when, Math.random() * 3); s.stop(when + dur + .05);
  return f;
}
function blip(freq, when, dur, vol, type = 'square', slide = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, when);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), when + dur);
  g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(.0001, when + dur);
  o.connect(g); g.connect(sfx); o.start(when); o.stop(when + dur + .02);
  return g;
}

A.play = (name, arg) => {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  switch (name) {
    case 'click': blip(660, t, .06, .08); blip(990, t + .03, .05, .05); break;
    case 'hover': blip(1320, t, .025, .025); break;
    case 'toggle': blip(arg ? 880 : 520, t, .07, .07); break;
    case 'back': blip(520, t, .06, .07); blip(390, t + .04, .07, .05); break;
    case 'error': blip(180, t, .16, .08, 'sawtooth'); break;
    case 'splash': noise(t, .9, .5, 900, .6, 'lowpass'); noise(t + .05, 1.4, .25, 2400, 1); break;
    case 'ping': {
      const g = blip(1250, t, 1.4, .18, 'sine', .55); g.connect(delay);
      blip(2500, t, .08, .04, 'sine'); break; }
    case 'scantick': blip(1400 + (arg || 0) * 900, t, .03, .025, 'square'); break;
    case 'discover': {
      const tier = { common: 0, uncommon: 1, rare: 2, legendary: 3 }[arg] || 0;
      const notes = [72, 76, 79, 84, 88].slice(0, 3 + Math.min(2, tier));
      notes.forEach((n, i) => voice(mtof(n), t + i * .09, 1.4, .11, 'triangle', sfx));
      if (tier >= 2) voice(mtof(60), t, 2.4, .08, 'sine', sfx); break; }
    case 'study': voice(mtof(79), t, .9, .07, 'triangle', sfx); voice(mtof(84), t + .08, .9, .06, 'triangle', sfx); break;
    case 'zone': voice(mtof([62, 57, 50, 45, 38][arg || 0]), t, 3.5, .14, 'sine', sfx); voice(mtof([69, 64, 57, 52, 45][arg || 0]), t + .15, 3.5, .08, 'sine', sfx); break;
    case 'achievement': [67, 71, 74, 79].forEach((n, i) => voice(mtof(n), t + i * .07, 1.6, .1, 'square', sfx, false)); break;
    case 'upgrade': [60, 64, 67, 72].forEach((n, i) => blip(mtof(n), t + i * .06, .18, .07)); break;
    case 'warn': blip(440, t, .18, .06, 'square'); blip(440, t + .28, .18, .06, 'square'); break;
    case 'creak': { const f = noise(t, 1.2, .35, 180, 8); f.frequency.exponentialRampToValueAtTime(90, t + 1.2); break; }
    case 'lights': blip(arg ? 980 : 600, t, .05, .05); noise(t, .08, .05, 4000, 1); break;
    case 'surface': noise(t, 1.2, .35, 700, .5, 'lowpass'); voice(mtof(67), t + .2, 2, .08, 'triangle', sfx); break;
    case 'bump': noise(t, .25, .3, 120, 1, 'lowpass'); break;
    case 'quizRight': voice(mtof(76), t, .6, .1, 'triangle', sfx); voice(mtof(83), t + .1, .8, .1, 'triangle', sfx); break;
    case 'quizWrong': blip(220, t, .25, .06, 'triangle', .7); break;
  }
};
})();
