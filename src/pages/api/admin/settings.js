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

    const body = await request.json();
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('settings')
      .update({
        cod_enabled: !!body.cod_enabled,
        flat_shipping: Number(body.flat_shipping) || 0,
        cod_fee: Number(body.cod_fee) || 0,
        free_shipping_above: body.free_shipping_above == null ? null : Number(body.free_shipping_above),
        max_cod_value: body.max_cod_value == null ? null : Number(body.max_cod_value),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) throw error;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e?.message || 'Failed to save settings.' });
  }
}
