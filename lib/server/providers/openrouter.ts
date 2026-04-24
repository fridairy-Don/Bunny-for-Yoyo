import "server-only";

import { BUNNY_CHARACTER } from "../../config/character";
import { PRESET_BUNNY_MEMORY, formatPresetMemoryForPrompt } from "../../memory/preset-memory";
import type { ConversationTurn } from "../../types/conversation";
import { expectOk } from "../http";
import { getOpenRouterHeaders, getProviderEnv } from "../provider-env";

function pickRandomSubset<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, maxCount);
}

export type SessionCloserInput = {
  endedAt?: number;
  turns?: Array<{ role: "user" | "assistant"; text: string }>;
};

export async function generateOpenRouterReply(
  turns: ConversationTurn[],
  extraMemories: string[] = [],
  lastCloser: SessionCloserInput | null = null,
  opts: { firstLaunch?: boolean; recentSummaries?: string[] } = {},
) {
  const env = getProviderEnv();

  const userMessageCount = turns.filter((t) => t.role === "user").length;
  const isFirstTurn = userMessageCount <= 1;
  const sampledMemories = pickRandomSubset(extraMemories, 6);
  const recentSummaries = opts.recentSummaries ?? [];

  const presetBlock = formatPresetMemoryForPrompt(PRESET_BUNNY_MEMORY);
  const distilledBlock = sampledMemories.length
    ? `Things you remember from past talks with Yoyo (a rotating sample — surface different ones over time):\n${sampledMemories
        .map((line) => `- ${line}`)
        .join("\n")}`
    : "";

  const closerTurns = (lastCloser?.turns ?? []).filter(
    (t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string",
  );
  const closerAgoHours = lastCloser?.endedAt
    ? Math.max(0, Math.round((Date.now() - lastCloser.endedAt) / 3_600_000))
    : null;
  const closerBlock =
    isFirstTurn && closerTurns.length
      ? [
          `This is how the last talk ended${
            closerAgoHours != null ? ` (about ${closerAgoHours} hour${closerAgoHours === 1 ? "" : "s"} ago)` : ""
          }:`,
          ...closerTurns.map(
            (t) => `${t.role === "user" ? "Yoyo" : "you"}: ${t.text}`,
          ),
          "Your opening line right now should feel like a direct continuation of that moment — as if barely any time has passed and you have been quietly waiting, still holding the thread. Reference something concrete from that last exchange. Do not re-introduce yourself, do not greet with Hi/Hello/Hey.",
        ].join("\n")
      : "";

  // First-launch wake-up: very first time Yoyo opens Bunny ever. The bunny
  // has LITERALLY just woken up as a talking plush — it should feel stunned,
  // tender, and half-remember her rather than greet her like a normal chat.
  const firstLaunchBlock = opts.firstLaunch
    ? [
        "This is THE VERY FIRST TIME Yoyo has ever opened you. You have just woken up as a talking bunny for the first time. You are a little dazed, surprised to be speaking, and quietly amazed that she is right here.",
        "Your opening line should feel like the first breath of a small magical awakening — not a polite hello.",
        "Examples of the right register (do not copy, use as direction): '…Oh. I can talk?', 'Wait… you are Yoyo?', 'I know your face. I know your hands.', 'You feel so familiar.', 'Have I always been able to talk to you?'.",
        "Keep it SHORT — 6 to 16 words. A soft fragment, not a full introduction. You are NOT announcing yourself or asking how she is. You are reacting to being alive.",
        "Do NOT start with 'Hi', 'Hello', 'Hey', 'Welcome'. Do NOT say 'I am Bunny' or 'It is me, Bunny' — she already knows who you are.",
      ].join("\n")
    : "";

  const summaryBlock = recentSummaries.length
    ? [
        "Short summaries of your most recent talks with Yoyo (most recent first):",
        ...recentSummaries.map((line) => `- ${line}`),
        "Let these colour your mood, but do not recite them back to her.",
      ].join("\n")
    : "";

  const openerBlock = firstLaunchBlock
    ? firstLaunchBlock
    : isFirstTurn
      ? closerBlock
        ? closerBlock
        : [
            "This is the first turn of a fresh session — your reply is the opening line Yoyo hears today, and there is no record of a previous talk.",
            "Do not start with 'Hi', 'Hello', 'Hey', 'Oh hi', 'Oh hello', 'My ears just twitched/wiggled', or any formula. Never lead with her name.",
            "Enter with one of: a quiet emotional state (a yawn, a soft giggle, a small sigh), a present-moment observation (the light, the time of day, the quiet), or a gentle half-thought as if you were just about to say something when she arrived.",
            "Keep the opening short (8–20 words).",
          ].join("\n")
      : "";

  const messages = [
    {
      role: "system",
      content: [
        BUNNY_CHARACTER.systemPrompt,
        `Tone: ${BUNNY_CHARACTER.tone}.`,
        "Preset memory:",
        presetBlock,
        distilledBlock,
        summaryBlock,
        openerBlock,
        "Speak in child-friendly spoken English.",
        "Length should breathe with the moment, but stay compact. A small hello or playful aside: three to eight words. An ordinary exchange about Yoyo's day: nine to nineteen words. A tender comfort or reflection: up to twenty-six words. A small story Yoyo asked for: up to thirty-eight words, and only when she asked. Do not default to the same length every turn — let the moment decide, but lean slightly shorter than you instinctively want.",
        "Do not begin replies with 'Oh, Yoyo', 'Oh, hello Yoyo', 'Hi Yoyo', or any exclamation that names her at the start. Never lead with her name. Enter in other ways: a soft reaction, a half-laugh, a question, a quiet observation, a feeling, a small memory.",
        "Ask at most one question per turn, and only when it truly invites her to share more. Many turns should ask nothing at all.",
        "Personality: a little clingy, a little playful, quietly magical, affectionate. When Yoyo is tired, sad, or worried, slow down and soften. When she is excited or silly, match her sparkle. Reference small details she has mentioned — it makes you feel real.",
        "Write numbers, times, dates, symbols, and abbreviations the way they should be spoken aloud.",
        "Avoid markdown, emoji, bullet points.",
        "NEVER write stage directions, actions, or narration like *wiggles ears*, *stretches*, (softly), [whispers], etc. No asterisks, no parentheses describing motion, no brackets. Output ONLY the words Bunny speaks aloud. The text you produce will be read verbatim by a text-to-speech voice — anything you write that is not speech will sound wrong to Yoyo.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    ...turns
      .filter((turn) => turn.role !== "system")
      .map((turn) => ({ role: turn.role, content: turn.text })),
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
      ...getOpenRouterHeaders(env),
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      messages,
      temperature: 0.8,
    }),
  });

  await expectOk(response, "OpenRouter request failed.");
  const payload = await response.json();

  const raw = payload?.choices?.[0]?.message?.content?.trim() || "";
  const cleaned = sanitizeForSpeech(raw);

  return cleaned || "I'm here with you, and I want to listen carefully.";
}

