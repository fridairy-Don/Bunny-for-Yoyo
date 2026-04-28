"use client";

import { BookmarkIcon, MoonIcon, MusicNoteIcon } from "../icons";

type Props = {
  openDrawer: "music" | "memory" | null;
  asleep: boolean;
  onToggleDrawer: (which: "music" | "memory") => void;
  onToggleSleep: () => void;
};

// Bottom-right floating controls: music drawer toggle, memory drawer toggle,
// and "say goodnight" (dim everything). Lives outside <main> so drawers can
// overlap without reflowing the stage.
export function CornerControls({
  openDrawer,
  asleep,
  onToggleDrawer,
  onToggleSleep,
}: Props) {
  return (
    <div className="corner">
      <button
        className={openDrawer === "music" ? "active" : ""}
        aria-label="Music"
        onClick={() => onToggleDrawer("music")}
      >
        <MusicNoteIcon strokeWidth={1.6} size={18} />
        <span>music</span>
      </button>
      <button
        className={openDrawer === "memory" ? "active" : ""}
        aria-label="Memory"
        onClick={() => onToggleDrawer("memory")}
      >
        <BookmarkIcon strokeWidth={1.6} size={18} />
        <span>memory</span>
      </button>
      <button
        className={`icon-only ${asleep ? "active" : ""}`}
        aria-label="Say goodnight"
        title="say goodnight"
        onClick={onToggleSleep}
      >
        <MoonIcon strokeWidth={1.6} size={18} />
      </button>
    </div>
  );
}
