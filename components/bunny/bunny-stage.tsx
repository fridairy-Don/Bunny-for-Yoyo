"use client";

import Image from "next/image";
import type { KeyboardEvent } from "react";
import type { BunnyVisualState, InteractionState } from "../../lib/config/bunny";

type BunnyStageProps = {
  bunnyImage: string;
  bunnyState: BunnyVisualState;
  interactionState: InteractionState;
  onInteract: () => void;
};

export function BunnyStage({
  bunnyImage,
  bunnyState,
  interactionState,
  onInteract,
}: BunnyStageProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onInteract();
  };

  return (
    <button
      type="button"
      aria-label="Play with bunny"
      data-bunny-state={bunnyState}
      data-interaction-state={interactionState}
      onPointerDown={onInteract}
      onKeyDown={handleKeyDown}
      className="bunny-stage group relative flex aspect-square w-[min(78vw,34rem)] touch-manipulation items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[#d58f66]"
    >
      <div className="absolute bottom-[9%] h-[13%] w-[58%] rounded-full bg-[#b9805a]/14 blur-xl" />
      <Image
        key={bunnyImage}
        src={bunnyImage}
        alt={`Bunny companion ${bunnyState.replace("_", " ")} state`}
        width={934}
        height={1040}
        priority
        className="bunny-sprite relative z-10 h-auto w-full select-none object-contain drop-shadow-[0_2.2rem_2.2rem_rgba(142,94,61,0.14)]"
        draggable={false}
      />
    </button>
  );
}
