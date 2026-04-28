"use client";

import { useEffect, useState } from "react";

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

function getDayNumber() {
  if (typeof window === "undefined") return 1;
  const key = "bunny:first_seen";
  const now = Date.now();
  const stored = window.localStorage.getItem(key);
  const first = stored ? Number(stored) : now;
  if (!stored) {
    window.localStorage.setItem(key, String(now));
  }
  return Math.max(1, Math.floor((now - first) / 86_400_000) + 1);
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
    setDayNumber(getDayNumber());
    setClientReady(true);
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
