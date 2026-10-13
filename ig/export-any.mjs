// 用法: node export-any.mjs <檔名.html> <輸出前綴>  → out/<前綴>-1.png …（每個 .slide 一張）
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const [file, prefix] = process.argv.slice(2);
mkdirSync('out', { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1200, height: 1500 } });
await p.goto('file://' + process.cwd() + '/' + file);
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
const els = await p.$$('.slide');
for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: `out/${prefix}-${i + 1}.png` });
await b.close();
