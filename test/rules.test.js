import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS as S } from '../lib/config.js';
import { addDays, lunarInfo, todayInTz, weekday } from '../lib/dates.js';
import { checkDate, dayStatus, computeTotals, buildAvailability } from '../lib/rules.js';

const NOW = new Date('2026-10-03T02:00:00Z'); // 10:00 Taipei, Saturday

function findMonday(pred) {
  for (let i = 0; i < 800; i++) {
    const d = addDays('2026-10-05', i);
    if (weekday(d) === 1 && pred(lunarInfo(d))) return d;
  }
}

test('lunar conversion matches known dates', () => {
  assert.equal(lunarInfo('2026-09-25').dayName, '十五'); // 中秋 2026
  assert.equal(lunarInfo('2026-02-17').dayName, '初一'); // 春節 2026
  assert.equal(lunarInfo('2026-02-17').month, 1);
});

test('timezone: 17:00 UTC is already next day in Taipei', () => {
  assert.equal(todayInTz(new Date('2026-10-03T17:00:00Z')), '2026-10-04');
});

test('Monday closed, but open on lunar 初一/初二/十五/十六', () => {
  const plain = findMonday((l) => ![1, 2, 15, 16].includes(l.day));
  assert.equal(dayStatus(plain, S).open, false);
  assert.equal(dayStatus(plain, S).reason, '週一公休');
  for (const day of [1, 2, 15, 16]) {
    const d = findMonday((l) => l.day === day);
    assert.equal(dayStatus(d, S).open, true, `Monday lunar ${day}`);
    assert.equal(dayStatus(d, S).peak, true);
  }
});

test('national holiday on Monday is open; blocked date is closed', () => {
  const plain = findMonday((l) => ![1, 2, 15, 16].includes(l.day));
  assert.equal(dayStatus(plain, { ...S, nationalHolidays: [plain] }).open, true);
  const tue = addDays(plain, 1);
  assert.equal(dayStatus(tue, { ...S, blockedDates: [tue] }).open, false);
});

test('lead time: small 3 days, large 7 days, no same day', () => {
  const tues = (from) => { let d = from; while ([1].includes(weekday(d))) d = addDays(d, 1); return d; };
  const today = '2026-10-03';
  assert.equal(checkDate(today, 1, S, NOW).ok, false);
  const d3 = addDays(today, 3); // Tuesday 2026-10-06
  assert.equal(weekday(d3), 2);
  assert.equal(checkDate(d3, 1, S, NOW).ok, true);
  assert.equal(checkDate(d3, 10, S, NOW).ok, false); // large needs 7
  const d7 = addDays(today, 7);
  assert.equal(checkDate(tues(d7), 10, S, NOW).ok, true);
  assert.equal(checkDate(addDays(today, 200), 1, S, NOW).ok, false);
});

test('totals: delivery adds NT$50, pickup free', () => {
  assert.deepEqual(computeTotals(2, 0, 'delivery', S), { items: 1200, packaging: 0, shipping: 50, total: 1250 });
  assert.equal(computeTotals(2, 0, 'pickup', S).total, 1200);
});

test('availability marks full days', () => {
  const { days } = buildAvailability(S, { '2026-10-06': 500000 }, NOW);
  assert.equal(days.find((d) => d.date === '2026-10-06').full, true);
});
