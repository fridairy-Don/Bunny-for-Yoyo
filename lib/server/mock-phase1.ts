import {
  BUNNY_CHARACTER,
  MOCK_ASSISTANT_REPLIES,
  MOCK_USER_UTTERANCES,
} from "../config/character";
import { PRESET_BUNNY_MEMORY } from "../memory/preset-memory";
import type { ConversationTurn } from "../types/conversation";

export function getMockTranscript() {
  return (
    MOCK_USER_UTTERANCES[Math.floor(Math.random() * MOCK_USER_UTTERANCES.length)] ?? "Hi Bunny."
  );
}

export function getMockReply(turns: ConversationTurn[]) {
  const latestUserTurn = [...turns].reverse().find((turn) => turn.role === "user");
  const fallback =
    MOCK_ASSISTANT_REPLIES[Math.floor(Math.random() * MOCK_ASSISTANT_REPLIES.length)] ??
    "I'm listening, and I'm right here with you.";

  if (!latestUserTurn) {
    return fallback;
  }

  return `${fallback} ${BUNNY_CHARACTER.name} remembers: ${PRESET_BUNNY_MEMORY[0]?.content.toLowerCase()}`;
}
