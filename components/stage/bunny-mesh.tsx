"use client";

import { useEffect, useMemo, useRef } from "react";
import { Application, Assets, MeshPlane } from "pixi.js";

// Bunny mesh-based renderer.
//
// Loads bunny_idle.png as a texture and binds it onto a regular grid of
// vertices (PlaneGeometry). Emotions are produced by *deforming this grid* —
// no second image, no overlay, no fluff seam. Every pixel on screen comes
// from the original idle.png, so 1:1 fidelity is structural, not earned.
//
// Region weight maps (mouth, eyes, head, ears) are computed once in UV
// space and reapplied each frame; deformation parameters are smoothly
// blended via simple lerp so motion is continuous, not stepped.

const CANVAS_W = 934;
const CANVAS_H = 1040;
const VERTS_X = 41; // grid resolution. odd number = vertex sits on center.
const VERTS_Y = 51;

// Region centers / radii in UV (0..1). These are derived by overlaying the
// rig on bunny_idle.png and reading off the feature locations.
const MOUTH = { cu: 0.502, cv: 0.394, ru: 0.13, rv: 0.075 };
const EYE_L = { cu: 0.42, cv: 0.305, ru: 0.06, rv: 0.05 };
const EYE_R = { cu: 0.58, cv: 0.305, ru: 0.06, rv: 0.05 };

export type BunnyMeshParams = {
  /** 0 = mouth open as in idle, 1 = mouth fully squashed shut. */
  mouthClose?: number;
  /** 0 = eyes open as in idle, 1 = eyes squashed to a slit (blink). */
  eyeBlink?: number;
  /** 0 = head still, 1 = head bobs down by ~12px (listening lean). */
  headLean?: number;
};

export function BunnyMesh({
  params,
  paused = false,
}: {
  params: BunnyMeshParams;
  paused?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<MeshPlane | null>(null);
  const basePositionsRef = useRef<Float32Array | null>(null);
  const baseUvsRef = useRef<Float32Array | null>(null);
  const paramsRef = useRef<BunnyMeshParams>(params);
  paramsRef.current = params;

  // Per-vertex region weights — computed once, reused every frame.
  const weights = useMemo(() => {
    const total = VERTS_X * VERTS_Y;
    const mouth = new Float32Array(total);
    const eyeL = new Float32Array(total);
    const eyeR = new Float32Array(total);
    for (let row = 0; row < VERTS_Y; row++) {
      for (let col = 0; col < VERTS_X; col++) {
        const i = row * VERTS_X + col;
        const u = col / (VERTS_X - 1);
        const v = row / (VERTS_Y - 1);
        mouth[i] = falloff(u, v, MOUTH);
        eyeL[i] = falloff(u, v, EYE_L);
        eyeR[i] = falloff(u, v, EYE_R);
      }
    }
    return { mouth, eyeL, eyeR };
  }, []);

  useEffect(() => {
    let app: Application | null = null;
    let cancelled = false;
    let rafId: number | null = null;

    (async () => {
      app = new Application();
      await app.init({
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundAlpha: 0,
        antialias: true,
        resolution: typeof window !== "undefined" ? window.devicePixelRatio : 1,
        autoDensity: true,
      });
      if (cancelled || !app) return;

      const texture = await Assets.load("/assets/bunny/bunny_idle.png");
      if (cancelled || !app) return;

      const mesh = new MeshPlane({
        texture,
        verticesX: VERTS_X,
        verticesY: VERTS_Y,
      });
      // PlaneGeometry creates positions in UV-aligned 0..1 space then scales
      // by width/height. We want the mesh to fill the full canvas.
      mesh.width = CANVAS_W;
      mesh.height = CANVAS_H;
      app.stage.addChild(mesh);
      meshRef.current = mesh;

      // Snapshot the base (undeformed) positions so deformations can always
      // be re-applied from the rest pose, never compounded.
      basePositionsRef.current = new Float32Array(mesh.geometry.positions);
      baseUvsRef.current = new Float32Array(mesh.geometry.uvs);

      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas);
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";
        app.canvas.style.display = "block";
      }

      const tick = () => {
        if (cancelled) return;
        applyDeform(meshRef.current, basePositionsRef.current, weights, paramsRef.current);
        rafId = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (app) app.destroy(true, { children: true, texture: false });
      meshRef.current = null;
      basePositionsRef.current = null;
    };
    // weights is stable (memoized with []), no need to depend on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // For the static-pose case (preview / non-animated screenshots), do an
  // immediate apply when params change so the screenshot reflects them
  // without waiting for the next RAF.
  useEffect(() => {
    if (!paused) return;
    applyDeform(meshRef.current, basePositionsRef.current, weights, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, params]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    />
  );
}

// Smooth radial falloff in UV space. Returns 1 at center, 0 at the edge of
// (ru, rv), with cosine smoothing in between.
function falloff(
  u: number,
  v: number,
  region: { cu: number; cv: number; ru: number; rv: number },
): number {
  const du = (u - region.cu) / region.ru;
  const dv = (v - region.cv) / region.rv;
  const d = Math.sqrt(du * du + dv * dv);
  if (d >= 1) return 0;
  // Smoothstep-like falloff (cosine half-window).
  return 0.5 + 0.5 * Math.cos(d * Math.PI);
}

function applyDeform(
  mesh: MeshPlane | null,
  base: Float32Array | null,
  weights: { mouth: Float32Array; eyeL: Float32Array; eyeR: Float32Array },
  params: BunnyMeshParams,
) {
  if (!mesh || !base) return;
  const positions = mesh.geometry.positions;
  const mouthClose = clamp01(params.mouthClose ?? 0);
  const eyeBlink = clamp01(params.eyeBlink ?? 0);
  const headLean = clamp01(params.headLean ?? 0);

  const mouthCenterY = MOUTH.cv * CANVAS_H;
  const eyeLCenterY = EYE_L.cv * CANVAS_H;
  const eyeRCenterY = EYE_R.cv * CANVAS_H;

  for (let row = 0; row < VERTS_Y; row++) {
    for (let col = 0; col < VERTS_X; col++) {
      const i = row * VERTS_X + col;
      const px = i * 2;
      const py = i * 2 + 1;
      let x = base[px];
      let y = base[py];

      // Mouth squash: pull mouth-region vertices toward the mouth's
      // vertical centerline. Strength = mouthClose, weighted by region.
      if (mouthClose > 0) {
        const w = weights.mouth[i] * mouthClose;
        if (w > 0) {
          y = lerp(y, mouthCenterY, w * 0.55);
        }
      }

      // Eye blink: same idea on each eye region.
      if (eyeBlink > 0) {
        const wl = weights.eyeL[i] * eyeBlink;
        if (wl > 0) y = lerp(y, eyeLCenterY, wl * 0.7);
        const wr = weights.eyeR[i] * eyeBlink;
        if (wr > 0) y = lerp(y, eyeRCenterY, wr * 0.7);
      }

      // Head lean: shift the entire upper half (v < 0.55) down a touch.
      if (headLean > 0) {
        const v = row / (VERTS_Y - 1);
        if (v < 0.55) {
          const t = (0.55 - v) / 0.55; // 1 at top, 0 at v=0.55
          y += t * 14 * headLean;
        }
      }

      positions[px] = x;
      positions[py] = y;
    }
  }

  // Tell PixiJS the buffer changed so it re-uploads to the GPU.
  // In v8, Buffer exposes update() which schedules the upload.
  const buf = mesh.geometry.attributes.aPosition.buffer;
  buf.update();
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
