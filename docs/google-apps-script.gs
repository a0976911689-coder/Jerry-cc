/**
 * 英仔果子行：新訂單 → 寫入 Google 試算表 + 寄 Email 通知
 * 貼到「擴充功能 → Apps Script」，並在「專案設定 → 指令碼屬性」新增：
 *   SECRET        自訂一組密碼（要和 Netlify 的 GOOGLE_SCRIPT_SECRET 相同）
 *   NOTIFY_EMAIL  收通知的 Email（可用逗號分隔多個）
 */
var HEADERS = ['下單時間', '訂單編號', '姓名', '電話', '送達日', '農曆', '標示', '用途', '方式', '配送地址',
  '品項', '包裝', '卡片文字', '備註', '合計(NT$)', '運費(NT$)'];

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var data = JSON.parse(e.postData.contents);
    if (!props.getProperty('SECRET') || data.secret !== props.getProperty('SECRET')) return out_({ ok: false, error: 'bad secret' });

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
    }
    // 電話、日期當文字存，避免開頭的 0 被吃掉
    var row = data.row.map(function (v, i) { return (i === 3 || i === 4) ? "'" + v : v; });
    sheet.appendRow(row);

    var to = props.getProperty('NOTIFY_EMAIL');
    if (to) {
      MailApp.sendEmail({
        to: to,
        subject: '【新訂單】' + data.id + '｜送達 ' + data.date + '｜NT$' + data.total,
        body: data.text + '\n\n（此信由英仔果子行訂購網站自動寄出）'
      });
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
