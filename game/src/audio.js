// Sunshine City — procedural sound: every effect and the music are
// synthesised with WebAudio, no audio files. M mutes everything.
// Written fresh in this session for the v3 rebuild.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio must never break the game */ }
  }
  noise(dur, vol, lowpass) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      let node = src;
      if (lowpass) {
        const f = this.ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = lowpass;
        src.connect(f); node = f;
      }
      node.connect(g); g.connect(this.master);
      src.start(t);
    } catch (e) { /* audio must never break the game */ }
  }
  shoot() { this.noise(0.14, 0.3, 2400); this.blip(180, 0.08, "square", 0.1, 60); }
  hit() { this.blip(520, 0.07, "triangle", 0.12, 300); }
  crash(strength) { this.noise(0.25, Math.min(0.4, 0.1 + strength * 0.01), 900); }
  pickup() { this.blip(660, 0.09, "sine", 0.14); this.blip(990, 0.12, "sine", 0.12); }
  cash() {
    this.blip(880, 0.1, "sine", 0.14);
    setTimeout(() => this.blip(1174, 0.14, "sine", 0.14), 90);
    setTimeout(() => this.blip(1568, 0.2, "sine", 0.14), 180);
  }
  siren() { this.blip(700, 0.4, "sine", 0.05, 950); }
  startEngine() {
    if (!this.ensure()) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = "sawtooth";
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 420;
        this.engineOsc.connect(f); f.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
    } catch (e) { /* ignore */ }
  }
  engine(speedRatio) {
    if (!this.engineOsc || !this.ctx) return;
    try {
      this.engineOsc.frequency.value = 55 + speedRatio * 130;
      this.engineGain.gain.value = speedRatio > 0.02 ? 0.035 + speedRatio * 0.03 : 0;
    } catch (e) { /* ignore */ }
  }
  // Sunny little loop: bass roots + a bright plucked melody, 8 steps a bar.
  startMusic() {
    if (!this.ensure() || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49];           // A1 A1 C2 G1
    const lead = [220, 261.6, 329.6, 440, 329.6, 261.6, 220, 164.8];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const step = this.musicStep % 32;
      const bar = Math.floor(step / 8);
      if (step % 8 === 0) this.blip(bass[bar], 0.7, "triangle", 0.09);
      if (step % 2 === 0) this.blip(lead[(step / 2) % 8], 0.16, "sine", 0.045);
      if (step % 8 === 4) this.noise(0.05, 0.05, 6000);
      this.musicStep++;
    }, 190);
  }
}
