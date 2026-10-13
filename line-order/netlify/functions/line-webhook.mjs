import { loadConfig } from '../../src/config.mjs';
import { verifySignature, createLineClient } from '../../src/line.mjs';
import { createGoogleAuth, createSheetsApi } from '../../src/google.mjs';
import { createSheetsStore } from '../../src/store-sheets.mjs';
import { createBot } from '../../src/bot.mjs';

const config = loadConfig();
let bot; // 暖機後重複使用，讓價格快取生效
function getBot() {
  if (!bot) {
    const api = createSheetsApi({
      sheetId: config.sheetId,
      getToken: createGoogleAuth({ email: config.googleEmail, privateKey: config.googleKey }),
    });
    bot = createBot({
      store: createSheetsStore(api, { cacheSeconds: config.priceCacheSeconds }),
      line: createLineClient(config.lineToken),
      config,
    });
  }
  return bot;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'ok' };
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body || '', 'utf8');
  if (!verifySignature(raw, event.headers['x-line-signature'], config.lineSecret)) {
    return { statusCode: 401, body: 'invalid signature' };
  }
  const { events = [] } = JSON.parse(raw.toString('utf8'));
  const b = getBot();
  // 逐一處理；單一事件出錯不影響其他事件，也一律回 200 避免 LINE 重送風暴
  for (const e of events) {
    try { await b(e); } catch (err) { console.error('event failed', e.type, err); }
  }
  return { statusCode: 200, body: 'ok' };
};
