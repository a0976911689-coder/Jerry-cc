import test from 'node:test';
import assert from 'node:assert/strict';
import { setup, mkProducts } from './helpers.mjs';
import { verifySignature } from '../src/line.mjs';
import crypto from 'node:crypto';

const U = 'Ucustomer';
const replyText = (s) => s.sent.filter((x) => x.kind === 'reply').at(-1).msgs.map((m) => m.text || '').join('\n');

test('完整流程：下單 → 確認 → 通知店家，價格與小計正確', async () => {
  const s = setup();
  await s.say(U, '蜜世界 2 顆　椪柑 5 斤');
  const first = s.sent.at(-1).msgs;
  assert.match(first[0].text, /10\/7 \(三\) 出貨/);
  assert.match(first[0].text, /蜜世界 2顆 × 150 ＝ 300/);
  assert.match(first[0].text, /椪柑 5斤 × 60 ＝ 300/);
  assert.match(first[0].text, /合計 600 元/);
  assert.match(first[0].text, /實際金額以秤重為準/);
  assert.equal(first[1].template.type, 'confirm');
  const id = first[1].template.actions[0].data.split('id=')[1];
  assert.equal((await s.store.getOrder(id)).status, '待確認');

  await s.press(U, `a=confirm&id=${id}`);
  assert.equal((await s.store.getOrder(id)).status, '已確認');
  assert.match(replyText(s), /已收到您的訂單/);
  const push = s.sent.find((x) => x.kind === 'push');
  assert.equal(push.to, 'SHOP');
  assert.match(push.msgs[0].text, /新訂單/);
});

test('重複按確認不會重複通知店家', async () => {
  const s = setup();
  await s.say(U, '蜜世界 1 顆');
  const id = s.sent.at(-1).msgs[1].template.actions[0].data.split('id=')[1];
  await s.press(U, `a=confirm&id=${id}`);
  await s.press(U, `a=confirm&id=${id}`);
  assert.equal(s.sent.filter((x) => x.kind === 'push').length, 1);
  assert.match(replyText(s), /不用重複送出/);
});

test('重傳整份訂單：舊的待確認訂單被取代，無法再確認', async () => {
  const s = setup();
  await s.say(U, '蜜世界 1 顆');
  const id1 = s.sent.at(-1).msgs[1].template.actions[0].data.split('id=')[1];
  await s.say(U, '蜜世界 3 顆');
  await s.press(U, `a=confirm&id=${id1}`);
  assert.equal((await s.store.getOrder(id1)).status, '已取代');
  assert.match(replyText(s), /已失效/);
});

test('取消訂單；他人不能確認別人的訂單', async () => {
  const s = setup();
  await s.say(U, '椪柑 1 斤');
  const id = s.sent.at(-1).msgs[1].template.actions[0].data.split('id=')[1];
  await s.press('Uother', `a=confirm&id=${id}`);
  assert.equal((await s.store.getOrder(id)).status, '待確認');
  await s.press(U, `a=cancel&id=${id}`);
  assert.equal((await s.store.getOrder(id)).status, '已取消');
});

test('一般聊天不回覆；認不出品項會回覆並不建立訂單', async () => {
  const s = setup();
  await s.say(U, '請問今天有什麼水果');
  assert.equal(s.sent.length, 0);
  await s.say(U, '蜜世界 2 顆 榴槤 3 顆');
  assert.match(replyText(s), /找不到品項：榴槤/);
  assert.equal(s.store._orders.size, 0);
});

test('暫無供應的品項不能下單', async () => {
  const s = setup();
  await s.say(U, '水梨 2 顆');
  assert.match(replyText(s), /今日暫無：二十世紀梨/);
  assert.equal(s.store._orders.size, 0);
});

test('價格沒更新：不報昨天的價，改通知店家待報價', async () => {
  const s = setup({ products: mkProducts('2026-10-05') });
  await s.say(U, '蜜世界 2 顆');
  assert.match(replyText(s), /價格確認中/);
  assert.equal(s.store._orders.size, 0);
  const push = s.sent.find((x) => x.kind === 'push');
  assert.match(push.msgs[0].text, /價格未更新/);
  assert.match(push.msgs[0].text, /蜜世界 2 顆/);
});

test('客戶專屬價優先，且不受「今日價未更新」影響', async () => {
  const s = setup({ products: mkProducts('2026-10-05'), customerPrices: [{ userId: U, name: '椪柑', price: 50 }] });
  await s.say(U, '椪柑 10 斤');
  assert.match(s.sent.at(-1).msgs[0].text, /椪柑 10斤 × 50 ＝ 500/);
});

test('店主指令：改價、今日沿用；非店主無效', async () => {
  const s = setup({ products: mkProducts('2026-10-05') });
  await s.say('Ucustomer', '改價 蜜世界 999'); // 非店主：不會改價（會被當一般訂單文字處理）
  assert.equal((await s.store.getProducts()).find((p) => p.name === '蜜世界').price, 150);
  await s.say('SHOP', '改價 蜜世界 160');
  assert.match(replyText(s), /已更新：蜜世界 160 元/);
  await s.say('SHOP', '今日沿用');
  await s.say(U, '蜜世界 1 顆');
  assert.match(s.sent.at(-1).msgs[0].text, /蜜世界 1顆 × 160 ＝ 160/);
});

test('LINE 簽章驗證', () => {
  const body = '{"events":[]}';
  const sig = crypto.createHmac('sha256', 'secret').update(body).digest('base64');
  assert.equal(verifySignature(Buffer.from(body), sig, 'secret'), true);
  assert.equal(verifySignature(Buffer.from(body + ' '), sig, 'secret'), false);
  assert.equal(verifySignature(Buffer.from(body), '', 'secret'), false);
});
