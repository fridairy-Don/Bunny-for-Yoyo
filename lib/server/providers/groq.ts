import "server-only";

import { expectOk } from "../http";
import { getProviderEnv } from "../provider-env";

export async function transcribeWithGroq(audioFile: File) {
  const env = getProviderEnv();
  const formData = new FormData();
  const fileName = audioFile.name || getAudioFileName(audioFile.type);

  formData.append("file", audioFile, fileName);
  formData.append("model", env.groqSttModel);
  formData.append("response_format", "json");
  formData.append("language", "en");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
    },
    body: formData,
  });

  await expectOk(response, "Groq transcription request failed.");
  const payload = await response.json();

  return payload?.text?.trim() || "";
}

function getAudioFileName(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("mpeg")) {
    return "recording.m4a";
  }

  if (mimeType.includes("ogg")) {
    return "recording.ogg";
  }

  if (mimeType.includes("wav")) {
    return "recording.wav";
  }

  return "recording.webm";
}
