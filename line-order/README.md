# 英仔水果 LINE 訂單機器人

客人在 LINE 傳「品名＋數量」→ 系統查**今日價格**算出小計與出貨日 → 回覆確認清單與 [確認下單]/[取消] 按鈕 →
按下確認後寫入 Google 試算表，並通知店家。無外部相依套件，部署在 Netlify Function。

```
客人 ──► LINE ──► Netlify Function (netlify/functions/line-webhook.mjs)
                      │  驗證簽章 → 解析訂單 → 查價 → 回覆
                      └──► Google 試算表（今日價格 / 客戶專屬價 / 訂單）
```

## 對話規則（重點）

| 情況 | 系統行為 |
|---|---|
| 「蜜世界 2 顆　椪柑 5 斤」 | 回覆清單＋金額＋出貨日＋確認按鈕 |
| 要修改 | 客人直接重傳整份訂單，舊的待確認單自動作廢 |
| 一般聊天（問價、問到貨…） | **不回覆**，留給你人工回 |
| 部分品名認不出 / 單位寫錯 | 回覆哪個有問題，請客人重傳（不亂猜） |
| 品項今日暫無（供應中＝否） | 回覆今日暫無 |
| **今日價格尚未更新** | 不報昨天的價；回「價格確認中」，並傳訊息通知你，附客人原文 |
| 按斤計價 | 標註「實際金額以秤重為準」；訂單表有「實收金額」欄讓你出貨後補 |
| 重複按確認 | 只算一次，只通知店家一次 |

訂單成立當下的**單價會存進訂單**，之後改價不影響舊單。

## 店主指令（只有 `SHOP_LINE_USER_ID` 的帳號有效）

- `今日價格`：列出所有品項價格，沒更新的標 ⚠
- `改價 蜜世界 160`：更新單價並把更新日期設為今天
- `今日沿用`：價格都沒變時，一鍵把所有品項的更新日期改成今天

## 設定步驟

1. **試算表**：新建一份 Google 試算表，建立三個分頁，名稱必須完全一致，第一列貼上 `sheet-templates/` 內對應 CSV 的標題：
   `今日價格`、`客戶專屬價`、`訂單`（編號後的欄位順序不要更動）。
2. **Google 服務帳戶**：Google Cloud Console 建專案 → 啟用 Google Sheets API → 建立服務帳戶 → 下載 JSON 金鑰 →
   把試算表「共用」給該服務帳戶的 email（編輯者）。
3. **LINE**：LINE Developers 建 Messaging API channel，取得 Channel secret、長期 Channel access token；
   回應設定：**Webhook 開、自動回應關**。
4. **Netlify**：把本資料夾（`line-order/`）當作站台根目錄部署，於 Site settings → Environment variables 設定：

   | 變數 | 內容 |
   |---|---|
   | `LINE_CHANNEL_SECRET` | Channel secret |
   | `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token |
   | `SHOP_LINE_USER_ID` | 你自己的 LINE User ID（Channel 的 Basic settings → Your user ID） |
   | `GOOGLE_SHEET_ID` | 試算表網址 `/d/` 後面那串 |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON 金鑰的 `client_email` |
   | `GOOGLE_PRIVATE_KEY` | JSON 金鑰的 `private_key`（整串貼上，換行保留 `\n` 即可） |
   | `CUTOFF_HOUR`（選填，預設 15） | 台北時間幾點截單 |
   | `LEAD_DAYS`（選填，預設 1） | 截單前下單，幾天後出貨 |
   | `CLOSED_WEEKDAYS`（選填） | 固定休息星期，例如 `0`（週日）或 `0,3` |
   | `CLOSED_DATES`（選填） | 特定休息日，例如 `2026-10-10,2026-10-11` |

5. **Webhook 網址**填入 LINE：`https://<你的站台>.netlify.app/.netlify/functions/line-webhook`，按 **Verify** 應顯示成功。

> 金鑰與 token 只放 Netlify 環境變數，不要放進程式碼或貼到對話。

## 本機測試

```bash
npm test            # 27 個自動測試（解析、時間、流程、試算表欄位、簽章）
npm run simulate    # 終端機模擬 LINE 對話，不連任何外部服務
```

## 每日作業

早上開試算表「今日價格」：有變動的改單價；全沒變就傳 `今日沿用`；缺貨的把「供應中」改「否」。

## 已知限制

- 出貨日規則（截單時間、休息日）是預設值，請依實際營運調整環境變數。
- 解析器以「品名＋數量（＋單位）」為主；語音、圖片、口語敘述不處理，會交給人工。
- 試算表為單一寫入者假設；訂單量很大或高併發時建議改用資料庫。
- 回覆（reply）不計 LINE 訊息費；通知店家使用 push，請留意官方帳號方案的每月則數。
