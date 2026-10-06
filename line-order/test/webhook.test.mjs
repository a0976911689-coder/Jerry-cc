import test from 'node:test';
import assert from 'node:assert/strict';

process.env.LINE_CHANNEL_SECRET = 'secret';
const { handler } = await import('../netlify/functions/line-webhook.mjs');

test('沒有有效簽章的請求一律 401', async () => {
  const r = await handler({ httpMethod: 'POST', headers: {}, body: '{"events":[]}' });
  assert.equal(r.statusCode, 401);
  const r2 = await handler({ httpMethod: 'POST', headers: { 'x-line-signature': 'bad' }, body: '{"events":[]}' });
  assert.equal(r2.statusCode, 401);
});
test('LINE 後台按 Verify（空 events 且簽章正確）回 200', async () => {
  const crypto = await import('node:crypto');
  const body = '{"events":[]}';
  const sig = crypto.createHmac('sha256', 'secret').update(body).digest('base64');
  const r = await handler({ httpMethod: 'POST', headers: { 'x-line-signature': sig }, body });
  assert.equal(r.statusCode, 200);
});
