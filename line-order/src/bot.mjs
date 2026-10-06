import crypto from 'node:crypto';
import { parseOrder } from './parser.mjs';
import { text, confirmTemplate } from './line.mjs';
import { todayISO, timestampTaipei, shipDate, formatShip } from './time.mjs';

const WEIGHED = new Set(['斤', '公斤', '台斤']);
const fmtQty = (n) => String(Math.round(n * 100) / 100);

export function newOrderId(now) {
  const d = todayISO(now).slice(5).replace('-', '');
  return `${d}-${crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)}`;
}

export function orderSummary(order, title) {
  const lines = order.lines.map((l) => `・${l.name} ${fmtQty(l.qty)}${l.unit} × ${l.price} ＝ ${l.subtotal}`);
  const weighed = order.lines.some((l) => WEIGHED.has(l.unit));
  return [
    title ? `${title}（${formatShip(order.shipDate)} 出貨）` : `出貨日：${formatShip(order.shipDate)}`, '', ...lines, '',
    `合計 ${order.total} 元（現金付款）`,
    ...(weighed ? ['※ 按斤計價的品項，實際金額以秤重為準'] : []),
  ].join('\n');
}

export function createBot({ store, line, config, now = () => new Date(), log = console }) {
  const safePush = async (to, msgs) => {
    if (!to) return;
    try { await line.push(to, msgs); } catch (e) { log.error('push failed', e.message); }
  };

  async function ownerCommand(event, t) {
    const today = todayISO(now());
    let m;
    if ((m = t.match(/^改價\s+(.+?)\s+(\d+(?:\.\d+)?)$/))) {
      const ok = await store.setPrice(m[1], Number(m[2]), today);
      return line.reply(event.replyToken, [text(ok ? `已更新：${m[1]} ${m[2]} 元（${today}）` : `找不到品項「${m[1]}」`)]);
    }
    if (t === '今日沿用') {
      const n = await store.touchPrices(today);
      return line.reply(event.replyToken, [text(`已將 ${n} 個品項的價格沿用為今日（${today}）`)]);
    }
    if (t === '今日價格') {
      const ps = await store.getProducts();
      const body = ps.map((p) => `${p.name} ${p.price}/${p.unit}${p.available ? '' : '（暫無）'}${p.priceDate === today ? '' : ' ⚠未更新'}`).join('\n');
      return line.reply(event.replyToken, [text(body || '價格表是空的')]);
    }
    return false;
  }

  async function handleText(event) {
    const userId = event.source?.userId;
    const t = event.message.text.trim();
    if (userId && userId === config.shopUserId) {
      const r = await ownerCommand(event, t);
      if (r !== false) return;
    }
    const products = await store.getProducts();
    const parsed = parseOrder(t, products);
    if (parsed.kind === 'chat') return; // 一般聊天：交給人工回覆

    const problems = [];
    if (parsed.unitMismatch.length) problems.push(...parsed.unitMismatch);
    if (parsed.unknown.length) problems.push(`找不到品項：${parsed.unknown.join('、')}`);
    if (problems.length) {
      return line.reply(event.replyToken, [text(`${problems.join('\n')}\n\n請確認後重傳整份訂單，或等店家人工回覆。`)]);
    }

    const unavailable = parsed.items.filter((i) => !i.product.available).map((i) => i.product.name);
    if (unavailable.length) {
      return line.reply(event.replyToken, [text(`今日暫無：${unavailable.join('、')}\n請移除後重傳整份訂單。`)]);
    }

    const today = todayISO(now());
    const custom = await store.getCustomerPrices(userId);
    const lines = [];
    const noPrice = [];
    for (const { product, qty } of parsed.items) {
      const fresh = product.priceDate === today && Number.isFinite(product.price);
      const price = custom.get(product.name) ?? (fresh ? product.price : null);
      if (price === null || price === undefined) { noPrice.push(product.name); continue; }
      lines.push({ name: product.name, qty, unit: product.unit, price, subtotal: Math.round(qty * price) });
    }
    if (noPrice.length) {
      await safePush(config.shopUserId, [text(`⚠ 價格未更新，客人訂單待報價\n品項：${noPrice.join('、')}\n客人原文：\n${t}`)]);
      return line.reply(event.replyToken, [text('今日價格確認中，店家會盡快回覆您，謝謝！')]);
    }

    const order = {
      id: newOrderId(now()), createdAt: timestampTaipei(now()), shipDate: shipDate(now(), config),
      userId, userName: await line.displayName(userId), lines,
      total: lines.reduce((s, l) => s + l.subtotal, 0), status: '待確認',
    };
    for (const id of await store.listOrderIdsByUser(userId, '待確認')) await store.setOrderStatus(id, '已取代');
    await store.insertOrder(order);
    return line.reply(event.replyToken, [text(`${orderSummary(order, '請確認您的訂單')}\n\n沒問題請按「確認下單」；\n要修改請直接重傳整份訂單。`), confirmTemplate(order.id)]);
  }

  async function handlePostback(event) {
    const userId = event.source?.userId;
    const q = new URLSearchParams(event.postback.data);
    const order = await store.getOrder(q.get('id'));
    if (!order || order.userId !== userId) {
      return line.reply(event.replyToken, [text('找不到這筆訂單，請重新傳送訂單。')]);
    }
    if (q.get('a') === 'cancel') {
      if (order.status === '待確認') await store.setOrderStatus(order.id, '已取消');
      return line.reply(event.replyToken, [text(order.status === '已確認' ? '此訂單已確認成立，如需取消請直接聯絡店家。' : '已取消這筆訂單。')]);
    }
    if (q.get('a') === 'confirm') {
      if (order.status === '已確認') return line.reply(event.replyToken, [text(`這筆訂單已收到（編號 ${order.id}），不用重複送出。`)]);
      if (order.status !== '待確認') return line.reply(event.replyToken, [text('這筆訂單已失效，請重新傳送訂單。')]);
      await store.setOrderStatus(order.id, '已確認');
      await safePush(config.shopUserId, [text(`🆕 新訂單 ${order.id}\n客人：${order.userName || '（未取得名稱）'}\n${orderSummary(order, '')}`)]);
      return line.reply(event.replyToken, [text(`${orderSummary(order, '已收到您的訂單')}\n\n訂單編號：${order.id}\n謝謝您！`)]);
    }
  }

  return async function handleEvent(event) {
    if (event.deliveryContext?.isRedelivery) return;
    if (event.type === 'follow') {
      return line.reply(event.replyToken, [text('歡迎加入英仔水果！\n直接傳「品名＋數量」即可訂購，例如：\n蜜世界 2 顆\n椪柑 5 斤')]);
    }
    if (event.type === 'message' && event.message?.type === 'text') return handleText(event);
    if (event.type === 'postback') return handlePostback(event);
  };
}
