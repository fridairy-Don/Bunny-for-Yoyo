"use client";

// Alpha-channel webm test page.
//
// Renders the same page chrome as production (world bg + motes + vignette
// + grain), then drops the user-provided alpha webm into the bunny stage
// slot with NO container background, NO mask, NO static fallback — just
// the alpha video on top of the real page paper. The point of this page
// is to answer one question: does the matted bunny fuse cleanly with
// the page bg, edge to edge, no halo, no fringe?
//
// Two render modes side-by-side via the toggle: "raw" alpha (just the
// video on the page bg) and "with halo + scale" (the same alpha video
// but inside the production .bunny-frame chrome, including the soft
// .bunny-halo, no mask, no bg). That way we can see how it looks both
// "isolated" and "in context".

import { useEffect, useState } from "react";
import { Ambient } from "../../../components/chrome/ambient";
import { HeaderChrome } from "../../../components/chrome/header-chrome";
import { useAmbient } from "../../../lib/ambient/use-ambient";

type Source = "webm" | "matanyone" | "cutout" | "mp4" | "split";

// Per-clip metadata: file path + the cream backdrop color sampled directly
// from each clip's first frame. When `match page bg → video` is on, we
// repaint the page in this clip's exact cream so the contain-letterbox
// boundary disappears. Values are SCREEN-rendered (after browser gamma /
// colour-space conversion), not raw source pixels — that's what the eye
// actually sees and therefore what we must match.
type ClipId =
  | "idle"
  | "listening"
  | "listening2"
  | "speaking"
  | "happy-speaking"
  | "touch-happy"
  | "touch-ear"
  | "touch-tickle"
  | "touch-playful";

const CLIPS: Record<
  ClipId,
  {
    label: string;
    src: string;
    pageBg: string;
    /** Optional matted (alpha) version of this clip — used by the
     *  `cutout` source mode. Only present for clips the user has
     *  matted externally so far. */
    cutoutSrc?: string;
  }
> = {
  // NB: `src` historically pointed at the legacy mp4 (cream-backdrop)
  // for side-by-side comparison. Those mp4s have been deleted from
  // /public — `src` now mirrors `cutoutSrc` so any dead-branch code
  // path that still reads `src` won't 404. The dropdown only ever
  // emits cutout entries, so in practice only `cutoutSrc` is read.
  idle: {
    label: "idle",
    src: "/assets/bunny/video/idle-loop-cutout.webm",
    pageBg: "rgb(252, 239, 230)",
    cutoutSrc: "/assets/bunny/video/idle-loop-cutout.webm",
  },
  listening: {
    label: "listening",
    src: "/assets/bunny/video/listening-cutout.webm",
    pageBg: "rgb(244, 230, 220)",
    cutoutSrc: "/assets/bunny/video/listening-cutout.webm",
  },
  listening2: {
    label: "listening 2",
    src: "/assets/bunny/video/listening2-cutout.webm",
    pageBg: "rgb(243, 228, 219)",
    cutoutSrc: "/assets/bunny/video/listening2-cutout.webm",
  },
  speaking: {
    label: "speaking 🆕",
    src: "/assets/bunny/video/speaking-cutout.webm",
    pageBg: "rgb(244, 229, 222)",
    cutoutSrc: "/assets/bunny/video/speaking-cutout.webm",
  },
  "happy-speaking": {
    label: "happy speaking 🆕",
    src: "/assets/bunny/video/happy-speaking-cutout.webm",
    pageBg: "rgb(246, 229, 222)",
    cutoutSrc: "/assets/bunny/video/happy-speaking-cutout.webm",
  },
  "touch-happy": {
    label: "touch happy",
    src: "/assets/bunny/video/touch-happy-react-cutout.webm",
    pageBg: "rgb(244, 229, 221)",
    cutoutSrc: "/assets/bunny/video/touch-happy-react-cutout.webm",
  },
  "touch-ear": {
    label: "touch ear",
    src: "/assets/bunny/video/touch-ear-react-cutout.webm",
    pageBg: "rgb(245, 230, 220)",
    cutoutSrc: "/assets/bunny/video/touch-ear-react-cutout.webm",
  },
  "touch-tickle": {
    label: "touch tickle 🆕",
    src: "/assets/bunny/video/touch-tickle-react-cutout.webm",
    pageBg: "rgb(245, 230, 220)",
    cutoutSrc: "/assets/bunny/video/touch-tickle-react-cutout.webm",
  },
  "touch-playful": {
    label: "touch playful 🆕",
    src: "/assets/bunny/video/touch-playful-react-cutout.webm",
    pageBg: "rgb(243, 228, 220)",
    cutoutSrc: "/assets/bunny/video/touch-playful-react-cutout.webm",
  },
};

