// 記憶體版儲存：用於測試與本機模擬，不連任何外部服務。
export function createMemoryStore({ products = [], customerPrices = [] } = {}) {
  const orders = new Map();
  return {
    kind: 'memory',
    async getProducts() { return products; },
    async getCustomerPrices(userId) {
      return new Map(customerPrices.filter((c) => c.userId === userId).map((c) => [c.name, c.price]));
    },
    async insertOrder(o) { orders.set(o.id, { ...o }); },
    async getOrder(id) { return orders.get(id) || null; },
    async setOrderStatus(id, status) { const o = orders.get(id); if (o) o.status = status; return !!o; },
    async listOrderIdsByUser(userId, status) {
      return [...orders.values()].filter((o) => o.userId === userId && o.status === status).map((o) => o.id);
    },
    async setPrice(name, price, date) {
      const p = products.find((x) => x.name === name || x.aliases.includes(name));
      if (!p) return false;
      p.price = price; p.priceDate = date; return true;
    },
    async touchPrices(date) { products.forEach((p) => { p.priceDate = date; }); return products.length; },
    _orders: orders,
  };
}
