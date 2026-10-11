import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/** Docs live in content/docs as MDX. Code blocks stay monochrome (the design system has no syntax palette). */
export const docs = defineDocs({ dir: "content/docs" });

export default defineConfig({
  mdxOptions: { rehypeCodeOptions: false },
});
