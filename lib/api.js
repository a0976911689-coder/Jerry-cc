import crypto from 'node:crypto';
import { DEFAULT_SETTINGS, ORDER_STATUSES } from './config.js';
import { addDays, parseYmd, todayInTz } from './dates.js';
import { buildAvailability, checkDate, computeTotals, dayStatus } from './rules.js';
import { getStoreInstance, withLock } from './store.js';
import { checkPassword, issueToken, verifyToken } from './auth.js';
import { pushToLine } from './line.js';
import { pushToSheet } from './notify.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const fail = (msg, status = 400) => json({ error: msg }, status);

export async function loadSettings(store) {
  const saved = (await store.get('settings')) || {};
  const s = { ...DEFAULT_SETTINGS, ...saved };
  if (process.env.LINE_URL && !s.lineUrl) s.lineUrl = process.env.LINE_URL;
  return s;
}

async function loadOrders(store) {
  const keys = await store.list('orders/');
  const all = await Promise.all(keys.map((k) => store.get(k)));
  return all.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

const activeTotals = (orders) => {
  const t = {};
  for (const o of orders) if (o.status !== 'cancelled') t[o.date] = (t[o.date] || 0) + o.totals.total;
  return t;
};

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const PHONE = /^(09\d{2}-?\d{3}-?\d{3}|0\d{1,2}-?\d{6,8})$/;

function publicSettings(s) {
  const { standardPrice, shippingFee, deliveryDistricts, storeAddress, mapUrl, lineUrl, purposes, minLeadDaysSmall, minLeadDaysLarge,
    largeOrderQty, maxAdvanceDays, packagingOptions, cardTextMaxLength, openTime, closeTime } = s;
  return { standardPrice, shippingFee, deliveryDistricts, storeAddress, mapUrl, lineUrl, purposes, minLeadDaysSmall, minLeadDaysLarge,
    largeOrderQty, maxAdvanceDays, packagingOptions, cardTextMaxLength, openTime, closeTime };
}

function newOrderId(date) {
  return `${date.replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function describeDate(dateStr, s) {
  const st = dayStatus(dateStr, s);
  return { weekday: st.weekday, lunarMonth: st.lunarMonth, lunarDay: st.lunarDay, peak: st.peak, tag: st.tag };
}

async function createOrder(store, s, body, now, { admin = false } = {}) {
  const date = clean(body.date, 10);
  if (!parseYmd(date)) return fail('請選擇送達日期');
  const name = clean(body.name, 30);
  const phone = clean(body.phone, 20);
  if (!name) return fail('請填寫姓名');
  if (!PHONE.test(phone)) return fail('請填寫正確的聯絡電話');
  const method = body.method === 'delivery' ? 'delivery' : body.method === 'pickup' ? 'pickup' : null;
  if (!method) return fail('請選擇配送或自取');
  const customer = { name, phone };
  if (method === 'delivery') {
    const district = clean(body.district, 10);
    const address = clean(body.address, 100);
    if (!s.deliveryDistricts.includes(district)) return fail('不在配送範圍，請改為本店自取或私訊 LINE 洽詢');
    if (!address) return fail('請填寫配送地址');
    Object.assign(customer, { district, address });
  }

  const order = { id: newOrderId(date), createdAt: new Date(now).toISOString(), status: 'new', paid: false,
    date, dateInfo: describeDate(date, s), method, customer, note: clean(body.note, 200) };

  if (admin && body.kind === 'custom') {
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0) return fail('請輸入客製化金額（整數）');
    order.kind = 'custom';
    order.description = clean(body.description, 300);
    const shipping = method === 'delivery' ? Number(body.shipping ?? s.shippingFee) : 0;
    order.totals = { items: amount, packaging: 0, shipping, total: amount + shipping };
  } else {
    const qty = Number(body.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) return fail('請輸入正確的數量（1–500）');
    const purpose = s.purposes.find((p) => p.id === body.purposeId);
    if (!purpose) return fail('請選擇禮籃用途');
    if (purpose.contactOnly) return fail(`${purpose.name}請先私訊 LINE 聯絡我們`);
    order.purposeId = purpose.id; order.purposeName = purpose.name; order.purposeLead = purpose.leadDays || 0;
    const pack = s.packagingOptions.find((p) => p.id === body.packagingId);
    if (!pack) return fail('請選擇包裝');
    const cardText = String(body.cardText ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
    if (cardText.length > s.cardTextMaxLength) return fail(`卡片文字最多 ${s.cardTextMaxLength} 字`);
    Object.assign(order, { kind: 'standard', qty, packagingId: pack.id, packagingName: pack.name, cardText });
    order.totals = computeTotals(qty, pack.fee, method, s);
  }

  // Admin manual orders may bypass lead-time rules, but never closed/blocked days.
  const qtyForLead = order.kind === 'standard' ? order.qty : 0;
  const chk = checkDate(date, admin ? 0 : qtyForLead, admin ? { ...s, minLeadDaysSmall: 0, minLeadDaysLarge: 0 } : s, now, admin ? 0 : (order.purposeLead || 0));
  if (!chk.ok) return fail(chk.reason + (s.lineUrl && !admin ? '。急件請私訊 LINE 討論' : ''));

  return withLock(async () => {
    const orders = await loadOrders(store);
    const dayTotal = activeTotals(orders)[date] || 0;
    if (dayTotal + order.totals.total > s.dailyCapAmount) return fail('該日已額滿，請私訊 LINE 洽詢');
    await store.set(`orders/${order.id}`, order);
    [order.line, order.sheet] = await Promise.all([pushToLine(order), pushToSheet(order)]);
    await store.set(`orders/${order.id}`, order);
    return json({ ok: true, order: { id: order.id, date: order.date, totals: order.totals, lineOk: order.line.ok, sheetOk: order.sheet.ok } }, 201);
  });
}

function monthCalendar(s, monthParam, now) {
  const month = monthParam || todayInTz(now, s.timezone).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month) || !parseYmd(`${month}-01`)) return fail('月份格式錯誤');
  const [y, mo] = month.split('-').map(Number);
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const days = Array.from({ length: dim }, (_, i) => dayStatus(`${month}-${String(i + 1).padStart(2, '0')}`, s));
  return json({ month, today: todayInTz(now, s.timezone), days });
}

const MAX_FAILS = 3;            // wrong passwords allowed per IP
const GLOBAL_MAX_FAILS = 30;    // across everyone, so spread-out guessing is also stopped
const LOCK_MS = 15 * 60 * 1000;

function clientIp(req) {
  const h = req.headers;
  return (h.get('x-nf-client-connection-ip') || (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown').slice(0, 64);
}

/** Returns { locked, retryMin } for a counter key; expired counters are treated as empty. */
async function lockState(store, key, max, now) {
  const rec = await store.get(key);
  if (!rec || rec.until <= now.getTime()) return { rec: null, locked: false };
  return { rec, locked: rec.fails >= max, retryMin: Math.ceil((rec.until - now.getTime()) / 60000) };
}

async function recordFail(store, key, now) {
  const cur = await store.get(key);
  const live = cur && cur.until > now.getTime();
  const next = { fails: (live ? cur.fails : 0) + 1, until: now.getTime() + LOCK_MS };
  await store.set(key, next);
  return next.fails;
}

function requireAdmin(req) {
  const h = req.headers.get('authorization') || '';
  return verifyToken(h.replace(/^Bearer\s+/i, ''));
}

function prepSummary(orders, date) {
  const rows = orders.filter((o) => o.date === date && o.status !== 'cancelled');
  const pack = {};
  let qty = 0, total = 0, delivery = 0, pickup = 0, custom = 0;
  for (const o of rows) {
    total += o.totals.total;
    o.method === 'delivery' ? delivery++ : pickup++;
    if (o.kind === 'custom') { custom++; continue; }
    qty += o.qty;
    pack[o.packagingName] = (pack[o.packagingName] || 0) + o.qty;
  }
  return { date, orders: rows.length, qty, total, delivery, pickup, custom, packaging: pack };
}

export async function handle(req, now = new Date()) {
  const store = await getStoreInstance();
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  const m = req.method;
  let body = {};
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    try { body = await req.json(); } catch { return fail('資料格式錯誤'); }
  }
  const s = await loadSettings(store);

  if (m === 'GET' && route === '/public') {
    const orders = await loadOrders(store);
    return json({ settings: publicSettings(s), ...buildAvailability(s, activeTotals(orders), now) });
  }
  if (m === 'GET' && route === '/calendar') return monthCalendar(s, url.searchParams.get('month'), now);
  if (m === 'POST' && route === '/orders') return createOrder(store, s, body, now);

  if (m === 'POST' && route === '/admin/login') {
    return withLock(async () => {
      const ipKey = `login/ip:${clientIp(req)}`;
      const ipState = await lockState(store, ipKey, MAX_FAILS, now);
      const globalState = await lockState(store, 'login/global', GLOBAL_MAX_FAILS, now);
      const locked = ipState.locked ? ipState : globalState.locked ? globalState : null;
      if (locked) return json({ error: `密碼輸入錯誤次數過多，請 ${locked.retryMin} 分鐘後再試` }, 429);
      if (!checkPassword(body.password)) {
        const fails = await recordFail(store, ipKey, now);
        await recordFail(store, 'login/global', now);
        return fail(fails >= MAX_FAILS ? `密碼錯誤 ${MAX_FAILS} 次，已暫時鎖定 ${LOCK_MS / 60000} 分鐘` : `密碼錯誤，還有 ${MAX_FAILS - fails} 次機會`, 401);
      }
      await store.set(ipKey, { fails: 0, until: 0 });
      return json({ token: issueToken() });
    });
  }

  if (!route.startsWith('/admin')) return fail('Not found', 404);
  if (!requireAdmin(req)) return fail('請先登入', 401);

  if (m === 'GET' && route === '/admin/orders') {
    let orders = await loadOrders(store);
    const date = url.searchParams.get('date');
    const status = url.searchParams.get('status');
    if (date) orders = orders.filter((o) => o.date === date);
    if (status) orders = orders.filter((o) => o.status === status);
    return json({ orders });
  }
  if (m === 'POST' && route === '/admin/orders') return createOrder(store, s, body, now, { admin: true });

  const one = /^\/admin\/orders\/([\w-]+)$/.exec(route);
  if (m === 'PATCH' && one) {
    return withLock(async () => {
      const o = await store.get(`orders/${one[1]}`);
      if (!o) return fail('找不到訂單', 404);
      if (body.status !== undefined) {
        if (!ORDER_STATUSES.includes(body.status)) return fail('狀態錯誤');
        o.status = body.status;
      }
      if (body.paid !== undefined) o.paid = !!body.paid;
      if (body.adminNote !== undefined) o.adminNote = clean(body.adminNote, 300);
      await store.set(`orders/${o.id}`, o);
      return json({ order: o });
    });
  }

  if (m === 'GET' && route === '/admin/overview') {
    const orders = await loadOrders(store);
    const today = todayInTz(now, s.timezone);
    const date = url.searchParams.get('date') || today;
    const upcoming = [];
    for (let i = 0; i <= s.peakLookaheadDays; i++) {
      const d = addDays(today, i);
      const st = dayStatus(d, s);
      if (st.peak || st.holiday) {
        const p = prepSummary(orders, d);
        upcoming.push({ ...st, daysAway: i, orders: p.orders, qty: p.qty, total: p.total });
      }
    }
    return json({ today, upcomingPeaks: upcoming, prep: prepSummary(orders, date), dayStatus: dayStatus(date, s) });
  }

  if (m === 'GET' && route === '/admin/month') return monthCalendar(s, url.searchParams.get('month'), now);

  if (route === '/admin/settings') {
    if (m === 'GET') return json({ settings: s });
    if (m === 'PUT') {
      const next = sanitizeSettings(body, s);
      if (typeof next === 'string') return fail(next);
      await store.set('settings', next);
      return json({ settings: next });
    }
  }
  return fail('Not found', 404);
}

const dateList = (v) => (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean);

export function sanitizeSettings(b, cur) {
  const int = (v, min, max, label) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} 需為 ${min}–${max} 的整數`);
    return n;
  };
  try {
    const out = {
      ...cur,
      standardPrice: int(b.standardPrice, 1, 1e6, '公訂版價格'),
      shippingFee: int(b.shippingFee, 0, 1e5, '運費'),
      minLeadDaysSmall: int(b.minLeadDaysSmall, 0, 365, '小量最短提前天數'),
      minLeadDaysLarge: int(b.minLeadDaysLarge, 0, 365, '大量最短提前天數'),
      largeOrderQty: int(b.largeOrderQty, 1, 10000, '大量訂購門檻'),
      maxAdvanceDays: int(b.maxAdvanceDays, 1, 365, '最多提前天數'),
      dailyCapAmount: int(b.dailyCapAmount, 1, 1e9, '每日接單上限'),
      peakLookaheadDays: int(b.peakLookaheadDays, 0, 60, '大月提醒天數'),
      cardTextMaxLength: int(b.cardTextMaxLength, 1, 500, '卡片字數上限'),
      storeAddress: clean(b.storeAddress, 200),
      lineUrl: clean(b.lineUrl, 300),
      mapUrl: clean(b.mapUrl, 300),
      deliveryDistricts: dateList(b.deliveryDistricts),
      blockedDates: dateList(b.blockedDates),
      specialOpenDates: dateList(b.specialOpenDates ?? b.nationalHolidays),
      purposes: (Array.isArray(b.purposes) ? b.purposes : []).map((p, i) => {
        const contactOnly = !!p.contactOnly;
        return { id: clean(p.id, 30) || `u${i + 1}`, name: clean(p.name, 30), leadDays: contactOnly ? 0 : int(p.leadDays ?? 0, 0, 365, '用途的最短提前天數'), contactOnly };
      }).filter((p) => p.name),
      packagingOptions: (Array.isArray(b.packagingOptions) ? b.packagingOptions : []).map((p, i) => ({
        id: clean(p.id, 30) || `p${i + 1}`, name: clean(p.name, 30), fee: int(p.fee ?? 0, 0, 1e5, '包裝加價'),
      })).filter((p) => p.name),
    };
    if (out.lineUrl && !/^https:\/\//.test(out.lineUrl)) throw new Error('LINE 連結需以 https:// 開頭');
    if (out.mapUrl && !/^https:\/\//.test(out.mapUrl)) throw new Error('地圖連結需以 https:// 開頭');
    delete out.nationalHolidays;
    for (const d of [...out.blockedDates, ...out.specialOpenDates]) if (!parseYmd(d.slice(0, 10)) || (d.length > 10 && d[10] !== ' ')) throw new Error(`日期格式錯誤：${d}（需為 YYYY-MM-DD，後面可加空格與備註）`);
    if (!out.deliveryDistricts.length) throw new Error('至少需要一個配送區域');
    if (!out.packagingOptions.length) throw new Error('至少需要一個包裝選項');
    if (!out.purposes.some((p) => !p.contactOnly)) throw new Error('至少需要一個可直接下單的用途');
    return out;
  } catch (e) {
    return e.message;
  }
}
