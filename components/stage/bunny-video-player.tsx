"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  REACTION_IDS,
  REACTION_VIDEOS,
  type BunnyBaseState,
  type BunnyReactionId,
} from "../../lib/config/bunny-videos";

// ---------------------------------------------------------------------------
// BunnyVideoPlayer
// ---------------------------------------------------------------------------
// Architecture:
//   stack:  <video idle-loop>     always playing, opacity toggled
//           <video listening-loop> always playing, opacity toggled
//           <video listening2-loop>always playing, opacity toggled
//           <video speaking-loop>  always playing, opacity toggled
//           <video happy-speaking> always playing, opacity toggled
//   top:    <video touch-happy>    always preloaded, played on demand
//           <video touch-playful>  always preloaded, played on demand
//           <video touch-ear>      always preloaded, played on demand
//           <video touch-ticklish> always preloaded, played on demand
//
// All clips are alpha-channel VP9 webms — the page paper shows through
// directly behind the bunny, no per-clip cream backdrop matching needed,
// and no static idle.png fallback either (the old fallback bled its own
// cream backdrop through during the first paint).
// Switching base state = flip opacity on two layers (~120ms ease-out).
// No src swap, no decoder restart. Reactions live in their own layer
// above the base stack and are also pre-mounted so triggering one is
// just `currentTime = 0; play(); opacity = 1`.

const BASE_DIR = "/assets/bunny/video";

// ---------------------------------------------------------------------------
// Format selection — VP9 alpha (webm) for everyone EXCEPT Safari / iOS.
// ---------------------------------------------------------------------------
// Safari/iPadOS Safari does not honor the matroska `alpha_mode=1` side
// channel: it decodes the VP9 RGB frame straight, leaving the bunny on
// the chroma key green that MatAnyone composited the alpha over. We ship
// the same clips re-encoded to HEVC + alpha (`.mov`, `hvc1`, BGRA via
// `hevc_videotoolbox -alpha_quality 0.8 -tag:v hvc1`) — this is Apple's
// canonical transparent-video format and is honored from iOS 13 onward.
// Chrome/Firefox/Edge keep using the webm path (better cross-engine
// support, smaller files, and identical to what shipped in v2-video-bunny).

function isAppleWebKit(): boolean {
  // SSR-safe: server returns false → first paint uses webm; we re-derive
  // on mount inside an effect via state. The only Safari we care about
  // here is the one that DOESN'T decode VP9 alpha — that is, Safari
  // itself (desktop + iOS) and iOS Chrome / iOS Firefox (which under
  // the hood are WKWebView and inherit the same VP9-alpha behavior).
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iOS / iPadOS — every browser there is WebKit. Catch iPad Safari
  // even when Apple's "Request Desktop Site" is on (which strips the
  // mobile string but keeps Mac OS X + Safari signature).
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const iPadDesktopMode =
    /Macintosh/.test(ua) &&
    typeof document !== "undefined" &&
    "ontouchend" in document;
  if (isIos || iPadDesktopMode) return true;
  // Desktop Safari: has Safari, doesn't have Chrome/Chromium/Edg.
  const isSafariDesktop =
    /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  return isSafariDesktop;
}

// Same set of clips, two encodings. Player picks one extension at mount.
const BASE_LOOP_IDS = [
  "idle",
  "listening",
  "listening2",
  "speaking",
  "happy_speaking",
] as const;
type BaseLoopId = (typeof BASE_LOOP_IDS)[number];

type SrcMap = Record<BaseLoopId, string>;

