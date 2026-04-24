import { getMockReply } from "../../../lib/server/mock-phase1";
import { generateOpenRouterReply } from "../../../lib/server/providers/openrouter";
import { getProviderEnv, hasOpenRouterConfig } from "../../../lib/server/provider-env";
import type { ConversationTurn } from "../../../lib/types/conversation";

export const runtime = "nodejs";

type ChatBody = {
  turns?: ConversationTurn[];
  memories?: string[];
  lastCloser?: {
    endedAt?: number;
    turns?: Array<{ role: "user" | "assistant"; text: string }>;
  } | null;
  firstLaunch?: boolean;
  recentSummaries?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatBody;
  const turns = body.turns ?? [];
  const memories = Array.isArray(body.memories) ? body.memories.filter((m) => typeof m === "string") : [];
  const lastCloser = body.lastCloser ?? null;
  const firstLaunch = Boolean(body.firstLaunch);
  const recentSummaries = Array.isArray(body.recentSummaries)
    ? body.recentSummaries.filter((s) => typeof s === "string")
    : [];
  const env = getProviderEnv();

  if (!Array.isArray(turns)) {
    return Response.json({ error: "Invalid turns payload." }, { status: 400 });
  }

  if (!hasOpenRouterConfig(env)) {
    return Response.json({
      text: firstLaunch
        ? "…Oh. I can talk? Yoyo… is that really you?"
        : getMockReply(turns),
      mode: "mock",
    });
  }

  try {
    const text = await generateOpenRouterReply(turns, memories, lastCloser, {
      firstLaunch,
      recentSummaries,
    });

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
