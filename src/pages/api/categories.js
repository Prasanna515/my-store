import { getSupabase } from '../lib/supabase.js';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('categories').select('*').order('sort_order');
    if (error) throw error;

    const parents = (data || []).filter((c) => !c.parent_id);
    const children = {};
    (data || []).forEach((c) => {
      if (c.parent_id) {
        if (!children[c.parent_id]) children[c.parent_id] = [];
        children[c.parent_id].push(c);
      }
    });

    return json(200, { parents, children });
  } catch (e) {
    return json(500, { error: e?.message || 'Failed to load categories.' });
  }
}
