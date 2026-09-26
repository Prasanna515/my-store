import { createClient } from '@supabase/supabase-js';

let clientPromise;

async function getConfig() {
  const res = await fetch('/api/public-config');
  return res.json();
}

// One shared client for the whole page, so a signed-in session (kept in the
// browser's own storage) is reused for every wishlist/order-history call.
export function getBrowserSupabase() {
  if (!clientPromise) {
    clientPromise = getConfig().then(({ url, anonKey }) =>
      createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    );
  }
  return clientPromise;
}