const BASE_LOOP_SRC_WEBM: SrcMap = {
  idle: `${BASE_DIR}/idle-loop-cutout.webm`,
  listening: `${BASE_DIR}/listening-cutout.webm`,
  listening2: `${BASE_DIR}/listening2-cutout.webm`,
  speaking: `${BASE_DIR}/speaking-cutout.webm`,
  happy_speaking: `${BASE_DIR}/happy-speaking-cutout.webm`,
};
const BASE_LOOP_SRC_MOV: SrcMap = {
  idle: `${BASE_DIR}/idle-loop-cutout.mov`,
  listening: `${BASE_DIR}/listening-cutout.mov`,
  listening2: `${BASE_DIR}/listening2-cutout.mov`,
  speaking: `${BASE_DIR}/speaking-cutout.mov`,
  happy_speaking: `${BASE_DIR}/happy-speaking-cutout.mov`,
};
const REACTION_SRC_OVERRIDE_MOV: Record<BunnyReactionId, string> = {
  "touch-happy": `${BASE_DIR}/touch-happy-react-cutout.mov`,
  "touch-playful": `${BASE_DIR}/touch-playful-react-cutout.mov`,
  "touch-ear": `${BASE_DIR}/touch-ear-react-cutout.mov`,
  "touch-ticklish": `${BASE_DIR}/touch-tickle-react-cutout.mov`,
};

const LISTENING_VARIANTS: BaseLoopId[] = ["listening", "listening2"];

function pickListeningVariant(prev: BaseLoopId | null): BaseLoopId {
  // Avoid the same listening loop twice in a row when there's a choice.
  const pool = prev
    ? LISTENING_VARIANTS.filter((id) => id !== prev)
    : LISTENING_VARIANTS;
  return pool[Math.floor(Math.random() * pool.length)] ?? "listening";
}

// Map the public state to an internal base-loop id.
function resolveLoop(
  state: BunnyBaseState,
  lastListening: BaseLoopId | null,
): BaseLoopId {
  if (state === "listening") return pickListeningVariant(lastListening);
  return state as BaseLoopId;
}

// ---------------------------------------------------------------------------
// Debug snapshot — emitted on every render so the preview page can show
// load state per layer. Optional; main app passes no callback.
// ---------------------------------------------------------------------------

export type BunnyVideoDebugInfo = {
  baseState: BunnyBaseState;
  visibleLoopId: BaseLoopId;
  activeReactionId: BunnyReactionId | null;
  loops: Array<{
    id: BaseLoopId;
    readyState: number;
    canPlayThrough: boolean;
    paused: boolean;
  }>;
  reactions: Array<{
    id: BunnyReactionId;
    readyState: number;
    canPlayThrough: boolean;
  }>;
};

type Props = {
  /** Which base loop the bunny should be playing when no reaction is active. */
  state: BunnyBaseState;
  /** Click/tap handler — bubbles up so the parent can run cooldowns etc. */
  onTap?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Optional debug hook called every animation frame with current load
   *  state. Used by the preview page only. */
  onDebug?: (info: BunnyVideoDebugInfo) => void;
};

export type BunnyVideoPlayerHandle = {
  /** Play one of the touch reactions. If a reaction is already playing,
   *  this interrupts it with a fresh one (different from the current). */
  triggerRandomReaction: () => void;
  /** Play a specific reaction by id. Used by the ear hotspot to always
   *  fire the touch-ear clip; can also be used by the parent for
   *  scripted reactions. Same interruption semantics as the random one. */
  triggerReaction: (id: BunnyReactionId) => void;
};

