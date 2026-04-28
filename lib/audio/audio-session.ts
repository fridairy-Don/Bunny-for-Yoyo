"use client";

// Tiny pub-sub for "the page is about to acquire / has just released the
// recording audio session." iOS Safari uses one shared audio session per
// page and routes every audio sink through it. The moment getUserMedia
// runs, iOS flips the session category to PlayAndRecord, which:
//   - pauses any playing HTMLAudioElement (background music dies)
//   - suspends every AudioContext (the TTS bus + pin SFX die)
// Even after track.stop() releases the mic, iOS does NOT auto-resume
// either of those — the page has to nudge it. These callbacks let the
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

function fireRelease() {
  for (const handler of afterRelease) {
    try {
      handler();
    } catch {
      // see above.
    }
  }
}

// iOS audio-session quirks have two competing constraints:
//
//   1. Playback resume needs a *user-activation* flag. The "Stop mic"
//      tap is the gesture that started this whole flow, so handlers
//      must run from inside that synchronous chain — not after a 100ms
//      timeout, which has already exited the activation window.
//   2. iOS itself needs ~50–100ms after track.stop() to flip the audio
//      session category back to Playback. Resume calls that fire too
//      early are accepted but silently ignored.
//
// We satisfy both by firing handlers THREE times in quick succession:
// once synchronously (riding the click's user activation), once at
// 80ms (after iOS has flipped the category), and once at 240ms (catches
// the rare slow flip on older iPads). Handlers are idempotent — a
// duplicate audio.play() / ctx.resume() is a no-op when the resource
// is already running.
export function notifyAudioSessionAfterRelease(): void {
  fireRelease();
  setTimeout(fireRelease, 80);
  setTimeout(fireRelease, 240);
}