export default function BunnyAlphaPreview() {
  const { motes, timeLabel, timeWarm, dayNumber, clientReady } = useAmbient();
  const [showHalo, setShowHalo] = useState(true);
  const [scale, setScale] = useState(1.5);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [source, setSource] = useState<Source>("cutout");
  const [clipId, setClipId] = useState<ClipId>("idle");
  // When ON: override the body bg to match the video's exact cream and
  // hide the world/vignette/grain decorative layers so the page paper
  // is one uniform color. With this on + mp4 + no container bg, if the
  // bunny rectangle disappears, matting becomes optional.
  const [matchPageBg, setMatchPageBg] = useState(false);

  // Selected clip's matched page bg. Cream sampled directly from the
  // screen-rendered video pixels (NOT from canvas drawImage — that
  // returns source-space colour but the browser's video pipeline applies
  // gamma/colour-space conversion and paints a different value on the
  // actual display). We match what the user sees, not what's in the file.
  const VIDEO_BG = CLIPS[clipId].pageBg;

  // Inject a transient stylesheet that overrides body bg + hides the
  // decorative atmosphere layers when the user toggles "match page bg
  // to video". Removed automatically when the toggle flips off.
  useEffect(() => {
    if (!matchPageBg) return;
    const styleEl = document.createElement("style");
    styleEl.id = "bunny-alpha-page-match";
    styleEl.append(
      document.createTextNode(
        `body { background: ${VIDEO_BG} !important; }
         .world, .vignette, .grain { display: none !important; }
         /* Kill the soft "ring" around the bunny — the drop-shadow on
            .bunny and the shadow ellipse below it both dim the area
            adjacent to the video, which makes the video's cream read
            as a brighter rectangle even when the colour values match.
            Removing them lets us judge color match in isolation. */
         .bunny { filter: none !important; }
         .shadow { display: none !important; }
         .bunny-halo { display: none !important; }`,
      ),
    );
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [matchPageBg]);

  return (
    <>
      <Ambient motes={motes} />
      <HeaderChrome
        statusLabel="Bunny is here"
        timeLabel={timeLabel}
        timeWarm={timeWarm}
        dayNumber={dayNumber}
        clientReady={clientReady}
      />

      <main className="stage">
        <div className="greeting">
          <div className="hi">Hi, Yoyo.</div>
        </div>

        {source === "split" ? (
          <SplitPanels
            showHalo={showHalo}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
            stripMp4Bg={matchPageBg}
            mp4Src={CLIPS[clipId].src}
            cutoutSrc={CLIPS[clipId].cutoutSrc}
          />
        ) : (
          <div className="bunny-wrap">
            <div className="bunny-frame">
              {showHalo ? <div className="bunny-halo" /> : null}
              <div className="bunny">
                <BunnyClip
                  source={source}
                  mp4Src={CLIPS[clipId].src}
                  cutoutSrc={CLIPS[clipId].cutoutSrc}
                  scale={scale}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  background={matchPageBg ? "transparent" : undefined}
                />
              </div>
              <div className="shadow" />
            </div>
          </div>
        )}

        {/* Floating debug panel — pinned to the bottom of the viewport so
            it doesn't fight the bunny stage for vertical space. Sliders
            for size + horizontal/vertical offset, plus halo toggle and
            a reset for the position knobs. */}
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "stretch",
            background: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(8px)",
            padding: "12px 18px",
            borderRadius: 14,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            color: "#444",
            zIndex: 100,
            minWidth: 380,
          }}
        >
          {/* One menu — every available (clip × version) combo lives in
              this dropdown. Adding a new clip means appending to the
              CLIPS table above; adding a new cutout webm means setting
              `cutoutSrc` on a clip. UI never has to change. Mouse wheel
              works inside the open dropdown for fast switching. */}
          <select
            value={`${clipId}::${source}`}
            onChange={(e) => {
              const [c, s] = e.target.value.split("::");
              setClipId(c as ClipId);
              setSource(s as Source);
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff7ec",
              color: "#444",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {(Object.keys(CLIPS) as ClipId[]).flatMap((id) => {
              const clip = CLIPS[id];
              const opts: Array<{ value: string; label: string }> = [];
              // Only the cutout (alpha) version is shown in the menu.
              // Clips without a cutout are hidden — they'll re-appear
              // here automatically the moment a cutoutSrc is set.
              if (clip.cutoutSrc) {
                opts.push({
                  value: `${id}::cutout`,
                  label: clip.label,
                });
              }
              return opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ));
            })}
          </select>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={showHalo}
                onChange={(e) => setShowHalo(e.target.checked)}
              />
              <span>halo</span>
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                color: matchPageBg ? "#a64" : "#666",
                fontWeight: matchPageBg ? 600 : 400,
              }}
            >
              <input
                type="checkbox"
                checked={matchPageBg}
                onChange={(e) => setMatchPageBg(e.target.checked)}
              />
              <span>match page bg → video</span>
            </label>
            <button
              onClick={() => {
                setScale(1.5);
                setOffsetX(0);
                setOffsetY(0);
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                background: "#f3eadd",
                border: "none",
                color: "#666",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              reset
            </button>
            <a
              href="/"
              style={{
                marginLeft: "auto",
                padding: "4px 10px",
                borderRadius: 999,
                background: "#f3eadd",
                color: "#666",
                textDecoration: "none",
                fontSize: 12,
              }}
            >
              ← main
            </a>
          </div>

          <Slider
            label="scale"
            min={0.8}
            max={2.2}
            step={0.01}
            value={scale}
            onChange={setScale}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="left ←→ right (X %)"
            min={-30}
            max={30}
            step={0.5}
            value={offsetX}
            onChange={setOffsetX}
            format={(v) => v.toFixed(1) + "%"}
          />
          <Slider
            label="up ↑↓ down (Y %)"
            min={-40}
            max={40}
            step={0.5}
            value={offsetY}
            onChange={setOffsetY}
            format={(v) => v.toFixed(1) + "%"}
          />
        </div>
      </main>
    </>
  );
}

