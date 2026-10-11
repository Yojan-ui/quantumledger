import { loader } from "fumadocs-core/source";
import { docs } from "@/.source";

// fumadocs-mdx 11.10 hands back `files` as a function; fumadocs-core 15.8 expects the array.
const mdx = docs.toFumadocsSource() as unknown as { files: unknown[] | (() => unknown[]) };
const files = typeof mdx.files === "function" ? mdx.files() : mdx.files;

/** Fumadocs source: page tree, slugs and TOC for /docs. */
export const source = loader({
  baseUrl: "/docs",
  source: { files } as unknown as ReturnType<typeof docs.toFumadocsSource>,
});
