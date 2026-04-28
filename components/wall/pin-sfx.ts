"use client";

// Web Audio "pin pushed into corkboard" sound effect.
// Two layered components:
//   - a short attack-tick (~3kHz triangle, 25ms) — the pin meeting paper
//   - a tiny low thud (~120Hz sine, 60ms) — the wall behind it
// Volume is intentionally low — this fires every time a polaroid lands and
// must not be louder than the bunny's voice.

let cachedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedCtx && cachedCtx.state !== "closed") return cachedCtx;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    cachedCtx = new Ctor();
  } catch {
    cachedCtx = null;
  }
  return cachedCtx;
}

export function playPinSfx(volume = 0.15): void {
  const ctx = getCtx();
  if (!ctx) return;

  // Browsers gate AudioContext on user gesture. If the bunny just spoke,
  // it'll already be running; if not, this resume() is a no-op anyway.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }

  const now = ctx.currentTime;

  // Attack tick — the sharp "tk" of the pin.
  const tick = ctx.createOscillator();
  tick.type = "triangle";
  tick.frequency.setValueAtTime(3200, now);
  tick.frequency.exponentialRampToValueAtTime(1800, now + 0.025);
  const tickGain = ctx.createGain();
  tickGain.gain.setValueAtTime(0, now);
  tickGain.gain.linearRampToValueAtTime(volume, now + 0.003);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  tick.connect(tickGain).connect(ctx.destination);
  tick.start(now);
  tick.stop(now + 0.05);

  // Low thud — body of the cork.
  const thud = ctx.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(140, now);
  thud.frequency.exponentialRampToValueAtTime(80, now + 0.05);
  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0, now);
  thudGain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.005);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  thud.connect(thudGain).connect(ctx.destination);
  thud.start(now);
  thud.stop(now + 0.1);
}
