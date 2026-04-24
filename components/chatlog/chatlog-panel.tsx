"use client";

import { useEffect, useRef } from "react";

import { BookmarkIcon } from "../icons";

export type SaveState = "idle" | "saving" | "saved" | "error";

type ChatTurn = { id: string; role: "user" | "assistant" | "system"; text: string };

type Props = {
  hasChat: boolean;
  turns: ChatTurn[];
  saveState: SaveState;
  saveEnabled: boolean;
  saveLabel: string;
  onSave: () => void;
  onClear: () => void;
};

// Left-side conversation log. Scroll auto-sticks to bottom when new turns
// arrive. Top bar holds "save to memory" and "clear" actions — styling via
// globals.css .chatlog / .bubble-row rules.
export function ChatlogPanel({
  hasChat,
  turns,
  saveState,
  saveEnabled,
  saveLabel,
  onSave,
  onClear,
}: Props) {
  return (
    <aside className={`chatlog ${hasChat ? "show" : ""}`} aria-label="Conversation">
      <div className="chatlog-head">
        <span>today · our talk</span>
        <span className="actions">
          <button
            className={`save-session ${saveState === "saved" ? "saved" : ""}`}
            onClick={onSave}
            disabled={!saveEnabled || saveState === "saving"}
            title="save today's talk to memory"
          >
            <BookmarkIcon filled={saveState === "saved"} />
            <span>{saveLabel}</span>
          </button>
          <button className="clear" onClick={onClear} title="Clear">
            clear
          </button>
        </span>
      </div>
      <ChatLogScroll turns={turns} />
    </aside>
  );
}

function ChatLogScroll({ turns }: { turns: ChatTurn[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  return (
    <div className="chatlog-scroll" ref={scrollRef}>
      {turns.map((turn) => {
        if (turn.role === "system") return null;
        const isUser = turn.role === "user";
        return (
          <div key={turn.id} className={`bubble-row ${isUser ? "user" : "bot"}`}>
            {isUser ? (
              <div className="chat-avatar user-av" aria-hidden="true">
                Y
              </div>
            ) : (
              <div
                className="chat-avatar bunny-av"
                aria-hidden="true"
                role="img"
                aria-label="Bunny"
              />
            )}
            <div className={`bubble ${isUser ? "user" : ""}`}>{turn.text}</div>
          </div>
        );
      })}
    </div>
  );
}
