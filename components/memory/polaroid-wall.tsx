"use client";

import { useEffect, useState } from "react";

import {
  getAllSessions,
  getSessionById,
  type DailySession,
  type DistilledMemory,
  type SessionCard,
} from "../../lib/memory/session-store";
import { Polaroid } from "./polaroid";
import { formatDateLabel } from "./memory-detail";

type Props = {
  // The set of session-distilled memories already in page state. Used to
  // render the "memories from this talk" list inside the expanded view
  // without re-fetching.
  memories: DistilledMemory[];
  // When polaroid is expanded and the parent sees a memory, tapping it
  // should bubble up to the existing memory detail flow for continuity.
  onOpenMemory: (mem: DistilledMemory) => void;
  // Refresh trigger: increment this whenever memories list changes so the
  // wall re-fetches sessions (e.g. after save-to-memory adds a new one).
  refreshKey: number;
};

// Replaces the linear memory list inside the memory drawer. One polaroid
// per saved session. Clicking a polaroid expands it into a detail view
// showing the full transcript + the distilled memories that came from
// that session.
//
// Lives under components/memory/ with the rest of the memory vocabulary.
// Driven entirely by Supabase — no localStorage reads here; the main store
// already caches responses so returning to the drawer is instant.
export function PolaroidWall({ memories, onOpenMemory, refreshKey }: Props) {
  const [sessions, setSessions] = useState<SessionCard[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<DailySession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getAllSessions(40)
      .then((list) => {
        if (cancelled) return;
        setSessions(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!expanded) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void getSessionById(expanded).then((s) => {
      if (cancelled) return;
      setDetail(s);
    });
    return () => {
      cancelled = true;
    };
  }, [expanded]);

  if (expanded) {
    const card = sessions.find((s) => s.id === expanded) ?? null;
    const tied =
      card && memories.filter((m) => card.distilledIds.includes(m.id));
    return (
      <div className="polaroid-detail">
        <button
          type="button"
          className="back"
          onClick={() => setExpanded(null)}
        >
          <span aria-hidden="true">←</span> back to wall
        </button>
        <div className="polaroid-detail-head">
          <div className="date">
            {card ? formatDateLabel(card.sessionDate) : ""}
          </div>
          {card?.summary ? (
            <div className="phrase">{card.summary}</div>
          ) : (
            <div className="phrase muted">a talk without a summary yet.</div>
          )}
        </div>

        {tied && tied.length > 0 ? (
          <div className="polaroid-detail-memories">
            <div className="polaroid-detail-memories-label">
              what I kept from this talk
            </div>
            {tied.map((mem) => (
              <button
                key={mem.id}
                type="button"
                className="polaroid-linked-mem"
                onClick={() => onOpenMemory(mem)}
              >
                <span className="pin" />
                <span className="text">{mem.content}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="polaroid-detail-transcript">
          {detail ? (
            (detail.turns ?? [])
              .filter((t) => t.role !== "system")
              .map((turn) => (
                <div
                  key={turn.id}
                  className={`mem-detail-line ${turn.role === "user" ? "user" : ""}`}
                >
                  <span className="who">
                    {turn.role === "user" ? "Yoyo" : "Bunny"}
                  </span>
                  {turn.text}
                </div>
              ))
          ) : (
            <div className="mem-detail-empty">loading the talk…</div>
          )}
        </div>
      </div>
    );
  }

  if (loading && sessions.length === 0) {
    return <div className="polaroid-empty">looking through old talks…</div>;
  }

  if (!loading && sessions.length === 0) {
    return (
      <div className="polaroid-empty">
        no photos yet.
        <br />
        tap <em>save to memory</em> after a talk and it will appear here.
      </div>
    );
  }

  return (
    <div className="polaroid-wall">
      {sessions.map((s) => (
        <Polaroid key={s.id} session={s} onClick={() => setExpanded(s.id)} />
      ))}
    </div>
  );
}
