"use client";

import type { SessionCard } from "../../lib/memory/session-store";

type Props = {
  session: SessionCard;
  onClick: () => void;
};

// Deterministic pseudo-random rotation in degrees based on the session id.
// Keeps the tilt stable across re-renders (animating rotation each render
// would make the whole wall shimmer).
function tiltFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  // Range: -3deg .. +3deg. 0.8% bias left/right for visual rhythm.
  return ((h & 0xffff) / 0xffff) * 6 - 3;
}

// Deterministic top-offset 0–6px so polaroids don't sit in rigid rows.
function offsetFromId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 7;
}

export function Polaroid({ session, onClick }: Props) {
  const tilt = tiltFromId(session.id);
  const offset = offsetFromId(session.id);
  const caption = session.summary ?? "a quiet talk we had.";
  const date = friendlyDate(session.sessionDate);
  return (
    <button
      type="button"
      className="polaroid"
      style={{ transform: `rotate(${tilt}deg)`, marginTop: `${offset}px` }}
      onClick={onClick}
      aria-label={`Open talk from ${session.sessionDate}`}
    >
      <span className="polaroid-pin" aria-hidden="true" />
      <span className="polaroid-photo" aria-hidden="true">
        <span className="polaroid-photo-bg" />
        <span className="polaroid-photo-emoji">{photoIconFor(session)}</span>
      </span>
      <span className="polaroid-caption">
        <span className="polaroid-caption-date">{date}</span>
        <span className="polaroid-caption-text">{caption}</span>
      </span>
    </button>
  );
}

function friendlyDate(sessionDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (sessionDate === today) return "today";
  if (sessionDate === yesterday) return "yesterday";
  const [y, m, d] = sessionDate.split("-");
  return `${y}.${m}.${d}`;
}

// Rough topical hint for the photo area based on turn count. Keeps the wall
// visually varied without an image per session.
function photoIconFor(session: SessionCard): string {
  if (session.turnCount >= 18) return "✦";
  if (session.turnCount >= 10) return "❀";
  if (session.turnCount >= 6) return "✿";
  return "♡";
}
