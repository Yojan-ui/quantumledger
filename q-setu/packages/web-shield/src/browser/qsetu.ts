/**
 * qsetu.js: the one-line Q-Setu Web integration (FIPS 203 sealing, FIPS 204 response signatures).
 *
 *   <script src="/qsetu.js" data-key="<server key ID>" data-endpoint="/api/"></script>
 *
 * In a page, it seals form posts and fetch() bodies sent to `data-endpoint` before they leave the
 * browser, and verifies the server's signed responses. It also registers itself as a Service
 * Worker, which catches POSTs the page hook can't see (form.submit(), XHR, navigations).
 * It fails closed: if the server key doesn't match the pinned `data-key`, nothing is sent.
 */
import { sealBody, verifyResponse } from "../client";
import {
  HEADER_SEALED,
  HEADER_SIGNATURE,
  SEALED_CONTENT_TYPE,
  type ServerPublicKeys,
} from "../protocol";

interface Config {
  kid: string;
  endpoint: string;
  keyUrl: string;
}

export interface SealEvent {
  url: string;
  plainBytes: number;
  sealedBytes: number;
  ms: number;
  verified: boolean | null;
  via: "fetch" | "form" | "service-worker";
}

let keysPromise: Promise<ServerPublicKeys> | undefined;

function loadKeys(cfg: Config): Promise<ServerPublicKeys> {
  keysPromise ??= fetch(cfg.keyUrl, { headers: { accept: "application/json" } })
    .then((r) => r.json() as Promise<ServerPublicKeys>)
    .then((k) => {
      if (k.kid !== cfg.kid)
        throw new Error(
          `Q-Setu: server key ${k.kid} doesn't match pinned data-key ${cfg.kid}. Refusing to send.`,
        );
      return k;
    });
  return keysPromise;
}

function protects(cfg: Config, url: string, method: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  const u = new URL(url, self.location.href);
  return u.origin === self.location.origin && u.pathname.startsWith(cfg.endpoint);
}

/** Seal one Request and send it. Shared by the page hook and the Service Worker. */
async function sendSealed(
  cfg: Config,
  req: Request,
  rawFetch: typeof fetch,
  via: SealEvent["via"],
): Promise<{ res: Response; event: SealEvent }> {
  const keys = await loadKeys(cfg);
  const plain = new Uint8Array(await req.arrayBuffer());
  const sealed = sealBody(
    plain,
    req.headers.get("content-type") ?? "application/octet-stream",
    keys,
  );
  const headers = new Headers(req.headers);
  headers.set("content-type", SEALED_CONTENT_TYPE);
  headers.set(HEADER_SEALED, "1");
  const res = await rawFetch(req.url, {
    method: req.method,
    headers,
    body: sealed.body,
    credentials: req.credentials,
    redirect: "follow",
  });
  const body = new Uint8Array(await res.clone().arrayBuffer());
  const verified = res.headers.has(HEADER_SIGNATURE)
    ? verifyResponse(body, res.headers.get(HEADER_SIGNATURE), sealed.nonce, keys)
    : null;
  if (verified === false) throw new Error("Q-Setu: response signature verification failed");
  return {
    res,
    event: {
      url: req.url,
      plainBytes: sealed.plainBytes,
      sealedBytes: sealed.sealedBytes,
      ms: sealed.ms,
      verified,
      via,
    },
  };
}

// ── Service Worker mode ──────────────────────────────────────────────────────────────────────
interface SWScope {
  addEventListener(t: "install", cb: () => void): void;
  addEventListener(t: "activate", cb: (e: { waitUntil(p: Promise<unknown>): void }) => void): void;
  addEventListener(
    t: "fetch",
    cb: (e: { request: Request; respondWith(r: Promise<Response>): void }) => void,
  ): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
}

function runServiceWorker(): void {
  const sw = self as unknown as SWScope;
  const q = new URLSearchParams(self.location.search);
  const cfg: Config = {
    kid: q.get("key") ?? "",
    endpoint: q.get("endpoint") ?? "/",
    keyUrl: q.get("keyUrl") ?? "/api/qsetu/key",
  };
  sw.addEventListener("install", () => void sw.skipWaiting());
  sw.addEventListener("activate", (e) => e.waitUntil(sw.clients.claim()));
  sw.addEventListener("fetch", (e) => {
    const r = e.request;
    if (!protects(cfg, r.url, r.method) || r.headers.has(HEADER_SEALED)) return;
    e.respondWith(sendSealed(cfg, r, fetch.bind(self), "service-worker").then((x) => x.res));
  });
}

// ── Page mode ────────────────────────────────────────────────────────────────────────────────
function runInPage(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return;
  const cfg: Config = {
    kid: script.dataset.key ?? "",
    endpoint: script.dataset.endpoint ?? "/",
    keyUrl: script.dataset.keyUrl ?? "/api/qsetu/key",
  };
  const rawFetch = window.fetch.bind(window);
  const emit = (event: SealEvent) =>
    window.dispatchEvent(new CustomEvent("qsetu:sealed", { detail: event }));

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    if (!protects(cfg, req.url, req.method) || req.headers.has(HEADER_SEALED)) return rawFetch(req);
    const { res, event } = await sendSealed(cfg, req, rawFetch, "fetch");
    emit(event);
    return res;
  };

  document.addEventListener(
    "submit",
    (ev) => {
      const form = ev.target as HTMLFormElement;
      const method = (form.getAttribute("method") ?? "GET").toUpperCase();
      if (!protects(cfg, form.action, method)) return;
      ev.preventDefault();
      const req = new Request(form.action, {
        method,
        body: new FormData(form),
        headers: { accept: "text/html" },
      });
      void sendSealed(cfg, req, rawFetch, "form").then(async ({ res, event }) => {
        emit(event);
        const html = await res.text();
        document.open();
        document.write(html); // render the response as a normal form post would
        document.close();
      });
    },
    true,
  );

  if (script.dataset.sw !== "off" && "serviceWorker" in navigator) {
    const u = new URL(script.src);
    u.search = new URLSearchParams({
      sw: "1",
      key: cfg.kid,
      endpoint: cfg.endpoint,
      keyUrl: cfg.keyUrl,
    }).toString();
    navigator.serviceWorker.register(u.href).catch(() => {
      /* page hook still protects fetch and forms */
    });
  }

  const ready = loadKeys(cfg).then((k) => {
    document.documentElement.dataset.qsetu = "on";
    window.dispatchEvent(
      new CustomEvent("qsetu:ready", { detail: { kid: k.kid, profile: k.profile } }),
    );
    return k;
  });
  (window as unknown as { qsetu: unknown }).qsetu = { ready, config: cfg };
}

if (typeof document === "undefined") runServiceWorker();
else runInPage();
