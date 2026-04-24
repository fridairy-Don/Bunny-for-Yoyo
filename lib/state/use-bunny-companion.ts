"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUNNY_IMAGES,
  pickClickReaction,
  randomBlinkDelay,
  type BunnyVisualState,
  type InteractionState,
  type MomentaryState,
} from "../config/bunny";

const CLICK_COOLDOWN_MS = 400;

export function useBunnyCompanion() {
  const [bunnyState, setBunnyState] = useState<BunnyVisualState>("idle");
  const [interactionState, setInteractionState] = useState<InteractionState>("idle");
  const [talkFrame, setTalkFrame] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickCooldownUntilRef = useRef<number>(0);

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

  // Double-blink: eyes close → open briefly → close again, occasionally a third time.
  const triggerDoubleBlink = () => {
    clearTimers();
    setTalkFrame(false);
    setBunnyState("blink");

    // first blink → idle → second blink → maybe third → idle
    timeoutRef.current = setTimeout(() => {
      setBunnyState("idle");
      timeoutRef.current = setTimeout(() => {
        setBunnyState("blink");
        const thirdRoll = Math.random();
        timeoutRef.current = setTimeout(() => {
          if (thirdRoll < 0.2) {
            setBunnyState("idle");
            timeoutRef.current = setTimeout(() => {
              setBunnyState("blink");
              timeoutRef.current = setTimeout(() => {
                setBunnyState("idle");
                timeoutRef.current = null;
              }, 140);
            }, 90);
          } else {
            setBunnyState("idle");
            timeoutRef.current = null;
          }
        }, 150);
      }, 90);
    }, 150);
  };

  const triggerEarThenHappy = () => {
    clearTimers();
    setTalkFrame(false);
    setBunnyState("ear_react");
    timeoutRef.current = setTimeout(() => {
      setBunnyState("happy");
      timeoutRef.current = setTimeout(() => {
        setBunnyState("idle");
        timeoutRef.current = null;
      }, 650);
    }, 320);
  };

  const handleBunnyPress = () => {
    if (interactionState === "speaking") {
      return;
    }

    // Cool-down: ignore rapid repeated taps so reactions don't stack oddly.
    const now = Date.now();
    if (now < clickCooldownUntilRef.current) {
      return;
    }
    clickCooldownUntilRef.current = now + CLICK_COOLDOWN_MS;

    if (interactionState === "listening") {
      // While Yoyo is recording, Bunny holds ear_react ("I'm listening").
      setBunnyState("ear_react");
      return;
    }

    const reaction = pickClickReaction();
    if (reaction === "blink") {
      triggerDoubleBlink();
      clickCooldownUntilRef.current = now + 700;
      return;
    }
    if (reaction === "happy") {
      triggerBunnyReaction("happy", 780);
      clickCooldownUntilRef.current = now + 900;
      return;
    }
    if (reaction === "ear_then_happy") {
      triggerEarThenHappy();
      clickCooldownUntilRef.current = now + 1100;
      return;
    }
    // default: ear_react
    triggerBunnyReaction("ear_react", 800);
    clickCooldownUntilRef.current = now + 900;
  };

  useEffect(() => {
    if (bunnyState !== "idle" || interactionState !== "idle") {
      return;
    }

    const blinkTimer = setTimeout(() => {
      triggerDoubleBlink();
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
