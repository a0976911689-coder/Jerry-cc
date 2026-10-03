import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'gzh-'));
process.env.ADMIN_PASSWORD = 'test-pass';
const { handle } = await import('../lib/api.js');

const NOW = new Date('2026-10-03T02:00:00Z');
const call = async (method, p, body, token) => {
  const r = await handle(new Request(`http://x/api${p}`, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), NOW);
  return { status: r.status, body: await r.json() };
};
const base = { name: '王小明', phone: '0912345678', method: 'pickup', date: '2026-10-06', qty: 2, packagingId: 'standard', cardText: '平安順心\n福氣滿滿' };

test('place a pickup order', async () => {
  const r = await call('POST', '/orders', base);
  assert.equal(r.status, 201);
  assert.equal(r.body.order.totals.total, 1200);
  assert.equal(r.body.order.lineOk, false); // LINE not configured, order still saved
});

test('delivery: only four districts, adds fee', async () => {
  const bad = await call('POST', '/orders', { ...base, method: 'delivery', district: '三民區', address: '某路1號' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /不在配送範圍/);
  const ok = await call('POST', '/orders', { ...base, method: 'delivery', district: '岡山區', address: '甘肅路1號' });
  assert.equal(ok.body.order.totals.total, 1250);
});

test('rejects same-day, too-short lead, bad input', async () => {
  assert.equal((await call('POST', '/orders', { ...base, date: '2026-10-03' })).status, 400);
  assert.equal((await call('POST', '/orders', { ...base, qty: 10 })).status, 400); // large needs 7 days
  assert.equal((await call('POST', '/orders', { ...base, phone: 'abc' })).status, 400);
  assert.equal((await call('POST', '/orders', { ...base, qty: 1.5 })).status, 400);
  assert.equal((await call('POST', '/orders', { ...base, cardText: 'x'.repeat(200) })).status, 400);
});

test('admin routes need login', async () => {
  assert.equal((await call('GET', '/admin/orders')).status, 401);
  assert.equal((await call('POST', '/admin/login', { password: 'nope' })).status, 401);
  const { body } = await call('POST', '/admin/login', { password: 'test-pass' });
  const list = await call('GET', '/admin/orders?date=2026-10-06', null, body.token);
  assert.equal(list.status, 200);
  assert.ok(list.body.orders.length >= 2);
  const id = list.body.orders[0].id;
  const up = await call('PATCH', `/admin/orders/${id}`, { status: 'confirmed', paid: true }, body.token);
  assert.equal(up.body.order.status, 'confirmed');
  const ov = await call('GET', '/admin/overview?date=2026-10-06', null, body.token);
  assert.equal(ov.body.prep.qty, 4);
});

test('daily cap enforced (counts custom orders, cancelled ones free the slot)', async () => {
  const { body: { token } } = await call('POST', '/admin/login', { password: 'test-pass' });
  const big = await call('POST', '/admin/orders', { kind: 'custom', name: '廟方', phone: '0912345678', method: 'pickup', date: '2026-10-07', amount: 499000, description: '特大禮盒' }, token);
  assert.equal(big.status, 201);
  const over = await call('POST', '/orders', { ...base, date: '2026-10-07', qty: 2 });
  assert.equal(over.status, 400);
  assert.match(over.body.error, /額滿/);
  await call('PATCH', `/admin/orders/${big.body.order.id}`, { status: 'cancelled' }, token);
  assert.equal((await call('POST', '/orders', { ...base, date: '2026-10-07', qty: 2 })).status, 201);
});

test('public month calendar needs no login and matches the owner poster', async () => {
  const r = await call('GET', '/calendar?month=2026-10');
  assert.equal(r.status, 200);
  assert.equal(r.body.days.length, 31);
  assert.equal(r.body.days[25].open, true); // 10/26 special opening
  assert.equal(r.body.days[4].open, false); // 10/5 Monday closed
  assert.equal(r.body.days[9].tag, '敬果日'); // 10/10
  assert.equal((await call('GET', '/calendar?month=bad')).status, 400);
});

test('sheet/email notification posts a row and survives failures', async () => {
  const { pushToSheet, sheetRow } = await import('../lib/notify.js');
  const order = { id: 'X-1', createdAt: '2026-10-03T00:00:00Z', date: '2026-10-07', dateInfo: { lunarMonth: '九月', lunarDay: '十七', tag: '' },
    method: 'delivery', customer: { name: '王', phone: '0912345678', district: '岡山區', address: '甘肅路1號' }, kind: 'standard', qty: 2,
    packagingName: '標準包裝', cardText: '平安', note: '', totals: { total: 1250, shipping: 50 } };
  assert.equal(sheetRow(order).length, 15);
  assert.equal((await pushToSheet(order)).ok, false); // not configured
  process.env.GOOGLE_SCRIPT_URL = 'https://script.example/exec'; process.env.GOOGLE_SCRIPT_SECRET = 's';
  let sent;
  const ok = await pushToSheet(order, async (u, init) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ ok: true })); });
  assert.equal(ok.ok, true); assert.equal(sent.secret, 's'); assert.equal(sent.total, 1250);
  assert.equal((await pushToSheet(order, async () => new Response('x', { status: 500 }))).ok, false);
  assert.equal((await pushToSheet(order, async () => { throw new Error('net'); })).ok, false);
  delete process.env.GOOGLE_SCRIPT_URL; delete process.env.GOOGLE_SCRIPT_SECRET;
});
