import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Tiny key-value store: Redis (Vercel) or Netlify Blobs in production, JSON files locally. */
async function netlifyStore() {
  const { getStore } = await import('@netlify/blobs');
  const st = getStore('guozihang');
  return {
    get: (k) => st.get(k, { type: 'json' }),
    set: (k, v) => st.setJSON(k, v),
    async list(prefix) {
      const { blobs } = await st.list({ prefix });
      return blobs.map((b) => b.key);
    },
  };
}

/**
 * Redis over HTTP (Upstash REST API) — what Vercel's Redis / KV marketplace integration provides.
 * Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL + KV_REST_API_TOKEN.
 */
export function redisStore(url, token, fetchImpl = fetch, ns = 'gzh:') {
  const cmd = async (...args) => {
    const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(`Redis: ${data.error || res.status}`);
    return data.result;
  };
  return {
    async get(k) { const v = await cmd('GET', ns + k); return v == null ? null : JSON.parse(v); },
    async set(k, v) { await cmd('SET', ns + k, JSON.stringify(v)); },
    async list(prefix) {
      const keys = []; let cursor = '0';
      do {
        const [next, batch] = await cmd('SCAN', cursor, 'MATCH', `${ns}${prefix}*`, 'COUNT', 200);
        keys.push(...batch.map((k) => k.slice(ns.length))); cursor = String(next);
      } while (cursor !== '0');
      return [...new Set(keys)];
    },
  };
}

function fileStore(dir) {
  const file = (k) => path.join(dir, encodeURIComponent(k) + '.json');
  return {
    async get(k) {
      try { return JSON.parse(await fs.readFile(file(k), 'utf8')); } catch { return null; }
    },
    async set(k, v) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file(k), JSON.stringify(v));
    },
    async list(prefix) {
      try {
        const names = await fs.readdir(dir);
        return names.map((n) => decodeURIComponent(n.replace(/\.json$/, ''))).filter((k) => k.startsWith(prefix));
      } catch { return []; }
    },
  };
}

let cached;
export async function getStoreInstance() {
  if (cached) return cached;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (process.env.USE_LOCAL_STORE === '1') cached = fileStore(process.env.DATA_DIR || '.data');
  else if (redisUrl && redisToken) cached = redisStore(redisUrl, redisToken);       // Vercel (or anywhere)
  else if (process.env.NETLIFY) cached = await netlifyStore();                         // Netlify
  else cached = fileStore(process.env.DATA_DIR || '.data');                            // local dev / tests
  return cached;
}

/** Serialises writes inside one function instance (orders are low-volume). */
let chain = Promise.resolve();
export function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}
