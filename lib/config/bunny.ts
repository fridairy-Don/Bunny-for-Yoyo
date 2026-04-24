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

export const randomBlinkDelay = () => 4000 + Math.random() * 4000;
