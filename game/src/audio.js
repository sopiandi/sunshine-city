// Synthesised sound effects — no audio files, no network. Everything is
// built with the Web Audio API at run time, so the game stays offline.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let sirenNodes = null;
  let engineNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  // v2 (B3): a quiet original loop — Am–F–C–G arpeggio, soft triangle
  // plucks under a low pad. No files, no melody anyone owns. It sits well
  // under the effects; M stops it together with everything else.
  const MUSIC_NOTES = [220, 261.63, 329.63, 174.61, 220, 261.63, 196, 246.94, 293.66, 130.81, 164.81, 196];
  function musicTick() {
    if (muted || !ctx) return;
    const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
    musicStep += 1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.035, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.95);
    if (musicStep % 4 === 1) {
      const pad = ctx.createOscillator();
      const padGain = ctx.createGain();
      pad.type = 'sine';
      pad.frequency.value = note / 2;
      padGain.gain.setValueAtTime(0.0001, t);
      padGain.gain.linearRampToValueAtTime(0.02, t + 0.4);
      padGain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
      pad.connect(padGain).connect(ctx.destination);
      pad.start(t);
      pad.stop(t + 2);
    }
  }

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function blip(freq, dur, type, gainValue) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue || 0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }

  function noise(dur, gainValue, filterFreq) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const gain = c.createGain();
    gain.gain.value = gainValue || 0.25;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (muted) { this.stopSiren(); this.stopMusic(); }
      return muted;
    },
    get muted() { return muted; },
    get musicOn() { return musicTimer !== null; },
    startMusic() {
      if (musicTimer || muted) return;
      const c = ensure();
      if (!c) return;
      musicTimer = setInterval(musicTick, 450);
    },
    stopMusic() {
      if (!musicTimer) return;
      clearInterval(musicTimer);
      musicTimer = null;
    },
    shoot() { noise(0.14, 0.3, 2400); },
    crash() { noise(0.25, 0.5, 700); blip(70, 0.25, 'sawtooth', 0.25); },
    enemyShoot() { noise(0.12, 0.15, 1400); },
    pickup() { blip(880, 0.12, 'sine', 0.14); blip(1320, 0.16, 'sine', 0.1); },
    cash() { blip(660, 0.1, 'triangle', 0.14); blip(990, 0.18, 'triangle', 0.14); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.14), i * 110)); },
    hurt() { blip(160, 0.2, 'sawtooth', 0.16); },
    busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.14), i * 160)); },
    startSiren() {
      if (muted || sirenNodes) return;
      const c = ensure();
      if (!c) return;
      const osc = c.createOscillator();
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 750;
      lfo.type = 'sine';
      lfo.frequency.value = 0.7;
      lfoGain.gain.value = 220;
      gain.gain.value = 0.085;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(gain).connect(c.destination);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
    },
    stopSiren() {
      if (!sirenNodes) return;
      try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
      sirenNodes = null;
    },
    startEngine() {
      if (engineNodes) return;
      const c = ensure();
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 70;
      gain.gain.value = 0.0;
      osc.connect(gain).connect(c.destination);
      osc.start();
      engineNodes = { osc, gain };
    },
    setEngine(speedRatio) {
      if (!engineNodes) return;
      engineNodes.osc.frequency.value = 60 + speedRatio * 140;
      engineNodes.gain.gain.value = muted ? 0 : 0.04 + speedRatio * 0.05;
    },
    stopEngine() {
      if (!engineNodes) return;
      try { engineNodes.osc.stop(); } catch { /* already stopped */ }
      engineNodes = null;
    },
  };
}
