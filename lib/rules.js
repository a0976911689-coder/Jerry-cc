import { addDays, diffDays, lunarInfo, todayInTz, weekday } from './dates.js';

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];

export function isLargeOrder(qty, s) {
  return qty >= s.largeOrderQty;
}

export function minLeadDays(qty, s) {
  return isLargeOrder(qty, s) ? s.minLeadDaysLarge : s.minLeadDaysSmall;
}

/**
 * Is the shop open on this date? Monday is closed unless the day is a peak
 * lunar day (初一/初二/十五/十六) or a national holiday. Blocked dates are always closed.
 */
export function dayStatus(dateStr, s) {
  const lunar = lunarInfo(dateStr);
  const peak = s.peakLunarDays.includes(lunar.day);
  const holiday = s.nationalHolidays.includes(dateStr);
  const wd = weekday(dateStr);
  const base = { date: dateStr, weekday: WEEKDAY_ZH[wd], lunar: lunar.label, lunarDay: lunar.dayName,
    lunarMonth: lunar.monthName, peak, holiday, festivals: lunar.festivals };
  if (s.blockedDates.includes(dateStr)) return { ...base, open: false, reason: '本店休息' };
  if (wd === s.closedWeekday) {
    if (peak) return { ...base, open: true, reason: `農曆${lunar.dayName}，正常營業` };
    if (holiday) return { ...base, open: true, reason: '國定假日，正常營業' };
    return { ...base, open: false, reason: '週一公休' };
  }
  return { ...base, open: true, reason: peak ? `農曆${lunar.dayName}，大月` : '' };
}

/** Full check for a requested delivery date and order size. */
export function checkDate(dateStr, qty, s, now = new Date()) {
  const today = todayInTz(now, s.timezone);
  const lead = minLeadDays(qty, s);
  const st = dayStatus(dateStr, s);
  if (diffDays(dateStr, today) < lead) {
    return { ok: false, reason: `需提前 ${lead} 天下訂（${isLargeOrder(qty, s) ? '大量' : '小量'}訂購），最早 ${addDays(today, lead)}`, status: st };
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
