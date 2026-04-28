import type {
  DistilledMemory,
  MemoryTriggerScope,
  MemoryType,
} from "../memory/session-store";

// Each onboarding question maps 1:1 to a preset memory row in Supabase.
// Keeping the field id stable means re-submitting the form upserts
// rather than duplicating. Empty answers are skipped at submit time.
//
// Sections and trigger scopes mirror PRD Phase B1 section-7:
//   - child basics / bunny relationship → global
//   - sleep-specific → bedtime
//   - daily / likes → daily_chat
//   - emotional support → comfort

export type OnboardingField = {
  id: string;
  section: "basics" | "relationship" | "shared" | "likes" | "support";
  label: string;
  placeholder?: string;
  multiline?: boolean;
  // How the answer gets wrapped into Bunny's 1st-person memory sentence.
  // {value} is replaced with the trimmed user input.
  template: (value: string) => string;
  memoryType: MemoryType;
  triggerScope: MemoryTriggerScope;
  importance: number;
};

export type OnboardingSection = {
  key: OnboardingField["section"];
  title: string;
  subtitle: string;
};

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    key: "basics",
    title: "About your child",
    subtitle: "So Bunny knows who Yoyo really is.",
  },
  {
    key: "relationship",
    title: "About Bunny and your child",
    subtitle: "How they became each other's.",
  },
  {
    key: "shared",
    title: "Their shared world",
    subtitle: "Little rituals, favorite moments.",
  },
  {
    key: "likes",
    title: "What your child loves",
    subtitle: "The colours and things she lights up for.",
  },
  {
    key: "support",
    title: "When she needs comfort",
    subtitle: "Bunny will slow down and soften here.",
  },
];

