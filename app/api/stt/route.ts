import { getMockTranscript } from "../../../lib/server/mock-phase1";
import { transcribeWithGroq } from "../../../lib/server/providers/groq";
import { getProviderEnv, hasGroqConfig } from "../../../lib/server/provider-env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio");
  const env = getProviderEnv();

  if (!(audio instanceof File)) {
    return Response.json({ error: "Missing audio file." }, { status: 400 });
  }

  if (audio.size === 0) {
    return Response.json(
      {
        error: "No audio was captured.",
        code: "empty_audio_capture",
      },
      { status: 422 },
    );
  }

  if (!hasGroqConfig(env)) {
    return Response.json({
      text: getMockTranscript(),
      mode: "mock",
    });
  }

  try {
    const text = await transcribeWithGroq(audio);

    return Response.json({
      text,
      mode: "live",
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "STT provider could not process the recording.",
        code: "stt_provider_error",
      },
      { status: 502 },
    );
  }
}
