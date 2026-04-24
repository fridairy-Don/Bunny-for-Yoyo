"use client";

type MagicMicButtonProps = {
  isListening: boolean;
  onClick: () => void;
};

export function MagicMicButton({ isListening, onClick }: MagicMicButtonProps) {
  return (
    <div className="fixed bottom-7 left-1/2 z-20 -translate-x-1/2">
      <button
        type="button"
        aria-label={isListening ? "Stop listening" : "Start listening"}
        aria-pressed={isListening}
        onClick={onClick}
        className={["magic-mic-button", isListening ? "is-listening" : ""].join(" ")}
      >
        <span className="sr-only">{isListening ? "Stop listening" : "Start listening"}</span>
        <span className="magic-wave magic-wave-one" aria-hidden="true" />
        <span className="magic-wave magic-wave-two" aria-hidden="true" />
        <span className="magic-wave magic-wave-three" aria-hidden="true" />
        <span className="magic-wave magic-wave-four" aria-hidden="true" />
        <span className="magic-wave magic-wave-five" aria-hidden="true" />
        <span className="magic-orbit magic-orbit-one" aria-hidden="true" />
        <span className="magic-orbit magic-orbit-two" aria-hidden="true" />
        <span className="magic-sparkle magic-sparkle-one" aria-hidden="true" />
        <span className="magic-sparkle magic-sparkle-two" aria-hidden="true" />
        <span className="magic-sparkle magic-sparkle-three" aria-hidden="true" />
        <span className="magic-sparkle magic-sparkle-four" aria-hidden="true" />
        <svg
          aria-hidden="true"
          className="relative z-10 h-10 w-10"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24 28.5c4.15 0 7.2-3.15 7.2-7.45v-9.3c0-4.15-3.05-7.25-7.2-7.25s-7.2 3.1-7.2 7.25v9.3c0 4.3 3.05 7.45 7.2 7.45Z"
            fill="#fff9f4"
            stroke="#7b5845"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.6 20.3c0 7.8 5.45 13.25 13.4 13.25S37.4 28.1 37.4 20.3M24 33.55V41M19.65 41h8.7"
            stroke="#7b5845"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M37.6 6.4l1.25 3 3.15 1.05-3.15 1.05-1.25 3-1.25-3-3.15-1.05 3.15-1.05 1.25-3Z"
            fill="#ffd56f"
            stroke="#d58a59"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M12.7 7.8l.75 1.8 1.85.65-1.85.65-.75 1.8-.75-1.8-1.85-.65 1.85-.65.75-1.8Z"
            fill="#f8aeca"
            stroke="#d58a59"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
