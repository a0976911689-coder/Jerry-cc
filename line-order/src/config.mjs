// 所有可調整的規則都集中在這裡，用環境變數覆蓋預設值。
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

export function loadConfig(env = process.env) {
  return {
    // 截單時間（台北時間，24 小時制）：此時間以前下單，最快 LEAD_DAYS 天後出貨；之後下單再多一天。
    cutoffHour: num(env.CUTOFF_HOUR, 15),
    leadDays: num(env.LEAD_DAYS, 1),
    // 固定休息的星期，0=日 1=一 … 6=六，例如 "0" 代表週日休息
    closedWeekdays: list(env.CLOSED_WEEKDAYS).map(Number),
    // 特定休息日，格式 YYYY-MM-DD，例如 "2026-10-10,2026-10-11"
    closedDates: list(env.CLOSED_DATES),
    // 價格快取秒數（避免每則訊息都讀一次試算表）
    priceCacheSeconds: num(env.PRICE_CACHE_SECONDS, 30),
    shopUserId: env.SHOP_LINE_USER_ID || '',
    lineSecret: env.LINE_CHANNEL_SECRET || '',
    lineToken: env.LINE_CHANNEL_ACCESS_TOKEN || '',
    sheetId: env.GOOGLE_SHEET_ID || '',
    googleEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    googleKey: (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  };
}
