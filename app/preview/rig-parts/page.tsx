"use client";

// Pure-parts assembly preview WITH click interactions.
//
// Three click zones overlay the bunny:
//   1. Ears zone (top of canvas)        → cycle ears: idle → top → middle → bottom
//   2. Eyes zone (around the eye row)   → trigger a blink
//   3. Mouth zone (around the mouth)    → cycle mouth: smile_tongue → closed → small → big
//   4. Anywhere else                    → combo (blink + cycle mouth + perk ears briefly)
//
// Auto-blink every 3.5–6s gives the bunny passive life.

import { useEffect, useRef, useState } from "react";
import {
  PARTS,
  RIG_CANVAS,
  partLayoutPercent,
  type PartId,
  type PartSpec,
} from "../../../lib/config/bunny-rig";

type EarsPose = "idle" | "top" | "middle" | "bottom";
type MouthId =
  | "mouth_smile_tongue"
  | "mouth_closed"
  | "mouth_small_open"
  | "mouth_big_open";

const MOUTH_CYCLE: MouthId[] = [
  "mouth_smile_tongue",
  "mouth_closed",
  "mouth_small_open",
  "mouth_big_open",
];
const EAR_CYCLE: EarsPose[] = ["idle", "top", "middle", "bottom"];

export default function RigPartsPage() {
  const [earsPose, setEarsPose] = useState<EarsPose>("idle");
  const [eyesBlink, setEyesBlink] = useState(false);
  const [mouthIdx, setMouthIdx] = useState(0);
  const [bobble, setBobble] = useState(false); // tiny head/body bob on combo click

  const blinkTimeoutRef = useRef<number | null>(null);

  // ---- actions --------------------------------------------------------
  const triggerBlink = (durationMs = 180) => {
    if (blinkTimeoutRef.current) window.clearTimeout(blinkTimeoutRef.current);
    setEyesBlink(true);
    blinkTimeoutRef.current = window.setTimeout(() => {
      setEyesBlink(false);
      blinkTimeoutRef.current = null;
    }, durationMs);
  };

  const cycleMouth = () => setMouthIdx((i) => (i + 1) % MOUTH_CYCLE.length);

  const cycleEars = () =>
    setEarsPose((p) => EAR_CYCLE[(EAR_CYCLE.indexOf(p) + 1) % EAR_CYCLE.length]);

  const triggerCombo = () => {
    triggerBlink(220);
    cycleMouth();
    // Briefly perk ears upward then return to idle.
    const nextEar = earsPose === "top" ? "middle" : "top";
    setEarsPose(nextEar);
    window.setTimeout(() => setEarsPose("idle"), 700);
    setBobble(true);
    window.setTimeout(() => setBobble(false), 280);
  };

  // ---- auto-blink loop -----------------------------------------------
  useEffect(() => {
    let active = true;
    let t: number | null = null;
    const schedule = () => {
      if (!active) return;
      const delay = 3500 + Math.random() * 2500;
      t = window.setTimeout(() => {
        if (!active) return;
        triggerBlink(160);
        // Schedule the next blink AFTER this one finishes.
        window.setTimeout(schedule, 200);
      }, delay);
    };
    schedule();
    return () => {
      active = false;
      if (t) window.clearTimeout(t);
      if (blinkTimeoutRef.current) window.clearTimeout(blinkTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        margin: 0,
        padding: 24,
        background: "#f7f1e8",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#444",
      }}
    >
      <style>{`
        @keyframes partFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>
        Parts assembly — click to interact
      </h2>
      <p style={{ marginBottom: 16, fontSize: 13, maxWidth: 700 }}>
        Click the <b>ears</b> (top zone) to cycle ear poses. Click the{" "}
        <b>eyes</b> to make her blink. Click the <b>mouth</b> to cycle mouth
        shapes. Click anywhere else for a combo reaction. She also blinks on
        her own every few seconds.
      </p>

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <Panel label="idle reference (bunny_idle.png)">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/bunny/bunny_idle.png"
            alt="idle reference"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </Panel>

        <Panel label="parts only — click me">
          <PartsAssembly
            earsPose={earsPose}
            eyesBlink={eyesBlink}
            mouthId={MOUTH_CYCLE[mouthIdx]}
            bobble={bobble}
          />
          <ClickZones
            onEars={cycleEars}
            onEyes={() => triggerBlink(280)}
            onMouth={cycleMouth}
            onElsewhere={triggerCombo}
          />
        </Panel>
      </div>

      {/* Manual controls — handy for verification without aiming clicks. */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          padding: 16,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          maxWidth: 700,
          fontSize: 13,
        }}
      >
        <ControlGroup label={`ears: ${earsPose}`}>
          <button onClick={cycleEars}>cycle ears</button>
        </ControlGroup>
        <ControlGroup label={`eyes: ${eyesBlink ? "blink" : "open"}`}>
          <button onClick={() => triggerBlink(280)}>blink</button>
        </ControlGroup>
        <ControlGroup label={`mouth: ${MOUTH_CYCLE[mouthIdx].replace("mouth_", "")}`}>
          <button onClick={cycleMouth}>cycle mouth</button>
        </ControlGroup>
        <ControlGroup label="combo">
          <button onClick={triggerCombo}>blink + ears + mouth</button>
        </ControlGroup>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Parts assembly — chooses which ear/eye/mouth variant to render based on state.
// ---------------------------------------------------------------------------

function PartsAssembly({
  earsPose,
  eyesBlink,
  mouthId,
  bobble,
}: {
  earsPose: EarsPose;
  eyesBlink: boolean;
  mouthId: MouthId;
  bobble: boolean;
}) {
  // Resolve dynamic part choices.
  const earL: PartId =
    earsPose === "idle"
      ? "ear_left_idle"
      : earsPose === "top"
        ? "ear_pose_top_left"
        : earsPose === "middle"
          ? "ear_pose_middle_left"
          : "ear_pose_bottom_left";
  const earR: PartId =
    earsPose === "idle"
      ? "ear_right_idle"
      : earsPose === "top"
        ? "ear_pose_top_right"
        : earsPose === "middle"
          ? "ear_pose_middle_right"
          : "ear_pose_bottom_right";
  const eyeL: PartId = eyesBlink ? "blink_left" : "eye_left";
  const eyeR: PartId = eyesBlink ? "blink_right" : "eye_right";

  const partIds: PartId[] = [
    earL,
    earR,
    "body_legs",
    "head",
    "arm_left",
    "arm_right",
    "cheek_swirl_left",
    "cheek_swirl_right",
    eyeL,
    eyeR,
    mouthId,
    "flower",
  ];

  const sorted = partIds.map((id) => PARTS[id]).sort((a, b) => a.z - b.z);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: bobble ? "translateY(-6px) scale(1.01)" : "translateY(0)",
        transition: "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {sorted.map((spec) => (
        <PartImg key={spec.id} spec={spec} />
      ))}
    </div>
  );
}

function PartImg({ spec }: { spec: PartSpec }) {
  const { left, top, width, height } = partLayoutPercent(spec);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spec.src}
      alt={spec.id}
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
        objectFit: "contain",
        pointerEvents: "none",
        // Subtle pop-in when a part swaps (mouth/eye/ear variants share the
        // same React key per slot would prevent this; using the spec.id as key
        // lets each variant fade in fresh).
        animation: "partFadeIn 140ms ease-out",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Click zones — invisible overlays that route clicks to the right action.
// ---------------------------------------------------------------------------

function ClickZones({
  onEars,
  onEyes,
  onMouth,
  onElsewhere,
}: {
  onEars: () => void;
  onEyes: () => void;
  onMouth: () => void;
  onElsewhere: () => void;
}) {
  const stop = (handler: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    handler();
  };
  return (
    <div
      onClick={onElsewhere}
      style={{
        position: "absolute",
        inset: 0,
        cursor: "pointer",
      }}
      title="click for a combo reaction"
    >
      {/* Ears zone — top strip covering both ears */}
      <div
        onClick={stop(onEars)}
        title="click ears"
        style={{
          position: "absolute",
          left: "0%",
          top: "0%",
          width: "100%",
          height: "30%",
          cursor: "pointer",
        }}
      />
      {/* Eyes zone — narrow band across the eye row */}
      <div
        onClick={stop(onEyes)}
        title="click eyes"
        style={{
          position: "absolute",
          left: "32%",
          top: "26%",
          width: "36%",
          height: "10%",
          cursor: "pointer",
        }}
      />
      {/* Mouth zone — small box around the mouth */}
      <div
        onClick={stop(onMouth)}
        title="click mouth"
        style={{
          position: "absolute",
          left: "40%",
          top: "36%",
          width: "20%",
          height: "10%",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{label}</div>
      <div
        style={{
          position: "relative",
          width: 467,
          aspectRatio: `${RIG_CANVAS.width} / ${RIG_CANVAS.height}`,
          background: "#fff",
          border: "1px solid #ddd",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
