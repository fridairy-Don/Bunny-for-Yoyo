import { describe, it, expect } from "vitest";
import { getChildFriendlyErrorCaption } from "../lib/conversation/error-caption";

describe("getChildFriendlyErrorCaption", () => {
  it("returns null for empty error", () => {
    expect(getChildFriendlyErrorCaption(null)).toBeNull();
    expect(getChildFriendlyErrorCaption("")).toBeNull();
  });

  it("maps permission denied variants", () => {
    expect(getChildFriendlyErrorCaption("microphone_permission_denied")).toMatch(
      /let the little mic listen/,
    );
    expect(getChildFriendlyErrorCaption("Permission Denied")).toMatch(
      /let the little mic listen/,
    );
  });

  it("maps silent / empty audio", () => {
    expect(getChildFriendlyErrorCaption("silent_audio_capture")).toMatch(
      /didn't catch that/,
    );
    expect(getChildFriendlyErrorCaption("empty_audio")).toMatch(/didn't catch that/);
  });

  it("maps STT / transcription", () => {
    expect(getChildFriendlyErrorCaption("stt_provider_error")).toMatch(/fuzzy/);
    expect(getChildFriendlyErrorCaption("transcription_failed")).toMatch(/fuzzy/);
  });

  it("maps insecure-context (HTTP on iPad) to an HTTPS hint", () => {
    expect(getChildFriendlyErrorCaption("microphone_insecure_context")).toMatch(
      /https/,
    );
  });

  it("maps LLM errors", () => {
    expect(getChildFriendlyErrorCaption("chat_request_failed")).toMatch(/lost my words/);
    expect(getChildFriendlyErrorCaption("llm_500")).toMatch(/lost my words/);
  });

  it("falls back to a generic line", () => {
    expect(getChildFriendlyErrorCaption("something_weird")).toMatch(
      /Something got tangled/,
    );
  });
});
