import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheetsStore } from '../src/store-sheets.mjs';

// 以記憶體模擬 Google Sheets REST，檢查欄位對應與狀態更新
function fakeApi(tabs) {
  const colIdx = (c) => c.charCodeAt(0) - 65;
  return {
    calls: [],
    async get(range) {
      const [tab, cells] = range.split('!');
      const startRow = Number(cells.match(/A(\d+)/)[1]);
      return (tabs[tab] || []).slice(startRow - 1).map((r) => [...r]);
    },
    async append(range, rows) { (tabs[range.split('!')[0]] ||= [[]]).push(...rows.map((r) => r.map(String))); },
    async batchUpdate(data) {
      for (const { range, values } of data) {
        const [tab, cell] = range.split('!');
        const [, col, row] = cell.match(/([A-Z])(\d+)/);
        tabs[tab][Number(row) - 1][colIdx(col)] = String(values[0][0]);
      }
    },
  };
}

const header = [['品名']];
test('商品表欄位解析、別名、供應中、更新日期', async () => {
  const tabs = { 今日價格: [...header, ['蜜世界', '蜜瓜、美國蜜世界', '顆', '150', '是', '2026-10-06'], ['水梨', '', '顆', '70', '否', '2026-10-06']] };
  const ps = await createSheetsStore(fakeApi(tabs), { cacheSeconds: 0 }).getProducts();
  assert.deepEqual(ps[0], { row: 2, name: '蜜世界', aliases: ['蜜瓜', '美國蜜世界'], unit: '顆', price: 150, available: true, priceDate: '2026-10-06' });
  assert.equal(ps[1].available, false);
});

test('訂單寫入、讀回、狀態更新、改價', async () => {
  const tabs = {
    今日價格: [...header, ['蜜世界', '', '顆', '150', '是', '2026-10-05']],
    客戶專屬價: [['id'], ['U1', '蜜世界', '140', '某宮廟']],
    訂單: [['編號']],
  };
  const store = createSheetsStore(fakeApi(tabs), { cacheSeconds: 0 });
  const order = { id: '1006-AB12', createdAt: '2026-10-06 10:00', shipDate: '2026-10-07', userId: 'U1', userName: '王小明',
    lines: [{ name: '蜜世界', qty: 2, unit: '顆', price: 150, subtotal: 300 }, { name: '椪柑', qty: 5, unit: '斤', price: 60, subtotal: 300 }],
    total: 600, status: '待確認' };
  await store.insertOrder(order);
  assert.equal(tabs.訂單.length, 3);
  const back = await store.getOrder('1006-AB12');
  assert.equal(back.total, 600);
  assert.equal(back.lines.length, 2);
  assert.equal(back.lines[1].subtotal, 300);
  assert.deepEqual(await store.listOrderIdsByUser('U1', '待確認'), ['1006-AB12']);
  await store.setOrderStatus('1006-AB12', '已確認');
  assert.equal(tabs.訂單[1][11], '已確認');
  assert.equal(tabs.訂單[2][11], '已確認');
  assert.deepEqual(await store.listOrderIdsByUser('U1', '待確認'), []);
  assert.equal((await store.getCustomerPrices('U1')).get('蜜世界'), 140);
  assert.equal(await store.setPrice('蜜世界', 160, '2026-10-06'), true);
  assert.equal(tabs.今日價格[1][3], '160');
  assert.equal(tabs.今日價格[1][5], '2026-10-06');
  assert.equal(await store.touchPrices('2026-10-07'), 1);
  assert.equal(tabs.今日價格[1][5], '2026-10-07');
});
