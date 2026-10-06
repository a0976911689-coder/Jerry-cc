import test from 'node:test';
import assert from 'node:assert/strict';
import { shipDate, formatShip, taipeiParts, todayISO } from '../src/time.mjs';
import { loadConfig } from '../src/config.mjs';

const cfg = (env = {}) => loadConfig(env);

test('台北時間日界線：UTC 16:30 已是台北隔天', () => {
  assert.equal(todayISO(new Date('2026-10-05T16:30:00Z')), '2026-10-06');
  assert.equal(taipeiParts(new Date('2026-10-05T16:30:00Z')).hour, 0);
});
test('截單前／後', () => {
  assert.equal(shipDate(new Date('2026-10-06T02:00:00Z'), cfg()), '2026-10-07'); // 10:00
  assert.equal(shipDate(new Date('2026-10-06T08:00:00Z'), cfg()), '2026-10-08'); // 16:00
});
test('休息星期與休息日順延', () => {
  // 10/6 (二) 10:00，隔天 10/7 (三)；週三休 → 10/8
  assert.equal(shipDate(new Date('2026-10-06T02:00:00Z'), cfg({ CLOSED_WEEKDAYS: '3' })), '2026-10-08');
  assert.equal(shipDate(new Date('2026-10-06T02:00:00Z'), cfg({ CLOSED_DATES: '2026-10-07,2026-10-08' })), '2026-10-09');
});
test('跨月與星期顯示', () => {
  assert.equal(shipDate(new Date('2026-10-31T02:00:00Z'), cfg({ LEAD_DAYS: '1' })), '2026-11-01');
  assert.equal(formatShip('2026-10-07'), '10/7 (三)');
});
