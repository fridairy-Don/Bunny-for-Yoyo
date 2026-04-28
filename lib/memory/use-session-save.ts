"use client";

import { useCallback, useState } from "react";

import type { ConversationTurn } from "../types/conversation";
import { requestPolaroidGeneration, type Polaroid } from "./polaroid-store";
import {
  addDistilledMemories,
  archiveSession,
  getLastSessionCloser,
  getRecentSummaries,
  saveLastSessionCloser,
  updateSessionSummary,
  type DistilledMemory,
  type SessionCloser,
} from "./session-store";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Options = {
  getTurns: () => ConversationTurn[];
  getExistingMemories: () => string[];
  onAccepted: (accepted: DistilledMemory[]) => void;
  onCloserUpdated: (closer: SessionCloser | null) => void;
  onSummariesUpdated?: (summaries: string[]) => void;
  // A polaroid begins generating — this is the optimistic placeholder
  // (status "pending", image still developing). The wall renders this as
  // a "developing…" card right away so saving feels instant.
  onPolaroidPending?: (placeholder: Polaroid) => void;
  // Final state — either ready (with imageUrl) or failed. The wall swaps
  // the placeholder with this row.
  onPolaroidSettled?: (polaroid: Polaroid | null, error?: string) => void;
};

// Encapsulates the save-to-memory flow: distill via /api/distill, dedup +
// persist new memories, archive the full session, refresh the last-closer
// payload (used by the LLM to continue the next opening from where we left
// off), trigger background summarize + polaroid generation, and drive the
// 4-state button label through its lifecycle.
//
// Flow ordering, intentional:
//   1. distill (sync, blocks button)
//   2. archive session row + last-closer (sync — these power memory list)
//   3. button flips to "saved" — Yoyo's perceived save is done
//   4. background: summarize → updateSessionSummary → refresh recents
//   5. background: polaroid generation (~10–15s) — uses summary if it
//      arrived, otherwise falls back to last user turn so we don't block
//      on the LLM. Generation runs in parallel with summarize.
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

      const sessionId = await archiveSession(payloadTurns, accepted.map((m) => m.id));

      // capture the tail of this session so the next opening can continue from it
      await saveLastSessionCloser(payloadTurns, 4);
      options.onCloserUpdated(await getLastSessionCloser());

      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2400);

      // Optimistic polaroid placeholder so the wall has something to
      // render IMMEDIATELY while the image generates. Predictable id
      // means we can swap it cleanly when generation lands.
      const polaroidPlaceholderId = sessionId ? `pol-${sessionId}` : `pol-${now}`;
      if (sessionId && options.onPolaroidPending) {
        const placeholder: Polaroid = {
          id: polaroidPlaceholderId,
          familyId: "yoyo-family",
          sessionId,
          sessionDate: todayStr,
          prompt: null,
          imageUrl: null,
          status: "pending",
          // Layout values are placeholder — server will randomize and
          // persist final values when the row is upserted. Wall uses
          // its own jitter for placeholder until then.
          pinColor: "rose",
          tiltDeg: 0,
          xOffsetPx: 0,
          yOffsetPx: 0,
          liked: false,
          errorMessage: null,
          createdAt: Date.now(),
        };
        options.onPolaroidPending(placeholder);
      }

      // Summarize the session in the background — flips the button back to
      // idle without waiting on the LLM. Attaches to bunny_sessions.summary
      // and refreshes the in-memory list of recent summaries used by the
      // next-visit prompt.
      let summaryPromise: Promise<string> = Promise.resolve("");
      if (sessionId) {
        summaryPromise = (async () => {
          try {
            const res = await fetch("/api/summarize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ turns: payloadTurns }),
            });
            const data = await res.json();
            const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
            if (summary) {
              await updateSessionSummary(sessionId, summary);
              if (options.onSummariesUpdated) {
                const fresh = await getRecentSummaries(3);
                options.onSummariesUpdated(fresh);
              }
            }
            return summary;
          } catch (err) {
            console.warn("[bunny] background summarize failed:", err);
            return "";
          }
        })();
        // fire-and-await internally — do not block save UI
        void summaryPromise;
      }

      // Polaroid generation — runs in background. Waits up to 8s for the
      // summary so the prompt can be richer; if the summary stalls, we
      // fall back to the transcript so the wall still gets a card today.
      if (sessionId && options.onPolaroidSettled) {
        void (async () => {
          let summary = "";
          try {
            // Race: wait for summary, but don't hold the polaroid for it
            // longer than 8s.
            summary = await Promise.race([
              summaryPromise,
              new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000)),
            ]);
          } catch {
            summary = "";
          }

          const result = await requestPolaroidGeneration({
            sessionId,
            sessionDate: todayStr,
            summary: summary || null,
            turns: payloadTurns,
          });
          options.onPolaroidSettled?.(result.polaroid, result.error);
        })();
      }
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
