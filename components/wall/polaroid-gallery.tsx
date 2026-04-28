"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deletePolaroid,
  setPolaroidLiked,
  type Polaroid,
} from "../../lib/memory/polaroid-store";
import {
  getSessionById,
  type DailySession,
  type SessionCard,
} from "../../lib/memory/session-store";

// Three-stage gallery experience that replaces both the old "fan-spread"
// view AND the standalone detail modal:
//
//   "carousel"  side-by-side cards, swipe / wheel / arrows / dot indicators
//   "enlarged"  one card focused, others blurred behind, pinch-zoom enabled
//   "flipped"   the focused card is rotated 180° to show the conversation
//               transcript saved with that polaroid.
//
// State transitions:
//   carousel → click any card → enlarged
//   enlarged → click the card → flipped
//   flipped  → click the card → enlarged
//   enlarged/flipped → click background or × → carousel
//   carousel → click backdrop or × → close
//
// For 1-card "stacks" we skip carousel and open straight in enlarged.

type Props = {
  items: Polaroid[];
  sessions: Map<string, SessionCard>;
  initialIndex?: number;
  onClose: () => void;
  onLikedChange: (id: string, liked: boolean) => void;
  onDeleted: (id: string) => void;
};

type Mode = "carousel" | "enlarged" | "flipped";

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

