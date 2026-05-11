import { createClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client using the ANON key.
 * - Respects RLS
 * - Safe to use in client components
 * - We only use this for read-only public data (e.g. fetching settings for
 *   display). All mutations go through API routes that use the server client.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}
