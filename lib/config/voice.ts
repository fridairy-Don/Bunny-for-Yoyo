export const DEFAULT_BUNNY_VOICE_ID = "ocZQ262SsZb9RIxcQBOj";

export const BUNNY_TTS_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  use_speaker_boost: true,
  style: 0.48,
  speed: 0.9,
} as const;

export const BUNNY_VOICE_PROFILE = {
  voiceId: DEFAULT_BUNNY_VOICE_ID,
  voiceName: "Lulu Lolipop - High-Pitched and Bubbly",
  designGoal: "cute, animated, magical, soft, and slightly slower for child-facing listening",
} as const;
