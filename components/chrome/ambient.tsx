"use client";

import type { Mote } from "../../lib/ambient/use-ambient";

type Props = {
  motes: Mote[];
};

// Background atmosphere: the "world" backplate, drifting mote particles, a
// soft vignette, and a film grain overlay. All render as plain divs; animated
// via globals.css keyframes (see .mote / .grain / .vignette rules).
export function Ambient({ motes }: Props) {
  return (
    <>
      <div className="world" />
      <div className="motes">
        {motes.map((m, i) => (
          <div
            key={i}
            className="mote"
            style={{
              left: m.left,
              width: `${m.size}px`,
              height: `${m.size}px`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              opacity: m.opacity,
            }}
          />
        ))}
      </div>
      <div className="vignette" />
      <div className="grain" />
    </>
  );
}
