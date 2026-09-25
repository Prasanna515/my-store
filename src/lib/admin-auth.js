import { env as cfEnv } from 'cloudflare:workers';

export const COOKIE = 'admin_session';
const SESSION_HOURS = 12;

async function hmac(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getPassword() {
  const pw = (cfEnv.ADMIN_PASSWORD || '').trim();
  if (!pw) throw new Error('ADMIN_PASSWORD is not set. Add it in Cloudflare > Settings > Variables and Secrets as a Secret.');
  return pw;
}

export async function checkPassword(input) {
  const pw = getPassword();
  return typeof input === 'string' && input.length > 0 && input === pw;
}

export async function createSessionValue() {
  const pw = getPassword();
  const expiry = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const sig = await hmac(pw, String(expiry));
  return `${expiry}.${sig}`;
}

export async function verifySessionValue(value) {
  if (!value) return false;
  const [expiryStr, sig] = value.split('.');
  if (!expiryStr || !sig) return false;
  const expiry = Number(expiryStr);
  if (!expiry || Date.now() > expiry) return false;
  const pw = getPassword();
  const expected = await hmac(pw, expiryStr);
  return expected === sig;
}
