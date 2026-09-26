import { getServiceSupabase } from '../../lib/supabase.js';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

// Public, but deliberately narrow: a match requires knowing BOTH the exact
// order number AND the phone number on that order, so this can't be used to
// browse other people's orders.
export async function GET({ url }) {
  const order_number = (url.searchParams.get('order_number') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();
  if (!order_number || !phone) return json(400, { error: 'Enter both your order number and phone number.' });

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('orders')
      .select('order_number,order_status,payment_status,payment_method,tracking_number,created_at,total')
      .eq('order_number', order_number)
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;
    if (!data) return json(404, { error: "No matching order found. Check your order number and phone number." });
    return json(200, { order: data });
  } catch (e) {
    return json(500, { error: e?.message || 'Something went wrong.' });
  }
}
