import { verifySessionValue, COOKIE } from '../../../lib/admin-auth.js';
import { getServiceSupabase } from '../../../lib/supabase.js';

export const prerender = false;

const BUCKET = 'product-images';

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request, cookies }) {
  try {
    const authed = await verifySessionValue(cookies.get(COOKIE)?.value);
    if (!authed) return json(401, { error: 'Not logged in.' });

    const form = await request.formData();
    const files = form.getAll('files');
    if (!files.length) return json(400, { error: 'No files received.' });

    const supabase = getServiceSupabase();
    const results = [];

    for (const file of files) {
      const filename = file.name || '';
      const dot = filename.lastIndexOf('.');
      if (dot <= 0) {
        results.push(`${filename}: skipped — no file extension.`);
        continue;
      }
      const sku = filename.slice(0, dot).trim();
      const ext = filename.slice(dot + 1).toLowerCase();
      const path = `${sku}.${ext}`;

      const bytes = await file.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type || 'image/jpeg', upsert: true });
      if (upErr) {
        results.push(`${filename}: upload failed — ${upErr.message}`);
        continue;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: updErr, count } = await supabase
        .from('products')
        .update({ image_url: pub.publicUrl }, { count: 'exact' })
        .eq('sku', sku);
      if (updErr) {
        results.push(`${filename}: uploaded, but couldn't save the link — ${updErr.message}`);
      } else if (!count) {
        results.push(`${filename}: uploaded, but no product has SKU "${sku}" — check the file is named exactly after the SKU.`);
      } else {
        results.push(`${filename}: done ✓`);
      }
    }

    return json(200, { results });
  } catch (e) {
    return json(500, { error: e?.message || 'Upload failed.' });
  }
}
