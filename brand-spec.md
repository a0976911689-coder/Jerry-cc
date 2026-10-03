# 英仔果子行 — Brand & Design Spec

## Assets (do not redraw — reference these files)
- Logo (red apple, black brush lettering, orange "A Ying Fruit"): `public/logo.png`
- LINE QR code: `public/line-qr.png` (no decoded URL yet; ask owner for the https://line.me/R/ti/p/@… link)
- Product photos: **pending** — owner to supply real photos of the 公定版 set (and packaging options). Use an honest "photo needed" placeholder until then; no CSS/SVG fakes.

## Tokens (current)
- Colour: wine `#8b2a38` (primary action), copper `#c97b3f` (accent / announcement button), tan `#b08d62` (rules, borders), cream `#f5f0e8` (page), white cards, dark-brown ink `#3a2a22`, announcement band `#111`. Logo keeps its own apple red `#e00715` / orange `#eb6501` and is never recoloured.
- Corners: square only (owner request). Borders thin tan; hard 3px offset shadow on title boxes.

## Reference
- Layout modelled on the 六月初一 mobile storefront (owner screenshot): top bar, black announcement band + copper button, three wine tiles, centred section titles between tan rules. Do not copy their logo, photos or copy.

## Protected contracts
- API routes under `/api`, form field names, order rules in `lib/rules.js`, pricing and delivery copy, accessibility labels, logo and QR.
