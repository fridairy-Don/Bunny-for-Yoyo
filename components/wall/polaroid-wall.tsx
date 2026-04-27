"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getPolaroids,
  groupPolaroidsByDate,
  type Polaroid,
} from "../../lib/memory/polaroid-store";
import type { SessionCard } from "../../lib/memory/session-store";
import { PolaroidCard } from "./polaroid-card";
import { PolaroidDetail } from "./polaroid-detail";

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
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [detailPolaroid, setDetailPolaroid] = useState<Polaroid | null>(null);

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

  const fanOutItems = useMemo(() => {
    if (!openDate) return [];
    return stacks.find((s) => s.date === openDate)?.items ?? [];
  }, [stacks, openDate]);

  // Listen for outside clicks while a stack is fanned to collapse it,
  // so a tap on bunny / wall background closes it gracefully.
  //
  // The listener is registered with a one-frame delay so the same touch
  // gesture that OPENED the fan does not immediately close it. iOS in
  // particular fires a synthetic pointerdown on the underlying element
  // when a button's React onClick triggers a re-render that removes the
  // original button mid-gesture — that synthetic event was landing on
  // the wall background and instantly setting openDate back to null,
  // making the fan look like it never opened.
  const wallRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openDate) return;
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 0);
    const onDoc = (e: MouseEvent) => {
      if (!armed) return;
      const root = wallRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setOpenDate(null);
    };
    window.addEventListener("pointerdown", onDoc);
    return () => {
      window.clearTimeout(arm);
      window.removeEventListener("pointerdown", onDoc);
    };
  }, [openDate]);

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
      {/* Dim backdrop while a stack is fanned out — sits below the fan
          (z=40) but above the rest of the wall, so a tap anywhere off
          the fan collapses it back without dragging in the click-outside
          listener's edge cases. */}
      {openDate ? (
        <div
          className="wall-fan-backdrop"
          onClick={() => setOpenDate(null)}
          aria-hidden="true"
        />
      ) : null}
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
          const fanned = openDate === stack.date;
          const topItem = stack.items[0];
          const visibleStack = stack.items.slice(0, 3); // peek depth

          return (
            <div
              key={stack.date}
              className={`wall-stack ${fanned ? "fanned" : ""}`}
            >
              {fanned ? (
                <div className="wall-fan">
                  {stack.items.map((p, i) => (
                    <div
                      key={p.id}
                      className="wall-fan-item"
                      style={{
                        transform: `translate(calc(-50% + ${(i - (stack.items.length - 1) / 2) * 84}px), 0) rotate(${(i - (stack.items.length - 1) / 2) * 4}deg)`,
                      }}
                    >
                      <PolaroidCard
                        polaroid={p}
                        caption={captionFor(p)}
                        isTop
                        stackIndex={0}
                        freshlyAdded={false}
                        onClick={() => setDetailPolaroid(p)}
                      />
                    </div>
                  ))}
                  {stack.items.length > 1 ? (
                    <div className="wall-fan-count">
                      {stack.items.length} from this day
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
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
                            if (stack.items.length > 1) {
                              setOpenDate(stack.date);
                            } else {
                              setDetailPolaroid(p);
                            }
                          }}
                        />
                      );
                    })}
                  {stack.items.length > 1 ? (
                    <div className="wall-stack-badge" aria-hidden="true">
                      +{stack.items.length - 1}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      {detailPolaroid ? (
        <PolaroidDetail
          polaroid={detailPolaroid}
          session={
            detailPolaroid.sessionId
              ? sessionsById.get(detailPolaroid.sessionId) ?? null
              : null
          }
          onClose={() => setDetailPolaroid(null)}
          onLikedChange={(liked) => {
            setPolaroids((current) =>
              current.map((p) =>
                p.id === detailPolaroid.id ? { ...p, liked } : p,
              ),
            );
            setDetailPolaroid((curr) => (curr ? { ...curr, liked } : curr));
          }}
          onDeleted={(deletedId) => {
            // Drop the card from local state immediately so the wall
            // doesn't flash a stale stack while a refetch is in flight.
            // If this was the last polaroid in its date stack, also
            // collapse any open fan for that date.
            setPolaroids((current) => {
              const next = current.filter((p) => p.id !== deletedId);
              const removed = current.find((p) => p.id === deletedId);
              if (
                removed &&
                openDate === removed.sessionDate &&
                !next.some((p) => p.sessionDate === removed.sessionDate)
              ) {
                setOpenDate(null);
              }
              return next;
            });
          }}
        />
      ) : null}
    </>
  );
}
