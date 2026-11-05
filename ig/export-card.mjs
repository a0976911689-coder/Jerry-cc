// 用法: node export-card.mjs → out/card-<品項>.png (1080x1350)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('out', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1200, height: 1500 } });
await p.goto('file://' + process.cwd() + '/card.html');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
for (const el of await p.$$('.card')) await el.screenshot({ path: `out/card-${await el.getAttribute('data-file')}.png` });
await b.close();
