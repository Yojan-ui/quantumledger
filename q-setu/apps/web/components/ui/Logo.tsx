import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-small font-medium text-fg"
      aria-label="Q-Setu home"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path d="M3 16c3-6 15-6 18 0" />
        <path d="M6 16v3M12 12.5V19M18 16v3" />
      </svg>
      Q-Setu
    </Link>
  );
}
