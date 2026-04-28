import "server-only";

// Locked Yoyo description and style anchor. We deliberately do NOT pass a
// photo of Yoyo to the image model — the chibi cartoon brief is privacy-
// preserving and avoids the well-known "AI realistic kid faces" failure
// mode. Bunny identity comes from the reference image (bunny_idle.png),
// so we never re-describe the bunny here.
const YOYO_BRIEF =
  "a six-year-old chibi-style girl with a chin-length soft black bob haircut, big bright curious eyes, and a small gentle smile";

// Style anchor — kept warm + storybook, but explicitly clean / sharp /
// crisp lines so the model does NOT smear edges into watercolor mush.
// Earlier "dreamy hazy lighting" + "soft pastel watercolor" was reading
// as "make it blurry," which made every wall thumbnail look out of focus
// at the detail-modal size on iPad. Keeping the warm cream-and-rose
// palette but pushing the lineart cleaner.
const STYLE_ANCHOR =
  "warm storybook illustration with clean crisp lines, gentle cream and dusty pink palette, soft warm afternoon light with clear focus and visible detail, chibi proportions, no text, no realistic detailed human face.";

// Build the full image prompt for one polaroid. The interesting variety
// comes from `scene` — an LLM-generated paragraph describing a specific
// moment, camera angle, action, and small concrete detail. We only
// prepend the locked Yoyo brief (so the model has consistent identity for
// the girl) and append the style anchor (so the wall feels unified).
//
// If scene is empty we fall back to a soft hint or generic moment so the
// pipeline never produces a broken/empty prompt.
export function buildPolaroidPrompt(input: {
  scene?: string | null;
  fallbackHint?: string | null;
}): string {
  const trimmedScene = (input.scene ?? "").trim();
  const trimmedHint = (input.fallbackHint ?? "").trim();

  const sceneParagraph =
    trimmedScene.length > 0
      ? trimmedScene
      : trimmedHint.length > 0
        ? `A quiet candid moment of Yoyo and Bunny together, gently doing something tied to "${trimmedHint}", seen from a soft side angle in warm afternoon light.`
        : "A quiet candid moment of Yoyo and Bunny together, seen from a soft side angle in warm afternoon light, sharing a small tender gesture.";

  // One paragraph keeps Nano Banana Edit reading the prompt fluidly. The
  // Yoyo line goes first so identity is anchored before scene specifics;
  // style anchor closes so the visual register is the last thing the
  // model reads.
  return [
    `The girl in the scene is ${YOYO_BRIEF}.`,
    sceneParagraph,
    STYLE_ANCHOR,
  ].join(" ");
}

// Quick fallback hint extractor: takes the most recent user turn and
// trims to ~12 words. Used when neither summary nor LLM scene is
// available so the polaroid still feels tied to today's talk.
export function fallbackHintFromTurns(
  turns: Array<{ role: "user" | "assistant" | "system"; text: string }>,
): string {
  const lastUser = [...turns].reverse().find((t) => t.role === "user" && t.text?.trim());
  if (!lastUser) return "";
  const words = lastUser.text.trim().split(/\s+/).slice(0, 12);
  return words.join(" ").replace(/[.!?,;:]+$/, "");
}
