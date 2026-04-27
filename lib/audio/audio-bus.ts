"use client";

import { onAudioSessionAfterRelease } from "./audio-session";

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
          const result = a.play();
          if (result && typeof result.catch === "function") {
            result.catch(() => undefined);
          }
        }
      });
    }

    return audio;
  }

  stopTts() {
    // Bump token first so any in-flight progress loop / pending promise
    // bails out cleanly instead of fighting the new playback.
    this.currentToken += 1;
    const audio = this.audio;
    if (!audio) return;
    try {
      audio.pause();
      // Clearing src releases the decoder's hold on the data URI; the
      // next playTts() will assign a fresh one.
      audio.removeAttribute("src");
      audio.load();
    } catch {
      // ignore — element will be replaced on next playTts.
    }
  }

  async playTts(
    audioBase64: string,
    mimeType: string,
    options: TtsPlayOptions = {},
  ): Promise<TtsPlayResult> {
    const audio = this.ensureAudio();
    if (!audio) return { durationMs: 0 };

    // Stop any prior playback first so the timeupdate / ended listeners
    // from the previous run don't leak into this token.
    this.stopTts();

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

      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // play() rejection most often means iOS hadn't unlocked this
          // element yet (no prior user gesture). Resolve as a 0-length
          // playback so the conversation flow keeps moving — the caller
          // will fall back to its own browser-speech path.
          finish(0);
        });
      }
    });
  }
}

export const audioBus = new AudioBus();