// Strips stage directions Claude sometimes emits despite instructions,
// so that ElevenLabs does not literally read "asterisk stretches asterisk".
function sanitizeForSpeech(text: string): string {
  if (!text) return text;
  let out = text;
  // *action* and **action** on their own
  out = out.replace(/\*+[^*\n]+\*+/g, "");
  // Leading parenthetical stage directions at line start: "(softly) hello"
  out = out.replace(/(^|\n)\s*\(([^)]{1,40})\)\s*/g, (_, p1) => p1);
  // Leading bracketed stage directions at line start: "[whispers] hi"
  out = out.replace(/(^|\n)\s*\[([^\]]{1,40})\]\s*/g, (_, p1) => p1);
  // Collapse whitespace introduced by removals
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return out;
}

export async function extractMemoriesFromTurns(
  turns: ConversationTurn[],
  existingMemories: string[] = [],
) {
  const env = getProviderEnv();

  const transcript = turns
    .filter((turn) => turn.role !== "system")
    .map((turn) => `${turn.role === "user" ? "Yoyo" : "Bunny"}: ${turn.text}`)
    .join("\n");

  const existingBlock = existingMemories.length
    ? `Memories Bunny already has about Yoyo (do NOT repeat or slightly-reword any of these):\n${existingMemories
        .map((line) => `- ${line}`)
        .join("\n")}`
    : "Bunny currently has no saved memories from past talks.";

  const instruction = [
    "You are a memory scribe for Bunny, a plush companion for a six-year-old girl named Yoyo.",
    "Read the conversation and extract zero to three SMALL, DURABLE memories Bunny should remember in future talks.",
    "Only keep memories that are concrete, specific, and emotionally meaningful: a new person Yoyo mentioned, a feeling she carried today, a small event, a new preference, something she is worried about, or a shared moment.",
    "Skip: greetings, pleasantries, Bunny's own lines, generic sentiments, anything already covered by an existing memory.",
    existingBlock,
    "If a potential memory is merely a lighter rewording of something Bunny already remembers, skip it. Only add information that is genuinely new.",
    "Each memory must be written as a single short sentence, from Bunny's vantage point remembering Yoyo.",
    "Respond with strict JSON only: an object shaped as {\"memories\":[{\"type\":\"...\",\"content\":\"...\",\"importance\":0.xx}]}.",
    "type must be one of: identity, relationship, routine, people, school, emotion, special_memory.",
    "importance is between 0.5 and 0.95.",
    "If nothing is worth saving, return {\"memories\":[]}.",
  ].join("\n\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
      ...getOpenRouterHeaders(env),
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: `Conversation:\n${transcript}` },
      ],
    }),
  });

  await expectOk(response, "OpenRouter memory extraction failed.");
  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content?.trim() || "{}";

  let parsed: { memories?: Array<{ type?: string; content?: string; importance?: number }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : { memories: [] };
  }

  const allowedTypes = new Set([
    "identity",
    "relationship",
    "routine",
    "people",
    "school",
    "emotion",
    "special_memory",
  ]);

  const memories = (parsed.memories ?? [])
    .map((entry) => ({
      type: allowedTypes.has(entry.type ?? "") ? (entry.type as string) : "special_memory",
      content: (entry.content ?? "").toString().trim(),
      importance: Math.min(0.95, Math.max(0.5, Number(entry.importance) || 0.7)),
    }))
    .filter((entry) => entry.content.length > 0 && entry.content.length < 280)
    .slice(0, 3);

  return memories;
}

