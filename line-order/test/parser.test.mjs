import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOrder } from '../src/parser.mjs';
import { mkProducts } from './helpers.mjs';

const P = mkProducts();
const names = (r) => r.items.map((i) => `${i.product.name}:${i.qty}`);

test('單行多品項、全形空白與數字', () => {
  assert.deepEqual(names(parseOrder('蜜世界 2 顆　椪柑 5 斤', P)), ['蜜世界:2', '椪柑:5']);
  assert.deepEqual(names(parseOrder('蜜世界２顆 椪柑５斤', P)), ['蜜世界:2', '椪柑:5']);
});
test('換行、頓號、逗號分隔，含禮貌前綴', () => {
  assert.deepEqual(names(parseOrder('我要蜜世界2顆\n椪柑5斤、龍眼3斤，文旦 1 顆', P)), ['蜜世界:2', '椪柑:5', '十月龍眼:3', '老欉文旦:1']);
});
test('別名與模糊比對', () => {
  assert.deepEqual(names(parseOrder('蜜瓜 1 顆 美國蜜世界 1 顆', P)), ['蜜世界:2']);
});
test('英文品名含空格', () => {
  assert.deepEqual(names(parseOrder('San Clemente 蘋果 6 顆', P)), ['San Clemente 蘋果:6']);
});
test('中文數字需搭配單位，品名內的數字字不被誤判', () => {
  assert.deepEqual(names(parseOrder('椪柑三斤 蜜世界兩顆', P)), ['椪柑:3', '蜜世界:2']);
  assert.deepEqual(names(parseOrder('二十世紀梨 2 顆', P)), ['二十世紀梨:2']);
  assert.deepEqual(names(parseOrder('椪柑十五斤', P)), ['椪柑:15']);
});
test('小數數量', () => {
  assert.deepEqual(names(parseOrder('椪柑 2.5 斤', P)), ['椪柑:2.5']);
});
test('單位寫錯會被擋下、同義單位可通過', () => {
  const r = parseOrder('蜜世界 2 斤', P);
  assert.equal(r.unitMismatch.length, 1);
  assert.deepEqual(names(parseOrder('蜜世界 2 個', P)), ['蜜世界:2']);
  assert.deepEqual(names(parseOrder('椪柑 3 台斤', P)), ['椪柑:3']);
});
test('部分品名認不出：列入 unknown，不亂猜', () => {
  const r = parseOrder('蜜世界 2 顆 榴槤 3 顆', P);
  assert.deepEqual(names(r), ['蜜世界:2']);
  assert.deepEqual(r.unknown, ['榴槤']);
});
test('一般聊天不當成訂單', () => {
  for (const t of ['請問今天有什麼水果', '我 12 點去拿', '謝謝', '好的 3 點到', '地址是中山路 88 號']) {
    assert.equal(parseOrder(t, P).kind, 'chat', t);
  }
});
