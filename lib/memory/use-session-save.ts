"use client";

import { useCallback, useState } from "react";

import type { ConversationTurn } from "../types/conversation";
import {
  addDistilledMemories,
  archiveSession,
  getLastSessionCloser,
  saveLastSessionCloser,
  type DistilledMemory,
  type SessionCloser,
} from "./session-store";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Options = {
  getTurns: () => ConversationTurn[];
  getExistingMemories: () => string[];
  onAccepted: (accepted: DistilledMemory[]) => void;
  onCloserUpdated: (closer: SessionCloser | null) => void;
};

// Encapsulates the save-to-memory flow: distill via /api/distill, dedup +
// persist new memories, archive the full session, refresh the last-closer
// payload (used by the LLM to continue the next opening from where we left
// off), and drive the 4-state button label through its lifecycle.
export function useSessionSave(options: Options) {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const save = useCallback(async () => {
    if (saveState === "saving") return;
    setSaveState("saving");
    try {
      const payloadTurns = options.getTurns().filter((t) => t.role !== "system");
      const existingMemoryContents = options.getExistingMemories();
      const response = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: payloadTurns,
          existingMemories: existingMemoryContents,
        }),
      });
      const data = await response.json();
      const extracted: Array<{ type: string; content: string; importance: number }> =
        data?.memories ?? [];

      const now = Date.now();
      const todayStr = new Date().toISOString().slice(0, 10);
      const candidateMemories: DistilledMemory[] = extracted.map((entry, i) => ({
        id: `mem-${now}-${i}`,
        createdAt: now,
        type: (entry.type as DistilledMemory["type"]) ?? "special_memory",
        content: entry.content,
        importance: entry.importance ?? 0.7,
        source: "session",
        sessionDate: todayStr,
      }));

      const accepted = await addDistilledMemories(candidateMemories);
      if (accepted.length) options.onAccepted(accepted);

      await archiveSession(payloadTurns, accepted.map((m) => m.id));

      // capture the tail of this session so the next opening can continue from it
      await saveLastSessionCloser(payloadTurns, 4);
      options.onCloserUpdated(await getLastSessionCloser());

      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2400);
    } catch {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2400);
    }
  }, [saveState, options]);

  const reset = useCallback(() => setSaveState("idle"), []);

  const label =
    saveState === "saving"
      ? "saving…"
      : saveState === "saved"
        ? "saved"
        : saveState === "error"
          ? "try again"
          : "save to memory";

  return { saveState, save, reset, label };
}
