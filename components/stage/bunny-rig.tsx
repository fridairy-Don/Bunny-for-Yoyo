"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PARTS,
  RIG_CANVAS,
  partLayoutPercent,
  type PartId,
} from "../../lib/config/bunny-rig";
import {
  EXPRESSIONS,
  type ExpressionId,
  type PartTransform,
} from "../../lib/config/bunny-expressions";

type BunnyRigProps = {
  /**
   * Which expression Bunny is wearing right now. Defaults to idle.
   * Switching this prop morphs the bunny via overlay swaps + a single
   * CSS transition on the whole-image transform — never popping.
   */
  expression?: ExpressionId;
  /**
   * If set, replaces whichever mouth part the expression chose with this
   * specific mouth. Used by the viseme system to drive the mouth from
   * audio amplitude during `speaking`.
   */
  mouthVisemeOverride?: PartId | null;
  /**
   * Disable idle micro-motion (breathing, blink, bounce). Useful for
   * the preview page so the rig matches the static idle reference exactly.
   */
  staticPose?: boolean;
};

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------
// We render `bunny_idle.png` as the BASE layer at the full canvas. This
// guarantees 1:1 pixel parity with the original AI-generated idle image —
// the part assembly approach can never match because the source PNG has
// fluff, shading, and tiny anti-aliased details we can't reproduce from
// vector parts.
//
// On top of the base we OVERLAY only the parts that need to change for the
// current expression: mouth (visemes, smile/closed/open variants) and
// blink eyes. Mouth parts are self-masking (they include the surrounding
// fluffy bunny texture so they cover the underlying mouth cleanly).
//
// Whole-image transforms (head bob, gentle bounce, head tilt within reason)
// are applied to the base + overlays as a group, so they move together.
//
// Ear-pose and arm-pose changes are deferred to M3 — they need either a
// derived `idle_no_ears.png` mask or a head-isolating composite to avoid
// the original idle ears showing through. Until then, expressions that
// would change ears still apply their whole-image transform + mouth/eye
// overlays, which is enough to read the emotion clearly.

// Idle mouth — anything else means we need to overlay.
const IDLE_MOUTH: PartId = "mouth_smile_tongue";

const MOUTH_PARTS: ReadonlySet<PartId> = new Set([
  "mouth_closed",
  "mouth_small_open",
  "mouth_smile_tongue",
  "mouth_big_open",
]);

const BLINK_LEFT_PARTS: ReadonlySet<PartId> = new Set(["blink_left"]);
const BLINK_RIGHT_PARTS: ReadonlySet<PartId> = new Set(["blink_right"]);

const IDLE_BASE_SRC = "/assets/bunny/bunny_idle.png";

