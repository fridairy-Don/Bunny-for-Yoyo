"use client";

import type { DailySession, DistilledMemory } from "../../lib/memory/session-store";

// pure helpers kept here because they are only used within the memory detail
// views; no side effects, safe to re-import from other memory components later
export function dateKeyFromMemory(m: DistilledMemory) {
  if (m.sessionDate) return m.sessionDate;
  return new Date(m.createdAt).toISOString().slice(0, 10);
}

export function formatDateLabel(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (key === today) return "today";
  if (key === yesterday) return "yesterday";
  const [y, m, d] = key.split("-");
  return `${y}.${m}.${d}`;
}

type Props = {
  memory: DistilledMemory;
  session: DailySession | null;
  onBack: () => void;
};

export function MemoryDetailView({ memory, session, onBack }: Props) {
  const turns = (session?.turns ?? []).filter((t) => t.role !== "system");
  return (
    <div className="mem-detail">
      <div className="mem-detail-head">
        <button className="back" onClick={onBack}>
          <span aria-hidden="true">←</span> back
        </button>
        <div className="date">
          {formatDateLabel(dateKeyFromMemory(memory))} · {memory.type.replace("_", " ")}
        </div>
        <div className="phrase">{memory.content}</div>
      </div>
      <div className="mem-detail-body">
        {turns.length === 0 ? (
          <div className="mem-detail-empty">
            the full talk was not kept alongside this memory.
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={`mem-detail-line ${turn.role === "user" ? "user" : ""}`}
            >
              <span className="who">{turn.role === "user" ? "Yoyo" : "Bunny"}</span>
              {turn.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
