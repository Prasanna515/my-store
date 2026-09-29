import { env as cfEnv } from 'cloudflare:workers';

// Sends an email via the Resend API. Silently no-ops (and logs) if not
// configured yet, so a missing email setup never breaks checkout itself.
export async function sendEmail({ to, subject, html }) {
  const apiKey = (cfEnv.RESEND_API_KEY || '').trim();
  const from = (cfEnv.RESEND_FROM_EMAIL || 'onboarding@resend.dev').trim();
  if (!apiKey) {
    console.log('RESEND_API_KEY not set — skipping email send.');
    return { skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.log('Resend error:', JSON.stringify(data));
      return { error: data };
    }
    return { data };
  } catch (e) {
    console.log('Email send failed:', e?.message);
    return { error: e?.message };
  }
}

export function orderEmailHtml({
  order_number, customer_name, items, subtotal, shipping_charge, cod_fee, total,
  payment_method, address_line, city, state, pincode,
}) {
  const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const rows = (items || [])
    .map(
      (i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${rupees(i.unit_price)}</td>
    </tr>`
    )
    .join('');

  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1b1f24">
    <h2 style="color:#0b1f3a">Thank you for your order, ${customer_name}!</h2>
    <p>Your order <b>${order_number}</b> has been placed successfully${
      payment_method === 'cod' ? ' (Cash on Delivery)' : ' and payment has been received'
    }.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#f8fafc;text-align:left">
          <th style="padding:6px 8px">Item</th>
          <th style="padding:6px 8px;text-align:center">Qty</th>
          <th style="padding:6px 8px;text-align:right">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="text-align:right">
      Subtotal: ${rupees(subtotal)}<br/>
      Shipping: ${rupees(shipping_charge)}<br/>
      ${cod_fee ? `COD fee: ${rupees(cod_fee)}<br/>` : ''}
      <b>Total: ${rupees(total)}</b>
    </p>
    <p><b>Delivery address:</b><br/>${address_line}, ${city}, ${state} - ${pincode}</p>
    <p style="color:#6b7280;font-size:13px">You can track this order anytime on our website using your order number and phone number.</p>
    <p style="color:#6b7280;font-size:13px">— ROBO9</p>
  </div>`;
}
