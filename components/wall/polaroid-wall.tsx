"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  getPolaroids,
  groupPolaroidsByDate,
  type Polaroid,
} from "../../lib/memory/polaroid-store";
import type { SessionCard } from "../../lib/memory/session-store";
import { PolaroidCard } from "./polaroid-card";
import { PolaroidGallery } from "./polaroid-gallery";

type Props = {
  // Bumped whenever a save lands — the wall refetches.
  refreshKey: number;
  // Optimistic placeholder added at save-time. Wall merges this with
  // server-fetched polaroids and reconciles by id when generation lands.
  optimisticPolaroid: Polaroid | null;
  // Lookup of session_id → SessionCard, used to populate captions on the
  // wall (saves a per-polaroid query).
  sessionsById: Map<string, SessionCard>;
  // The most-recently-added polaroid id — drives the drop animation +
  // SFX on the corresponding card. Cleared after first render.
  freshlyAddedId: string | null;
  onClearFreshlyAdded: () => void;
};

// The wall is now a single vertical flex column (see .wall in globals.css).
// CSS handles spacing between stacks; per-card tilt + xOffset/yOffset
// from the persisted layout still drive the casual scattered feel.

export function PolaroidWall({
  refreshKey,
  optimisticPolaroid,
  sessionsById,
  freshlyAddedId,
  onClearFreshlyAdded,
}: Props) {
  const [polaroids, setPolaroids] = useState<Polaroid[]>([]);
  const [loading, setLoading] = useState(true);
  // Unified gallery state. `null` = closed. `items` is the slice we hand to
  // the carousel (a whole date stack, or a single polaroid for the
  // single-card case). `initialIndex` defaults to the freshest card —
  // the user expects "tap top of stack" → that exact card focused.
  const [gallery, setGallery] = useState<{
    items: Polaroid[];
    initialIndex: number;
  } | null>(null);

  // Refetch polaroids whenever the save flow signals a change. We do not
  // poll — the in-flight optimistic placeholder covers the gap until
  // generation finishes and the parent bumps refreshKey again.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPolaroids(60)
      .then((rows) => {
        if (cancelled) return;
        setPolaroids(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Merge fetched + optimistic. Optimistic id takes precedence ONLY if no
  // matching server row is present (so once generation lands and is
  // refetched, the placeholder disappears cleanly).
  const merged = useMemo<Polaroid[]>(() => {
    const byId = new Map<string, Polaroid>();
    for (const p of polaroids) byId.set(p.id, p);
    if (optimisticPolaroid && !byId.has(optimisticPolaroid.id)) {
      byId.set(optimisticPolaroid.id, optimisticPolaroid);
    }
    return Array.from(byId.values()).sort((a, b) => {
      if (a.sessionDate !== b.sessionDate) return b.sessionDate.localeCompare(a.sessionDate);
      return b.createdAt - a.createdAt;
    });
  }, [polaroids, optimisticPolaroid]);

  const stacks = useMemo(() => groupPolaroidsByDate(merged), [merged]);

  // Once the freshly-added card has rendered for the first time, clear
  // the flag so future re-renders (drawer toggles etc.) don't replay
  // the drop animation. We give the animation a generous 1.4s to play
  // out before clearing.
  useEffect(() => {
    if (!freshlyAddedId) return;
    const t = window.setTimeout(() => onClearFreshlyAdded(), 1400);
    return () => window.clearTimeout(t);
  }, [freshlyAddedId, onClearFreshlyAdded]);

  const wallRef = useRef<HTMLDivElement | null>(null);

  // Keep the gallery's items in sync if the underlying polaroids change
  // (e.g. a delete inside the gallery, or a new polaroid generation
  // landing while the gallery is open). We re-derive from `merged` using
  // each item's id so the gallery's swipe position stays valid.
  useEffect(() => {
    if (!gallery) return;
    const ids = new Set(gallery.items.map((p) => p.id));
    const refreshed = merged.filter((p) => ids.has(p.id));
    // Bail if nothing changed by reference — avoids a render loop.
    const sameLength = refreshed.length === gallery.items.length;
    const sameRefs =
      sameLength && refreshed.every((p, i) => p === gallery.items[i]);
    if (sameRefs) return;
    if (refreshed.length === 0) {
      setGallery(null);
      return;
    }
    setGallery((prev) =>
      prev ? { items: refreshed, initialIndex: Math.min(prev.initialIndex, refreshed.length - 1) } : prev,
    );
  }, [merged, gallery]);

  function captionFor(polaroid: Polaroid): string {
    if (polaroid.status === "pending") return "developing…";
    if (polaroid.status === "failed") return "this one didn't quite develop.";
    if (polaroid.sessionId) {
      const s = sessionsById.get(polaroid.sessionId);
      if (s?.summary) return s.summary;
    }
    return "a quiet talk we had.";
  }

  return (
    <>
      <div className="wall" ref={wallRef} aria-label="Bunny's polaroid wall">
        {loading && stacks.length === 0 ? (
          <div className="wall-empty">looking through old talks…</div>
        ) : null}

        {!loading && stacks.length === 0 && !optimisticPolaroid ? (
          <div className="wall-empty">
            <span>no photos yet.</span>
            <span className="wall-empty-sub">save a talk and one will pin here.</span>
          </div>
        ) : null}

        {stacks.map((stack) => {
          const topItem = stack.items[0];
          const visibleStack = stack.items.slice(0, 3); // peek depth

          return (
            <div key={stack.date} className="wall-stack">
              {visibleStack
                .slice()
                .reverse()
                .map((p, idxFromBottom) => {
                  const stackIndex = visibleStack.length - 1 - idxFromBottom;
                  const isTop = p.id === topItem.id;
                  return (
                    <PolaroidCard
                      key={p.id}
                      polaroid={p}
                      caption={captionFor(p)}
                      isTop={isTop}
                      stackIndex={stackIndex}
                      freshlyAdded={isTop && p.id === freshlyAddedId}
                      onClick={() => {
                        // Open the gallery with the entire date stack —
                        // 1-card stacks open straight in enlarged mode.
                        // initialIndex 0 == the top (freshest) card,
                        // matching the user's tap target.
                        setGallery({ items: stack.items, initialIndex: 0 });
                      }}
                    />
                  );
                })}
              {stack.items.length > 1 ? (
                <div className="wall-stack-badge" aria-hidden="true">
                  +{stack.items.length - 1}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Unified gallery: carousel → enlarged → flipped (transcript on
          back). Portaled to <body> to escape `.wall`'s stacking context
          so the backdrop's blur filter doesn't bleed onto the cards. */}
      {gallery && typeof document !== "undefined"
        ? createPortal(
            <PolaroidGallery
              items={gallery.items}
              sessions={sessionsById}
              initialIndex={gallery.initialIndex}
              onClose={() => setGallery(null)}
              onLikedChange={(id, liked) => {
                setPolaroids((current) =>
                  current.map((p) => (p.id === id ? { ...p, liked } : p)),
                );
              }}
              onDeleted={(deletedId) => {
                setPolaroids((current) =>
                  current.filter((p) => p.id !== deletedId),
                );
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
