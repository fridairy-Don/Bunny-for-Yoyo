"use client";

import { useEffect, useState } from "react";
import { getFirstSessionTimestamp } from "../memory/session-store";

export type Mote = {
  left: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

export type AmbientTimeKey =
  | "late night"
  | "morning light"
  | "midday"
  | "afternoon"
  | "evening"
  | "night";

export const TIME_COPY: Record<AmbientTimeKey, { label: string; warm: string }> = {
  "late night": { label: "late night", warm: "she waited up a little" },
  "morning light": { label: "morning light", warm: "the sun is soft today" },
  midday: { label: "midday", warm: "a little quiet here today" },
  afternoon: { label: "afternoon", warm: "the room is warm" },
  evening: { label: "evening", warm: "the day is winding down" },
  night: { label: "night", warm: "everything feels gentle" },
};

function getTimeKey(hours: number): AmbientTimeKey {
  if (hours < 5) return "late night";
  if (hours < 11) return "morning light";
  if (hours < 14) return "midday";
  if (hours < 18) return "afternoon";
  if (hours < 21) return "evening";
  return "night";
}

// "Day N" the family is on. Source of truth: the oldest started_at row in
// bunny_sessions on Supabase — that way the count is the same on
// localhost:3000, the Vercel preview URL, and on every device the family
// uses. localStorage is a cache only: it lets the badge render instantly
// on first paint while the Supabase fetch is in flight, and it also
// covers the case where Supabase is unreachable or the family hasn't
// recorded any session yet.
const KEY_FIRST_SEEN_CACHE = "bunny:first_seen_v2";

function computeDay(firstMs: number, nowMs: number): number {
  return Math.max(1, Math.floor((nowMs - firstMs) / 86_400_000) + 1);
}

// Synchronous initial guess from cache. Falls back to "today" when there
// is no cache yet so we never flash a stale value from the previous
// (per-origin) localStorage key.
function getDayNumberFromCache(): number {
  if (typeof window === "undefined") return 1;
  const now = Date.now();
  try {
    const raw = window.localStorage.getItem(KEY_FIRST_SEEN_CACHE);
    const first = raw ? Number(raw) : NaN;
    if (Number.isFinite(first) && first > 0) {
      return computeDay(first, now);
    }
  } catch {
    // ignore localStorage errors
  }
  return 1;
}

export type AmbientState = {
  motes: Mote[];
  timeKey: AmbientTimeKey;
  timeLabel: string;
  timeWarm: string;
  dayNumber: number;
  clientReady: boolean;
};

// Client-side atmosphere: random drifting motes, time-of-day copy, and the
// "day N" counter based on first-seen timestamp. All derived on mount to
// avoid SSR hydration mismatches — clientReady flips to true after the
// first client paint.
const MOTE_COUNT = 14;

export function useAmbient(): AmbientState {
  const [motes, setMotes] = useState<Mote[]>([]);
  const [timeKey, setTimeKey] = useState<AmbientTimeKey>("midday");
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    const out: Mote[] = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      const size = 2 + Math.random() * 3.5;
      const duration = 22 + Math.random() * 28;
      out.push({
        left: `${Math.random() * 100}%`,
        size,
        duration,
        delay: -Math.random() * duration,
        opacity: Number((0.35 + Math.random() * 0.45).toFixed(2)),
      });
    }
    setMotes(out);
    setTimeKey(getTimeKey(new Date().getHours()));
    // Instant paint from cache so the badge isn't blank for a tick.
    setDayNumber(getDayNumberFromCache());
    setClientReady(true);

    // Authoritative day count from Supabase, in the background.
    let cancelled = false;
    (async () => {
      try {
        const firstMs = await getFirstSessionTimestamp();
        if (cancelled) return;
        if (firstMs && Number.isFinite(firstMs)) {
          setDayNumber(computeDay(firstMs, Date.now()));
          if (typeof window !== "undefined") {
            try {
              window.localStorage.setItem(
                KEY_FIRST_SEEN_CACHE,
                String(firstMs),
              );
            } catch {
              // quota / private mode — ignore.
            }
          }
        } else if (typeof window !== "undefined") {
          // No sessions yet — seed today as the family's first day so the
          // counter starts ticking even before the first save-to-memory.
          try {
            const existing = window.localStorage.getItem(KEY_FIRST_SEEN_CACHE);
            if (!existing) {
              window.localStorage.setItem(
                KEY_FIRST_SEEN_CACHE,
                String(Date.now()),
              );
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // Network / supabase issue — keep the cache-based value.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = TIME_COPY[timeKey];
  return {
    motes,
    timeKey,
    timeLabel: copy.label,
    timeWarm: copy.warm,
    dayNumber,
    clientReady,
  };
}
