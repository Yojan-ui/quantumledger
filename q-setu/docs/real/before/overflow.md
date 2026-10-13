# Horizontal overflow (before)

`node scripts/real-shots.mjs before` against http://localhost:3000. Overflow = document scrollWidth − innerWidth, in px (0 = no sideways scroll).

| Page | 360 | 390 | 768 | 1440 | Widest element sticking out |
| --- | --- | --- | --- | --- | --- |
| `/` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/platform` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/solutions` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/solutions/fintech` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/solutions/healthcare` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/solutions/education` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/solutions/government` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/diagnostics` | 0 | 0 | 0 | 0 | – |
| `/demos` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/index` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/demo/how-it-works` | 0 | 0 | 0 | 0 | – |
| `/demo/deploy` | 0 | 0 | 0 | 0 | – |
| `/demo/qday` | 0 | 0 | 0 | 0 | – |
| `/demo/ledger` | 0 | 0 | 0 | 0 | – |
| `/demo/scanner` | 0 | 0 | 0 | 0 | – |
| `/pricing` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/security` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/about` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/changelog` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/contact` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/privacy` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/terms` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/api` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/security-model` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/adapters/edge` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/adapters/sdk` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/adapters/shield` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/adapters/vault` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/adapters/web` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/concepts/hybrid-kem` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/concepts` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/concepts/key-rotation` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/concepts/sessions` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/docs/concepts/signatures` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
| `/join` | 0 | 0 | 0 | 0 | – |
| `/pitch` | 0 | 0 | 0 | 0 | – |
| `/scan/www.irctc.co.in` | **+74** | **+44** | **+190** | 0 | 360: `div.flex.items-center.gap-3` → 434px<br>390: `div.flex.items-center.gap-3` → 434px<br>768: `div.flex.items-center.gap-3` → 958px |
