"use client";

// Visual diff preview for the bunny rig.
// Verifies the new "idle.png base + local overlays" approach achieves 1:1
// reproduction of the original idle image, then shows each expression so we
// can eyeball the overlays alignment.

import { BunnyRig } from "../../../components/stage/bunny-rig";
import type { ExpressionId } from "../../../lib/config/bunny-expressions";

const EXPRESSION_LIST: ExpressionId[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "excited",
  "curious",
  "confused",
  "shy",
  "sleepy",
  "tickled",
  "petted",
];

export default function RigPreviewPage() {
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
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Pixel parity check</h2>
      <p style={{ marginBottom: 16, fontSize: 13 }}>
        Left: idle reference image. Center: rig in <code>idle</code> state (must
        be pixel-identical to left). Right: rig overlaid at 50% on reference —
        no ghost outlines = perfect alignment.
      </p>
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
          marginBottom: 32,
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

        <Panel label="rig — idle">
          <BunnyRig expression="idle" staticPose />
        </Panel>

        <Panel label="rig overlay on reference (50%)">
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
              opacity: 0.5,
            }}
          />
          <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
            <BunnyRig expression="idle" staticPose />
          </div>
        </Panel>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Expressions catalog</h2>
      <p style={{ marginBottom: 16, fontSize: 13 }}>
        Each tile shows the rig in a different expression. Mouth and blink
        overlays should sit cleanly on the idle base — no visible seams or
        misalignment.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {EXPRESSION_LIST.map((id) => (
          <SmallPanel key={id} label={id}>
            <BunnyRig expression={id} staticPose />
          </SmallPanel>
        ))}
      </div>
    </main>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          position: "relative",
          width: 467,
          aspectRatio: "934 / 1040",
          background: "#fff",
          border: "1px solid #ddd",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SmallPanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "934 / 1040",
          background: "#fff",
          border: "1px solid #ddd",
        }}
      >
        {children}
      </div>
    </div>
  );
}
