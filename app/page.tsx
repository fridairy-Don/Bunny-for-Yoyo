"use client";

import { BunnyStage } from "../components/bunny/bunny-stage";
import { MagicMicButton } from "../components/ui/magic-mic-button";
import { SubtitleBar } from "../components/ui/subtitle-bar";
import { useBunnyConversation } from "../lib/conversation/use-bunny-conversation";
import { useBunnyCompanion } from "../lib/state/use-bunny-companion";

export default function Home() {
  const companion = useBunnyCompanion();
  const {
    bunnyImage,
    bunnyState,
    interactionState,
    isListening,
    handleBunnyPress,
    beginListening,
    startSpeaking,
    returnToIdle,
    showMomentaryReaction,
  } = companion;
  const { subtitle, handleMicClick } = useBunnyConversation({
    beginListening,
    startSpeaking,
    returnToIdle,
    showMomentaryReaction,
  });

  return (
    <main
      className={[
        "relative flex min-h-screen overflow-hidden bg-[#fff8ef] text-[#4a382d]",
        isListening ? "is-listening-scene" : "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.96)_0%,rgba(255,244,230,0.82)_34%,rgba(248,224,204,0.58)_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[14%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#fffdf8]/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-18rem] left-1/2 h-[38rem] w-[52rem] -translate-x-1/2 rounded-[100%] bg-[#f3d7bd]/35 blur-2xl" />

      <section className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-5 pb-36 pt-12 sm:pb-32">
        <BunnyStage
          bunnyImage={bunnyImage}
          bunnyState={bunnyState}
          interactionState={interactionState}
          onInteract={handleBunnyPress}
        />
      </section>

      <SubtitleBar cue={subtitle} />
      <MagicMicButton isListening={isListening} onClick={handleMicClick} />
    </main>
  );
}
