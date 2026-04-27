"use client";

import type { RecorderCapture } from "../types/conversation";

export type AudioRecorder = {
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<RecorderCapture>;
};

class BrowserAudioRecorder implements AudioRecorder {
  isSupported =
    typeof navigator !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;
  private mimeType = "audio/webm";
  private startProblem: RecorderCapture["problem"] | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  private maxInputLevel = 0;

  async start() {
    if (!this.isSupported) {
      this.startedAt = Date.now();
      // iOS Safari (and modern Chrome) only expose navigator.mediaDevices
      // on secure origins — HTTPS or localhost. When Yoyo opens the LAN
      // dev URL on an iPad over plain HTTP, getUserMedia is silently
      // missing, which used to surface as "try a different browser".
      // The fix is HTTPS, not a different browser, so distinguish the
      // two cases here and let the caption layer say the right thing.
      const insecure =
        typeof window !== "undefined" &&
        window.isSecureContext === false &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";
      this.startProblem = insecure ? "insecure_context" : "unsupported";
      debugAudio("start_unsupported", {
        ...getAudioCapabilitySnapshot(),
        problem: this.startProblem,
      });
      throw new Error(
        insecure ? "microphone_insecure_context" : "microphone_unsupported",
      );
    }

    try {
      // Disable echoCancellation / autoGainControl / noiseSuppression:
      // each of those flips the browser into a voice-call audio session which
      // briefly ducks or pauses HTMLAudioElement playback when the mic
      // opens/closes — users hear background music stutter on every record
      // start/stop. Whisper handles the slightly rawer input fine.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
      this.chunks = [];
      this.startedAt = Date.now();
      this.startProblem = null;
      this.maxInputLevel = 0;
      this.startLevelMeter(this.stream);
      this.mimeType = pickSupportedMimeType();
      this.mediaRecorder = this.mimeType
        ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
        : new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      this.mediaRecorder.start(250);
      debugAudio("start_ok", {
        ...getAudioCapabilitySnapshot(),
        mimeType: this.mediaRecorder.mimeType || this.mimeType || "browser-default",
        tracks: this.stream.getAudioTracks().map((track) => ({
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
        })),
      });
    } catch (cause) {
      this.startedAt = Date.now();
      this.mediaRecorder = null;
      this.cleanupStream();
      this.chunks = [];
      this.mimeType = "audio/webm";
      this.startProblem = isPermissionError(cause) ? "permission_denied" : "recorder_error";
      debugAudio("start_error", {
        ...getAudioCapabilitySnapshot(),
        problem: this.startProblem,
        errorName: cause instanceof DOMException ? cause.name : getErrorName(cause),
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      });
      throw new Error(this.startProblem);
    }
  }

  async stop() {
    if (!this.mediaRecorder) {
      return {
        blob: new Blob([], { type: "audio/webm" }),
        durationMs: Math.max(Date.now() - this.startedAt, 1200),
        mimeType: "audio/webm",
        maxInputLevel: this.maxInputLevel,
        problem: this.startProblem ?? "empty_audio",
      };
    }

    const recorder = this.mediaRecorder;

    return await new Promise<RecorderCapture>((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || this.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: mimeType });
        const problem = getCaptureProblem(blob, this.maxInputLevel);

        this.mediaRecorder = null;
        this.cleanupStream();
        this.chunks = [];
        this.mimeType = "audio/webm";
        this.startProblem = null;

        debugAudio("stop", {
          durationMs: Math.max(Date.now() - this.startedAt, 1200),
          maxInputLevel: this.maxInputLevel,
          mimeType,
          problem,
          size: blob.size,
        });

        resolve({
          blob,
          durationMs: Math.max(Date.now() - this.startedAt, 1200),
          mimeType,
          maxInputLevel: this.maxInputLevel,
          ...(problem ? { problem } : {}),
        });
      };

      recorder.stop();
    });
  }

  private startLevelMeter(stream: MediaStream) {
    this.stopLevelMeter();

    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    this.audioContext = new AudioContextCtor();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.sourceNode.connect(this.analyser);

    const samples = new Uint8Array(this.analyser.fftSize);

    this.levelTimer = setInterval(() => {
      if (!this.analyser) {
        return;
      }

      this.analyser.getByteTimeDomainData(samples);
      let sum = 0;

      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }

      this.maxInputLevel = Math.max(this.maxInputLevel, Math.sqrt(sum / samples.length));
    }, 120);
  }

  private stopLevelMeter() {
    if (this.levelTimer) {
      clearInterval(this.levelTimer);
      this.levelTimer = null;
    }

    this.sourceNode?.disconnect();
    this.analyser?.disconnect();
    void this.audioContext?.close().catch(() => undefined);
    this.sourceNode = null;
    this.analyser = null;
    this.audioContext = null;
  }

  private cleanupStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.stopLevelMeter();
  }
}

export function createAudioRecorder(): AudioRecorder {
  return new BrowserAudioRecorder();
}

function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function isPermissionError(cause: unknown) {
  return cause instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(cause.name);
}

function getCaptureProblem(blob: Blob, maxInputLevel: number): RecorderCapture["problem"] | null {
  if (blob.size === 0) {
    return "empty_audio";
  }

  if (maxInputLevel < 0.006) {
    return "silent_audio";
  }

  return null;
}

function getAudioCapabilitySnapshot() {
  return {
    hasNavigator: typeof navigator !== "undefined",
    hasMediaDevices: typeof navigator !== "undefined" && !!navigator.mediaDevices,
    hasGetUserMedia:
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    hasMediaRecorder: typeof MediaRecorder !== "undefined",
    secureContext: typeof window !== "undefined" && window.isSecureContext,
    protocol: typeof window !== "undefined" ? window.location.protocol : "unknown",
  };
}

function getErrorName(cause: unknown) {
  return cause instanceof Error ? cause.name : typeof cause;
}

function debugAudio(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.info(`[bunny-audio] ${event} ${JSON.stringify(payload)}`);
}
