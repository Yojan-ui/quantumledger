"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chunkFailed } from "@/lib/client/chunk";
import { lockScroll } from "@/lib/client/scroll";

// The dialog (cmdk) loads the first time the menu opens; until then only this listener ships.
const CommandPalette = dynamic(
  () =>
    import("./CommandPalette")
      .catch(() => import("./CommandPalette"))
      .then((m) => m.CommandPalette)
      .catch(chunkFailed),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 z-50 bg-nav" aria-hidden />,
  },
);

const OPEN_EVENT = "qsetu:command-menu";
export const openCommandMenu = () => window.dispatchEvent(new Event(OPEN_EVENT));

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
  if (!open) return null;
  return <CommandPalette q={q} setQ={setQ} go={go} close={() => setOpen(false)} />;
}
