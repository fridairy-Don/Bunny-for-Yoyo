import "server-only";

import { BUNNY_CHARACTER } from "../../config/character";
import { PRESET_BUNNY_MEMORY, formatPresetMemoryForPrompt } from "../../memory/preset-memory";
import type { ConversationTurn } from "../../types/conversation";
import { expectOk } from "../http";
import { getOpenRouterHeaders, getProviderEnv } from "../provider-env";

export async function generateOpenRouterReply(turns: ConversationTurn[]) {
  const env = getProviderEnv();

  const messages = [
    {
      role: "system",
      content: [
        BUNNY_CHARACTER.systemPrompt,
        `Tone: ${BUNNY_CHARACTER.tone}.`,
        "Preset memory:",
        formatPresetMemoryForPrompt(PRESET_BUNNY_MEMORY),
        "Speak in child-friendly spoken English.",
        "Write numbers, times, dates, symbols, and abbreviations the way they should be spoken aloud.",
        "Avoid markdown, emoji, bullet points, and stage directions.",
      ].join(" "),
    },
    ...turns
      .filter((turn) => turn.role !== "system")
      .map((turn) => ({ role: turn.role, content: turn.text })),
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
      ...getOpenRouterHeaders(env),
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      messages,
      temperature: 0.8,
    }),
  });

  await expectOk(response, "OpenRouter request failed.");
  const payload = await response.json();

  return (
    payload?.choices?.[0]?.message?.content?.trim() ||
    "I'm here with you, and I want to listen carefully."
  );
}
