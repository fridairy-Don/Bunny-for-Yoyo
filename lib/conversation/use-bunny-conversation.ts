"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BUNNY_CHARACTER, MOCK_SESSION_TURNS } from "../config/character";
import { createAudioRecorder } from "../audio/browser-recorder";
import { ApiSpeechToTextClient } from "../stt/api-stt-client";
import { ApiLlmClient } from "../llm/api-llm-client";
import { ApiSpeechPlayer } from "../tts/api-speech-player";
import type {
  ConversationStatus,
  ConversationTurn,
  SubtitleCue,
} from "../types/conversation";

type BunnyController = {
  beginListening: () => void;
  startSpeaking: () => void;
  returnToIdle: () => void;
  showMomentaryReaction: (state: "happy" | "ear_react" | "blink", duration?: number) => void;
};

type LastCloserPayload = {
  endedAt?: number;
  turns?: Array<{ role: "user" | "assistant"; text: string }>;
} | null;

type ConversationOptions = {
  getMemories?: () => string[];
  getLastCloser?: () => LastCloserPayload;
};

const createTurn = (role: ConversationTurn["role"], text: string): ConversationTurn => ({
  id: `${role}-${crypto.randomUUID()}`,
  role,
  text,
  createdAt: Date.now(),
});

export function useBunnyConversation(
  controller: BunnyController,
  options: ConversationOptions = {},
) {
  const recorderRef = useRef(createAudioRecorder());
  const sttClientRef = useRef(new ApiSpeechToTextClient());
  const llmClientRef = useRef(new ApiLlmClient());
  const speechPlayerRef = useRef(new ApiSpeechPlayer());

  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>(MOCK_SESSION_TURNS);
  const [subtitle, setSubtitle] = useState<SubtitleCue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const turnsRef = useRef(turns);

  const characterName = BUNNY_CHARACTER.name;

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const handleMicClick = async () => {
    setError(null);

    if (status === "idle") {
      try {
        await recorderRef.current.start();
        controller.beginListening();
        setStatus("listening");
        setSubtitle(null);
      } catch (cause) {
        controller.returnToIdle();
        setStatus("error");
        setError(getAudioErrorMessage(cause));
        setSubtitle(null);
      }

      return;
    }

    if (status !== "listening") {
      return;
    }

    try {
      setStatus("transcribing");
      const capture = await recorderRef.current.stop();
      const transcript = await sttClientRef.current.transcribe(capture);

      const userTurn = createTurn("user", transcript.text);
      setTurns((current) => [...current, userTurn]);
      setSubtitle({ id: userTurn.id, text: userTurn.text, role: "user" });

      setStatus("thinking");
      const history = [...turnsRef.current, userTurn];
      const memories = options.getMemories?.() ?? [];
      const lastCloser = options.getLastCloser?.() ?? null;
      const reply = await llmClientRef.current.generateReply(history, memories, lastCloser);
      const assistantTurn = createTurn("assistant", reply.text);

      setTurns((current) => [...current, assistantTurn]);
      setSubtitle({ id: assistantTurn.id, text: assistantTurn.text, role: "assistant" });

      setStatus("speaking");
      controller.startSpeaking();
      setActiveWordIndex(-1);
      await speechPlayerRef.current.speak(reply.text, {
        onWordChange: (idx) => setActiveWordIndex(idx),
      });
      setActiveWordIndex(-1);
      controller.returnToIdle();
      controller.showMomentaryReaction("happy", 760);
      setStatus("idle");
    } catch (cause) {
      speechPlayerRef.current.stop();
      controller.returnToIdle();
      setStatus("error");
      setActiveWordIndex(-1);
      setError(getAudioErrorMessage(cause));
      setSubtitle(null);
    }
  };

  const clearTurns = () => {
    setTurns([]);
    setSubtitle(null);
  };

  const sessionSummary = useMemo(
    () => ({
      characterName,
      turnCount: turns.length,
      latestTurn: turns.at(-1) ?? null,
    }),
    [characterName, turns],
  );

  return {
    status,
    subtitle,
    turns,
    error,
    sessionSummary,
    handleMicClick,
    clearTurns,
    activeWordIndex,
  };
}

function getAudioErrorMessage(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "audio_error";
}
