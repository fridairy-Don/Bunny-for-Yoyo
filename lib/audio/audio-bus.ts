"use client";

import {
  notifyAudioSessionAfterRelease,
  onAudioSessionAfterRelease,
} from "./audio-session";

// A tiny silent WAV (≈0.2s, 8kHz mono 8-bit). We play this on the TTS
// HTMLAudioElement inside the user-gesture chain of the mic-stop tap, then
// keep it looping at volume 0 until real TTS data arrives. iOS treats the
// element as "currently playing" while it loops, so swapping audio.src to
// the real TTS data URI later keeps playback alive WITHOUT needing a fresh
// user gesture — which is otherwise gone after our async transcription /
// LLM / TTS-fetch chain.
function buildSilentWavDataUri(): string {
  if (typeof window === "undefined") return "";
  const sampleRate = 8000;
  const durationSec = 0.2;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  // RIFF header
  view.setUint8(0, 0x52); view.setUint8(1, 0x49);
  view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  view.setUint32(4, 36 + numSamples, true);
  view.setUint8(8, 0x57); view.setUint8(9, 0x41);
  view.setUint8(10, 0x56); view.setUint8(11, 0x45);
  // fmt chunk
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d);
  view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);   // byte rate
  view.setUint16(32, 1, true);            // block align
  view.setUint16(34, 8, true);            // bits per sample
  // data chunk
  view.setUint8(36, 0x64); view.setUint8(37, 0x61);
  view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  view.setUint32(40, numSamples, true);
  // 8-bit unsigned silence is 0x80 (mid-scale).
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 0x80);
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

let SILENT_WAV: string | null = null;
function getSilentWav(): string {
  if (SILENT_WAV !== null) return SILENT_WAV;
  SILENT_WAV = buildSilentWavDataUri();
  return SILENT_WAV;
}

// A single shared audio bus for Bunny's TTS playback. Originally this was
// Web Audio (decodeAudioData → AudioBufferSourceNode), which mixes
// cleanly with the background-music HTMLAudioElement but is *not*
// reliable on iOS Safari: after every getUserMedia recording, iOS
// suspends every AudioContext, and ctx.resume() outside a user gesture
// either silently fails or claims success while producing no sound. The
// next user gesture is far in the future (Yoyo isn't going to tap the
// page again just to wake the audio engine), so Bunny stays mute.
//
// HTMLAudioElement has a different gesture model: once it has been
// unlocked by ANY user-gesture-triggered .play() (for us, the very
// first interaction with the page that fires the auto-opener), every
// subsequent .play() works without needing a fresh gesture. It also
// recovers cleanly from media-session interruptions like getUserMedia.
//
// Tradeoff: iOS may briefly duck the background music while TTS plays.
// That's actually desirable here — Bunny's voice should be the
// foreground sound while she speaks, music returns when she finishes.

type TtsPlayOptions = {
  onProgressMs?: (elapsedMs: number, durationMs: number) => void;
};

type TtsPlayResult = {
  durationMs: number;
};

class AudioBus {
  private audio: HTMLAudioElement | null = null;
  private currentToken = 0;
  private subscribed = false;
  // True while we are looping the silent WAV warm-up (between the mic-stop
  // user gesture and the real TTS arriving). When this flag is true, the
  // arrival of real TTS just swaps audio.src — playback continues without
  // needing a fresh play() call (which iOS would reject outside gesture).
  private warming = false;

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (this.audio) return this.audio;

    const audio = new Audio();
    audio.preload = "auto";
    // iOS standalone PWA: keep playback inline, never trigger the
    // full-screen video player route (some iOS versions try to launch
    // QuickTime for audio elements without playsinline).
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    // Don't expose the element's controls — purely programmatic.
    audio.controls = false;
    this.audio = audio;

    // After every mic recording iOS pauses any audio that was playing
    // and never auto-resumes. If we have an in-flight TTS playback when
    // that happens, nudge it back to play() the moment the recorder
    // releases the audio session.
    if (!this.subscribed) {
      this.subscribed = true;
      onAudioSessionAfterRelease(() => {
        const a = this.audio;
        if (!a) return;
        if (a.paused && a.src && !a.ended) {
          // If we're mid-warmup (silent WAV looping) and iOS paused us,
          // try the gentler retry path: play() first; if that fails,
          // load() + play(). Without load(), the decoder can stay
          // wedged from the audio-session flip.
          const result = a.play();
          if (result && typeof result.catch === "function") {
            result.catch(() => {
              try {
                a.load();
                const p2 = a.play();
                if (p2 && typeof p2.catch === "function") {
                  p2.catch(() => undefined);
                }
              } catch {
                // ignore — this is a best-effort safety net.
              }
            });
          }
        }
      });
    }

