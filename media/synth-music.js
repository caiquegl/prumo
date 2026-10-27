// Generates an original ambient track (pad + soft plucks + reveal swell) as 16-bit stereo WAV.
const fs = require("fs");

const [, , out = "music.wav", seconds = "9.5"] = process.argv;
const SR = 44100;
const DUR = Number(seconds);
const N = Math.floor(SR * DUR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const chords = [
  [45, 52, 57, 60, 64, 71],
  [41, 48, 53, 57, 60, 67],
  [43, 50, 55, 59, 62, 69],
  [40, 47, 52, 55, 59, 66],
];
const chordLen = DUR / chords.length;

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const ci = Math.min(chords.length - 1, Math.floor(t / chordLen));
  const local = t - ci * chordLen;
  const xfade = Math.min(1, local / 0.6);
  const prev = chords[Math.max(0, ci - 1)];
  const cur = chords[ci];
  let l = 0, r = 0;
  const pad = (notes, g) => {
    notes.forEach((n, k) => {
      const f = midi(n);
      const amp = g * (k === 0 ? 0.9 : 0.45 / (1 + k * 0.25));
      l += amp * Math.sin(2 * Math.PI * f * t);
      r += amp * Math.sin(2 * Math.PI * f * 1.003 * t + 0.4);
    });
  };
  pad(cur, xfade);
  if (ci > 0 && xfade < 1) pad(prev, 1 - xfade);
  const trem = 0.82 + 0.18 * Math.sin(2 * Math.PI * 0.2 * t);
  L[i] = l * 0.05 * trem;
  R[i] = r * 0.05 * trem;
}

const step = 0.375;
const pattern = [0, 2, 4, 5, 4, 2];
for (let k = 0; k * step < DUR - 0.8; k++) {
  const start = k * step;
  const ci = Math.min(chords.length - 1, Math.floor(start / chordLen));
  const note = chords[ci][pattern[k % pattern.length]] + 12;
  const f = midi(note);
  const pan = 0.5 + 0.35 * Math.sin(k * 1.3);
  const s0 = Math.floor(start * SR);
  for (let j = 0; j < SR * 1.6 && s0 + j < N; j++) {
    const tt = j / SR;
    const env = Math.min(1, tt / 0.004) * Math.exp(-tt * 3.2);
    const v = 0.06 * env * (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(4 * Math.PI * f * tt));
    L[s0 + j] += v * (1 - pan);
    R[s0 + j] += v * pan;
  }
}

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
let lp = 0;
for (let i = Math.floor(2.4 * SR); i < Math.floor(4.8 * SR) && i < N; i++) {
  const t = i / SR;
  const p = (t - 2.4) / 2.4;
  const env = Math.sin(Math.PI * Math.min(1, p)) ** 2;
  lp += (rnd() - lp) * (0.02 + 0.15 * p);
  L[i] += lp * env * 0.18;
  R[i] += lp * env * 0.18;
}

const delay = Math.floor(SR * 0.23);
for (let i = delay; i < N; i++) {
  L[i] += R[i - delay] * 0.28;
  R[i] += L[i - delay] * 0.28;
}

const fadeIn = SR * 0.8, fadeOut = SR * 1.6;
let peak = 0;
for (let i = 0; i < N; i++) {
  const g = Math.min(1, i / fadeIn) * Math.min(1, (N - i) / fadeOut);
  L[i] *= g; R[i] *= g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.8 / peak;

const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
}
fs.writeFileSync(out, buf);
console.log("wrote", out, DUR + "s");
