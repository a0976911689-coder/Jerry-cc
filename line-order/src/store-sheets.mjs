// Google 試算表版儲存。分頁與欄位見 README / sheet-templates。
const PRICE_TAB = '今日價格';   // A品名 B別名(以、分隔) C單位 D今日單價 E供應中(是/否) F更新日期
const CUSTOMER_TAB = '客戶專屬價'; // A LINE UserID B品名 C單價 D客戶名稱(僅供人看)
const ORDER_TAB = '訂單';       // A編號 B建立 C出貨日 D UserID E客人 F品名 G數量 H單位 I單價 J小計 K總額 L狀態 M實收金額 N備註
const STATUS_COL = 'L';

export function createSheetsStore(api, { cacheSeconds = 30 } = {}) {
  let cache = { at: 0, products: [] };

  async function loadProducts() {
    if (Date.now() - cache.at < cacheSeconds * 1000) return cache.products;
    const rows = await api.get(`${PRICE_TAB}!A2:F`);
    cache = {
      at: Date.now(),
      products: rows.map((r, i) => ({
        row: i + 2,
        name: (r[0] || '').trim(),
        aliases: (r[1] || '').split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
        unit: (r[2] || '').trim(),
        price: Number(r[3]),
        available: !['否', 'N', 'n', 'no', 'FALSE', 'false'].includes((r[4] || '是').trim()),
        priceDate: (r[5] || '').trim(),
      })).filter((p) => p.name && p.unit),
    };
    return cache.products;
  }
  const bust = () => { cache.at = 0; };

  const rowsToOrder = (rows) => {
    const first = rows[0];
    return {
      id: first.r[0], createdAt: first.r[1], shipDate: first.r[2], userId: first.r[3], userName: first.r[4],
      total: Number(first.r[10]), status: first.r[11],
      lines: rows.map(({ r }) => ({ name: r[5], qty: Number(r[6]), unit: r[7], price: Number(r[8]), subtotal: Number(r[9]) })),
      rowNumbers: rows.map((x) => x.row),
    };
  };
  const readOrders = async () => (await api.get(`${ORDER_TAB}!A2:N`)).map((r, i) => ({ r, row: i + 2 }));

  return {
    kind: 'sheets',
    getProducts: loadProducts,
    async getCustomerPrices(userId) {
      const rows = await api.get(`${CUSTOMER_TAB}!A2:D`);
      return new Map(rows.filter((r) => r[0] === userId && r[1] && r[2] !== undefined).map((r) => [r[1].trim(), Number(r[2])]));
    },
    async insertOrder(o) {
      await api.append(`${ORDER_TAB}!A:N`, o.lines.map((l) => [
        o.id, o.createdAt, o.shipDate, o.userId, o.userName, l.name, l.qty, l.unit, l.price, l.subtotal, o.total, o.status, '', '',
      ]));
    },
    async getOrder(id) {
      const rows = (await readOrders()).filter((x) => x.r[0] === id);
      return rows.length ? rowsToOrder(rows) : null;
    },
    async setOrderStatus(id, status) {
      const rows = (await readOrders()).filter((x) => x.r[0] === id);
      if (!rows.length) return false;
      await api.batchUpdate(rows.map((x) => ({ range: `${ORDER_TAB}!${STATUS_COL}${x.row}`, values: [[status]] })));
      return true;
    },
    async listOrderIdsByUser(userId, status) {
      const rows = (await readOrders()).filter((x) => x.r[3] === userId && x.r[11] === status);
      return [...new Set(rows.map((x) => x.r[0]))];
    },
    async setPrice(name, price, date) {
      const p = (await loadProducts()).find((x) => x.name === name || x.aliases.includes(name));
      if (!p) return false;
      await api.batchUpdate([
        { range: `${PRICE_TAB}!D${p.row}`, values: [[price]] },
        { range: `${PRICE_TAB}!F${p.row}`, values: [[date]] },
      ]);
      bust();
      return true;
    },
    async touchPrices(date) {
      const ps = await loadProducts();
      if (!ps.length) return 0;
      await api.batchUpdate(ps.map((p) => ({ range: `${PRICE_TAB}!F${p.row}`, values: [[date]] })));
      bust();
      return ps.length;
    },
  };
}
