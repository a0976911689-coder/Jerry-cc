import { createMemoryStore } from '../src/store-memory.mjs';
import { createBot } from '../src/bot.mjs';
import { loadConfig } from '../src/config.mjs';

export const TODAY = '2026-10-06';
export const NOW = new Date('2026-10-06T02:00:00Z'); // 台北 10/6 (二) 10:00

export const mkProducts = (date = TODAY) => [
  { name: '蜜世界', aliases: ['蜜瓜', '美國蜜世界'], unit: '顆', price: 150, available: true, priceDate: date },
  { name: '椪柑', aliases: ['東山椪柑'], unit: '斤', price: 60, available: true, priceDate: date },
  { name: '十月龍眼', aliases: ['龍眼'], unit: '斤', price: 80, available: true, priceDate: date },
  { name: '老欉文旦', aliases: ['文旦'], unit: '顆', price: 120, available: true, priceDate: date },
  { name: 'San Clemente 蘋果', aliases: ['蘋果'], unit: '顆', price: 45, available: true, priceDate: date },
  { name: '二十世紀梨', aliases: ['水梨'], unit: '顆', price: 70, available: false, priceDate: date },
];

export function setup({ products = mkProducts(), customerPrices = [], env = {} } = {}) {
  const sent = [];
  const line = {
    reply: async (token, msgs) => { sent.push({ kind: 'reply', msgs }); },
    push: async (to, msgs) => { sent.push({ kind: 'push', to, msgs }); },
    displayName: async () => '測試客人',
  };
  const store = createMemoryStore({ products, customerPrices });
  const config = loadConfig({ SHOP_LINE_USER_ID: 'SHOP', ...env });
  const bot = createBot({ store, line, config, now: () => NOW, log: { error() {} } });
  const say = (userId, t) => bot({ type: 'message', replyToken: 'r', source: { userId }, message: { type: 'text', text: t } });
  const press = (userId, data) => bot({ type: 'postback', replyToken: 'r', source: { userId }, postback: { data } });
  return { store, sent, say, press, bot };
}
