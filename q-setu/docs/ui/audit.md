# UI audit (before)

Screenshots: `docs/ui/before/` (`desktop-*` = 1440×900, `mobile-*` = 390×844).
Judged against the redesign brief: colour, type, spacing, effects, alignment, 3D. The bar is
"would this pass on linear.app / vercel.com?" Mostly it wouldn't.

## Site-wide

- **Colour:** at least seven text and fill colours in use (`#F2F2EE`, `#CFCFCA`, `#7D828C`, cyan, cyan-soft,
  saffron, saffron-soft), plus `risk`/`dim` aliases. Raw hex appears in ~20 TSX files, shaders and HTML
  strings. Tailwind's default palette is still available (`bg-white/[0.06]`, `border-white/15`).
- **Colour:** cyan _and_ saffron appear in the same viewport almost everywhere (story chapters, every demo,
  Industries rows, nav cursor plus a cyan button).
- **Colour:** the accent is used as a fill on large things: the cyan primary buttons ("Deploy QuantumLedger Web", "Scan",
  "Go to Q-Day"), selected tabs, and the cyan background tint on result rows. The brief bans accent
  backgrounds.
- **Type:** six or more ad-hoc sizes (`text-[11px]`, `text-xs`, `text-sm`, `text-base`, `text-lg`, two `clamp()`
  display sizes, `text-4xl/5xl`). Mono labels at 11px with wide 0.16–0.18em tracking. Weights
  400/500 and a hand-drawn 600 in canvas text.
- **Spacing:** arbitrary values everywhere (`pt-[18vh]`, `h-[52vh]`, `min-h-[19rem]`, `gap-x-6 gap-y-3`, `py-2.5`,
  `px-3.5`), and section padding varies from 96px to 160px. Not on a 4px scale with the brief's steps.
- **Effects:** film-grain overlay, two backdrop-blurs (nav plus the Demo shell header), a 12-column "grid
  lines" texture behind sections, the custom cursor ring/crosshair, magnetic buttons, an `animate-pulse` dot in
  the Compute Meter, and tilt cards with a cursor-following radial glow on the demo hub. Together
  they read as "effects showcase", not product.
- **Layout:** the container is 1760px (`max-w-[110rem]`) with 32px side padding, wider than the brief's
  1200px. Text columns run to the screen edge on the Industries and Compare sections.
- **3D:** the globe sits behind text on almost every page.
  - **Demo hub, Scanner, Docs:** a dimmed globe fills the background behind cards and paragraphs.
  - **Story chapter 06:** the dolly-in pushes the globe under the headline and body.
  - **Mobile hero:** the globe is behind the headline.

## Home: story (`desktop-home-story-01…08`, `mobile-home-story-01…08`)

- **01 Hero:** the headline is 4 lines at ~124px, so "about 8 words, max 2 lines" fails. The hero has three text
  colours, a cyan dot _and_ saffron India in one viewport, a stat line that wraps to 3 lines on mobile,
  and two buttons where the white "Run the demos" is the primary and the nav "Launch demo" is a second primary
  in the same viewport.
- **01 Mobile:** the headline overlaps the globe; the nav button wraps to 2 lines ("Launch / demo").
- **02 Seal:** the particle cloud floats over the globe outside its silhouette (banned: floating particles). The
  input has a cyan underline and cyan button text, while the India dots are saffron: two accents.
- **03 Harvest:** saffron arcs plus cyan arcs plus a cyan rim, with a 36px saffron number. More than 12 arcs on
  screen (≈33).
- **04 Q-Day:** text sprites float around the globe, overlapping each other and the rim. Six saffron lines in the
  panel compete with the headline.
- **05 One line:** bright particle "sockets" orbit outside the globe. The list duplicates what the adapters
  section should do.
- **06 India:** huge cyan rings and saffron dots (≈20 accent shapes), and the globe overlaps the headline. Node
  pulses scale continuously (banned scaling motion).
- **07 Cost:** OK typographically, but the 1,000-message bar story isn't visible on the globe.
- **08 Close:** a tiny headline and a dim shrunken globe; there's no core visible in swiftshader. The chromatic
  aberration in the transmission material is banned anyway.
- **Progress rail:** fine conceptually, but its 11px mono numbers sit at a different baseline from the panel.

## Home: sections

- **Industries (`desktop-home-industries`):** the title is 84px over 2 lines (should be h1, 48px). Six columns per
  row with cyan, cyan, grey and saffron labels, which puts two accents in one row. The grid-lines texture is
  visible.
- **Compare / Roadmap (`desktop-home-section`):** the table's saffron and cyan headers are fine per brief, but the
  rows use three text colours. Roadmap's "Now" label is cyan. Neither section is in the brief, so it's density
  to remove.
- **Team:** placeholder cards with numbers. Low value; it adds length.
- **Footer:** a dense 11px sources block. There's no link columns as specified.

## Demos

- **Hub (`desktop-demo`):** three equal tilt cards with SVG illustrations and cursor glow (banned pattern: "3 equal
  cards with icons"). The globe sits behind the cards. "Tool" and "One line" labels are cyan.
- **Demo 2 (`desktop-demo-deploy`):** the globe is zoomed so far that land dots render as ~12px blobs, and India
  is a saffron blob field. There are five list items each with a saffron dot, a cyan selected state, a full-width
  cyan button, saffron and cyan tinted "Before/After" boxes, and a cyan "Deploy all" fill. That puts at least
  4 accent uses on a background in one viewport.
- **Demo 3 (`desktop-demo-qday`):** a saffron title and a cyan title, saffron and cyan numbers, a cyan "Go to Q-Day"
  fill, and a cyan slider. The adversary orb's particle halo is a "floating particles" effect.
- **Demo 1 (`desktop-demo-how-it-works`):** a red/cyan "Attack it" pill. Packets are bright saturated boxes, and the
  orange tube competes with the cyan tube.
- **Scanner (`desktop-demo-scanner`):** a cyan "Scan" fill, a cyan chip, the globe behind the textarea, and a large
  empty panel on the right.
- **Compute Meter:** 6 tiles with 11px uppercase labels, an `animate-pulse` dot, and two coloured bars. Too dense
  for a footer bar.
- **Mobile demos:** the header wraps into 3 rows; controls overflow onto the caption.
