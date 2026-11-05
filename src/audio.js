import { clamp } from './utils.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.enabled = true;
    this.noise = null;
    this.biome = null;
    this._ambientNodes = [];
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.72 : 0;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
  }

  setEnabled(value) {
    this.enabled = value;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(value ? 0.72 : 0, this.ctx.currentTime, 0.03);
  }

  _gain(value = 0.2) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(this.master);
    return g;
  }

  _noise(duration = 0.2, gain = 0.2, type = 'bandpass', freq = 1000, q = 0.8) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = this._gain(gain);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter); filter.connect(g);
    src.start(now); src.stop(now + duration + 0.02);
  }

  _tone(freq = 440, duration = .15, gain = .12, type = 'sine', slide = null, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), now + duration);
    const g = this._gain(gain);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    osc.start(now); osc.stop(now + duration + 0.03);
  }

  setBiome(biome) {
    if (!this.ctx) return;
    if (this.biome === biome && this._ambientNodes.length) return;
    this.biome = biome;
    this._stopAmbient();
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    const gains = {
      jungle: { base: 56, filter: 260, vol: .022, wind: 640, type: 'sine' },
      temple: { base: 46, filter: 190, vol: .024, wind: 480, type: 'triangle' },
      catacomb: { base: 34, filter: 140, vol: .03, wind: 260, type: 'sine' },
      lost: { base: 42, filter: 180, vol: .027, wind: 390, type: 'sawtooth' },
    }[biome] || { base: 50, filter: 200, vol: .02, wind: 400, type: 'sine' };
    const bed = this.ctx.createGain();
    bed.gain.setValueAtTime(0.0001, now);
    bed.gain.exponentialRampToValueAtTime(gains.vol, now + 2.2);
    bed.connect(this.master);
    for (const mult of [1, 1.5, 2.01]) {
      const o = this.ctx.createOscillator();
      o.type = gains.type;
      o.frequency.value = gains.base * mult;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = gains.filter * mult;
      o.connect(f); f.connect(bed);
      o.start(now);
      this._ambientNodes.push(o);
    }
    // air / room tone
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noise; wind.loop = true;
    const wf = this.ctx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = gains.wind; wf.Q.value = 0.35;
    const wg = this.ctx.createGain();
    wg.gain.value = biome === 'jungle' ? .018 : .012;
    wind.connect(wf); wf.connect(wg); wg.connect(this.master);
    wind.start(now);
    this._ambientNodes.push(wind);
    this._ambientGain = bed;
    this._ambientWind = wg;
  }

  _stopAmbient() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this._ambientGain) {
      this._ambientGain.gain.cancelScheduledValues(now);
      this._ambientGain.gain.setValueAtTime(Math.max(0.0001, this._ambientGain.gain.value), now);
      this._ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    }
    if (this._ambientWind) {
      this._ambientWind.gain.cancelScheduledValues(now);
      this._ambientWind.gain.setValueAtTime(Math.max(0.0001, this._ambientWind.gain.value), now);
      this._ambientWind.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    }
    const nodes = this._ambientNodes;
    this._ambientNodes = [];
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch {} } }, 950);
    this._ambientGain = null;
    this._ambientWind = null;
  }

  whip() {
    this._noise(.16, .22, 'highpass', 1800, .6);
    this._tone(1200, .12, .045, 'sawtooth', 180);
    setTimeout(() => this._noise(.06, .2, 'bandpass', 2800, .7), 80);
  }
  punch() {
    this._noise(.1, .24, 'lowpass', 340);
    this._tone(95, .12, .13, 'sine', 48);
  }
  hit() {
    this._noise(.16, .18, 'lowpass', 900);
    this._tone(72, .18, .1, 'square', 38);
  }
  hurt() {
    this._noise(.22, .18, 'lowpass', 500);
    this._tone(110, .22, .09, 'sawtooth', 55);
  }
  shoot() {
    this._noise(.34, .37, 'highpass', 850, .5);
    this._noise(.14, .24, 'lowpass', 1500);
    this._tone(68, .38, .2, 'sine', 35);
  }
  click() { this._tone(160, .035, .035, 'square', 110); }
  jump() { this._noise(.12, .08, 'bandpass', 560, .5); this._tone(180, .12, .025, 'sine', 310); }
  land() { this._noise(.14, .13, 'lowpass', 400, .5); this._tone(55, .12, .06, 'sine', 40); }
  step(alt = false) { this._noise(.05, .018, 'bandpass', alt ? 280 : 340, 1.1); }
  pickup() { [660, 880, 1320].forEach((f, i) => this._tone(f, .22, .045, 'sine', null, i * .06)); }
  potion() { [392, 523, 659, 784].forEach((f, i) => this._tone(f, .25, .035, 'triangle', null, i * .05)); }
  secret() { [220, 277, 330, 440].forEach((f, i) => this._tone(f, .5, .04, 'sine', null, i * .09)); this._noise(.7, .04, 'bandpass', 1100, .6); }
  relic() {
    [262, 330, 392, 523, 659, 784].forEach((f, i) => this._tone(f, .9, .055, 'triangle', null, i * .1));
    this._noise(1.0, .035, 'bandpass', 1400, .5);
  }
  gate() { this._noise(.6, .12, 'lowpass', 230); this._tone(48, .7, .08, 'sawtooth', 30); }
  lever() { this._noise(.1, .2, 'bandpass', 700, .9); this._tone(180, .18, .07, 'square', 70); }
  roar() {
    this._tone(62, 1.2, .14, 'sawtooth', 37);
    this._noise(1.0, .16, 'lowpass', 220);
    this._tone(113, 1.1, .05, 'square', 55);
  }
  swing() { this._noise(.42, .09, 'bandpass', 950, .5); this._tone(380, .45, .02, 'sine', 760); }
  bossHit() { this._noise(.18, .28, 'lowpass', 500); this._tone(90, .25, .12, 'square', 45); }
  splash() { this._noise(.35, .12, 'lowpass', 900); this._tone(120, .25, .03, 'sine', 180); }
}
