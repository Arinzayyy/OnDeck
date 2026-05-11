import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * - Bypasses RLS (safe because this only runs in server components / API routes)
 * - Never import this in client components or expose to the browser
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
    );
  }

  return createClient(url, key, {
    auth: {
      // Disable auto-refresh/session persistence on server
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