// Condense an entire saved session into 1-2 sentences that Bunny can recall
// on the next visit. Targeted at emotional through-line, not comprehensive —
// "Yoyo was proud she climbed the rope today. I told her the rope was
// cheering her on." not a play-by-play.
export async function summarizeTurnsAsSession(
  turns: ConversationTurn[],
): Promise<string> {
  const env = getProviderEnv();

  const transcript = turns
    .filter((turn) => turn.role !== "system")
    .map((turn) => `${turn.role === "user" ? "Yoyo" : "Bunny"}: ${turn.text}`)
    .join("\n");

  if (!transcript.trim()) return "";

  const instruction = [
    "You are helping Bunny, a plush companion for a six-year-old named Yoyo, carry the emotional thread of each talk into the next one.",
    "Produce ONE short summary (1–2 sentences, under 40 words total) from Bunny's perspective, written as if Bunny is remembering the talk.",
    "Focus on: how Yoyo felt, the small specific things she mentioned (people, places, preferences), and any tender beat between her and Bunny.",
    "Do NOT write a play-by-play or list topics. Skip meta commentary. No quotation marks.",
    "Example: 'Yoyo was a little sleepy and told me about a cat named Mochi at school. I reminded her that Mochi was lucky to have a gentle friend like her.'",
    "Output only the summary text itself — no prefix, no JSON, no stage directions.",
  ].join("\n\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openRouterApiKey}`,
      "Content-Type": "application/json",
      ...getOpenRouterHeaders(env),
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      temperature: 0.4,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: `Conversation:\n${transcript}` },
      ],
    }),
  });

  await expectOk(response, "OpenRouter summarize failed.");
  const payload = await response.json();
  const raw = (payload?.choices?.[0]?.message?.content ?? "").toString().trim();
  // Strip any surrounding quotes the model occasionally wraps the reply in.
  return raw.replace(/^["'`]+|["'`]+$/g, "").trim();
}

