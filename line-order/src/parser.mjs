// 解析客人傳來的訂單文字。原則：認不出來就不猜；完全不像訂單的聊天訊息直接略過。
const UNITS = '公斤|台斤|顆|個|粒|斤|盒|袋|把|箱|串|包|組|籃';
const CN = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
// 同義單位視為相同
const UNIT_GROUP = { 個: '顆', 粒: '顆', 台斤: '斤' };
const canonUnit = (u) => UNIT_GROUP[u] || u;

const ITEM_RE = new RegExp(
  `([^\\d\\n,，、;；。]+?)\\s*[x×*]?\\s*(?:(\\d+(?:\\.\\d+)?)\\s*(${UNITS})?|([一二兩三四五六七八九十]{1,3})\\s*(${UNITS}))`,
  'gi',
);
const LEAD_RE = /^(我要|我想要|我想訂|我想|麻煩|請給我|請|幫我|訂|要|還要|再來|另外|和|跟|及)+/;

export function cnToNumber(s) {
  if (s.includes('十')) {
    const [a, b] = s.split('十');
    return (a ? CN[a] : 1) * 10 + (b ? CN[b] : 0);
  }
  return CN[s];
}

const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');

export function buildIndex(products) {
  const idx = [];
  for (const p of products) {
    for (const a of [p.name, ...p.aliases]) if (a) idx.push({ key: norm(a), product: p });
  }
  return idx;
}

function resolve(rawName, idx) {
  const k = norm(rawName.replace(LEAD_RE, ''));
  if (!k) return null;
  const exact = idx.find((e) => e.key === k);
  if (exact) return exact.product;
  if (k.length >= 2) {
    const fuzzy = [...new Set(idx.filter((e) => e.key.includes(k) || k.includes(e.key)).map((e) => e.product))];
    if (fuzzy.length === 1) return fuzzy[0];
  }
  return null;
}

/**
 * @returns {{kind:'chat'} | {kind:'order', items, unknown:string[], unitMismatch:string[]}}
 */
export function parseOrder(text, products) {
  const idx = buildIndex(products);
  const src = text.normalize('NFKC');
  const merged = new Map();
  const unknown = [];
  const unitMismatch = [];
  for (const m of src.matchAll(ITEM_RE)) {
    const rawName = m[1].trim();
    const qty = m[2] !== undefined ? parseFloat(m[2]) : cnToNumber(m[4]);
    const unit = m[3] || m[5] || '';
    const product = resolve(rawName, idx);
    if (!product) { unknown.push(rawName.replace(LEAD_RE, '') || rawName); continue; }
    if (!(qty > 0) || qty > 999) { unknown.push(`${product.name}（數量 ${m[2] ?? m[4]} 不合理）`); continue; }
    if (unit && canonUnit(unit) !== canonUnit(product.unit)) {
      unitMismatch.push(`${product.name} 的單位是「${product.unit}」，不是「${unit}」`);
      continue;
    }
    const prev = merged.get(product.name);
    merged.set(product.name, { product, qty: (prev?.qty || 0) + qty });
  }
  // 一個品項都沒對到：視為一般聊天，交給人工，不回應
  if (merged.size === 0 && unitMismatch.length === 0) return { kind: 'chat' };
  return { kind: 'order', items: [...merged.values()], unknown, unitMismatch };
}
