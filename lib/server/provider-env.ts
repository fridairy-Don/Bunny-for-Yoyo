import "server-only";

import { DEFAULT_BUNNY_VOICE_ID } from "../config/voice";

export type ProviderEnv = {
  openRouterApiKey?: string;
  openRouterModel: string;
  groqApiKey?: string;
  groqSttModel: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModelId: string;
  appPublicUrl?: string;
  deploymentEnv: "development" | "preview" | "production";
};

function resolveDeploymentEnv(): ProviderEnv["deploymentEnv"] {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "development" || vercelEnv === "preview" || vercelEnv === "production") {
    return vercelEnv;
  }

  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function defaultOpenRouterModel(deploymentEnv: ProviderEnv["deploymentEnv"]) {
  return deploymentEnv === "production"
    ? "google/gemini-2.5-flash"
    : "google/gemini-2.5-flash-lite";
}

function defaultGroqSttModel(deploymentEnv: ProviderEnv["deploymentEnv"]) {
  return deploymentEnv === "production" ? "whisper-large-v3" : "whisper-large-v3-turbo";
}

export function getProviderEnv(): ProviderEnv {
  const deploymentEnv = resolveDeploymentEnv();

  return {
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL || defaultOpenRouterModel(deploymentEnv),
    groqApiKey: process.env.GROQ_API_KEY,
    groqSttModel: process.env.GROQ_STT_MODEL || defaultGroqSttModel(deploymentEnv),
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_BUNNY_VOICE_ID,
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
    appPublicUrl: process.env.APP_PUBLIC_URL,
    deploymentEnv,
  };
}

export function hasOpenRouterConfig(env = getProviderEnv()) {
  return Boolean(env.openRouterApiKey && env.openRouterModel);
}

export function hasGroqConfig(env = getProviderEnv()) {
  return Boolean(env.groqApiKey && env.groqSttModel);
}

export function hasElevenLabsConfig(env = getProviderEnv()) {
  return Boolean(env.elevenLabsApiKey && env.elevenLabsVoiceId && env.elevenLabsModelId);
}

export function getOpenRouterHeaders(env = getProviderEnv()) {
  const appUrl =
    env.appPublicUrl ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || "3000"}`);

  return {
    "HTTP-Referer": appUrl,
    "X-OpenRouter-Title": "Bunny Companion",
  };
}
