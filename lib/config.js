// Default shop settings. The admin can override these (stored in the data store).
export const DEFAULT_SETTINGS = {
  timezone: 'Asia/Taipei',
  openTime: '06:00',
  closeTime: '12:00',
  closedWeekday: 1, // Monday
  peakLunarDays: [1, 2, 15, 16],
  standardPrice: 600,
  shippingFee: 50,
  deliveryDistricts: ['永安區', '彌陀區', '岡山區', '梓官區'],
  storeAddress: '高雄市梓官區智蚵里通安路215號',
  mapUrl: 'https://maps.app.goo.gl/G1Gv1drnzW4m6Gp48',
  lineUrl: 'https://lin.ee/8yGn7g6',
  minLeadDaysSmall: 3,
  minLeadDaysLarge: 7,
  largeOrderQty: 10, // standard sets; >= this counts as a large order
  maxAdvanceDays: 30, // 神明聖誕 needs 14 days' notice, so the window must be wider than that
  dailyCapAmount: 500000,
  peakLookaheadDays: 7,
  // Purpose of the basket (from the owner's Canva page). Lead time = the stricter of purpose and quantity rules.
  // leadDays: minimum days ahead; contactOnly: not orderable on the site, customer must message LINE first.
  purposes: [
    { id: 'monthly', name: '初一、十五', leadDays: 7 },
    { id: 'festival', name: '神明聖誕', leadDays: 14 },
    { id: 'pilgrimage', name: '宮廟進香', leadDays: 0, contactOnly: true },
    { id: 'other', name: '其他用途', leadDays: 0 },
  ],
  packagingOptions: [{ id: 'standard', name: '標準包裝', fee: 0 }],
  cardTextMaxLength: 60,
  blockedDates: [], // "YYYY-MM-DD 備註", shop closed
  // "YYYY-MM-DD 備註": open even if Monday (national holidays, one-off openings from the monthly calendar)
  specialOpenDates: ['2026-10-26 正常營業'],
};

export const ORDER_STATUSES = ['new', 'confirmed', 'prepared', 'delivered', 'cancelled'];
