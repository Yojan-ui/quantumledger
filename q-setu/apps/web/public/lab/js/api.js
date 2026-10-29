// One fetch wrapper: timeout, one retry for idempotent GETs (network / 5xx / timeout), abort support,
// typed ApiError, each failure reported once via onError. Normalises both error envelopes:
// new /api/lab routes send {error:{code,message,fields}}, existing routes {error:{code,message,issues}}.
export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** issues:[{path,message}] -> fields:{path:message}; fields pass through; first message per path wins. */
export function normaliseError(body, status) {
  const e = (body && body.error) || {};
  let fields = e.fields && typeof e.fields === "object" ? { ...e.fields } : null;
  if (!fields && Array.isArray(e.issues)) {
    fields = {};
    for (const i of e.issues) {
      const k = i.path || "_";
      if (!(k in fields)) fields[k] = i.message;
    }
  }
  return new ApiError(
    status,
    e.code || `http_${status}`,
    e.message || `Request failed (HTTP ${status})`,
    fields && Object.keys(fields).length ? fields : null,
  );
}

export function createApi({
  fetchImpl,
  onError = () => {},
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  timeoutMs = 15000,
} = {}) {
  async function once(path, opts) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout ?? timeoutMs);
    const onAbort = () => ctl.abort();
    if (opts.signal) opts.signal.addEventListener("abort", onAbort, { once: true });
    try {
      const headers = { Accept: "application/json", ...(opts.headers || {}) };
      let body = opts.body;
      const isForm = typeof FormData !== "undefined" && body instanceof FormData;
      if (body !== undefined && !isForm) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
      }
      const res = await fetchImpl(path, {
        method: opts.method,
        headers,
        body,
        credentials: "same-origin",
        signal: ctl.signal,
        cache: "no-store",
      });
      if (opts.raw && res.ok) return res;
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      if (!res.ok) throw normaliseError(data, res.status);
      return data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (opts.signal && opts.signal.aborted) throw new ApiError(0, "aborted", "Request cancelled");
      if (err && err.name === "AbortError")
        throw new ApiError(0, "timeout", "The server did not answer in time");
      throw new ApiError(0, "network", "Cannot reach the QuantumLedger server");
    } finally {
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
    }
  }
  async function request(path, opts = {}) {
    const o = { method: "GET", quiet: false, ...opts };
    const retries = o.retry ?? (o.method === "GET" ? 1 : 0);
    for (let attempt = 0; ; attempt++) {
      try {
        return await once(path, o);
      } catch (err) {
        const transient = (err.status === 0 && err.code !== "aborted") || err.status >= 500;
        if (transient && attempt < retries) {
          await sleep(300 * (attempt + 1));
          continue;
        }
        if (!o.quiet && err.code !== "aborted") onError(err, path);
        throw err;
      }
    }
  }
  return {
    get: (p, o) => request(p, { ...o, method: "GET" }),
    post: (p, body, o) => request(p, { ...o, method: "POST", body: body ?? {} }),
    request,
  };
}
