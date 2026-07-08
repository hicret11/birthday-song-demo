import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Anon browser Supabase client, used only for Realtime (Presence + Broadcast) on
// the crowd /join page. Reads the PUBLIC env (inlined into the client bundle at
// build time). Returns null when the env isn't configured so callers degrade
// cleanly to polling instead of throwing.

let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false },
    // Modest rate — this page only needs occasional presence + contribution events.
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}
