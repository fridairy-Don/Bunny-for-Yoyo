// Single source of truth for the Bunny video assets.
//
// All clips are 1080×1920 (9:16). Loop clips drive the four base states
// the bunny lives in (idle / listening / speaking / happy_speaking) and
// must be set to `loop`. Reaction clips are short one-shots triggered by
// touching the bunny — they cover the current loop briefly, then we fall
// back to whichever loop is active.
//
// The shape here is intentionally flat and data-only so adding a new
// clip is one line: drop the file in /public/assets/bunny/video/, add
// an entry, done.

export type BunnyBaseState =
  | "idle"
  | "listening"
  | "speaking"
  | "happy_speaking";

export type BunnyReactionId =
  | "touch-happy"
  | "touch-playful"
  | "touch-ear"
  | "touch-ticklish";

export type BunnyVideoEntry = {
  id: string;
  src: string;
  loop: boolean;
};

const VIDEO_DIR = "/assets/bunny/video";

// Loops that map to base states. listening has two variants — the player
// picks one of them when entering the listening state so back-to-back
// recordings don't always show the same animation.
// All clips are now alpha-channel VP9 webm cutouts (transparent background,
// no cream backdrop). The page paper shows through directly behind the bunny.
export const BASE_VIDEOS: Record<BunnyBaseState, BunnyVideoEntry[]> = {
  idle: [{ id: "idle-loop", src: `${VIDEO_DIR}/idle-loop-cutout.webm`, loop: true }],
  listening: [
    { id: "listening-loop", src: `${VIDEO_DIR}/listening-cutout.webm`, loop: true },
    { id: "listening2-loop", src: `${VIDEO_DIR}/listening2-cutout.webm`, loop: true },
  ],
  speaking: [
    { id: "speaking-loop", src: `${VIDEO_DIR}/speaking-cutout.webm`, loop: true },
  ],
  happy_speaking: [
    {
      id: "happy-speaking-loop",
      src: `${VIDEO_DIR}/happy-speaking-cutout.webm`,
      loop: true,
    },
  ],
};

// One-shot reactions. Triggered by tapping the bunny. They override the
// current base loop until they end, then control returns to the base.
// NB: the ticklish reaction's source file is named "touch-tickle-react-cutout.webm"
// (not "ticklish") — keep the public id as "touch-ticklish" for back-compat.
export const REACTION_VIDEOS: Record<BunnyReactionId, BunnyVideoEntry> = {
  "touch-happy": {
    id: "touch-happy",
    src: `${VIDEO_DIR}/touch-happy-react-cutout.webm`,
    loop: false,
  },
  "touch-playful": {
    id: "touch-playful",
    src: `${VIDEO_DIR}/touch-playful-react-cutout.webm`,
    loop: false,
  },
  "touch-ear": {
    id: "touch-ear",
    src: `${VIDEO_DIR}/touch-ear-react-cutout.webm`,
    loop: false,
  },
  "touch-ticklish": {
    id: "touch-ticklish",
    src: `${VIDEO_DIR}/touch-tickle-react-cutout.webm`,
    loop: false,
  },
};

export const REACTION_IDS: BunnyReactionId[] = [
  "touch-happy",
  "touch-playful",
  "touch-ear",
  "touch-ticklish",
];
