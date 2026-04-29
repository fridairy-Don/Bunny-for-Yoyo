"use client";

// Mesh-deformation preview.
//
// Loads bunny_idle.png as a deformable mesh (PixiJS) and exposes sliders
// for mouth-close, eye-blink, head-lean. The point of this page is to
// answer one question: can we drive emotion changes by warping the
// original image's mesh, with no second image, no overlay, no fluff
// seam? If yes — the part-overlay approach is dead and this is the new
// baseline.

import { useState } from "react";
import { BunnyMesh } from "../../../components/stage/bunny-mesh";

export default function RigMeshPage() {
  const [mouthClose, setMouthClose] = useState(0);
  const [eyeBlink, setEyeBlink] = useState(0);
  const [headLean, setHeadLean] = useState(0);

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
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Mesh deformation prototype</h2>
      <p style={{ marginBottom: 16, fontSize: 13, maxWidth: 700 }}>
        Left: idle reference. Center: idle.png rendered as a deformable
        PlaneGeometry. Right: rig overlaid at 50% on reference (idle pose
        only — non-zero sliders break parity intentionally to show
        deformation working).
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

        <Panel label="mesh (live)">
          <BunnyMesh
            params={{ mouthClose, eyeBlink, headLean }}
            paused={false}
          />
        </Panel>

        <Panel label="overlay on reference (50%)">
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
            <BunnyMesh
              params={{ mouthClose: 0, eyeBlink: 0, headLean: 0 }}
              paused={false}
            />
          </div>
        </Panel>
      </div>

      <div
        style={{
          maxWidth: 600,
          padding: 16,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <Slider label="mouthClose" value={mouthClose} onChange={setMouthClose} />
        <Slider label="eyeBlink" value={eyeBlink} onChange={setEyeBlink} />
        <Slider label="headLean" value={headLean} onChange={setHeadLean} />
        <button
          onClick={() => {
            setMouthClose(0);
            setEyeBlink(0);
            setHeadLean(0);
          }}
          style={{
            marginTop: 8,
            padding: "8px 16px",
            background: "#eee",
            border: "1px solid #ccc",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          reset to idle
        </button>
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
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "#888" }}>
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
