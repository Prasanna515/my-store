import { verifySessionValue, COOKIE } from '../../../lib/admin-auth.js';
import { getServiceSupabase } from '../../../lib/supabase.js';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request, cookies }) {
  try {
    const authed = await verifySessionValue(cookies.get(COOKIE)?.value);
    if (!authed) return json(401, { error: 'Not logged in.' });

    const { sku } = await request.json();
    if (!sku || !String(sku).trim()) return json(400, { error: 'Enter a SKU to delete.' });

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.from('products').delete().eq('sku', String(sku).trim()).select('id,name');
    if (error) throw error;
    if (!data || data.length === 0) return json(404, { error: `No product found with SKU "${sku}".` });

    return json(200, { deleted: data });
  } catch (e) {
    return json(500, { error: e?.message || 'Delete failed.' });
  }
}
