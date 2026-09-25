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

    const { order_id, order_status, tracking_number } = await request.json();
    if (!order_id || !order_status) return json(400, { error: 'Missing order_id or order_status.' });

    const supabase = getServiceSupabase();
    const { data: order, error: fetchErr } = await supabase.from('orders').select('*').eq('id', order_id).single();
    if (fetchErr || !order) return json(404, { error: 'Order not found.' });

    // Put stock back if an order that had already reserved/deducted it is now cancelled or returned.
    if (['cancelled', 'returned'].includes(order_status) && order.stock_deducted) {
      const { error: restoreErr } = await supabase.rpc('restore_order_stock', { p_order_id: order_id });
      if (restoreErr) throw restoreErr;
    }

    const update = { order_status, tracking_number: tracking_number || null, updated_at: new Date().toISOString() };
    if (order_status === 'delivered' && order.payment_method === 'cod') update.payment_status = 'cod_collected';

    const { error } = await supabase.from('orders').update(update).eq('id', order_id);
    if (error) throw error;
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e?.message || 'Failed to update order.' });
  }
}
