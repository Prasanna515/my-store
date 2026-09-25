import { checkPassword, createSessionValue, COOKIE } from '../../../lib/admin-auth.js';

export const prerender = false;

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request, cookies }) {
  try {
    const { password } = await request.json();
    const ok = await checkPassword(password);
    if (!ok) return json(401, { error: 'Incorrect password.' });
    const value = await createSessionValue();
    cookies.set(COOKIE, value, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 12 });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e?.message || 'Login error.' });
  }
}
