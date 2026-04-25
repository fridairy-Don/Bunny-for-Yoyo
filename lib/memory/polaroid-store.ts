"use client";

import { FAMILY_ID, getSupabase } from "../supabase/client";

export type PolaroidStatus = "pending" | "ready" | "failed";

export type Polaroid = {
  id: string;
  familyId: string;
  sessionId: string | null;
  sessionDate: string;     // YYYY-MM-DD
  prompt: string | null;
  imageUrl: string | null; // null until generation finishes
  status: PolaroidStatus;
  pinColor: string;
  tiltDeg: number;
  xOffsetPx: number;
  yOffsetPx: number;
  liked: boolean;
  errorMessage: string | null;
  createdAt: number;
};

type Row = {
  id: string;
  family_id: string;
  session_id: string | null;
  session_date: string;
  prompt: string | null;
  image_url: string | null;
  status: string;
  pin_color: string;
  tilt_deg: number | string;
  x_offset_px: number | string;
  y_offset_px: number | string;
  liked: boolean;
  error_message: string | null;
  created_at: string;
};

function rowToPolaroid(row: Row): Polaroid {
  return {
    id: row.id,
    familyId: row.family_id,
    sessionId: row.session_id ?? null,
    sessionDate: row.session_date,
    prompt: row.prompt ?? null,
    imageUrl: row.image_url ?? null,
    status: (row.status as PolaroidStatus) ?? "pending",
    pinColor: row.pin_color ?? "rose",
    tiltDeg: Number(row.tilt_deg) || 0,
    xOffsetPx: Number(row.x_offset_px) || 0,
    yOffsetPx: Number(row.y_offset_px) || 0,
    liked: Boolean(row.liked),
    errorMessage: row.error_message ?? null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Fetch the most-recent polaroids for the wall. Default 60 is well within
// what a child accumulates over months — wall is virtualized via stacking
// by date so 60 cards on screen feels generous but never crowded.
export async function getPolaroids(limit = 60): Promise<Polaroid[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("bunny_polaroids")
    .select("*")
    .eq("family_id", FAMILY_ID)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Row[]).map(rowToPolaroid);
}

// Permanently remove a polaroid: drop the storage object first (best
// effort — a missing object is not fatal, the row delete is what the
// wall reads), then delete the row. Returns true on row deletion so the
// caller knows it can drop the card from local state.
//
// We do NOT cascade into related sessions/memories — those are managed
// by their own delete flows. A polaroid is just a memory of a memory.
export async function deletePolaroid(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  // Storage object key matches the upload path in
  // app/api/generate-polaroid/route.ts: `${FAMILY_ID}/${polaroidId}.jpg`.
  // If the polaroid is in `failed` status it may not have an object,
  // and `remove` returns ok with an empty list in that case — safe.
  const objectPath = `${FAMILY_ID}/${id}.jpg`;
  try {
    await sb.storage.from("polaroids").remove([objectPath]);
  } catch {
    // Swallow — storage cleanup best effort. Row delete below is the
    // canonical "the polaroid is gone" signal.
  }

  const { error } = await sb
    .from("bunny_polaroids")
    .delete()
    .eq("family_id", FAMILY_ID)
    .eq("id", id);
  return !error;
}

// Toggle the heart on a polaroid. Liked polaroids are surfaced in the
// detail view header but the wall layout itself stays the same.
export async function setPolaroidLiked(id: string, liked: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb
    .from("bunny_polaroids")
    .update({ liked })
    .eq("family_id", FAMILY_ID)
    .eq("id", id);
}

// Kick off generation. Resolves with the persisted polaroid when ready.
// On failure the server still returns 200 with ok:false and a row in
// `failed` state — we surface that to the caller so the UI can replace
// the developing card with a soft fallback rather than spinning forever.
export async function requestPolaroidGeneration(input: {
  sessionId: string | null;
  sessionDate: string;
  summary: string | null;
  turns: Array<{ id?: string; role: "user" | "assistant" | "system"; text: string; createdAt?: number }>;
}): Promise<{ ok: boolean; polaroid: Polaroid | null; error?: string }> {
  try {
    const res = await fetch("/api/generate-polaroid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!data?.ok) {
      return { ok: false, polaroid: null, error: data?.error ?? "generation failed" };
    }
    const p = data.polaroid as {
      id: string;
      familyId: string;
      sessionId: string | null;
      sessionDate: string;
      prompt: string | null;
      imageUrl: string | null;
      status: PolaroidStatus;
      pinColor: string;
      tiltDeg: number;
      xOffsetPx: number;
      yOffsetPx: number;
      liked: boolean;
    };
    return {
      ok: true,
      polaroid: {
        id: p.id,
        familyId: p.familyId,
        sessionId: p.sessionId,
        sessionDate: p.sessionDate,
        prompt: p.prompt,
        imageUrl: p.imageUrl,
        status: p.status,
        pinColor: p.pinColor,
        tiltDeg: p.tiltDeg,
        xOffsetPx: p.xOffsetPx,
        yOffsetPx: p.yOffsetPx,
        liked: p.liked,
        errorMessage: null,
        createdAt: Date.now(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      polaroid: null,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}

// Group polaroids by session_date. Keys are sorted newest-first; within a
// day the most-recent polaroid is the top of the stack.
export type PolaroidStack = {
  date: string;
  items: Polaroid[];
};

export function groupPolaroidsByDate(polaroids: Polaroid[]): PolaroidStack[] {
  const buckets = new Map<string, Polaroid[]>();
  for (const p of polaroids) {
    const list = buckets.get(p.sessionDate) ?? [];
    list.push(p);
    buckets.set(p.sessionDate, list);
  }
  return Array.from(buckets.keys())
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({
      date,
      // Most recent on top of the stack — sort by createdAt desc.
      items: (buckets.get(date) ?? []).slice().sort((a, b) => b.createdAt - a.createdAt),
    }));
}
