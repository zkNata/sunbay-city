// All sound is synthesised with WebAudio: no audio files, no network. A laid-back synthwave
// loop (bass, pad chords, hats) plays under the game, the engine hum follows the car's speed,
// the siren wails while the police are after you, and every action has a small effect.

const MUSIC_BPM = 92;
const BASS_LINE = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
const CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
  [164.81, 196, 246.94],
];

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let stepIndex = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      return false;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    startMusic();
    return true;
  }

  function note(freq, when, duration, type, gainValue, destination) {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(gainValue, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  function startMusic() {
    const stepSeconds = 60 / MUSIC_BPM / 2;
    musicTimer = window.setInterval(() => {
      if (!context || muted) return;
      const now = context.currentTime + 0.05;
      const bar = Math.floor(stepIndex / 8) % CHORDS.length;
      const beat = stepIndex % 8;
      note(BASS_LINE[beat], now, stepSeconds * 1.8, 'triangle', 0.5, musicGain);
      if (beat === 0) {
        for (const freq of CHORDS[bar]) note(freq, now, stepSeconds * 7, 'sine', 0.12, musicGain);
      }
      if (beat % 2 === 0) {
        // A short noise hat: a burst through a high-pass filter.
        const buffer = context.createBuffer(1, 2205, 44100);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const filter = context.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 6000;
        const gain = context.createGain();
        gain.gain.value = 0.12;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(musicGain);
        source.start(now);
      }
      stepIndex += 1;
    }, (stepSeconds * 1000) / 2);
  }

  function noiseBurst(duration, filterFreq, gainValue) {
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Called every frame: engine pitch follows speed, siren follows the wanted level. */
    update(driving, speed, wanted, dt) {
      if (!context) return;
      const targetEngine = driving ? 0.05 + Math.min(0.16, Math.abs(speed) / 560 * 0.16) : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : targetEngine, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + Math.abs(speed) * 0.22, context.currentTime, 0.1);
      const sirenOn = wanted > 0 && !muted;
      sirenGain.gain.setTargetAtTime(sirenOn ? 0.045 : 0, context.currentTime, 0.2);
      if (sirenOn) {
        sirenOsc.frequency.value = 700 + 260 * Math.sin(performance.now() / 380);
      }
    },
    shoot() {
      if (!context || muted) return;
      noiseBurst(0.12, 2400, 0.5);
      note(180, context.currentTime, 0.08, 'square', 0.2, master);
    },
    punch() {
      if (!context || muted) return;
      noiseBurst(0.09, 500, 0.5);
    },
    pickup() {
      if (!context || muted) return;
      const now = context.currentTime;
      note(660, now, 0.12, 'sine', 0.3, master);
      note(990, now + 0.09, 0.18, 'sine', 0.3, master);
    },
    missionDone() {
      if (!context || muted) return;
      const now = context.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => note(freq, now + i * 0.11, 0.3, 'triangle', 0.3, master));
    },
    explosion() {
      if (!context || muted) return;
      noiseBurst(0.7, 300, 0.8);
      note(55, context.currentTime, 0.6, 'sine', 0.5, master);
    },
    busted() {
      if (!context || muted) return;
      const now = context.currentTime;
      [392, 311.13, 233.08].forEach((freq, i) => note(freq, now + i * 0.22, 0.4, 'sawtooth', 0.2, master));
    },
    destroy() {
      if (musicTimer !== null) window.clearInterval(musicTimer);
      if (context) context.close();
    },
  };
}
