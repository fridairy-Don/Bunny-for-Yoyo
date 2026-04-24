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

type CharAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type WithTimestampsResponse = {
  audio_base64: string;
  alignment?: CharAlignment;
  normalized_alignment?: CharAlignment;
};

export async function synthesizeWithElevenLabs(text: string): Promise<SynthesisResult> {
  const env = getProviderEnv();

  // Use the with-timestamps endpoint so we can light up each word as Bunny
  // actually speaks it. Same billing as the plain TTS call.
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${env.elevenLabsVoiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.elevenLabsApiKey || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: env.elevenLabsModelId,
        voice_settings: BUNNY_TTS_SETTINGS,
      }),
    },
  );

  await expectOk(response, "ElevenLabs speech request failed.");
  const payload = (await response.json()) as WithTimestampsResponse;

  const audioBase64 = payload.audio_base64;
  const alignment = payload.normalized_alignment ?? payload.alignment;
  const wordTimings = alignment ? buildWordTimings(alignment) : [];

  return {
    audioBase64,
    mimeType: "audio/mpeg",
    wordTimings,
  };
}

function buildWordTimings(alignment: CharAlignment): WordTiming[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  if (!characters?.length) return [];

  const words: WordTiming[] = [];
  let buffer = "";
  let bufferStart = -1;
  let bufferEnd = -1;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed && bufferStart >= 0) {
      words.push({
        word: trimmed,
        startMs: Math.round(bufferStart * 1000),
        endMs: Math.round(bufferEnd * 1000),
      });
    }
    buffer = "";
    bufferStart = -1;
    bufferEnd = -1;
  };

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    const start = character_start_times_seconds[i] ?? 0;
    const end = character_end_times_seconds[i] ?? start;
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (bufferStart < 0) bufferStart = start;
    bufferEnd = end;
    buffer += ch;
  }
  flush();
  return words;
}
