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

## Working rules
- Ask the owner before inventing business rules (prices, delivery areas, fees). Put them in config/data, not hard-coded.
- Prices are integers in NT$; no floating-point money.
- Validate on the server: delivery date within allowed range, required fields, text length. Do not trust the client.
- Test the date logic: timezone edges, month/year boundaries, leap months, blocked dates, daily caps.
- Hosting target: Netlify (static front end + serverless functions). Ask before adding paid services.
