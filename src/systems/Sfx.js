// Sons gerados na hora (Web Audio), sem arquivos. O áudio só liga depois do primeiro toque.
let ctx = null;
let muted = false;
const last = {};

function tone(freq, dur, type = 'square', vol = 0.08, slideTo = null, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.12) {
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(g).connect(ctx.destination);
  src.start();
}

const SOUNDS = {
  boom: () => { noise(0.16, 0.1); tone(90, 0.18, 'sine', 0.16, 40); },
  crit: () => { noise(0.22, 0.14); tone(120, 0.25, 'sine', 0.2, 40); tone(700, 0.15, 'square', 0.05, 220); },
  coin: () => tone(1050, 0.06, 'square', 0.03, 1500),
  click: () => tone(520, 0.04, 'square', 0.04),
  clear: () => { tone(523, 0.12, 'square', 0.06); tone(659, 0.12, 'square', 0.06, null, 0.1); tone(784, 0.2, 'square', 0.06, null, 0.2); },
  reward: () => { tone(659, 0.1, 'triangle', 0.1); tone(880, 0.1, 'triangle', 0.1, null, 0.09); tone(1175, 0.22, 'triangle', 0.1, null, 0.18); },
  fail: () => tone(200, 0.3, 'sawtooth', 0.07, 70),
  boss: () => { noise(0.4, 0.12); tone(110, 0.5, 'sawtooth', 0.08, 55); tone(82, 0.6, 'square', 0.06, 41, 0.25); },
  fanfare: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.35 : 0.12, 'square', 0.06, null, i * 0.11)); },
  perfect: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, 'triangle', 0.09, null, i * 0.07)); },
  level: () => { tone(523, 0.08, 'square', 0.05); tone(784, 0.08, 'square', 0.05, null, 0.07); tone(1047, 0.18, 'triangle', 0.08, null, 0.14); },
};
const GAP_MS = { boom: 60, crit: 60, coin: 70 };

export const Sfx = {
  setMuted(v) { muted = !!v; },

  // Chamar dentro de um toque: navegadores só liberam áudio depois de um gesto.
  unlock() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!ctx && AC) ctx = new AC();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      ctx = null;
    }
  },

  play(name) {
    if (muted || !ctx || ctx.state !== 'running' || !SOUNDS[name]) return;
    const now = performance.now();
    if (now - (last[name] || 0) < (GAP_MS[name] || 30)) return;
    last[name] = now;
    try { SOUNDS[name](); } catch (e) { /* sem som, o jogo segue */ }
  },
};