export function BunnyRig({
  expression = "idle",
  mouthVisemeOverride = null,
  staticPose = false,
}: BunnyRigProps) {
  const expr = EXPRESSIONS[expression];

  // ---- Auto-blink ----------------------------------------------------------
  // Random blinks every 3–6s while eyes are open. If the expression already
  // shows blink_left/blink_right (e.g. shy / sleepy / petted), we don't
  // override — the expression's "eyes closed" intent wins and the blink
  // stays steady.
  const expressionShowsBlinkAlready = expr.parts.some(
    (id) => BLINK_LEFT_PARTS.has(id) || BLINK_RIGHT_PARTS.has(id),
  );
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (staticPose || expressionShowsBlinkAlready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (cancelled) return;
      setBlinking(true);
      timer = setTimeout(() => {
        if (cancelled) return;
        setBlinking(false);
        const next = 3000 + Math.random() * 3000;
        timer = setTimeout(tick, next);
      }, 140);
    };
    timer = setTimeout(tick, 1500 + Math.random() * 2500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [staticPose, expressionShowsBlinkAlready, expression]);

  // ---- Decide which overlays to render ------------------------------------
  // Mouth overlay: viseme override > expression mouth > none (use base idle).
  const mouthOverlay: PartId | null = useMemo(() => {
    if (mouthVisemeOverride && MOUTH_PARTS.has(mouthVisemeOverride)) {
      return mouthVisemeOverride === IDLE_MOUTH ? null : mouthVisemeOverride;
    }
    const exprMouth = expr.parts.find((id) => MOUTH_PARTS.has(id));
    if (!exprMouth || exprMouth === IDLE_MOUTH) return null;
    return exprMouth;
  }, [expr.parts, mouthVisemeOverride]);

  // Eye overlay: if expression carries blink eyes, show them. Otherwise
  // if auto-blink is firing, show them transiently.
  const showBlinkEyes =
    expressionShowsBlinkAlready || (!staticPose && blinking);

  const transforms = expr.transforms ?? {};
  const morphMs = expr.morphMs ?? 320;

  // ---- Whole-image transform ----------------------------------------------
  // For non-idle expressions, the `head` transform in expression catalog is
  // a reasonable approximation of how the whole bunny should move (down for
  // listening, up for excited, etc). We sample it to drive the base image.
  const wholeTransform = transforms.head ?? {};
  const wholeTransformString = buildWholeTransform(wholeTransform);

  const className = `bunny-rig bunny-rig--${expression}${
    staticPose ? " bunny-rig--static" : ""
  }`;

  // Build the per-overlay layer specs.
  const overlays: Array<{
    id: PartId;
    src: string;
    style: React.CSSProperties;
  }> = [];

  // Mouth overlay
  if (mouthOverlay) {
    const part = PARTS[mouthOverlay];
    if (part) {
      const layout = partLayoutPercent(part);
      const partTransform = transforms[part.id] ?? {};
      overlays.push({
        id: part.id,
        src: part.src,
        style: {
          position: "absolute",
          left: `${layout.left}%`,
          top: `${layout.top}%`,
          width: `${layout.width}%`,
          height: `${layout.height}%`,
          zIndex: part.z,
          transformOrigin: part.origin ?? "50% 50%",
          transform: buildTransform(partTransform, part.width, part.height),
          transition: `transform ${morphMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          willChange: "transform",
          pointerEvents: "none",
        },
      });
    }
  }

  // Eye overlays — render both blink halves together when active.
  // The blink_*.png files are just thin lash strokes on transparent bg, so
  // they don't mask the open eyes already painted into bunny_idle.png. We
  // first stamp a small fluffy-white patch over each eye (matching the face
  // fur color around the eyes), then draw the lash on top.
  const eyePatches: Array<{
    key: string;
    style: React.CSSProperties;
  }> = [];
  if (showBlinkEyes) {
    // Use the OPEN eye part dimensions/position to size the cover patch.
    const eyeParts = [PARTS["eye_left"], PARTS["eye_right"]];
    for (const eye of eyeParts) {
      if (!eye) continue;
      // Make the patch slightly larger than the eye to fully erase it,
      // and use a soft radial gradient so its edge blends into the fur.
      const patchPad = 6; // canvas px on each side
      const patchW = eye.width + patchPad * 2;
      const patchH = eye.height + patchPad * 2;
      const left = ((eye.cx - patchW / 2) / RIG_CANVAS.width) * 100;
      const top = ((eye.cy - patchH / 2) / RIG_CANVAS.height) * 100;
      const widthPct = (patchW / RIG_CANVAS.width) * 100;
      const heightPct = (patchH / RIG_CANVAS.height) * 100;
      eyePatches.push({
        key: `${eye.id}-patch`,
        style: {
          position: "absolute",
          left: `${left}%`,
          top: `${top}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          zIndex: eye.z - 1,
          // Soft fluffy-white blob — mid is opaque, edge fades so it blends
          // with the surrounding fur on bunny_idle.png.
          background:
            "radial-gradient(ellipse at 50% 50%, #fbf6ef 55%, rgba(251,246,239,0.6) 75%, rgba(251,246,239,0) 100%)",
          borderRadius: "50%",
          pointerEvents: "none",
          transition: `opacity ${morphMs}ms ease`,
        },
      });
    }

    const blinkLeft = PARTS["blink_left"];
    const blinkRight = PARTS["blink_right"];
    for (const part of [blinkLeft, blinkRight]) {
      if (!part) continue;
      const layout = partLayoutPercent(part);
      const partTransform = transforms[part.id] ?? {};
      overlays.push({
        id: part.id,
        src: part.src,
        style: {
          position: "absolute",
          left: `${layout.left}%`,
          top: `${layout.top}%`,
          width: `${layout.width}%`,
          height: `${layout.height}%`,
          zIndex: part.z,
          transformOrigin: part.origin ?? "50% 50%",
          transform: buildTransform(partTransform, part.width, part.height),
          transition: `transform ${morphMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          willChange: "transform",
          pointerEvents: "none",
        },
      });
    }
  }

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        aspectRatio: `${RIG_CANVAS.width} / ${RIG_CANVAS.height}`,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Base layer — bunny_idle.png at full canvas. Guarantees pixel-perfect
          idle reproduction. Whole-image expression transform is applied here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={IDLE_BASE_SRC}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: wholeTransformString,
          transition: `transform ${morphMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          willChange: "transform",
          pointerEvents: "none",
        }}
      />

      {/* Overlays move with the same whole-image transform so they stay
          locked to the bunny's face. We wrap them in a group div. */}
      <div
        className="bunny-rig__overlays"
        style={{
          position: "absolute",
          inset: 0,
          transform: wholeTransformString,
          transition: `transform ${morphMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
          willChange: "transform",
          pointerEvents: "none",
        }}
      >
        {/* Eye patches sit BELOW lash overlays so the lash draws on top. */}
        {eyePatches.map((p) => (
          <div key={p.key} data-part={p.key} style={p.style} />
        ))}
        {overlays.map((o) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={o.id}
            data-part={o.id}
            src={o.src}
            alt=""
            draggable={false}
            style={o.style}
          />
        ))}
      </div>
    </div>
  );
}

function buildTransform(
  t: PartTransform,
  partW: number,
  partH: number,
): string {
  const tx = t.tx ?? 0;
  const ty = t.ty ?? 0;
  const rotate = t.rotate ?? 0;
  const scale = t.scale ?? 1;
  const txPct = (tx / partW) * 100;
  const tyPct = (ty / partH) * 100;
  return `translate(${txPct}%, ${tyPct}%) rotate(${rotate}deg) scale(${scale})`;
}

// Whole-image transform: tx/ty are in canvas pixels — convert to % of the
// canvas (not the part's own size) so the value scales naturally with the
// container width.
function buildWholeTransform(t: PartTransform): string {
  const tx = t.tx ?? 0;
  const ty = t.ty ?? 0;
  const rotate = t.rotate ?? 0;
  const scale = t.scale ?? 1;
  const txPct = (tx / RIG_CANVAS.width) * 100;
  const tyPct = (ty / RIG_CANVAS.height) * 100;
  return `translate(${txPct}%, ${tyPct}%) rotate(${rotate}deg) scale(${scale})`;
}

export type { ExpressionId };
