"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const FAMILY_ID = "yoyo-family";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (!url || !anonKey) return null;
  cached = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  return cached;
}

export function hasSupabase(): boolean {
  return Boolean(url && anonKey);
}
