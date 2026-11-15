// All sound is synthesized with WebAudio: no audio files, no network. The context is
// created lazily on the first user gesture (a browser only lets sound start then), and
// every effect is a short oscillator or noise burst through one master gain.

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  /** A 16-step bassline in A minor; the music timer steps through it. */
  const BASSLINE = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 73.42, 0];

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    /** Call from any user gesture: unlocks the context without playing anything. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 0.07, 'square', 0.08, 220);
    },
    explosion(big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1400);
      tone(big ? 160 : 220, big ? 0.4 : 0.25, 'sawtooth', 0.18, 40);
    },
    pickup() {
      tone(523, 0.09, 'sine', 0.2);
      setTimeout(() => tone(784, 0.12, 'sine', 0.2), 70);
    },
    hit() {
      tone(320, 0.3, 'sawtooth', 0.3, 60);
      noise(0.2, 0.35, 700);
    },
    dash() {
      noise(0.16, 0.16, 2400);
    },
    waveClear() {
      [523, 659, 784].forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'triangle', 0.22), i * 90));
    },
    gameOver() {
      [392, 311, 233, 175].forEach((freq, i) => setTimeout(() => tone(freq, 0.35, 'triangle', 0.22), i * 160));
    },
    start() {
      [262, 392, 523].forEach((freq, i) => setTimeout(() => tone(freq, 0.14, 'triangle', 0.2), i * 70));
    },
    startMusic() {
      if (!ensure() || musicTimer !== null) return;
      musicStep = 0;
      musicTimer = setInterval(() => {
        if (muted) return;
        const freq = BASSLINE[musicStep % BASSLINE.length];
        musicStep += 1;
        if (freq > 0) tone(freq, 0.22, 'sawtooth', 0.05);
      }, 150);
    },
    stopMusic() {
      if (musicTimer !== null) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
