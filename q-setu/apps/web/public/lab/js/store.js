// Client cache: each resource is fetched once per session; SSE patches run state. No refetch on route change.
export function createStore({
  api,
  EventSourceImpl = typeof EventSource === "function" ? EventSource : null,
}) {
  const cache = new Map();
  const get = (key, path, opts) => {
    if (!cache.has(key))
      cache.set(
        key,
        api.get(path, opts).catch((e) => {
          cache.delete(key);
          throw e;
        }),
      );
    return cache.get(key);
  };
  const set = (key, value) => cache.set(key, Promise.resolve(value));
  const invalidate = (...keys) => keys.forEach((k) => cache.delete(k));

  /** Streams a run's events (replay + live). Returns a closer. Terminal events close the stream. */
  function runStream(runId, onEvent) {
    if (!EventSourceImpl) return () => {};
    const es = new EventSourceImpl(`/api/lab/runs/${runId}/events`);
    const types = [
      "status",
      "stage",
      "progress",
      "log",
      "file",
      "url",
      "result",
      "error",
      "cancelled",
    ];
    let closed = false;
    const close = () => {
      if (!closed) {
        closed = true;
        es.close();
      }
    };
    for (const t of types) {
      es.addEventListener(t, (ev) => {
        let data = {};
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }
        onEvent({ type: t, seq: Number(ev.lastEventId) || null, data });
        if (t === "result" || t === "error" || t === "cancelled") {
          close();
          invalidate(`run:${runId}`, `result:${runId}`);
        }
      });
    }
    es.onerror = () => {
      if (es.readyState === 2) onEvent({ type: "stream-closed", data: {} });
    };
    return close;
  }
  return { get, set, invalidate, runStream };
}
