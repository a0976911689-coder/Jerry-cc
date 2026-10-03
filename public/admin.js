import { h, money, api } from './common.js';
import { drawPoster, downloadCanvas } from './poster.js';

const app = document.getElementById('app');
let token = sessionStorage.getItem('gzh_token') || '';
let tab = 'today';
let date = '';
let posterMonth = '';
const STATUS = { new: '新訂單', confirmed: '已確認', prepared: '已備貨', delivered: '已送達', cancelled: '已取消' };

const call = (path, opts = {}) => api(path, { ...opts, token }).catch((e) => {
  if (e.status === 401) { token = ''; sessionStorage.removeItem('gzh_token'); renderLogin(); }
  throw e;
});

function renderLogin(msg = '') {
  const pw = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': '密碼' });
  const go = async () => {
    try { const r = await api('/admin/login', { method: 'POST', body: { password: pw.value } });
      token = r.token; sessionStorage.setItem('gzh_token', token); start(); }
    catch (e) { renderLogin(e.message); }
  };
  pw.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  app.replaceChildren(h('header', { class: 'hero' }, h('h1', {}, '英仔果子行 後台')),
    h('section', { class: 'card' }, h('label', {}, '管理密碼'), pw, msg && h('p', { class: 'error' }, msg),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: go }, '登入')));
  pw.focus();
}

function tabs() {
  const items = [['today', '今日／備貨'], ['orders', '訂單'], ['new', '建立客製化訂單'], ['poster', '月曆海報'], ['settings', '設定']];
  return h('div', { class: 'tabs', role: 'tablist' }, items.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': tab === k ? 'true' : 'false',
    onclick: () => { tab = k; start(); } }, l)),
    h('button', { onclick: () => { token = ''; sessionStorage.removeItem('gzh_token'); renderLogin(); } }, '登出'));
}

const dateLabel = (d) => `${d.date}（週${d.weekday}）農曆${d.lunarMonth}${d.lunarDay}`;

async function viewToday() {
  const ov = await call(`/admin/overview${date ? `?date=${date}` : ''}`);
  date = date || ov.today;
  const p = ov.prep;
  const dateInput = h('input', { type: 'date', value: date, 'aria-label': '選擇日期', onchange: (e) => { date = e.target.value; start(); } });
  return h('div', {},
    h('section', { class: 'card' }, h('h2', {}, '即將到來的敬果日・公司拜拜'),
      ov.upcomingPeaks.length ? ov.upcomingPeaks.map((d) => h('div', { class: 'order' },
        h('div', { class: 'top' }, h('span', {}, `${dateLabel(d)}${d.tag ? '・' + d.tag : ''}`), h('span', { class: 'tag' }, d.daysAway === 0 ? '今天' : `${d.daysAway} 天後`)),
        h('div', {}, `目前 ${d.orders} 筆訂單、${d.qty} 份、${money(d.total)}　`, d.reason && h('span', { class: 'hint' }, d.reason))))
        : h('p', { class: 'hint' }, '未來幾天沒有敬果日或公司拜拜。')),
    h('section', { class: 'card' }, h('h2', {}, '備貨總表'), dateInput,
      h('p', { class: 'hint' }, `${dateLabel(ov.dayStatus)}　${ov.dayStatus.open ? '營業' : '公休'}${ov.dayStatus.reason ? '：' + ov.dayStatus.reason : ''}`),
      h('div', { class: 'stat' }, h('div', {}, h('b', {}, p.orders), '訂單'), h('div', {}, h('b', {}, p.qty), '公定版份數'),
        h('div', {}, h('b', {}, p.custom), '客製化'), h('div', {}, h('b', {}, p.delivery), '配送'), h('div', {}, h('b', {}, p.pickup), '自取'),
        h('div', {}, h('b', {}, money(p.total)), '金額')),
      Object.keys(p.packaging).length > 0 && h('p', {}, '包裝：', Object.entries(p.packaging).map(([k, v]) => `${k} ×${v}`).join('、'))));
}

