// Sunshine City v3 — procedural sound: WebAudio music + effects, no audio files.
// M mutes everything. Audio starts lazily on the first user gesture.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.step = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.stopMusic(); else this.startMusic();
    return this.muted;
  }
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.08, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is best-effort */ }
  }
  noise(dur, vol, low) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = low || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this.ctx.destination);
      src.start(t0);
    } catch (e) { /* best-effort */ }
  }
  shoot() { this.noise(0.12, 0.22, 2500); this.tone(180, 0.08, "square", 0.06, 60); }
  hit() { this.tone(220, 0.1, "triangle", 0.1, 110); }
  crash() { this.noise(0.35, 0.3, 700); this.tone(90, 0.3, "sawtooth", 0.1, 40); }
  pickup() { this.tone(660, 0.09, "sine", 0.1); setTimeout(() => this.tone(880, 0.12, "sine", 0.1), 90); }
  reload() { this.tone(300, 0.06, "square", 0.06, 200); setTimeout(() => this.tone(420, 0.06, "square", 0.06, 260), 120); }
  siren() { this.tone(700, 0.4, "sine", 0.045, 950); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, "triangle", 0.1), i * 110)); }
  startMusic() {
    if (!this.ctx || this.muted || this.musicOn) return;
    this.musicOn = true;
    const bass = [110, 110, 130.8, 98, 110, 146.8, 130.8, 98];
    const lead = [440, 523, 587, 659, 587, 523, 440, 392];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const i = this.step % 8;
      this.tone(bass[i], 0.42, "triangle", 0.055);
      if (this.step % 2 === 0) this.tone(lead[i], 0.2, "sine", 0.03);
      this.step++;
    }, 430);
  }
  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
