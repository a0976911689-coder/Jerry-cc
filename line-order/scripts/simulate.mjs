// 本機模擬：不連 LINE、不連 Google，直接在終端機測試對話流程。
// 用法：npm run simulate    （輸入訂單文字；按鈕請輸入「確認下單」或「取消」；輸入 q 離開）
import readline from 'node:readline';
import { createMemoryStore } from '../src/store-memory.mjs';
import { createBot } from '../src/bot.mjs';
import { loadConfig } from '../src/config.mjs';
import { todayISO } from '../src/time.mjs';

const today = todayISO();
const store = createMemoryStore({ products: [
  { name: '蜜世界', aliases: ['蜜瓜', '美國蜜世界'], unit: '顆', price: 150, available: true, priceDate: today },
  { name: '椪柑', aliases: ['東山椪柑'], unit: '斤', price: 60, available: true, priceDate: today },
  { name: '十月龍眼', aliases: ['龍眼'], unit: '斤', price: 80, available: true, priceDate: today },
  { name: '老欉文旦', aliases: ['文旦'], unit: '顆', price: 120, available: true, priceDate: today },
  { name: 'San Clemente 蘋果', aliases: ['蘋果'], unit: '顆', price: 45, available: true, priceDate: today },
] });
let lastOrderId = '';
const show = (msgs) => msgs.forEach((m) => {
  if (m.type === 'text') console.log(`\n🤖 ${m.text.replace(/\n/g, '\n   ')}`);
  else { lastOrderId = m.template.actions[0].data.split('id=')[1]; console.log(`\n🤖 ${m.template.text}  [確認下單] [取消]`); }
});
const line = { reply: async (_t, m) => show(m), push: async (_to, m) => { console.log('\n📣 (通知店家)'); show(m); }, displayName: async () => '模擬客人' };
const bot = createBot({ store, line, config: loadConfig({ SHOP_LINE_USER_ID: 'SHOP' }) });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '\n你> ' });
console.log('英仔水果 LINE 訂單機器人（本機模擬）。試試：蜜世界 2 顆 椪柑 5 斤');
rl.prompt();
for await (const l of rl) {
  const t = l.trim();
  if (t === 'q') break;
  if (t === '確認下單' || t === '取消') await bot({ type: 'postback', replyToken: 'x', source: { userId: 'U1' }, postback: { data: `a=${t === '取消' ? 'cancel' : 'confirm'}&id=${lastOrderId}` } });
  else if (t) await bot({ type: 'message', replyToken: 'x', source: { userId: 'U1' }, message: { type: 'text', text: t } });
  rl.prompt();
}
rl.close();