    return audio;
  }

  // Called from inside the mic-stop user gesture so iOS keeps treating
  // this audio element as "actively playing" through the async transcription
  // + LLM + TTS-fetch chain. Loops the silent WAV at volume ~0. When real
  // TTS data arrives, playTts() just swaps audio.src — the in-flight
  // playback continues, no fresh play() call needed.
  //
  // CRITICAL — DO NOT USE muted=true HERE. iOS Safari treats muted-class
  // media autoplay differently from unmuted-class. If we prime with
  // muted=true and later set muted=false on the real TTS, iOS can treat
  // the unmute as a "new media start" and demand a fresh gesture (which
  // is gone by then — we awaited STT + LLM + TTS-fetch). The whole
  // transition must stay unmuted-class, just with volume near zero.
  // Volume=0 alone is sometimes treated by Chrome as "silent → don't
  // count as playing" too, so we use a near-zero audible level which
  // every browser respects as actively-playing audible-class media.
  primeForPlayback(): void {
    const audio = this.ensureAudio();
    if (!audio) return;
    if (this.warming) return;
    const silent = getSilentWav();
    if (!silent) return;
    try {
      this.warming = true;
      audio.loop = true;
      audio.muted = false;
      audio.volume = 0.0001;
      audio.src = silent;
      // iOS Safari sometimes needs an explicit load() before play() to
      // wake the decoder, especially right after an audio-session
      // category flip. Cheap on every other platform.
      try {
        audio.load();
      } catch {
        // ignore — element will still try to play below.
      }
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        // DO NOT clear `warming` on rejection. Promise rejection from
        // iOS during an audio-session-flip window doesn't necessarily
        // mean the element won't start playing once the flip completes —
        // the play request is still queued. Clearing `warming` here would
        // poison the next playTts() into using the slower stop+swap path
        // which iOS then rejects (no gesture). Stay optimistic and let
        // the subsequent src swap inherit the queued playback state.
        p.catch(() => undefined);
      }
    } catch {
      this.warming = false;
    }
  }

  // Idempotent "are we still warmed up?" nudge — call from inside a fresh
  // user gesture (e.g. mic-stop tap) to make sure the silent WAV is
  // *actually* playing before we rely on the src-swap trick. iPad PWA
  // sometimes pauses the silent loop during the PlayAndRecord session
  // and then-after release leaves it paused even though we already
  // notified subscribers — this re-poke catches that.
  ensureWarmupPlaying(): void {
    const audio = this.audio;
    if (!audio) return;
    if (!this.warming) return;
    if (!audio.paused) return;
    if (!audio.src) return;
    try {
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => undefined);
      }
    } catch {
      // ignore — safety net only.
    }
  }

  stopTts() {
    // Bump token first so any in-flight progress loop / pending promise
    // bails out cleanly instead of fighting the new playback.
    this.currentToken += 1;
    const audio = this.audio;
    if (!audio) return;
    this.warming = false;
    try {
      audio.pause();
      audio.loop = false;
      audio.muted = false;
      audio.volume = 1;
      // Clearing src releases the decoder's hold on the data URI; the
      // next playTts() will assign a fresh one.
      audio.removeAttribute("src");
      audio.load();
    } catch {
      // ignore — element will be replaced on next playTts.
    }
    // iOS PWA quirk: while the TTS audio element was playing (even at
    // near-zero volume during warmup), iOS may have ducked or paused
    // the background music. Now that TTS is done, fire the after-release
    // pulse so the music player can resume itself. This is the missing
    // wakeup that left iPad users with silent music after Bunny spoke.
    notifyAudioSessionAfterRelease();
  }

  async playTts(
    audioBase64: string,
    mimeType: string,
    options: TtsPlayOptions = {},
  ): Promise<TtsPlayResult> {
    const audio = this.ensureAudio();
    if (!audio) return { durationMs: 0 };

    // If we are mid-warm-up (silent WAV looping from the mic-stop gesture),
    // we MUST NOT call stopTts() — that pauses the element and removes the
    // src, which destroys the iOS "this element is playing" state. Instead,
    // bump the token, settle the element back to normal volume, and swap
    // src directly. The in-flight playback continues with the new data.
    const wasWarming = this.warming;
    if (wasWarming) {
      this.currentToken += 1;
      this.warming = false;
      audio.loop = false;
      audio.muted = false;
      audio.volume = 1;
    } else {
      // Stop any prior playback first so the timeupdate / ended listeners
      // from the previous run don't leak into this token.
      this.stopTts();
    }

    // Capture warmup state for tryPlay. When the silent loop is *actually*
    // playing (not paused) at swap time, iOS continues playback through
    // the src change without requiring a fresh user gesture. When it's
    // paused — which iPad PWA can do during the audio-session flip even
    // after our resume nudges — the src swap leaves us paused. tryPlay
    // below uses this hint to be more aggressive about retry.
    const warmupWasLive = wasWarming && !audio.paused;

    const token = ++this.currentToken;
    const effectiveMime = mimeType || "audio/mpeg";
    audio.src = `data:${effectiveMime};base64,${audioBase64}`;

    return await new Promise<TtsPlayResult>((resolve) => {
      let raf: number | null = null;
      let resolved = false;
      const onProgress = options.onProgressMs;

      const cleanup = () => {
        if (raf != null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      };

      const finish = (durationMs: number) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        if (onProgress) onProgress(durationMs, durationMs);
        // Wake music: iOS PWA may have ducked/paused background music
        // while TTS played. Fire the after-release pulse so the music
        // hook gets a chance to play() again. Idempotent — if music
        // is already playing this is a no-op.
        try {
          notifyAudioSessionAfterRelease();
        } catch {
          // ignore — best effort.
        }
        resolve({ durationMs });
      };

      const onEnded = () => {
        if (this.currentToken !== token) return;
        const durationMs = Math.round((audio.duration || 0) * 1000);
        finish(durationMs);
      };

      const onError = () => {
        if (this.currentToken !== token) return;
        finish(0);
      };

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);

      const tick = () => {
        if (resolved) return;
        if (this.currentToken !== token) {
          // Someone called stopTts (or started a new playback) — bow
          // out without resolving so we don't double-resolve and don't
          // produce stale progress callbacks.
          cleanup();
          return;
        }
        if (onProgress) {
          const dur = audio.duration;
          // audio.duration starts as NaN until the data URI is decoded;
          // guard against it before reporting progress.
          if (Number.isFinite(dur) && dur > 0) {
            onProgress(audio.currentTime * 1000, dur * 1000);
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      const tryPlay = () => {
        const p = audio.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            // First play rejected. iOS Safari sometimes needs an
            // explicit load() to re-establish the decoder after a
            // recent audio-session category flip. Try once more.
            try {
              audio.load();
              const p2 = audio.play();
              if (p2 && typeof p2.catch === "function") {
                p2.catch(() => {
                  // Two synchronous attempts failed. Last resort:
                  // schedule a delayed retry. iOS PWA sometimes
                  // accepts play() once the audio-session category
                  // has fully settled (~200-500ms after release).
                  // Without this third try, iPad users hear silence
                  // from Bunny even when STT/LLM/TTS all succeed.
                  setTimeout(() => {
                    if (resolved) return;
                    if (this.currentToken !== token) return;
                    try {
                      const p3 = audio.play();
                      if (p3 && typeof p3.catch === "function") {
                        p3.catch(() => finish(0));
                      }
                    } catch {
                      finish(0);
                    }
                  }, 350);
                });
              }
            } catch {
              finish(0);
            }
          });
        }
      };
      // When the silent warmup wasn't actually playing at swap time, the
      // src change probably left us paused too. Force a fresh load() to
      // wake the decoder before the first play() attempt — that's the
      // path that actually unblocks iPad PWA after the gesture window
      // has expired during the STT+LLM+TTS roundtrip.
      if (wasWarming && !warmupWasLive) {
        try {
          audio.load();
        } catch {
          // ignore — tryPlay will try again.
        }
      }
      tryPlay();
    });
  }
}

export const audioBus = new AudioBus();
