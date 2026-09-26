import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

// These two values are already meant to be public (the browser needs them to
// talk to Supabase directly for login/signup), so exposing them here is safe.
export async function GET() {
  return new Response(
    JSON.stringify({ url: (cfEnv.SUPABASE_URL || '').trim(), anonKey: (cfEnv.SUPABASE_ANON_KEY || '').trim() }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
