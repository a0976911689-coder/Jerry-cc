/** Push an order summary to the shop's LINE via the Messaging API (server-side only). */
export function formatOrderMessage(o) {
  const lines = [
    `🍎 新訂單 ${o.id}`,
    `客人：${o.customer.name}　電話：${o.customer.phone}`,
    `送達日：${o.date}（${o.dateInfo.weekday}）農曆${o.dateInfo.lunarMonth}${o.dateInfo.lunarDay}${o.dateInfo.tag ? ' ★' + o.dateInfo.tag : ''}`,
    o.method === 'delivery' ? `配送：高雄市${o.customer.district}${o.customer.address}` : '本店自取',
  ];
  if (o.kind === 'custom') {
    lines.push(`客製化：${o.description || ''}`);
  } else {
    lines.push(`${o.purposeName ? '用途：' + o.purposeName + '　' : ''}公訂版 × ${o.qty}　包裝：${o.packagingName}`);
    if (o.cardText) lines.push(`卡片文字：${o.cardText}`);
  }
  if (o.note) lines.push(`備註：${o.note}`);
  lines.push(`合計：NT$${o.totals.total}（現金${o.method === 'delivery' ? '，含運費 ' + o.totals.shipping : ''}）`);
  return lines.join('\n');
}

export async function pushToLine(order, fetchImpl = fetch) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_TARGET_ID;
  if (!token || !to) return { ok: false, error: 'LINE 未設定' };
  try {
    const res = await fetchImpl('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: formatOrderMessage(order) }] }),
    });
    if (!res.ok) return { ok: false, error: `LINE ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
