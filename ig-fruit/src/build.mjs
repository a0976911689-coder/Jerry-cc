import { chromium } from '/tmp/claude-0/-home-user-Jerry-cc/66edea67-634d-5e2a-b92f-cd6357b95076/scratchpad/node_modules/playwright-core/index.mjs';
import { fruits } from './data.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'out');
fs.mkdirSync(out, { recursive: true });

const css = `
@font-face{font-family:'Noto Sans TC';font-weight:400;src:url(file://${here}/fonts/sans400.ttf)}
@font-face{font-family:'Noto Sans TC';font-weight:500;src:url(file://${here}/fonts/sans500.ttf)}
@font-face{font-family:'Noto Serif TC';font-weight:700;src:url(file://${here}/fonts/serif700.ttf)}
@font-face{font-family:'Noto Serif TC';font-weight:900;src:url(file://${here}/fonts/serif900.ttf)}
:root{--bg:#faf6ef;--wine:#722f37;--ink:#3a2a26;--rule:#d9c9b6;--tan:#b8a58a}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1350px;background:var(--bg);color:var(--ink);font-family:'Noto Sans TC',sans-serif;position:relative;overflow:hidden}
.frame{position:absolute;inset:44px;border:1.5px solid var(--tan)}
.top{position:absolute;left:92px;right:92px;top:84px;display:flex;justify-content:space-between;font-size:24px;letter-spacing:.28em;color:var(--wine);font-weight:500}
.foot{position:absolute;left:92px;right:92px;bottom:84px;display:flex;justify-content:space-between;align-items:flex-end;font-size:22px;letter-spacing:.2em;color:var(--tan)}
.foot img{height:78px}
.serif{font-family:'Noto Serif TC',serif}
.rule{height:1.5px;background:var(--rule)}
`;

const shell = (inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="frame"></div>${inner}</body></html>`;
const top = (f, label) => `<div class="top"><span>${label}</span><span>${String(f.n).padStart(2,'0')} / 07</span></div>`;
const foot = (right='英仔果子行') => `<div class="foot"><img src="logo.png"><span>${right}</span></div>`;

function cover(f){
  return shell(`${top(f,'FRUIT NOTE')}
  <div style="position:absolute;left:92px;top:190px;right:92px;bottom:230px">
    <div style="display:flex;gap:56px;height:100%">
      <div class="serif" style="writing-mode:vertical-rl;font-size:330px;font-weight:900;color:var(--wine);line-height:1;letter-spacing:.04em;padding-top:8px">${f.name}</div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:20px 0 6px">
        <div>
          <div style="display:inline-block;border:1.5px solid var(--wine);color:var(--wine);padding:8px 22px;font-size:26px;letter-spacing:.2em">${f.season}</div>
          <div style="margin-top:34px;font-size:22px;letter-spacing:.34em;color:var(--tan)">${f.en}</div>
        </div>
        <div>
          <div class="serif" style="font-size:78px;font-weight:900;line-height:1.3">${f.title[0]}<br><span style="color:var(--wine)">${f.title[1]}</span></div>
          <div class="rule" style="margin:34px 0"></div>
          <div style="font-size:30px;line-height:1.7;color:#5a4640;text-wrap:balance">${f.hook}</div>
        </div>
      </div>
    </div>
  </div>${foot('滑動看完整挑法 →')}`);
}

const point = (i,p) => `<div style="padding:56px 0">
  <div style="display:flex;align-items:baseline;gap:34px">
    <div class="serif" style="font-size:150px;font-weight:900;color:var(--wine);line-height:.9;width:190px;flex:none">${String(i).padStart(2,'0')}</div>
    <div><div style="font-size:24px;letter-spacing:.3em;color:var(--tan)">${p[0]}</div>
      <div class="serif" style="font-size:56px;font-weight:900;margin-top:10px;line-height:1.3">${p[1]}</div></div>
  </div>
  <div style="margin:32px 0 0 224px;font-size:31px;line-height:1.75;color:#5a4640;text-wrap:pretty">${p[2]}</div></div>`;

function points12(f){
  return shell(`${top(f,f.name+' · 挑選重點')}
  <div style="position:absolute;left:92px;right:92px;top:200px">${point(1,f.points[0])}<div class="rule"></div>${point(2,f.points[1])}</div>${foot('繼續滑動 →')}`);
}
function points3(f){
  return shell(`${top(f,f.name+' · 挑選重點')}
  <div style="position:absolute;left:92px;right:92px;top:200px">${point(3,f.points[2])}<div class="rule"></div>
    <div style="margin-top:64px;background:var(--wine);color:var(--bg);padding:52px 56px">
      <div style="font-size:22px;letter-spacing:.34em;opacity:.75">小提醒 · TIP</div>
      <div class="serif" style="font-size:46px;font-weight:700;line-height:1.55;margin-top:20px;text-wrap:balance">${f.tip}</div>
    </div></div>${foot('繼續滑動 →')}`);
}
function end(f){
  const next = fruits[f.n % fruits.length];
  return shell(`${top(f,'SUMMARY')}
  <div style="position:absolute;left:92px;right:92px;top:210px">
    <div class="serif" style="font-size:40px;font-weight:700;color:var(--wine);letter-spacing:.1em">${f.name}・三步驟記起來</div>
    <div class="rule" style="margin:30px 0 10px"></div>
    ${f.points.map((p,i)=>`<div style="display:flex;gap:30px;align-items:baseline;padding:30px 0;border-bottom:1.5px solid var(--rule)"><span class="serif" style="font-size:44px;color:var(--wine);font-weight:900">${String(i+1).padStart(2,'0')}</span><span class="serif" style="font-size:44px;font-weight:700">${p[1]}</span></div>`).join('')}
    <div style="margin-top:70px;text-align:center">
      <div class="serif" style="font-size:60px;font-weight:900;line-height:1.5">收藏起來，<br>下次買水果就不踩雷</div>
      <div style="margin-top:36px;font-size:28px;color:#5a4640;letter-spacing:.1em">追蹤我們，下一篇：<b style="color:var(--wine)">${next.name}</b></div>
    </div></div>${foot('LINE 訂購請見個人檔案連結')}`);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
fs.copyFileSync(path.join(here,'logo.png'), path.join(out,'logo.png'));
const only = process.argv[2] ? +process.argv[2] : null;
for (const f of fruits){
  if (only && f.n!==only) continue;
  const slides = [cover,points12,points3,end];
  for (let i=0;i<slides.length;i++){
    const file = path.join(out, `_s.html`);
    fs.writeFileSync(file, slides[i](f));
    const page = await browser.newPage({ viewport:{width:1080,height:1350} });
    await page.goto('file://'+file);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(400);
    const name = `fruit${f.n}-${f.name}-${i+1}.png`;
    await page.screenshot({ path: path.join(out,name) });
    await page.close();
    console.log(name);
  }
}
fs.rmSync(path.join(out,'_s.html'),{force:true});
await browser.close();
