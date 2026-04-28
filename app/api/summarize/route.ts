import { summarizeTurnsAsSession } from "../../../lib/server/providers/openrouter";
import { getProviderEnv, hasOpenRouterConfig } from "../../../lib/server/provider-env";
import type { ConversationTurn } from "../../../lib/types/conversation";

export const runtime = "nodejs";

type Body = { turns?: ConversationTurn[] };

// POST /api/summarize — condense a saved session into 1-2 sentences that
// Bunny can carry into the next talk. Called from useSessionSave after
// archival, so the summary lands on bunny_sessions.summary for that day.
export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const turns = Array.isArray(body.turns) ? body.turns : [];

  if (!turns.length) {
    return Response.json({ summary: "", mode: "empty" });
  }

  const env = getProviderEnv();
  if (!hasOpenRouterConfig(env)) {
    // Without an LLM, leave summary empty rather than mocking something
    // fake that would later get injected back into the prompt.
    return Response.json({ summary: "", mode: "mock" });
  }

  try {
    const summary = await summarizeTurnsAsSession(turns);
    return Response.json({ summary, mode: "live" });
  } catch (error) {
    console.error("[bunny] summarize failed:", error);
    return Response.json({ summary: "", mode: "error" }, { status: 200 });
  }
}
