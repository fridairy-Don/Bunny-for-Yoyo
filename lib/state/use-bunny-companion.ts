"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUNNY_IMAGES,
  type BunnyVisualState,
  type InteractionState,
  type MomentaryState,
  randomBlinkDelay,
} from "../config/bunny";

export function useBunnyCompanion() {
  const [bunnyState, setBunnyState] = useState<BunnyVisualState>("idle");
  const [interactionState, setInteractionState] = useState<InteractionState>("idle");
  const [talkFrame, setTalkFrame] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
  };

  const returnToIdle = () => {
    clearTimers();
    setTalkFrame(false);
    setBunnyState("idle");
    setInteractionState("idle");
  };

  const triggerMomentary = (nextState: MomentaryState, duration = 650) => {
    clearTimers();
    setTalkFrame(false);
    setBunnyState(nextState);
    setInteractionState("idle");

    timeoutRef.current = setTimeout(() => {
      setBunnyState("idle");
      timeoutRef.current = null;
    }, duration);
  };

  const triggerBunnyReaction = (nextState: MomentaryState, duration = 650) => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setTalkFrame(false);
    setBunnyState(nextState);

    timeoutRef.current = setTimeout(() => {
      setBunnyState("idle");
      timeoutRef.current = null;
    }, duration);
  };

  const triggerListening = () => {
    clearTimers();
    setTalkFrame(false);
    setBunnyState("ear_react");
    setInteractionState("listening");
  };

  const startSpeaking = () => {
    clearTimers();
    setInteractionState("speaking");
    setBunnyState("speaking");
    setTalkFrame(true);

    speakingIntervalRef.current = setInterval(() => {
      setTalkFrame((current) => !current);
    }, 200);
  };

  const speakForDuration = (duration = 2000) => {
    startSpeaking();
    timeoutRef.current = setTimeout(() => {
      returnToIdle();
    }, duration);
  };

  const triggerEarReact = () => {
    triggerBunnyReaction("ear_react", 850);
  };

  const handleBunnyPress = () => {
    if (interactionState === "speaking") {
      return;
    }

    if (interactionState === "listening") {
      setBunnyState("ear_react");
      return;
    }

    triggerEarReact();
  };

  useEffect(() => {
    if (bunnyState !== "idle" || interactionState !== "idle") {
      return;
    }

    const blinkTimer = setTimeout(() => {
      triggerMomentary("blink", 160);
    }, randomBlinkDelay());

    return () => clearTimeout(blinkTimer);
  }, [bunnyState, interactionState]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    Object.values(BUNNY_IMAGES).forEach((src) => {
      const image = new window.Image();
      image.src = src;
    });
  }, []);

  const bunnyImage = useMemo(() => {
    if (bunnyState === "speaking") {
      return talkFrame ? BUNNY_IMAGES.speak : BUNNY_IMAGES.idle;
    }

    return BUNNY_IMAGES[bunnyState];
  }, [bunnyState, talkFrame]);

  return {
    bunnyImage,
    bunnyState,
    interactionState,
    isListening: interactionState === "listening",
    handleBunnyPress,
    beginListening: triggerListening,
    startSpeaking,
    speakForDuration,
    returnToIdle,
    showMomentaryReaction: triggerMomentary,
  };
}
