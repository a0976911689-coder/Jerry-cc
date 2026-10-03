import { addDays, diffDays, lunarInfo, todayInTz, weekday } from './dates.js';

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];

export function isLargeOrder(qty, s) {
  return qty >= s.largeOrderQty;
}

/** Stricter (longer) of the quantity rule and the purpose rule. */
export function minLeadDays(qty, s, purposeLead = 0) {
  return Math.max(isLargeOrder(qty, s) ? s.minLeadDaysLarge : s.minLeadDaysSmall, purposeLead);
}

const entryMap = (list = []) => new Map(list.map((e) => { const t = String(e).trim(); return [t.slice(0, 10), t.slice(10).trim()]; }));

/** 敬果日 = 十四, 十五, 初一 and the day before 初一; 公司拜拜 = 初二, 十六. Staff prepare offering fruit for these. */
export function worshipTag(lunar) {
  if (lunar.day === 2 || lunar.day === 16) return '公司拜拜';
  if ([14, 15, 1].includes(lunar.day) || lunar.isEve) return '敬果日';
  return '';
}

/**
 * Is the shop open on this date? Monday is closed unless the day is a lunar
 * 初一/初二/十五/十六 or listed in specialOpenDates (national holidays, one-off
 * openings the owner posts in the monthly calendar). blockedDates are always closed.
 */
export function dayStatus(dateStr, s) {
  const lunar = lunarInfo(dateStr);
  const blocked = entryMap(s.blockedDates);
  const special = entryMap([...(s.specialOpenDates || []), ...(s.nationalHolidays || [])]);
  const tag = worshipTag(lunar);
  const mondayOpen = s.peakLunarDays.includes(lunar.day);
  const wd = weekday(dateStr);
  const base = { date: dateStr, weekday: WEEKDAY_ZH[wd], lunar: lunar.label, lunarDay: lunar.dayName,
    lunarMonth: lunar.monthName, tag, peak: !!tag, holiday: special.has(dateStr), festivals: lunar.festivals };
  if (blocked.has(dateStr)) return { ...base, open: false, reason: blocked.get(dateStr) || '本店休息' };
  if (wd === s.closedWeekday) {
    if (special.has(dateStr)) return { ...base, open: true, reason: special.get(dateStr) || '正常營業' };
    if (mondayOpen) return { ...base, open: true, reason: `農曆${lunar.dayName}，正常營業` };
    return { ...base, open: false, reason: '公休' };
  }
  return { ...base, open: true, reason: special.get(dateStr) || tag };
}

/** Full check for a requested delivery date and order size. */
export function checkDate(dateStr, qty, s, now = new Date(), purposeLead = 0) {
  const today = todayInTz(now, s.timezone);
  const lead = minLeadDays(qty, s, purposeLead);
  const st = dayStatus(dateStr, s);
  if (diffDays(dateStr, today) < lead) {
    return { ok: false, reason: `需提前 ${lead} 天下訂，最早 ${addDays(today, lead)}`, status: st };
  }
  if (diffDays(dateStr, today) > s.maxAdvanceDays) {
    return { ok: false, reason: `最多提前 ${s.maxAdvanceDays} 天預訂`, status: st };
  }
  if (!st.open) return { ok: false, reason: st.reason, status: st };
  return { ok: true, status: st };
}

/** Calendar for the picker: every day from today to today+maxAdvanceDays. */
export function buildAvailability(s, dayTotals = {}, now = new Date()) {
  const today = todayInTz(now, s.timezone);
  const days = [];
  for (let i = 0; i <= s.maxAdvanceDays; i++) {
    const date = addDays(today, i);
    const st = dayStatus(date, s);
    const full = (dayTotals[date] || 0) >= s.dailyCapAmount;
    days.push({ ...st, full, bookableSmall: st.open && !full && i >= s.minLeadDaysSmall,
      bookableLarge: st.open && !full && i >= s.minLeadDaysLarge });
  }
  return { today, days };
}

export function computeTotals(qty, packagingFee, method, s) {
  const items = qty * s.standardPrice;
  const packaging = qty * packagingFee;
  const shipping = method === 'delivery' ? s.shippingFee : 0;
  return { items, packaging, shipping, total: items + packaging + shipping };
}
