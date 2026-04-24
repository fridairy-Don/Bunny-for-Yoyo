"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  text: string;
  role: "assistant" | "user";
  keyId: string;
  phase: "idle" | "entering" | "exiting";
  karaokeActive: boolean;
  activeWordIndex: number;
  hasError: boolean;
};

// Renders the karaoke caption bubble: each word is its own <span> so that
// the currently-spoken word can be styled independently (rose pill). Uses
// \s+ tokenization to match the server-side word timing alignment exactly —
// important because mixing split rules used to cause the pill to engulf
// two words across paragraph breaks (see commit 165f631).
export function CaptionZone({
  text,
  role,
  keyId,
  phase,
  karaokeActive,
  activeWordIndex,
  hasError,
}: Props) {
  const currentWordRef = useRef<HTMLSpanElement | null>(null);

  const captionWords = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  // As each word lights up, gently scroll it into view so long replies keep
  // the active word visible inside the fixed-height caption zone.
  useEffect(() => {
    if (!karaokeActive) return;
    if (activeWordIndex < 0) return;
    const el = currentWordRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
    } catch {
      // older browsers
    }
  }, [karaokeActive, activeWordIndex, keyId]);

  const classes = ["caption"];
  if (phase === "exiting" && !hasError) classes.push("exiting");
  if (role === "user") classes.push("is-user");
  if (karaokeActive) classes.push("has-karaoke");

  return (
    <div
      className={classes.join(" ")}
      style={{ opacity: text ? 1 : 0 }}
      key={keyId}
    >
      {captionWords.map((word, i) => {
        const wordClasses = ["word"];
        if (karaokeActive) {
          if (i < activeWordIndex) wordClasses.push("spoken");
          else if (i === activeWordIndex) wordClasses.push("current");
        }
        return (
          <span
            key={`${keyId}-${i}`}
            className={wordClasses.join(" ")}
            ref={karaokeActive && i === activeWordIndex ? currentWordRef : undefined}
            style={karaokeActive ? undefined : { animationDelay: `${i * 0.08}s` }}
          >
            {word + " "}
          </span>
        );
      })}
    </div>
  );
}
