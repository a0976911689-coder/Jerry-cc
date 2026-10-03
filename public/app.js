import { h, money, api } from './common.js';
import { drawPoster, downloadCanvas, summaryLines } from './poster.js';

const state = { qty: 1, packagingId: '', cardText: '', method: 'pickup', district: '', address: '', date: '',
  name: '', phone: '', note: '', month: '', submitting: false, error: '' };
let data;
let cal = null; // { month, days } for the 營業日程 section

const app = document.getElementById('app');
// scroll helper (no scrollIntoView: it misbehaves inside embedded in-app browsers/iframes)
const goTo = (id) => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' }); };
const isLarge = () => state.qty >= data.settings.largeOrderQty;
const dayOk = (d) => (isLarge() ? d.bookableLarge : d.bookableSmall);
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
  const lead = isLarge() ? s.minLeadDaysLarge : s.minLeadDaysSmall;
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
    h('p', { class: 'hint' }, `小量訂購需提前 ${data.settings.minLeadDaysSmall} 天；${data.settings.largeOrderQty} 份以上需提前 ${data.settings.minLeadDaysLarge} 天；不可當天訂、當天送。`));
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

function field(label, input, hint) { return h('div', {}, h('label', {}, label), input, hint && h('p', { class: 'hint' }, hint)); }

async function submit() {
  state.error = '';
  const s = data.settings;
  if (!state.date) state.error = '請選擇送達日期';
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
    h('div', { class: 'topbar' },
      h('img', { src: '/logo.png', alt: '英仔果子行 A Ying Fruit' }),
      h('div', { class: 'cartbox', 'aria-live': 'polite' }, `${state.qty} 份　`, h('span', { id: 'tot2' }, money(t.total)))),
    h('div', { class: 'announce' },
      h('button', { class: 'go', type: 'button', onclick: () => goTo('sec-date') }, '最新可送達日期查詢'),
      h('p', {}, `營業時間 ${s.openTime}–${s.closeTime}　固定週一公休（農曆初一、初二、十五、十六及國定假日照常營業）`),
      h('p', {}, '付款方式：現金。配送僅限永安、彌陀、岡山、梓官，其餘地區請本店自取。')),
    h('div', { class: 'wrap' },
    h('div', { class: 'tiles' },
      h('button', { class: 'tile', type: 'button', onclick: () => goTo('sec-item') }, h('small', {}, 'standard'), h('b', {}, '公定版訂購')),
      s.lineUrl ? h('a', { class: 'tile', href: s.lineUrl }, h('small', {}, 'custom'), h('b', {}, '客製化洽詢'))
        : h('button', { class: 'tile', type: 'button', onclick: () => goTo('sec-item') }, h('small', {}, 'custom'), h('b', {}, '客製化洽詢')),
      h('button', { class: 'tile', type: 'button', onclick: () => { state.method = 'pickup'; render(); goTo('sec-way'); } }, h('small', {}, 'store pickup'), h('b', {}, '門市自取'))),

    h('section', { class: 'card', id: 'sec-cal' }, h('h2', {}, h('span', {}, '營業日程')), businessCalendar()),

    h('section', { class: 'card', id: 'sec-item' }, h('h2', {}, h('span', {}, '1. 選擇品項')),
      h('article', { class: 'item' },
        h('img', { class: 'photo', src: '/images/standard-basket.jpg', alt: '公定版水果禮籃：鳳梨搭配水果，紅色蝴蝶結與藤編提籃', width: 900, height: 1125 }),
        h('div', { class: 'item-body' },
          h('p', { class: 'eyebrow' }, 'standard'),
          h('h3', {}, '公定版 水果禮籃'),
          h('p', { class: 'desc' }, '宮廟節慶適用，統一規格。'),
          h('p', { class: 'price' }, money(s.standardPrice), h('small', {}, ' / 份')),
          h('div', { class: 'stepper' },
            h('button', { type: 'button', 'aria-label': '減少', onclick: () => { state.qty = Math.max(1, +state.qty - 1); render(); } }, '−'),
            h('input', { type: 'number', min: 1, max: 500, value: state.qty, 'aria-label': '數量', 'data-f': 'qty',
              oninput: (e) => { state.qty = Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)); update(); }, onchange: render }),
            h('button', { type: 'button', 'aria-label': '增加', onclick: () => { state.qty = Math.min(500, +state.qty + 1); render(); } }, '＋')),
          h('p', { class: 'hint' }, isLarge() ? `大量訂購（${s.largeOrderQty} 份以上），需提前 ${s.minLeadDaysLarge} 天下訂` : `小量訂購，需提前 ${s.minLeadDaysSmall} 天下訂`))),
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
  data.today = data.today || data.days[0].date;
  loadCal();
  render();
} catch (e) {
  app.replaceChildren(h('p', { class: 'error' }, '載入失敗，請重新整理：' + e.message));
}
