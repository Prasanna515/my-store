import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from 'astro:env/server';

// Public (read-only) access. Security rules in the database allow visitors to read products only.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
