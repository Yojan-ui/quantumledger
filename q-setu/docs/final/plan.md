# Final pass: the plan

Baseline: `docs/final/before/` (every page at 1440×900 and 390×844, plus `scroll-30s.webm`).
Lighthouse (mobile, home): **Performance 68**, Accessibility 93, Best practices 100, SEO 100. LCP 4.6 s, TBT 610 ms,
CLS 0. The accessibility failures are `aria-hidden-focus` and `color-contrast`.

## The 10 weakest things, ranked

1. **Performance (LCP 4.6 s, TBT 610 ms, 321 KB first-load JS on `/`).** The home bundle eagerly ships GSAP, Lenis,
   framer-motion, the post-quantum libraries (Seal/Harvest widgets), web-shield and the proofs. LCP waits on the masked
   headline animation. → Phase A/B: split the heavy widgets out of the initial bundle, keep 3D lazy, make the
   headline paint immediately, and hit the budget (LCP < 2.0 s, JS < 250 KB, Lighthouse ≥ 90).
2. **The home page is too long and asks too many questions at once (structure).** It has thirteen sections,
   including a 7-chapter pinned story (≈ 980 vh), seven feature blocks, Industries and Demos, so a visitor can't
   tell where the answer to "am I at risk?" lives. → A3: nine sections, one question each. The story becomes three
   steps, and the detail moves to `/platform` and `/solutions/*`.
3. **No signature interaction for the visitor (wow).** The most memorable thing, the live scan, is hidden as one proof
   among seven. → A2: "Is your bank quantum-safe?" right under the hero, with a globe move, a score ring and a
   shareable `/scan/[host]` page.
4. **The hero is crowded (clarity).** A label, headline, subline, three buttons, a 3-stat row and a footnote. The
   buttons don't say what happens. → A1: one headline, one subline, "Try it live" and "Scan your site", the globe, the
   ticker. The measured stats move to the Proof section.
5. **It doesn't read as a company (trust).** There's no pricing, about, security, privacy or terms page, no contact,
   and no way to sign up. The logo is a 16 px glyph. → B1/B2/A5: real pages, early-access capture, a brand mark and
   favicon set, honest drafts with no fake logos or metrics.
6. **The docs are a single static page.** No quickstart flow, no per-adapter pages, no API reference, no security
   model. → B1: MDX docs (Fumadocs), with the API reference generated from the OpenAPI spec.
7. **Persistence won't survive a deploy.** SQLite files under `.data/`, an in-process bus, and Shield nodes binding
   local ports. → B3: Drizzle (SQLite locally, Postgres in production), a Dockerised Node deployment for the
   long-running pieces, and `.env.example`.
8. **Fragile under demo conditions.** URL scans need the internet, there's no presenter mode or keyboard control,
   no one-click reset, and no backup video. → Phase C.
9. **Accessibility gaps.** Focusable elements inside `aria-hidden` regions (the tooltip and the mask-heading probe), plus
   low-contrast `--text-3` labels on `--bg-raised`. → Fix to reach 100.
10. **Inconsistent states and copy.** Some proofs show a bare error line with no retry. Buttons are a mix of title
    case and sentence case. Nothing is shared (no OG images, no sitemap, no JSON-LD), and there's no analytics to
    learn from. → A5/B4.
