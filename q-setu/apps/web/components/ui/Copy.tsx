"use client";

import type { ReactNode } from "react";
import { useCopyMode } from "@/lib/client/copy-mode";
import { MaskHeading } from "./MaskHeading";

/**
 * Both versions of a piece of copy. Simple uses no acronyms; Technical names algorithms, sizes and
 * standards. Both are in the HTML (CSS shows one, from html[data-copy-mode]), so there is no flash.
 */
export function Copy({ simple, technical }: { simple: ReactNode; technical: ReactNode }) {
  return (
    <>
      <span data-copy="simple">{simple}</span>
      <span data-copy="technical">{technical}</span>
    </>
  );
}

/** A section heading in the current mode (re-reveals when the mode changes). */
export function CopyHeading({
  simple,
  technical,
  className,
  as,
}: {
  simple: string;
  technical: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  const mode = useCopyMode();
  const text = mode === "technical" ? technical : simple;
  return <MaskHeading key={mode} text={text} className={className} as={as} />;
}
