import { synthesizeWithElevenLabs } from "../../../lib/server/providers/elevenlabs";
import { getProviderEnv, hasElevenLabsConfig } from "../../../lib/server/provider-env";

export const runtime = "nodejs";

type TtsBody = {
  text?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as TtsBody;
  const text = body.text?.trim();
  const env = getProviderEnv();

  if (!text) {
    return Response.json({ error: "Missing text." }, { status: 400 });
  }

  if (!hasElevenLabsConfig(env)) {
    return Response.json({
      mode: "mock",
      strategy: "browser",
      text,
    });
  }

  try {
    const audio = await synthesizeWithElevenLabs(text);

    return Response.json({
      mode: "live",
      strategy: "audio",
      ...audio,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "TTS request failed.",
      },
      { status: 500 },
    );
  }
}
