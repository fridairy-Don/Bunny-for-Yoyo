// Error-caption translator: maps lower-level error codes ("permission_denied",
// "silent_audio", "stt_provider_error", etc.) into child-friendly captions
// for Yoyo to see. Matches on substrings because the same underlying failure
// can surface with several different wordings depending on which layer
// reports it (recorder vs STT API vs LLM).
export function getChildFriendlyErrorCaption(error: string | null): string | null {
  if (!error) return null;
  const e = error.toLowerCase();
  if (e.includes("permission") && e.includes("denied")) {
    return "I can't hear you yet — please let the little mic listen.";
  }
  if (e.includes("silent") || e.includes("empty_audio")) {
    return "Hmm, I didn't catch that. Try saying it a little louder.";
  }
  // iPad over plain HTTP can't open the mic — Safari hides
  // navigator.mediaDevices on insecure origins. Tell the parent (not Yoyo)
  // that the URL needs to be HTTPS, instead of the misleading "try a
  // different browser" caption we used to show.
  if (e.includes("insecure") || e.includes("secure_context")) {
    return "This page needs a secure (https://) link before the mic can listen.";
  }
  if (e.includes("unsupported")) {
    return "This place doesn't have ears. Try a different browser.";
  }
  if (e.includes("recorder")) {
    return "My ears are shy. Tap the mic once more.";
  }
  if (e.includes("stt") || e.includes("transcription")) {
    return "My ears got fuzzy. Tap the mic and try again.";
  }
  if (e.includes("chat") || e.includes("llm")) {
    return "I lost my words for a second. Tap the mic and try again.";
  }
  return "Something got tangled. Let's try one more time.";
}
