import { createClient } from "@supabase/supabase-js";

import { generatePolaroidImage } from "../../../lib/server/providers/fal";
import { generatePolaroidScene } from "../../../lib/server/providers/openrouter";
import { buildPolaroidPrompt, fallbackHintFromTurns } from "../../../lib/server/polaroid-prompt";
import { hasFalConfig } from "../../../lib/server/provider-env";
import type { ConversationTurn } from "../../../lib/types/conversation";

export const runtime = "nodejs";
// Image generation can take ~15s; the platform default of 300s is plenty,
// but we set this defensively in case a regional gateway shortens it.
export const maxDuration = 60;

const FAMILY_ID = "yoyo-family";
const PIN_COLORS = ["rose", "sun", "sky", "mint", "lilac"] as const;

type Body = {
  sessionId?: string | null;
  sessionDate?: string | null;     // YYYY-MM-DD
  summary?: string | null;
  turns?: ConversationTurn[];
};

// Cheap deterministic-ish jitter so a freshly-generated polaroid lands on
// the wall with a slight tilt and offset, but the values stay stable in
// the DB so the wall does not shimmer between reloads. Random is fine
// here — we persist the result, no need for a hash.
function randomLayout() {
  return {
    tilt: Math.round((Math.random() * 12 - 6) * 100) / 100,        // -6 .. +6
    // Tighter offsets so cards stay inside the narrow single-column wall
    // even at the most aggressive jitter combo. Visual variety still
    // comes through tilt + within-stack stacking offsets.
    xOffset: Math.round((Math.random() * 20 - 10) * 100) / 100,    // -10 .. +10 px
    yOffset: Math.round((Math.random() * 16 - 8) * 100) / 100,     // -8 .. +8 px
    pinColor: PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)],
  };
}

// POST /api/generate-polaroid — synchronous end-to-end image creation:
//   1. build prompt from session summary (or transcript fallback)
//   2. call Fal.ai with bunny reference image
//   3. download bytes, upload to Supabase Storage `polaroids` bucket
//   4. insert row into bunny_polaroids with permanent public URL
// Returns the persisted polaroid row.
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = (body.sessionId ?? null) || null;
  const sessionDate =
    typeof body.sessionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.sessionDate)
      ? body.sessionDate
      : new Date().toISOString().slice(0, 10);
  const summary = (body.summary ?? "").trim() || null;
  const turns = Array.isArray(body.turns) ? body.turns : [];

  // Polaroid id is deterministic from sessionId when we have one (so
  // re-running the API for the same session updates rather than dupes),
  // otherwise time-based.
  const polaroidId = sessionId ? `pol-${sessionId}` : `pol-${Date.now()}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 500 },
    );
  }

  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  if (!hasFalConfig()) {
    // Mark the row as failed so the wall can show a placeholder rather
    // than spinning forever, and so a parent can see in /parent why
    // images aren't appearing.
    const layout = randomLayout();
    await sb.from("bunny_polaroids").upsert(
      {
        id: polaroidId,
        family_id: FAMILY_ID,
        session_id: sessionId,
        session_date: sessionDate,
        prompt: null,
        image_url: null,
        status: "failed",
        pin_color: layout.pinColor,
        tilt_deg: layout.tilt,
        x_offset_px: layout.xOffset,
        y_offset_px: layout.yOffset,
        error_message: "FAL_KEY not configured",
      },
      { onConflict: "id" },
    );
    return Response.json(
      { ok: false, error: "FAL_KEY is not configured.", polaroidId },
      { status: 503 },
    );
  }

  // Ask the LLM to invent a specific, illustratable scene from this talk.
  // Doing this here (rather than in a static template) is what gives the
  // wall visible variety — same talk shape can still produce a fresh
  // composition, camera angle, and small detail every time. We tolerate
  // failure: if scene generation throws, we fall back to a soft hint so
  // the polaroid still gets made.
  let scene = "";
  try {
    if (summary || turns.length > 0) {
      scene = await generatePolaroidScene(summary ?? "", turns);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[bunny] polaroid scene LLM failed, falling back:",
      err instanceof Error ? err.message : err,
    );
  }

  const prompt = buildPolaroidPrompt({
    scene,
    fallbackHint: fallbackHintFromTurns(turns),
  });
  const layout = randomLayout();

  // Optimistic insert: write a `pending` row right away so the client wall
  // can render a "developing…" card if it polls before the image lands.
  // Today the client waits on this response, but the row is the canonical
  // source of truth and we want it consistent even if the client navigates
  // away mid-generation.
  await sb.from("bunny_polaroids").upsert(
    {
      id: polaroidId,
      family_id: FAMILY_ID,
      session_id: sessionId,
      session_date: sessionDate,
      prompt,
      image_url: null,
      status: "pending",
      pin_color: layout.pinColor,
      tilt_deg: layout.tilt,
      x_offset_px: layout.xOffset,
      y_offset_px: layout.yOffset,
    },
    { onConflict: "id" },
  );

  let publicUrl: string | null = null;
  try {
    const result = await generatePolaroidImage(prompt);

    // Path inside the bucket: keyed by family + polaroid id so it is easy
    // to clean up later (one folder per family). JPEG always — Flux Pro
    // Kontext output_format above is "jpeg".
    const objectPath = `${FAMILY_ID}/${polaroidId}.jpg`;
    const uploadRes = await sb.storage
      .from("polaroids")
      .upload(objectPath, result.imageBytes, {
        contentType: result.contentType || "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      });
    if (uploadRes.error) {
      throw new Error(`Storage upload failed: ${uploadRes.error.message}`);
    }
    const { data: pub } = sb.storage.from("polaroids").getPublicUrl(objectPath);
    publicUrl = pub.publicUrl;

    const { error: updateErr } = await sb
      .from("bunny_polaroids")
      .update({
        status: "ready",
        image_url: publicUrl,
        error_message: null,
      })
      .eq("id", polaroidId)
      .eq("family_id", FAMILY_ID);
    if (updateErr) {
      throw new Error(`DB update failed: ${updateErr.message}`);
    }

    return Response.json({
      ok: true,
      polaroid: {
        id: polaroidId,
        familyId: FAMILY_ID,
        sessionId,
        sessionDate,
        prompt,
        imageUrl: publicUrl,
        status: "ready",
        pinColor: layout.pinColor,
        tiltDeg: layout.tilt,
        xOffsetPx: layout.xOffset,
        yOffsetPx: layout.yOffset,
        liked: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "polaroid generation failed";
    // eslint-disable-next-line no-console
    console.error("[bunny] polaroid generation error:", message);
    await sb
      .from("bunny_polaroids")
      .update({
        status: "failed",
        error_message: message.slice(0, 500),
      })
      .eq("id", polaroidId)
      .eq("family_id", FAMILY_ID);
    return Response.json(
      { ok: false, error: message, polaroidId },
      { status: 200 },
    );
  }
}
