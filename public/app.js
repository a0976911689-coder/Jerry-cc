import { h, money, api } from './common.js';
import { drawPoster, downloadCanvas, summaryLines } from './poster.js';

const state = { qty: 1, purposeId: '', packagingId: '', cardText: '', method: 'pickup', district: '', address: '', date: '',
  name: '', phone: '', note: '', month: '', submitting: false, error: '' };
let data;
let cal = null; // { month, days } for the 營業日程 section

const app = document.getElementById('app');
// scroll helper (no scrollIntoView: it misbehaves inside embedded in-app browsers/iframes)
const goTo = (id) => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' }); };
const isLarge = () => state.qty >= data.settings.largeOrderQty;
const purpose = () => data.settings.purposes.find((p) => p.id === state.purposeId);
// Stricter of the quantity rule and the purpose rule (mirrors lib/rules.js on the server).
const leadDays = () => Math.max(isLarge() ? data.settings.minLeadDaysLarge : data.settings.minLeadDaysSmall, (purpose() || {}).leadDays || 0);
const dayOk = (d) => {
  const p = purpose();
  if (!p || p.contactOnly) return false;
  return d.open && !d.full && data.days.indexOf(d) >= leadDays() && data.days.indexOf(d) <= data.settings.maxAdvanceDays;
};
const pickedDay = () => data.days.find((d) => d.date === state.date);

function totals() {
  const s = data.settings;
  const pack = s.packagingOptions.find((p) => p.id === state.packagingId);
  const items = state.qty * s.standardPrice;
  const packaging = state.qty * (pack ? pack.fee : 0);
  const shipping = state.method === 'delivery' ? s.shippingFee : 0;
  return { items, packaging, shipping, total: items + packaging + shipping };
}

function dayReason(d) {
  const s = data.settings;
  if (!d.open) return d.reason;
  if (d.full) return '額滿';
  const lead = leadDays();
  const idx = data.days.indexOf(d);
  return idx < lead ? `需提前${lead}天` : '';
}

function calendar() {
  const months = [...new Set(data.days.map((d) => d.date.slice(0, 7)))];
  if (!state.month) state.month = months[0];
  const mi = months.indexOf(state.month);
  const [y, m] = state.month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const cells = Array.from({ length: first }, () => h('div', { class: 'day empty' }));
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let i = 1; i <= dim; i++) {
    const date = `${state.month}-${String(i).padStart(2, '0')}`;
    const d = byDate.get(date);
    if (!d) { cells.push(h('div', { class: 'day empty' })); continue; }
    const ok = dayOk(d);
    const reason = dayReason(d);
    cells.push(h('button', {
      type: 'button', class: `day${d.peak ? ' peak' : ''}${state.date === date ? ' sel' : ''}`, disabled: !ok,
      'aria-label': `${m}月${i}日 週${d.weekday} 農曆${d.lunarMonth}${d.lunarDay}${d.tag ? ' ' + d.tag : ''}${ok ? '' : ' 不可選：' + reason}`,
      'aria-pressed': state.date === date ? 'true' : 'false',
      onclick: () => { state.date = date; render(); },
    }, h('span', { class: 's' }, i), h('span', { class: 'l' }, ok || !reason ? d.lunar : reason.slice(0, 5))));
  }
  const p = pickedDay();
  return h('div', {},
    h('div', { class: 'cal-head' },
      h('button', { type: 'button', 'aria-label': '上個月', disabled: mi <= 0, onclick: () => { state.month = months[mi - 1]; render(); } }, '‹'),
      h('span', { class: 'title' }, `${y} 年 ${m} 月`),
      h('button', { type: 'button', 'aria-label': '下個月', disabled: mi >= months.length - 1, onclick: () => { state.month = months[mi + 1]; render(); } }, '›')),
    h('div', { class: 'grid' }, ['日', '一', '二', '三', '四', '五', '六'].map((w) => h('div', { class: 'dow' }, w)), cells),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { style: 'background:var(--peak-bg);border:1px solid var(--accent)' }), '敬果日・公司拜拜（備貨日）'),
      h('span', {}, h('i', { style: 'border:1px dashed var(--dis)' }), '不可選')),
    p && state.date ? h('p', { class: 'picked' }, `已選：${p.date}（週${p.weekday}）農曆${p.lunarMonth}${p.lunarDay}${p.tag ? '・' + p.tag : ''}`) : h('p', { class: 'hint' }, '請點選日期'),
    h('p', { class: 'hint' }, purpose() && !purpose().contactOnly ? `目前條件（${purpose().name}、${state.qty} 份）需提前 ${leadDays()} 天下訂，最多可預訂 ${data.settings.maxAdvanceDays} 天內；不可當天訂、當天送。` : '請先選擇禮籃用途。'));
}

