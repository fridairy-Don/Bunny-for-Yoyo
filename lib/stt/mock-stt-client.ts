import { MOCK_USER_UTTERANCES } from "../config/character";
import type { RecorderCapture, SpeechToTextResult } from "../types/conversation";

export type SpeechToTextClient = {
  transcribe: (capture: RecorderCapture) => Promise<SpeechToTextResult>;
};

export class MockSpeechToTextClient implements SpeechToTextClient {
  async transcribe(_capture: RecorderCapture): Promise<SpeechToTextResult> {
    const sample =
      MOCK_USER_UTTERANCES[Math.floor(Math.random() * MOCK_USER_UTTERANCES.length)] ??
      "Hi Bunny.";

    await new Promise((resolve) => setTimeout(resolve, 450));

    return { text: sample };
  }
}
