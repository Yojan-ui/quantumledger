"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { lockScroll } from "@/lib/client/scroll";

const OPEN_EVENT = "qsetu:command-menu";
export const openCommandMenu = () => window.dispatchEvent(new Event(OPEN_EVENT));

const GROUPS: { heading: string; items: [string, string][] }[] = [
  {
    heading: "Pages",
    items: [
      ["Pipeline", "/atlas/demo"],
      ["Home", "/"],
      ["Platform", "/platform"],
      ["Solutions", "/solutions"],
      ["Fintech", "/solutions/fintech"],
      ["Security", "/security"],
      ["About", "/about"],
      ["Changelog", "/changelog"],
      ["Contact", "/contact"],
    ],
  },
  {
    heading: "Demos",
    items: [
      ["All demos", "/demos"],
      ["Demo 1 · How it works", "/demo/how-it-works"],
      ["Demo 2 · Deploy anywhere", "/demo/deploy"],
      ["Demo 3 · Q-Day time machine", "/demo/qday"],
      ["Demo 4 · Proof Chain", "/demo/ledger"],
      ["Readiness scanner", "/demo/scanner"],
      ["Workspaces", "/atlas"],
      ["Bank demo", "/atlas/demo"],
      ["Pitch (7 slides)", "/pitch"],
    ],
  },
  {
    heading: "Docs",
    items: [
      ["Quickstart", "/docs"],
      ["Shield", "/docs/adapters/shield"],
      ["Web", "/docs/adapters/web"],
      ["SDK", "/docs/adapters/sdk"],
      ["Edge", "/docs/adapters/edge"],
      ["Vault", "/docs/adapters/vault"],
      ["Concepts", "/docs/concepts"],
      ["API reference", "/docs/api"],
      ["Security model", "/docs/security-model"],
    ],
  },
];

/** ⌘K / Ctrl+K: jump to any page, demo or doc, or scan a site. */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const ext = () => setOpen(true);
    window.addEventListener("keydown", key);
    window.addEventListener(OPEN_EVENT, ext);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener(OPEN_EVENT, ext);
    };
  }, []);

  // The page under the menu doesn't scroll while it's open.
  useEffect(() => {
    lockScroll(open);
    return () => lockScroll(false);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  const looksLikeHost = /^[a-z0-9-]+(\.[a-z0-9-]+)+\.?$/i.test(
    q
      .trim()
      .replace(/^https?:\/\//, "")
      .split("/")[0] ?? "",
  );

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-nav px-5 pt-24"
      onClick={() => setOpen(false)}
    >
      <Command
        label="Command menu"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-text overflow-hidden rounded-lg border border-line-strong bg-raised"
      >
        <Command.Input
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="Search pages, demos and docs, or type a website to scan"
          className="h-14 w-full border-b border-line bg-transparent px-4 text-body text-fg outline-none placeholder:text-fg-3"
        />
        <Command.List className="max-h-stage-sm overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-small text-fg-3">No matches.</Command.Empty>
          <Command.Group heading="Scan" className="cmdk-group">
            <Command.Item
              value={looksLikeHost ? `scan ${q}` : "scan a site"}
              onSelect={() =>
                go(
                  looksLikeHost
                    ? `/scan/${encodeURIComponent(
                        q
                          .trim()
                          .replace(/^https?:\/\//, "")
                          .split("/")[0]!,
                      )}`
                    : "/#scan",
                )
              }
              className="cmdk-item"
            >
              {looksLikeHost ? `Scan ${q.trim()}` : "Scan a site"}
            </Command.Item>
          </Command.Group>
          {GROUPS.map((g) => (
            <Command.Group key={g.heading} heading={g.heading} className="cmdk-group">
              {g.items.map(([label, href]) => (
                <Command.Item
                  key={href}
                  value={`${g.heading} ${label}`}
                  onSelect={() => go(href)}
                  className="cmdk-item"
                >
                  {label}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
