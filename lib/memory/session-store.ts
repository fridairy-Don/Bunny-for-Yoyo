"use client";

import type { ConversationTurn } from "../types/conversation";
import { FAMILY_ID, getSupabase, hasSupabase } from "../supabase/client";

const KEY_MEMORIES = "bunny:distilled-memories";
const KEY_DAILY_LOG_PREFIX = "bunny:daily-log:";
const KEY_LAST_CLOSER = "bunny:last-session-closer";
const KEY_MIGRATED = "bunny:migrated-to-supabase-v1";

export type SessionCloser = {
  endedAt: number;
  turns: Array<{ role: "user" | "assistant"; text: string }>;
};

export type MemoryType =
  | "identity"
  | "relationship"
  | "routine"
  | "people"
  | "school"
  | "emotion"
  | "special_memory";

export type MemorySource = "session" | "preset";

export type MemoryTriggerScope =
  | "global"
  | "first_launch"
  | "daily_chat"
  | "comfort"
  | "bedtime";

export type DistilledMemory = {
  id: string;
  createdAt: number;
  type: MemoryType;
  content: string;
  importance: number;
  source: MemorySource;
  sessionDate: string;
  triggerScope?: MemoryTriggerScope;
  editable?: boolean;
};

export type DailySession = {
  id: string;
  startedAt: number;
  endedAt: number;
  turns: ConversationTurn[];
  distilledIds: string[];
};

function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── local fallback helpers (used when Supabase env is absent or offline) ───

function localGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function localSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota ignored
  }
}

function normalizeForDedup(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupAgainst(existing: DistilledMemory[], incoming: DistilledMemory[]) {
  const seen = new Set(existing.map((m) => normalizeForDedup(m.content)));
  const out: DistilledMemory[] = [];
  for (const mem of incoming) {
    const key = normalizeForDedup(mem.content);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mem);
  }
  return out;
}

// ─── row ↔ object mapping for Supabase ───

type MemoryRow = {
  id: string;
  created_at: string;
  memory_type: string;
  content: string;
  importance: number;
  source: string;
  session_date: string;
  trigger_scope?: string | null;
  editable?: boolean | null;
};

function rowToMemory(row: MemoryRow): DistilledMemory {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    type: row.memory_type as MemoryType,
    content: row.content,
    importance: Number(row.importance),
    source: (row.source as MemorySource) ?? "session",
    sessionDate: row.session_date,
    triggerScope: (row.trigger_scope as MemoryTriggerScope) ?? "global",
    editable: row.editable ?? true,
  };
}

function memoryToRow(m: DistilledMemory) {
  return {
    id: m.id,
    family_id: FAMILY_ID,
    created_at: new Date(m.createdAt).toISOString(),
    memory_type: m.type,
    content: m.content,
    importance: m.importance,
    source: m.source,
    session_date: m.sessionDate,
    trigger_scope: m.triggerScope ?? "global",
    editable: m.editable ?? m.source === "preset",
  };
}

// ─── public API (async everywhere) ───

// Child UI list: only session-distilled memories. Preset rows are parent
// configuration and should not appear in the "our memories" drawer Yoyo
// sees — they live under /parent instead.
export async function getDistilledMemories(): Promise<DistilledMemory[]> {
  await runMigrationOnce();
  const sb = getSupabase();
  if (!sb) {
    const local = localGet<DistilledMemory[]>(KEY_MEMORIES, []);
    return local.filter((m) => m.source !== "preset");
  }

  const { data, error } = await sb
    .from("bunny_memories")
    .select("*")
    .eq("family_id", FAMILY_ID)
    .eq("source", "session")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[bunny] memory fetch failed, falling back to local:", error.message);
    const local = localGet<DistilledMemory[]>(KEY_MEMORIES, []);
    return local.filter((m) => m.source !== "preset");
  }
  const memories = (data as MemoryRow[]).map(rowToMemory);
  // Cache session-only in the main cache key — presets live under a
  // separate key to avoid leaking into child UI through the local fallback.
  localSet(KEY_MEMORIES, memories);
  return memories;
}

// Full list (session + preset). Used by prompt assembly and the parent
// dashboard. Not exposed to the child drawer.
export async function getAllMemories(): Promise<DistilledMemory[]> {
  await runMigrationOnce();
  const sb = getSupabase();
  if (!sb) return localGet<DistilledMemory[]>(KEY_MEMORIES, []);

  const { data, error } = await sb
    .from("bunny_memories")
    .select("*")
    .eq("family_id", FAMILY_ID)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    console.warn("[bunny] memory fetch failed, falling back to local:", error.message);
    return localGet<DistilledMemory[]>(KEY_MEMORIES, []);
  }
  return (data as MemoryRow[]).map(rowToMemory);
}

