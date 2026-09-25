import { env as cfEnv } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';

function clean(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/^['"]|['"]$/g, ''); // remove accidental quotes/spaces/newlines from pasting
}

// Cloudflare's runtime environment: contains both plain Variables and Secrets
// set in the Cloudflare dashboard.
export function getSupabase() {
  const env = cfEnv;
  if (!env) throw new Error('Cloudflare runtime env was not available (cloudflare:workers env is missing).');
  const url = clean(env.SUPABASE_URL);
  const key = clean(env.SUPABASE_ANON_KEY);
  if (!url) throw new Error('SUPABASE_URL is missing or empty. Check Cloudflare > Settings > Variables and Secrets.');
  if (!key) throw new Error('SUPABASE_ANON_KEY is missing or empty. Check Cloudflare > Settings > Variables and Secrets.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    throw new Error(
      `SUPABASE_URL looks wrong: "${url}" (length ${url.length}). ` +
      `It must look exactly like https://abcdefgh.supabase.co with nothing before or after.`
    );
  }
  return createClient(url, key);
}

export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
