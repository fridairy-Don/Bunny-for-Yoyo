"use client";

import { onAudioSessionAfterRelease } from "./audio-session";

// A single shared audio bus. Background music stays on a plain <audio>
// element (so the UI can keep controlling play/pause/volume simply), and
// TTS is routed through Web Audio via decodeAudioData + an
// AudioBufferSourceNode. The key property: the two paths never compete
// for the browser's single HTMLMediaElement audio session, so Bunny and
// the child can both talk without the background music stuttering.

type TtsPlayOptions = {
  onProgressMs?: (elapsedMs: number, durationMs: number) => void;
};

type TtsPlayResult = {
  durationMs: number;
};

class AudioBus {
  private ctx: AudioContext | null = null;
  private ttsGain: GainNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeRaf: number | null = null;
  private sessionUnsub: (() => void) | null = null;

  private async ensureCtx(): Promise<AudioContext | null> {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.ttsGain = this.ctx.createGain();
      this.ttsGain.gain.value = 1.0;
      this.ttsGain.connect(this.ctx.destination);
      // After every mic recording iOS suspends this context. Resume the
      // moment the recorder signals release so Bunny's voice plays even
      // when the user hasn't interacted with the page since the mic.
      if (!this.sessionUnsub) {
        this.sessionUnsub = onAudioSessionAfterRelease(() => {
          const ctx = this.ctx;
          if (!ctx) return;
          if (ctx.state !== "running") {
            void ctx.resume().catch(() => undefined);
          }
        });
      }
    }
    // iOS reports "suspended" both before the first user gesture and right
    // after a mic recording releases. Either way, resume is the same call;
    // it is a no-op when the context is already running.
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        // ignore — will retry on next play attempt
      }
    }
    return this.ctx;
  }

  stopTts() {
    if (this.activeRaf != null) {
      cancelAnimationFrame(this.activeRaf);
      this.activeRaf = null;
    }
    if (this.activeSource) {
      try {
        this.activeSource.onended = null;
        this.activeSource.stop();
      } catch {}
      try {
        this.activeSource.disconnect();
      } catch {}
      this.activeSource = null;
    }
  }

  async playTts(
    audioBase64: string,
    _mimeType: string,
    options: TtsPlayOptions = {},
  ): Promise<TtsPlayResult> {
    const ctx = await this.ensureCtx();
    if (!ctx || !this.ttsGain) {
      return { durationMs: 0 };
    }

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const arrayBuffer = bytes.buffer;

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    } catch {
      return { durationMs: 0 };
    }

    this.stopTts();

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.ttsGain);

    const durationMs = Math.round(audioBuffer.duration * 1000);
    const startedAt = ctx.currentTime;
    this.activeSource = source;

    if (options.onProgressMs) {
      const report = options.onProgressMs;
      const tick = () => {
        if (this.activeSource !== source) return;
        const elapsed = (ctx.currentTime - startedAt) * 1000;
        report(elapsed, durationMs);
        this.activeRaf = requestAnimationFrame(tick);
      };
      this.activeRaf = requestAnimationFrame(tick);
    }

    return await new Promise<TtsPlayResult>((resolve) => {
      source.onended = () => {
        if (this.activeRaf != null) {
          cancelAnimationFrame(this.activeRaf);
          this.activeRaf = null;
        }
        if (this.activeSource === source) this.activeSource = null;
        try {
          source.disconnect();
        } catch {}
        if (options.onProgressMs) options.onProgressMs(durationMs, durationMs);
        resolve({ durationMs });
      };
      try {
        source.start();
      } catch {
        source.onended = null;
        resolve({ durationMs: 0 });
      }
    });
  }
}

export const audioBus = new AudioBus();
