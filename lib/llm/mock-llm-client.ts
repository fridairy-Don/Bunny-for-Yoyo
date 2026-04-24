import { BUNNY_CHARACTER, MOCK_ASSISTANT_REPLIES } from "../config/character";
import { PRESET_BUNNY_MEMORY } from "../memory/preset-memory";
import type { ConversationTurn, LlmReply } from "../types/conversation";

export type LlmClient = {
  generateReply: (turns: ConversationTurn[]) => Promise<LlmReply>;
};

export class MockLlmClient implements LlmClient {
  async generateReply(turns: ConversationTurn[]): Promise<LlmReply> {
    const latestUserTurn = [...turns].reverse().find((turn) => turn.role === "user");
    const fallback =
      MOCK_ASSISTANT_REPLIES[Math.floor(Math.random() * MOCK_ASSISTANT_REPLIES.length)] ??
      "I'm listening, and I'm right here with you.";

    await new Promise((resolve) => setTimeout(resolve, 650));

    if (!latestUserTurn) {
      return { text: fallback };
    }

    return {
      text: `${fallback} ${BUNNY_CHARACTER.name} remembers: ${PRESET_BUNNY_MEMORY[0]?.content.toLowerCase()}`,
    };
  }
}
