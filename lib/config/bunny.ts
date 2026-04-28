export type BunnyVisualState = "idle" | "blink" | "speaking" | "happy" | "ear_react";

export type InteractionState = "idle" | "listening" | "speaking";

export type MomentaryState = Extract<BunnyVisualState, "blink" | "happy" | "ear_react">;

export const BUNNY_IMAGES: Record<Exclude<BunnyVisualState, "speaking"> | "speak", string> = {
  idle: "/assets/bunny/bunny_idle.png",
  blink: "/assets/bunny/bunny_blink.png",
  speak: "/assets/bunny/bunny_speak.png",
  happy: "/assets/bunny/bunny_happy.png",
  ear_react: "/assets/bunny/bunny_ear_react.png",
};

// Shorter idle beats between blinks so Bunny feels more alive.
export const randomBlinkDelay = () => 2500 + Math.random() * 2500;

// Probability weights for click-reaction states. Must sum to 1.0.
export const CLICK_REACTION_WEIGHTS = {
  ear_react: 0.4,
  blink: 0.25,
  happy: 0.2,
  ear_then_happy: 0.15,
} as const;

export type ClickReaction = keyof typeof CLICK_REACTION_WEIGHTS;

export function pickClickReaction(): ClickReaction {
  const r = Math.random();
  let acc = 0;
  for (const key of Object.keys(CLICK_REACTION_WEIGHTS) as ClickReaction[]) {
    acc += CLICK_REACTION_WEIGHTS[key];
    if (r < acc) return key;
  }
  return "ear_react";
}
