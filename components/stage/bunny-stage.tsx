"use client";

import { MicIcon } from "../icons";

type Props = {
  bunnyImage: string;
  isListening: boolean;
  onBunnyPress: (e: React.PointerEvent<HTMLImageElement>) => void;
  onMicClick: () => void;
  caption: React.ReactNode;
};

// The main stage: greeting line, Bunny image, karaoke caption, and the
// mic dock (button + ripple waves). Caption content is passed in as a
// ReactNode so that page.tsx can keep the karaoke word logic co-located
// with the conversation state.
export function BunnyStage({
  bunnyImage,
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="bunny"
            src={bunnyImage}
            alt="Bunny"
            draggable={false}
            onPointerDown={onBunnyPress}
          />
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
