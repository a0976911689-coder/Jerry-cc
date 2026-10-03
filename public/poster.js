// Monthly 營業．拜拜日程 poster, drawn on a canvas so staff can download a PNG.
const W = 1080, H = 1350;
const WINE = '#722f37', INK = '#3a2a26', MUTED = '#8a7a72', BG = '#faf6ef', RULE = '#d9c9b6';
const SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';

function loadImg(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
const daysOf = (days, pred) => days.filter(pred).map((d) => Number(d.date.slice(8)));
const list = (a) => a.join('、');

/** Footer text lines [text, colour] shared by the poster and the website calendar. */
export function summaryLines(days) {
  const out = [];
  const closed = daysOf(days, (d) => !d.open);
  const reopened = days.filter((d) => d.open && d.weekday === '一');
  const jing = daysOf(days, (d) => d.tag === '敬果日');
  const bai = daysOf(days, (d) => d.tag === '公司拜拜');
  if (closed.length || reopened.length) out.push([`公休：${list(closed)}日${reopened.length ? `｜${list(reopened.map((d) => Number(d.date.slice(8))))}日正常營業` : ''}`, INK]);
  if (jing.length) out.push([`敬果日：${list(jing)}日，記得準備拜拜水果`, WINE]);
  if (bai.length) out.push([`公司拜拜：${list(bai)}日，記得準備拜拜水果`, WINE]);
  return out;
}

export async function drawPoster(canvas, days) {
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  try { await Promise.all([document.fonts.load(`900 84px ${SERIF}`, '營業拜拜日程'), document.fonts.load(`700 30px ${SERIF}`, '0123456789初十')]); } catch { /* fall back */ }
  c.fillStyle = BG; c.fillRect(0, 0, W, H);

  const [y, m] = [Number(days[0].date.slice(0, 4)), Number(days[0].date.slice(5, 7))];
  const center = (t, x, yy) => { c.textAlign = 'center'; c.fillText(t, x, yy); };

  // header
  c.fillStyle = INK; c.font = `900 44px ${SERIF}`;
  if ('letterSpacing' in c) c.letterSpacing = '12px';
  center('英仔果子行', 470, 110);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  const logo = await loadImg('/logo.png');
  if (logo) c.drawImage(logo, 905, 28, 105, Math.round(105 * logo.height / logo.width));
  c.fillStyle = WINE; c.font = `900 84px ${SERIF}`;
  center(`${m}月營業・拜拜日程`, W / 2, 255);
  c.fillStyle = INK; c.font = `900 56px ${SERIF}`;
  center(String(y), W / 2, 335);

  // grid
  const gx = 40, gw = W - 80, cw = gw / 7, gy = 380, hh = 64;
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const rows = Math.ceil((first + days.length) / 7);
  const footerLines = summaryLines(days);
  const footH = footerLines.length * 56 + 20;
  const ch = Math.min(130, (H - gy - hh - footH - 40) / rows);
  const gh = hh + ch * rows;

  c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(gx, gy, gw, gh);
  c.lineWidth = 1.5; c.strokeStyle = RULE;
  for (let i = 1; i < 7; i++) { c.beginPath(); c.moveTo(gx + cw * i, gy); c.lineTo(gx + cw * i, gy + gh); c.stroke(); }
  for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(gx, gy + hh + ch * r); c.lineTo(gx + gw, gy + hh + ch * r); c.stroke(); }
  c.fillStyle = INK; c.font = `900 34px ${SERIF}`;
  ['日', '一', '二', '三', '四', '五', '六'].forEach((w, i) => center(w, gx + cw * i + cw / 2, gy + 44));

  days.forEach((d, i) => {
    const idx = first + i, col = idx % 7, row = Math.floor(idx / 7);
    const cx = gx + cw * col + cw / 2, top = gy + hh + ch * row;
    const special = !d.open || (d.weekday === '一' && d.open);
    const hot = d.tag ? WINE : INK;
    if (special) { c.fillStyle = d.open ? '#e8d3cf' : '#ece3d6'; c.beginPath(); c.arc(cx, top + ch * 0.27, 25, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = hot; c.font = `900 32px ${SERIF}`; center(String(Number(d.date.slice(8))), cx, top + ch * 0.27 + 11);
    c.font = `700 ${ch < 110 ? 18 : 21}px ${SERIF}`; c.fillStyle = d.tag ? WINE : INK;
    center(d.lunar, cx, top + ch * 0.58);
    const note = !d.open ? '公休' : d.weekday === '一' ? '正常營業' : d.tag;
    if (note) { c.font = `700 ${ch < 110 ? 17 : 19}px ${SERIF}`; c.fillStyle = !d.open ? MUTED : WINE; center(note, cx, top + ch * 0.84); }
  });

  // footer
  c.font = `900 38px ${SERIF}`;
  footerLines.forEach(([t, col], i) => { c.fillStyle = col; center(t, W / 2, gy + gh + 62 + i * 56); });
}

export function downloadCanvas(canvas, name) {
  canvas.toBlob((b) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
