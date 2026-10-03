---
name: guozihang-order-site
description: Project rules for the 果子行 (fruit & milk shop) order website — fruit orders, pastry baskets (餅籃), wedding gift baskets (婚禮禮籃). Use for ANY work on this site's design or development: ordering flow, delivery-date picker, product customization, lunar/solar calendar, admin backend, LINE order notification. 水果、牛奶、餅籃、婚禮禮籃訂購網站的專屬規則。
---

# 果子行 訂購網站

Use together with `storefront-best-practices` for generic storefront UI/UX (product pages, listings, mobile, SEO). The rules below override it where they conflict.

## Business context

- Products: fruit, milk, pastry baskets (餅籃), wedding gift baskets (婚禮禮籃).
- **Payment is cash only.** No online payment, no Stripe/PayPal, no payment gateway code. Skip the checkout payment step; the flow ends at "submit order". Show payment as cash on delivery / pickup.
- Orders are mostly taken through **LINE** today. The site replaces the manual chat-based ordering.
- Primary users are non-technical shop staff and customers on phones. UI language is Traditional Chinese (zh-TW); mobile first; large tap targets.

## Required features

### 1. Delivery date (指定送達日期)
- Date picker on the order form; required.
- Configurable in admin: earliest bookable date (lead time), blocked dates, per-day order cap, optional delivery time slot.
- Show the **lunar date next to the solar date** in the picker.
- Dates are Taiwan time (Asia/Taipei). Never use UTC date math for day boundaries.

### 2. Customization (品項、卡片文字、包裝)
- Per product: choose items/combination (e.g. fruit types, milk flavors, basket size), card message text, wrapping/packaging style.
- Card text: free text with a character limit, shown back in the order summary exactly as typed (preserve line breaks).
- Wedding baskets get extra fields (recipient names, event date, optional note); keep these optional.
- Store every selected option on the order line so staff see exactly what to prepare.

### 3. Lunar / solar calendar (農曆與國曆) and reminders
- Every calendar view shows both solar and lunar dates.
- Highlight these lunar days as **peak days (大月 / 重要節日)**:
  - 初一, 初二, 十五, 十六 of **every lunar month**
  - Plus major festivals (春節, 元宵, 清明, 端午, 中秋, 重陽 etc.) when added to the festival list.
- **Reminder feature (admin backend):** show upcoming peak days (default: look ahead 7 days, configurable) with expected/current order count so staff can prepare stock. Peak-day cap and lead-time rules can differ from normal days.
- Do not hand-roll lunar conversion. Use a maintained library (e.g. `lunar-javascript` or `tyme4ts`), verify results against known dates (check a few 初一/十五 against an official calendar), and watch the leap-month (閏月) case: 閏月's 初一/十五 are also peak days unless the owner says otherwise.

### 4. LINE order notification
- On order submit, push a formatted order summary to the shop's LINE via the LINE Messaging API (official account). Note: LINE Notify was discontinued; do not use it.
- Channel secret / access token live in environment variables only — never in code, the repo, or client-side bundles. The push call must run server-side (e.g. a Netlify Function).
- Summary includes: order number, customer name and phone, delivery date (solar + lunar), address or pickup, items with options, card text, packaging, total (cash), note.
- If the push fails, the order must still be saved and appear in the admin; surface the failure there.

## Admin backend
- Order list filtered by delivery date, with solar+lunar date and peak-day flag.
- Per-day preparation view: total quantity by product/option for a chosen day.
- Order status: new → confirmed → prepared → delivered / cancelled. Payment status: cash due / cash received.
- Edit settings: lead time, blocked dates, daily caps, peak-day look-ahead, festival list.
- Protect with a login; customers must never reach admin routes or others' orders.

## Confirmed business rules (from the owner)

### Products — real fruit (真實果品)
- **公定版 (standard set): NT$600.** Mainly used for temple festivals (宮廟節慶). Orderable directly on the site.
- **客製化 (custom): discuss via LINE DM first; priced at a premium.** The site must NOT show a self-serve price or checkout for custom orders. Show a "私訊 LINE 洽詢" button instead. Staff can create a custom order in the admin after agreeing price (price is entered manually per order).
- The card text / packaging options above apply to the standard set; custom-order details are captured in the admin note.

