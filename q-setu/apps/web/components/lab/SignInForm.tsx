"use client";
import { useState } from "react";
import { Button } from "@/components/ui";

/** Email in, one-time link out. In development the link is shown here, since no email is sent. */
export function SignInForm({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<{ message: string; devLink?: string }>();
  const [problem, setProblem] = useState(
    error === "link"
      ? "That link has expired or was already used. Ask for a new one."
      : error === "access"
        ? "That address doesn't have Lab access."
        : undefined,
  );
  return (
    <form
      className="mt-8 flex max-w-text flex-col gap-4"
      onSubmit={(e) => e.preventDefault()}
      aria-describedby="lab-signin-status"
    >
      <label className="flex flex-col gap-2">
        <span className="font-mono text-label uppercase text-fg-3">Work email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-sm border border-line-strong bg-raised px-3 text-body text-fg"
          placeholder="you@yourbank.example"
        />
      </label>
      <div>
        <Button
          variant="primary"
          type="submit"
          onClick={async () => {
            setProblem(undefined);
            const r = await fetch("/api/lab/auth/request", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const j = (await r.json()) as {
              message?: string;
              devLink?: string;
              error?: { message: string };
            };
            if (!r.ok) {
              setProblem(j.error?.message ?? "Couldn't send a link.");
              return;
            }
            setDone({
              message: j.message ?? "Check your email.",
              ...(j.devLink ? { devLink: j.devLink } : {}),
            });
          }}
        >
          Email me a sign-in link
        </Button>
      </div>
      <div id="lab-signin-status" role="status" className="text-small">
        {problem && <p className="text-danger">{problem}</p>}
        {done && <p className="text-fg-2">{done.message}</p>}
        {done?.devLink && (
          <p className="mt-2 text-fg-3">
            Development only, no email is sent:{" "}
            <a className="link-u text-fg" href={done.devLink}>
              open the sign-in link
            </a>
          </p>
        )}
      </div>
    </form>
  );
}
