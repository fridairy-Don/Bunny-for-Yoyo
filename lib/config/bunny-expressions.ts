// Bunny expression catalog.
//
// Each expression names the parts that should render and per-part transform
// overrides. Transforms layer ON TOP of the part's static position from
// bunny-rig.ts — the rig component picks up `transform: translate(tx, ty)
// rotate(rdeg) scale(s)` and animates between expressions with a single
// CSS transition so the bunny morphs continuously, never snaps.
//
// All translateX / translateY are in canvas pixels (the same 934×1040 unit
// system bunny-rig.ts uses). Positive Y goes down, positive X goes right.
// Rotation in degrees, scale unitless.

import type { PartId } from "./bunny-rig";

export type ExpressionId =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "excited"
  | "curious"
  | "confused"
  | "shy"
  | "sleepy"
  | "tickled"
  | "petted";

export type PartTransform = {
  /** Translate X in canvas pixels. */
  tx?: number;
  /** Translate Y in canvas pixels. */
  ty?: number;
  /** Rotation in degrees, around the part's transform-origin. */
  rotate?: number;
  /** Uniform scale multiplier. */
  scale?: number;
};

export type Expression = {
  /** Which parts compose this expression (replaces IDLE_PART_IDS while active). */
  parts: ReadonlyArray<PartId>;
  /** Optional per-part transform overlays. Missing parts use identity transform. */
  transforms?: Partial<Record<PartId, PartTransform>>;
  /** CSS transition duration into this expression, in ms. Defaults to 320. */
  morphMs?: number;
};

// Helper: a complete idle parts list (matches IDLE_PART_IDS in bunny-rig.ts).
// Inlined here to avoid a circular import.
const IDLE: PartId[] = [
  "ear_left_idle",
  "ear_right_idle",
  "body_legs",
  "head",
  "arm_left",
  "arm_right",
  "cheek_swirl_left",
  "cheek_swirl_right",
  "eye_left",
  "eye_right",
  "mouth_smile_tongue",
  "flower",
];

// Variants that swap one or two parts on top of IDLE.
const swap = (replacements: Partial<Record<PartId, PartId>>): PartId[] =>
  IDLE.map((id) => replacements[id] ?? id);

// Set of parts that visually belong to the head — used by helper to apply
// a unified head tilt by giving each member the same rotate value.
const HEAD_PARTS: PartId[] = [
  "head",
  "cheek_swirl_left",
  "cheek_swirl_right",
  "eye_left",
  "eye_right",
  "blink_left",
  "blink_right",
  "mouth_closed",
  "mouth_small_open",
  "mouth_smile_tongue",
  "mouth_big_open",
  "flower",
  "ear_left_idle",
  "ear_right_idle",
  "ear_pose_top_left",
  "ear_pose_top_right",
  "ear_pose_middle_left",
  "ear_pose_middle_right",
  "ear_pose_bottom_left",
  "ear_pose_bottom_right",
];

const headTilt = (deg: number): Partial<Record<PartId, PartTransform>> => {
  const out: Partial<Record<PartId, PartTransform>> = {};
  for (const id of HEAD_PARTS) out[id] = { rotate: deg };
  return out;
};

