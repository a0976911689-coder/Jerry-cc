import crypto from 'node:crypto';

const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (p) => crypto.createHmac('sha256', secret()).update(p).digest('base64url');

export function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueToken(hours = 12) {
  const payload = b64(JSON.stringify({ exp: Date.now() + hours * 3600e3 }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!secret() || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
