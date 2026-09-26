import { getSupabase } from '../../lib/supabase.js';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function GET({ url }) {
  try {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) return json(200, { results: [] });
    const safe = q.replace(/[,()%*]/g, ' ').trim();

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('slug,name,sku,selling_price,image_url,stock')
      .eq('active', true)
      .or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,brand.ilike.%${safe}%`)
      .order('name')
      .limit(8);
    if (error) throw error;

    return json(200, { results: data || [] });
  } catch (e) {
    return json(500, { error: e?.message || 'Search failed.' });
  }
}
