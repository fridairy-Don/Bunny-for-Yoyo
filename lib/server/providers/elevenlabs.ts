import "server-only";

import { BUNNY_TTS_SETTINGS } from "../../config/voice";
import { expectOk } from "../http";
import { getProviderEnv } from "../provider-env";

export async function synthesizeWithElevenLabs(text: string) {
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
  };
}
