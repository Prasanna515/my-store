import { createClient } from '@supabase/supabase-js';

function clean(v) {
  if (typeof v !== 'string') return v;
  return v.trim().replace(/^['"]|['"]$/g, ''); // remove accidental quotes/spaces/newlines from pasting
}

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
  url = clean(url);
  key = clean(key);
  if (!url) throw new Error('SUPABASE_URL is missing or empty. Check Cloudflare > Settings > Variables and Secrets.');
  if (!key) throw new Error('SUPABASE_ANON_KEY is missing or empty. Check Cloudflare > Settings > Variables and Secrets.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    throw new Error(
      `SUPABASE_URL looks wrong: "${url}" (length ${url.length}). ` +
      `It must look exactly like https://abcdefgh.supabase.co with nothing before or after ` +
      `(no quotes, no trailing slash, no extra spaces or line breaks). ` +
      `Re-copy it from Supabase > Project Settings > API > Project URL, delete the Cloudflare variable, and re-add it.`
    );
  }
  return createClient(url, key);
}

export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
