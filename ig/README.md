# 圖卡範本

所有範本都是 HTML，**只改檔案最上方「改這裡」區塊**，再匯出 PNG。

| 範本 | 用途 | 尺寸 |
|---|---|---|
| `card.html` | 單品卡（每樣商品一張） | 1080×1350 |
| `line.html` | 價格總表長圖＋正方形封面 | 1080 寬／1040×1040 |
| `carousel.html` | 一般輪播（勾子封面→商品→小技巧→結尾） | 1080×1350 |
| `jingguo.html` | 節慶輪播（日期、提醒、品項、預訂） | 1080×1350 |
| `cta.html` | 輪播結尾卡：追蹤＋導流 QR | 1080×1350 |

## 需要替換的欄位
[品牌名稱] [社群帳號] [地址] [營業時間] [群組名稱] [QR 圖檔路徑 assets/…] [日期]（card／line 會自動帶入台北今天日期） [品項：品名、產地、說明、價格、照片路徑]

## 匯出
```bash
cd ig
npm i --no-save playwright   # 第一次使用時
node export-any.mjs card.html card     # → out/card-1.png …
node export-card.mjs                    # 單品卡，依品項命名
node export-line.mjs                    # 長圖＋封面
```

## 注意
- 字體在 `fonts/`（思源宋體，可商用）。若改用其他字體，要確認授權可在 Canva 以外使用。
- 照片放 `photos/`，QR 等固定素材放 `assets/`。
- 圖上的產地、價格、日期要和當天文案一致（見 `toolbox/copy-qa-checklist.md`）。
- 配色目前是酒紅金；若品牌改用新配色，修改各範本的 `:root` 色票即可。
