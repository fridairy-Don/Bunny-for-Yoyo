import type { RecorderCapture, SpeechToTextResult } from "../types/conversation";

export type SpeechToTextClient = {
  transcribe: (capture: RecorderCapture) => Promise<SpeechToTextResult>;
};

export class ApiSpeechToTextClient implements SpeechToTextClient {
  async transcribe(capture: RecorderCapture): Promise<SpeechToTextResult> {
    const captureProblem = getCaptureProblemMessage(capture);

    if (captureProblem) {
      throw new Error(captureProblem);
    }

    const formData = new FormData();
    const file = new File([capture.blob], getRecordingFileName(capture.mimeType), {
      type: capture.mimeType,
    });

    formData.append("audio", file);

    const response = await fetch("/api/stt", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(getProviderErrorMessage(payload?.code, payload?.error));
    }

    const payload = await response.json();
    return { text: payload.text };
  }
}

function getCaptureProblemMessage(capture: RecorderCapture) {
  if (capture.problem === "unsupported") {
    return "microphone_unsupported";
  }

  if (capture.problem === "insecure_context") {
    return "microphone_insecure_context";
  }

  if (capture.problem === "permission_denied") {
    return "microphone_permission_denied";
  }

  if (capture.problem === "empty_audio") {
    return "empty_audio_capture";
  }

  if (capture.problem === "silent_audio") {
    return "silent_audio_capture";
  }

  if (capture.problem === "recorder_error") {
    return "microphone_recorder_error";
  }

  return null;
}

function getProviderErrorMessage(code?: string, fallback?: string) {
  if (code === "empty_audio_capture") {
    return "empty_audio_capture";
  }

  if (code === "stt_provider_error") {
    return "stt_provider_error";
  }

  return fallback || "transcription_request_failed";
}

function getRecordingFileName(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("mpeg")) {
    return "recording.m4a";
  }

  if (mimeType.includes("ogg")) {
    return "recording.ogg";
  }

  if (mimeType.includes("wav")) {
    return "recording.wav";
  }

  return "recording.webm";
}
