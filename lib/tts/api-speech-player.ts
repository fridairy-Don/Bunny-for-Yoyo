"use client";

import { audioBus } from "../audio/audio-bus";
import {
  createSpeechPlayer,
  type SpeakOptions,
  type SpeechPlayer,
  type WordTiming,
} from "./browser-speech-player";
import type { TtsPlaybackResult } from "../types/conversation";

// Routes Bunny's voice through the shared Web Audio bus so that background
// music (which plays through a regular <audio> element) is never interrupted
// when Bunny starts speaking.
export class ApiSpeechPlayer implements SpeechPlayer {
  private readonly browserSpeech = createSpeechPlayer();

  estimateDurationMs(text: string) {
    return this.browserSpeech.estimateDurationMs(text);
  }

  stop() {
    audioBus.stopTts();
    this.browserSpeech.stop();
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<TtsPlaybackResult> {
    let payload: {
      strategy?: string;
      audioBase64?: string;
      mimeType?: string;
      wordTimings?: WordTiming[];
    };
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("Speech request failed.");
      payload = await response.json();
    } catch {
      return this.browserSpeech.speak(text, options);
    }

    if (payload.strategy !== "audio" || !payload.audioBase64) {
      return this.browserSpeech.speak(text, options);
    }

    const timings = Array.isArray(payload.wordTimings) ? payload.wordTimings : [];
    const fallbackWords = text.trim().split(/\s+/).filter(Boolean);
    let lastWordIndex = -1;

    const onProgressMs = options.onWordChange
      ? (elapsedMs: number, durationMs: number) => {
          let idx = lastWordIndex;
          if (timings.length > 0) {
            while (idx + 1 < timings.length && timings[idx + 1].startMs <= elapsedMs) {
              idx += 1;
            }
          } else if (fallbackWords.length > 0 && durationMs > 0) {
            const step = durationMs / fallbackWords.length;
            idx = Math.min(fallbackWords.length - 1, Math.floor(elapsedMs / step));
          }
          if (idx !== lastWordIndex) {
            lastWordIndex = idx;
            options.onWordChange!(idx);
          }
        }
      : undefined;

    try {
      const result = await audioBus.playTts(
        payload.audioBase64,
        payload.mimeType ?? "audio/mpeg",
        { onProgressMs },
      );
      // Ensure the final word lands as "spoken" so the last span shows the
      // read-through colour instead of freezing mid-sentence.
      if (options.onWordChange) {
        const totalWords = timings.length > 0 ? timings.length : fallbackWords.length;
        if (totalWords > 0 && lastWordIndex !== totalWords - 1) {
          options.onWordChange(totalWords - 1);
        }
      }
      return { durationMs: result.durationMs };
    } catch {
      return this.browserSpeech.speak(text, options);
    }
  }
}
