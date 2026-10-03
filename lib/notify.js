import { formatOrderMessage } from './line.js';

/**
 * Send a new order to a Google Apps Script web app (docs/google-apps-script.gs),
 * which appends a row to the owner's Google Sheet and emails the owner.
 * Configured with GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET (server-side env vars only).
 */
export function sheetRow(o) {
  return [
    o.createdAt, o.id, o.customer.name, o.customer.phone, o.date,
    `農曆${o.dateInfo.lunarMonth}${o.dateInfo.lunarDay}`, o.dateInfo.tag || '', o.purposeName || '',
    o.method === 'delivery' ? '配送' : '自取',
    o.method === 'delivery' ? `高雄市${o.customer.district}${o.customer.address}` : '',
    o.kind === 'custom' ? `客製化：${o.description || ''}` : `公訂版 × ${o.qty}`,
    o.kind === 'custom' ? '' : o.packagingName, o.cardText || '', o.note || '',
    o.totals.total, o.totals.shipping,
  ];
}

export async function pushToSheet(order, fetchImpl = fetch) {
  const url = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GOOGLE_SCRIPT_SECRET;
  if (!url || !secret) return { ok: false, error: '未設定' };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS-style preflight on Apps Script
      body: JSON.stringify({ secret, id: order.id, date: order.date, total: order.totals.total, row: sheetRow(order), text: formatOrderMessage(order) }),
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return data.ok ? { ok: true } : { ok: false, error: data.error || '腳本回應錯誤' };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
