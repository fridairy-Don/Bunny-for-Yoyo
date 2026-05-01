"use client";

import { forwardRef } from "react";
import { MicIcon } from "../icons";
import {
  BunnyVideoPlayer,
  type BunnyVideoPlayerHandle,
} from "./bunny-video-player";
import type { BunnyBaseState } from "../../lib/config/bunny-videos";

type Props = {
  /** Whether the mic is hot — drives the mic-button red ring + waves. */
  isListening: boolean;
  /** What the bunny should be doing visually. Drives the video stack. */
  videoState: BunnyBaseState;
  /** Tap handler for the bunny itself (cooldown lives in the parent). */
  onBunnyPress: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** Mic-button click handler. */
  onMicClick: () => void;
  /** Caption block (ReactNode so karaoke logic stays in page.tsx). */
  caption: React.ReactNode;
};

// The main stage: greeting line, Bunny video stack, karaoke caption,
// and the mic dock (button + ripple waves). Caption content is passed
// in as a ReactNode so that page.tsx can keep the karaoke word logic
// co-located with the conversation state. The bunny renderer is the
// video-driven BunnyVideoPlayer; the parent forwards a ref so it can
// trigger random touch reactions on tap.
export const BunnyStage = forwardRef<BunnyVideoPlayerHandle, Props>(
  function BunnyStage(
    { isListening, videoState, onBunnyPress, onMicClick, caption },
    playerRef,
  ) {
    return (
      <main className="stage">
        <div className="greeting">
          <div className="hi">Hi, Yoyo.</div>
        </div>

        <div className="bunny-wrap">
          <div className="bunny-frame">
            <div className="bunny-halo" />
            <div className="bunny">
              {/* Ground shadow lives inside the player as
                  `.bunny-video::before` so it stays anchored to the
                  feet across all clips. No more legacy `.shadow` div. */}
              <BunnyVideoPlayer
                ref={playerRef}
                state={videoState}
                onTap={onBunnyPress}
              />
            </div>
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
  },
);
