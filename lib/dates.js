import lunarPkg from 'lunar-javascript';
const { Solar } = lunarPkg;

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** Today's date in Asia/Taipei as YYYY-MM-DD (never use UTC day boundaries). */
export function todayInTz(now = new Date(), tz = 'Asia/Taipei') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return parts; // en-CA => YYYY-MM-DD
}

export function addDays(dateStr, n) {
  const { y, m, d } = parseYmd(dateStr);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function diffDays(a, b) {
  const pa = parseYmd(a), pb = parseYmd(b);
  return Math.round((Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / 86400000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(dateStr) {
  const { y, m, d } = parseYmd(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function lunarInfo(dateStr) {
  const { y, m, d } = parseYmd(dateStr);
  const l = Solar.fromYmd(y, m, d).getLunar();
  const leap = l.getMonth() < 0;
  const monthName = `${leap ? '閏' : ''}${l.getMonthInChinese()}月`;
  const festivals = [...l.getFestivals(), ...Solar.fromYmd(y, m, d).getFestivals()];
  // The last day of a lunar month (day before the next 初一) counts as part of the 初一 敬果日.
  const nx = new Date(Date.UTC(y, m - 1, d + 1));
  const isEve = Solar.fromYmd(nx.getUTCFullYear(), nx.getUTCMonth() + 1, nx.getUTCDate()).getLunar().getDay() === 1;
  return {
    isEve,
    day: l.getDay(),
    month: Math.abs(l.getMonth()),
    leap,
    label: l.getDayInChinese() === '初一' ? monthName + '初一' : l.getDayInChinese(),
    dayName: l.getDayInChinese(),
    monthName,
    festivals,
  };
}