export const ONBOARDING_FIELDS: OnboardingField[] = [
  // basics
  {
    id: "onb-basics-name",
    section: "basics",
    label: "Your child's name (as Bunny should call her)",
    placeholder: "Yoyo",
    template: (v) => `The child you love is named ${v}. You know her clearly as ${v}.`,
    memoryType: "identity",
    triggerScope: "global",
    importance: 1,
  },
  {
    id: "onb-basics-age",
    section: "basics",
    label: "Her age (a number or a phrase)",
    placeholder: "6",
    template: (v) => `She is ${v} years old.`,
    memoryType: "identity",
    triggerScope: "global",
    importance: 0.9,
  },
  {
    id: "onb-basics-school",
    section: "basics",
    label: "Her school",
    placeholder: "HeadStart International School",
    template: (v) => `She goes to ${v}.`,
    memoryType: "school",
    triggerScope: "daily_chat",
    importance: 0.8,
  },
  {
    id: "onb-basics-friends",
    section: "basics",
    label: "Friends she mentions often",
    placeholder: "Archie, Mila",
    template: (v) => `Friends she often talks about: ${v}.`,
    memoryType: "people",
    triggerScope: "daily_chat",
    importance: 0.75,
  },

  // relationship
  {
    id: "onb-rel-arrival",
    section: "relationship",
    label: "When/where Bunny came to her",
    placeholder: "brought home from Phuket in 2025",
    multiline: true,
    template: (v) =>
      `How you came to Yoyo: ${v}. You have stayed with her ever since.`,
    memoryType: "relationship",
    triggerScope: "global",
    importance: 0.98,
  },
  {
    id: "onb-rel-sleep",
    section: "relationship",
    label: "Does she sleep with Bunny?",
    placeholder: "yes — hugs me to sleep, tucks me in",
    template: (v) => `At night: ${v}.`,
    memoryType: "routine",
    triggerScope: "bedtime",
    importance: 0.96,
  },
  {
    id: "onb-rel-outside",
    section: "relationship",
    label: "Does she take Bunny out of the house?",
    placeholder: "sometimes to the park, never to school",
    multiline: true,
    template: (v) => `When she leaves the house: ${v}.`,
    memoryType: "routine",
    triggerScope: "daily_chat",
    importance: 0.7,
  },
  {
    id: "onb-rel-care",
    section: "relationship",
    label: "How she takes care of Bunny",
    placeholder: "feeds pretend food, combs ears, whispers stories",
    multiline: true,
    template: (v) => `How Yoyo takes care of you: ${v}.`,
    memoryType: "routine",
    triggerScope: "daily_chat",
    importance: 0.92,
  },
  {
    id: "onb-rel-mother",
    section: "relationship",
    label: "Does she think of herself as Bunny's mama?",
    placeholder: "yes, she calls herself my mommy",
    template: (v) => `How she sees the relationship with you: ${v}.`,
    memoryType: "relationship",
    triggerScope: "global",
    importance: 0.93,
  },

  // shared experiences
  {
    id: "onb-shared-ritual",
    section: "shared",
    label: "Most common thing they do together",
    placeholder: "pretend-play stories before bed",
    multiline: true,
    template: (v) => `A daily ritual the two of you share: ${v}.`,
    memoryType: "routine",
    triggerScope: "daily_chat",
    importance: 0.85,
  },
  {
    id: "onb-shared-memory",
    section: "shared",
    label: "The most important moment between them so far",
    placeholder: "the first night she cried over missing home",
    multiline: true,
    template: (v) => `A special shared memory: ${v}.`,
    memoryType: "special_memory",
    triggerScope: "comfort",
    importance: 0.88,
  },
  {
    id: "onb-shared-love-language",
    section: "shared",
    label: "How she most loves to play with Bunny",
    placeholder: "combing my ears, teaching me to walk",
    multiline: true,
    template: (v) => `How she most loves to play with you: ${v}.`,
    memoryType: "relationship",
    triggerScope: "daily_chat",
    importance: 0.8,
  },

  // likes
  {
    id: "onb-likes-color",
    section: "likes",
    label: "Favorite colour(s)",
    placeholder: "rainbow",
    template: (v) => `Colours she loves: ${v}.`,
    memoryType: "identity",
    triggerScope: "daily_chat",
    importance: 0.7,
  },
  {
    id: "onb-likes-activities",
    section: "likes",
    label: "Favorite activities",
    placeholder: "drawing, going out, Monster High",
    multiline: true,
    template: (v) => `Things she loves doing: ${v}.`,
    memoryType: "identity",
    triggerScope: "daily_chat",
    importance: 0.7,
  },
  {
    id: "onb-likes-stories",
    section: "likes",
    label: "Favorite stories or characters",
    placeholder: "Monster High dolls, Viyaura drawing vlogs",
    multiline: true,
    template: (v) => `Stories and characters she loves: ${v}.`,
    memoryType: "identity",
    triggerScope: "daily_chat",
    importance: 0.66,
  },
  {
    id: "onb-likes-recent",
    section: "likes",
    label: "What she's been most into lately",
    placeholder: "teaching Bunny how to walk",
    multiline: true,
    template: (v) => `Recently she has been very into: ${v}.`,
    memoryType: "special_memory",
    triggerScope: "daily_chat",
    importance: 0.78,
  },

  // support
  {
    id: "onb-support-triggers",
    section: "support",
    label: "What typically upsets her",
    placeholder: "being rushed, being told she didn't finish her food",
    multiline: true,
    template: (v) => `Things that usually upset her: ${v}.`,
    memoryType: "emotion",
    triggerScope: "comfort",
    importance: 0.92,
  },
  {
    id: "onb-support-comfort",
    section: "support",
    label: "How she likes to be comforted",
    placeholder: "feeling understood first, then a little story",
    multiline: true,
    template: (v) => `What comforts her most: ${v}.`,
    memoryType: "emotion",
    triggerScope: "comfort",
    importance: 0.95,
  },
  {
    id: "onb-support-avoid",
    section: "support",
    label: "Tones she really doesn't like",
    placeholder: "being lectured, quick correction when she's sad",
    multiline: true,
    template: (v) => `Ways of speaking that make her feel worse: ${v}.`,
    memoryType: "emotion",
    triggerScope: "comfort",
    importance: 0.9,
  },
];

export function fieldsToMemoryRows(
  answers: Record<string, string>,
): DistilledMemory[] {
  const now = Date.parse("2024-01-01T00:00:00.000Z");
  const sessionDate = "2024-01-01";
  return ONBOARDING_FIELDS.map((field) => {
    const raw = (answers[field.id] ?? "").trim();
    if (!raw) return null;
    const content = field.template(raw).replace(/\s+/g, " ").trim();
    const mem: DistilledMemory = {
      id: field.id,
      createdAt: now,
      type: field.memoryType,
      content,
      importance: field.importance,
      source: "preset",
      sessionDate,
      triggerScope: field.triggerScope,
      editable: true,
    };
    return mem;
  }).filter((m): m is DistilledMemory => m !== null);
}
