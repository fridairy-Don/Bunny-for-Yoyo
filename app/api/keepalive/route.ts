// Daily keepalive ping — prevents Supabase free-tier auto-pause.
//
// Supabase pauses free-tier projects after 7 days of no API activity.
// Yoyo doesn't talk to Bunny every day — life happens, school, travel.
// This route fires once a day (Vercel cron, see vercel.json) and runs
// a trivial Postgres query, which registers as activity in Supabase's
// inactivity timer and resets the 7-day countdown.
//
// Security: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`
// when the env var is set. We reject anything else so randos can't
// spam the endpoint. In dev (no secret) we let it through unauth'd
// so you can curl it locally.
//
// Cost: 1 invocation/day × 365 = 365 Vercel function calls/year.
// Hobby tier includes 100K/month free, so this is a rounding error.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Block client-side caching so a stale 200 doesn't get reused by a CDN
// edge and silently skip the actual Postgres ping.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { ok: false, error: "supabase-not-configured" },
      { status: 500 },
    );
  }

  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // Cheapest valid query: HEAD-style count on the smallest table.
  // No data is returned, but Supabase still registers it as activity.
  const started = Date.now();
  const { count, error } = await sb
    .from("bunny_family")
    .select("*", { count: "exact", head: true });
  const durationMs = Date.now() - started;

  if (error) {
    return Response.json(
      { ok: false, error: error.message, durationMs },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    families: count,
    durationMs,
  });
}