// Preset-only list (parent dashboard edit view).
export async function getPresetMemories(): Promise<DistilledMemory[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("bunny_memories")
    .select("*")
    .eq("family_id", FAMILY_ID)
    .eq("source", "preset")
    .order("trigger_scope", { ascending: true })
    .order("importance", { ascending: false });
  if (error || !data) return [];
  return (data as MemoryRow[]).map(rowToMemory);
}

// Upsert a preset row. Used by /parent/setup Onboarding and the /parent
// dashboard editor. Inserts when id is new, updates in place otherwise.
export async function upsertPresetMemory(mem: DistilledMemory): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const row = memoryToRow({ ...mem, source: "preset" });
  const { error } = await sb.from("bunny_memories").upsert(row, { onConflict: "id" });
  if (error) {
    console.warn("[bunny] preset upsert failed:", error.message);
    throw new Error(error.message);
  }
}

// Seed the DB with compile-time preset memories if the family has none
// yet. Idempotent: once a single preset row exists for this family we
// skip the seed so parent edits in /parent are never overwritten.
export async function seedPresetsIfMissing(
  presets: DistilledMemory[],
): Promise<void> {
  if (!presets.length) return;
  const sb = getSupabase();
  if (!sb) return;
  const { count, error: headErr } = await sb
    .from("bunny_memories")
    .select("id", { count: "exact", head: true })
    .eq("family_id", FAMILY_ID)
    .eq("source", "preset");
  if (headErr) {
    console.warn("[bunny] preset seed check failed:", headErr.message);
    return;
  }
  if ((count ?? 0) > 0) return;
  const rows = presets.map((m) => memoryToRow({ ...m, source: "preset" }));
  const { error } = await sb.from("bunny_memories").insert(rows);
  if (error) console.warn("[bunny] preset seed insert failed:", error.message);
}

export async function addDistilledMemories(
  entries: DistilledMemory[],
): Promise<DistilledMemory[]> {
  if (!entries.length) return [];

  const existing = await getDistilledMemories();
  const fresh = dedupAgainst(existing, entries);
  if (!fresh.length) return [];

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("bunny_memories").insert(fresh.map(memoryToRow));
    if (error) {
      console.warn("[bunny] memory insert failed, keeping local copy only:", error.message);
    }
  }

  const merged = [...fresh, ...existing].slice(0, 200);
  localSet(KEY_MEMORIES, merged);
  return fresh;
}

export async function removeDistilledMemory(memoryId: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.from("bunny_memories").delete().eq("id", memoryId);
  }
  // update local cache
  const current = localGet<DistilledMemory[]>(KEY_MEMORIES, []);
  localSet(KEY_MEMORIES, current.filter((m) => m.id !== memoryId));

  // also clean up daily-log references locally (Supabase session rows are not
  // re-written on single-memory delete — the distilled_ids may contain dangling
  // ids, which is fine; queries tolerate it).
  if (typeof window !== "undefined") {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(KEY_DAILY_LOG_PREFIX)) continue;
      const sessions = localGet<DailySession[]>(k, []);
      let touched = false;
      const cleaned = sessions.map((s) => {
        if (s.distilledIds.includes(memoryId)) {
          touched = true;
          return { ...s, distilledIds: s.distilledIds.filter((x) => x !== memoryId) };
        }
        return s;
      });
      if (touched) localSet(k, cleaned);
    }
  }
}

export async function archiveSession(
  turns: ConversationTurn[],
  distilledIds: string[],
): Promise<string | null> {
  const filtered = turns.filter((t) => t.role !== "system");
  if (!filtered.length) return null;

  const session: DailySession = {
    id: `session-${Date.now()}`,
    startedAt: filtered[0].createdAt,
    endedAt: Date.now(),
    turns: filtered,
    distilledIds,
  };

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("bunny_sessions").insert({
      id: session.id,
      family_id: FAMILY_ID,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: new Date(session.endedAt).toISOString(),
      turns: session.turns,
      distilled_ids: session.distilledIds,
      session_date: today(),
    });
    if (error) {
      console.warn("[bunny] session archive failed:", error.message);
    }
  }

  // local cache for fast memory-detail lookups
  const key = KEY_DAILY_LOG_PREFIX + today();
  const sessions = localGet<DailySession[]>(key, []);
  sessions.push(session);
  localSet(key, sessions);
  return session.id;
}

