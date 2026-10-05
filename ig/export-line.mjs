// 用法: node export-line.mjs → out/line-cover.png (1040x1040) 與 out/line-list.png (1080 寬長圖)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('out', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
await p.goto('file://' + process.cwd() + '/line.html');
await p.waitForTimeout(500);
await (await p.$('#cover')).screenshot({ path: 'out/line-cover.png' });
await (await p.$('#list')).screenshot({ path: 'out/line-list.png' });
await b.close();
