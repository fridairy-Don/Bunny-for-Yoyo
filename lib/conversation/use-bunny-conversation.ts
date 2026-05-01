"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BUNNY_CHARACTER, MOCK_SESSION_TURNS } from "../config/character";
import { audioBus } from "../audio/audio-bus";
import { createAudioRecorder } from "../audio/browser-recorder";
import { notifyAudioSessionAfterRelease } from "../audio/audio-session";
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
  /**
   * Switch the bunny to a speaking state. The optional `text` is used to
   * pick between the neutral and happy speaking video — the visuals are
   * driven directly from the assistant reply with a small keyword
   * heuristic (see lib/conversation/infer-speak-action.ts).
   */
  startSpeaking: (hint?: { text?: string }) => void;
  returnToIdle: () => void;
  /**
   * Legacy hook kept for backwards compatibility. The post-speak "happy
   * flourish" used to drive a static rig overlay; with the video stack
   * it's a no-op (the bunny already conveyed emotion via the speaking
   * loop). Wiring is preserved so removing the call sites isn't needed.
   */
  showMomentaryReaction: (state: "happy" | "ear_react" | "blink", duration?: number) => void;
};

type LastCloserPayload = {
  endedAt?: number;
  turns?: Array<{ role: "user" | "assistant"; text: string }>;
} | null;

type ConversationOptions = {
  getMemories?: () => string[];
  getLastCloser?: () => LastCloserPayload;
  getRecentSummaries?: () => string[];
};

