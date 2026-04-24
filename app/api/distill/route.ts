import { extractMemoriesFromTurns } from "../../../lib/server/providers/openrouter";
import { getProviderEnv, hasOpenRouterConfig } from "../../../lib/server/provider-env";
import type { ConversationTurn } from "../../../lib/types/conversation";

export const runtime = "nodejs";

type DistillBody = {
  turns?: ConversationTurn[];
  existingMemories?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as DistillBody;
  const turns = Array.isArray(body.turns) ? body.turns : [];
  const existingMemories = Array.isArray(body.existingMemories)
    ? body.existingMemories.filter((m) => typeof m === "string")
    : [];
  const env = getProviderEnv();

  if (turns.length === 0) {
    return Response.json({ memories: [], mode: "empty" });
  }

  if (!hasOpenRouterConfig(env)) {
    return Response.json({ memories: [], mode: "mock" });
  }

  try {
    const memories = await extractMemoriesFromTurns(turns, existingMemories);
    return Response.json({ memories, mode: "live" });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Distillation failed." }, { status: 500 });
  }
}
