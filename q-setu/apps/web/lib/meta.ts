import type { Metadata } from "next";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
export const SITE_NAME = "QuantumLedger";

/** Title, description, canonical URL and a generated OG image for one page. */
export function pageMeta({
  title,
  description,
  path,
  absoluteTitle = false,
  label,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  /** Small mono label on the OG image (defaults to the first path segment). */
  label?: string;
}): Metadata {
  const og = `/og?${new URLSearchParams({
    title: absoluteTitle ? "See your quantum risk. Fix it. Prove it." : title,
    label: label ?? (path === "/" ? "Post-quantum security for India" : (path.split("/")[1] ?? "")),
  })}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: absoluteTitle ? title : `${title} · ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: og, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}
