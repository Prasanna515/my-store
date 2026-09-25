import { createClient } from '@supabase/supabase-js';

// Created lazily inside a function (not at import time) so any problem reading
// the environment variables can be caught by the page's own try/catch block,
// instead of crashing the whole worker before any of our code runs.
export async function getSupabase() {
  let url, key;
  try {
    ({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = await import('astro:env/server'));
  } catch (e) {
    throw new Error('Could not read SUPABASE_URL / SUPABASE_ANON_KEY from astro:env/server: ' + (e && e.message));
  }
  if (!url) throw new Error('SUPABASE_URL is missing or empty. Check Cloudflare > Settings > Variables and Secrets.');
  if (!key) throw new Error('SUPABASE_ANON_KEY is missing or empty. Check Cloudflare > Settings > Variables and Secrets.');
  return createClient(url, key);
}

export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