const merge = (
  ...layers: Array<Partial<Record<PartId, PartTransform>>>
): Partial<Record<PartId, PartTransform>> => {
  const out: Partial<Record<PartId, PartTransform>> = {};
  for (const layer of layers) {
    for (const [id, tx] of Object.entries(layer) as Array<[PartId, PartTransform]>) {
      out[id] = { ...(out[id] ?? {}), ...tx };
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Expression catalog
// ---------------------------------------------------------------------------

export const EXPRESSIONS: Record<ExpressionId, Expression> = {
  // Resting state — the parts list matches the static idle composition.
  // Idle micro-motion (breathing / blinking / ear twitch) is layered on
  // top via CSS keyframes in the rig component, not via transforms here.
  idle: {
    parts: IDLE,
  },

  // Listening — Bunny is HEARING Yoyo right now (mic recording). Both ears
  // perk up, head leans forward a touch as if to catch every word, mouth
  // closes (Bunny is being quiet so Yoyo can speak).
  listening: {
    parts: swap({
      ear_left_idle: "ear_pose_top_left",
      ear_right_idle: "ear_pose_top_right",
      mouth_smile_tongue: "mouth_closed",
    }),
    transforms: merge(headTilt(0), {
      head: { rotate: 0, ty: 4 },
      eye_left: { ty: 4 },
      eye_right: { ty: 4 },
    }),
    morphMs: 240,
  },

  // Thinking — async LLM call. Asymmetric ears (one up, one to the side)
  // read as "hmm let me think." Mouth closed, slight head tilt to viewer
  // right (Bunny's left).
  thinking: {
    parts: swap({
      ear_left_idle: "ear_pose_top_left",
      ear_right_idle: "ear_pose_middle_right",
      mouth_smile_tongue: "mouth_closed",
    }),
    transforms: merge(headTilt(-4)),
    morphMs: 280,
  },

  // Speaking — TTS playing. Mouth moves via the viseme system (C6) — the
  // base parts list keeps smile_tongue but the rig swaps it dynamically
  // based on audio amplitude. Slight rhythmic head bob is added by the
  // C1 keyframes in the speaking class.
  speaking: {
    parts: IDLE,
    morphMs: 200,
  },

  // Happy — joyful resolution after a turn. Arms raised slightly, ears
  // pulled up a touch, mouth wide smile (already idle), gentle bounce.
  happy: {
    parts: IDLE,
    transforms: {
      arm_left: { rotate: -8, ty: -4 },
      arm_right: { rotate: 8, ty: -4 },
      ear_left_idle: { rotate: -3, ty: -6 },
      ear_right_idle: { rotate: 3, ty: -6 },
      head: { ty: -4 },
      body_legs: { ty: -2 },
    },
    morphMs: 260,
  },

  // Excited — keyword like "birthday" / "surprise" / "yes!". Mouth opens
  // wide, both ears spring up, arms higher, bigger bounce.
  excited: {
    parts: swap({
      ear_left_idle: "ear_pose_top_left",
      ear_right_idle: "ear_pose_top_right",
      mouth_smile_tongue: "mouth_big_open",
    }),
    transforms: {
      arm_left: { rotate: -16, ty: -8 },
      arm_right: { rotate: 16, ty: -8 },
      head: { ty: -10 },
      body_legs: { ty: -6 },
      cheek_swirl_left: { scale: 1.08 },
      cheek_swirl_right: { scale: 1.08 },
    },
    morphMs: 220,
  },

  // Curious — Bunny asked Yoyo a question, or is mid-question. Soft head
  // tilt, ears at "middle" pose, mouth closed waiting for answer.
  curious: {
    parts: swap({
      ear_left_idle: "ear_pose_middle_left",
      ear_right_idle: "ear_pose_middle_right",
      mouth_smile_tongue: "mouth_closed",
    }),
    transforms: merge(headTilt(-7)),
    morphMs: 280,
  },

  // Confused — couldn't hear / silent input / "huh?". Asymmetric: one
  // ear up, one ear down. Tiny "small open" mouth (the puzzled "oh?").
  confused: {
    parts: swap({
      ear_left_idle: "ear_pose_top_left",
      ear_right_idle: "ear_pose_bottom_right",
      mouth_smile_tongue: "mouth_small_open",
    }),
    transforms: merge(headTilt(-6)),
    morphMs: 280,
  },

  // Shy — Yoyo says something sweet ("you're pretty", "I love you").
  // Ears droop down, cheeks flush bigger, eyes close in a happy squint.
  shy: {
    parts: swap({
      ear_left_idle: "ear_pose_bottom_left",
      ear_right_idle: "ear_pose_bottom_right",
      eye_left: "blink_left",
      eye_right: "blink_right",
    }),
    transforms: {
      cheek_swirl_left: { scale: 1.2, ty: 2 },
      cheek_swirl_right: { scale: 1.2, ty: 2 },
      head: { rotate: 4, ty: 4 },
    },
    morphMs: 320,
  },

  // Sleepy — long pause, "I'm tired". Ears drop, eyes close, mouth close,
  // head sinks slightly.
  sleepy: {
    parts: swap({
      ear_left_idle: "ear_pose_bottom_left",
      ear_right_idle: "ear_pose_bottom_right",
      eye_left: "blink_left",
      eye_right: "blink_right",
      mouth_smile_tongue: "mouth_closed",
    }),
    transforms: {
      head: { ty: 6, rotate: 1 },
      body_legs: { ty: 2 },
    },
    morphMs: 480,
  },

  // Tickled — Yoyo poked / clicked Bunny. Both ears spring up, arms flail,
  // mouth opens in a giggle, big bounce.
  tickled: {
    parts: swap({
      ear_left_idle: "ear_pose_top_left",
      ear_right_idle: "ear_pose_top_right",
      mouth_smile_tongue: "mouth_big_open",
    }),
    transforms: {
      arm_left: { rotate: -22, ty: -10 },
      arm_right: { rotate: 22, ty: -10 },
      head: { ty: -8 },
      body_legs: { ty: -4 },
    },
    morphMs: 180,
  },

  // Petted — long press / slow drag on the head. Ears soften, eyes close
  // contentedly, head lifts to meet the touch.
  petted: {
    parts: swap({
      ear_left_idle: "ear_pose_bottom_left",
      ear_right_idle: "ear_pose_bottom_right",
      eye_left: "blink_left",
      eye_right: "blink_right",
    }),
    transforms: {
      cheek_swirl_left: { scale: 1.15 },
      cheek_swirl_right: { scale: 1.15 },
      head: { rotate: 2, ty: -3 },
    },
    morphMs: 360,
  },
};

// ---------------------------------------------------------------------------
// Trigger rules — how external state maps to expressions.
// ---------------------------------------------------------------------------

import type { ConversationStatus } from "../types/conversation";

/** Map conversation status to a baseline expression. */
export function expressionForStatus(status: ConversationStatus): ExpressionId {
  switch (status) {
    case "listening":
      return "listening";
    case "transcribing":
      return "thinking";
    case "thinking":
      return "thinking";
    case "speaking":
      return "speaking";
    case "error":
      return "confused";
    case "idle":
    default:
      return "idle";
  }
}

// Crude but effective: scan assistant text for emotional cues and pick the
// best-matching expression. Runs over the latest assistant turn after TTS
// starts; the speaking baseline still drives the mouth, but the BODY
// expression below it can shift to happy / excited / shy / curious.
//
// Order matters — first match wins. Excited/shy beat happy because they're
// more specific.
const KEYWORDS: Array<{ id: ExpressionId; words: RegExp }> = [
  // Excited cues — surprise, exclamations, gifts/birthday.
  { id: "excited", words: /(yay|wow|woohoo|生日|惊喜|surprise|amazing|！！|!!|哇)/i },
  // Shy cues — compliments / love.
  { id: "shy", words: /(漂亮|可爱|喜欢你|love you|pretty|cute|你真好|害羞)/i },
  // Curious cues — Bunny asks a question back.
  { id: "curious", words: /(\?|？|为什么|怎么|想不想|要不要|是不是|你呢|tell me)/i },
  // Confused cues — Bunny didn't catch it.
  { id: "confused", words: /(没听清|huh|什么|sorry|说一遍|hmm)/i },
  // Sleepy cues — late / tired.
  { id: "sleepy", words: /(困|睡|sleepy|tired|good night|晚安)/i },
  // Generic happy fallback — laughter / agreement.
  { id: "happy", words: /(haha|哈哈|嘻嘻|好的|好呀|yes|yay|开心)/i },
];

export function expressionFromText(text: string): ExpressionId | null {
  if (!text) return null;
  for (const { id, words } of KEYWORDS) {
    if (words.test(text)) return id;
  }
  return null;
}
