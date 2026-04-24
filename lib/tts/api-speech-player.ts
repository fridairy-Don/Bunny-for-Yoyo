"use client";

import { createSpeechPlayer, type SpeechPlayer } from "./browser-speech-player";
import type { TtsPlaybackResult } from "../types/conversation";

export class ApiSpeechPlayer implements SpeechPlayer {
  private readonly browserSpeech = createSpeechPlayer();

  estimateDurationMs(text: string) {
    return this.browserSpeech.estimateDurationMs(text);
  }

  stop() {
    this.browserSpeech.stop();
  }

  async speak(text: string): Promise<TtsPlaybackResult> {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error("Speech request failed.");
    }

    const payload = await response.json();

    if (payload.strategy !== "audio" || !payload.audioBase64) {
      return this.browserSpeech.speak(text);
    }

    const audio = new Audio(`data:${payload.mimeType};base64,${payload.audioBase64}`);
    const durationMs = this.estimateDurationMs(text);

    return await new Promise<TtsPlaybackResult>((resolve) => {
      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
      };

      audio.onended = () => {
        cleanup();
        resolve({ durationMs });
      };

      audio.onerror = () => {
        cleanup();
        this.browserSpeech.speak(text).then(resolve);
      };

      audio.play().catch(() => {
        cleanup();
        this.browserSpeech.speak(text).then(resolve);
      });
    });
  }
}
