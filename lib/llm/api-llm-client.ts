import type { ConversationTurn, LlmReply } from "../types/conversation";

export type LastCloserPayload = {
  endedAt?: number;
  turns?: Array<{ role: "user" | "assistant"; text: string }>;
} | null;

export type LlmReplyOptions = {
  firstLaunch?: boolean;
  recentSummaries?: string[];
};

export type LlmClient = {
  generateReply: (
    turns: ConversationTurn[],
    memories?: string[],
    lastCloser?: LastCloserPayload,
    options?: LlmReplyOptions,
  ) => Promise<LlmReply>;
};

export class ApiLlmClient implements LlmClient {
  async generateReply(
    turns: ConversationTurn[],
    memories: string[] = [],
    lastCloser: LastCloserPayload = null,
    options: LlmReplyOptions = {},
  ): Promise<LlmReply> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        turns,
        memories,
        lastCloser,
        firstLaunch: options.firstLaunch ?? false,
        recentSummaries: options.recentSummaries ?? [],
      }),
    });

    if (!response.ok) {
      throw new Error("Chat request failed.");
    }

    const payload = await response.json();
    return { text: payload.text };
  }
}
