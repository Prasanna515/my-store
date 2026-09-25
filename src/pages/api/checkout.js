import { getServiceSupabase } from '../../lib/supabase.js';
import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { items, customer, payment_method } = body || {};

    if (!Array.isArray(items) || items.length === 0) return json(400, { error: 'Your cart is empty.' });
    if (
      !customer ||
      !customer.name ||
      !customer.email ||
      !customer.phone ||
      !customer.address_line ||
      !customer.city ||
      !customer.state ||
      !customer.pincode
    ) {
      return json(400, { error: 'Please fill in all the delivery details.' });
    }
    if (!/^[1-9][0-9]{5}$/.test(customer.pincode)) return json(400, { error: 'Please enter a valid 6-digit pincode.' });
    if (!['online', 'cod'].includes(payment_method)) return json(400, { error: 'Invalid payment method.' });

    const supabase = getServiceSupabase();

    // Settings and prices are re-checked here on the server. Nothing sent by
    // the browser (prices, COD availability) is trusted.
    const { data: settings, error: setErr } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (setErr) throw setErr;

    if (payment_method === 'cod' && !settings.cod_enabled) {
      return json(400, { error: 'Cash on Delivery is currently unavailable. Please pay online instead.' });
    }

    const ids = items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabase.from('products').select('*').in('id', ids);
    if (prodErr) throw prodErr;

    let subtotal = 0;
    const orderItems = [];
    for (const it of items) {
      const p = products.find((prod) => prod.id === it.product_id);
      if (!p || !p.active) return json(400, { error: `A product in your cart is no longer available: ${it.name || it.product_id}` });
      const qty = Math.max(1, parseInt(it.qty) || 1);
      if (p.stock < qty) return json(400, { error: `Only ${p.stock} left in stock for "${p.name}". Please reduce the quantity.` });
      subtotal += Number(p.selling_price) * qty;
      orderItems.push({
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        hsn_code: p.hsn_code,
        gst_rate: p.gst_rate,
        quantity: qty,
        unit_price: p.selling_price,
      });
    }

    let shipping = Number(settings.flat_shipping) || 0;
    if (settings.free_shipping_above != null && subtotal >= Number(settings.free_shipping_above)) shipping = 0;

    let codFee = 0;
    if (payment_method === 'cod') {
      codFee = Number(settings.cod_fee) || 0;
      if (settings.max_cod_value != null && subtotal > Number(settings.max_cod_value)) {
        return json(400, { error: `Cash on Delivery isn't available for orders above ₹${settings.max_cod_value}. Please pay online.` });
      }
    }
    const total = subtotal + shipping + codFee;

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address_line: customer.address_line,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        subtotal,
        shipping_charge: shipping,
        cod_fee: codFee,
        total,
        payment_method,
        payment_status: payment_method === 'cod' ? 'cod_due' : 'pending',
      })
      .select()
      .single();
    if (orderErr) throw orderErr;

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItems.map((i) => ({ ...i, order_id: order.id })));
    if (itemsErr) throw itemsErr;

    if (payment_method === 'cod') {
      const { error: stockErr } = await supabase.rpc('deduct_order_stock', { p_order_id: order.id });
      if (stockErr) throw stockErr;
      return json(200, { order_number: order.order_number, payment_method: 'cod' });
    }

    // Online payment: create the Razorpay order. Stock is only deducted after
    // the payment is verified (see verify-payment.js), so nothing is reserved
    // for an order that's never actually paid for.
    const keyId = (cfEnv.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (cfEnv.RAZORPAY_KEY_SECRET || '').trim();
    if (!keyId || !keySecret) throw new Error('Razorpay is not configured yet (missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');

    const rpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({ amount: Math.round(total * 100), currency: 'INR', receipt: order.order_number }),
    });
        const rpData = await rpRes.json();
    if (!rpRes.ok) {
      const diag = `[diagnostic: key_id="${keyId}" (length ${keyId.length}), key_secret length ${keySecret.length}, starts with "${keySecret.slice(0, 4)}"]`;
      throw new Error((rpData?.error?.description || 'Could not start the payment.') + ' ' + diag);
    }

    await supabase.from('orders').update({ razorpay_order_id: rpData.id }).eq('id', order.id);

    return json(200, {
      order_number: order.order_number,
      payment_method: 'online',
      razorpay_order_id: rpData.id,
      amount: rpData.amount,
      currency: rpData.currency,
      key_id: keyId,
      customer_name: customer.name,
      email: customer.email,
      phone: customer.phone,
    });
  } catch (e) {
    return json(500, { error: e?.message || 'Something went wrong placing your order. Please try again.' });
  }
}
