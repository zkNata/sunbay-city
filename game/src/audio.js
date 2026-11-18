// Sound, all synthesised in the browser with WebAudio: a laid-back synthwave loop, engine hum,
// sirens, gunshots and chimes. Nothing is loaded from a file. Everything is a no-op until the
// player has pressed a key or clicked, since browsers keep audio suspended before a gesture.
export function createAudio() {
  let context = null;
  let muted = false;
  let musicTimer = null;
  let sirenOsc = null;
  let engineOsc = null;
  let engineGain = null;
  let beat = 0;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function note(frequency, start, duration, type, gainValue) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** A 16-step loop: soft bass, a kick and a hat, at 96 bpm. */
  function scheduleBeat() {
    if (!context || muted) return;
    const stepTime = 60 / 96 / 4;
    const now = context.currentTime + 0.05;
    const bass = [55, 55, 65.41, 55, 49, 49, 58.27, 65.41, 55, 55, 65.41, 55, 82.41, 73.42, 65.41, 58.27];
    const freq = bass[beat % 16];
    note(freq, now, stepTime * 1.8, 'triangle', 0.16);
    if (beat % 4 === 0) note(48, now, 0.12, 'sine', 0.22);
    if (beat % 4 === 2) note(6200, now, 0.03, 'square', 0.02);
    beat += 1;
    musicTimer = window.setTimeout(scheduleBeat, stepTime * 1000);
  }

  return {
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    startMusic() {
      this.unlock();
      if (!context || musicTimer !== null) return;
      scheduleBeat();
    },
    stopMusic() {
      if (musicTimer !== null) {
        window.clearTimeout(musicTimer);
        musicTimer = null;
      }
    },
    setMuted(value) {
      muted = value;
      if (muted) {
        this.stopMusic();
        this.stopSiren();
        this.stopEngine();
      } else {
        this.startMusic();
      }
    },
    isMuted() {
      return muted;
    },
    chime() {
      const ctx = ensure();
      if (!ctx || muted) return;
      note(660, ctx.currentTime, 0.16, 'sine', 0.18);
      note(880, ctx.currentTime + 0.12, 0.24, 'sine', 0.18);
      note(1320, ctx.currentTime + 0.24, 0.3, 'sine', 0.12);
    },
    thud() {
      const ctx = ensure();
      if (!ctx || muted) return;
      note(90, ctx.currentTime, 0.14, 'sine', 0.3);
    },
    shot() {
      const ctx = ensure();
      if (!ctx || muted) return;
      note(1400, ctx.currentTime, 0.05, 'square', 0.1);
      note(220, ctx.currentTime, 0.1, 'sawtooth', 0.16);
    },
    startSiren() {
      const ctx = ensure();
      if (!ctx || muted || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      const gain = ctx.createGain();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      gain.gain.value = 0.035;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.7;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(gain);
      gain.connect(ctx.destination);
      sirenOsc.start();
      lfo.start();
      sirenOsc._lfo = lfo;
    },
    stopSiren() {
      if (sirenOsc) {
        try { sirenOsc.stop(); sirenOsc._lfo?.stop(); } catch { /* already stopped */ }
        sirenOsc = null;
      }
    },
    engine(speedRatio) {
      const ctx = ensure();
      if (!ctx || muted) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(ctx.destination);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speedRatio * 90;
      engineGain.gain.value = 0.02 + speedRatio * 0.03;
    },
    stopEngine() {
      if (engineOsc) {
        try { engineOsc.stop(); } catch { /* already stopped */ }
        engineOsc = null;
        engineGain = null;
      }
    },
  };
}
