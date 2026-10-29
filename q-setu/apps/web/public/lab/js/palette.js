// Command palette (Cmd/Ctrl+K) and keyboard shortcut list. rankCommands is pure (node-tested); the dialog is a
// combobox + listbox with full keyboard support, focus kept inside while open and restored on close.
import { h } from "./dom.js";

const norm = (s) => String(s).toLowerCase();

/**
 * commands: [{id, title, group, keywords?, hint?, run}] in display order. Every word of the query must occur in
 * the title or keywords. Title prefix beats word start beats anywhere; ties keep display order.
 */
export function rankCommands(commands, query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return commands.slice();
  const out = [];
  commands.forEach((c, i) => {
    const title = norm(c.title);
    const hay = `${title} ${norm(c.keywords || "")}`;
    if (!words.every((w) => hay.includes(w))) return;
    const q = words.join(" ");
    const score = title.startsWith(q)
      ? 0
      : new RegExp(`(^|\\W)${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(title)
        ? 1
        : title.includes(words[0])
          ? 2
          : 3;
    out.push({ c, score, i });
  });
  return out.sort((a, b) => a.score - b.score || a.i - b.i).map((x) => x.c);
}

export const SHORTCUTS = [
  ["⌘K / Ctrl+K", "Command palette"],
  ["?", "This list"],
  ["N", "New scan (Lab home)"],
  ["⌘↵ / Ctrl+↵", "Run scan (New scan)"],
  ["Esc", "Cancel the running scan · back to results from a finding · close dialogs"],
  ["↵", "Open results (finished run) · inspect the most severe finding (results)"],
  ["J / K", "Next / previous finding"],
  ["Tab", "Move between controls; the first Tab reaches “Skip to content”"],
];

let open = null; // the dialog that is showing

function overlay(label, body, onKey) {
  const prev = document.activeElement;
  const panel = h(
    "div",
    { class: "palette", role: "dialog", "aria-modal": "true", "aria-label": label },
    body,
  );
  const back = h(
    "div",
    { class: "palette-back", onclick: (e) => e.target === back && close() },
    panel,
  );
  function close() {
    if (open !== api) return;
    open = null;
    back.classList.add("leaving");
    document.removeEventListener("keydown", key, true);
    setTimeout(() => back.remove(), 180);
    // back where the person was; if that was nowhere in particular, to the main content (not the page top)
    const to =
      prev && prev !== document.body && prev.isConnected ? prev : document.getElementById("main");
    if (to && to.focus) to.focus({ preventScroll: true });
  }
  function key(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      return;
    } // one focus stop inside: keep it there
    onKey && onKey(e);
  }
  const api = { close, panel };
  if (open) open.close();
  open = api;
  document.addEventListener("keydown", key, true);
  document.body.append(back);
  return api;
}

export const isOpen = () => !!open;

export function openPalette(commands) {
  let list = commands.slice(),
    active = 0;
  const input = h("input", {
    class: "palette-input",
    type: "text",
    role: "combobox",
    "aria-expanded": "true",
    "aria-controls": "palette-list",
    "aria-autocomplete": "list",
    placeholder: "Type a command or a run",
    autocomplete: "off",
    spellcheck: "false",
  });
  const ul = h("ul", {
    class: "palette-list",
    id: "palette-list",
    role: "listbox",
    "aria-label": "Commands",
  });
  const empty = h("p", { class: "palette-empty", text: "No command matches." });
  function paint() {
    ul.replaceChildren(
      ...list.map((c, i) => {
        const li = h(
          "li",
          {
            role: "option",
            id: `cmd-${i}`,
            "aria-selected": i === active ? "true" : "false",
            onmousemove: () => {
              if (active !== i) {
                active = i;
                paint();
              }
            },
            onclick: () => choose(i),
          },
          h("span", { class: "palette-group", text: c.group }),
          h("span", { class: "palette-title", text: c.title }),
          c.hint ? h("kbd", { text: c.hint }) : null,
        );
        return li;
      }),
    );
    empty.hidden = list.length > 0;
    input.setAttribute("aria-activedescendant", list.length ? `cmd-${active}` : "");
    const el = ul.children[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }
  function choose(i) {
    const c = list[i];
    if (!c) return;
    dlg.close();
    c.run();
  }
  const dlg = overlay("Command palette", [input, ul, empty], (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = Math.min(list.length - 1, active + 1);
      paint();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(0, active - 1);
      paint();
    } else if (e.key === "Home") {
      e.preventDefault();
      active = 0;
      paint();
    } else if (e.key === "End") {
      e.preventDefault();
      active = Math.max(0, list.length - 1);
      paint();
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    }
  });
  input.addEventListener("input", () => {
    list = rankCommands(commands, input.value);
    active = 0;
    paint();
  });
  paint();
  input.focus();
  return dlg;
}

export function openShortcuts() {
  const done = h(
    "button",
    { class: "btn", type: "button", onclick: () => dlg.close() },
    "Close",
    h("span", { class: "key", text: "Esc" }),
  );
  const dlg = overlay("Keyboard shortcuts", [
    h("p", { class: "eyebrow", text: "Keyboard shortcuts" }),
    h(
      "table",
      { class: "shortcuts" },
      h(
        "tbody",
        {},
        SHORTCUTS.map(([k, v]) =>
          h("tr", {}, h("th", { scope: "row" }, h("kbd", { text: k })), h("td", { text: v })),
        ),
      ),
    ),
    h("div", { class: "actions" }, done),
  ]);
  done.focus();
  return dlg;
}
