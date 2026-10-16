"use client";

/**
 * Layout for the 3D scenes' anchored labels (components/director/Anchor). drei's <Html> places each
 * label at its 3D point, but nothing stops two labels overlapping, or a label spilling out of its
 * stage over the panels around it. Once per frame, while any label is shown, this pass:
 *  1. finds each visible label's natural box and the stage it belongs to (a 3D area containing it);
 *  2. clamps the box inside that stage (8 px in from the edge);
 *  3. walks the boxes top to bottom and pushes an overlapping one away along its leader line
 *     (labels above their point move up, labels below move down), then re-clamps;
 *  3b. moves any box that still covers a fixed obstacle in its stage ([data-label-avoid]: the
 *     caption, the control pill, the purpose line) to the nearer side of it, and re-clamps;
 *  4. eases each box towards its offset (transform only), so labels slide rather than jump.
 * All reads happen before all writes (one layout per frame).
 */

interface Label {
  box: HTMLElement;
  side: "up" | "down";
  on: boolean;
  dx: number;
  dy: number;
}

const labels = new Set<Label>();
let raf = 0;
const PAD = 8;
const GAP = 6;

function stageRects(): DOMRect[] {
  return [...document.querySelectorAll<HTMLElement>("[data-3d], [data-hud-stage]")]
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
}

function avoidRects(): DOMRect[] {
  return [...document.querySelectorAll<HTMLElement>("[data-label-avoid]")]
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
}

function tick() {
  raf = labels.size ? requestAnimationFrame(tick) : 0;
  if (!raf) return;
  let any = false;
  for (const l of labels) any ||= l.on || !!l.dx || !!l.dy;
  if (!any) return;
  const stages = stageRects();
  const avoid = avoidRects();
  type Item = {
    l: Label;
    n: { left: number; top: number; right: number; bottom: number };
    st: DOMRect | null;
    tx: number;
    ty: number;
  };
  const items: Item[] = [];
  for (const l of labels) {
    if (!l.on) {
      if (l.dx || l.dy) {
        l.dx = l.dy = 0;
        l.box.style.transform = "";
      }
      continue;
    }
    const r = l.box.getBoundingClientRect();
    if (!r.width) continue;
    const n = {
      left: r.left - l.dx,
      top: r.top - l.dy,
      right: r.right - l.dx,
      bottom: r.bottom - l.dy,
    };
    const cx = (n.left + n.right) / 2;
    const cy = (n.top + n.bottom) / 2;
    const st =
      stages.find(
        (s) => cx >= s.left && cx <= s.right && cy >= s.top - 60 && cy <= s.bottom + 60,
      ) ?? null;
    items.push({ l, n, st, tx: 0, ty: 0 });
  }
  const clamp = (it: Item) => {
    const s = it.st;
    if (!s) return;
    const w = it.n.right - it.n.left;
    const h = it.n.bottom - it.n.top;
    const left = it.n.left + it.tx;
    const top = it.n.top + it.ty;
    if (w < s.width - 2 * PAD) {
      if (left < s.left + PAD) it.tx += s.left + PAD - left;
      else if (left + w > s.right - PAD) it.tx -= left + w - (s.right - PAD);
    }
    if (h < s.height - 2 * PAD) {
      if (top < s.top + PAD) it.ty += s.top + PAD - top;
      else if (top + h > s.bottom - PAD) it.ty -= top + h - (s.bottom - PAD);
    }
  };
  items.forEach(clamp);
  items.sort((a, b) => a.n.top + a.ty - (b.n.top + b.ty));
  for (let i = 1; i < items.length; i++) {
    const b = items[i]!;
    for (let j = 0; j < i; j++) {
      const a = items[j]!;
      if (a.st !== b.st) continue;
      const A = {
        l: a.n.left + a.tx,
        r: a.n.right + a.tx,
        t: a.n.top + a.ty,
        b: a.n.bottom + a.ty,
      };
      const B = {
        l: b.n.left + b.tx,
        r: b.n.right + b.tx,
        t: b.n.top + b.ty,
        b: b.n.bottom + b.ty,
      };
      if (A.l >= B.r || B.l >= A.r || A.t >= B.b || B.t >= A.b) continue;
      // Move along the leader: an "up" label further up (the one above), a "down" label further down.
      if (a.l.side === "up") a.ty -= A.b - B.t + GAP;
      else b.ty += A.b - B.t + GAP;
    }
  }
  items.forEach(clamp);
  // Obstacles win: a label never covers the caption or the controls (it goes above or below them).
  for (const it of items) {
    for (const o of avoid) {
      const B = {
        l: it.n.left + it.tx,
        r: it.n.right + it.tx,
        t: it.n.top + it.ty,
        b: it.n.bottom + it.ty,
      };
      if (o.left >= B.r || B.l >= o.right || o.top >= B.b || B.t >= o.bottom) continue;
      const up = B.b - o.top + GAP;
      const down = o.bottom - B.t + GAP;
      // Prefer the side with room inside the stage; otherwise the shorter move.
      const roomUp = !it.st || B.t - up >= it.st.top + PAD;
      it.ty += roomUp && (up <= down || !it.st || B.b + down > it.st.bottom - PAD) ? -up : down;
    }
  }
  items.forEach(clamp);
  for (const it of items) {
    const l = it.l;
    l.dx += (it.tx - l.dx) * 0.35;
    l.dy += (it.ty - l.dy) * 0.35;
    if (Math.abs(l.dx) < 0.3 && Math.abs(l.dy) < 0.3 && !it.tx && !it.ty) l.dx = l.dy = 0;
    l.box.style.transform =
      l.dx || l.dy ? `translate(${l.dx.toFixed(1)}px, ${l.dy.toFixed(1)}px)` : "";
  }
}

/** Registers a label's box; returns a setter for whether it's shown, and an unregister. */
export function registerLabel(box: HTMLElement, side: "up" | "down") {
  const l: Label = { box, side, on: false, dx: 0, dy: 0 };
  labels.add(l);
  raf ||= requestAnimationFrame(tick);
  return {
    show: (on: boolean) => void (l.on = on),
    remove: () => {
      labels.delete(l);
      box.style.transform = "";
    },
  };
}
