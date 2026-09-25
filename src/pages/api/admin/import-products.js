import { verifySessionValue, COOKIE } from '../../../lib/admin-auth.js';
import { getServiceSupabase } from '../../../lib/supabase.js';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item'
  );
}

export async function POST({ request, cookies }) {
  try {
    const authed = await verifySessionValue(cookies.get(COOKIE)?.value);
    if (!authed) return json(401, { error: 'Not logged in.' });

    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) return json(400, { error: 'No rows received.' });

    const supabase = getServiceSupabase();

    // Build a lookup so "category, subcategory" text from the spreadsheet maps to a category_id.
    const { data: cats, error: catErr } = await supabase.from('categories').select('id,name,parent_id');
    if (catErr) throw catErr;
    const byId = Object.fromEntries(cats.map((c) => [c.id, c]));
    const lookup = new Map();
    for (const c of cats) {
      if (c.parent_id) {
        const parent = byId[c.parent_id];
        if (parent) lookup.set(`${parent.name}||${c.name}`.toLowerCase(), c.id);
      } else {
        lookup.set(`${c.name}||`.toLowerCase(), c.id); // category only, no subcategory given
      }
    }

    const payloads = [];
    const errors = [];
    let skipped = 0;

    rows.forEach((r, i) => {
      const rowLabel = (r.sku && String(r.sku).trim()) || `row ${i + 1}`;
      const sku = String(r.sku || '').trim();
      const name = String(r.name || '').trim();
      if (!sku || !name) {
        skipped++;
        errors.push(`${rowLabel}: missing sku or name.`);
        return;
      }

      const mrp = Number(r.mrp);
      const selling_price = Number(r.selling_price);
      const stock = Number(r.stock);
      const gst_rate = Number(r.gst_rate);
      if (![mrp, selling_price, stock, gst_rate].every(Number.isFinite)) {
        skipped++;
        errors.push(`${rowLabel}: mrp / selling_price / stock / gst_rate must be plain numbers.`);
        return;
      }

      const category = String(r.category || '').trim();
      const subcategory = String(r.subcategory || '').trim();
      const category_id =
        lookup.get(`${category}||${subcategory}`.toLowerCase()) || lookup.get(`${category}||`.toLowerCase());
      if (!category_id) {
        skipped++;
        errors.push(`${rowLabel}: category/subcategory "${category} / ${subcategory}" doesn't match anything in the database.`);
        return;
      }

      payloads.push({
        sku,
        name,
        slug: slugify(name) + '-' + slugify(sku),
        category_id,
        brand: r.brand || null,
        mrp,
        selling_price,
        gst_rate,
        hsn_code: r.hsn_code || null,
        stock,
        weight_grams: r.weight_grams ? Number(r.weight_grams) : null,
        short_description: r.short_description || null,
        specifications: r.specifications || null,
        datasheet_url: r.datasheet_url || null,
        active: String(r.active ?? 'yes').toLowerCase() !== 'no',
        updated_at: new Date().toISOString(),
      });
    });

    let processed = 0;
    if (payloads.length > 0) {
      // One upsert call for the whole batch: existing SKUs are updated, new ones inserted.
      const { data, error } = await supabase.from('products').upsert(payloads, { onConflict: 'sku' }).select('id');
      if (error) throw error;
      processed = data?.length ?? payloads.length;
    }

    return json(200, { processed, skipped, errors });
  } catch (e) {
    return json(500, { error: e?.message || 'Import failed.' });
  }
}
