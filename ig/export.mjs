// 用法: node export.mjs  → 產出 out/slide-1.png ... slide-6.png (1080x1350)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('out', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1200, height: 1500 } });
await p.goto('file://' + process.cwd() + '/carousel.html');
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
const els = await p.$$('.slide');
for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: `out/slide-${i + 1}.png` });
await b.close();