// Attach a 1-2 sentence summary to an archived session. Produced async by
// /api/summarize after archiveSession returns so save-to-memory doesn't
// block the UI on an LLM round-trip.
export async function updateSessionSummary(
  sessionId: string,
  summary: string,
): Promise<void> {
  if (!summary) return;
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("bunny_sessions")
      .update({ summary })
      .eq("family_id", FAMILY_ID)
      .eq("id", sessionId);
    if (error) {
      console.warn("[bunny] summary update failed:", error.message);
    }
  }
  // Local cache only stores transcript; summary lives in Supabase.
}

// Fetch the N most-recent non-empty session summaries to inject into the
// prompt. Most-recent first. Returns empty when Supabase is unreachable or
// the family is too new.
export async function getRecentSummaries(limit = 3): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("bunny_sessions")
    .select("summary, session_date, ended_at")
    .eq("family_id", FAMILY_ID)
    .not("summary", "is", null)
    .order("session_date", { ascending: false })
    .order("ended_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Array<{ summary: string | null }>)
    .map((row) => (row.summary ?? "").trim())
    .filter((s) => s.length > 0);
}

export async function saveLastSessionCloser(
  turns: ConversationTurn[],
  tailSize = 4,
): Promise<void> {
  const filtered = turns.filter((t) => t.role !== "system");
  const tail = filtered.slice(-tailSize).map((t) => ({
    role: t.role as "user" | "assistant",
    text: t.text,
  }));
  if (!tail.length) return;
  const closer: SessionCloser = { endedAt: Date.now(), turns: tail };

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("bunny_last_closer")
      .upsert(
        {
          family_id: FAMILY_ID,
          ended_at: new Date(closer.endedAt).toISOString(),
          turns: closer.turns,
        },
        { onConflict: "family_id" },
      );
    if (error) {
      console.warn("[bunny] last-closer save failed:", error.message);
    }
  }

  localSet(KEY_LAST_CLOSER, closer);
}

export async function getLastSessionCloser(): Promise<SessionCloser | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("bunny_last_closer")
      .select("ended_at, turns")
      .eq("family_id", FAMILY_ID)
      .maybeSingle();
    if (!error && data) {
      const closer: SessionCloser = {
        endedAt: new Date(data.ended_at).getTime(),
        turns: data.turns as SessionCloser["turns"],
      };
      localSet(KEY_LAST_CLOSER, closer);
      return closer;
    }
  }
  return localGet<SessionCloser | null>(KEY_LAST_CLOSER, null);
}

export async function findSessionContainingMemory(
  date: string,
  memoryId: string,
): Promise<DailySession | null> {
  // local cache first
  const cached = localGet<DailySession[]>(KEY_DAILY_LOG_PREFIX + date, []);
  for (const s of cached) {
    if (s.distilledIds.includes(memoryId)) return s;
  }

  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("bunny_sessions")
    .select("id, started_at, ended_at, turns, distilled_ids, session_date")
    .eq("family_id", FAMILY_ID)
    .eq("session_date", date)
    .contains("distilled_ids", [memoryId])
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    startedAt: new Date(data.started_at).getTime(),
    endedAt: new Date(data.ended_at).getTime(),
    turns: data.turns as ConversationTurn[],
    distilledIds: data.distilled_ids as string[],
  };
}

export async function wipeAllMemory(): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await Promise.all([
      sb.from("bunny_memories").delete().eq("family_id", FAMILY_ID),
      sb.from("bunny_sessions").delete().eq("family_id", FAMILY_ID),
      sb.from("bunny_last_closer").delete().eq("family_id", FAMILY_ID),
    ]);
  }

  if (typeof window !== "undefined") {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("bunny:")) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  }
}

// one-shot migration: if Supabase is reachable and we have untracked local
// memories, push them up once so existing dev data follows the user to the cloud.
async function runMigrationOnce() {
  if (!hasSupabase()) return;
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(KEY_MIGRATED) === "1") return;

  const sb = getSupabase();
  if (!sb) return;

  const localMems = localGet<DistilledMemory[]>(KEY_MEMORIES, []);
  const localCloser = localGet<SessionCloser | null>(KEY_LAST_CLOSER, null);

  try {
    if (localMems.length) {
      // Upsert (conflict on id does nothing — idempotent if re-run)
      await sb.from("bunny_memories").upsert(localMems.map(memoryToRow), {
        onConflict: "id",
        ignoreDuplicates: true,
      });
    }
    if (localCloser?.turns?.length) {
      await sb.from("bunny_last_closer").upsert(
        {
          family_id: FAMILY_ID,
          ended_at: new Date(localCloser.endedAt).toISOString(),
          turns: localCloser.turns,
        },
        { onConflict: "family_id" },
      );
    }
    window.localStorage.setItem(KEY_MIGRATED, "1");
  } catch (err) {
    console.warn("[bunny] migration skipped (will retry later):", err);
  }
}
