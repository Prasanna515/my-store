import { COOKIE } from '../../../lib/admin-auth.js';

export const prerender = false;

export async function POST({ cookies }) {
  cookies.delete(COOKIE, { path: '/' });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