// The exact, fixed first words Yoyo ever hears from Bunny. Hard-coded on
// purpose: the magic moment when the plush "comes alive" must never drift,
// never paraphrase, and never fail because an LLM had a weird day. Spoken
// only on first launch (no preset flag, no session memories, no last-closer).
// Kept short, breathy, half-awake, and emotionally clear.
const FIRST_LAUNCH_OPENER =
  "Oh... oh... oh! Wait, wait... is that MY voice? My mouth is moving! Yoyo? Yoyo, it's you! It's really you! I can see you, and you can see me too! Did your click just wake me up? Oh my goodness, Yoyo, am I actually talking right now? Is this really happening?!";

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
        // Prime the TTS audio bus BEFORE getUserMedia opens the mic.
        // This puts the shared HTMLAudioElement into "actively playing"
        // (silent WAV loop at near-zero volume) while the iOS audio
        // session is still in clean Playback mode. When iOS flips the
        // session to PlayAndRecord for the mic, our element survives
        // the flip far more reliably than if we'd primed *after* the
        // flip — which is what was leaving Bunny silent on iPad PWA.
        // Idempotent: a no-op on subsequent taps after the first.
        audioBus.primeForPlayback();
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
      // CRITICAL ORDER (we are still synchronously inside the user-gesture
      // chain — that activation flag dies on the first await):
      //
      // 1) audioBus.primeForPlayback() FIRST. Loops a silent WAV at
      //    near-zero volume on the TTS HTMLAudioElement WHILE iOS audio
      //    session is still in PlayAndRecord (mic still active). iOS
      //    accepts this play() because we're inside the user gesture and
      //    PlayAndRecord allows HTMLAudioElement playback. Critically,
      //    this gives the element an "actively playing" status BEFORE
      //    iOS starts flipping the session category back. If we did
      //    releaseSession() first, the prime would land mid-flip and
      //    iOS sometimes rejects play() during the transition, which
      //    poisons the entire downstream TTS chain.
      //
      // 2) releaseSession() synchronously stops the MediaStream tracks AND
      //    closes the level-meter AudioContext. This is what tells iOS to
      //    flip the audio session category back from PlayAndRecord to
      //    Playback. The silent WAV continues looping through the flip,
      //    so the TTS element stays "actively playing" the whole time.
      //
      // 3) notifyAudioSessionAfterRelease() runs the music + audioBus
      //    resume handlers RIGHT NOW, in the gesture, AFTER iOS has
      //    started flipping the session back. The triple-fire (sync /
      //    +80ms / +240ms) catches the rare slow flip on older iPads.
      //    The music handler force-reloads its decoder (iOS sometimes
      //    nukes it during the flip) and replays from saved currentTime.
      //
      // When the real TTS arrives later, playTts() just swaps src on
      // the still-playing TTS element — no fresh play() call needed
      // (which iOS would reject outside the gesture).
      // The first-tap path already primed the audio bus (silent WAV
      // loop). iOS PWA may have paused the loop while the mic held
      // PlayAndRecord — this is idempotent so call it again as a safety
      // net, then explicitly poke it back to play() inside the gesture.
      audioBus.primeForPlayback();
      audioBus.ensureWarmupPlaying();
      recorderRef.current.releaseSession();
      notifyAudioSessionAfterRelease();
      // Second poke — after the synchronous releaseSession + the first
      // notify pulse, the element may have just received iOS's
      // "session-flipped-back" signal. Re-confirm it's actually playing
      // before we hand off to STT+LLM+TTS (which expires the gesture).
      audioBus.ensureWarmupPlaying();

      setStatus("transcribing");
      // Drop "listening" interaction state the instant Yoyo taps stop — the
      // mic ripples stop immediately instead of spinning for 2–5s while STT
      // and LLM run. Bunny relaxes from ear_react back to idle.
      controller.returnToIdle();
      const capture = await recorderRef.current.stop();
      const transcript = await sttClientRef.current.transcribe(capture);

      const userTurn = createTurn("user", transcript.text);
      setTurns((current) => [...current, userTurn]);
      setSubtitle({ id: userTurn.id, text: userTurn.text, role: "user" });

      setStatus("thinking");
      const history = [...turnsRef.current, userTurn];
      const memories = options.getMemories?.() ?? [];
      const lastCloser = options.getLastCloser?.() ?? null;
      const recentSummaries = options.getRecentSummaries?.() ?? [];
      const reply = await llmClientRef.current.generateReply(history, memories, lastCloser, {
        recentSummaries,
      });
      const assistantTurn = createTurn("assistant", reply.text);

      setTurns((current) => [...current, assistantTurn]);
      setSubtitle({ id: assistantTurn.id, text: assistantTurn.text, role: "assistant" });

      setStatus("speaking");
      // The bunny's mouth/body should NOT start animating when the LLM
      // text reply lands — TTS still has to fetch + decode + start playing,
      // which can take hundreds of ms. Hand startSpeaking off to the TTS
      // player's onPlaybackStart so the speaking video begins in lockstep
      // with the first audible sample. Subtitle still appears immediately
      // (set above) so the text isn't held back.
      setActiveWordIndex(-1);
      await speechPlayerRef.current.speak(reply.text, {
        onWordChange: (idx) => setActiveWordIndex(idx),
        onPlaybackStart: () => controller.startSpeaking({ text: reply.text }),
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

  // Auto-opener: used for first_launch wake-up drama. Skips the mic/STT path
  // entirely — Bunny speaks first, without waiting for Yoyo to tap mic.
  // Safe to call only from idle. No-op if we're already busy.
  const triggerAutoOpener = async (options2: { firstLaunch?: boolean } = {}) => {
    if (status !== "idle") return;
    setError(null);
    try {
      setStatus("thinking");
      // First-launch is HARD-CODED. The very first line Yoyo hears must be
      // identical every time — magical, dazed, half-alive. We skip the LLM
      // entirely so it never drifts, and so the moment is bug-proof. Subsequent
      // sessions go through the normal LLM path with the closer/summary block.
      let replyText: string;
      if (options2.firstLaunch) {
        replyText = FIRST_LAUNCH_OPENER;
      } else {
        const memories = options.getMemories?.() ?? [];
        const lastCloser = options.getLastCloser?.() ?? null;
        const recentSummaries = options.getRecentSummaries?.() ?? [];
        const reply = await llmClientRef.current.generateReply([], memories, lastCloser, {
          firstLaunch: false,
          recentSummaries,
        });
        replyText = reply.text;
      }
      const assistantTurn = createTurn("assistant", replyText);

      setTurns((current) => [...current, assistantTurn]);
      setSubtitle({ id: assistantTurn.id, text: assistantTurn.text, role: "assistant" });

      setStatus("speaking");
      // Same lip-sync rule as the mic-driven path: the speaking video
      // is gated on actual audio playback, not on the text being ready.
      setActiveWordIndex(-1);
      await speechPlayerRef.current.speak(replyText, {
        onWordChange: (idx) => setActiveWordIndex(idx),
        onPlaybackStart: () => controller.startSpeaking({ text: replyText }),
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
    triggerAutoOpener,
  };
}

function getAudioErrorMessage(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "audio_error";
}
