import type { ConversationTurn, LlmReply } from "../types/conversation";

export type LlmClient = {
  generateReply: (turns: ConversationTurn[]) => Promise<LlmReply>;
};

export class ApiLlmClient implements LlmClient {
  async generateReply(turns: ConversationTurn[]): Promise<LlmReply> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ turns }),
    });

    if (!response.ok) {
      throw new Error("Chat request failed.");
    }

    const payload = await response.json();
    return { text: payload.text };
  }
}
