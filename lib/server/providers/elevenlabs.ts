import "server-only";

import { BUNNY_TTS_SETTINGS } from "../../config/voice";
import { expectOk } from "../http";
import { getProviderEnv } from "../provider-env";

export type WordTiming = {
  word: string;
  startMs: number;
  endMs: number;
};

export type SynthesisResult = {
  audioBase64: string;
  mimeType: string;
  wordTimings: WordTiming[];
};

// Use the plain /text-to-speech endpoint so ElevenLabs can stream audio
// bytes as they're generated. The /with-timestamps endpoint sounds nice in
// theory (per-character alignment for karaoke) but it has to finish the
// full synthesis before it can return a single JSON blob, which roughly
// doubled time-to-first-word. We trade precise per-word timing for real-
// time feel; the client derives karaoke highlights from audio.currentTime
// proportionally, which looks natural for a 6-year-old.
export async function synthesizeWithElevenLabs(text: string): Promise<SynthesisResult> {
  const env = getProviderEnv();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${env.elevenLabsVoiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.elevenLabsApiKey || "",
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: env.elevenLabsModelId,
        voice_settings: BUNNY_TTS_SETTINGS,
      }),
    },
  );

  await expectOk(response, "ElevenLabs speech request failed.");
  const arrayBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    audioBase64,
    mimeType: "audio/mpeg",
    wordTimings: [],
  };
}
