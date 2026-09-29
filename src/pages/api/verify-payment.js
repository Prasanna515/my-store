import { getServiceSupabase } from '../../lib/supabase.js';
import { sendEmail, orderEmailHtml } from '../../lib/email.js';
import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

async function hmacSHA256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST({ request }) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(400, { error: 'Missing payment details.' });
    }

    const keySecret = (cfEnv.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) throw new Error('Razorpay is not configured (missing RAZORPAY_KEY_SECRET).');

    const expected = await hmacSHA256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) {
      return json(400, { error: 'Payment could not be verified. If money was deducted, it will be refunded automatically.' });
    }

    const supabase = getServiceSupabase();
    const { data: order, error } = await supabase.from('orders').select('*').eq('razorpay_order_id', razorpay_order_id).single();
    if (error || !order) return json(404, { error: 'Order not found.' });

    await supabase
      .from('orders')
      .update({ payment_status: 'paid', razorpay_payment_id, order_status: 'confirmed' })
      .eq('id', order.id);

    if (!order.stock_deducted) {
      const { error: stockErr } = await supabase.rpc('deduct_order_stock', { p_order_id: order.id });
      if (stockErr) throw stockErr;
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('name,quantity,unit_price')
      .eq('order_id', order.id);

    const emailHtml = orderEmailHtml({
      order_number: order.order_number,
      customer_name: order.customer_name,
      items: orderItems || [],
      subtotal: order.subtotal,
      shipping_charge: order.shipping_charge,
      cod_fee: order.cod_fee,
      total: order.total,
      payment_method: order.payment_method,
      address_line: order.address_line,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
    });
    await sendEmail({ to: order.email, subject: `Order Confirmed — ${order.order_number}`, html: emailHtml });
    const adminEmail = (cfEnv.ADMIN_NOTIFY_EMAIL || '').trim();
    if (adminEmail) {
      await sendEmail({ to: adminEmail, subject: `New Order — ${order.order_number}`, html: emailHtml });
    }

    return json(200, { order_number: order.order_number });
  } catch (e) {
    return json(500, { error: e?.message || 'Payment verification failed.' });
  }
}
