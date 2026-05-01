"use client";

import type { TtsPlaybackResult } from "../types/conversation";

export type WordTiming = {
  word: string;
  startMs: number;
  endMs: number;
};

export type SpeakOptions = {
  onWordChange?: (wordIndex: number) => void;
  onProgress?: (elapsedMs: number, totalMs: number) => void;
  /**
   * Fires when audio actually starts being audible. Use this — not the
   * speak() call — to trigger any visual that needs to land in lockstep
   * with sound (e.g. opening the bunny's mouth). Called at most once per
   * speak invocation.
   */
  onPlaybackStart?: () => void;
};

export type SpeechPlayer = {
  speak: (text: string, options?: SpeakOptions) => Promise<TtsPlaybackResult>;
  stop: () => void;
  estimateDurationMs: (text: string) => number;
};

class BrowserSpeechPlayer implements SpeechPlayer {
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  estimateDurationMs(text: string) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1800, words * 380);
  }

  stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    this.activeUtterance = null;
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<TtsPlaybackResult> {
    const durationMs = this.estimateDurationMs(text);

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      // No speech engine at all — fire the start hook immediately so
      // any visual that hangs off it doesn't get stuck waiting forever,
      // then simulate word progression for the caption.
      try {
        options.onPlaybackStart?.();
      } catch {
        // ignore — caller errors must not break the simulation.
      }
      await runFakeWordProgression(text, durationMs, options);
      return { durationMs };
    }

    this.stop();

    return await new Promise<TtsPlaybackResult>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance;
      utterance.rate = 0.92;
      utterance.pitch = 1.18;

      let startFired = false;
      const fireStart = () => {
        if (startFired) return;
        startFired = true;
        try {
          options.onPlaybackStart?.();
        } catch {
          // ignore — caller errors must not break TTS.
        }
      };

      utterance.onstart = () => {
        fireStart();
      };

      const fallbackTimer = window.setTimeout(() => {
        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
          // If onstart never fired (engine quirks), still flush start
          // before resolve so callers don't see "ended without started".
          fireStart();
          resolve({ durationMs });
        }
      }, durationMs + 500);

      utterance.onend = () => {
        window.clearTimeout(fallbackTimer);
        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
        }
        // Some Safari builds skip `onstart` and go straight to `onend`
        // for very short utterances. Make sure the start hook still
        // fires so consumers (e.g. the bunny mouth animation) don't
        // miss the speak event entirely.
        fireStart();
        resolve({ durationMs });
      };

      utterance.onerror = () => {
        window.clearTimeout(fallbackTimer);
        this.activeUtterance = null;
        resolve({ durationMs });
      };

      void runFakeWordProgression(text, durationMs, options);
      window.speechSynthesis.speak(utterance);
    });
  }
}

export async function runFakeWordProgression(
  text: string,
  durationMs: number,
  options: SpeakOptions,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || !options.onWordChange) return;
  const step = durationMs / words.length;
  for (let i = 0; i < words.length; i++) {
    options.onWordChange(i);
    // Let progression proceed, don't block the speak() resolve
    await new Promise((r) => setTimeout(r, step));
  }
}

export function createSpeechPlayer(): SpeechPlayer {
  return new BrowserSpeechPlayer();
}
