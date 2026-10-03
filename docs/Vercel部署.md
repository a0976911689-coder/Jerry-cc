# 部署到 Vercel

專案同時支援 **Vercel** 與 Netlify，擇一即可。程式會自動偵測：有 Redis 連線資料 → 用 Redis 存訂單（Vercel）；在 Netlify 上 → 用 Netlify Blobs。

> ⚠️ 費用提醒：Vercel 免費的 **Hobby 方案依條款僅限個人、非商業用途**，商店的營業網站嚴格來說屬商業用途；請先到 Vercel 官網確認最新條款，必要時改用 Pro 方案（月費制）。

## 步驟

1. 註冊 [vercel.com](https://vercel.com)，建議用 **GitHub 登入**。
2. **Add New → Project**，選 GitHub 的 **`Jerry-cc`**。
3. 設定頁面：Framework Preset 選 **Other**，其他不用改（`vercel.json` 已設定好），按 **Deploy**。
4. 部署完成後，進專案的 **Storage**（或 Marketplace）→ 新增 **Upstash for Redis**（免費方案即可）→ 連接到這個專案。Vercel 會自動加上環境變數 `KV_REST_API_URL`、`KV_REST_API_TOKEN`（或 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`），程式兩種都認得。
5. **Settings → Environment Variables** 新增：
   - `ADMIN_PASSWORD`：後台密碼（自己想，12 個字以上，不要傳給別人）
   - `GOOGLE_SCRIPT_URL`、`GOOGLE_SCRIPT_SECRET`：訂單通知（見 `docs/訂單通知設定.md`）
   - 之後要接 LINE 自動推送時再加 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_TARGET_ID`
6. **Deployments → 最新一筆 → ⋯ → Redeploy**，環境變數才會生效。
7. 網站網址後面加 `/admin` 就是後台。

## 之後更新
合併到 `main`，Vercel 會自動重新部署。

## 注意
- 訂單資料存在 Upstash Redis 裡，**不在 GitHub**。
- 想換回 Netlify：不用改程式，照 Netlify 的步驟部署即可。
