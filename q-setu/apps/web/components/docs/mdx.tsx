import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ApiReference } from "./ApiReference";
import { TrackQuickstart } from "./TrackQuickstart";

const slug = (children: ReactNode) =>
  String(Array.isArray(children) ? children.join("") : children)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 border-l border-line-strong pl-4 text-small text-fg-2">{children}</div>
  );
}

/** MDX → the site's primitives: tokens only, no syntax colours. */
export const mdxComponents = {
  h2: ({ children, id }: ComponentProps<"h2">) => (
    <h2 id={id ?? slug(children)} className="mt-12 scroll-mt-24 text-h2 font-medium text-fg">
      {children}
    </h2>
  ),
  h3: ({ children, id }: ComponentProps<"h3">) => (
    <h3 id={id ?? slug(children)} className="mt-8 scroll-mt-24 text-h3 font-medium text-fg">
      {children}
    </h3>
  ),
  p: (p: ComponentProps<"p">) => <p className="mt-4 text-body text-fg-2" {...p} />,
  ul: (p: ComponentProps<"ul">) => (
    <ul className="mt-4 list-disc space-y-2 pl-6 text-body text-fg-2" {...p} />
  ),
  ol: (p: ComponentProps<"ol">) => (
    <ol className="mt-4 list-decimal space-y-2 pl-6 text-body text-fg-2" {...p} />
  ),
  strong: (p: ComponentProps<"strong">) => <strong className="font-medium text-fg" {...p} />,
  a: ({ href = "", children }: ComponentProps<"a">) =>
    href.startsWith("/") && !href.startsWith("/api/") ? (
      <Link
        href={href}
        className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
      >
        {children}
      </Link>
    ) : (
      <a
        href={href}
        className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
      >
        {children}
      </a>
    ),
  // Fenced blocks arrive as <code class="language-…"> inside <pre>; inline code has no class.
  code: ({ className, ...p }: ComponentProps<"code">) =>
    className ? (
      <code {...p} />
    ) : (
      <code className="rounded-sm bg-raised px-1 font-mono text-small text-fg" {...p} />
    ),
  pre: ({ children }: ComponentProps<"pre">) => (
    <pre className="mt-4 overflow-x-auto rounded-sm border border-line bg-inset px-4 py-3 font-mono text-small text-fg">
      {children}
    </pre>
  ),
  table: (p: ComponentProps<"table">) => (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-panel text-left text-small" {...p} />
    </div>
  ),
  th: (p: ComponentProps<"th">) => (
    <th
      className="border-b border-line pb-2 pr-4 font-mono text-label font-normal uppercase text-fg-3"
      {...p}
    />
  ),
  td: (p: ComponentProps<"td">) => (
    <td className="border-b border-line py-2 pr-4 align-top text-fg-2" {...p} />
  ),
  Callout,
  ApiReference,
  TrackQuickstart,
};
