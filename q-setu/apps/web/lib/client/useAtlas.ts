"use client";

/**
 * Loads one Atlas resource for a component: { data, error, loading, reload }. Aborts on unmount and when
 * the key changes; never retries by itself (an atlas_down error stays visible until the user reloads).
 */
import { useCallback, useEffect, useState } from "react";
import { AtlasError, atlas, type Me } from "./atlas";

export type Loaded<T> = {
  data: T | undefined;
  error: AtlasError | undefined;
  loading: boolean;
  reload: () => void;
};

export function useAtlas<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
): Loaded<T> {
  const [state, setState] = useState<{
    key: string | null;
    data?: T;
    error?: AtlasError;
    loading: boolean;
  }>({
    key,
    loading: key !== null,
  });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (key === null) return;
    const ac = new AbortController();
    setState((s) => ({ key, data: s.key === key ? s.data : undefined, loading: true }));
    load(ac.signal).then(
      (data) => !ac.signal.aborted && setState({ key, data, loading: false }),
      (err: unknown) => {
        if (ac.signal.aborted) return;
        const e =
          err instanceof AtlasError
            ? err
            : new AtlasError(0, "network", "Couldn't reach the Q-Shield proxy");
        setState({ key, error: e, loading: false });
      },
    );
    return () => ac.abort();
    // `load` is keyed by `key`; callers pass inline closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  return state.key === key && key !== null
    ? { data: state.data, error: state.error, loading: state.loading, reload }
    : { data: undefined, error: undefined, loading: key !== null, reload };
}

/** The signed-in Atlas user (or null) and what they may do. Viewer < operator < admin. */
export function useAtlasMe() {
  const me = useAtlas<Me>("me", (signal) => atlas.me({ signal }));
  const role = me.data?.user?.role ?? null;
  const rank = role === "admin" ? 3 : role === "operator" ? 2 : role === "viewer" ? 1 : 0;
  return { ...me, user: me.data?.user ?? null, role, canOperate: rank >= 2, isAdmin: rank >= 3 };
}
