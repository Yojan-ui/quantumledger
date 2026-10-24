"use client";
import { buttonClass } from "@/components/ui";

/**
 * Demo mode sign-in: a plain HTML form posting to /api/lab/auth/demo, so it works the moment the
 * page appears (no wait for JavaScript) and with no mail service. Lists the demo addresses.
 */
export function DemoSignIn({
  accounts,
  error,
}: {
  accounts: { email: string; role: string; customerId?: string }[];
  error?: string;
}) {
  return (
    <div className="mt-8 max-w-text">
      <form method="post" action="/api/lab/auth/demo" className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-label uppercase text-fg-3">Work email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="h-10 rounded-sm border border-line-strong bg-raised px-3 text-body text-fg"
            placeholder="you@yourcompany.com"
          />
        </label>
        <div>
          <button type="submit" className={buttonClass("primary")}>
            Sign in
          </button>
        </div>
        {(error === "email" || error === "demo") && (
          <p role="status" className="text-small text-danger">
            That doesn’t look like an email address. Check it and try again.
          </p>
        )}
        {error === "engine" && (
          <p role="status" className="text-small text-danger">
            The Lab is still starting. Wait a few seconds and sign in again.
          </p>
        )}
        <p className="text-small text-fg-3">
          Any email address works. A new address gets its own empty workspace for its domain; no
          email is sent.
        </p>
      </form>
      <div className="mt-8 rounded-lg border border-line bg-raised p-6">
        <p className="font-mono text-label uppercase text-kem">Quick demo logins</p>
        <p className="mt-2 text-small text-fg-2">
          Seeded accounts with data already in them. Pick one:
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {accounts.map((a) => (
            <li key={a.email}>
              <form
                method="post"
                action="/api/lab/auth/demo"
                className="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="email" value={a.email} />
                <button
                  type="submit"
                  className="font-mono text-small text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-fg"
                >
                  {a.email}
                </button>
                <span className="text-small text-fg-3">
                  {a.role === "team"
                    ? "team admin, sees every customer"
                    : `customer (${a.customerId}), own data only`}
                </span>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