function orderCard(o, reload) {
  const lines = o.kind === 'custom' ? [`客製化：${o.description || ''}`] : [`公定版 × ${o.qty}　包裝：${o.packagingName}`];
  const patch = async (body) => { await call(`/admin/orders/${o.id}`, { method: 'PATCH', body }); reload(); };
  const sel = h('select', { 'aria-label': '訂單狀態', onchange: (e) => patch({ status: e.target.value }) },
    Object.entries(STATUS).map(([k, v]) => h('option', { value: k, selected: k === o.status }, v)));
  return h('div', { class: 'order' },
    h('div', { class: 'top' }, h('span', {}, `${o.id}　${o.customer.name}　${o.customer.phone}`), h('span', { class: `tag ${o.paid ? 'ok' : 'bad'}` }, o.paid ? '已收現金' : '待收現金')),
    h('div', {}, `${o.date}（週${o.dateInfo.weekday}）農曆${o.dateInfo.lunarMonth}${o.dateInfo.lunarDay}${o.dateInfo.tag ? '・' + o.dateInfo.tag : ''}　`,
      o.method === 'delivery' ? `配送：${o.customer.district}${o.customer.address}` : '自取'),
    lines.map((l) => h('div', {}, l)),
    o.cardText && h('pre', {}, `卡片：${o.cardText}`),
    o.note && h('div', { class: 'hint' }, `備註：${o.note}`),
    h('div', {}, `合計 ${money(o.totals.total)}${o.totals.shipping ? `（含運費 ${money(o.totals.shipping)}）` : ''}`,
      o.line && !o.line.ok && h('span', { class: 'tag bad', style: 'margin-left:8px' }, `LINE 推送失敗：${o.line.error}`)),
    h('div', { class: 'row', style: 'margin-top:8px' }, sel,
      h('button', { class: 'btn small ghost', onclick: () => patch({ paid: !o.paid }) }, o.paid ? '改為待收款' : '標記已收現金')));
}

async function viewOrders() {
  const q = new URLSearchParams();
  if (date && tab === 'orders' && date !== 'all') q.set('date', date);
  const { orders } = await call(`/admin/orders?${q}`);
  const dateInput = h('input', { type: 'date', value: date === 'all' ? '' : date, 'aria-label': '依日期篩選', onchange: (e) => { date = e.target.value || 'all'; start(); } });
  return h('div', {}, h('div', { class: 'row' }, dateInput, h('button', { class: 'btn small ghost', onclick: () => { date = 'all'; start(); } }, '看全部')),
    orders.length ? orders.map((o) => orderCard(o, start)) : h('p', { class: 'hint' }, '沒有訂單'));
}

function viewNew() {
  const f = {};
  const inp = (k, label, props = {}) => { f[k] = h('input', { type: 'text', ...props }); return h('div', {}, h('label', {}, label), f[k]); };
  const err = h('p', { class: 'error' });
  const method = h('select', {}, h('option', { value: 'pickup' }, '本店自取'), h('option', { value: 'delivery' }, '配送'));
  return h('section', { class: 'card' }, h('h2', {}, '建立客製化訂單'),
    h('p', { class: 'hint' }, '與客人在 LINE 談好品項和價格後，在這裡手動建單（金額由你輸入）。'),
    inp('name', '客人姓名'), inp('phone', '電話', { type: 'tel' }), h('label', {}, '配送方式'), method,
    inp('district', '配送區域（配送才需要）'), inp('address', '地址（配送才需要）'),
    inp('date', '送達日期', { type: 'date' }), inp('amount', '商品金額 (NT$)', { type: 'number', min: 1 }),
    inp('description', '客製化內容'), inp('note', '備註'), err,
    h('button', { class: 'btn', style: 'margin-top:12px', onclick: async () => {
      try {
        const r = await call('/admin/orders', { method: 'POST', body: { kind: 'custom', method: method.value,
          name: f.name.value, phone: f.phone.value, district: f.district.value, address: f.address.value, date: f.date.value,
          amount: Number(f.amount.value), description: f.description.value, note: f.note.value } });
        tab = 'orders'; date = r.order.date; start();
      } catch (e) { err.textContent = e.message; }
    } }, '建立訂單'));
}

