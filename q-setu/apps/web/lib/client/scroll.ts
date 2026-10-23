"use client";

/**
 * Page scrolling on one clock. Lenis smooths the wheel and is stepped by GSAP's ticker, which also
 * drives every ScrollTrigger, so scroll position, scroll-scrubbed timelines and the 3D camera all
 * read the same frame. Off under prefers-reduced-motion (native scrolling, triggers still update).
 * Use `scrollToY` instead of window.scrollTo, so a programmatic scroll doesn't fight Lenis.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

let lenis: Lenis | undefined;
let refs = 0;
/** True while Lenis itself is writing the scroll position. */
let own = false;
const tick = (t: number) => {
  own = true;
  lenis?.raf(t * 1000);
  own = false;
};

/**
 * A native scroll call from anywhere else (Next.js resetting scroll on navigation, scrollIntoView,
 * focus, a test runner) first stops Lenis's glide, so the two never fight over the position.
 */
let patched = false;
/** Ends any glide in progress (stop() and start() both reset Lenis to the actual position). */
const halt = () => {
  if (!lenis || own) return;
  lenis.stop();
  lenis.start();
};
function patchNativeScroll() {
  if (patched) return;
  patched = true;
  const wrap = <A extends unknown[]>(fn: (...a: A) => void) =>
    function (this: unknown, ...a: A) {
      halt();
      return fn.apply(this, a);
    };
  window.scrollTo = wrap(window.scrollTo.bind(window)) as typeof window.scrollTo;
  window.scroll = wrap(window.scroll.bind(window)) as typeof window.scroll;
  window.scrollBy = wrap(window.scrollBy.bind(window)) as typeof window.scrollBy;
  const into = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (
    this: Element,
    arg?: boolean | ScrollIntoViewOptions,
  ) {
    halt();
    return into.call(this, arg);
  };
}

export function startScroll(): () => void {
  gsap.registerPlugin(ScrollTrigger);
  if (refs++ === 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    patchNativeScroll();
    lenis = new Lenis({
      autoRaf: false,
      allowNestedScroll: true,
      anchors: true,
      stopInertiaOnNavigate: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // No browser scroll anchoring under Lenis: when a live console grows, the browser shifts the
    // scroll to compensate and Lenis, mid-glide, writes its own position back (a jump).
    document.documentElement.style.overflowAnchor = "none";
  }
  return () => {
    if (--refs > 0) return;
    document.documentElement.style.overflowAnchor = "";
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = undefined;
  };
}

export function scrollToY(y: number, opts: { instant?: boolean } = {}) {
  if (lenis) {
    own = true;
    lenis.scrollTo(y, { immediate: !!opts.instant, duration: 0.9 });
    own = false;
  } else window.scrollTo({ top: y, behavior: opts.instant ? "instant" : "smooth" });
}

/** Pauses page scrolling (a modal is open) and resumes it. */
export function lockScroll(on: boolean) {
  if (on) lenis?.stop();
  else lenis?.start();
}
