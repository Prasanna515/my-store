import { env as cfEnv } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';

function clean(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/^['"]|['"]$/g, '');
}

// Public (read-only) client. Safe for anything a visitor's browser could also read.
export function getSupabase() {
  const env = cfEnv;
  if (!env) throw new Error('Cloudflare runtime env was not available.');
  const url = clean(env.SUPABASE_URL);
  const key = clean(env.SUPABASE_ANON_KEY);
  if (!url) throw new Error('SUPABASE_URL is missing or empty.');
  if (!key) throw new Error('SUPABASE_ANON_KEY is missing or empty.');
  return createClient(url, key);
}

// Full-access client. NEVER use this in code that runs in the browser — only
// inside src/pages/api/*.js files, which run on the server.
export function getServiceSupabase() {
  const env = cfEnv;
  if (!env) throw new Error('Cloudflare runtime env was not available.');
  const url = clean(env.SUPABASE_URL);
  const key = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url) throw new Error('SUPABASE_URL is missing or empty.');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Add it in Cloudflare > Settings > Variables and Secrets as a Secret.');
  return createClient(url, key, { auth: { persistSession: false } });
}

export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