async function loadCal(month) {
  try { cal = await api(`/calendar${month ? `?month=${month}` : ''}`); } catch { /* keep old */ }
  render();
}
const shiftMonth = (month, n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

function businessCalendar() {
  if (!cal) return h('p', { class: 'hint' }, '載入中…');
  const [y, m] = cal.month.split('-').map(Number);
  const curMonth = data.today.slice(0, 7);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells = Array.from({ length: first }, () => h('div', { class: 'day empty' }));
  for (const d of cal.days) {
    const note = !d.open ? '公休' : d.weekday === '一' ? '正常營業' : d.tag;
    cells.push(h('div', { class: `day static${d.tag ? ' peak' : ''}${!d.open ? ' off' : ''}${d.date === cal.today ? ' today' : ''}`,
      'aria-label': `${m}月${Number(d.date.slice(8))}日 週${d.weekday} 農曆${d.lunarMonth}${d.lunarDay}${note ? ' ' + note : ''}` },
      h('span', { class: 's' }, Number(d.date.slice(8))), h('span', { class: 'l' }, d.lunar), note && h('span', { class: 'n' }, note)));
  }
  const canvas = h('canvas', { hidden: true });
  return h('div', {},
    h('div', { class: 'cal-head' },
      h('button', { type: 'button', 'aria-label': '上個月', disabled: cal.month <= curMonth, onclick: () => loadCal(shiftMonth(cal.month, -1)) }, '‹'),
      h('span', { class: 'title' }, `${y} 年 ${m} 月`),
      h('button', { type: 'button', 'aria-label': '下個月', disabled: cal.month >= shiftMonth(curMonth, 3), onclick: () => loadCal(shiftMonth(cal.month, 1)) }, '›')),
    h('div', { class: 'grid' }, ['日', '一', '二', '三', '四', '五', '六'].map((w) => h('div', { class: 'dow' }, w)), cells),
    h('div', { class: 'cal-notes' }, summaryLines(cal.days).map(([t, col], i) => h('p', { class: i === 0 ? 'k0' : 'k1' }, t))),
    h('button', { type: 'button', class: 'btn small ghost', style: 'margin-top:10px', onclick: async () => { await drawPoster(canvas, cal.days); downloadCanvas(canvas, `英仔果子行-${cal.month}-營業日程.png`); } }, '下載本月日程圖'),
    canvas);
}

const daysLabel = (n) => (n % 7 === 0 ? `${n / 7} 週` : `${n} 天`);
function leadNotice() {
  const ps = data.settings.purposes;
  const parts = ps.filter((p) => !p.contactOnly && p.leadDays > 0).map((p) => `${p.name}禮籃請於${daysLabel(p.leadDays)}前預訂`);
  const contact = ps.filter((p) => p.contactOnly).map((p) => `${p.name}需求歡迎先私訊聯絡`);
  return [...parts, ...contact].join('；') + '。';
}
const lineBtn = (label, cls = '') => (data.settings.lineUrl
  ? h('a', { class: `btn ${cls}`, href: data.settings.lineUrl, target: '_blank', rel: 'noopener' }, label)
  : h('button', { class: `btn ${cls}`, type: 'button', onclick: () => goTo('sec-contact') }, label));

function field(label, input, hint) { return h('div', {}, h('label', {}, label), input, hint && h('p', { class: 'hint' }, hint)); }

async function submit() {
  state.error = '';
  const s = data.settings;
  const pu = purpose();
  if (!pu) state.error = '請選擇禮籃用途';
  else if (pu.contactOnly) state.error = `${pu.name}請先私訊 LINE 聯絡我們`;
  else if (!state.date) state.error = '請選擇送達日期';
  else if (!state.name.trim()) state.error = '請填寫姓名';
  else if (!state.phone.trim()) state.error = '請填寫聯絡電話';
  else if (state.method === 'delivery' && (!state.district || !state.address.trim())) state.error = '請選擇區域並填寫地址';
  if (state.error) return render();
  state.submitting = true; render();
  try {
    const r = await api('/orders', { method: 'POST', body: { ...state, qty: Number(state.qty) } });
    renderDone(r.order);
  } catch (e) {
    state.error = e.message; state.submitting = false; render();
  }
}

function renderDone(o) {
  const s = data.settings;
  app.replaceChildren(h('div', { class: 'done' },
    h('h2', {}, h('span', {}, '✓ 訂單已送出')),
    h('p', {}, '訂單編號'), h('p', { class: 'id' }, o.id),
    h('p', {}, `送達日期：${o.date}`),
    h('p', {}, `合計 ${money(o.totals.total)}（現金付款）`),
    h('p', { class: 'hint' }, '店家確認後會再與您聯繫。如需修改或急件，請私訊 LINE。'),
    s.lineUrl && h('a', { class: 'btn', href: s.lineUrl, style: 'display:block;text-decoration:none;margin-top:16px' }, '前往 LINE 聯絡我們'),
    h('button', { class: 'btn ghost', style: 'margin-top:12px', onclick: () => location.reload() }, '再訂一筆')));
}

function render() {
  // Clear the chosen date if a quantity change made it invalid.
  const cur = pickedDay();
  if (cur && !dayOk(cur)) state.date = '';
  const s = data.settings;
  const t = totals();
  const active = document.activeElement;
  const focusId = active && active.dataset ? active.dataset.f : null;
  const selStart = active && 'selectionStart' in active ? active.selectionStart : null;
  const text = (key, props = {}) => h('input', { type: 'text', value: state[key], 'data-f': key, ...props,
    oninput: (e) => { state[key] = e.target.value; update(); } });

  const delivery = state.method === 'delivery';
  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('img', { src: '/logo.png', alt: '英仔果子行 A Ying Fruit' }),
      h('nav', { 'aria-label': '網站導覽' },
        h('button', { type: 'button', onclick: () => goTo('sec-service') }, '禮籃服務'),
        h('button', { type: 'button', onclick: () => goTo('sec-how') }, '預訂方式'),
        h('button', { type: 'button', onclick: () => goTo('sec-contact') }, '聯絡我們'))),
    h('section', { class: 'hero2' },
      h('div', { class: 'hero-copy' },
        h('h1', {}, '您的心意，', h('br'), '英仔幫你款到好'),
        h('p', {}, '初一十五、神明聖誕、宮廟進香，敬神水果禮籃歡迎提前預訂。'),
        h('div', { class: 'hero-cta' }, lineBtn('LINE 詢問禮籃'), h('button', { class: 'btn ghost', type: 'button', onclick: () => goTo('sec-item') }, '直接線上預訂'))),
      h('img', { class: 'hero-photo', src: '/images/standard-basket.jpg', alt: '敬神水果禮籃：鳳梨搭配水果，紅色蝴蝶結與藤編提籃', width: 900, height: 1125 })),
    h('section', { class: 'service', id: 'sec-service' },
      h('h2', {}, h('span', {}, '敬神禮籃')), h('p', { class: 'price-line' }, `每籃 ${money(s.standardPrice)}`),
      h('div', { class: 'cards3' },
        [['初一、十五', '誠心備禮，日常祭拜更添心意。'], ['神明聖誕', '感謝神恩，備上敬意表達虔誠。'], ['宮廟進香', '隨香祈福，帶著心意一同前行。']].map(([t, d]) =>
          h('div', { class: 'u-card' }, h('b', {}, t), h('span', {}, d))))),
    h('section', { class: 'how', id: 'sec-how' },
      h('h2', {}, h('span', {}, '怎麼預訂？')),
      h('ol', { class: 'steps' },
        h('li', {}, h('i', {}, '1'), '在網站選擇用途、數量與取貨日期，或用 LINE 告訴我們'),
        h('li', {}, h('i', {}, '2'), '與店家確認禮籃內容及取貨安排'),
        h('li', {}, h('i', {}, '3'), '約定日期來店自取，或配送到府（現金付款）')),
      h('p', { class: 'noticebar' }, leadNotice())),
    h('div', { class: 'wrap' },
    h('section', { class: 'card', id: 'sec-cal' }, h('h2', {}, h('span', {}, '營業日程')), businessCalendar()),

    h('section', { class: 'card', id: 'sec-item' }, h('h2', {}, h('span', {}, '1. 選擇品項')),
      h('article', { class: 'item' },
        h('img', { class: 'photo', src: '/images/standard-basket.jpg', alt: '公訂版水果禮籃：鳳梨搭配水果，紅色蝴蝶結與藤編提籃', width: 900, height: 1125 }),
        h('div', { class: 'item-body' },
          h('p', { class: 'eyebrow' }, 'standard'),
          h('h3', {}, '公訂版 水果禮籃'),
          h('p', { class: 'desc' }, '宮廟節慶適用，統一規格。'),
          h('p', { class: 'lbl' }, '禮籃用途'),
          h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '禮籃用途' },
            s.purposes.map((p) => h('label', { class: 'chip' }, h('input', { type: 'radio', name: 'purpose', value: p.id, checked: state.purposeId === p.id,
              onchange: () => { state.purposeId = p.id; render(); } }), h('span', {}, p.name)))),
          purpose() && purpose().contactOnly && h('div', { class: 'callout' }, h('p', {}, `${purpose().name}需求請先私訊 LINE 聯絡，我們會與您確認內容與安排。`), lineBtn('LINE 聯絡我們', 'small')),
          h('p', { class: 'price' }, money(s.standardPrice), h('small', {}, ' / 份')),
          h('div', { class: 'stepper' },
            h('button', { type: 'button', 'aria-label': '減少', onclick: () => { state.qty = Math.max(1, +state.qty - 1); render(); } }, '−'),
            h('input', { type: 'number', min: 1, max: 500, value: state.qty, 'aria-label': '數量', 'data-f': 'qty',
              oninput: (e) => { state.qty = Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)); update(); }, onchange: render }),
            h('button', { type: 'button', 'aria-label': '增加', onclick: () => { state.qty = Math.min(500, +state.qty + 1); render(); } }, '＋')),
          h('p', { class: 'hint' }, `${isLarge() ? `大量訂購（${s.largeOrderQty} 份以上）` : '小量訂購'}・${purpose() ? purpose().name : ''}：需提前 ${leadDays()} 天下訂`))),
      h('article', { class: 'item custom' },
        h('img', { class: 'photo', src: '/images/custom-example.jpg', alt: '客製化搭配範例：木瓜、香蕉、蘋果與柑橘放在彩色編織提籃', width: 900, height: 1200, loading: 'lazy' }),
        h('div', { class: 'item-body' },
          h('p', { class: 'eyebrow' }, 'custom'),
          h('h3', {}, '客製化 水果禮籃'),
          h('p', { class: 'desc' }, '依需求搭配品項，需私訊討論，價格有溢價。圖為搭配範例，實際品項依討論為準。'),
          s.lineUrl ? h('a', { class: 'btn small ghost', href: s.lineUrl, style: 'text-decoration:none' }, '私訊 LINE 洽詢')
            : h('div', {}, h('p', { class: 'hint' }, '請掃描 QR Code 加 LINE 洽詢'), h('img', { class: 'qr', src: '/line-qr.png', alt: '英仔果子行 LINE QR Code' }))))),

    h('section', { class: 'card' }, h('h2', {}, h('span', {}, '2. 包裝與卡片')),
      field('包裝', h('select', { 'data-f': 'pack', onchange: (e) => { state.packagingId = e.target.value; render(); } },
        s.packagingOptions.map((p) => h('option', { value: p.id, selected: p.id === state.packagingId }, p.fee ? `${p.name}（每份＋${money(p.fee)}）` : p.name)))),
      field('卡片文字（選填）', h('textarea', { 'data-f': 'card', maxlength: s.cardTextMaxLength, placeholder: '例如：平安順心、福氣滿滿',
        oninput: (e) => { state.cardText = e.target.value; document.getElementById('cc').textContent = `${state.cardText.length}/${s.cardTextMaxLength}`; } }, state.cardText),
        ''),
      h('p', { class: 'hint', id: 'cc' }, `${state.cardText.length}/${s.cardTextMaxLength}`)),

    h('section', { class: 'card', id: 'sec-way' }, h('h2', {}, h('span', {}, '3. 配送或自取')),
      h('div', { class: 'choice', role: 'radiogroup' },
        ['pickup', 'delivery'].map((v) => h('label', {}, h('input', { type: 'radio', name: 'method', value: v, checked: state.method === v,
          onchange: () => { state.method = v; render(); } }), h('span', {}, v === 'pickup' ? '本店自取（免運）' : `配送（運費 ${money(s.shippingFee)}）`)))),
      delivery
        ? h('div', {}, h('p', { class: 'hint' }, `配送範圍：高雄市 ${s.deliveryDistricts.join('、')}。其他地區請選擇本店自取。`),
          h('div', { class: 'row' },
            field('區域', h('select', { 'data-f': 'district', onchange: (e) => { state.district = e.target.value; } },
              h('option', { value: '' }, '請選擇'), s.deliveryDistricts.map((d) => h('option', { value: d, selected: d === state.district }, d)))),
            field('詳細地址', text('address', { placeholder: '路名、號、樓', autocomplete: 'street-address' }))))
        : h('div', {}, h('p', { class: 'hint' }, s.storeAddress ? `取貨地點：${s.storeAddress}` : '本店自取，地點請見地圖。'),
          s.mapUrl && h('a', { class: 'btn small ghost', href: s.mapUrl, target: '_blank', rel: 'noopener', style: 'text-decoration:none;display:inline-block;margin-top:6px' }, '在 Google 地圖查看店面位置')),
      ),

    h('section', { class: 'card', id: 'sec-date' }, h('h2', {}, h('span', {}, '4. 送達（取貨）日期')), calendar()),

    h('section', { class: 'card' }, h('h2', {}, h('span', {}, '5. 聯絡資料')),
      field('姓名', text('name', { autocomplete: 'name' })),
      field('聯絡電話', h('input', { type: 'tel', value: state.phone, 'data-f': 'phone', autocomplete: 'tel', inputmode: 'tel', placeholder: '0912-345-678',
        oninput: (e) => { state.phone = e.target.value; } })),
      field('備註（選填）', text('note', { maxlength: 200 }))),

    state.error && h('p', { class: 'error', role: 'alert' }, state.error)),
    h('footer', { class: 'shop-info', id: 'sec-contact' },
      h('h2', {}, h('span', {}, '來店找阿嬤跟小豪')),
      h('ul', {},
        h('li', {}, `營業時間　${s.openTime}–${s.closeTime}（週一公休，初一、初二、十五、十六照常營業）`),
        h('li', {}, '取貨方式　來店自取，或配送（永安、彌陀、岡山、梓官）'),
        h('li', {}, `地址　${s.storeAddress || ''}`)),
      h('div', { class: 'hero-cta' }, lineBtn('LINE 詢問與預訂'), s.mapUrl && h('a', { class: 'btn ghost', href: s.mapUrl, target: '_blank', rel: 'noopener' }, '在 Google 地圖查看'))),
    h('div', { class: 'bar' }, h('div', { class: 'inner' },
      h('div', { class: 'sum' }, `${state.qty} 份${t.shipping ? ` ＋運費 ${money(t.shipping)}` : ''}・現金付款`, h('b', { id: 'tot' }, money(t.total))),
      h('button', { class: 'btn', type: 'button', disabled: state.submitting, onclick: submit }, state.submitting ? '送出中…' : '送出訂單'))));

  if (focusId) {
    const el = app.querySelector(`[data-f="${focusId}"]`);
    if (el) { el.focus(); if (selStart != null && el.setSelectionRange && el.type !== 'number') try { el.setSelectionRange(selStart, selStart); } catch {} }
  }
}

function update() { const v = money(totals().total); for (const id of ['tot', 'tot2']) { const el = document.getElementById(id); if (el) el.textContent = v; } }

try {
  data = await api('/public');
  state.packagingId = data.settings.packagingOptions[0].id;
  state.purposeId = (data.settings.purposes.find((p) => !p.contactOnly) || data.settings.purposes[0]).id;
  data.today = data.today || data.days[0].date;
  loadCal();
  render();
} catch (e) {
  app.replaceChildren(h('p', { class: 'error' }, '載入失敗，請重新整理：' + e.message));
}