// One bunny clip — used by both the single-source view and each half of
// the split view. The webm flavor renders with no background (alpha
// channel does the work). The mp4 flavor needs a matching cream so the
// contain-letterbox doesn't read as a hard rectangle on the page paper.
function BunnyClip({
  source,
  mp4Src,
  cutoutSrc,
  scale,
  offsetX,
  offsetY,
  background,
}: {
  /** webm = original alpha file the user uploaded earlier (idle only).
   *  matanyone = alpha webm composed from MatAnyone's foreground+alpha
   *    mp4 outputs via ffmpeg alphamerge (idle only).
   *  cutout = user's externally-generated alpha webm — pulled per-clip
   *    from CLIPS[clipId].cutoutSrc.
   *  mp4 = the per-clip cream-bg source mp4.
   */
  source: "webm" | "matanyone" | "cutout" | "mp4";
  mp4Src?: string;
  /** The cutout webm for the currently-selected clip, when in cutout mode. */
  cutoutSrc?: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  background?: string;
}) {
  // The dropdown only emits "cutout" entries now; the legacy mp4 / webm
  // / matanyone source files were removed in the asset cleanup. Fall
  // back to the cutout webm everywhere so any dead branch that still
  // executes still resolves to a real file.
  const src =
    source === "cutout"
      ? cutoutSrc ?? "/assets/bunny/video/idle-loop-cutout.webm"
      : mp4Src ?? cutoutSrc ?? "/assets/bunny/video/idle-loop-cutout.webm";
  // For mp4 we paint a backdrop at the EXACT cream the AI clip was
  // generated against, so the contain-letterbox area inside the bunny
  // slot reads as one continuous color. webm gets no backdrop because
  // alpha already cuts the bunny out cleanly.
  const bg =
    background ??
    (source === "mp4" ? "rgb(250, 239, 233)" : "transparent");
  return (
    <video
      key={`clip-${source}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: "50% 100%",
        transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale})`,
        transformOrigin: "50% 100%",
        pointerEvents: "none",
        background: bg,
      }}
      src={src}
      muted
      playsInline
      autoPlay
      loop
      preload="auto"
    />
  );
}

