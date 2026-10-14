import { verifySessionValue, COOKIE } from '../../../lib/admin-auth.js';
import { getServiceSupabase } from '../../../lib/supabase.js';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function GET({ url, cookies }) {
  try {
    const authed = await verifySessionValue(cookies.get(COOKIE)?.value);
    if (!authed) return json(401, { error: 'Not logged in.' });

    const order_id = url.searchParams.get('order_id');
    if (!order_id) return json(400, { error: 'Missing order_id.' });

    const supabase = getServiceSupabase();
    const { data: order, error: orderErr } = await supabase.from('orders').select('*').eq('id', order_id).single();
    if (orderErr || !order) return json(404, { error: 'Order not found.' });

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('sku, name, quantity, unit_price, gst_rate, hsn_code')
      .eq('order_id', order_id);
    if (itemsErr) throw itemsErr;

    return json(200, { order, items: items || [] });
  } catch (e) {
    return json(500, { error: e?.message || 'Failed to load order details.' });
  }
}
