import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { expectOk } from "../http";
import { getProviderEnv, hasFalConfig } from "../provider-env";

// Image-conditioned model used for the polaroid wall. Switched from Flux
// Pro Kontext to Nano Banana Edit (Google) — Flux was producing repetitive
// posed group-shot compositions across very different scenes; Nano Banana
// edits more loosely from the reference and reads action verbs in the
// prompt better, which gives the wall visible variety. Keep the model id
// locked here so prompt logic elsewhere does not need to know which Fal
// endpoint is current.
const FAL_MODEL = "fal-ai/nano-banana/edit";
const FAL_ENDPOINT = `https://fal.run/${FAL_MODEL}`;

// Bunny photo we use as the reference image. We always feed the same file so
// every polaroid in the wall feels like it stars the same plush. Lives under
// public/ already because the rest of the app loads it as a sprite.
const BUNNY_REF_PATH = path.join(
  process.cwd(),
  "public",
  "assets",
  "bunny",
  "bunny_idle.png",
);

let cachedDataUri: string | null = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — file is static, but allow refresh.

async function getBunnyReferenceDataUri(): Promise<string> {
  const now = Date.now();
  if (cachedDataUri && now - cachedAtMs < CACHE_TTL_MS) return cachedDataUri;
  const buf = await fs.readFile(BUNNY_REF_PATH);
  cachedDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  cachedAtMs = now;
  return cachedDataUri;
}

export type FalGenerationResult = {
  imageUrl: string;       // remote https URL hosted by Fal — ephemeral.
  imageBytes: Uint8Array; // downloaded body; caller persists to Storage.
  contentType: string;    // observed mime so Storage upload tags it right.
};

// Generate one polaroid image conditioned on the bunny reference. Returns
// both the remote URL and the downloaded bytes so the caller can persist
// to a long-lived bucket — Fal-hosted URLs are not durable and we do not
// want broken images in old polaroids three weeks from now.
//
// Throws on any provider failure; the route layer turns that into a
// graceful "failed" status row rather than a 500.
export async function generatePolaroidImage(prompt: string): Promise<FalGenerationResult> {
  const env = getProviderEnv();
  if (!hasFalConfig(env) || !env.falKey) {
    throw new Error("FAL_KEY is not configured.");
  }
  if (!prompt || prompt.length < 8) {
    throw new Error("Polaroid prompt is empty or too short.");
  }

  const dataUri = await getBunnyReferenceDataUri();

  // Per-request abort: Flux Pro Kontext usually returns in 6–14s. If the
  // upstream stalls we surface a clear timeout instead of hanging Vercel
  // function execution.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response: Response;
  try {
    response = await fetch(FAL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Key ${env.falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        // Nano Banana Edit takes an array of reference image URLs (we
        // pass a single data URI). It does not accept guidance_scale,
        // output_format, or aspect_ratio — keep the body minimal so the
        // model defaults apply.
        image_urls: [dataUri],
        num_images: 1,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  await expectOk(response, "Fal.ai polaroid generation failed.");
  const payload: {
    images?: Array<{ url?: string; content_type?: string }>;
    image?: { url?: string; content_type?: string };
  } = await response.json();

  const remoteUrl =
    payload?.images?.[0]?.url ?? payload?.image?.url ?? "";
  if (!remoteUrl) {
    throw new Error("Fal.ai response did not include an image URL.");
  }

  // Download the image so we can re-host on Supabase Storage. We keep the
  // bytes even if the upload fails — the route logs and marks `failed`.
  const imageRes = await fetch(remoteUrl);
  await expectOk(imageRes, "Fal.ai image download failed.");
  const arrayBuffer = await imageRes.arrayBuffer();
  const contentType =
    payload?.images?.[0]?.content_type ??
    payload?.image?.content_type ??
    imageRes.headers.get("content-type") ??
    "image/jpeg";

  return {
    imageUrl: remoteUrl,
    imageBytes: new Uint8Array(arrayBuffer),
    contentType,
  };
}
