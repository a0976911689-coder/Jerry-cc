import crypto from 'node:crypto';

export function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const mac = crypto.createHmac('sha256', secret).update(rawBody).digest();
  let given;
  try { given = Buffer.from(signature, 'base64'); } catch { return false; }
  return given.length === mac.length && crypto.timingSafeEqual(given, mac);
}

export function createLineClient(token, fetchImpl = fetch) {
  const call = async (path, body, method = 'POST') => {
    const res = await fetchImpl(`https://api.line.me${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`LINE API ${path} ${res.status}: ${await res.text()}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  };
  return {
    reply: (replyToken, messages) => call('/v2/bot/message/reply', { replyToken, messages }),
    push: (to, messages) => call('/v2/bot/message/push', { to, messages }),
    async displayName(userId) {
      try { return (await call(`/v2/bot/profile/${userId}`, null, 'GET')).displayName; } catch { return ''; }
    },
  };
}

export const text = (t) => ({ type: 'text', text: t });
export const confirmTemplate = (orderId) => ({
  type: 'template',
  altText: '以上訂單內容正確嗎？',
  template: {
    type: 'confirm',
    text: '以上訂單內容正確嗎？',
    actions: [
      { type: 'postback', label: '確認下單', data: `a=confirm&id=${orderId}`, displayText: '確認下單' },
      { type: 'postback', label: '取消', data: `a=cancel&id=${orderId}`, displayText: '取消' },
    ],
  },
});
