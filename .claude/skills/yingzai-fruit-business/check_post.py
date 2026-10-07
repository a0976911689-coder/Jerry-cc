#!/usr/bin/env python3
"""英仔果子行 交件自動檢查。用法：python3 check_post.py delivery.json
delivery.json 格式見 example_delivery.json。只檢查能用程式判定的項目，其餘需人工對照（會標 UNVERIFIED）。"""
import json, re, sys, os, struct

LIMIT = 50
ADDRESS = "梓官區通安路215號"
HOURS = "06:00–12:00"
BRAND = "英仔果子行"
WRONG_NAMES = ["英仔水果", "小英水果小教室", "阿英水果", "英仔水果聊天團", "小豪", "英仔阿嬤"]
BANNED = ["極品", "頂級", "絕對好吃", "全台最好", "保證", "必買", "最便宜", "比別家", "速速漲粉", "互追", "求追蹤", "阿公"]
PLACEHOLDER = re.compile(r"［|］|\[[^\]]*\]|○○|TODO|放照片|@你的|待填")
URL = re.compile(r"https?://|line\.me|www\.", re.I)
PRICE_LINE = re.compile(r"\d+\s*(元|／|/)")
TYPOS = {"密世界": "蜜世界"}

def png_size(p):
    with open(p, "rb") as f:
        h = f.read(24)
    return struct.unpack(">II", h[16:24]) if h[:8] == b"\x89PNG\r\n\x1a\n" else None

def main(path):
    d = json.load(open(path, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(path))
    rows = []
    def add(item, ok, why):
        rows.append((item, ok, why))

    posts = d.get("posts", {})
    need = ["Threads", "FB", "IG", "LINE"]
    miss = [p for p in need if p not in posts]
    add("成品完整", "FAIL" if miss or not d.get("canva_text") or not d.get("cards") else "PASS",
        f"缺少：{miss}" if miss else f"四平台文案、Canva 文字、圖卡 {len(d.get('cards', []))} 張")

    items = d.get("input_items", [])
    add("品項數 ≤ 5", "PASS" if 0 < len(items) <= 5 else "FAIL", f"{len(items)} 樣")
    allt = "\n".join(posts.values()) + "\n" + d.get("canva_text", "")
    texts = dict(posts, Canva=d.get("canva_text", ""))
    bad = [f"{k}：{i['name']}" for k, t in texts.items() for i in items if i["name"] in t and PRICE_LINE.search(t) and i["price"].replace(" ", "") not in t.replace(" ", "")]
    add("價格與輸入一致", "FAIL" if bad else "PASS", f"價格不符或缺漏：{bad}" if bad else "提到的品項價格都與輸入一致")

    for name, body in posts.items():
        n = len(body)
        add(f"{name} 內文 ≤ {LIMIT} 字", "PASS" if n <= LIMIT else "FAIL", f"{n} 字")
        miss_info = [s for s in (ADDRESS, HOURS) if s not in body]
        add(f"{name} 含地址與營業時間", "FAIL" if miss_info else "PASS", f"缺：{miss_info}" if miss_info else "有")
        add(f"{name} 內文無連結", "FAIL" if URL.search(body) else "PASS", "連結需放留言區")
    for name in ("Threads", "FB", "IG"):  # 公開平台不寫價錢，價錢只放 LINE 聊天群
        n = len(PRICE_LINE.findall(posts.get(name, "")))
        add(f"{name} 公開平台無價錢", "FAIL" if n else "PASS", f"價錢出現 {n} 次（價錢只放 LINE 聊天群）")

    hits = [w for w in BANNED if w in allt]
    add("無禁用詞", "FAIL" if hits else "PASS", f"命中：{hits}" if hits else "0 個")
    allowed = allt.replace("英仔水果小教室", "")  # 系列名稱是沿用的正式名稱，不算停用名稱
    wn = [w for w in WRONG_NAMES if w in allowed]
    add("名稱統一", "FAIL" if wn else "PASS", f"出現停用名稱：{wn}" if wn else f"只用「{BRAND}」")
    ty = [f"{k}→{v}" for k, v in TYPOS.items() if k in allt]
    ph = PLACEHOLDER.findall(allt)
    add("無錯字與未完成字", "FAIL" if ty or ph else "PASS", f"錯字 {ty}；未填 {ph}" if ty or ph else "無")

    sizes = []
    for c in d.get("cards", []):
        p = os.path.join(base, c)
        s = png_size(p) if os.path.exists(p) else None
        sizes.append((c, s))
    badc = [c for c, s in sizes if s != (1080, 1350)]
    add("圖卡存在且為 1080×1350", "FAIL" if badc or not sizes else "PASS", f"不符：{badc}" if badc else f"{len(sizes)} 張")

    ig = d.get("ig_carousel")
    if ig is not None:
        add("IG 輪播 ≥ 5 張", "PASS" if len(ig) >= 5 else "FAIL", f"{len(ig)} 張")
    else:
        add("IG 輪播 ≥ 5 張", "UNVERIFIED", "delivery.json 沒有列出 ig_carousel")

    for item, ok, why in rows:
        print(f"| {item} | {ok} | {why} |")
    return 1 if any(r[1] == "FAIL" for r in rows) else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
