"use client";

/**
 * Numbers that roll instead of jumping: each digit is a 0–9 column that slides to its new value
 * (300 ms, motion token easing). Non-digits render as-is. Reduced motion: the value just changes.
 */
export function Odometer({ value, className = "" }: { value: string; className?: string }) {
  const chars = [...value];
  return (
    <span className={`tabular inline-flex ${className}`}>
      <span className="sr-only">{value}</span>
      {chars.map((ch, i) => {
        // Key from the right, so a growing number keeps its units column stable.
        const key = chars.length - i;
        if (!/\d/.test(ch))
          return (
            <span key={key} aria-hidden>
              {ch}
            </span>
          );
        const d = Number(ch);
        return (
          <span
            key={key}
            aria-hidden
            className="relative inline-block overflow-hidden"
            style={{ height: "1lh" }}
          >
            <span className="invisible">0</span>
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-300"
              style={{ transform: `translateY(${-d * 10}%)` }}
            >
              {"0123456789".split("").map((n) => (
                <span key={n} style={{ height: "1lh" }}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
