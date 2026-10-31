"use client";

/** /atlas/signin: Atlas's own login (scrypt, HttpOnly session + CSRF cookies set through the proxy). */
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AtlasError, atlas } from "@/lib/client/atlas";

const field =
  "mt-1 h-10 w-full rounded-sm border border-line bg-inset px-3 text-small text-fg focus:border-line-strong";

export function AtlasSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const dest = next && next.startsWith("/atlas") ? next : "/atlas";
  const [f, setF] = useState({ username: "", password: "" });
  const [state, setState] = useState<{ busy: boolean; err?: string }>({ busy: false });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    try {
      await atlas.login(f.username, f.password);
      router.push(dest);
    } catch (err) {
      setState({ busy: false, err: err instanceof AtlasError ? err.message : "sign-in failed" });
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-label space-y-4">
      <label className="block text-small text-fg-2">
        Username
        <input
          className={field}
          autoComplete="username"
          value={f.username}
          onChange={(e) => setF({ ...f, username: e.target.value })}
          required
        />
      </label>
      <label className="block text-small text-fg-2">
        Password
        <input
          className={field}
          type="password"
          autoComplete="current-password"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          required
        />
      </label>
      <button
        type="submit"
        disabled={state.busy}
        className="h-10 rounded-sm bg-fg px-4 font-mono text-micro uppercase text-base hover:opacity-90 disabled:opacity-40"
      >
        {state.busy ? "Signing in…" : "Sign in"}
      </button>
      {state.err && (
        <p role="alert" className="text-small text-danger">
          {state.err}
        </p>
      )}
    </form>
  );
}
