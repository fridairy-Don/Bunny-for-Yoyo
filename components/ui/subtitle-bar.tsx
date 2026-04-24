"use client";

import type { SubtitleCue } from "../../lib/types/conversation";

type SubtitleBarProps = {
  cue: SubtitleCue | null;
};

export function SubtitleBar({ cue }: SubtitleBarProps) {
  if (!cue) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-28 z-20 mx-auto flex w-[min(92vw,44rem)] justify-center px-4">
      <div className="max-w-full rounded-[1.75rem] border border-white/82 bg-white/72 px-5 py-3 text-center shadow-[0_1rem_2.2rem_rgba(122,84,58,0.14)] backdrop-blur-xl">
        <p className="text-sm leading-6 tracking-[-0.01em] text-[#6a5144] sm:text-[0.95rem]">
          {cue.text}
        </p>
      </div>
    </div>
  );
}