export function PolaroidGallery({
  items,
  sessions,
  initialIndex = 0,
  onClose,
  onLikedChange,
  onDeleted,
}: Props) {
  const total = items.length;
  // 1-card stacks get straight to enlarged — there's nothing to carousel.
  const [mode, setMode] = useState<Mode>(total === 1 ? "enlarged" : "carousel");
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, Math.min(initialIndex, total - 1)),
  );

  // Lazy-load transcripts only when a card is flipped.
  const [transcripts, setTranscripts] = useState<Map<string, DailySession>>(
    () => new Map(),
  );
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  // Pinch-to-zoom state for the enlarged photo. We track the pinch's
  // initial distance + the scale at the start of that pinch so the live
  // gesture multiplies cleanly. Scale persists across gestures (a second
  // pinch starts from the current scale, not 1) — that matches how Photos
  // and similar apps feel on iPad.
  const [scale, setScale] = useState(1);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(
    null,
  );

  // Card flip in 3D. We don't keep this in state (Mode handles it); we
  // just set a CSS class on the focused card.

  const activeItem = items[activeIndex];

  // ---- transcript lazy load -------------------------------------------------
  useEffect(() => {
    if (mode !== "flipped") return;
    if (!activeItem?.sessionId) return;
    if (transcripts.has(activeItem.sessionId)) return;
    let cancelled = false;
    setLoadingTranscript(true);
    void getSessionById(activeItem.sessionId)
      .then((s) => {
        if (cancelled || !s) return;
        setTranscripts((prev) => {
          const next = new Map(prev);
          next.set(activeItem.sessionId!, s);
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingTranscript(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, activeItem?.sessionId, transcripts]);

  // ---- escape closes the topmost layer -------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mode === "flipped") {
        setMode("enlarged");
        return;
      }
      if (mode === "enlarged") {
        // 1-card "stacks" don't have a carousel to fall back to.
        if (total === 1) onClose();
        else setMode("carousel");
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose, total]);

  // ---- carousel navigation --------------------------------------------------
  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + total) % total);
  }, [total]);
  const goNext = useCallback(() => {
    setActiveIndex((i) => (i + 1) % total);
  }, [total]);

  // Mouse wheel — both vertical (wheel) and horizontal (trackpad) deltas
  // advance the carousel. We rate-limit to one step per ~280ms so a single
  // flick doesn't shoot past every card.
  const wheelLockRef = useRef(0);
  const onWheel: React.WheelEventHandler = (e) => {
    if (mode !== "carousel") return;
    if (total <= 1) return;
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(delta) < 8) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 280) return;
    wheelLockRef.current = now;
    if (delta > 0) goNext();
    else goPrev();
  };

  // Touch swipe on the carousel track — just measure start/end x and
  // commit a step on lift. We don't do live-drag (rubber-band) here; a
  // simple snap feels right for a 6-year-old's tap-and-flick.
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const onTrackTouchStart: React.TouchEventHandler = (e) => {
    if (mode !== "carousel") return;
    const t = e.touches[0];
    if (!t) return;
    swipeRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTrackTouchEnd: React.TouchEventHandler = (e) => {
    if (mode !== "carousel") return;
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Only treat as a swipe if it was more horizontal than vertical and
    // crossed a meaningful distance — ignores small jitters and
    // accidental taps that happen to wiggle a few px.
    if (Math.abs(dx) < 40) return;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  // ---- enlarged-mode pinch zoom --------------------------------------------
  const onEnlargedTouchStart: React.TouchEventHandler = (e) => {
    if (mode !== "enlarged") return;
    if (e.touches.length !== 2) return;
    const a = e.touches[0];
    const b = e.touches[1];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchRef.current = { startDist: dist, startScale: scale };
  };
  const onEnlargedTouchMove: React.TouchEventHandler = (e) => {
    if (mode !== "enlarged") return;
    const ref = pinchRef.current;
    if (!ref) return;
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const a = e.touches[0];
    const b = e.touches[1];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (ref.startDist <= 0) return;
    const next = Math.min(3, Math.max(1, ref.startScale * (dist / ref.startDist)));
    setScale(next);
  };
  const onEnlargedTouchEnd: React.TouchEventHandler = () => {
    if (pinchRef.current) pinchRef.current = null;
  };

  // ---- card click router ---------------------------------------------------
  const onCardClick = (idx: number) => {
    if (mode === "carousel") {
      setActiveIndex(idx);
      setScale(1);
      setMode("enlarged");
      return;
    }
    if (mode === "enlarged") {
      // Don't flip if the user just pinch-zoomed beyond 1× — a tap to
      // zoom out should reset zoom first, not flip.
      if (scale > 1.05) {
        setScale(1);
        return;
      }
      setMode("flipped");
      return;
    }
    if (mode === "flipped") {
      setMode("enlarged");
      return;
    }
  };

  // ---- close behaviour matches the user flow ------------------------------
  const onBackdropClick = () => {
    if (mode === "flipped") {
      setMode("enlarged");
      return;
    }
    if (mode === "enlarged" && total > 1) {
      setMode("carousel");
      setScale(1);
      return;
    }
    onClose();
  };

  // ---- like / delete on the focused card ----------------------------------
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset action state any time the focused card changes — otherwise an
  // armed "remove" stays armed when the user swipes to the next card.
  useEffect(() => {
    setConfirmingDelete(false);
    setDeleting(false);
  }, [activeIndex]);

  const onToggleLike = () => {
    if (!activeItem) return;
    const next = !activeItem.liked;
    onLikedChange(activeItem.id, next);
    void setPolaroidLiked(activeItem.id, next).catch(() => undefined);
  };

  const onConfirmDelete = async () => {
    if (!activeItem || deleting) return;
    setDeleting(true);
    const ok = await deletePolaroid(activeItem.id);
    if (!ok) {
      setDeleting(false);
      setConfirmingDelete(false);
      return;
    }
    onDeleted(activeItem.id);
    // If this was the last card in the gallery, close. Otherwise drop it
    // and clamp activeIndex.
    if (total <= 1) {
      onClose();
      return;
    }
    setActiveIndex((i) => Math.min(i, total - 2));
    setMode(total - 1 === 1 ? "enlarged" : "carousel");
    setConfirmingDelete(false);
    setDeleting(false);
  };

  // ---- carousel layout (transform per card) -------------------------------
  // Card slot width in CSS px; tuned to read as "side by side" on iPad
  // portrait (~820px wide) without crowding. Mobile + desktop scale down
  // via clamp() in the CSS — but we still need a number for the
  // translateX math, so we measure the stage on mount + resize.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [slotPx, setSlotPx] = useState(280);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const w = window.innerWidth;
      // Slot = card width + gap. We want roughly 1.6 cards visible on
      // the stage so the neighbours peek in.
      const card = Math.max(180, Math.min(280, Math.round(w * 0.42)));
      const gap = 24;
      setSlotPx(card + gap);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Translate the track so the active card centres in the stage.
  const trackTransform = `translateX(calc(50% - ${slotPx / 2}px - ${
    activeIndex * slotPx
  }px))`;

  // ---- captions / metadata ------------------------------------------------
  const captionFor = useCallback(
    (p: Polaroid): string => {
      if (p.status === "pending") return "developing…";
      if (p.status === "failed") return "this one didn't quite develop.";
      if (p.sessionId) {
        const s = sessions.get(p.sessionId);
        if (s?.summary) return s.summary;
      }
      return "a quiet talk we had.";
    },
    [sessions],
  );

  const transcript = activeItem?.sessionId
    ? transcripts.get(activeItem.sessionId) ?? null
    : null;

  // Memoise dot list so we don't rebuild every render.
  const dots = useMemo(
    () => Array.from({ length: total }, (_, i) => i),
    [total],
  );

  return (
    <div
      className={`pgallery pgallery-mode-${mode}`}
      role="dialog"
      aria-modal="true"
      onWheel={onWheel}
    >
      <div className="pgallery-backdrop" onClick={onBackdropClick} />

      {/* Always-visible × at the top-right. Closes the gallery entirely
          (the backdrop handles the "step back" behaviour). */}
      <button
        type="button"
        className="pgallery-close"
        onClick={onClose}
        aria-label="Close gallery"
      >
        ×
      </button>

      {/* ===== Carousel layer ============================================== */}
      {total > 1 ? (
        <div
          ref={stageRef}
          className="pgallery-stage"
          aria-hidden={mode !== "carousel"}
        >
          <button
            type="button"
            className="pgallery-arrow pgallery-arrow-prev"
            onClick={goPrev}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <div
            className="pgallery-track"
            style={{ transform: trackTransform }}
            onTouchStart={onTrackTouchStart}
            onTouchEnd={onTrackTouchEnd}
          >
            {items.map((p, i) => (
              <button
                type="button"
                key={p.id}
                className={`pgallery-card ${i === activeIndex ? "active" : ""}`}
                style={{
                  width: `${slotPx - 24}px`,
                }}
                onClick={() => onCardClick(i)}
                aria-label={`Photo ${i + 1} of ${total}`}
              >
                <PhotoFrame
                  polaroid={p}
                  caption={captionFor(p)}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pgallery-arrow pgallery-arrow-next"
            onClick={goNext}
            aria-label="Next photo"
          >
            ›
          </button>

          <div className="pgallery-dots" role="tablist" aria-label="Photo position">
            {dots.map((i) => (
              <button
                key={i}
                type="button"
                className={`pgallery-dot ${i === activeIndex ? "active" : ""}`}
                onClick={() => setActiveIndex(i)}
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* ===== Enlarged / flipped layer =================================== */}
      {(mode === "enlarged" || mode === "flipped") && activeItem ? (
        <div
          className="pgallery-focus"
          onTouchStart={onEnlargedTouchStart}
          onTouchMove={onEnlargedTouchMove}
          onTouchEnd={onEnlargedTouchEnd}
          onClick={onBackdropClick}
        >
          <div
            className={`pgallery-flipper ${mode === "flipped" ? "flipped" : ""}`}
            style={{
              transform: `${
                mode === "flipped" ? "rotateY(180deg) " : ""
              }scale(${scale})`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="pgallery-face pgallery-face-front"
              onClick={() => onCardClick(activeIndex)}
              aria-label={
                mode === "flipped" ? "Show photo" : "Flip to see the talk"
              }
            >
              <PhotoFrame
                polaroid={activeItem}
                caption={captionFor(activeItem)}
                large
              />
            </button>

            <button
              type="button"
              className="pgallery-face pgallery-face-back"
              onClick={() => onCardClick(activeIndex)}
              aria-label="Flip back to photo"
            >
              <div className="pgallery-back-inner">
                <div className="pgallery-back-date">
                  {friendlyDate(activeItem.sessionDate)}
                </div>
                <div className="pgallery-back-summary">
                  {captionFor(activeItem)}
                </div>
                <div className="pgallery-back-transcript">
                  {transcript ? (
                    transcript.turns
                      .filter((t) => t.role !== "system")
                      .map((turn) => (
                        <div
                          key={turn.id}
                          className={`pgallery-line ${turn.role === "user" ? "user" : ""}`}
                        >
                          <span className="who">
                            {turn.role === "user" ? "Yoyo" : "Bunny"}
                          </span>
                          <span className="what">{turn.text}</span>
                        </div>
                      ))
                  ) : loadingTranscript ? (
                    <div className="pgallery-back-empty">opening the talk…</div>
                  ) : !activeItem.sessionId ? (
                    <div className="pgallery-back-empty">
                      no talk was saved with this one.
                    </div>
                  ) : (
                    <div className="pgallery-back-empty">opening the talk…</div>
                  )}
                </div>
              </div>
            </button>
          </div>

          {/* like + remove sit outside the flipper so they don't rotate
              with it. They act on the FOCUSED card. */}
          {mode === "enlarged" ? (
            <div className="pgallery-actions" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`pgallery-heart ${activeItem.liked ? "on" : ""}`}
                onClick={onToggleLike}
                aria-pressed={activeItem.liked}
                aria-label={activeItem.liked ? "Unlike polaroid" : "Like polaroid"}
              >
                <span className="heart-glyph" aria-hidden="true">
                  {activeItem.liked ? "♥" : "♡"}
                </span>
                <span className="heart-label">
                  {activeItem.liked ? "kept close" : "keep close"}
                </span>
              </button>

              <button
                type="button"
                className="pgallery-remove"
                onClick={() => setConfirmingDelete((v) => !v)}
              >
                {confirmingDelete ? "cancel" : "remove"}
              </button>

              {confirmingDelete ? (
                <button
                  type="button"
                  className="pgallery-remove-confirm"
                  onClick={onConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "removing…" : "remove for good"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---- subcomponent: a polaroid photo + caption frame, sized by parent ----
function PhotoFrame({
  polaroid,
  caption,
  large = false,
}: {
  polaroid: Polaroid;
  caption: string;
  large?: boolean;
}) {
  const developing = polaroid.status === "pending";
  const failed = polaroid.status === "failed";
  const pinColor = PIN_PALETTE[polaroid.pinColor] ?? PIN_PALETTE.rose;

  return (
    <div className={`pgallery-frame ${large ? "large" : ""}`}>
      <span
        className="pgallery-frame-pin"
        aria-hidden="true"
        style={{ background: pinColor }}
      />
      <div className="pgallery-frame-photo">
        {polaroid.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={polaroid.imageUrl} alt="" className="pgallery-frame-img" />
            <span className="pgallery-frame-shine" />
          </>
        ) : developing ? (
          <div className="pgallery-frame-developing">
            <div className="pgallery-frame-developing-haze" />
            <div className="pgallery-frame-developing-label">developing…</div>
          </div>
        ) : (
          <div className="pgallery-frame-failed">
            this one didn&rsquo;t quite develop.
          </div>
        )}
      </div>
      <div className="pgallery-frame-caption">
        <div className="pgallery-frame-date">
          {friendlyDate(polaroid.sessionDate)}
        </div>
        <div className="pgallery-frame-text">{!failed ? caption : "—"}</div>
      </div>
    </div>
  );
}
