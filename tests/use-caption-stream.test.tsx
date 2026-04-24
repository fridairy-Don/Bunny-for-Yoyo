import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCaptionStream } from "../lib/conversation/use-caption-stream";
import type { SubtitleCue } from "../lib/types/conversation";

describe("useCaptionStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle with no displayed turn", () => {
    const { result } = renderHook(() =>
      useCaptionStream(null, "idle"),
    );
    expect(result.current.displayedTurn).toBeNull();
    expect(result.current.captionPhase).toBe("idle");
  });

  it("enters a new subtitle immediately when nothing is displayed", () => {
    const cue: SubtitleCue = { id: "a1", role: "assistant", text: "hello" };
    const { result } = renderHook(
      ({ subtitle, status }: { subtitle: SubtitleCue | null; status: string }) =>
        useCaptionStream(subtitle, status),
      { initialProps: { subtitle: cue, status: "speaking" } },
    );
    expect(result.current.displayedTurn?.id).toBe("a1");
    expect(result.current.captionPhase).toBe("entering");
  });

  it("transitions exiting → entering when subtitle id changes", () => {
    const first: SubtitleCue = { id: "a1", role: "assistant", text: "first" };
    const second: SubtitleCue = { id: "a2", role: "assistant", text: "second" };

    const { result, rerender } = renderHook(
      ({ subtitle, status }: { subtitle: SubtitleCue | null; status: string }) =>
        useCaptionStream(subtitle, status),
      { initialProps: { subtitle: first, status: "speaking" } },
    );

    rerender({ subtitle: second, status: "speaking" });
    expect(result.current.captionPhase).toBe("exiting");
    expect(result.current.displayedTurn?.id).toBe("a1");

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.displayedTurn?.id).toBe("a2");
    expect(result.current.captionPhase).toBe("entering");
  });

  it("retires displayed turn when status flips to listening", () => {
    const cue: SubtitleCue = { id: "a1", role: "assistant", text: "hi" };
    const { result, rerender } = renderHook(
      ({ subtitle, status }: { subtitle: SubtitleCue | null; status: string }) =>
        useCaptionStream(subtitle, status),
      { initialProps: { subtitle: cue, status: "speaking" } },
    );
    expect(result.current.displayedTurn?.id).toBe("a1");

    rerender({ subtitle: cue, status: "listening" });
    expect(result.current.captionPhase).toBe("exiting");

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.displayedTurn).toBeNull();
    expect(result.current.captionPhase).toBe("idle");
  });

  it("clear() resets state immediately", () => {
    const cue: SubtitleCue = { id: "a1", role: "assistant", text: "hi" };
    const { result } = renderHook(() => useCaptionStream(cue, "speaking"));
    expect(result.current.displayedTurn?.id).toBe("a1");

    act(() => {
      result.current.clear();
    });
    expect(result.current.displayedTurn).toBeNull();
    expect(result.current.captionPhase).toBe("idle");
  });
});
