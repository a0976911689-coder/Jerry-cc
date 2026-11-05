import crypto from 'node:crypto';

const b64url = (b) => Buffer.from(b).toString('base64url');

// 以服務帳戶金鑰換取 access token（不依賴任何套件）
export function createGoogleAuth({ email, privateKey, fetchImpl = fetch }) {
  let cached = { token: '', exp: 0 };
  return async function getToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cached.token && cached.exp - 60 > now) return cached.token;
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({
      iss: email, scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    }));
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claim}`), privateKey).toString('base64url');
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${sig}` }),
    });
    if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
    const j = await res.json();
    cached = { token: j.access_token, exp: now + (j.expires_in || 3600) };
    return cached.token;
  };
}

export function createSheetsApi({ sheetId, getToken, fetchImpl = fetch }) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  const call = async (path, init = {}) => {
    const res = await fetchImpl(base + path, {
      ...init,
      headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Sheets ${path} ${res.status}: ${await res.text()}`);
    return res.json();
  };
  const enc = encodeURIComponent;
  return {
    async get(range) { return (await call(`/values/${enc(range)}`)).values || []; },
    append: (range, rows) => call(`/values/${enc(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: rows }) }),
    batchUpdate: (data) => call('/values:batchUpdate',
      { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }) }),
  };
}
