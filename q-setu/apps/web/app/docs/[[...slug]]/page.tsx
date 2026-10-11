import type { TOCItemType } from "fumadocs-core/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mdxComponents } from "@/components/docs/mdx";
import { Container, Label, PageShell } from "@/components/ui";
import { pageMeta } from "@/lib/meta";
import { source } from "@/lib/source";

type Props = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props) {
  const page = source.getPage((await params).slug);
  if (!page) return {};
  return pageMeta({
    title: page.data.title === "Quickstart" ? "Docs · Quickstart" : `${page.data.title} · Docs`,
    description: page.data.description ?? "",
    path: page.url,
    label: "Docs",
  });
}

type Node = { type: string; name?: unknown; url?: string; children?: Node[] };

function Sidebar({ tree, current }: { tree: Node[]; current: string }) {
  return (
    <nav aria-label="Docs" className="space-y-1 text-small">
      {tree.map((n, i) => {
        if (n.type === "separator")
          return (
            <Label key={i} as="p" className="block pb-1 pt-6">
              {String(n.name ?? "")}
            </Label>
          );
        if (n.type === "folder")
          return (
            <div key={i}>
              <Sidebar tree={n.children ?? []} current={current} />
            </div>
          );
        const on = n.url === current;
        return (
          <Link
            key={i}
            href={n.url!}
            aria-current={on ? "page" : undefined}
            className={`block py-1 transition-colors duration-150 hover:text-fg ${on ? "text-fg" : "text-fg-3"}`}
          >
            {String(n.name ?? "")}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function DocsPage({ params }: Props) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();
  const MDX = page.data.body;
  const toc = (page.data.toc ?? []) as TOCItemType[];
  return (
    <PageShell>
      <Container className="grid grid-cols-12 gap-x-6 py-16 md:py-24">
        <aside className="col-span-12 mb-12 md:col-span-3 md:mb-0">
          <div className="md:sticky md:top-24">
            <Sidebar tree={source.pageTree.children as Node[]} current={page.url} />
          </div>
        </aside>
        <article className="col-span-12 min-w-0 md:col-span-9 lg:col-span-6">
          <Label>Docs</Label>
          <h1 className="mt-4 text-h1-sm font-medium text-fg md:text-h1">{page.data.title}</h1>
          {page.data.description && (
            <p className="mt-4 text-body text-fg-2">{page.data.description}</p>
          )}
          <div className="mt-8">
            <MDX components={mdxComponents} />
          </div>
        </article>
        {toc.length > 1 && (
          <aside className="col-span-3 hidden lg:block">
            <nav aria-label="On this page" className="sticky top-24 space-y-2">
              <Label as="p">On this page</Label>
              {toc.map((t) => (
                <a
                  key={t.url}
                  href={t.url}
                  className={`block text-small text-fg-3 transition-colors duration-150 hover:text-fg ${t.depth > 2 ? "pl-3" : ""}`}
                >
                  {t.title}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </Container>
    </PageShell>
  );
}
