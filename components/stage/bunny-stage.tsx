"use client";

import { MicIcon } from "../icons";
import { BunnyRig } from "./bunny-rig";

type Props = {
  isListening: boolean;
  onBunnyPress: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMicClick: () => void;
  caption: React.ReactNode;
};

// The main stage: greeting line, Bunny image, karaoke caption, and the
// mic dock (button + ripple waves). Caption content is passed in as a
// ReactNode so that page.tsx can keep the karaoke word logic co-located
// with the conversation state.
export function BunnyStage({
  isListening,
  onBunnyPress,
  onMicClick,
  caption,
}: Props) {
  return (
    <main className="stage">
      <div className="greeting">
        <div className="hi">Hi, Yoyo.</div>
      </div>

      <div className="bunny-wrap">
        <div className="bunny-frame">
          <div className="bunny-halo" />
          <div
            className="bunny"
            onPointerDown={onBunnyPress}
            role="button"
            aria-label="Bunny"
          >
            <BunnyRig />
          </div>
          <div className="shadow" />
        </div>
      </div>

      <div className="caption-zone">{caption}</div>

      <div className="dock">
        <button
          className={`mic ${isListening ? "listening" : ""}`}
          aria-label="Talk to Bunny"
          onClick={onMicClick}
        >
          <span className="ring" />
          <span className="ring" />
          <span className="ring" />
          <MicIcon size={22} />
        </button>
        <div className={`wave ${isListening ? "on" : ""}`}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </main>
  );
}
