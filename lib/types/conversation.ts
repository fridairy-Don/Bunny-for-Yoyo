export type ConversationRole = "system" | "user" | "assistant";

export type ConversationStatus =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export type ConversationTurn = {
  id: string;
  role: ConversationRole;
  text: string;
  createdAt: number;
};

export type SubtitleCue = {
  id: string;
  text: string;
  role: Exclude<ConversationRole, "system">;
};

export type RecorderCapture = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
  maxInputLevel: number;
  problem?:
    | "unsupported"
    | "insecure_context"
    | "permission_denied"
    | "empty_audio"
    | "silent_audio"
    | "recorder_error";
};

export type SpeechToTextResult = {
  text: string;
};

export type LlmReply = {
  text: string;
};

export type TtsPlaybackResult = {
  durationMs: number;
};
