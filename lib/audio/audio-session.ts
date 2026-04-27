"use client";

// Tiny pub-sub for "the page is about to acquire / has just released the
// recording audio session." iOS Safari uses one shared audio session per
// page and routes every audio sink through it. The moment getUserMedia
// runs, iOS flips the session category to PlayAndRecord, which:
//   - pauses any playing HTMLAudioElement (background music dies)
//   - suspends every AudioContext (the TTS bus + pin SFX die)
// Even after track.stop() releases the mic, iOS does NOT auto-resume
// either of those — the user has to nudge it. These callbacks let the
// music hook + the TTS bus re-establish themselves the instant the
// recorder is done.

type Handler = () => void;

const beforeAcquire = new Set<Handler>();
const afterRelease = new Set<Handler>();

export function onAudioSessionBeforeAcquire(handler: Handler): () => void {
  beforeAcquire.add(handler);
  return () => beforeAcquire.delete(handler);
}

export function onAudioSessionAfterRelease(handler: Handler): () => void {
  afterRelease.add(handler);
  return () => afterRelease.delete(handler);
}

export function notifyAudioSessionBeforeAcquire(): void {
  for (const handler of beforeAcquire) {
    try {
      handler();
    } catch {
      // never let a misbehaving subscriber stop the others.
    }
  }
}

// Async because iOS needs ~50–100ms after track.stop() to flip the audio
// session category back. Calling resume() too quickly is a no-op that
// leaves things silent.
export async function notifyAudioSessionAfterRelease(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 80));
  for (const handler of afterRelease) {
    try {
      handler();
    } catch {
      // see above.
    }
  }
}
