"use client";

export type SynthEngine = {
  start: () => void;
  stop: () => void;
};

export type SynthFactory = (ctx: AudioContext, dest: AudioNode) => SynthEngine;

// White-noise buffer shared across calls to keep startup cheap.
function makeNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const size = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export const createRainyWindow: SynthFactory = (ctx, dest) => {
  const buffer = makeNoiseBuffer(ctx, 3);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.Q.value = 0.7;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 90;

  const gain = ctx.createGain();
  gain.gain.value = 0.32;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;

  noise.connect(hp).connect(lp).connect(gain).connect(dest);
  lfo.connect(lfoGain).connect(gain.gain);

  return {
    start() {
      noise.start();
      lfo.start();
    },
    stop() {
      try {
        noise.stop();
      } catch {}
      try {
        lfo.stop();
      } catch {}
      noise.disconnect();
      hp.disconnect();
      lp.disconnect();
      gain.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
    },
  };
};

export const createMusicBox: SynthFactory = (ctx, dest) => {
  // C major pentatonic across two octaves, biased higher for twinkly feel.
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

  const gain = ctx.createGain();
  gain.gain.value = 0.28;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  lp.Q.value = 0.4;

  gain.connect(lp).connect(dest);

  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function scheduleNote() {
    if (!alive) return;
    const freq = notes[Math.floor(Math.random() * notes.length)];
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    // Second harmonic for a bell-like timbre
    const harm = ctx.createOscillator();
    harm.type = "sine";
    harm.frequency.value = freq * 2.01;

    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.12;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.55, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0015, now + 1.8);

    osc.connect(env);
    harm.connect(harmGain).connect(env);
    env.connect(gain);

    osc.start(now);
    harm.start(now);
    osc.stop(now + 1.9);
    harm.stop(now + 1.9);

    const next = 450 + Math.random() * 1200;
    timer = setTimeout(scheduleNote, next);
  }

  return {
    start() {
      scheduleNote();
    },
    stop() {
      alive = false;
      if (timer) clearTimeout(timer);
      gain.disconnect();
      lp.disconnect();
    },
  };
};

export const createStarryNight: SynthFactory = (ctx, dest) => {
  const base = 110; // A2
  const detuneCents = [0, 6, -4, 10, -8];

  const gain = ctx.createGain();
  gain.gain.value = 0.2;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1400;
  lp.Q.value = 0.5;

  gain.connect(lp).connect(dest);

  const oscs: OscillatorNode[] = detuneCents.map((c) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = base;
    o.detune.value = c;
    o.connect(gain);
    return o;
  });

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain).connect(gain.gain);

  return {
    start() {
      oscs.forEach((o) => o.start());
      lfo.start();
    },
    stop() {
      oscs.forEach((o) => {
        try {
          o.stop();
        } catch {}
        o.disconnect();
      });
      try {
        lfo.stop();
      } catch {}
      lfo.disconnect();
      lfoGain.disconnect();
      gain.disconnect();
      lp.disconnect();
    },
  };
};

export const createWarmHum: SynthFactory = (ctx, dest) => {
  const gain = ctx.createGain();
  gain.gain.value = 0.17;
  gain.connect(dest);

  const osc1 = ctx.createOscillator();
  osc1.type = "triangle";
  osc1.frequency.value = 220;

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 330;

  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.value = 440;
  const osc3Gain = ctx.createGain();
  osc3Gain.gain.value = 0.25;

  osc1.connect(gain);
  osc2.connect(gain);
  osc3.connect(osc3Gain).connect(gain);

  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 3.3;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.value = 1.8;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(osc1.frequency);
  vibratoGain.connect(osc2.frequency);

  return {
    start() {
      osc1.start();
      osc2.start();
      osc3.start();
      vibrato.start();
    },
    stop() {
      [osc1, osc2, osc3, vibrato].forEach((o) => {
        try {
          o.stop();
        } catch {}
        o.disconnect();
      });
      osc3Gain.disconnect();
      vibratoGain.disconnect();
      gain.disconnect();
    },
  };
};

export const SYNTH_FACTORIES: Record<string, SynthFactory> = {
  "rainy-window": createRainyWindow,
  "music-box": createMusicBox,
  "starry-night": createStarryNight,
  "warm-hum": createWarmHum,
};
