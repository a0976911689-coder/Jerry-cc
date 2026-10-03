import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Tiny key-value store: Netlify Blobs in production, JSON files locally. */
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
  cached = process.env.NETLIFY && process.env.USE_LOCAL_STORE !== '1'
    ? await netlifyStore()
    : fileStore(process.env.DATA_DIR || '.data');
  return cached;
}

/** Serialises writes inside one function instance (orders are low-volume). */
let chain = Promise.resolve();
export function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}
