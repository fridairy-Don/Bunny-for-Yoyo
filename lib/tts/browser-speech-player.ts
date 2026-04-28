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
      // simulate word progression even in the no-audio fallback
      await runFakeWordProgression(text, durationMs, options);
      return { durationMs };
    }

    this.stop();

    return await new Promise<TtsPlaybackResult>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance;
      utterance.rate = 0.92;
      utterance.pitch = 1.18;

      const fallbackTimer = window.setTimeout(() => {
        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
          resolve({ durationMs });
        }
      }, durationMs + 500);

      utterance.onend = () => {
        window.clearTimeout(fallbackTimer);
        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
        }

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
