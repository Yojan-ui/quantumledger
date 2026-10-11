import type { MetadataRoute } from "next";
import { SOLUTIONS } from "@/data/solutions";
import { SITE_URL } from "@/lib/meta";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = [
    "/",
    "/platform",
    "/solutions",
    ...SOLUTIONS.map((s) => `/solutions/${s.id}`),
    "/demos",
    "/demo/how-it-works",
    "/demo/deploy",
    "/demo/qday",
    "/demo/ledger",
    "/demo/scanner",
    "/pricing",
    "/security",
    "/about",
    "/changelog",
    "/contact",
    "/privacy",
    "/terms",
    ...source.getPages().map((p) => p.url),
  ];
  return paths.map((p) => ({
    url: `${SITE_URL}${p === "/" ? "" : p}`,
    lastModified: now,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1 : p.startsWith("/docs") ? 0.6 : 0.8,
  }));
}
