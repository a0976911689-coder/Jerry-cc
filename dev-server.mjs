// Local dev server: static files from public/ + the same API handler Netlify runs.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { handle } from './lib/api.js';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const port = process.env.PORT || 8888;

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await handle(new Request(url, { method: req.method, headers: req.headers, body }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    if (process.env.FONT_DIR && url.pathname.startsWith('/__fonts/')) {
      const f = path.join(process.env.FONT_DIR, path.normalize(url.pathname.slice(9)));
      if (!f.startsWith(process.env.FONT_DIR)) throw new Error('bad path');
      const ext = path.extname(f);
      res.writeHead(200, { 'Content-Type': ext === '.css' ? 'text/css' : 'font/woff2' });
      return res.end(await fs.readFile(f));
    }
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    if (p === '/admin') p = '/admin.html';
    const file = path.join('public', path.normalize(p));
    if (!file.startsWith('public')) throw new Error('bad path');
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
