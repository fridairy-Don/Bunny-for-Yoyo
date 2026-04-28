"use client";

import { useEffect, useRef, useState } from "react";

import type { Polaroid } from "../../lib/memory/polaroid-store";
import { playPinSfx } from "./pin-sfx";

type Props = {
  polaroid: Polaroid;
  // Caption text — falls through to the session summary, but the wall
  // owns it so a polaroid can show "developing…" while waiting.
  caption: string;
  // True when this card is the freshest in its stack (visually on top).
  isTop?: boolean;
  // Position within the stack offset (px) — small drift so a stack of 3
  // looks like 3 photos pinned slightly off each other.
  stackIndex?: number;
  // True the first time this polaroid is rendered into the DOM —
  // triggers the pin-drop animation + SFX on mount.
  freshlyAdded?: boolean;
  onClick?: () => void;
};

const PIN_PALETTE: Record<string, string> = {
  rose: "#c96a6a",
  sun: "#e0a85c",
  sky: "#7aa2c3",
  mint: "#7fb89a",
  lilac: "#a78dba",
};

function friendlyDate(sessionDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (sessionDate === today) return "today";
  if (sessionDate === yesterday) return "yesterday";
  const [y, m, d] = sessionDate.split("-");
  return `${y}.${m}.${d}`;
}

export function PolaroidCard({
  polaroid,
  caption,
  isTop = true,
  stackIndex = 0,
  freshlyAdded = false,
  onClick,
}: Props) {
  const [pinned, setPinned] = useState(!freshlyAdded);
  const sfxFired = useRef(false);

  // Pin-drop choreography:
  //   t=0       card mounts in mid-air (translateY -16px, scale 0.9)
  //   t=180ms   card snaps down — pin SFX fires the moment it "lands"
  //   t=360ms   tilt + offset settle in
  // Subsequent renders (e.g. parent re-renders the wall) keep `pinned` true.
  useEffect(() => {
    if (!freshlyAdded) return;
    const t = window.setTimeout(() => {
      setPinned(true);
      if (!sfxFired.current) {
        sfxFired.current = true;
        playPinSfx(0.18);
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [freshlyAdded]);

  // Slight per-stack-index drift so a stack of 3 cards reads as a stack,
  // not one card. We layer this on top of the persisted x/y offset.
  const stackDx = stackIndex * 4;
  const stackDy = stackIndex * 6;

  // Once pinned, apply the persisted tilt + offsets. Before that we hover
  // a bit higher and rotated slightly for the drop animation.
  const transform = pinned
    ? `translate(calc(-50% + ${polaroid.xOffsetPx + stackDx}px), ${polaroid.yOffsetPx + stackDy}px) rotate(${polaroid.tiltDeg}deg)`
    : `translate(calc(-50% + ${polaroid.xOffsetPx + stackDx}px), ${polaroid.yOffsetPx + stackDy - 18}px) rotate(${(polaroid.tiltDeg || 0) - 4}deg) scale(0.92)`;

  const pinColor = PIN_PALETTE[polaroid.pinColor] ?? PIN_PALETTE.rose;
  const developing = polaroid.status === "pending";
  const failed = polaroid.status === "failed";

  return (
    <button
      type="button"
      className={`wall-polaroid ${pinned ? "pinned" : "dropping"} ${isTop ? "top" : "behind"} ${developing ? "developing" : ""} ${failed ? "failed" : ""}`}
      onClick={onClick}
      style={{
        transform,
        opacity: pinned ? 1 : 0,
        zIndex: 10 - stackIndex,
      }}
      aria-label={
        developing
          ? "Polaroid developing"
          : failed
            ? "Polaroid did not develop"
            : `Open polaroid from ${polaroid.sessionDate}`
      }
    >
      <span
        className="wall-polaroid-pin"
        aria-hidden="true"
        style={{ background: pinColor }}
      />
      <span className="wall-polaroid-photo" aria-hidden="true">
        {polaroid.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={polaroid.imageUrl} alt="" className="wall-polaroid-img" />
            <span className="wall-polaroid-shine" />
          </>
        ) : developing ? (
          <span className="wall-polaroid-developing">
            <span className="wall-polaroid-developing-haze" />
            <span className="wall-polaroid-developing-label">developing…</span>
          </span>
        ) : (
          <span className="wall-polaroid-failed">
            <span className="wall-polaroid-failed-mark">·</span>
          </span>
        )}
      </span>
      <span className="wall-polaroid-caption">
        <span className="wall-polaroid-caption-date">{friendlyDate(polaroid.sessionDate)}</span>
        <span className="wall-polaroid-caption-text">
          {caption || (developing ? "a memory taking shape…" : "a quiet talk we had.")}
        </span>
      </span>
    </button>
  );
}
