"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SubtitleCue } from "../types/conversation";

export type CaptionPhase = "idle" | "entering" | "exiting";

export type DisplayedTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type CaptionStream = {
  displayedTurn: DisplayedTurn | null;
  captionPhase: CaptionPhase;
  // imperative reset — used by Clear / Factory reset paths
  clear: () => void;
};

const EXIT_DURATION_MS = 560;

// Manages the 3-phase (idle / entering / exiting) caption transition so that
// page.tsx does not have to coordinate timers and refs. Subscribes to the
// active subtitle cue and the high-level conversation status:
//
//   - when subtitle flips to a new id → exit current, then swap in new
//   - when only subtitle.text changes on the same id → re-enter in place
//   - when status flips to "listening" → retire current so Bunny's last
//     words fly off toward the chatlog immediately (doesn't wait for STT)
export function useCaptionStream(
  subtitle: SubtitleCue | null,
  status: string,
): CaptionStream {
  const [displayedTurn, setDisplayedTurn] = useState<DisplayedTurn | null>(null);
  const [captionPhase, setCaptionPhase] = useState<CaptionPhase>("idle");
  const displayedTurnRef = useRef<DisplayedTurn | null>(null);

  useEffect(() => {
    displayedTurnRef.current = displayedTurn;
  }, [displayedTurn]);

  // subtitle → displayed turn orchestration
  useEffect(() => {
    if (!subtitle) return;
    const current = displayedTurnRef.current;
    if (current && current.id === subtitle.id) {
      if (current.text !== subtitle.text) {
        setDisplayedTurn({ id: subtitle.id, role: subtitle.role, text: subtitle.text });
        setCaptionPhase("entering");
      }
      return;
    }

    if (!current) {
      setDisplayedTurn({ id: subtitle.id, role: subtitle.role, text: subtitle.text });
      setCaptionPhase("entering");
      return;
    }

    setCaptionPhase("exiting");
    const handle = window.setTimeout(() => {
      setDisplayedTurn({ id: subtitle.id, role: subtitle.role, text: subtitle.text });
      setCaptionPhase("entering");
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(handle);
  }, [subtitle?.id, subtitle?.text, subtitle?.role, subtitle]);

  // retire currently displayed turn the instant user taps mic, so caption
  // flies left to the chatlog before STT round-trip completes.
  useEffect(() => {
    if (status !== "listening") return;
    if (!displayedTurnRef.current) return;
    setCaptionPhase("exiting");
    const handle = window.setTimeout(() => {
      setDisplayedTurn(null);
      setCaptionPhase("idle");
    }, EXIT_DURATION_MS);
    return () => window.clearTimeout(handle);
  }, [status]);

  const clear = useCallback(() => {
    setDisplayedTurn(null);
    setCaptionPhase("idle");
  }, []);

  return { displayedTurn, captionPhase, clear };
}