// Side-by-side comparison: alpha-webm on the left, original mp4 on the
// right, both wearing the same scale + offset so any difference comes
// from the source files themselves, not the layout. Two separate bunny
// frames — same dimensions, same halo, sitting next to each other.
function SplitPanels({
  showHalo,
  scale,
  offsetX,
  offsetY,
  stripMp4Bg,
  mp4Src,
  cutoutSrc,
}: {
  showHalo: boolean;
  scale: number;
  offsetX: number;
  offsetY: number;
  stripMp4Bg: boolean;
  mp4Src: string;
  cutoutSrc?: string;
}) {
  return (
    <div
      style={{
        gridRow: 2,
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        gap: 24,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3,
      }}
    >
      <SplitPanel
        label="alpha — cutout (新)"
        showHalo={showHalo}
        scale={scale}
        offsetX={offsetX}
        offsetY={offsetY}
        source="cutout"
        cutoutSrc={cutoutSrc}
      />
      <SplitPanel
        label={stripMp4Bg ? "original (mp4) — bare" : "original (mp4)"}
        showHalo={showHalo}
        scale={scale}
        offsetX={offsetX}
        offsetY={offsetY}
        source="mp4"
        mp4Src={mp4Src}
        stripBg={stripMp4Bg}
      />
    </div>
  );
}

function SplitPanel({
  label,
  showHalo,
  scale,
  offsetX,
  offsetY,
  source,
  mp4Src,
  cutoutSrc,
  stripBg,
}: {
  label: string;
  showHalo: boolean;
  scale: number;
  offsetX: number;
  offsetY: number;
  source: "webm" | "matanyone" | "cutout" | "mp4";
  mp4Src?: string;
  cutoutSrc?: string;
  stripBg?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        height: "calc(100vh - 230px)",
        maxHeight: 820,
        aspectRatio: "934 / 1040",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -22,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 12,
          color: "#666",
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
      {showHalo ? <div className="bunny-halo" /> : null}
      <div className="bunny">
        <BunnyClip
          source={source}
          mp4Src={mp4Src}
          cutoutSrc={cutoutSrc}
          scale={scale}
          offsetX={offsetX}
          offsetY={offsetY}
          background={stripBg ? "transparent" : undefined}
        />
      </div>
      <div className="shadow" />
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 130, color: "#666", fontSize: 11 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, minWidth: 140 }}
      />
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          width: 50,
          textAlign: "right",
          color: "#888",
        }}
      >
        {format ? format(value) : value.toFixed(2)}
      </span>
    </div>
  );
}
