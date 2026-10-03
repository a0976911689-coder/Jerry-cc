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
  storeAddress: '',
  lineUrl: '',
  minLeadDaysSmall: 3,
  minLeadDaysLarge: 7,
  largeOrderQty: 10, // standard sets; >= this counts as a large order
  maxAdvanceDays: 90,
  dailyCapAmount: 500000,
  peakLookaheadDays: 7,
  packagingOptions: [{ id: 'standard', name: '標準包裝', fee: 0 }],
  cardTextMaxLength: 60,
  blockedDates: [], // YYYY-MM-DD, shop closed
  nationalHolidays: [], // YYYY-MM-DD, open even if Monday
};

export const ORDER_STATUSES = ['new', 'confirmed', 'prepared', 'delivered', 'cancelled'];
