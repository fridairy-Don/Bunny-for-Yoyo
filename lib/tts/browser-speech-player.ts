"use client";

import type { TtsPlaybackResult } from "../types/conversation";

export type SpeechPlayer = {
  speak: (text: string) => Promise<TtsPlaybackResult>;
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

  async speak(text: string): Promise<TtsPlaybackResult> {
    const durationMs = this.estimateDurationMs(text);

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      await new Promise((resolve) => setTimeout(resolve, durationMs));
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

      window.speechSynthesis.speak(utterance);
    });
  }
}

export function createSpeechPlayer(): SpeechPlayer {
  return new BrowserSpeechPlayer();
}