async function viewPoster() {
  const now = new Date();
  let month = posterMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const canvas = h('canvas', { style: 'width:100%;height:auto;border:1.5px solid var(--line);background:#fff', role: 'img', 'aria-label': '月曆海報預覽' });
  const err = h('p', { class: 'error' });
  const render = async () => {
    err.textContent = '';
    try { const r = await call(`/admin/month?month=${month}`); await drawPoster(canvas, r.days); } catch (e) { err.textContent = e.message; }
  };
  const input = h('input', { type: 'month', value: month, 'aria-label': '選擇月份', onchange: (e) => { month = posterMonth = e.target.value; render(); } });
  render();
  return h('section', { class: 'card' }, h('h2', {}, '月曆海報'),
    h('p', { class: 'hint' }, '依「設定」裡的特別營業日與休息日自動產生每月營業．拜拜日程，確認無誤後下載 PNG 發佈。'),
    h('div', { class: 'row' }, input, h('button', { class: 'btn small', onclick: () => downloadCanvas(canvas, `營業拜拜日程-${month}.png`) }, '下載 PNG')),
    err, h('div', { style: 'margin-top:12px' }, canvas));
}

async function viewSettings() {
  const { settings: s } = await call('/admin/settings');
  const num = (k, label, hint) => { const i = h('input', { type: 'number', value: s[k] }); return [k, i, h('div', {}, h('label', {}, label), i, hint && h('p', { class: 'hint' }, hint))]; };
  const txt = (k, label, hint, rows = 3) => { const i = h('textarea', { rows }, Array.isArray(s[k]) ? s[k].join('\n') : (s[k] ?? '')); return [k, i, h('div', {}, h('label', {}, label), i, hint && h('p', { class: 'hint' }, hint))]; };
  const rows = [
    num('standardPrice', '公定版價格 (NT$)'), num('shippingFee', '配送運費 (NT$)'),
    num('minLeadDaysSmall', '小量訂購：最短提前天數'), num('minLeadDaysLarge', '大量訂購：最短提前天數'),
    num('largeOrderQty', '大量訂購門檻（份數）'), num('maxAdvanceDays', '最多可提前預訂天數'),
    num('dailyCapAmount', '每日接單金額上限 (NT$)'), num('peakLookaheadDays', '拜拜備貨提醒：提前幾天顯示'), num('cardTextMaxLength', '卡片文字字數上限'),
    txt('deliveryDistricts', '配送區域（一行一個）', '', 4),
    txt('blockedDates', '額外休息日（一行一個：日期 備註）', '這些日子客人無法選取。例：2026-12-25 店休。週一公休已自動處理。'),
    txt('specialOpenDates', '特別營業日（一行一個：日期 備註）', '落在週一也會營業。例：2026-10-26 正常營業。國定假日、拜拜隔天等每月請對照營業日程更新。', 5),
    txt('storeAddress', '本店地址（自取用）', '', 2), txt('lineUrl', 'LINE 連結（https://…）', '', 1),
  ];
  const pk = h('textarea', { rows: 4 }, s.packagingOptions.map((p) => `${p.name}|${p.fee}`).join('\n'));
  const err = h('p', { class: 'error' }), ok = h('p', { class: 'hint' });
  return h('section', { class: 'card' }, h('h2', {}, '設定'), rows.map((r) => r[2]),
    h('div', {}, h('label', {}, '包裝選項（一行一個：名稱|每份加價）'), pk),
    err, ok, h('button', { class: 'btn', style: 'margin-top:12px', onclick: async () => {
      const body = {};
      for (const [k, el] of rows) {
        const v = el.value;
        body[k] = ['deliveryDistricts', 'blockedDates', 'specialOpenDates'].includes(k) ? v.split('\n').map((x) => x.trim()).filter(Boolean)
          : el.type === 'number' ? Number(v) : v;
      }
      body.packagingOptions = pk.value.split('\n').map((l, i) => { const [name, fee] = l.split('|'); return { id: s.packagingOptions[i]?.id || `p${Date.now()}${i}`, name: (name || '').trim(), fee: Number(fee || 0) }; }).filter((p) => p.name);
      err.textContent = ''; ok.textContent = '';
      try { await call('/admin/settings', { method: 'PUT', body }); ok.textContent = '已儲存'; } catch (e) { err.textContent = e.message; }
    } }, '儲存設定'));
}

async function start() {
  if (!token) return renderLogin();
  try {
    const view = tab === 'today' ? await viewToday() : tab === 'orders' ? await viewOrders() : tab === 'new' ? viewNew() : tab === 'poster' ? await viewPoster() : await viewSettings();
    app.replaceChildren(h('header', { class: 'hero' }, h('h1', {}, '英仔果子行 後台')), tabs(), view);
  } catch (e) { if (e.status !== 401) app.replaceChildren(h('p', { class: 'error' }, e.message)); }
}
start();
