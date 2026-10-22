"use client";

import { useEffect, useState } from "react";
import { useWorkflowStep } from "@/lib/client/workflow";
import { Copy } from "./Copy";

export interface WorkflowStep {
  simple: string;
  technical: string;
}

/**
 * The page's "How it works" strip: 3–4 numbered steps, one short line each, the current one
 * highlighted. The current step comes from `current` (a demo's own state), the shared workflow
 * store (`current` omitted), or how far the reader has scrolled (`follow="scroll"`).
 */
export function Workflow({
  steps,
  current,
  follow,
  sections,
  className = "",
}: {
  steps: WorkflowStep[];
  current?: number;
  follow?: "scroll";
  /** Element ids, one per step: the current step is the last one whose top has passed mid-screen. */
  sections?: string[];
  className?: string;
}) {
  const stored = useWorkflowStep();
  const [scrolled, setScrolled] = useState(0);
  useEffect(() => {
    if (follow !== "scroll") return;
    const on = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const f = max > 0 ? scrollY / max : 0;
      setScrolled(Math.min(steps.length - 1, Math.floor(f * steps.length)));
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, [follow, steps.length]);
  useEffect(() => {
    if (!sections?.length) return;
    const on = () => {
      let i = 0;
      sections.forEach((id, k) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < innerHeight * 0.5) i = k;
      });
      setScrolled(i);
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, [sections]);
  const tracked = follow === "scroll" || !!sections?.length;
  const at = Math.max(0, Math.min(steps.length - 1, tracked ? scrolled : (current ?? stored)));
  return (
    <nav aria-label="How it works" className={className}>
      <p className="font-mono text-label uppercase text-fg-3">
        <Copy simple="How it works" technical="Workflow" />
      </p>
      <ol className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
        {steps.map((s, i) => {
          const on = i === at;
          const done = i < at;
          return (
            <li
              key={i}
              aria-current={on ? "step" : undefined}
              className={`flex items-start gap-3 border-t pt-3 transition-colors duration-300 ${on ? "border-kem" : "border-line"}`}
            >
              <span
                className={`tabular font-mono text-label ${on ? "text-kem" : done ? "text-fg-2" : "text-fg-3"}`}
              >
                {i + 1}
              </span>
              <span className={`text-small ${on ? "text-fg" : "text-fg-3"}`}>
                <Copy simple={s.simple} technical={s.technical} />
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