### Delivery vs. pickup (配送與自取)
- Two fulfilment methods: **配送 (delivery)** and **本店自取 (store pickup)**.
- Delivery is offered only in 高雄市 永安區, 彌陀區, 岡山區, 梓官區. Everywhere else is **store pickup only**.
- Order form: customer picks 配送 or 自取 first. For 配送, the district is a dropdown limited to the four districts above; any other address is rejected server-side with "不在配送範圍，請改為本店自取或私訊 LINE 洽詢".
- Keep the district list and store address in config so the owner can change them (store address still to be provided).

### Shipping fee (運費)
- 本店自取: **NT$0**.
- 配送 (the four districts above): **NT$50 shipping fee**.
- Fee is added server-side to the order total and shown on the summary and in the LINE push. Fee amount lives in config.
- Custom (客製化) orders: staff enter the final price/fee manually in the admin.

### Business hours (營業時間)
- **Opening hours end at 12:00 noon (中午 12:00 打烊).** After 12:00 Taipei time, same-day orders/pickups are closed. Opens at 06:00. Hours live in config.
- **Closed every Monday (固定週一公休).**
- **Exception — open on a Monday if that day is** 農曆初一, 初二, 十五, 十六, or a national holiday (國定假日 / 年假). Tue–Sun are always open.
- The delivery-date picker must follow this: Mondays are blocked unless an exception applies. The lunar exception is computed from the lunar calendar library; national holidays come from an admin-editable list (Taiwan's holiday calendar changes yearly, so do not hard-code years).
- Show the owner-facing reason on the day ("週一公休" / "初一，正常營業").
- Urgent requests outside these rules (急需): the picker shows "急件請私訊 LINE 討論" with a LINE link; the site does not auto-accept blocked dates.

### Order limits (接單與預訂)
- **Daily order cap: NT$500,000 per delivery date**, measured by total order amount (not order count). Past record is about NT$200,000/day. Block a date (and show "該日已額滿，請私訊 LINE") when accepting an order would push that date over the cap. Cap lives in config; check it server-side in a transaction-safe way.
- **Minimum lead time (confirmed): no same-day orders. Small orders need ≥ 3 days ahead; large orders need ≥ 7 days ahead.** There are no delivery time slots.
- "Large" threshold is **not confirmed by the owner**: implemented as `largeOrderQty` (default 10 standard sets) in settings, editable in the admin. Confirm with the owner.
- Maximum advance booking is also **unconfirmed** (owner earlier said "up to a week ahead", which conflicts with the 7-day minimum for large orders): implemented as `maxAdvanceDays` (default 90), editable in the admin.

## Working rules
- Ask the owner before inventing business rules (large-order threshold, max advance booking, store address, packaging options and fees). Put them in config/data, not hard-coded.
- Prices are integers in NT$; no floating-point money.
- Validate on the server: delivery date within allowed range, required fields, text length. Do not trust the client.
- Test the date logic: timezone edges, month/year boundaries, leap months, blocked dates, daily caps.
- Hosting target: Netlify (static front end + serverless functions). Ask before adding paid services.

## Code layout (implemented)
- `lib/rules.js` — date/open/lead-time/cap rules (single source of truth; the browser only displays what `/api/public` returns). `lib/dates.js` — Taipei-time + lunar helpers. `lib/api.js` — API routes. `lib/line.js` — LINE push. `lib/store.js` — Netlify Blobs in production, JSON files locally.
- `public/` — order page (`index.html`, `app.js`) and admin (`admin.html`, `admin.js`). `netlify/functions/api.mjs` serves `/api/*`.
- Tests: `npm test`. Local run: `ADMIN_PASSWORD=... npm run dev`.
- Env vars: `ADMIN_PASSWORD`, `ADMIN_SECRET` (optional), `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TARGET_ID`, `LINE_URL`.

## Brand & visual style
- Shop name: **英仔果子行 (A Ying Fruit)**. Logo: `public/logo.png` (red apple, black brush lettering, orange "A Ying Fruit"); LINE QR: `public/line-qr.png`.
- Layout follows the 六月初一 mobile storefront (owner screenshot): white top bar with logo + cart total, black announcement band with a copper "可送達日期查詢" button, three wine-red tiles (公定版 / 客製化 / 門市自取), cream `#f5f0e8` background, section titles centred in a tan bordered box between tan lines. Colours: wine `#8b2a38`, copper `#c97b3f`, tan `#b08d62`, dark-brown ink; logo keeps its own red/black/orange.
- Square corners only. Never copy 六月初一 logo, photos or copy.
