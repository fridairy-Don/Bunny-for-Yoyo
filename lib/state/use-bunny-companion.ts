"use client";

import { useCallback, useRef, useState } from "react";
import { inferSpeakAction } from "../conversation/infer-speak-action";
import type { BunnyBaseState } from "../config/bunny-videos";

// ---------------------------------------------------------------------------
// useBunnyCompanion
// ---------------------------------------------------------------------------
// Drives the bunny's high-level visual state (idle / listening / speaking /
// happy_speaking) for the BunnyVideoPlayer.
//
// The public API is the same shape as before so that useBunnyConversation
// and page.tsx didn't have to change. Internally we no longer track
// fine-grained rig states — the videos carry the entire visual story now.

const CLICK_COOLDOWN_MS = 400;

export type BunnyInteractionState = "idle" | "listening" | "speaking";

export type StartSpeakingHint = { text?: string };

export function useBunnyCompanion() {
  const [videoState, setVideoState] = useState<BunnyBaseState>("idle");
  const [interactionState, setInteractionState] =
    useState<BunnyInteractionState>("idle");

  // Player-side reaction trigger — page.tsx wires this to the
  // BunnyVideoPlayer ref. handleBunnyPress invokes whatever's bound here.
  const reactionTriggerRef = useRef<(() => void) | null>(null);
  const clickCooldownUntilRef = useRef<number>(0);

  const setReactionTrigger = useCallback(
    (fn: (() => void) | null) => {
      reactionTriggerRef.current = fn;
    },
    [],
  );

  // ----- state transitions ------------------------------------------------
  const beginListening = useCallback(() => {
    setInteractionState("listening");
    setVideoState("listening");
  }, []);

  const startSpeaking = useCallback((hint?: StartSpeakingHint) => {
    const action = inferSpeakAction(hint?.text);
    setInteractionState("speaking");
    setVideoState(action);
  }, []);

  const returnToIdle = useCallback(() => {
    setInteractionState("idle");
    setVideoState("idle");
  }, []);

  // Legacy hook — preserved as a no-op so existing call sites don't have
  // to change. The post-speak "happy flourish" the rig used to do is
  // unnecessary now that the speaking loop already conveys emotion.
  const showMomentaryReaction = useCallback(
    (_state: "happy" | "ear_react" | "blink", _duration?: number) => {
      // intentionally empty
    },
    [],
  );

  // ----- click handler ----------------------------------------------------
  // Reactions now live INSIDE the BunnyVideoPlayer (via its own ear/body
  // hotspots). This handler stays as a generic "child tapped the bunny"
  // notification: page.tsx might want it for analytics or for waking the
  // bunny from sleep. We deliberately do NOT call reactionTriggerRef here
  // — doing so would double-fire because the player already played the
  // reaction internally.
  const handleBunnyPress = useCallback(() => {
    if (interactionState === "speaking") return;
    const now = Date.now();
    if (now < clickCooldownUntilRef.current) return;
    clickCooldownUntilRef.current = now + CLICK_COOLDOWN_MS;
    // intentionally no reactionTrigger call — player owns reactions.
  }, [interactionState]);

  return {
    // For BunnyVideoPlayer (read by bunny-stage / page):
    videoState,
    setReactionTrigger,

    // For useBunnyConversation (the BunnyController interface):
    beginListening,
    startSpeaking,
    returnToIdle,
    showMomentaryReaction,

    // For page.tsx UI state + click routing:
    interactionState,
    isListening: interactionState === "listening",
    handleBunnyPress,
  };
}
