import type { Metadata } from "next";
import { Button, Container, Label, PageShell, Text } from "@/components/ui";
import { adminState, isAdmin, totpRequired } from "@/lib/server/admin";
import { listSignups } from "@/lib/server/store";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const state = adminState();
  if (state !== "enabled")
    return (
      <PageShell>
        <Container className="py-32">
          <Label>Admin</Label>
          <h1 className="mt-4 text-h2 font-medium text-fg">Admin is disabled.</h1>
          <Text className="mt-2">
            {state === "no_password"
              ? "Set ADMIN_PASSWORD (12+ characters) to enable it."
              : "Production admin needs a second factor: set ADMIN_TOTP_SECRET (node scripts/admin-totp.mjs makes one)."}
          </Text>
        </Container>
      </PageShell>
    );
  if (!(await isAdmin()))
    return (
      <PageShell>
        <Container className="py-32">
          <Label>Admin</Label>
          <h1 className="mt-4 text-h2 font-medium text-fg">Sign in.</h1>
          <form method="post" action="/api/admin/login" className="mt-8 flex max-w-text gap-2">
            <label htmlFor="pw" className="sr-only">
              Password
            </label>
            <input
              id="pw"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-inset px-3 text-small text-fg outline-none focus:border-line-strong"
            />
            {totpRequired() && (
              <>
                <label htmlFor="code" className="sr-only">
                  6-digit code from your authenticator app
                </label>
                <input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="h-10 w-28 rounded-sm border border-line bg-inset px-3 font-mono text-small text-fg outline-none placeholder:text-fg-3 focus:border-line-strong"
                />
              </>
            )}
            <Button variant="primary" type="submit">
              Sign in
            </Button>
          </form>
          {error && (
            <Text size="small" className="mt-3">
              {error === "rate"
                ? "Too many attempts. Try again later."
                : totpRequired()
                  ? "That password or code didn’t work."
                  : "That password didn’t work."}
            </Text>
          )}
        </Container>
      </PageShell>
    );
  const rows = await listSignups();
  return (
    <PageShell>
      <Container className="py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Label>Admin</Label>
            <h1 className="mt-4 text-h2 font-medium text-fg">
              <span className="tabular">{rows.length}</span> signups
            </h1>
          </div>
          <a
            href="/api/admin/signups.csv"
            className="inline-flex h-10 items-center rounded-sm border border-line-strong px-4 text-small text-fg hover:bg-raised"
          >
            Export CSV
          </a>
        </div>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-panel text-left text-small">
            <thead>
              <tr className="border-b border-line">
                {["When", "Kind", "Name", "Email", "Organisation", "Sector", "Use case"].map(
                  (h) => (
                    <Label as="th" key={h} className="pb-3 pr-4 font-normal">
                      {h}
                    </Label>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-fg-3">
                    No signups yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top">
                  <td className="tabular py-3 pr-4 text-fg-3">
                    {r.createdAt.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="py-3 pr-4 text-fg-2">{r.kind}</td>
                  <td className="py-3 pr-4 text-fg">{r.name}</td>
                  <td className="py-3 pr-4 text-fg-2">{r.email}</td>
                  <td className="py-3 pr-4 text-fg-2">{r.organisation}</td>
                  <td className="py-3 pr-4 text-fg-2">{r.sector}</td>
                  <td className="max-w-text py-3 text-fg-2">{r.useCase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </PageShell>
  );
}