export const BunnyVideoPlayer = forwardRef<BunnyVideoPlayerHandle, Props>(
  function BunnyVideoPlayer({ state, onTap, onDebug }, ref) {
    // ----- refs to all <video> elements (5 base + 4 reaction) -----------
    const baseRefs = useRef<Record<BaseLoopId, HTMLVideoElement | null>>({
      idle: null,
      listening: null,
      listening2: null,
      speaking: null,
      happy_speaking: null,
    });
    const reactionRefs = useRef<Record<BunnyReactionId, HTMLVideoElement | null>>({
      "touch-happy": null,
      "touch-playful": null,
      "touch-ear": null,
      "touch-ticklish": null,
    });

    // Which loop should be visible right now. Decoupled from the prop so
    // we can pin to a listening variant once and not re-pick on every
    // re-render.
    const [visibleLoopId, setVisibleLoopId] = useState<BaseLoopId>("idle");
    const lastListeningRef = useRef<BaseLoopId | null>(null);
    const lastBaseStateRef = useRef<BunnyBaseState>("idle");

    // SSR-safe source selection. First paint uses webm (the SSR-time
    // assumption); after mount we re-run UA detection — Safari/iOS
    // swaps to .mov (HEVC alpha) because their VP9 decoder ignores
    // alpha. For everyone else (Chrome/Firefox/Edge) the swap is a
    // no-op and the src never changes. Captured in state so the
    // attribute on every <video> updates atomically.
    const [useMov, setUseMov] = useState(false);
    useEffect(() => {
      if (isAppleWebKit()) setUseMov(true);
    }, []);
    const baseLoopSrc: SrcMap = useMov ? BASE_LOOP_SRC_MOV : BASE_LOOP_SRC_WEBM;
    const reactionSrcFor = (id: BunnyReactionId): string =>
      useMov ? REACTION_SRC_OVERRIDE_MOV[id] : REACTION_VIDEOS[id].src;

    // Reaction state — null when none active.
    const [activeReactionId, setActiveReactionId] = useState<
      BunnyReactionId | null
    >(null);
    const lastReactionRef = useRef<BunnyReactionId | null>(null);

    // ----- mount: kick all base videos into play() so they decode -------
    useEffect(() => {
      for (const id of BASE_LOOP_IDS) {
        const el = baseRefs.current[id];
        if (!el) continue;
        el.muted = true;
        el.playsInline = true;
        el.loop = true;
        el.preload = "auto";
        el.play().catch(() => undefined);
      }
      // Reactions: warm-decode each one so iOS Safari actually has a
      // decoded first frame ready when we later flip opacity to 1.
      // `el.load()` only fetches metadata on iPad — the decoder
      // doesn't run until something calls play(). Without this, the
      // first tap on the bunny lands on a video with zero decoded
      // frames and the opacity-flip shows an empty rectangle for
      // ~200-500ms while Safari catches up. We stagger the warmups
      // with a small delay so all 9 decoders don't fight for the
      // same hardware slots at once. Each is muted + playsInline,
      // which the iOS autoplay policy allows even without a user
      // gesture.
      REACTION_IDS.forEach((id, idx) => {
        const el = reactionRefs.current[id];
        if (!el) return;
        el.muted = true;
        el.playsInline = true;
        el.preload = "auto";
        // Stagger by 120ms each so we don't trip iPad's concurrent
        // decoder limit. Total warmup window for 4 reactions = 480ms.
        window.setTimeout(() => {
          try {
            el.currentTime = 0;
          } catch {
            // ignore
          }
          el
            .play()
            .then(() => {
              // First frame is now in the decoder. Pause so it doesn't
              // render and waste cycles — but the decoder STAYS warm,
              // so the next play() is instant.
              el.pause();
              try {
                el.currentTime = 0;
              } catch {
                // ignore
              }
            })
            .catch(() => {
              // If autoplay was rejected, fall back to load() — at
              // least we have metadata. Tap will still work, just
              // with a slightly slower first frame.
              try {
                el.load();
              } catch {
                // ignore
              }
            });
        }, idx * 120);
      });
    }, []);

    // ----- react to state-prop changes ----------------------------------
    useEffect(() => {
      // Decide which loop to surface for this state. Only re-pick when the
      // state ACTUALLY changes — re-running this effect for an unchanged
      // state would re-roll listening variants and visually flicker.
      if (lastBaseStateRef.current === state) return;
      lastBaseStateRef.current = state;
      const next = resolveLoop(state, lastListeningRef.current);
      if (next === "listening" || next === "listening2") {
        lastListeningRef.current = next;
      }
      setVisibleLoopId(next);
    }, [state]);

    // ----- internal: play a specific reaction ---------------------------
    // Pulled out so both the imperative API and the internal hotspot
    // click handlers route through the same code.
    const playReactionRef = useRef<((id: BunnyReactionId) => void) | null>(
      null,
    );
    playReactionRef.current = (reactionId: BunnyReactionId) => {
      // If a different reaction is already up, pause it so we don't burn
      // CPU decoding two clips at once. Its src stays loaded, so the
      // next time it's triggered we get an instant restart.
      if (activeReactionId && activeReactionId !== reactionId) {
        const prev = reactionRefs.current[activeReactionId];
        if (prev) {
          try {
            prev.pause();
          } catch {
            // ignore
          }
        }
      }
      const el = reactionRefs.current[reactionId];
      if (!el) return;
      try {
        el.currentTime = 0;
      } catch {
        // ignore — happens if metadata isn't ready yet
      }
      lastReactionRef.current = reactionId;
      // Defer the opacity-flip until the video element actually starts
      // emitting frames. On iPad Safari, calling play() on a not-yet-
      // decoded reaction layer takes 200-500ms before the first frame
      // is rendered — if we flip opacity to 1 right away, the user
      // sees an empty rectangle (the base loop is hidden, the reaction
      // has no frames yet). Listening for `playing` waits exactly
      // until the decoder has output ready, then both layers swap
      // simultaneously.
      //
      // Fallback timer: if the `playing` event doesn't fire within
      // 600ms (e.g. some Safari versions are sluggish), force the
      // swap anyway so the tap doesn't feel dead.
      let flipped = false;
      const doFlip = () => {
        if (flipped) return;
        flipped = true;
        setActiveReactionId(reactionId);
      };
      const onPlaying = () => {
        el.removeEventListener("playing", onPlaying);
        doFlip();
      };
      el.addEventListener("playing", onPlaying);
      window.setTimeout(() => {
        el.removeEventListener("playing", onPlaying);
        doFlip();
      }, 600);
      el.play().catch(() => {
        // play() rejected. Try once more after a short tick — iPad
        // sometimes recovers from the autoplay denial that follows
        // a freshly-loaded element.
        window.setTimeout(() => el.play().catch(() => undefined), 50);
      });
    };

    // ----- random reaction picker ---------------------------------------
    // Picks any of the 4 reactions (including touch-ear), excluding the
    // one that just played so rapid taps don't repeat. Pulled out so
    // both the imperative API and the hotspot click handler share the
    // same logic — no more ear/body split.
    const pickRandomReaction = (): BunnyReactionId => {
      const pool = REACTION_IDS.filter(
        (id) => id !== lastReactionRef.current,
      );
      return (
        pool[Math.floor(Math.random() * pool.length)] ??
        REACTION_IDS[Math.floor(Math.random() * REACTION_IDS.length)] ??
        REACTION_IDS[0]
      );
    };

    // ----- imperative API ------------------------------------------------
    useImperativeHandle(ref, () => ({
      triggerRandomReaction: () => {
        playReactionRef.current?.(pickRandomReaction());
      },
      triggerReaction: (id: BunnyReactionId) => {
        // Still exposed for callers that want to force a specific
        // reaction (e.g. scripted moments). The default tap path no
        // longer uses this — see handleHotspotClick below.
        playReactionRef.current?.(id);
      },
    }));

    // ----- hotspot click handler ----------------------------------------
    // Single full-bunny hotspot. Tapping anywhere on the bunny picks one
    // of the 4 reactions at random, excluding whatever played last so
    // rapid taps cycle through different animations. State guard: if
    // the bunny is currently speaking, we drop the tap — interrupting
    // a TTS reply with a giggle would be confusing for a child mid-listen.
    const lastHotspotTapRef = useRef<number>(0);
    const HOTSPOT_COOLDOWN_MS = 250;
    const handleHotspotClick = (
      e: React.MouseEvent | React.PointerEvent,
    ) => {
      e.stopPropagation();
      if (state === "speaking" || state === "happy_speaking") return;
      const now = Date.now();
      if (now - lastHotspotTapRef.current < HOTSPOT_COOLDOWN_MS) return;
      lastHotspotTapRef.current = now;
      playReactionRef.current?.(pickRandomReaction());
      // Notify the parent (analytics / cool-down side-effects). The
      // reaction itself has already fired locally — the parent must
      // NOT re-trigger one through its own ref binding or we'd double up.
      onTap?.(e as React.PointerEvent<HTMLDivElement>);
    };

    const handleReactionEnded = useCallback(
      (id: BunnyReactionId) => () => {
        // Only hide if this is still the active reaction. A rapid tap may
        // have already swapped to a different one.
        setActiveReactionId((cur) => (cur === id ? null : cur));
      },
      [],
    );

    // ----- debug snapshots ---------------------------------------------
    useEffect(() => {
      if (!onDebug) return;
      let raf: number | null = null;
      const tick = () => {
        const loops = BASE_LOOP_IDS.map((id) => {
          const el = baseRefs.current[id];
          return {
            id,
            readyState: el?.readyState ?? 0,
            canPlayThrough: (el?.readyState ?? 0) >= 4,
            paused: el?.paused ?? true,
          };
        });
        const reactions = REACTION_IDS.map((id) => {
          const el = reactionRefs.current[id];
          return {
            id,
            readyState: el?.readyState ?? 0,
            canPlayThrough: (el?.readyState ?? 0) >= 4,
          };
        });
        onDebug({
          baseState: state,
          visibleLoopId,
          activeReactionId,
          loops,
          reactions,
        });
        raf = requestAnimationFrame(tick);
      };
      tick();
      return () => {
        if (raf !== null) cancelAnimationFrame(raf);
      };
    }, [onDebug, state, visibleLoopId, activeReactionId]);

    return (
      <div
        className="bunny-video"
        role="presentation"
      >
        {/* Base loops — all five mounted, always decoding, only one
            visible at a time via opacity. */}
        {BASE_LOOP_IDS.map((id) => (
          <video
            // Key includes useMov so React swaps the element entirely
            // when the source format changes, avoiding mid-load src
            // mutation glitches on Safari.
            key={`${id}-${useMov ? "mov" : "webm"}`}
            ref={(el) => {
              baseRefs.current[id] = el;
            }}
            className="bunny-video__layer"
            data-loop-id={id}
            style={{
              opacity: visibleLoopId === id && !activeReactionId ? 1 : 0,
            }}
            src={baseLoopSrc[id]}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
          />
        ))}

        {/* Reaction layers — all four mounted, preloaded, hidden until
            triggered. Only one is visible at a time (sits above all
            base layers via z-index). */}
        {REACTION_IDS.map((id) => (
          <video
            key={`${id}-${useMov ? "mov" : "webm"}`}
            ref={(el) => {
              reactionRefs.current[id] = el;
            }}
            className="bunny-video__layer bunny-video__reaction"
            data-reaction-id={id}
            style={{ opacity: activeReactionId === id ? 1 : 0 }}
            src={reactionSrcFor(id)}
            muted
            playsInline
            preload="auto"
            onEnded={handleReactionEnded(id)}
          />
        ))}

        {/* Single click hotspot — invisible, sits above every video
            layer and covers the full bunny silhouette area. Tap picks
            a random reaction (ear, happy, playful, ticklish) excluding
            whatever played last. No-op while the bunny is speaking. */}
        <div
          className="bunny-video__hotspot"
          onPointerDown={handleHotspotClick}
          role="button"
          aria-label="Tap bunny"
        />
      </div>
    );
  },
);

// Re-export for the preview page debug panel.
export { BASE_LOOP_IDS };
export type { BaseLoopId };
