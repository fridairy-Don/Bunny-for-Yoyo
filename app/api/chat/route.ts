import { getMockReply } from "../../../lib/server/mock-phase1";
import { generateOpenRouterReply } from "../../../lib/server/providers/openrouter";
import { getProviderEnv, hasOpenRouterConfig } from "../../../lib/server/provider-env";
import type { ConversationTurn } from "../../../lib/types/conversation";

export const runtime = "nodejs";

type ChatBody = {
  turns?: ConversationTurn[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatBody;
  const turns = body.turns ?? [];
  const env = getProviderEnv();

  if (!Array.isArray(turns)) {
    return Response.json({ error: "Invalid turns payload." }, { status: 400 });
  }

  if (!hasOpenRouterConfig(env)) {
    return Response.json({
      text: getMockReply(turns),
      mode: "mock",
    });
  }

  try {
    const text = await generateOpenRouterReply(turns);

    return Response.json({
      text,
      mode: "live",
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "LLM request failed.",
      },
      { status: 500 },
    );
  }
}
