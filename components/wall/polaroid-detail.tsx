"use client";

import { useEffect, useState } from "react";

import {
  deletePolaroid,
  setPolaroidLiked,
  type Polaroid,
} from "../../lib/memory/polaroid-store";
import {
  getSessionById,
  type DailySession,
  type SessionCard,
} from "../../lib/memory/session-store";

type Props = {
  polaroid: Polaroid;
  session: SessionCard | null;
  onClose: () => void;
  onLikedChange: (liked: boolean) => void;
  // Called after the row is removed from Supabase. Parent should drop
  // the polaroid from local state so the wall updates instantly.
  onDeleted: (id: string) => void;
};

function formatDate(d: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (d === today) return "today";
  if (d === yesterday) return "yesterday";
  const [y, m, day] = d.split("-");
  return `${y}.${m}.${day}`;
}

// Modal overlay shown when a polaroid is tapped. Big enlarged photo, the
// session summary as caption, and a heart toggle. Tapping the transcript
// section unfurls the full saved talk for that session.
export function PolaroidDetail({
  polaroid,
  session,
  onClose,
  onLikedChange,
  onDeleted,
}: Props) {
  const [liked, setLiked] = useState(polaroid.liked);
  const [transcript, setTranscript] = useState<DailySession | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  // Two-step delete: first tap arms the confirm row (matches the memory
  // delete pattern in the drawer so the affordance feels consistent),
  // second tap actually removes. We never delete on a single click —
  // an accidental tap from a 6yo should never erase a kept moment.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Close on Escape — modal is non-trivial UI for a 6-year-old, but a
  // parent peeking at /parent gets the keyboard escape hatch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lazy-load the transcript only when the user asks to see it. Avoids a
  // round-trip just to open the photo.
  useEffect(() => {
    if (!showTranscript || transcript || !polaroid.sessionId) return;
    let cancelled = false;
    void getSessionById(polaroid.sessionId).then((s) => {
      if (cancelled) return;
      setTranscript(s);
    });
    return () => {
      cancelled = true;
    };
  }, [showTranscript, polaroid.sessionId, transcript]);

  const onToggleLike = () => {
    const next = !liked;
    setLiked(next);
    onLikedChange(next);
    void setPolaroidLiked(polaroid.id, next).catch(() => undefined);
  };

  const onConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    const ok = await deletePolaroid(polaroid.id);
    if (ok) {
      onDeleted(polaroid.id);
      onClose();
    } else {
      // Surface failure by leaving the modal open and resetting confirm.
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const summary = session?.summary ?? null;

  return (
    <div
      className="wall-detail-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="wall-detail"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="wall-detail-close"
          onClick={onClose}
          aria-label="Close polaroid"
        >
          ×
        </button>

        <div className="wall-detail-photo-frame">
          {polaroid.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={polaroid.imageUrl} alt="" className="wall-detail-photo" />
          ) : polaroid.status === "pending" ? (
            <div className="wall-detail-developing">
              <div className="wall-detail-developing-haze" />
              <div className="wall-detail-developing-label">developing…</div>
            </div>
          ) : (
            <div className="wall-detail-developing">
              <div className="wall-detail-developing-label">
                this one didn&rsquo;t quite develop.
              </div>
            </div>
          )}
        </div>

        <div className="wall-detail-meta">
          <div className="wall-detail-date">{formatDate(polaroid.sessionDate)}</div>
          <div className="wall-detail-summary">
            {summary || "a quiet talk we had."}
          </div>
        </div>

        <div className="wall-detail-actions">
          <button
            type="button"
            className={`wall-detail-heart ${liked ? "on" : ""}`}
            onClick={onToggleLike}
            aria-pressed={liked}
            aria-label={liked ? "Unlike polaroid" : "Like polaroid"}
          >
            <span className="heart-glyph" aria-hidden="true">{liked ? "♥" : "♡"}</span>
            <span className="heart-label">{liked ? "kept close" : "keep close"}</span>
          </button>

          {polaroid.sessionId ? (
            <button
              type="button"
              className="wall-detail-transcript-toggle"
              onClick={() => setShowTranscript((v) => !v)}
            >
              {showTranscript ? "hide the talk" : "see the talk"}
            </button>
          ) : null}

          <button
            type="button"
            className="wall-detail-delete"
            onClick={() => setConfirmingDelete((v) => !v)}
            aria-label="Remove this polaroid"
            title="remove this polaroid"
          >
            remove
          </button>
        </div>

        {confirmingDelete ? (
          <div className="wall-detail-confirm" role="alertdialog" aria-label="Confirm remove">
            <span>remove this polaroid for good?</span>
            <div className="wall-detail-confirm-actions">
              <button
                type="button"
                className="wall-detail-confirm-yes"
                onClick={onConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "removing…" : "remove"}
              </button>
              <button
                type="button"
                className="wall-detail-confirm-no"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                keep
              </button>
            </div>
          </div>
        ) : null}

        {showTranscript ? (
          <div className="wall-detail-transcript">
            {transcript ? (
              transcript.turns
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
              <div className="mem-detail-empty">opening the talk…</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
