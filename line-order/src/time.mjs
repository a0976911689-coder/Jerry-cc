// 一律以台北時間計算日期，不使用 UTC 日期做日界線判斷。
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function taipeiParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour, minute: +p.minute };
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const todayISO = (now = new Date()) => { const t = taipeiParts(now); return iso(t.y, t.m, t.d); };
export const timestampTaipei = (now = new Date()) => {
  const t = taipeiParts(now);
  return `${iso(t.y, t.m, t.d)} ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
};

// 純日期運算（Date.UTC 只當計算工具，不涉及時區）
function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
const weekday = (isoDate) => { const [y, m, d] = isoDate.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

export function shipDate(now, cfg) {
  const t = taipeiParts(now);
  let day = addDays(iso(t.y, t.m, t.d), cfg.leadDays + (t.hour >= cfg.cutoffHour ? 1 : 0));
  for (let i = 0; i < 60; i++) {
    if (!cfg.closedWeekdays.includes(weekday(day)) && !cfg.closedDates.includes(day)) return day;
    day = addDays(day, 1);
  }
  return day;
}

export function formatShip(isoDate) {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${m}/${d} (${WEEK[weekday(isoDate)]})`;
}
