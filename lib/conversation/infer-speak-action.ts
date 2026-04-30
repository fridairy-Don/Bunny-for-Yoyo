// Pick which speaking loop the bunny should play given the assistant's
// reply text. Two outcomes for now — neutral or happy — matching the two
// video loops we have. Designed to be replaceable: when the LLM starts
// returning a structured `{ emotion, action }` field, this whole module
// becomes a one-line fallback.
//
// Detection is intentionally generous on the happy side: kids respond to
// energy, and the "neutral" speaking loop is the safe default if nothing
// triggers. False positives (showing happy_speaking on a calm reply) are
// far less bad than false negatives (showing neutral on a celebration).

const HAPPY_KEYWORDS_LOWER = [
  // English praise / excitement
  "yay",
  "yes!",
  "wow",
  "amazing",
  "wonderful",
  "fantastic",
  "great job",
  "so proud",
  "love it",
  "love you",
  "awesome",
  "brilliant",
  "incredible",
  "hooray",
  "cheer",
  "happy",
  // Chinese praise / excitement / affection
  "棒",
  "厉害",
  "真好",
  "太好",
  "太棒",
  "好棒",
  "好厉害",
  "我爱你",
  "爱你",
  "亲亲",
  "抱抱",
  "开心",
  "好开心",
  "高兴",
  "兴奋",
  "好乖",
  "真乖",
  "了不起",
  "做得好",
  "完美",
];

// Emoji-style markers that strongly imply a happy reaction.
const HAPPY_EMOJI = ["❤", "💖", "✨", "🌸", "🎉", "🌈", "🥰", "😍", "🥳", "💕"];

export type SpeakAction = "speaking" | "happy_speaking";

export function inferSpeakAction(text: string | null | undefined): SpeakAction {
  if (!text) return "speaking";
  const lower = text.toLowerCase();

  // Strong signal: emoji.
  for (const e of HAPPY_EMOJI) {
    if (text.includes(e)) return "happy_speaking";
  }

  // Multi-exclamation often = excitement ("yes!!", "好棒！！！").
  if (/!!|！！/.test(text)) return "happy_speaking";

  // Keyword scan.
  for (const kw of HAPPY_KEYWORDS_LOWER) {
    if (lower.includes(kw.toLowerCase())) return "happy_speaking";
  }

  return "speaking";
}
